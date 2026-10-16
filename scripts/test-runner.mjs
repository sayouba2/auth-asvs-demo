import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { staticChecks } from './static-checks.mjs';

const root = resolve(import.meta.dirname, '..');
process.chdir(root);
if (existsSync('.env')) process.loadEnvFile('.env');
const mode = process.argv[2] ?? 'all';
if (!['api', 'all', 'security'].includes(mode)) throw new Error('Mode de test inconnu.');
const evidence = resolve(root, 'security/evidence');
mkdirSync(evidence, { recursive: true });
const startedAt = new Date().toISOString();
const checks = staticChecks();
const stages = [];
let failure = false, freshEmpty = false, prisma;
const requirements = ['V6.1.1', 'V6.2.1', 'V6.2.2', 'V6.2.3', 'V6.2.4', 'V6.2.5', 'V6.2.6', 'V6.2.7', 'V6.2.8', 'V6.3.1', 'V6.3.2', 'V6.4.1', 'V6.4.2'];
const env = { ...process.env };
const schema = 'asvs_test_' + randomBytes(10).toString('hex');
env.RATE_LIMIT_NAMESPACE = schema;
env.RATE_LIMIT_SECRET = randomBytes(32).toString('hex');
env.PROXY_SECRET = randomBytes(32).toString('hex');
env.PUBLIC_ORIGIN = 'http://localhost:' + (process.env.TEST_WEB_PORT ?? '3100');
env.API_PORT = process.env.TEST_API_PORT ?? '3101';
env.API_INTERNAL_URL = 'http://127.0.0.1:' + env.API_PORT;
env.API_HOST = '127.0.0.1';
env.PORT = process.env.TEST_WEB_PORT ?? '3100';
env.NODE_ENV = 'test';
delete env.TRUSTED_PROXY_IP;
function run(name, args) {
  console.log('\n' + name);
  const result = spawnSync('pnpm', args, { cwd: root, env, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  const log = (result.stdout ?? '') + (result.stderr ?? '');
  // Logs contain only synthetic fixtures and sanitized server events.
  writeFileSync(resolve(evidence, name + '.log'), log);
  process.stdout.write(log);
  stages.push({ name, status: result.status === 0 ? 'PASS' : 'FAIL' });
  if (result.status !== 0) throw new Error(name + ' a échoué ; voir security/evidence/' + name + '.log');
}
for (const name of ['jest.json', 'playwright.json']) rmSync(resolve(evidence, name), { force: true });
try {
  if (checks.some(c => !c.pass)) throw new Error('Contrôle statique en échec.');
  if (!env.DATABASE_URL || !env.REDIS_URL) throw new Error('Configurer .env et démarrer PostgreSQL / Redis.');
  const database = new URL(env.DATABASE_URL);
  database.searchParams.set('schema', schema);
  env.DATABASE_URL = database.toString();
  run('prisma-generate', ['--filter', '@demo/api', 'prisma', 'generate']);
  const apiRequire = createRequire(resolve(root, 'apps/api/package.json'));
  const { PrismaClient } = apiRequire('@prisma/client');
  prisma = new PrismaClient({ datasourceUrl: env.DATABASE_URL });
  run('migrate', ['--filter', '@demo/api', 'prisma', 'migrate', 'deploy']);
  freshEmpty = await prisma.user.count() === 0;
  if (!freshEmpty) throw new Error('T-11 : une base fraîche contient déjà un utilisateur.');
  run('jest', ['--filter', '@demo/api', 'test', '--json', '--outputFile=' + resolve(evidence, 'jest.json')]);
  if (mode !== 'api')
    run('playwright', ['--filter', '@demo/web', 'exec', 'playwright', 'test']);
} catch (error) {
  failure = true;
  // Do not print database errors, connection URLs or arbitrary dependency diagnostics.
  console.error('Exécution interrompue : configuration, dépendance ou vérification en échec. Consulter les étapes ci-dessus.');
  if (error instanceof Error && /^(Configurer|Contrôle statique|T-11)/.test(error.message)) console.error(error.message);
} finally {
  if (prisma) {
    try {
      if (/^asvs_test_[a-f0-9]{20}$/.test(schema)) {
        await prisma.$executeRawUnsafe('DROP SCHEMA IF EXISTS "' + schema + '" CASCADE');
      } else {
        failure = true;
        console.error('Nettoyage refusé : schéma inattendu.');
      }
    } catch { failure = true; console.error('Nettoyage du schéma de test incomplet.'); }
    await prisma.$disconnect();
  }
}
const jest = existsSync(resolve(evidence, 'jest.json')) ? JSON.parse(readFileSync(resolve(evidence, 'jest.json'), 'utf8')) : null;
const browser = existsSync(resolve(evidence, 'playwright.json')) ? JSON.parse(readFileSync(resolve(evidence, 'playwright.json'), 'utf8')) : null;
const assertions = (jest?.testResults ?? []).flatMap(s => s.assertionResults ?? []);
function browserTests(suites) {
  return (suites ?? []).flatMap(s => [
    ...(s.specs ?? []).map(spec => ({ title: spec.title, pass: spec.ok })),
    ...browserTests(s.suites),
  ]);
}
const ui = browserTests(browser?.suites);
const review = JSON.parse(readFileSync(resolve(root, 'security/manual-review.json'), 'utf8'));
const rows = requirements.map((requirement, index) => {
  const id = 'T-' + String(index + 1).padStart(2, '0');
  const apiTests = assertions.filter(t => t.fullName.includes(id));
  const uiTests = ui.filter(t => t.title.includes(id));
  const staticTest = checks.find(c => c.id === id);
  let status = 'NON TESTÉ';
  const needsApi = [1, 2, 3, 4, 5, 6, 9, 10].includes(index + 1);
  const needsUi = [2, 3, 5, 7, 8, 10].includes(index + 1);
  const apiPass = apiTests.length > 0 && apiTests.every(t => t.status === 'passed');
  const uiPass = uiTests.length > 0 && uiTests.every(t => t.pass);
  const manualPass = ![1, 11, 12, 13].includes(index + 1) || review.checks[id]?.status === 'PASS';
  if ((apiTests.some(t => t.status === 'failed')) || uiTests.some(t => !t.pass) || staticTest?.pass === false) status = 'FAIL';
  else if ((!needsApi || apiPass) && (!needsUi || uiPass) && (!staticTest || staticTest.pass) &&
      manualPass && (id !== 'T-11' || freshEmpty)) status = id === 'T-12' ? 'N/A justifié' : 'PASS';
  return { requirement, id, status, evidence: [
    apiTests.length ? 'jest.json (' + apiTests.length + ' assertions)' : '',
    uiTests.length ? 'playwright.json (' + uiTests.length + ' scénarios)' : '',
    staticTest?.evidence ?? '',
    review.checks[id]?.evidence ?? '',
    id === 'T-11' && freshEmpty ? '0 utilisateur après migration dans un schéma neuf' : '',
  ].filter(Boolean).join(' ; ') };
});
writeFileSync(resolve(evidence, 'run.json'), JSON.stringify({ startedAt, stages, freshEmpty, rows }, null, 2));
const report = '# Résultats V6/L1\n\nExécution : ' + startedAt +
  '\n\n| Exigence | Test | Résultat | Preuve |\n|---|---|---|---|\n' +
  rows.map(r => '| ' + [r.requirement, r.id, r.status, r.evidence || 'Suite non exécutée'].join(' | ') + ' |').join('\n') +
  '\n\nContrôles manuels : voir ../manual-review.json. Compatibilité avec les gestionnaires tiers : NON TESTÉ.\n' +
  'C-01 sur déploiement HTTPS réel : NON TESTÉ (configuration et attributs testés séparément).\n' +
  'Ce rapport ne constitue pas une certification ASVS ni une évaluation des autres chapitres.\n';
writeFileSync(resolve(evidence, 'report.md'), report);
console.log(report);
process.exitCode = failure || (mode === 'security' && rows.some(r => ['FAIL', 'NON TESTÉ'].includes(r.status))) ? 1 : 0;
