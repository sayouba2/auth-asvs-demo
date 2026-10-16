import request from 'supertest';
import { createHash } from 'node:crypto';
import { INestApplication, Logger } from '@nestjs/common';
import { PrismaService } from '../src/users/prisma.service';
import { PasswordPolicy } from '../src/security/password-policy';
import { SessionService } from '../src/auth/session.service';
import { ORIGIN, PASSWORD, NEXT_PASSWORD, setup, reset, post, register, login, cookie, clearRates } from './helpers';
let app: INestApplication, prisma: PrismaService;
beforeAll(async () => { ({ app, prisma } = await setup()); });
beforeEach(async () => reset(app));
afterAll(async () => { if (app) { await reset(app); await app.close(); } });

test('F-01 F-02 F-03 C-02 C-03 inscription, hash salé, session opaque, compte public', async () => {
  const created = await register(app);
  expect(Object.keys(created.body).sort()).toEqual(['createdAt', 'email', 'id']);
  const user = await prisma.user.findUniqueOrThrow({ where: { email: 'test-user@example.test' } });
  expect(user.passwordHash).toMatch(/^\$argon2id\$v=19\$m=65536,t=3,p=1\$/);
  const response = await post(app, 'login').send({ email: user.email, password: PASSWORD }).expect(200);
  const sessionCookie = cookie(response);
  const token = sessionCookie.split('=')[1];
  expect(Buffer.from(token, 'base64url')).toHaveLength(32);
  const stored = await prisma.session.findFirstOrThrow();
  expect(stored.tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
  expect(JSON.stringify(stored)).not.toContain(token);
  expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
  expect(response.headers['set-cookie'][0]).toContain('SameSite=Lax');
  expect(response.headers['set-cookie'][0]).toContain('Path=/');
  expect(response.headers['set-cookie'][0]).toContain('Max-Age=43200');
  const me = await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', sessionCookie).expect(200);
  expect(me.body).toEqual(created.body);
});
test('F-04 F-08 C-08 routes privées bloquées directement dans NestJS', async () => {
  await request(app.getHttpServer()).get('/api/auth/me').expect(401);
  await post(app, 'change-password').send({ currentPassword: PASSWORD, newPassword: NEXT_PASSWORD }).expect(401);
  await post(app, 'logout').expect(401);
  await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', 'session=forged').expect(401);
});
test('T-03 V6.2.2 F-05 F-06 C-05 changement et révocation de toutes les sessions', async () => {
  await register(app);
  const a = await login(app), b = await login(app);
  await post(app, 'change-password').set('Cookie', a)
    .send({ currentPassword: PASSWORD, newPassword: NEXT_PASSWORD }).expect(200);
  for (const c of [a, b]) await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', c).expect(401);
  await post(app, 'login').send({ email: 'test-user@example.test', password: PASSWORD }).expect(401);
  await login(app, 'test-user@example.test', NEXT_PASSWORD);
  expect(await prisma.session.count({ where: { revokedAt: { not: null } } })).toBe(2);
});
test('T-04 V6.2.3 absence ou erreur du mot de passe actuel : aucune mutation', async () => {
  await register(app); const c = await login(app);
  const before = await prisma.user.findFirstOrThrow();
  await post(app, 'change-password').set('Cookie', c).send({ newPassword: NEXT_PASSWORD }).expect(400);
  await post(app, 'change-password').set('Cookie', c).send({ currentPassword: PASSWORD }).expect(400);
  await post(app, 'change-password').set('Cookie', c).send({ currentPassword: 'incorrect', newPassword: NEXT_PASSWORD }).expect(401);
  expect((await prisma.user.findFirstOrThrow()).passwordHash).toBe(before.passwordHash);
  await post(app, 'change-password').set('Cookie', c).send({ currentPassword: PASSWORD, newPassword: NEXT_PASSWORD }).expect(200);
});
test.each([7, 8, 14, 15, 64, 128])('T-02 V6.2.1 inscription de %i caractères', async length => {
  await post(app, 'register').send({ email: 'length@example.test', password: 'é'.repeat(length) }).expect(length < 8 ? 400 : 201);
});
test.each([7, 8, 14, 15, 64, 128])('T-02 V6.2.1 changement de %i caractères', async length => {
  await register(app); const c = await login(app);
  await post(app, 'change-password').set('Cookie', c).send({ currentPassword: PASSWORD, newPassword: 'é'.repeat(length) })
    .expect(length < 8 ? 400 : 200);
});
test('T-05 V6.2.4 liste réelle appliquée aux deux routes sans contournement API', async () => {
  const blocked = [...app.get(PasswordPolicy).blocked];
  expect(blocked.length).toBeGreaterThanOrEqual(3000);
  for (const password of [blocked[0], blocked[Math.floor(blocked.length / 2)], blocked[blocked.length - 1]]) {
    await post(app, 'register').send({ email: 'blocked@example.test', password }).expect(400);
  }
  await register(app); const c = await login(app);
  for (const password of [blocked[0], blocked[Math.floor(blocked.length / 2)], blocked[blocked.length - 1]]) {
    await post(app, 'change-password').set('Cookie', c)
      .send({ currentPassword: PASSWORD, newPassword: password }).expect(400);
  }
  await login(app);
});
test.each(['unephrasepaisible', 'UNEFORETPAISIBLE', '  des espaces  ', 'Été à Ouagadougou !', '🦋'.repeat(8), '9438172635094827'])(
  'T-06 V6.2.5 composition libre : %s', async password => {
    await register(app, 'composition@example.test', password);
    await login(app, 'composition@example.test', password);
    await register(app, 'change-composition@example.test', PASSWORD);
    const c = await login(app, 'change-composition@example.test');
    await post(app, 'change-password').set('Cookie', c)
      .send({ currentPassword: PASSWORD, newPassword: password }).expect(200);
    await login(app, 'change-composition@example.test', password);
  });
test.each([
  ['  Casse et espaces  ', 'Casse et espaces'],
  ['La Casse Compte', 'la casse compte'],
  ['été près du lac', 'ete pres du lac'],
  ['é'.repeat(8), 'e\u0301'.repeat(8)],
  ['z'.repeat(64) + 'a', 'z'.repeat(64) + 'b'],
])('T-09 V6.2.8 vérification exacte sans transformation, cas %#', async (password, variant) => {
  await register(app, 'exact@example.test', password);
  await post(app, 'login').send({ email: 'exact@example.test', password: variant }).expect(401);
  await login(app, 'exact@example.test', password);
  await register(app, 'variant@example.test', variant);
  await login(app, 'variant@example.test', variant);
  await post(app, 'login').send({ email: 'variant@example.test', password }).expect(401);
});
test('F-07 C-04 déconnexion, expiration et suppression des sessions expirées', async () => {
  await register(app); const c = await login(app);
  const response = await post(app, 'logout').set('Cookie', c).expect(200);
  expect(response.headers['set-cookie'][0]).toContain('Expires=Thu, 01 Jan 1970');
  await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', c).expect(401);
  const d = await login(app);
  await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
  await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', d).expect(401);
  await app.get(SessionService).cleanup();
  expect(await prisma.session.count()).toBe(0);
});
test('F-09 C-07 erreurs de connexion génériques, réponses sans secret', async () => {
  await register(app);
  const unknown = await post(app, 'login').send({ email: 'unknown@example.test', password: 'incorrect' }).expect(401);
  const known = await post(app, 'login').send({ email: 'test-user@example.test', password: 'incorrect' }).expect(401);
  expect(unknown.body).toEqual(known.body);
  expect(Object.keys(known.body).sort()).toEqual(['message', 'statusCode']);
});
test('C-07 journalisation des événements sans mot de passe, e-mail brut, hash ou jeton', async () => {
  const captured: string[] = [];
  const spy = jest.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => { captured.push(String(message)); });
  try {
    await register(app);
    await post(app, 'login').send({ email: 'test-user@example.test', password: 'secret-incorrect-fictif' }).expect(401);
    const c = await login(app);
    const user = await prisma.user.findFirstOrThrow();
    await post(app, 'logout').set('Cookie', c).expect(200);
    const logs = captured.join('\n');
    for (const value of [PASSWORD, 'secret-incorrect-fictif', 'test-user@example.test', user.passwordHash, c.split('=')[1]])
      expect(logs).not.toContain(value);
    for (const event of ['register_success', 'login_failure', 'login_success', 'logout']) expect(logs).toContain(event);
  } finally { spy.mockRestore(); }
});
test('T-09 V6.2.8 Unicode malformé refusé avant encodage UTF-8', async () => {
  await post(app, 'register').send({ email: 'unicode@example.test', password: 'abcdefgh\ud800' }).expect(400);
  await register(app, 'unicode@example.test', 'abcdefgh\ufffd');
  await post(app, 'login').send({ email: 'unicode@example.test', password: 'abcdefgh\ud800' }).expect(400);
});
test('C-06 CSRF : origine stricte, referer de secours, aucun GET mutant', async () => {
  await register(app); const c = await login(app);
  for (const origin of ['https://evil.test', 'null', ORIGIN + '.evil.test']) {
    await request(app.getHttpServer()).post('/api/auth/logout').set('Cookie', c).set('Origin', origin).expect(403);
  }
  await request(app.getHttpServer()).post('/api/auth/logout').set('Cookie', c).expect(403);
  await request(app.getHttpServer()).get('/api/auth/logout').set('Cookie', c).expect(404);
  await request(app.getHttpServer()).post('/api/auth/logout').set('Cookie', c).set('Referer', ORIGIN + '/welcome').expect(200);
});
test('normalisation e-mail indépendante, unicité et champs supplémentaires refusés', async () => {
  await register(app, '  Account@Example.test ');
  await login(app, 'ACCOUNT@example.test');
  await register(app, 'other@example.test');
  await post(app, 'register').send({ email: 'account@example.test', password: PASSWORD }).expect(409);
  await post(app, 'register').send({ email: 'extra@example.test', password: PASSWORD, admin: true }).expect(400);
  const users = await prisma.user.findMany();
  expect(users[0].passwordHash).not.toBe(users[1].passwordHash);
});
test('concurrence : aucune session obtenue avec ancien secret ne survit au changement', async () => {
  await register(app); const c = await login(app);
  await clearRates(app);
  const [loginResult, changeResult] = await Promise.all([
    post(app, 'login').send({ email: 'test-user@example.test', password: PASSWORD }),
    post(app, 'change-password').set('Cookie', c).send({ currentPassword: PASSWORD, newPassword: NEXT_PASSWORD }),
  ]);
  expect(changeResult.status).toBe(200);
  expect([200, 401]).toContain(loginResult.status);
  if (loginResult.status === 200)
    await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', cookie(loginResult)).expect(401);
  expect(await prisma.session.count({ where: { revokedAt: null } })).toBe(0);
});
