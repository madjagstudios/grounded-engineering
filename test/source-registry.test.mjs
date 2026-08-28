import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSourceUrl, isCommitLikeUrl, extractDestinations } from '../scripts/lib/source-registry.mjs';

const SHA = 'a'.repeat(40);

test('extractDestinations: backtick/paren link text; fragment kept', () => {
  assert.deepEqual(extractDestinations('- Source: `a(b).rs`, [`a(b).rs`](https://x.test/p#L1-L2)'), { dests: ['https://x.test/p#L1-L2'], malformed: false });
});
test('extractDestinations: two links; order preserved', () => {
  assert.deepEqual(extractDestinations('[x](https://a.test/1) and [y](https://b.test/2)'), { dests: ['https://a.test/1', 'https://b.test/2'], malformed: false });
});
test('extractDestinations: identical destinations are de-duplicated', () => {
  assert.deepEqual(extractDestinations('[x](https://a.test/1) and [y](https://a.test/1)'), { dests: ['https://a.test/1'], malformed: false });
});
test('extractDestinations: balanced parens in Markdown and bare URLs', () => {
  assert.deepEqual(extractDestinations(`[x](https://github.com/o/r/blob/${SHA}/docs/foo_(bar).md)`), { dests: [`https://github.com/o/r/blob/${SHA}/docs/foo_(bar).md`], malformed: false });
  assert.deepEqual(extractDestinations(`see https://github.com/o/r/blob/${SHA}/docs/foo_(bar).md.`), { dests: [`https://github.com/o/r/blob/${SHA}/docs/foo_(bar).md`], malformed: false });
});
test('extractDestinations: optional title (with parens + a URL inside) is skipped', () => {
  assert.deepEqual(extractDestinations('[x](https://a.test/1 "see (draft) https://evil.test/2")'), { dests: ['https://a.test/1'], malformed: false });
  assert.deepEqual(extractDestinations('[x](https://a.test/1 (a title))'), { dests: ['https://a.test/1'], malformed: false });
});
test('extractDestinations: an unterminated title is malformed', () => {
  assert.equal(extractDestinations('[x](https://a.test/1 "unterminated').malformed, true);
});
test('extractDestinations: unclosed Markdown link is malformed', () => {
  assert.equal(extractDestinations('[x](https://a.test/1').malformed, true);
});
test('extractDestinations: angle autolink and bare trailing punctuation', () => {
  assert.deepEqual(extractDestinations('see <https://x.test/a> and https://x.test/docs.'), { dests: ['https://x.test/a', 'https://x.test/docs'], malformed: false });
});

test('parseSourceUrl: valid blob; ?plain=1 (with fragment) ok; other query invalid', () => {
  const r = parseSourceUrl(`https://github.com/openai/codex/blob/${SHA}/codex-rs/core/src/agents_md.rs#L1-L16`);
  assert.deepEqual([r.kind, r.owner, r.repo, r.commit, r.path, r.lineRange], ['blob', 'openai', 'codex', SHA, 'codex-rs/core/src/agents_md.rs', 'L1-L16']);
  assert.equal(parseSourceUrl(`https://github.com/o/r/blob/${SHA}/x.md?plain=1#L1`).kind, 'blob');
  assert.equal(parseSourceUrl(`https://github.com/o/r/blob/${SHA}/x.md?foo=1`).kind, 'invalid');
});
test('parseSourceUrl: branch ref, empty owner/repo/interior/path, malformed escape → invalid', () => {
  for (const u of [
    `https://github.com/o/r/blob/main/x.md`,
    `https://github.com/o//blob/${SHA}/x.md`,
    `https://github.com//r/blob/${SHA}/x.md`,
    `https://github.com/o/r/blob/${SHA}/a//b.md`,
    `https://github.com/o/r/blob/${SHA}/`,
    `https://github.com/o/r/blob/${SHA}/foo%2.md`
  ]) assert.equal(parseSourceUrl(u).kind, 'invalid', u);
});
test('parseSourceUrl: decoded path; raw; doc; tree→doc', () => {
  assert.equal(parseSourceUrl(`https://github.com/o/r/blob/${SHA}/foo%20bar.md`).path, 'foo bar.md');
  assert.equal(parseSourceUrl(`https://raw.githubusercontent.com/o/r/${SHA}/x.md`).kind, 'raw');
  assert.equal(parseSourceUrl('https://code.claude.com/docs/en/memory').kind, 'doc');
  assert.equal(parseSourceUrl('https://github.com/o/r/tree/main').kind, 'doc');
});
test('isCommitLikeUrl: blob shape regardless of ref; raw host; not relative/doc', () => {
  assert.equal(isCommitLikeUrl('https://github.com/o/r/blob/main/x.md'), true);
  assert.equal(isCommitLikeUrl(`https://raw.githubusercontent.com/o/r/${SHA}/x.md`), true);
  assert.equal(isCommitLikeUrl('https://code.claude.com/x'), false);
  assert.equal(isCommitLikeUrl('../relative/x.md'), false);
});
