import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
if (existsSync('.env')) {
  console.log('.env existe déjà : aucune modification.');
} else {
  const password = randomBytes(24).toString('hex');
  const content = readFileSync('.env.example', 'utf8')
    .replaceAll('CHANGE_ME', password)
    .replace('PROXY_SECRET=\n', 'PROXY_SECRET=' + randomBytes(32).toString('hex') + '\n')
    .replace('RATE_LIMIT_SECRET=\n', 'RATE_LIMIT_SECRET=' + randomBytes(32).toString('hex') + '\n');
  writeFileSync('.env', content, { mode: 0o600, flag: 'wx' });
  console.log('.env créé avec des secrets aléatoires. Aucun utilisateur créé.');
}
