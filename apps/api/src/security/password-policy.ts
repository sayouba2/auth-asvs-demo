import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { BadRequestException, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
export const ARGON_OPTIONS = { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 };
export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 128;
export const INITIAL_PASSWORD_MS = 24 * 60 * 60 * 1000;
@Injectable()
export class PasswordPolicy {
  readonly blocked: ReadonlySet<string>;
  constructor() {
    const values = readFileSync(resolve(__dirname, '../../../../security/password-blocklist.txt'), 'utf8').split('\n').filter(Boolean);
    this.blocked = new Set(values);
    if (this.blocked.size < 3000 || this.blocked.size !== values.length ||
      values.some(s => [...s].length < MIN_PASSWORD || [...s].length > MAX_PASSWORD))
      throw new Error('Liste de mots de passe invalide.');
  }
  validate(password: string) {
    const length = [...password].length;
    if (length < MIN_PASSWORD || length > MAX_PASSWORD)
      throw new BadRequestException('Le mot de passe doit contenir entre 8 et 128 caractères.');
    if (this.blocked.has(password))
      throw new BadRequestException('Ce mot de passe est trop courant. Choisissez-en un autre.');
  }
  // V6.4.1 : secret initial aléatoire (CSPRNG, 144 bits), conforme à la politique.
  generateInitial() {
    const password = randomBytes(18).toString('base64url');
    this.validate(password);
    return password;
  }
  hash(password: string) { return argon2.hash(password, ARGON_OPTIONS); }
  verify(hash: string, password: string) { return argon2.verify(hash, password); }
}
