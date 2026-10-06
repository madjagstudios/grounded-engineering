import assert from 'node:assert/strict';
import test from 'node:test';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GENERIC_PUBLIC_PATTERNS, loadLocalPublicPatterns } from '../scripts/lib/public-patterns.mjs';
import { runValidation } from '../scripts/validate.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

function fixture({ patterns, content }) {
  const root = mkdtempSync(join(tmpdir(), 'ge-public-'));
  cpSync(join(repoRoot, 'research'), join(root, 'research'), { recursive: true });
  mkdirSync(join(root, 'practices'), { recursive: true });
  if (patterns !== undefined) {
    mkdirSync(join(root, '.private'), { recursive: true });
    writeFileSync(join(root, '.private', 'public-content-patterns.txt'), patterns);
  }
  writeFileSync(join(root, 'notes.md'), content);
  return root;
}

// A literal sample of each generic pattern, derived from the pattern itself so this
// file does not trip the check it tests.
const sampleOf = (pattern) => pattern.source.replace(/\\b/g, '').replace(/\\\//g, '/');

test('each generic pattern rejects a sample built from its own source', () => {
  assert.equal(GENERIC_PUBLIC_PATTERNS.length, 5);
  for (const pattern of GENERIC_PUBLIC_PATTERNS) assert.ok(pattern.test(sampleOf(pattern)), pattern.source);
});

test('no local file means no local patterns and no errors', () => {
  const root = fixture({ content: 'plain text\n' });
  try {
    assert.deepEqual(loadLocalPublicPatterns(root), { patterns: [], errors: [] });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('local lines parse as /source/flags or as case-sensitive raw source', () => {
  const root = fixture({ patterns: '# comment\n\n/acme-internal/i\nExactCase\n', content: '' });
  try {
    const { patterns, errors } = loadLocalPublicPatterns(root);
    assert.deepEqual(errors, []);
    assert.equal(patterns.length, 2);
    assert.ok(patterns[0].test('ACME-INTERNAL'));
    assert.ok(patterns[1].test('ExactCase'));
    assert.ok(!patterns[1].test('exactcase'));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('an invalid local pattern is reported with its line number', () => {
  const root = fixture({ patterns: 'ok\n/(unclosed/\n', content: '' });
  try {
    const { errors } = loadLocalPublicPatterns(root);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /\.private\/public-content-patterns\.txt:2: invalid pattern/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('runValidation applies local patterns only when the local file exists', () => {
  const withFile = fixture({ patterns: '/acme-internal/i\n', content: 'see Acme-Internal docs\n' });
  const withoutFile = fixture({ content: 'see Acme-Internal docs\n' });
  try {
    assert.ok(runValidation({ root: withFile }).errors.some((e) => /notes\.md: public-content check matched/.test(e)));
    assert.ok(!runValidation({ root: withoutFile }).errors.some((e) => /notes\.md: public-content check matched/.test(e)));
  } finally {
    rmSync(withFile, { recursive: true, force: true });
    rmSync(withoutFile, { recursive: true, force: true });
  }
});

test('runValidation still applies the generic patterns', () => {
  const root = fixture({ content: `${sampleOf(GENERIC_PUBLIC_PATTERNS[1])} later\n` });
  try {
    assert.ok(runValidation({ root }).errors.some((e) => /notes\.md: public-content check matched/.test(e)));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
