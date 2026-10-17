import request from 'supertest';
import { createHash, randomUUID } from 'node:crypto';
import { INestApplication, Logger } from '@nestjs/common';
import { PrismaService } from '../src/users/prisma.service';
import { PasswordPolicy } from '../src/security/password-policy';
import { SessionService } from '../src/auth/session.service';
import { ORIGIN, PASSWORD, NEXT_PASSWORD, setup, reset, post, activeUser, login, cookie, clearRates } from './helpers';
let app: INestApplication, prisma: PrismaService;
beforeAll(async () => { ({ app, prisma } = await setup()); });
beforeEach(async () => reset(app));
afterAll(async () => { if (app) { await reset(app); await app.close(); } });

test('F-02 F-03 C-02 C-03 hash salé, session opaque, compte public', async () => {
  await activeUser(app);
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
  expect(Object.keys(me.body).sort()).toEqual(['createdAt', 'email', 'id', 'mustChangePassword', 'role']);
  expect(me.body).toMatchObject({ id: user.id, email: user.email, role: 'USER', mustChangePassword: false });
});
test('F-04 F-08 C-08 routes privées bloquées directement dans NestJS', async () => {
  await request(app.getHttpServer()).get('/api/auth/me').expect(401);
  await post(app, 'change-password').send({ currentPassword: PASSWORD, newPassword: NEXT_PASSWORD }).expect(401);
  await post(app, 'logout').expect(401);
  await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', 'session=forged').expect(401);
});
test('T-03 V6.2.2 F-05 F-06 C-05 changement et révocation de toutes les sessions', async () => {
  await activeUser(app);
  const a = await login(app), b = await login(app);
  await post(app, 'change-password').set('Cookie', a)
    .send({ currentPassword: PASSWORD, newPassword: NEXT_PASSWORD }).expect(200);
  for (const c of [a, b]) await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', c).expect(401);
  await post(app, 'login').send({ email: 'test-user@example.test', password: PASSWORD }).expect(401);
  await login(app, 'test-user@example.test', NEXT_PASSWORD);
  expect(await prisma.session.count({ where: { revokedAt: { not: null } } })).toBe(2);
});
test('T-04 V6.2.3 absence ou erreur du mot de passe actuel : aucune mutation', async () => {
  await activeUser(app); const c = await login(app);
  const before = await prisma.user.findFirstOrThrow();
  await post(app, 'change-password').set('Cookie', c).send({ newPassword: NEXT_PASSWORD }).expect(400);
  await post(app, 'change-password').set('Cookie', c).send({ currentPassword: PASSWORD }).expect(400);
  await post(app, 'change-password').set('Cookie', c).send({ currentPassword: 'incorrect', newPassword: NEXT_PASSWORD }).expect(401);
  expect((await prisma.user.findFirstOrThrow()).passwordHash).toBe(before.passwordHash);
  await post(app, 'change-password').set('Cookie', c).send({ currentPassword: PASSWORD, newPassword: NEXT_PASSWORD }).expect(200);
});
test.each([7, 8, 14, 15, 64, 128])('T-02 V6.2.1 changement de %i caractères', async length => {
  await activeUser(app); const c = await login(app);
  await post(app, 'change-password').set('Cookie', c).send({ currentPassword: PASSWORD, newPassword: 'é'.repeat(length) })
    .expect(length < 8 ? 400 : 200);
});
test('T-05 V6.2.4 liste réelle appliquée au changement sans contournement API', async () => {
  const blocked = [...app.get(PasswordPolicy).blocked];
  expect(blocked.length).toBeGreaterThanOrEqual(3000);
  await activeUser(app); const c = await login(app);
  for (const password of [blocked[0], blocked[Math.floor(blocked.length / 2)], blocked[blocked.length - 1]]) {
    await post(app, 'change-password').set('Cookie', c)
      .send({ currentPassword: PASSWORD, newPassword: password }).expect(400);
  }
  await login(app);
});
test.each(['unephrasepaisible', 'UNEFORETPAISIBLE', '  des espaces  ', 'Été à Ouagadougou !', '🦋'.repeat(8), '9438172635094827'])(
  'T-06 V6.2.5 composition libre : %s', async password => {
    await activeUser(app, 'change-composition@example.test', PASSWORD);
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
  await activeUser(app, 'exact@example.test', password);
  await post(app, 'login').send({ email: 'exact@example.test', password: variant }).expect(401);
  await login(app, 'exact@example.test', password);
  await activeUser(app, 'variant@example.test', variant);
  await login(app, 'variant@example.test', variant);
  await post(app, 'login').send({ email: 'variant@example.test', password }).expect(401);
});
test('F-07 C-04 déconnexion, expiration et suppression des sessions expirées', async () => {
  await activeUser(app); const c = await login(app);
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
  await activeUser(app);
  const unknown = await post(app, 'login').send({ email: 'unknown@example.test', password: 'incorrect' }).expect(401);
  const known = await post(app, 'login').send({ email: 'test-user@example.test', password: 'incorrect' }).expect(401);
  expect(unknown.body).toEqual(known.body);
  expect(Object.keys(known.body).sort()).toEqual(['message', 'statusCode']);
});
test('C-07 journalisation des événements sans mot de passe, e-mail brut, hash ou jeton', async () => {
  const captured: string[] = [];
  const spy = jest.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => { captured.push(String(message)); });
  try {
    await post(app, 'register').send({ email: 'request@example.test' }).expect(202);
    await activeUser(app);
    await post(app, 'login').send({ email: 'test-user@example.test', password: 'secret-incorrect-fictif' }).expect(401);
    const c = await login(app);
    const user = await prisma.user.findFirstOrThrow();
    await post(app, 'logout').set('Cookie', c).expect(200);
    const logs = captured.join('\n');
    for (const value of [PASSWORD, 'secret-incorrect-fictif', 'test-user@example.test', 'request@example.test', user.passwordHash, c.split('=')[1]])
      expect(logs).not.toContain(value);
    for (const event of ['registration_requested', 'login_failure', 'login_success', 'logout']) expect(logs).toContain(event);
  } finally { spy.mockRestore(); }
});
test('T-09 V6.2.8 Unicode malformé refusé avant encodage UTF-8', async () => {
  await activeUser(app, 'unicode@example.test', 'abcdefgh\ufffd');
  await post(app, 'login').send({ email: 'unicode@example.test', password: 'abcdefgh\ud800' }).expect(400);
  const c = await login(app, 'unicode@example.test', 'abcdefgh\ufffd');
  await post(app, 'change-password').set('Cookie', c)
    .send({ currentPassword: 'abcdefgh\ufffd', newPassword: 'abcdefgh\ud800' }).expect(400);
});
test('C-06 CSRF : origine stricte, referer de secours, aucun GET mutant', async () => {
  await activeUser(app); const c = await login(app);
  for (const origin of ['https://evil.test', 'null', ORIGIN + '.evil.test']) {
    await request(app.getHttpServer()).post('/api/auth/logout').set('Cookie', c).set('Origin', origin).expect(403);
  }
  await request(app.getHttpServer()).post('/api/auth/logout').set('Cookie', c).expect(403);
  await request(app.getHttpServer()).get('/api/auth/logout').set('Cookie', c).expect(404);
  await request(app.getHttpServer()).post('/api/auth/logout').set('Cookie', c).set('Referer', ORIGIN + '/welcome').expect(200);
});
test('inscription : e-mail normalisé, aucun mot de passe accepté, réponse identique si le compte existe', async () => {
  await post(app, 'register').send({ email: '  Account@Example.test ' }).expect(202);
  await post(app, 'register').send({ email: 'account@example.test' }).expect(202);
  expect((await prisma.registrationRequest.findMany()).map(r => r.email)).toEqual(['account@example.test']);
  await post(app, 'register').send({ email: 'extra@example.test', password: PASSWORD }).expect(400);
  await post(app, 'register').send({ email: 'extra@example.test', admin: true }).expect(400);
  await activeUser(app);
  const existing = await post(app, 'register').send({ email: 'test-user@example.test' }).expect(202);
  const fresh = await post(app, 'register').send({ email: 'fresh@example.test' }).expect(202);
  expect(existing.body).toEqual(fresh.body);
  expect(await prisma.registrationRequest.count()).toBe(2);
  expect(await prisma.user.count()).toBe(1);
});
const approve = async (adminCookie: string, email: string) => {
  const list = await request(app.getHttpServer()).get('/api/admin/requests').set('Cookie', adminCookie).expect(200);
  const pending = (list.body as { id: string; email: string }[]).find(r => r.email === email)!;
  const approved = await request(app.getHttpServer()).post('/api/admin/requests/' + pending.id + '/approve')
    .set('Origin', ORIGIN).set('Cookie', adminCookie).expect(200);
  return approved.body as { email: string; initialPassword: string; expiresAt: string };
};
test('T-12 V6.4.1 mot de passe initial aléatoire, haché, à usage unique et à remplacer', async () => {
  await activeUser(app, 'admin@example.test', PASSWORD, 'ADMIN');
  const admin = await login(app, 'admin@example.test');
  await post(app, 'register').send({ email: 'new@example.test' }).expect(202);
  const account = await approve(admin, 'new@example.test');
  expect(Object.keys(account).sort()).toEqual(['email', 'expiresAt', 'initialPassword']);
  expect(account.initialPassword).toMatch(/^[A-Za-z0-9_-]{24}$/);
  expect(() => app.get(PasswordPolicy).validate(account.initialPassword)).not.toThrow();
  const user = await prisma.user.findUniqueOrThrow({ where: { email: 'new@example.test' } });
  expect(user.passwordHash).toMatch(/^\$argon2id\$/);
  expect(JSON.stringify(user)).not.toContain(account.initialPassword);
  expect(user.mustChangePassword).toBe(true);
  expect(user.initialPasswordExpiresAt!.getTime() - Date.now()).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
  expect(await prisma.registrationRequest.count()).toBe(0);
  const first = await post(app, 'login').send({ email: 'new@example.test', password: account.initialPassword }).expect(200);
  expect(first.body.mustChangePassword).toBe(true);
  const c = cookie(first);
  await post(app, 'login').send({ email: 'new@example.test', password: account.initialPassword }).expect(401);
  await request(app.getHttpServer()).get('/api/admin/requests').set('Cookie', c).expect(403);
  await post(app, 'change-password').set('Cookie', c)
    .send({ currentPassword: account.initialPassword, newPassword: account.initialPassword }).expect(400);
  await post(app, 'change-password').set('Cookie', c)
    .send({ currentPassword: account.initialPassword, newPassword: NEXT_PASSWORD }).expect(200);
  const after = await prisma.user.findUniqueOrThrow({ where: { email: 'new@example.test' } });
  expect(after).toMatchObject({ mustChangePassword: false, initialPasswordExpiresAt: null });
  const next = await post(app, 'login').send({ email: 'new@example.test', password: NEXT_PASSWORD }).expect(200);
  expect(next.body.mustChangePassword).toBe(false);
  await post(app, 'login').send({ email: 'new@example.test', password: account.initialPassword }).expect(401);
});
test('T-12 V6.4.1 mot de passe initial expiré et secrets distincts', async () => {
  await activeUser(app, 'admin@example.test', PASSWORD, 'ADMIN');
  const admin = await login(app, 'admin@example.test');
  for (const email of ['one@example.test', 'two@example.test']) await post(app, 'register').send({ email }).expect(202);
  const one = await approve(admin, 'one@example.test'), two = await approve(admin, 'two@example.test');
  expect(one.initialPassword).not.toBe(two.initialPassword);
  await prisma.user.update({ where: { email: 'one@example.test' }, data: { initialPasswordExpiresAt: new Date(Date.now() - 1000) } });
  await post(app, 'login').send({ email: 'one@example.test', password: one.initialPassword }).expect(401);
  await login(app, 'two@example.test', two.initialPassword);
});
test('administration réservée à un admin ayant remplacé son mot de passe initial', async () => {
  await request(app.getHttpServer()).get('/api/admin/requests').expect(401);
  await activeUser(app);
  const user = await login(app);
  await request(app.getHttpServer()).get('/api/admin/requests').set('Cookie', user).expect(403);
  await prisma.user.create({ data: {
    email: 'new-admin@example.test', role: 'ADMIN', passwordHash: await app.get(PasswordPolicy).hash(PASSWORD),
    mustChangePassword: true, initialPasswordExpiresAt: new Date(Date.now() + 60000),
  } });
  const fresh = await login(app, 'new-admin@example.test');
  await request(app.getHttpServer()).get('/api/admin/requests').set('Cookie', fresh).expect(403);
  await request(app.getHttpServer()).post('/api/admin/requests/' + randomUUID() + '/approve').set('Origin', ORIGIN)
    .set('Cookie', fresh).expect(403);
});
test('concurrence : aucune session obtenue avec ancien secret ne survit au changement', async () => {
  await activeUser(app); const c = await login(app);
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
