import { INestApplication } from '@nestjs/common';
import { createApp } from '../src/bootstrap';
import { PrismaService } from '../src/users/prisma.service';
import { RateLimitService } from '../src/security/rate-limit.service';
import { PasswordPolicy } from '../src/security/password-policy';
import request from 'supertest';
export const ORIGIN = process.env.PUBLIC_ORIGIN ?? 'http://localhost:3000';
export const PASSWORD = 'Une lune paisible en octobre !';
export const NEXT_PASSWORD = 'Un jardin tranquille au printemps !';
export function assertIsolated() {
  const url = new URL(process.env.DATABASE_URL!);
  if (!/^asvs_test_[a-z0-9]+$/.test(url.searchParams.get('schema') ?? '') ||
      !process.env.RATE_LIMIT_NAMESPACE?.startsWith('asvs_test_'))
    throw new Error('Les tests exigent le lanceur isolé : pnpm test.');
}
export async function setup() {
  assertIsolated();
  const app = await createApp();
  const prisma = app.get(PrismaService);
  const rates = app.get(RateLimitService);
  // ioredis connects asynchronously; real integration tests wait for readiness.
  await new Promise<void>((resolve, reject) => {
    if (rates.redis.status === 'ready') resolve();
    else { rates.redis.once('ready', resolve); rates.redis.once('error', reject); }
  });
  return { app, prisma, rates };
}
export async function clearRates(app: INestApplication) {
  assertIsolated();
  const redis = app.get(RateLimitService).redis;
  const keys = await redis.keys(process.env.RATE_LIMIT_NAMESPACE! + ':*');
  if (keys.length) await redis.del(...keys);
}
export async function reset(app: INestApplication) {
  assertIsolated();
  await app.get(PrismaService).session.deleteMany();
  await app.get(PrismaService).user.deleteMany();
  await app.get(PrismaService).registrationRequest.deleteMany();
  await clearRates(app);
}
export function post(app: INestApplication, path: string) {
  return request(app.getHttpServer()).post('/api/auth/' + path).set('Origin', ORIGIN);
}
// Compte actif au mot de passe connu, créé directement en base : le parcours d'inscription a ses propres tests.
export async function activeUser(app: INestApplication, email = 'test-user@example.test', password = PASSWORD, role: 'USER' | 'ADMIN' = 'USER') {
  const passwordHash = await app.get(PasswordPolicy).hash(password);
  return app.get(PrismaService).user.create({ data: { email, passwordHash, role } });
}
export function cookie(response: { headers: Record<string, unknown> }) {
  const cookies = response.headers['set-cookie'];
  if (!Array.isArray(cookies) || typeof cookies[0] !== 'string') throw new Error('Cookie absent');
  return cookies[0].split(';')[0];
}
export async function login(app: INestApplication, email = 'test-user@example.test', password = PASSWORD) {
  return cookie(await post(app, 'login').send({ email, password }).expect(200));
}
