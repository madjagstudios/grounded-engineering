import assert from 'node:assert/strict';
import test from 'node:test';
import { adapterIds, resolveAdapter, resolveAdapterByKind } from '../src/lib/adapters.mjs';

test('registry exposes neutral, codex, and Claude adapters', () => {
  assert.deepEqual(adapterIds().sort(), ['claude', 'codex', 'neutral']);
  assert.equal(resolveAdapter('claude').kind, 'claude-md');
  assert.equal(resolveAdapterByKind('claude-md').id, 'claude');
});

test('resolveAdapter returns adapters by id and rejects unknown ids', () => {
  assert.equal(resolveAdapter('neutral').kind, 'provider-neutral-markdown');
  assert.equal(resolveAdapter('codex').kind, 'codex-agents-md');
  assert.equal(resolveAdapter('claude').kind, 'claude-md');
  assert.equal(typeof resolveAdapter('codex').chooseTarget, 'function');
  assert.equal(typeof resolveAdapter('codex').renderDocument, 'function');
  assert.equal(typeof resolveAdapter('claude').chooseTarget, 'function');
  assert.equal(typeof resolveAdapter('claude').renderDocument, 'function');
  assert.throws(() => resolveAdapter('bogus'), /Unknown adapter: bogus.*neutral, codex, claude|neutral, claude, codex|codex, neutral, claude|codex, claude, neutral|claude, neutral, codex|claude, codex, neutral/);
});

test('resolveAdapterByKind maps kinds to adapters and rejects unknown kinds', () => {
  assert.equal(resolveAdapterByKind('codex-agents-md').id, 'codex');
  assert.equal(resolveAdapterByKind('claude-md').id, 'claude');
  assert.equal(resolveAdapterByKind('provider-neutral-markdown').id, 'neutral');
  assert.throws(() => resolveAdapterByKind('nope'), /Unsupported target kind/);
});
