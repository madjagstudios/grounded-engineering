import assert from 'node:assert/strict';
import test from 'node:test';
import { chmodSync, cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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

test('generic word patterns ignore case and path patterns do not', () => {
  const [word, , , users] = GENERIC_PUBLIC_PATTERNS;
  assert.ok(word.test(sampleOf(word).toLowerCase()));
  assert.ok(!users.test(sampleOf(users).toUpperCase()));
});

test('a g or y flag does not make a local pattern skip later files', () => {
  const root = fixture({ patterns: '/secret/gy\n', content: '' });
  try {
    const [pattern] = loadLocalPublicPatterns(root).patterns;
    assert.ok(pattern.test('secret'));
    assert.ok(pattern.test('secret'));
    assert.equal(pattern.flags, '');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('CRLF, a byte-order mark, and a slash inside the source all load', () => {
  const root = fixture({ patterns: '\uFEFF# notes\r\n/a/b/i\r\n', content: '' });
  try {
    const { patterns, errors } = loadLocalPublicPatterns(root);
    assert.deepEqual(errors, []);
    assert.ok(patterns[0].test('A/B'));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a slash-delimited line with bad flags is an error, not a raw pattern', () => {
  const root = fixture({ patterns: '/x/I\n', content: '' });
  try {
    const { patterns, errors } = loadLocalPublicPatterns(root);
    assert.equal(patterns.length, 0);
    assert.match(errors[0], /:1: invalid pattern/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a line starting with a slash must be a complete /source/flags pattern', () => {
  const root = fixture({ patterns: '/secret\n/secret/1\n/secret/ i\n', content: '' });
  try {
    const { patterns, errors } = loadLocalPublicPatterns(root);
    assert.equal(patterns.length, 0);
    assert.deepEqual(errors.map((e) => e.match(/:(\d+): /)[1]), ['1', '2', '3']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a local directory that cannot be read is reported, not treated as absent', { skip: process.getuid?.() === 0 }, () => {
  const root = fixture({ patterns: '/secret/i\n', content: '' });
  const dir = join(root, '.private');
  try {
    chmodSync(dir, 0o000);
    const { patterns, errors } = loadLocalPublicPatterns(root);
    assert.equal(patterns.length, 0);
    assert.match(errors[0] ?? '', /public-content-patterns\.txt: cannot read/);
  } finally {
    chmodSync(dir, 0o755);
    rmSync(root, { recursive: true, force: true });
  }
});

test('an unreadable local file is reported, not thrown', () => {
  const root = fixture({ content: '' });
  try {
    mkdirSync(join(root, '.private', 'public-content-patterns.txt'), { recursive: true });
    const { errors } = loadLocalPublicPatterns(root);
    assert.match(errors[0], /public-content-patterns\.txt: cannot read/);
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

test('runValidation rejects a sample of every generic pattern', () => {
  for (const pattern of GENERIC_PUBLIC_PATTERNS) {
    const root = fixture({ content: `see ${sampleOf(pattern)} here\n` });
    try {
      assert.ok(runValidation({ root }).errors.some((e) => /notes\.md: public-content check matched/.test(e)), pattern.source);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

test('the local pattern file is never scanned against itself', () => {
  const root = fixture({ patterns: '/acme-internal/i\n', content: 'plain text\n' });
  try {
    assert.ok(!runValidation({ root }).errors.some((e) => /public-content check matched/.test(e)));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
