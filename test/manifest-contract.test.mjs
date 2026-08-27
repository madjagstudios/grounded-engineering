import assert from 'node:assert/strict';
import test from 'node:test';
import { buildManifest, validateManifest } from '../src/lib/manifest.mjs';

const baseInput = {
  schema_version: '1.0.0',
  grounded_engineering_release: 'v0.2.0',
  pack_id: 'baseline',
  pack_version: '1.0.0',
  cards: [{
    id: 'GE-RC-001',
    public_disposition: 'ADOPT',
    local_applicability: 'APPLICABLE',
    local_decision: 'ACCEPT',
    source_refs: ['CODEX-AGENTS-GUIDE']
  }],
  targets: [{
    path: 'docs/grounded-engineering.md',
    kind: 'provider-neutral-markdown',
    precondition_sha256: 'absent',
    managed_block_sha256: '0000000000000000000000000000000000000000000000000000000000000000'
  }],
  validation: { status: 'validated' }
};

test('builds a timestamp-free durable manifest with separated decision fields', () => {
  const manifest = buildManifest(baseInput);

  assert.equal(manifest.schema_version, '1.0.0');
  assert.equal(manifest.cards[0].public_disposition, 'ADOPT');
  assert.equal(manifest.cards[0].local_decision, 'ACCEPT');
  assert.equal(manifest.cards[0].local_applicability, 'APPLICABLE');
  assert.equal(Object.hasOwn(manifest, 'created_at'), false);
  assert.equal(Object.hasOwn(manifest, 'applied_at'), false);
  assert.equal(validateManifest(manifest).valid, true);
});

test('rejects a local decision on a not-applicable card', () => {
  const manifest = buildManifest({
    ...baseInput,
    cards: [{
      ...baseInput.cards[0],
      local_applicability: 'NOT_APPLICABLE',
      local_decision: 'ACCEPT'
    }]
  });

  assert.equal(validateManifest(manifest).valid, false);
});

test('requires a revisit trigger for a local deferred decision', () => {
  const manifest = buildManifest({
    ...baseInput,
    cards: [{
      ...baseInput.cards[0],
      local_decision: 'DEFER'
    }]
  });

  assert.equal(validateManifest(manifest).valid, false);

  const validDeferred = buildManifest({
    ...baseInput,
    cards: [{
      ...baseInput.cards[0],
      local_decision: 'DEFER',
      revisit_trigger: 'Revisit after a local workflow trial.'
    }]
  });

  assert.equal(validateManifest(validDeferred).valid, true);
});

test('manifest accepts the codex-agents-md target kind', () => {
  const manifest = buildManifest({
    ...baseInput,
    grounded_engineering_release: 'v0.3.0',
    targets: [{
      ...baseInput.targets[0],
      path: 'AGENTS.md',
      kind: 'codex-agents-md'
    }]
  });

  const result = validateManifest(manifest);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test('manifest accepts the claude-md target kind', () => {
  const manifest = buildManifest({
    ...baseInput,
    grounded_engineering_release: 'v0.4.0',
    targets: [{
      ...baseInput.targets[0],
      path: 'CLAUDE.md',
      kind: 'claude-md'
    }]
  });

  const result = validateManifest(manifest);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test('manifest rejects an unknown target kind', () => {
  const manifest = buildManifest({
    ...baseInput,
    targets: [{
      ...baseInput.targets[0],
      path: 'AGENTS.md',
      kind: 'something-else'
    }]
  });

  assert.equal(validateManifest(manifest).valid, false);
});
