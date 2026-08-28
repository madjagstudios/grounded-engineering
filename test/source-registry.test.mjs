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

import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSourceRegistry } from '../scripts/lib/source-registry.mjs';

const SHA2 = 'b'.repeat(40);
function sourcesDir(files) {
  const dir = mkdtempSync(join(tmpdir(), 'ge18-'));
  const sub = join(dir, 'sources');
  mkdirSync(sub);
  for (const [name, body] of Object.entries(files)) writeFileSync(join(sub, name), body);
  return sub;
}
const commit = (id, sha = SHA, path = 'x.rs') => `## ${id}\n\n- Source: Repo, [x](https://github.com/o/r/blob/${sha}/${path})\n- Immutable reference: commit \`${sha}\`\n`;
const doc = (id) => `## ${id}\n\n- Source: Docs, [d](https://code.claude.com/x)\n- Immutable reference: retrieved 2026-08-26; page content is unversioned and requires deliberate re-audit when changed\n`;
const errsOf = (files) => buildSourceRegistry(sourcesDir(files)).errors;

test('classifies commit and doc; commit target shape', () => {
  const { registry, errors } = buildSourceRegistry(sourcesDir({ 'a.md': commit('CODEX-A') + doc('CLAUDE-B') }));
  assert.deepEqual(errors, []);
  const t = registry.get('CODEX-A').targets[0];
  assert.deepEqual({ owner: t.owner, repo: t.repo, commit: t.commit, path: t.path, sourceId: t.sourceId }, { owner: 'o', repo: 'r', commit: SHA, path: 'x.rs', sourceId: 'CODEX-A' });
  assert.equal(registry.get('CLAUDE-B').kind, 'doc');
});

test('multiple blob URLs at different commits → multiple targets; plural immutable ref', () => {
  const body = `## CODEX-A\n\n- Source: R, [x](https://github.com/o/r/blob/${SHA}/x.rs) and [y](https://github.com/o/r/blob/${SHA2}/y.rs)\n- Immutable reference: commits \`${SHA}\`, \`${SHA2}\`\n`;
  const { registry, errors } = buildSourceRegistry(sourcesDir({ 'a.md': body }));
  assert.deepEqual(errors, []);
  assert.equal(registry.get('CODEX-A').targets.length, 2);
});

test('immutable-ref grammar rejects out-of-grammar forms', () => {
  const bad = (imm) => `## CODEX-A\n\n- Source: R, [x](https://github.com/o/r/blob/${SHA}/x.rs)\n- Immutable reference: ${imm}\n`;
  for (const imm of [
    `unrelated prose https://example.test/${SHA}`,     // not commit ...
    `commit \`${SHA}\` and notes`,                      // extra prose
    `commit \`${SHA2}\``,                               // SHA mismatch
    `COMMIT \`${SHA}\``,                                // uppercase keyword
    `commit \`${SHA}`,                                  // one-sided backtick
    `commits \`${SHA}\``,                               // plural keyword, one SHA
    `commits \`${SHA}\`,\`${SHA2}\``,                   // no space after comma
    `commits \`${SHA}\`, \`${SHA}\``                    // duplicate SHA
  ]) assert.ok(buildSourceRegistry(sourcesDir({ 'a.md': bad(imm) })).errors.length > 0, imm);
});

test('branch ref, mixed source, raw host', () => {
  assert.ok(errsOf({ 'a.md': `## CODEX-A\n\n- Source: R, [x](https://github.com/o/r/blob/main/x.rs)\n- Immutable reference: commit \`${SHA}\`\n` }).some((e) => /ref/i.test(e.message)));
  assert.ok(errsOf({ 'a.md': `## CODEX-A\n\n- Source: R, [x](https://github.com/o/r/blob/${SHA}/x.rs) and [d](https://code.claude.com/x)\n- Immutable reference: commit \`${SHA}\`\n` }).some((e) => /mixed/i.test(e.message)));
  assert.ok(errsOf({ 'a.md': `## CODEX-A\n\n- Source: R, [x](https://raw.githubusercontent.com/o/r/${SHA}/x.rs)\n- Immutable reference: commit \`${SHA}\`\n` }).some((e) => /raw/i.test(e.message)));
});

test('bad heading pattern reports exact sourceId', () => {
  const e = errsOf({ 'a.md': `## codex-lower\n\n- Source: R, [d](https://code.claude.com/x)\n- Immutable reference: retrieved 2026-08-26; unversioned re-audit\n` }).find((x) => /pattern/i.test(x.message));
  assert.equal(e.sourceId, 'codex-lower');
});

test('duplicate heading is caught even when the first occurrence is invalid', () => {
  // First CODEX-A lacks a Source field (invalid, not inserted); second is valid.
  const body = `## CODEX-A\n\n- Immutable reference: commit \`${SHA}\`\n\n${commit('CODEX-A')}`;
  const dup = errsOf({ 'a.md': body }).filter((e) => /duplicate/i.test(e.message));
  assert.equal(dup.length, 1);
  assert.equal(dup[0].sourceId, 'CODEX-A');
});

test('doc guard: a commit-like URL on a Locator line errors at that exact line', () => {
  // lines: 1 heading, 2 blank, 3 Source, 4 Immutable, 5 Locator
  const body = `## CLAUDE-B\n\n- Source: Docs, [d](https://code.claude.com/x)\n- Immutable reference: retrieved 2026-08-26; page content is unversioned and requires deliberate re-audit when changed\n- Locator: see https://github.com/o/r/blob/main/x.md\n`;
  const errs = buildSourceRegistry(sourcesDir({ 'a.md': body })).errors;
  assert.equal(errs.length, 1);
  assert.equal(errs[0].line, 5);
  assert.equal(errs[0].filePath.endsWith('a.md'), true);
  assert.equal(errs[0].sourceId, 'CLAUDE-B');
});

