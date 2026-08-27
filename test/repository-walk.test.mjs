import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { walkRepository } from '../src/lib/repository-walk.mjs';

const root = new URL('./fixtures/primitives/ignored/', import.meta.url).pathname;

test('walks files in stable lexical order and skips generated/dependency directories', () => {
  const files = walkRepository(root);
  const names = files.map((file) => file.slice(root.length));

  assert.deepEqual(names, []);
  assert.deepEqual(files, [...files].sort());
});

test('walks an ordinary repository fixture', () => {
  const fixtureRoot = new URL('./fixtures/primitives/', import.meta.url).pathname;
  const files = walkRepository(fixtureRoot);
  const names = files.map((file) => file.slice(fixtureRoot.length));

  assert.deepEqual(names, [
    'missing-frontmatter.md',
    'unclosed-frontmatter.md',
    'valid.md'
  ]);
  assert.equal(readdirSync(fixtureRoot, { withFileTypes: true }).some((entry) => entry.name === 'ignored'), true);
});

test('skips local-only repository state while preserving normal source traversal', (context) => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'grounded-engineering-walk-'));
  context.after(() => rmSync(fixtureRoot, { recursive: true, force: true }));

  for (const directory of ['.grounded-engineering', '.private', '.superpowers', '.worktrees', 'reports', 'worktrees']) {
    mkdirSync(join(fixtureRoot, directory), { recursive: true });
    writeFileSync(join(fixtureRoot, directory, 'ignored.md'), 'local only');
  }
  mkdirSync(join(fixtureRoot, 'src'));
  writeFileSync(join(fixtureRoot, 'src', 'kept.mjs'), 'export const kept = true;\n');

  const files = walkRepository(fixtureRoot);
  const names = files.map((file) => file.slice(fixtureRoot.length + 1));

  assert.deepEqual(names, ['src/kept.mjs']);
});
