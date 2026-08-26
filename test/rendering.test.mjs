import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPack } from '../src/lib/packs.mjs';
import { renderBaselineDocument, renderReviewMetadata } from '../src/lib/rendering.mjs';

const root = new URL('../', import.meta.url).pathname;

test('renders concise provider-neutral guidance without research history', () => {
  const pack = loadPack(root, 'baseline');
  const document = renderBaselineDocument(pack, pack.cards);

  assert.match(document, /^# Grounded Engineering baseline/m);
  assert.match(document, /## Inspect the repository first/);
  assert.match(document, /Before editing, inspect applicable instructions/);
  assert.match(document, /## Match claims to evidence/);
  assert.doesNotMatch(document, /CODEX-|CLAUDE-/);
  assert.doesNotMatch(document, /observed implementation|source register/i);
});

test('renders review metadata with canonical IDs, dispositions, and source links', () => {
  const pack = loadPack(root, 'baseline');
  const metadata = renderReviewMetadata(pack, pack.cards, {
    instructionFiles: ['AGENTS.md'],
    policyFiles: [],
    ciFiles: [],
    declaredCommands: { test: 'npm test' }
  });

  assert.match(metadata, /GE-RC-001/);
  assert.match(metadata, /ADOPT/);
  assert.match(metadata, /CODEX-AGENTS-GUIDE/);
  assert.match(metadata, /AGENTS\.md/);
});
