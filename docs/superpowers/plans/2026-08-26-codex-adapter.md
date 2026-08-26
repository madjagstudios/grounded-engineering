# Codex Adapter Implementation Plan

Status: shipped in `main` at merge commit `747c92c` via PR #4.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `codex` output adapter to `grounded-engineering adopt` that emits `AGENTS.md`-shaped guidance, selected by a new `--adapter` flag, reusing the existing preview → create → apply → manifest machinery.

**Architecture:** Introduce a small adapter registry (`src/lib/adapters.mjs`); each adapter has a stable `id`, a static `kind`, a `chooseTarget(preflight)`, and a `renderDocument(pack, cards)`. `buildProposal` and `buildApplyChanges` resolve the adapter instead of hardcoding the neutral target/renderer. `buildProposal` also stops discarding `mergeManagedBlocks` conflicts so `preview`/`create` fail closed on structural marker conflicts. Per-card managed-block content is byte-identical across adapters — only the document preamble and target file differ.

**Tech Stack:** Node.js ≥20 ESM, `node:test`, `node:assert/strict`, existing `yaml` + AJV 2020 modules. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-26-codex-adapter-design.md`

## Global Constraints

- Preview and create never modify canonical/target files; only explicit `apply --confirm` writes target files and the manifest. Create writes only under `.grounded-engineering/proposals/<id>/`.
- Existing target files are edited only inside card-keyed managed blocks; bytes outside the block are preserved exactly.
- Per-card managed-block content is identical across adapters (`renderCardContent` unchanged); only the document preamble and target path differ.
- Fail closed: unknown adapter, Codex override file present, and structural marker conflicts all stop with a clear message and a non-zero exit; no writes.
- One applied manifest per repository in v1 — the existing "manifest already exists" guard is unchanged.
- Card IDs live in the managed-block markers; source references live in `review_metadata` and the manifest, never invented into block content.
- `npm test` (validate + `node --test test/*.test.mjs`) must stay green after every task. Commit after each task. No agent-attribution trailers (public repo).

---

### Task 1: Widen the manifest schema to allow the Codex kind

**Files:**
- Modify: `packs/manifest-schema.yaml` (the `kind` property under `targets.items.properties`, ~line 94-95)
- Test: `test/manifest-contract.test.mjs`

**Interfaces:**
- Produces: manifests with `targets[].kind` ∈ `{provider-neutral-markdown, codex-agents-md}` validate; other kinds are rejected.

- [ ] **Step 1: Write the failing test**

Add to `test/manifest-contract.test.mjs` (reuse the file's existing helpers/imports for `buildManifest`/`validateManifest`; mirror an existing valid-manifest test and change the target kind):

```js
test('manifest accepts the codex-agents-md target kind', () => {
  const manifest = buildManifest({
    schema_version: '1.0.0',
    grounded_engineering_release: 'v0.3.0',
    pack_id: 'baseline',
    pack_version: '1.0.0',
    cards: [{ id: 'GE-RC-001', public_disposition: 'ADOPT', local_applicability: 'APPLICABLE', source_refs: ['CODEX-AGENTS-GUIDE'] }],
    targets: [{ path: 'AGENTS.md', kind: 'codex-agents-md', precondition_sha256: 'absent', managed_block_sha256: 'a'.repeat(64) }],
    validation: { status: 'validated' },
  });
  const result = validateManifest(manifest);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test('manifest rejects an unknown target kind', () => {
  const manifest = buildManifest({
    schema_version: '1.0.0',
    grounded_engineering_release: 'v0.3.0',
    pack_id: 'baseline',
    pack_version: '1.0.0',
    cards: [{ id: 'GE-RC-001', public_disposition: 'ADOPT', local_applicability: 'APPLICABLE', source_refs: ['CODEX-AGENTS-GUIDE'] }],
    targets: [{ path: 'AGENTS.md', kind: 'something-else', precondition_sha256: 'absent', managed_block_sha256: 'a'.repeat(64) }],
    validation: { status: 'validated' },
  });
  assert.equal(validateManifest(manifest).valid, false);
});
```

If `buildManifest`'s exact input shape differs, copy it from the nearest existing test in the same file rather than guessing.

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/manifest-contract.test.mjs`
Expected: the `codex-agents-md` test FAILS (kind `const` rejects it).

- [ ] **Step 3: Change `const` to `enum`**

In `packs/manifest-schema.yaml`, under `targets.items.properties.kind`:

```yaml
        kind:
          enum: [provider-neutral-markdown, codex-agents-md]
```

(Replace the `const: provider-neutral-markdown` line.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/manifest-contract.test.mjs`
Expected: PASS (both new tests, and all pre-existing ones).

- [ ] **Step 5: Commit**

```bash
git add packs/manifest-schema.yaml test/manifest-contract.test.mjs
git commit -m "feat: allow codex-agents-md target kind in manifest schema (GE-9)"
```

---

### Task 2: Codex document renderer

**Files:**
- Modify: `src/lib/rendering.mjs` (add `renderCodexDocument`, reuse the module-private `renderCard`)
- Test: `test/rendering.test.mjs`

**Interfaces:**
- Consumes: existing `renderCard` (module-private), `renderCardContent` (exported).
- Produces: `renderCodexDocument(pack, cards) -> string`. The per-card managed-block substrings are byte-identical to `renderBaselineDocument`'s; only the preamble differs.

- [ ] **Step 1: Write the failing test**

Add to `test/rendering.test.mjs` (import `renderBaselineDocument, renderCodexDocument, renderCardContent` from `../src/lib/rendering.mjs`, and `renderManagedBlock` from `../src/lib/managed-blocks.mjs`):

```js
const pack = { pack_id: 'baseline', pack_version: '1.0.0', grounded_engineering_release: 'v0.3.0' };
const card = { id: 'GE-RC-001', title: 'Inspect the repository first', pattern: 'Inspect first.', agent_snippet: 'Inspect before acting.', rationale: 'Orientation prevents rework.' };

test('codex document embeds the same per-card block as the neutral document', () => {
  const block = renderManagedBlock(card.id, renderCardContent(card));
  const codex = renderCodexDocument(pack, [card]);
  const neutral = renderBaselineDocument(pack, [card]);
  assert.ok(codex.includes(block), 'codex output must contain the identical managed block');
  assert.ok(neutral.includes(block), 'neutral output must contain the identical managed block');
});

test('codex document uses a codex-appropriate preamble, not the baseline header', () => {
  const codex = renderCodexDocument(pack, [card]);
  assert.doesNotMatch(codex, /# Grounded Engineering baseline/);
  assert.match(codex, /managed by Grounded Engineering/i);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/rendering.test.mjs`
Expected: FAIL — `renderCodexDocument is not a function`.

- [ ] **Step 3: Implement `renderCodexDocument`**

Append to `src/lib/rendering.mjs`:

```js
export function renderCodexDocument(pack, cards) {
  return [
    '# Agent guidance (Grounded Engineering)',
    '',
    'The following practices are managed by Grounded Engineering. Edit them with the `grounded-engineering` CLI, not by hand.',
    '',
    cards.map(renderCard).join('\n\n'),
    '',
  ].join('\n');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/rendering.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rendering.mjs test/rendering.test.mjs
git commit -m "feat: add Codex document renderer (GE-9)"
```

---

### Task 3: Codex target selection with override-file guard

**Files:**
- Modify: `src/lib/preflight.mjs` (add `chooseCodexTarget`; `existsSync` and `join` are already imported)
- Test: `test/preflight.test.mjs`

**Interfaces:**
- Consumes: a preflight `report` object with `report.root` (from `inspectRepository`).
- Produces: `chooseCodexTarget(report) -> { path: 'AGENTS.md', existing: boolean }`; throws when a Codex override file is present in the repo root.

- [ ] **Step 1: Write the failing test**

Add to `test/preflight.test.mjs` (import `chooseCodexTarget` from `../src/lib/preflight.mjs`; use `mkdtempSync`/`writeFileSync` like the file's existing tests):

```js
test('chooseCodexTarget targets root AGENTS.md and reports existence', () => {
  const root = mkdtempSync(join(tmpdir(), 'ge-codex-target-'));
  assert.deepEqual(chooseCodexTarget({ root }), { path: 'AGENTS.md', existing: false });
  writeFileSync(join(root, 'AGENTS.md'), '# existing\n');
  assert.deepEqual(chooseCodexTarget({ root }), { path: 'AGENTS.md', existing: true });
});

test('chooseCodexTarget fails closed when a Codex override file is present', () => {
  const root = mkdtempSync(join(tmpdir(), 'ge-codex-override-'));
  writeFileSync(join(root, 'AGENTS.override.md'), '# override\n');
  assert.throws(() => chooseCodexTarget({ root }), /override/i);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/preflight.test.mjs`
Expected: FAIL — `chooseCodexTarget is not a function`.

- [ ] **Step 3: Implement `chooseCodexTarget`**

Append to `src/lib/preflight.mjs`:

```js
// Codex loads AGENTS.md, but an override file supersedes it (CODEX-AGENTS-IMPLEMENTATION,
// agents_md.rs:39-46). Confirm the exact override name(s) against that pinned source; the
// default candidate is AGENTS.override.md. Root-level only in v1.
const codexOverrideNames = ['AGENTS.override.md'];

export function chooseCodexTarget(report) {
  const override = codexOverrideNames.find((name) => existsSync(join(report.root, name)));
  if (override) {
    throw new Error(`Codex reads ${override} when present, so it supersedes AGENTS.md and no Codex file was generated. Remove or consolidate ${override}, or target it manually.`);
  }
  const path = 'AGENTS.md';
  return { path, existing: existsSync(join(report.root, path)) };
}
```

**Note for the implementer:** open `research/sources/codex.md` (locator `agents_md.rs:39-46`) and confirm the override filename(s). If the pinned source names a different or additional override file, add it to `codexOverrideNames` and to the test.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/preflight.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/preflight.mjs test/preflight.test.mjs
git commit -m "feat: add Codex target selection with override-file guard (GE-9)"
```

---

### Task 4: Adapter registry

**Files:**
- Create: `src/lib/adapters.mjs`
- Test: `test/adapters.test.mjs`

**Interfaces:**
- Consumes: `chooseProviderNeutralTarget`, `chooseCodexTarget` from `./preflight.mjs`; `renderBaselineDocument`, `renderCodexDocument` from `./rendering.mjs`.
- Produces:
  - `adapterIds() -> string[]`
  - `resolveAdapter(id) -> { id, kind, chooseTarget, renderDocument }` (throws with the valid-id list on unknown id)
  - `resolveAdapterByKind(kind) -> adapter` (throws on unknown kind)

- [ ] **Step 1: Write the failing test**

Create `test/adapters.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { adapterIds, resolveAdapter, resolveAdapterByKind } from '../src/lib/adapters.mjs';

test('registry exposes neutral and codex adapters', () => {
  assert.deepEqual(adapterIds().sort(), ['codex', 'neutral']);
});

test('resolveAdapter returns adapters by id and rejects unknown ids', () => {
  assert.equal(resolveAdapter('neutral').kind, 'provider-neutral-markdown');
  assert.equal(resolveAdapter('codex').kind, 'codex-agents-md');
  assert.equal(typeof resolveAdapter('codex').chooseTarget, 'function');
  assert.equal(typeof resolveAdapter('codex').renderDocument, 'function');
  assert.throws(() => resolveAdapter('bogus'), /Unknown adapter: bogus.*neutral, codex|codex, neutral/);
});

test('resolveAdapterByKind maps kinds to adapters and rejects unknown kinds', () => {
  assert.equal(resolveAdapterByKind('codex-agents-md').id, 'codex');
  assert.equal(resolveAdapterByKind('provider-neutral-markdown').id, 'neutral');
  assert.throws(() => resolveAdapterByKind('nope'), /Unsupported target kind/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/adapters.test.mjs`
Expected: FAIL — cannot find module `../src/lib/adapters.mjs`.

- [ ] **Step 3: Implement the registry**

Create `src/lib/adapters.mjs`:

```js
import { chooseProviderNeutralTarget, chooseCodexTarget } from './preflight.mjs';
import { renderBaselineDocument, renderCodexDocument } from './rendering.mjs';

const ADAPTERS = [
  {
    id: 'neutral',
    kind: 'provider-neutral-markdown',
    chooseTarget: chooseProviderNeutralTarget,
    renderDocument: renderBaselineDocument,
  },
  {
    id: 'codex',
    kind: 'codex-agents-md',
    chooseTarget: chooseCodexTarget,
    renderDocument: renderCodexDocument,
  },
];

const byId = new Map(ADAPTERS.map((adapter) => [adapter.id, adapter]));
const byKind = new Map(ADAPTERS.map((adapter) => [adapter.kind, adapter]));

export function adapterIds() {
  return ADAPTERS.map((adapter) => adapter.id);
}

export function resolveAdapter(id) {
  const adapter = byId.get(id);
  if (!adapter) throw new Error(`Unknown adapter: ${id}. Valid adapters: ${adapterIds().join(', ')}`);
  return adapter;
}

export function resolveAdapterByKind(kind) {
  const adapter = byKind.get(kind);
  if (!adapter) throw new Error(`Unsupported target kind: ${kind}`);
  return adapter;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/adapters.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/adapters.mjs test/adapters.test.mjs
git commit -m "feat: add adapter registry (GE-9)"
```

---

### Task 5: Wire the adapter into `buildProposal` and surface conflicts

**Files:**
- Modify: `src/lib/proposals.mjs` (`buildProposal`, imports, add `proposalConflicts`, guard `createProposal`)
- Test: `test/proposals.test.mjs`

**Interfaces:**
- Consumes: `resolveAdapter` from `./adapters.mjs`.
- Produces:
  - `buildProposal(root, { adapter, ... })` — resolves the adapter (default `neutral`), sets `targets[].kind` from `adapter.kind`, sets `targets[].conflicts` (array, from `mergeManagedBlocks`), and sets a top-level `adapter` field on the proposal.
  - `proposalConflicts(proposal) -> Array<{code,message}>`
  - `createProposal` throws (saving nothing) when `proposalConflicts` is non-empty.

- [ ] **Step 1: Write the failing test**

Add to `test/proposals.test.mjs` (reuse the file's existing fixture helpers; `sourceRoot` is the repo root as other tests set it up):

```js
test('buildProposal with the codex adapter targets AGENTS.md and records the adapter', () => {
  const root = mkdtempSync(join(tmpdir(), 'ge-codex-build-'));
  const proposal = buildProposal(root, { sourceRoot: REPO_ROOT, profile: 'baseline', packId: 'baseline', adapter: 'codex' });
  assert.equal(proposal.adapter, 'codex');
  assert.equal(proposal.targets[0].path, 'AGENTS.md');
  assert.equal(proposal.targets[0].kind, 'codex-agents-md');
  assert.deepEqual(proposal.targets[0].conflicts, []);
});

test('buildProposal reports a structural conflict when the target has a malformed marker', () => {
  const root = mkdtempSync(join(tmpdir(), 'ge-conflict-'));
  // duplicate begin marker for a card the pack will select -> structural conflict
  writeFileSync(join(root, 'AGENTS.md'),
    '<!-- grounded-engineering:begin card=GE-RC-001 -->\nx\n<!-- grounded-engineering:begin card=GE-RC-001 -->\n');
  const proposal = buildProposal(root, { sourceRoot: REPO_ROOT, profile: 'baseline', packId: 'baseline', adapter: 'codex' });
  assert.ok(proposalConflicts(proposal).length > 0);
});

test('createProposal refuses to save a conflicted proposal', () => {
  const root = mkdtempSync(join(tmpdir(), 'ge-conflict-create-'));
  writeFileSync(join(root, 'AGENTS.md'),
    '<!-- grounded-engineering:begin card=GE-RC-001 -->\nx\n<!-- grounded-engineering:begin card=GE-RC-001 -->\n');
  assert.throws(
    () => createProposal(root, { sourceRoot: REPO_ROOT, profile: 'baseline', packId: 'baseline', adapter: 'codex' }),
    /conflict/i,
  );
  assert.equal(existsSync(join(root, '.grounded-engineering', 'proposals')), false);
});

test('buildProposal surfaces conflicts for the neutral adapter too (shared change)', () => {
  const root = mkdtempSync(join(tmpdir(), 'ge-conflict-neutral-'));
  // the neutral adapter targets docs/grounded-engineering.md when docs/ exists
  mkdirSync(join(root, 'docs'), { recursive: true });
  writeFileSync(join(root, 'docs', 'grounded-engineering.md'),
    '<!-- grounded-engineering:begin card=GE-RC-001 -->\nx\n<!-- grounded-engineering:begin card=GE-RC-001 -->\n');
  const proposal = buildProposal(root, { sourceRoot: REPO_ROOT, profile: 'baseline', packId: 'baseline', adapter: 'neutral' });
  assert.ok(proposalConflicts(proposal).length > 0);
});
```

Ensure `mkdirSync` is imported from `node:fs` in this test file (add it if absent). Import `proposalConflicts` (new) alongside the existing imports from `../src/lib/proposals.mjs`, and define `REPO_ROOT` the way the file already resolves the repo root for `sourceRoot` (copy the existing pattern in that test file).

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/proposals.test.mjs`
Expected: FAIL — `adapter`/`conflicts` undefined, `proposalConflicts` not exported.

- [ ] **Step 3: Update imports and `buildProposal`**

In `src/lib/proposals.mjs`:

1. Add the import: `import { resolveAdapter, resolveAdapterByKind } from './adapters.mjs';`
   (`resolveAdapterByKind` is used in Task 6; add it now.)
2. Remove the now-unused `chooseProviderNeutralTarget` import from `./preflight.mjs` (it is used only inside the `neutral` adapter now). Keep `inspectRepository`.
3. In `buildProposal`, keep the existing `const preflight = inspectRepository(targetRoot);` line as-is. Replace the run of lines from `const target = chooseProviderNeutralTarget(preflight);` down to and including the `const proposedContent = ... ;` line with the following (this does **not** re-declare `preflight`; the `const fingerprint = fingerprintTarget(...)` line just below stays unchanged):

```js
  const adapter = resolveAdapter(options.adapter ?? 'neutral');
  const target = adapter.chooseTarget(preflight);
  const targetPath = join(targetRoot, target.path);
  const existingText = existsSync(targetPath) ? readFileSync(targetPath, 'utf8') : null;
  const blocks = targetBlocks(cards);
  const merged = existingText === null ? null : mergeManagedBlocks(existingText, blocks);
  const proposedContent = existingText === null ? adapter.renderDocument(pack, cards) : merged.text;
  const conflicts = merged?.conflicts ?? [];
```

Watch for pre-existing declarations of `targetPath`, `existingText`, and `blocks` in the original block — this replacement supersedes them, so ensure each identifier is declared exactly once after the edit.

4. In the returned proposal object: add `adapter: adapter.id,` (next to `profile:`), and in the single `targets: [{ ... }]` entry change `kind: 'provider-neutral-markdown',` to `kind: adapter.kind,` and add `conflicts,`.

If `renderBaselineDocument` is no longer referenced anywhere in `proposals.mjs` after Task 6, remove it from the rendering import then; leave it for now if `buildApplyChanges` still references it before Task 6 lands.

- [ ] **Step 4: Add `proposalConflicts` and guard `createProposal`**

Add near the other exports:

```js
export function proposalConflicts(proposal) {
  return (proposal.targets ?? []).flatMap((target) => target.conflicts ?? []);
}
```

Replace `createProposal`:

```js
export function createProposal(root, options = {}) {
  const proposal = buildProposal(root, options);
  const conflicts = proposalConflicts(proposal);
  if (conflicts.length > 0) {
    throw new Error(`Cannot create a proposal with unresolved conflicts: ${conflicts.map((conflict) => conflict.message).join('; ')}`);
  }
  return saveProposal(root, proposal);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test test/proposals.test.mjs`
Expected: PASS (new tests, and the existing neutral proposal tests — the neutral adapter now produces the same output it did before, including `adapter: 'neutral'` and `conflicts: []`).

If an existing assertion checks the exact proposal object shape and now trips on the new `adapter`/`conflicts` fields, update that assertion to expect the new fields (they are additive and intended).

- [ ] **Step 6: Commit**

```bash
git add src/lib/proposals.mjs test/proposals.test.mjs
git commit -m "feat: select output adapter in buildProposal and surface conflicts (GE-9)"
```

---

### Task 6: Adapter-aware apply

**Files:**
- Modify: `src/lib/proposals.mjs` (`buildApplyChanges`)
- Test: `test/cli-apply.test.mjs` (programmatic `applyProposal`, or spawn — match the file's existing style)

**Interfaces:**
- Consumes: `resolveAdapterByKind` (imported in Task 5); the proposal's `adapter` and `targets[].kind`.
- Produces: apply writes the adapter's target (e.g. `AGENTS.md`) using the adapter's `renderDocument` for a new file, and a manifest with the correct `kind`.

- [ ] **Step 1: Write the failing test**

Add to `test/cli-apply.test.mjs` an end-to-end Codex apply (create then apply) using the existing helpers in that file. If the file drives the CLI via `spawnSync`, use that; otherwise call `createProposal` + `applyProposal` directly. Spawn form:

```js
test('apply writes a Codex AGENTS.md and a codex-agents-md manifest', () => {
  const targetRoot = mkdtempSync(join(tmpdir(), 'ge-codex-apply-'));
  const create = spawnSync(process.execPath, [bin, 'adopt', 'create', '--profile', 'baseline', '--adapter', 'codex'], { cwd: targetRoot, encoding: 'utf8' });
  assert.equal(create.status, 0, create.stderr);
  const proposalId = create.stdout.match(/Proposal created: (\S+)/)[1];

  // complete local decisions the same way the existing apply test does, then:
  const apply = spawnSync(process.execPath, [bin, 'adopt', 'apply', proposalId, '--confirm'], { cwd: targetRoot, encoding: 'utf8' });
  assert.equal(apply.status, 0, apply.stderr);

  const agents = readFileSync(join(targetRoot, 'AGENTS.md'), 'utf8');
  assert.match(agents, /managed by Grounded Engineering/i);
  assert.match(agents, /grounded-engineering:begin card=GE-RC-001/);
  const manifest = readFileSync(join(targetRoot, '.grounded-engineering', 'manifest.yaml'), 'utf8');
  assert.match(manifest, /kind: codex-agents-md/);
});
```

Follow the existing apply test in this file for exactly how it fills `local_decisions` before applying (the proposal requires reviewed decisions). Reuse that helper rather than reinventing it.

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/cli-apply.test.mjs`
Expected: FAIL — apply throws `Unsupported target kind: codex-agents-md`.

- [ ] **Step 3: Make `buildApplyChanges` adapter-aware**

In `src/lib/proposals.mjs`, inside `buildApplyChanges`, replace the kind guard and the new-file render:

```js
  const changes = [];
  for (const target of proposal.targets) {
    const adapter = resolveAdapterByKind(target.kind);
    if (proposal.adapter && proposal.adapter !== adapter.id) {
      throw new Error(`Proposal adapter ${proposal.adapter} does not match target kind ${target.kind}`);
    }
    const targetPath = safeRepositoryPath(root, target.path);
    const currentText = existsSync(targetPath) ? readFileSync(targetPath, 'utf8') : null;
    const currentFingerprint = currentText === null ? 'absent' : sha256Text(currentText);
    if (currentFingerprint !== target.precondition_sha256) {
      throw new Error(`Target precondition does not match for ${target.path}`);
    }

    const blocks = cards.map((card) => ({ cardId: card.id, content: renderCardContent(card) }));
    let proposedContent;
    if (currentText === null) {
      proposedContent = adapter.renderDocument(pack, cards);
    } else {
      const merged = mergeManagedBlocks(currentText, blocks, { expectedPreconditionSha256: target.precondition_sha256 });
      if (merged.conflicts.length > 0) {
        throw new Error(`Cannot apply ${target.path}: ${merged.conflicts.map((conflict) => conflict.message).join('; ')}`);
      }
      proposedContent = merged.text;
    }
    // ...unchanged: expectedFingerprint check + changes.push
```

(Delete the old `if (target.kind !== 'provider-neutral-markdown') throw ...` line and the `renderBaselineDocument(pack, cards)` call.) If `renderBaselineDocument` is now unused in `proposals.mjs`, drop it from the rendering import.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/cli-apply.test.mjs`
Expected: PASS (new Codex apply test and the existing neutral apply tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/proposals.mjs test/cli-apply.test.mjs
git commit -m "feat: resolve the adapter at apply time (GE-9)"
```

---

### Task 7: CLI `--adapter` flag, validation, and preview conflict guard

**Files:**
- Modify: `src/cli.mjs` (`parseOptions`, `validateSelection`, `reportProposal`, preview branch, `runInteractiveAdopt`, imports)
- Test: `test/cli-preview.test.mjs`

**Interfaces:**
- Consumes: `resolveAdapter` from `./lib/adapters.mjs`; `proposalConflicts` from `./lib/proposals.mjs`.
- Produces: `--adapter <id>` (default `neutral`), validated; preview/interactive fail closed on conflicts; `reportProposal` shows the adapter.

- [ ] **Step 1: Write the failing tests**

Add to `test/cli-preview.test.mjs` (`root`/`bin` helpers already exist there):

```js
test('preview --adapter codex targets AGENTS.md and writes nothing', () => {
  const targetRoot = mkdtempSync(join(tmpdir(), 'ge-codex-cli-'));
  const result = spawnSync(process.execPath, [bin, 'adopt', 'preview', '--profile', 'baseline', '--adapter', 'codex'], { cwd: targetRoot, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Adapter: codex/);
  assert.match(result.stdout, /Target: AGENTS\.md/);
  assert.equal(existsSync(join(targetRoot, 'AGENTS.md')), false);
});

test('preview --adapter codex preserves an existing AGENTS.md and only plans a managed block', () => {
  const targetRoot = mkdtempSync(join(tmpdir(), 'ge-codex-existing-'));
  writeFileSync(join(targetRoot, 'AGENTS.md'), '# My rules\n\nKeep it tidy.\n');
  const result = spawnSync(process.execPath, [bin, 'adopt', 'preview', '--profile', 'baseline', '--adapter', 'codex'], { cwd: targetRoot, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(join(targetRoot, 'AGENTS.md'), 'utf8'), '# My rules\n\nKeep it tidy.\n'); // unchanged (preview writes nothing)
});

test('preview --adapter codex fails closed when an override file governs', () => {
  const targetRoot = mkdtempSync(join(tmpdir(), 'ge-codex-cli-override-'));
  writeFileSync(join(targetRoot, 'AGENTS.override.md'), '# override\n');
  const result = spawnSync(process.execPath, [bin, 'adopt', 'preview', '--profile', 'baseline', '--adapter', 'codex'], { cwd: targetRoot, encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /override/i);
});

test('preview fails closed on a malformed managed marker', () => {
  const targetRoot = mkdtempSync(join(tmpdir(), 'ge-codex-cli-conflict-'));
  writeFileSync(join(targetRoot, 'AGENTS.md'),
    '<!-- grounded-engineering:begin card=GE-RC-001 -->\nx\n<!-- grounded-engineering:begin card=GE-RC-001 -->\n');
  const result = spawnSync(process.execPath, [bin, 'adopt', 'preview', '--profile', 'baseline', '--adapter', 'codex'], { cwd: targetRoot, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
});

test('an unknown --adapter fails closed and lists valid adapters', () => {
  const targetRoot = mkdtempSync(join(tmpdir(), 'ge-adapter-bogus-'));
  const result = spawnSync(process.execPath, [bin, 'adopt', 'preview', '--profile', 'baseline', '--adapter', 'bogus'], { cwd: targetRoot, encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Unknown adapter: bogus/);
  assert.match(result.stderr, /neutral/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/cli-preview.test.mjs`
Expected: FAIL — `--adapter` is an unknown option today.

- [ ] **Step 3: Parse and validate `--adapter`**

In `src/cli.mjs`:

1. Import: `import { resolveAdapter } from './lib/adapters.mjs';` and add `proposalConflicts` to the existing `./lib/proposals.mjs` import.
2. In `parseOptions`, extend the value-flag branch:

```js
    if (argument === '--profile' || argument === '--cards' || argument === '--adapter') {
```

(The existing body already stores `options[argument.slice(2)] = argument === '--cards' ? value.split(',').filter(Boolean) : value;`, so `--adapter x` sets `options.adapter = 'x'` and duplicate detection works.)

3. In `validateSelection`, after the existing checks:

```js
  if (options.adapter) resolveAdapter(options.adapter); // throws with the valid-id list on unknown
```

- [ ] **Step 4: Thread the adapter through and guard preview/interactive**

In `src/cli.mjs`:

1. `reportProposal` — add an adapter line after the profile line:

```js
  write(`Profile: ${proposal.profile}`);
  write(`Adapter: ${proposal.adapter}`);
```

2. `proposalOptions` (non-interactive) — add the adapter:

```js
    const proposalOptions = {
      sourceRoot,
      profile: options.profile ?? 'baseline',
      packId: options.profile ?? 'baseline',
      cardReferences: options.cards,
      adapter: options.adapter ?? 'neutral',
    };
```

3. The `preview` branch — build, guard conflicts, then report:

```js
    if (action === 'preview') {
      const proposal = buildProposal(root, proposalOptions);
      const conflicts = proposalConflicts(proposal);
      if (conflicts.length > 0) throw new Error(`Cannot generate a clean proposal: ${conflicts.map((conflict) => conflict.message).join('; ')}`);
      reportProposal(proposal, write);
      return 0;
    }
```

4. `runInteractiveAdopt` — set a default adapter and guard before offering to save:

```js
  const options = { sourceRoot, profile, packId: profile, adapter: 'neutral' };
  validateSelection(options);
  const proposal = buildProposal(root, options);
  const conflicts = proposalConflicts(proposal);
  if (conflicts.length > 0) {
    write(`Conflicts prevent a proposal: ${conflicts.map((conflict) => conflict.message).join('; ')}`);
    return 2;
  }
  reportProposal(proposal, write);
```

(`create` is already guarded inside `createProposal` from Task 5, so the non-interactive create path needs no extra CLI change.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test test/cli-preview.test.mjs`
Expected: PASS.

- [ ] **Step 6: Full gate**

Run: `npm test`
Expected: validate passes and all `node --test` files pass. Run `npm audit --audit-level=moderate` (expect 0).

- [ ] **Step 7: Commit**

```bash
git add src/cli.mjs test/cli-preview.test.mjs
git commit -m "feat: add --adapter flag with validation and preview conflict guard (GE-9)"
```

---

### Task 8: README + docs and full verification

**Files:**
- Modify: `README.md` (document `--adapter codex` under the adopt section)
- Test: `npm test` (whole suite)

- [ ] **Step 1: Document the flag**

In `README.md`, under "Adopt the baseline", add a short subsection after the install/flow blocks:

```markdown
### Provider adapters

By default `adopt` emits provider-neutral Markdown. Pass `--adapter codex` to
target an `AGENTS.md` for OpenAI Codex instead:

\`\`\`bash
grounded-engineering adopt preview --profile baseline --adapter codex
\`\`\`

The Codex adapter writes into a card-keyed managed block in `AGENTS.md`
(creating the file if absent), preserving any content you already have. If a
Codex override file governs instruction resolution, the tool reports it and
generates nothing rather than writing to a file Codex will not read.
```

(Use real backticks in the file; they are escaped here only to keep this plan's code fence intact.)

- [ ] **Step 2: Run the whole suite from a clean state**

Run: `npm test`
Expected: green. Then a manual smoke check:

```bash
node bin/grounded-engineering.mjs adopt preview --profile baseline --adapter codex
```
Expected: `Adapter: codex`, `Target: AGENTS.md`, "No repository files were changed."

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document the Codex adapter (--adapter codex) (GE-9)"
```

---

## Notes for the implementer

- The neutral adapter must remain byte-for-byte behavior-compatible: existing tests are the guardrail. If a neutral test breaks on the additive `adapter`/`conflicts` fields, update the assertion to expect them — do not change the neutral output.
- The override filename (`AGENTS.override.md`) is the documented default; confirm it against the pinned `research/sources/codex.md` (`agents_md.rs:39-46`) in Task 3 and widen `codexOverrideNames` if the source names more.
- Do not add proposal-time conflict propagation anywhere except `buildProposal` (Task 5); the CLI and `createProposal` only *read* `proposalConflicts`.
- Public repo: no agent-attribution trailers in commits.
