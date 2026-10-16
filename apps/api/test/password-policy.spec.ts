import { PasswordPolicy } from '../src/security/password-policy';
import { configuration } from '../src/config';
const policy = new PasswordPolicy();
test('T-05 V6.2.4 10000 entrées distinctes de longueur valide', () => {
  expect(policy.blocked.size).toBe(10000);
  for (const word of policy.blocked) {
    expect([...word].length).toBeGreaterThanOrEqual(8);
    expect([...word].length).toBeLessThanOrEqual(128);
    expect(() => policy.validate(word)).toThrow();
  }
});
test('T-02 V6.2.1 points de code Unicode et borne haute volontaire', () => {
  expect(() => policy.validate('🦋'.repeat(7))).toThrow();
  expect(() => policy.validate('🦋'.repeat(8))).not.toThrow();
  expect(() => policy.validate('🦋'.repeat(128))).not.toThrow();
  expect(() => policy.validate('🦋'.repeat(129))).toThrow();
});
test('T-09 V6.2.8 salage unique et vérification exacte Argon2id', async () => {
  const secret = '  Éléphants tranquilles  ';
  const a = await policy.hash(secret), b = await policy.hash(secret);
  expect(a).not.toBe(b);
  expect(await policy.verify(a, secret)).toBe(true);
  expect(await policy.verify(a, secret.trim())).toBe(false);
});
test('C-01 configuration exige HTTPS en production et cookie __Host-', () => {
  const original = { origin: process.env.PUBLIC_ORIGIN, mode: process.env.NODE_ENV };
  try {
    process.env.NODE_ENV = 'production';
    process.env.PUBLIC_ORIGIN = 'http://localhost:3000';
    expect(configuration).toThrow();
    process.env.PUBLIC_ORIGIN = 'https://auth.example.test';
    expect(configuration().secure).toBe(true);
    expect(configuration().cookieName).toBe('__Host-session');
  } finally {
    process.env.PUBLIC_ORIGIN = original.origin;
    process.env.NODE_ENV = original.mode;
  }
});
