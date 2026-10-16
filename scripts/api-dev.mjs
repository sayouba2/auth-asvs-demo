import { spawn } from 'node:child_process';
import { config } from 'dotenv';
config({ path: new URL('../.env', import.meta.url), quiet: true });
const child = spawn('pnpm', ['exec', 'ts-node', 'src/main.ts'], { stdio: 'inherit', env: process.env });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => process.exit(code ?? 1));
