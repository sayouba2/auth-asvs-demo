import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const read = path => readFileSync(resolve(root, path), 'utf8');
function sources(directory) {
  return readdirSync(resolve(root, directory), { withFileTypes: true }).flatMap(entry => {
    const path = directory + '/' + entry.name;
    if (entry.isDirectory()) return sources(path);
    return /\.(ts|tsx|mjs|prisma|sql)$/.test(path) ? [{ path, text: read(path) }] : [];
  });
}
export function staticChecks() {
  const metadata = JSON.parse(read('security/password-blocklist.json'));
  const content = read('security/password-blocklist.txt');
  const values = content.split('\n').filter(Boolean);
  const production = [...sources('apps/api/src'), ...sources('apps/web/app'), ...sources('apps/web/components'), ...sources('apps/api/prisma')];
  const controllers = production.filter(f => f.path.endsWith('.controller.ts')).map(f => f.text).join('\n');
  const routes = [...controllers.matchAll(/@(Get|Post|Put|Patch|Delete)\('([^']+)'\)/g)].map(m => m[1] + ' ' + m[2]).sort();
  const expectedRoutes = ['Get me', 'Post change-password', 'Post login', 'Post logout', 'Post register'].sort();
  const policy = read('security/rate-limiting.md');
  return [
    { id: 'T-01', pass: ['30', '900', '5', '300', '429', 'Retry-After', '503', 'Redis', 'TRUSTED_PROXY_IP'].every(s => policy.includes(s)),
      evidence: 'security/rate-limiting.md : présence des paramètres et procédures ; revue de concordance toujours nécessaire.' },
    { id: 'T-05', pass: values.length === metadata.count && new Set(values).size === values.length && values.length >= 3000 &&
      values.every(s => [...s].length >= 8 && [...s].length <= 128) &&
      createHash('sha256').update(content).digest('hex') === metadata.sha256,
      evidence: values.length + ' entrées, unicité, longueur et SHA-256 ; source et licence versionnées.' },
    { id: 'T-11', pass: !sources('apps/api/prisma').some(f => /\bINSERT\b|\bupsert\b|\bcreateMany\b/i.test(f.text)) &&
      !Object.keys(JSON.parse(read('apps/api/package.json'))).includes('prisma'),
      evidence: 'Migration DDL seule, aucun seeder ; contrôle complémentaire de base fraîche par le lanceur.' },
    { id: 'T-12', pass: JSON.stringify(routes) === JSON.stringify(expectedRoutes) &&
      /password!: string/.test(read('apps/api/src/auth/dto.ts')),
      evidence: 'Inventaire exact des cinq routes ; inscription imposant un mot de passe choisi. Aucun parcours activation/récupération.' },
    { id: 'T-13', pass: !production.some(f => /passwordHint|securityQuestion|securityAnswer|secretQuestion|birthplace|maidenName/i.test(f.text)) &&
      JSON.stringify(routes) === JSON.stringify(expectedRoutes),
      evidence: 'Inventaire du schéma, DTO, contrôleur et écrans : aucun indice ni question secrète.' },
  ];
}
