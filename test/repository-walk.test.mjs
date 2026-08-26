import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
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
