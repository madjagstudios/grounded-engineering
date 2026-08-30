import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import test from 'node:test';

const root = new URL('../', import.meta.url).pathname;
const script = join(root, 'scripts', 'scaffold-validation.mjs');
const cardPath = join(root, 'practices', 'verification', 'decision-separate-from-action.md');

function run(...args) {
  return spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8' });
}

test('emits the same scaffold when resolving a card by ID or repository-relative path', () => {
  const before = readFileSync(cardPath, 'utf8');
  const byId = run('GE-VF-003');
  const byPath = run('practices/verification/decision-separate-from-action.md');

  assert.equal(byId.status, 0, byId.stderr);
  assert.equal(byPath.status, 0, byPath.stderr);
  assert.equal(byId.stdout, byPath.stdout);
  assert.match(byId.stdout, /^validated_against:\n/);
  assert.match(byId.stdout, /source_id: CODEX-SAFETY-POLICY/);
  assert.match(byId.stdout, /revisions:\n\s+- [0-9a-f]{40}/);
  assert.equal(readFileSync(cardPath, 'utf8'), before);
});

test('--check flags a card with no existing validation provenance without editing it', () => {
  const before = readFileSync(cardPath, 'utf8');
  const result = run('GE-VF-003', '--check');

  assert.equal(result.status, 1);
  assert.match(result.stdout, /Validation provenance is stale or missing: GE-VF-003/);
  assert.equal(readFileSync(cardPath, 'utf8'), before);
});
