export function configuration() {
  const origin = new URL(process.env.PUBLIC_ORIGIN ?? 'http://localhost:3000');
  if (origin.origin !== (process.env.PUBLIC_ORIGIN ?? 'http://localhost:3000'))
    throw new Error('PUBLIC_ORIGIN doit être une origine sans chemin.');
  const secure = origin.protocol === 'https:';
  if (!secure && (process.env.NODE_ENV === 'production' || origin.hostname !== 'localhost' || origin.protocol !== 'http:'))
    throw new Error('HTTPS requis hors http://localhost en développement.');
  for (const key of ['DATABASE_URL', 'REDIS_URL', 'PROXY_SECRET', 'RATE_LIMIT_SECRET']) {
    if (!process.env[key]) throw new Error('Configuration manquante : ' + key);
  }
  for (const key of ['PROXY_SECRET', 'RATE_LIMIT_SECRET']) {
    if (process.env[key]!.length < 32) throw new Error(key + ' doit contenir au moins 32 caractères.');
  }
  return {
    origin: origin.origin, secure,
    cookieName: secure ? '__Host-session' : 'session',
    sessionMs: 12 * 60 * 60 * 1000,
    proxySecret: process.env.PROXY_SECRET!,
    rateSecret: process.env.RATE_LIMIT_SECRET!,
  };
}
