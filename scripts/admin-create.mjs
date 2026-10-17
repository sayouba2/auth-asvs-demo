import { spawnSync } from 'node:child_process';
import { config } from 'dotenv';
config({ path: new URL('../.env', import.meta.url), quiet: true });
const result = spawnSync('pnpm', ['exec', 'ts-node', 'src/create-admin.ts', ...process.argv.slice(2)], { stdio: 'inherit', env: process.env });
process.exit(result.status ?? 1);
