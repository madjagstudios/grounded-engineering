import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import { parse } from 'yaml';
import { parsePracticeFrontmatter } from '../src/lib/frontmatter.mjs';

const schemaPath = new URL('../research/schema.yaml', import.meta.url);
const cardPath = new URL('../practices/verification/claims-match-evidence.md', import.meta.url);

const validate = new Ajv2020({ allErrors: true, strict: false }).compile(
  parse(readFileSync(schemaPath, 'utf8'))
);

// A real, fully schema-valid card is the base; each test mutates only validation.
const baseRecord = parsePracticeFrontmatter(
  cardPath.pathname,
  readFileSync(cardPath, 'utf8')
).record;

function withValidation(validation) {
  return { ...structuredClone(baseRecord), validation };
}

const sha = 'a'.repeat(40);
const entry = (source_id, revisions) => ({ source_id, revisions });

test('not_validated is valid without validated_against', () => {
  assert.equal(validate(withValidation({ status: 'not_validated' })), true, JSON.stringify(validate.errors));
});
test('validated without validated_against is rejected', () => {
  assert.equal(validate(withValidation({ status: 'validated' })), false);
});
test('needs_review without validated_against is rejected', () => {
  assert.equal(validate(withValidation({ status: 'needs_review', note: 'source moved upstream' })), false);
});
test('needs_review without note is rejected', () => {
  assert.equal(validate(withValidation({ status: 'needs_review', validated_against: [entry('CODEX-A', [sha])] })), false);
});
test('validated with an array of {source_id, revisions} is valid', () => {
  assert.equal(validate(withValidation({ status: 'validated', validated_against: [entry('CODEX-A', [sha]), entry('CLAUDE-B', ['2026-08-26'])] })), true, JSON.stringify(validate.errors));
});
test('needs_review with note + entries is valid', () => {
  assert.equal(validate(withValidation({ status: 'needs_review', note: 'pin moved; re-audit', validated_against: [entry('CODEX-A', [sha])] })), true, JSON.stringify(validate.errors));
});
test('a scalar validated_against (the old shape) is now rejected', () => {
  assert.equal(validate(withValidation({ status: 'validated', validated_against: sha })), false);
});
test('bad source_id pattern and bad revision shape are rejected', () => {
  assert.equal(validate(withValidation({ status: 'validated', validated_against: [entry('bad id', [sha])] })), false);
  assert.equal(validate(withValidation({ status: 'validated', validated_against: [entry('CODEX-A', ['not-a-rev'])] })), false);
});
test('duplicate revisions within one entry are rejected', () => {
  assert.equal(validate(withValidation({ status: 'validated', validated_against: [entry('CODEX-A', [sha, sha])] })), false);
});
