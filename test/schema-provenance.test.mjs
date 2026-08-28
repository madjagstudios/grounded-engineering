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

test('not_validated is valid without validated_against', () => {
  assert.equal(validate(withValidation({ status: 'not_validated' })), true, JSON.stringify(validate.errors));
});

test('validated without validated_against is rejected', () => {
  assert.equal(validate(withValidation({ status: 'validated' })), false);
});

test('needs_review without validated_against is rejected', () => {
  assert.equal(validate(withValidation({ status: 'needs_review' })), false);
});

test('validated with a commit SHA is valid', () => {
  const ok = validate(withValidation({
    status: 'validated',
    validated_against: 'dc08ace7821614a702b1214c9d08ae0db2634d82'
  }));
  assert.equal(ok, true, JSON.stringify(validate.errors));
});

test('needs_review with a tag is valid', () => {
  const ok = validate(withValidation({
    status: 'needs_review',
    validated_against: 'v0.4.0'
  }));
  assert.equal(ok, true, JSON.stringify(validate.errors));
});

test('validated with a malformed revision is rejected', () => {
  assert.equal(validate(withValidation({
    status: 'validated',
    validated_against: 'not a revision!'
  })), false);
});