test('doc guard: a malformed commit-like link on a Locator line errors at that line', () => {
  // Unclosed `](` — extractDestinations returns {dests:[], malformed:true}; the
  // guard must still flag it (line 5) rather than accept a clean doc record.
  const body = `## CLAUDE-B\n\n- Source: Docs, [d](https://code.claude.com/x)\n- Immutable reference: retrieved 2026-08-26; page content is unversioned and requires deliberate re-audit when changed\n- Locator: [x](https://github.com/o/r/blob/main/x.md\n`;
  const errs = buildSourceRegistry(sourcesDir({ 'a.md': body })).errors;
  assert.equal(errs.length, 1);
  assert.equal(errs[0].line, 5);
  assert.match(errs[0].message, /malformed/);
});

test('CRLF commit sections parse (Windows checkout)', () => {
  const crlf = commit('CODEX-A').replace(/\n/g, '\r\n');
  const { registry, errors } = buildSourceRegistry(sourcesDir({ 'a.md': crlf }));
  assert.deepEqual(errors, []);
  assert.equal(registry.get('CODEX-A').kind, 'commit');
  assert.equal(registry.get('CODEX-A').immutableRefShas[0], SHA);
});

test('doc missing unversioned marker rejected; malformed Source link rejected', () => {
  assert.ok(errsOf({ 'a.md': `## CLAUDE-B\n\n- Source: Docs, [d](https://code.claude.com/x)\n- Immutable reference: official documentation page retrieved 2026-08-26\n` }).some((e) => /unversioned|re-audit/i.test(e.message)));
  assert.ok(errsOf({ 'a.md': `## CODEX-A\n\n- Source: R, [x](https://github.com/o/r/blob/${SHA}/x.rs\n- Immutable reference: commit \`${SHA}\`\n` }).some((e) => /malformed|Source/i.test(e.message)));
});

test('field cardinality: zero/duplicate Source or Immutable reference', () => {
  assert.ok(errsOf({ 'a.md': `## CODEX-A\n\n- Immutable reference: commit \`${SHA}\`\n` }).some((e) => /exactly one Source|Source field, found 0/i.test(e.message)));
  assert.ok(errsOf({ 'a.md': `## CODEX-A\n\n- Source: R, [x](https://github.com/o/r/blob/${SHA}/x.rs)\n- Source: R, [y](https://github.com/o/r/blob/${SHA}/y.rs)\n- Immutable reference: commit \`${SHA}\`\n` }).some((e) => /exactly one Source field, found 2/i.test(e.message)));
  assert.ok(errsOf({ 'a.md': commit('CODEX-A') + `- Immutable reference: commit \`${SHA}\`\n` }).some((e) => /Immutable reference field, found 2/i.test(e.message)));
});

test('directory-level failures with exact null-line diagnostics', () => {
  const notDir = join(mkdtempSync(join(tmpdir(), 'ge18-nd-')), 'file.md');
  writeFileSync(notDir, 'x');
  assert.ok(buildSourceRegistry(notDir).errors.some((e) => /not a directory/i.test(e.message) && e.line === null && e.sourceId === null));
  const empty = mkdtempSync(join(tmpdir(), 'ge18-empty-'));
  assert.ok(buildSourceRegistry(empty).errors.some((e) => /no Markdown files/i.test(e.message)));
  assert.ok(buildSourceRegistry(join(empty, 'nope')).errors.some((e) => /missing/i.test(e.message)));
  assert.ok(errsOf({ 'a.md': 'no headings here\n' }).some((e) => /no ## sections/i.test(e.message) && e.line === null));
  const stray = errsOf({ 'a.md': `- Source: R, [x](https://github.com/o/r/blob/${SHA}/x.rs)\n\n## CODEX-A\n\n- Source: R, [x](https://github.com/o/r/blob/${SHA}/x.rs)\n- Immutable reference: commit \`${SHA}\`\n` }).find((e) => /outside/i.test(e.message));
  assert.equal(stray.line, 1);
});

test('an unreadable *.md entry produces an exact read diagnostic', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ge18-unread-'));
  const sub = join(dir, 'sources');
  mkdirSync(sub);
  mkdirSync(join(sub, 'broken.md')); // reading a directory throws EISDIR
  writeFileSync(join(sub, 'ok.md'), commit('CODEX-A')); // keep sectionCount > 0
  const errs = buildSourceRegistry(sub).errors;
  const read = errs.find((e) => e.filePath.endsWith('broken.md'));
  assert.ok(read, `expected a broken.md read diagnostic, got ${JSON.stringify(errs)}`);
  assert.equal(read.message, 'unreadable file');
  assert.equal(read.line, null);
  assert.equal(read.sourceId, null);
});

import { fileURLToPath } from 'node:url';

test('real repository sources are complete and clean', () => {
  const realDir = fileURLToPath(new URL('../research/sources', import.meta.url));
  const { registry, errors } = buildSourceRegistry(realDir);
  assert.deepEqual(errors, [], `unexpected errors: ${JSON.stringify(errors)}`);
  const recs = [...registry.values()];
  assert.equal(registry.size, 13);
  assert.equal(recs.filter((r) => r.kind === 'commit').length, 5);
  assert.equal(recs.filter((r) => r.kind === 'doc').length, 8);
  assert.equal(recs.reduce((n, r) => n + r.targets.length, 0), 5);
});
