import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { runScaffold } from '../scripts/scaffold-validation.mjs';
import { buildSourceRegistry } from '../scripts/lib/source-registry.mjs';
import { buildValidationEntries, renderValidationEntries } from '../scripts/lib/validation-scaffold.mjs';
import { loadPracticeCards } from '../src/lib/cards.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const script = join(root, 'scripts', 'scaffold-validation.mjs');
const cardPath = join(root, 'practices', 'verification', 'decision-separate-from-action.md');

function run(...args) {
  return spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8' });
}

// Reset a card's validation block to a clean not_validated baseline so these
// tests build the state they assert regardless of whether the card has since
// been validated in the catalog. Replaces everything from `validation:` up to
// the following `revisit:` key.
function notValidated(text) {
  return text.replace(/^validation:\n(?:.*\n)*?revisit:/m, 'validation:\n  status: not_validated\nrevisit:');
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
  const fixture = mkdtempSync(join(tmpdir(), 'ge-validation-missing-'));
  for (const entry of ['bin', 'packs', 'practices', 'research', 'scripts', 'src']) cpSync(join(root, entry), join(fixture, entry), { recursive: true });
  for (const entry of ['CONTRIBUTING.md', 'LICENSE', 'README.md', 'package.json']) cpSync(join(root, entry), join(fixture, entry));
  const fixtureCard = join(fixture, 'practices', 'verification', 'decision-separate-from-action.md');
  writeFileSync(fixtureCard, notValidated(readFileSync(fixtureCard, 'utf8')));
  const before = readFileSync(fixtureCard, 'utf8');
  let output = '';

  const code = runScaffold({ root: fixture, args: ['GE-VF-003', '--check'], write: (message) => { output += `${message}\n`; }, error: (message) => { output += `${message}\n`; } });

  assert.equal(code, 1);
  assert.match(output, /Validation provenance is stale or missing: GE-VF-003/);
  assert.equal(readFileSync(fixtureCard, 'utf8'), before);
});

test('--check can report stale provenance on the selected card', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'ge-validation-stale-'));
  for (const entry of ['bin', 'packs', 'practices', 'research', 'scripts', 'src']) cpSync(join(root, entry), join(fixture, entry), { recursive: true });
  for (const entry of ['CONTRIBUTING.md', 'LICENSE', 'README.md', 'package.json']) cpSync(join(root, entry), join(fixture, entry));
  const fixtureCard = join(fixture, 'practices', 'verification', 'decision-separate-from-action.md');
  const stale = notValidated(readFileSync(fixtureCard, 'utf8')).replace('status: not_validated', `status: validated\n  validated_against:\n    - source_id: CODEX-SAFETY-POLICY\n      revisions:\n        - "${'0'.repeat(40)}"`);
  writeFileSync(fixtureCard, stale);
  let output = '';

  const code = runScaffold({ root: fixture, args: ['GE-VF-003', '--check'], write: (message) => { output += `${message}\n`; }, error: (message) => { output += `${message}\n`; } });

  assert.equal(code, 1);
  assert.match(output, /Validation provenance is stale or missing: GE-VF-003/);
});

test('--check returns 0 only for validated cards with current provenance', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'ge-validation-current-'));
  for (const entry of ['bin', 'packs', 'practices', 'research', 'scripts', 'src']) cpSync(join(root, entry), join(fixture, entry), { recursive: true });
  for (const entry of ['CONTRIBUTING.md', 'LICENSE', 'README.md', 'package.json']) cpSync(join(root, entry), join(fixture, entry));
  const { registry } = buildSourceRegistry(join(fixture, 'research', 'sources'));
  const fixtureIndex = loadPracticeCards(fixture);
  const fixtureCard = fixtureIndex.byId.get('GE-VF-003');
  const entries = renderValidationEntries(buildValidationEntries(fixtureCard, registry)).trimEnd().split('\n').map((line) => `  ${line}`).join('\n');
  const cardFile = join(fixture, 'practices', 'verification', 'decision-separate-from-action.md');
  const current = notValidated(readFileSync(cardFile, 'utf8')).replace('validation:\n  status: not_validated', `validation:\n  status: validated\n${entries}`);
  writeFileSync(cardFile, current);

  const result = runScaffold({ root: fixture, args: ['GE-VF-003', '--check'] });

  assert.equal(result, 0);
});

test('--check rejects matching provenance when the card is still not validated', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'ge-validation-status-'));
  for (const entry of ['bin', 'packs', 'practices', 'research', 'scripts', 'src']) cpSync(join(root, entry), join(fixture, entry), { recursive: true });
  for (const entry of ['CONTRIBUTING.md', 'LICENSE', 'README.md', 'package.json']) cpSync(join(root, entry), join(fixture, entry));
  const { registry } = buildSourceRegistry(join(fixture, 'research', 'sources'));
  const fixtureIndex = loadPracticeCards(fixture);
  const fixtureCard = fixtureIndex.byId.get('GE-VF-003');
  const entries = renderValidationEntries(buildValidationEntries(fixtureCard, registry)).trimEnd().split('\n').map((line) => `  ${line}`).join('\n');
  const cardFile = join(fixture, 'practices', 'verification', 'decision-separate-from-action.md');
  const invalid = notValidated(readFileSync(cardFile, 'utf8')).replace('validation:\n  status: not_validated', `validation:\n  status: not_validated\n${entries}`);
  writeFileSync(cardFile, invalid);

  const result = runScaffold({ root: fixture, args: ['GE-VF-003', '--check'], write: () => {}, error: () => {} });

  assert.equal(result, 1);
});

test('scaffolding a selected card is not blocked by unrelated catalog provenance errors', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'ge-validation-unrelated-'));
  for (const entry of ['bin', 'packs', 'practices', 'research', 'scripts', 'src']) cpSync(join(root, entry), join(fixture, entry), { recursive: true });
  for (const entry of ['CONTRIBUTING.md', 'LICENSE', 'README.md', 'package.json']) cpSync(join(root, entry), join(fixture, entry));
  const unrelated = join(fixture, 'practices', 'code-quality', 'explicit-edit-format.md');
  writeFileSync(unrelated, readFileSync(unrelated, 'utf8').replace('validation:\n  status: not_validated', 'validation:\n  status: not_validated\n  validated_against:\n    - source_id: CODEX-SAFETY-POLICY\n      revisions: [invalid]'));

  const result = runScaffold({ root: fixture, args: ['GE-VF-003'], write: () => {}, error: () => {} });

  assert.equal(result, 0);
});
