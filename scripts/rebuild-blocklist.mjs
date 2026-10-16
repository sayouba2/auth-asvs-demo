import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const metadata = JSON.parse(readFileSync(new URL('../security/password-blocklist.json', import.meta.url), 'utf8'));
const response = await fetch(metadata.sourceBlobApi, { headers: { Accept: 'application/vnd.github+json' } });
if (!response.ok) throw new Error('Impossible de récupérer la source : HTTP ' + response.status);
const result = await response.json();
if (result.encoding !== 'base64') throw new Error('Encodage inattendu.');
const bytes = Buffer.from(result.content, 'base64');
const hash = createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
if (hash !== metadata.sourceBlobSha1) throw new Error('Version de source incorrecte.');
const values = [...new Set(bytes.toString('utf8').split(/\r?\n/).filter(s => [...s].length >= 8 && [...s].length <= 128))].slice(0, 10000);
const content = values.join('\n') + '\n';
if (values.length !== metadata.count || createHash('sha256').update(content).digest('hex') !== metadata.sha256)
  throw new Error('Le résultat ne correspond pas aux métadonnées versionnées.');
writeFileSync(new URL('../security/password-blocklist.txt', import.meta.url), content);
console.log(values.length + ' entrées reproduites, intégrité vérifiée.');
