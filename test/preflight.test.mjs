import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { chooseCodexTarget, inspectRepository, chooseProviderNeutralTarget } from '../src/lib/preflight.mjs';

const fixtureRoot = new URL('./fixtures/existing-policy/', import.meta.url).pathname;
const cleanRoot = new URL('./fixtures/clean-repository/', import.meta.url).pathname;

test('inspects existing policy surfaces without writing', () => {
  const before = readFileSync(`${fixtureRoot}AGENTS.md`, 'utf8');
  const report = inspectRepository(fixtureRoot);

  assert.deepEqual(report.instructionFiles, ['AGENTS.md']);
  assert.deepEqual(report.policyFiles, ['docs/engineering.md']);
  assert.deepEqual(report.ciFiles, ['.github/workflows/validate.yml']);
  assert.deepEqual(report.declaredCommands, { test: 'node --test' });
  assert.equal(report.manifestExists, false);
  assert.equal(readFileSync(`${fixtureRoot}AGENTS.md`, 'utf8'), before);
});

test('selects docs target when docs exists and root target otherwise', () => {
  assert.deepEqual(chooseProviderNeutralTarget(inspectRepository(fixtureRoot)), {
    path: 'docs/grounded-engineering.md',
    reason: 'docs directory exists',
    existing: false
  });
  assert.deepEqual(chooseProviderNeutralTarget(inspectRepository(cleanRoot)), {
    path: 'GROUNDED_ENGINEERING.md',
    reason: 'docs directory is absent',
    existing: false
  });
});

test('chooseCodexTarget targets root AGENTS.md and reports existence', () => {
  const root = mkdtempSync(join(tmpdir(), 'ge-codex-target-'));

  assert.deepEqual(chooseCodexTarget({ root }), { path: 'AGENTS.md', existing: false });
  writeFileSync(join(root, 'AGENTS.md'), '# existing\n');
  assert.deepEqual(chooseCodexTarget({ root }), { path: 'AGENTS.md', existing: true });
});

test('chooseCodexTarget fails closed when a Codex override file is present', () => {
  const root = mkdtempSync(join(tmpdir(), 'ge-codex-override-'));
  writeFileSync(join(root, 'AGENTS.override.md'), '# override\n');

  assert.throws(() => chooseCodexTarget({ root }), /override/i);
});
