import { createRequire } from 'node:module';
import { test as base, expect } from '@playwright/test';
import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
const apiRequire = createRequire(new URL('../../api/package.json', import.meta.url));
const Prisma = apiRequire('@prisma/client') as { PrismaClient: new () => PrismaClient };
const RedisModule = apiRequire('ioredis') as new (url: string) => Redis;
const argon2 = apiRequire('argon2') as { argon2id: number; hash(password: string, options: object): Promise<string> };
export const PASSWORD = 'Une forêt paisible sous les étoiles !';
export const NEW_PASSWORD = 'Une rivière calme au petit matin !';
export const test = base.extend({
  page: async ({ page }, use) => {
    const schema = new URL(process.env.DATABASE_URL!).searchParams.get('schema');
    if (!schema?.startsWith('asvs_test_') || !process.env.RATE_LIMIT_NAMESPACE?.startsWith('asvs_test_'))
      throw new Error('Utilisez pnpm test:e2e : environnement isolé obligatoire.');
    const db = new Prisma.PrismaClient();
    const redis = new RedisModule(process.env.REDIS_URL!);
    try {
      await db.session.deleteMany(); await db.user.deleteMany(); await db.registrationRequest.deleteMany();
      const keys = await redis.keys(process.env.RATE_LIMIT_NAMESPACE + ':*');
      if (keys.length) await redis.del(...keys);
      await use(page);
    } finally { await db.$disconnect(); await redis.quit(); }
  },
});
export { expect };
// Compte actif au mot de passe connu : le parcours demande/validation a son propre test.
export async function createUser(email: string, password: string, role: 'USER' | 'ADMIN' = 'USER') {
  const db = new Prisma.PrismaClient();
  try {
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
    await db.user.create({ data: { email, passwordHash, role } });
  } finally { await db.$disconnect(); }
}
export async function login(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
}
