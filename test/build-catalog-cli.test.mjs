import assert from 'node:assert/strict';
import test from 'node:test';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBuildCatalog } from '../scripts/build-catalog.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
// Copy the working tree (minus heavy and local-only dirs) so validation sees every linked file.
const SKIP = new Set(['.git', 'node_modules', '.private', 'worktrees', 'reports', 'coverage']);
function copyRepo() {
  const root = mkdtempSync(join(tmpdir(), 'ge-cat-'));
  cpSync(repoRoot, root, { recursive: true, filter: (src) => !SKIP.has(src.slice(repoRoot.length).split(/[\\/]/).filter(Boolean)[0]) });
  return root;
}
const silent = () => {};

test('--check passes on the committed catalog', () => {
  assert.equal(runBuildCatalog({ root: repoRoot, check: true, write: silent }), 0);
});

test('--check fails when the committed catalog is stale', () => {
  const root = copyRepo();
  writeFileSync(join(root, 'plugin', 'catalog.json'), '{}\n');
  assert.equal(runBuildCatalog({ root, check: true, write: silent }), 1);
});

test('a write regenerates the catalog', () => {
  const root = copyRepo();
  writeFileSync(join(root, 'plugin', 'catalog.json'), '{}\n');
  assert.equal(runBuildCatalog({ root, check: false, write: silent }), 0);
  assert.equal(readFileSync(join(root, 'plugin', 'catalog.json'), 'utf8'), readFileSync(join(repoRoot, 'plugin', 'catalog.json'), 'utf8'));
});

test('refuses to build when validation fails', () => {
  const root = copyRepo();
  writeFileSync(join(root, 'plugin', 'fit-rules.yaml'), '- card: GE-XX-999\n  when: { all: [has_ci] }\n  why: Unknown card rule text.\n');
  assert.equal(runBuildCatalog({ root, check: false, write: silent }), 2);
});
