import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPack } from '../src/lib/packs.mjs';
import { renderBaselineDocument, renderCardContent, renderCodexDocument, renderReviewMetadata } from '../src/lib/rendering.mjs';
import { renderManagedBlock } from '../src/lib/managed-blocks.mjs';

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

const codexPack = { pack_id: 'baseline', pack_version: '1.0.0', grounded_engineering_release: 'v0.3.0' };
const codexCard = {
  id: 'GE-RC-001',
  title: 'Inspect the repository first',
  pattern: 'Inspect first.',
  agent_snippet: 'Inspect before acting.',
  rationale: 'Orientation prevents rework.'
};

test('codex document embeds the same per-card block as the neutral document', () => {
  const block = renderManagedBlock(codexCard.id, renderCardContent(codexCard));
  const codex = renderCodexDocument(codexPack, [codexCard]);
  const neutral = renderBaselineDocument(codexPack, [codexCard]);

  assert.ok(codex.includes(block), 'codex output must contain the identical managed block');
  assert.ok(neutral.includes(block), 'neutral output must contain the identical managed block');
});

test('codex document uses a codex-appropriate preamble, not the baseline header', () => {
  const codex = renderCodexDocument(codexPack, [codexCard]);

  assert.doesNotMatch(codex, /# Grounded Engineering baseline/);
  assert.match(codex, /managed by Grounded Engineering/i);
});
