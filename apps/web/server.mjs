import { createServer } from 'node:http';
import { isIP } from 'node:net';
import next from 'next';
import { config } from 'dotenv';
config({ path: new URL('../../.env', import.meta.url), quiet: true });
const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.WEB_HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? 3000);
if (!process.env.PROXY_SECRET || process.env.PROXY_SECRET.length < 32)
  throw new Error('PROXY_SECRET manquant ou trop court. Exécutez pnpm setup:env.');
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
await app.prepare();
const server = createServer((request, response) => {
  const peer = request.socket.remoteAddress ?? '';
  const forwarded = request.headers['x-forwarded-for'];
  // Only a configured upstream may supply one client address. Never trust a chain.
  const client = process.env.TRUSTED_PROXY_IP === peer && typeof forwarded === 'string' && isIP(forwarded)
    ? forwarded : peer;
  request.headers['x-demo-client-ip'] = client;
  request.headers['x-demo-proxy-secret'] = process.env.PROXY_SECRET;
  delete request.headers['x-forwarded-for'];
  delete request.headers['x-forwarded-host'];
  delete request.headers['x-forwarded-proto'];
  response.setHeader('Cache-Control', 'no-store');
  void handle(request, response).catch(() => {
    if (!response.headersSent) response.writeHead(500);
    response.end('Service temporairement indisponible.');
  });
});
server.listen(port, hostname, () => console.log('Web disponible sur ' + (process.env.PUBLIC_ORIGIN ?? 'http://localhost:' + port)));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  server.close(() => { void app.close().finally(() => process.exit(0)); });
});
