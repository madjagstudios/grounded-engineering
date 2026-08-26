import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parsePracticeFrontmatter } from '../src/lib/frontmatter.mjs';

const validPath = new URL('./fixtures/primitives/valid.md', import.meta.url);
const missingPath = new URL('./fixtures/primitives/missing-frontmatter.md', import.meta.url);
const unclosedPath = new URL('./fixtures/primitives/unclosed-frontmatter.md', import.meta.url);

test('parses practice frontmatter and returns the body', () => {
  const text = readFileSync(validPath, 'utf8');
  const result = parsePracticeFrontmatter(validPath.pathname, text);

  assert.equal(result.record.id, 'GE-RC-099');
  assert.equal(result.record.title, 'Fixture practice record');
  assert.equal(result.frontmatterEndLine, 6);
  assert.equal(result.body, '\n# Fixture practice record\n\nBody content.\n');
});

test('reports a missing frontmatter delimiter with the file path', () => {
  const text = readFileSync(missingPath, 'utf8');

  assert.throws(
    () => parsePracticeFrontmatter(missingPath.pathname, text),
    /missing-frontmatter\.md.*missing YAML frontmatter/
  );
});

test('reports an unclosed frontmatter block with the file path', () => {
  const text = readFileSync(unclosedPath, 'utf8');

  assert.throws(
    () => parsePracticeFrontmatter(unclosedPath.pathname, text),
    /unclosed-frontmatter\.md.*frontmatter is not closed/
  );
});
