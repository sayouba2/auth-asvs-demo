import test from 'node:test';
import assert from 'node:assert/strict';
import { staticChecks } from './static-checks.mjs';
for (const check of staticChecks())
  test(check.id + ' contrôle statique : ' + check.evidence, () => assert.equal(check.pass, true));
