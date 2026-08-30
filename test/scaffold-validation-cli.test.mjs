import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { runScaffold } from '../scripts/scaffold-validation.mjs';

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

test('--check can report stale provenance on the selected card', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'ge-validation-stale-'));
  for (const entry of ['bin', 'packs', 'practices', 'research', 'scripts', 'src']) cpSync(join(root, entry), join(fixture, entry), { recursive: true });
  for (const entry of ['CONTRIBUTING.md', 'LICENSE', 'README.md', 'package.json']) cpSync(join(root, entry), join(fixture, entry));
  const fixtureCard = join(fixture, 'practices', 'verification', 'decision-separate-from-action.md');
  const stale = readFileSync(fixtureCard, 'utf8').replace('status: not_validated', `status: validated\n  validated_against:\n    - source_id: CODEX-SAFETY-POLICY\n      revisions:\n        - "${'0'.repeat(40)}"`);
  writeFileSync(fixtureCard, stale);
  let output = '';

  const code = runScaffold({ root: fixture, args: ['GE-VF-003', '--check'], write: (message) => { output += `${message}\n`; }, error: (message) => { output += `${message}\n`; } });

  assert.equal(code, 1);
  assert.match(output, /Validation provenance is stale or missing: GE-VF-003/);
});
