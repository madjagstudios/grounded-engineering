import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, cpSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runValidation } from '../scripts/validate.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const card = (sourceIds, evidenceIds = sourceIds, extra = '') =>
  `---\nrecord_type: practice\nschema_version: 1.0.0\nid: GE-VF-900\ntitle: Wiring fixture card\ncategory: Verification\nsubcategory: Reporting\npattern: Fixture pattern text.\nunderlying_principle: Fixture principle text.\nobserved_implementation: Fixture observed text.\napplicability: [AI_ASSISTED]\ncontrol_types: [ADVISORY]\ndisposition: ADOPT\nrationale: Fixture rationale long enough to satisfy schema.\ndelivery_horizon: V1\nconfidence: high\nevidence_level: observed\nsource_ids: [${sourceIds.join(', ')}]\nevidence_refs:\n${evidenceIds.map((s) => `  - source_id: ${s}\n    locator: fixture locator\n    relationship: generalized_principle`).join('\n')}\n${extra}validation:\n  status: not_validated\nrevisit:\n  required: false\n---\n\n# Wiring fixture card\n\nBody.\n`;

function fixtureRepo(cardText) {
  const tmp = mkdtempSync(join(tmpdir(), 'ge18-wire-'));
  cpSync(join(repoRoot, 'research'), join(tmp, 'research'), { recursive: true });
  mkdirSync(join(tmp, 'practices', 'verification'), { recursive: true });
  writeFileSync(join(tmp, 'practices', 'verification', 'fixture.md'), cardText);
  return tmp;
}

test('rejects a valid card whose source id is a substring of a real one', () => {
  const { errors } = runValidation({ root: fixtureRepo(card(['CODEX-SKILL'])) });
  assert.ok(errors.some((e) => /CODEX-SKILL/.test(e) && /unknown source/i.test(e)), errors.join('\n'));
});

test('a schema-invalid card yields NO provenance diagnostic (only the AJV error)', () => {
  // source_ids as a string violates the schema; card-integrity must not run on it.
  const root = fixtureRepo(card(['CODEX-SKILL']).replace('source_ids: [CODEX-SKILL]', 'source_ids: CODEX-SKILL'));
  const { errors } = runValidation({ root });
  assert.ok(errors.some((e) => /source_ids/.test(e))); // AJV type error present
  assert.ok(!errors.some((e) => /unknown source id/i.test(e))); // no provenance cascade
});

test('an unusable registry blocks card-integrity (registry error present, no unknown-card error)', () => {
  const root = fixtureRepo(card(['CODEX-SKILL']));
  // Corrupt a source section so buildSourceRegistry returns errors.
  writeFileSync(join(root, 'research', 'sources', 'broken.md'), '## codex-lower\n\n- Source: R, [x](https://code.claude.com/x)\n- Immutable reference: whatever\n');
  const { errors } = runValidation({ root });
  assert.ok(errors.some((e) => /does not match source-id pattern|Immutable reference/i.test(e))); // registry error surfaced
  assert.ok(!errors.some((e) => /unknown source id/i.test(e))); // gate skipped card-integrity
});

test('imported runValidation on a full copied checkout does not flag its own validator', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'ge18-copy-'));
  const skip = [join(repoRoot, 'node_modules'), join(repoRoot, '.git')];
  cpSync(repoRoot, tmp, { recursive: true, filter: (s) => !skip.some((d) => s === d || s.startsWith(d + '/')) });
  const { errors } = runValidation({ root: tmp });
  assert.deepEqual(errors, [], errors.join('\n')); // clean checkout ⇒ no false public-content hits on the copied validate.mjs
  rmSync(tmp, { recursive: true, force: true });
});

test('validator runs from a path containing a space (subprocess regression)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'ge18 space-'));
  const skip = [join(repoRoot, 'node_modules'), join(repoRoot, '.git')];
  cpSync(repoRoot, tmp, { recursive: true, filter: (s) => !skip.some((d) => s === d || s.startsWith(d + '/')) });
  symlinkSync(join(repoRoot, 'node_modules'), join(tmp, 'node_modules'), 'dir');
  const out = execFileSync(process.execPath, [join(tmp, 'scripts', 'validate.mjs')], { encoding: 'utf8' });
  assert.match(out, /validation passed/);
});
