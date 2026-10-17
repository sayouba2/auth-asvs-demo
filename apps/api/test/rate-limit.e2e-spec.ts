import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { RateLimitService, LIMITS } from '../src/security/rate-limit.service';
import { ORIGIN, PASSWORD, setup, reset, post, activeUser, login, clearRates } from './helpers';
let a: INestApplication, b: INestApplication, rates: RateLimitService;
const unknown = { email: 'unknown@example.test', password: 'incorrect' };
beforeAll(async () => { const first = await setup(); a = first.app; rates = first.rates; b = (await setup()).app; });
beforeEach(async () => reset(a));
afterAll(async () => { if (a) { await reset(a); await a.close(); } if (b) await b.close(); });
test('T-01 V6.1.1 paramètres effectifs documentés', () => {
  expect(LIMITS).toEqual({
    loginIp: { max: 30, seconds: 900 }, loginPair: { max: 5, seconds: 300 },
    register: { max: 10, seconds: 900 }, change: { max: 5, seconds: 900 },
  });
});
test('T-10 V6.3.1 cinq échecs partagés entre deux instances, TTL non prolongé', async () => {
  for (let i = 0; i < 5; i++) await post(i % 2 ? a : b, 'login')
    .send({ ...unknown, email: i % 2 ? ' UNKNOWN@EXAMPLE.TEST ' : unknown.email }).expect(401);
  const blocked = await post(a, 'login').send(unknown).expect(429);
  expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  expect(Number(blocked.headers['retry-after'])).toBeLessThanOrEqual(300);
  const key = (await rates.redis.keys(process.env.RATE_LIMIT_NAMESPACE! + ':loginPair:*'))[0];
  expect(await rates.redis.scard(key)).toBe(5);
  const before = await rates.redis.pttl(key);
  await post(b, 'login').send(unknown).expect(429);
  expect(await rates.redis.pttl(key)).toBeLessThanOrEqual(before);
  // Accelerate only this test key after verifying the real 300-second policy.
  await rates.redis.pexpire(key, 50);
  await new Promise(resolve => setTimeout(resolve, 80));
  await post(b, 'login').send(unknown).expect(401);
});
test('T-10 V6.3.1 trente tentatives par IP même avec des comptes différents', async () => {
  for (let i = 0; i < 30; i++)
    await post(a, 'login').send({ ...unknown, email: 'unknown' + i + '@example.test' }).expect(401);
  const result = await post(b, 'login').send({ ...unknown, email: 'another@example.test' }).expect(429);
  expect(Number(result.headers['retry-after'])).toBeGreaterThan(0);
  expect(Number(result.headers['retry-after'])).toBeLessThanOrEqual(900);
});
test('T-10 V6.3.1 requêtes simultanées : au plus cinq vérifications', async () => {
  const results = await Promise.all(Array.from({ length: 12 }, (_, i) => post(i % 2 ? a : b, 'login').send(unknown)));
  expect(results.filter(r => r.status === 401)).toHaveLength(5);
  expect(results.filter(r => r.status === 429)).toHaveLength(7);
});
test('T-10 V6.3.1 aucune interdiction du compte sur une autre IP de confiance', async () => {
  await activeUser(a);
  for (let i = 0; i < 5; i++) await post(a, 'login').send({ ...unknown, email: 'test-user@example.test' }).expect(401);
  await post(a, 'login').send({ email: 'test-user@example.test', password: PASSWORD }).expect(429);
  await post(b, 'login')
    .set('X-Demo-Proxy-Secret', process.env.PROXY_SECRET!).set('X-Demo-Client-IP', '192.0.2.24')
    .send({ email: 'test-user@example.test', password: PASSWORD }).expect(200);
});
test('T-10 V6.3.1 en-têtes IP forgés sans secret proxy ignorés', async () => {
  for (let i = 0; i < 5; i++)
    await post(a, 'login').set('X-Forwarded-For', '192.0.2.' + i)
      .set('X-Demo-Client-IP', '192.0.2.' + i).set('X-Demo-Proxy-Secret', 'forged').send(unknown).expect(401);
  await post(a, 'login').set('X-Forwarded-For', '198.51.100.1').set('X-Demo-Client-IP', '198.51.100.1').send(unknown).expect(429);
});
test('T-10 V6.3.1 inscriptions malformées limitées avant validation DTO', async () => {
  for (let i = 0; i < 10; i++) await post(a, 'register').send({ email: 'incorrect' }).expect(400);
  await post(b, 'register').send({ email: 'valid@example.test' }).expect(429);
});
test('T-10 V6.3.1 changement limité par utilisateur à cinq tentatives', async () => {
  await activeUser(a); const c = await login(a);
  for (let i = 0; i < 5; i++) await post(a, 'change-password').set('Cookie', c)
    .send({ currentPassword: 'incorrect', newPassword: PASSWORD }).expect(401);
  await post(b, 'change-password').set('Cookie', c)
    .send({ currentPassword: PASSWORD, newPassword: 'nouveau mot de passe' }).expect(429);
});
test('T-10 V6.3.1 succès ne consomme pas un échec de la paire', async () => {
  await activeUser(a);
  for (let i = 0; i < 6; i++) await login(a);
  const keys = await rates.redis.keys(process.env.RATE_LIMIT_NAMESPACE! + ':loginPair:*');
  expect(keys).toHaveLength(0);
});
test('T-10 V6.3.1 Redis indisponible : 503, sessions lisibles et déconnexion possible', async () => {
  await activeUser(a); const c = await login(a);
  await clearRates(a);
  rates.redis.disconnect();
  try {
    await post(a, 'login').send(unknown).expect(503);
    await post(a, 'register').send({ email: 'new@example.test' }).expect(503);
    await post(a, 'change-password').set('Cookie', c)
      .send({ currentPassword: PASSWORD, newPassword: 'nouveau mot de passe' }).expect(503);
    await request(a.getHttpServer()).get('/api/auth/me').set('Cookie', c).expect(200);
    await request(a.getHttpServer()).post('/api/auth/logout').set('Origin', ORIGIN).set('Cookie', c).expect(200);
  } finally { await rates.redis.connect(); }
});
