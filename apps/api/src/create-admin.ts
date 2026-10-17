import { PrismaClient } from '@prisma/client';
import { isEmail } from 'class-validator';
import { INITIAL_PASSWORD_MS, PasswordPolicy } from './security/password-policy';
// Crée un administrateur avec un mot de passe initial à usage unique (aucun compte par défaut livré).
async function main() {
  const email = process.argv[2]?.trim().toLowerCase() ?? '';
  if (!isEmail(email)) throw new Error('Usage : pnpm admin:create <e-mail>');
  const policy = new PasswordPolicy();
  const password = policy.generateInitial();
  const prisma = new PrismaClient();
  try {
    await prisma.user.create({ data: {
      email, role: 'ADMIN', passwordHash: await policy.hash(password),
      mustChangePassword: true, initialPasswordExpiresAt: new Date(Date.now() + INITIAL_PASSWORD_MS),
    } });
  } finally { await prisma.$disconnect(); }
  console.log('Administrateur créé : ' + email);
  console.log('Mot de passe initial (usage unique, valable 24 h) : ' + password);
}
main().catch((error: unknown) => {
  console.error(error instanceof Error && error.message.startsWith('Usage') ? error.message : 'Création impossible (compte existant ou base indisponible).');
  process.exit(1);
});
