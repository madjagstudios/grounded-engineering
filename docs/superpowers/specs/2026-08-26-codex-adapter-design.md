# Codex Adapter Design (GE-9)

**Goal:** Let `grounded-engineering adopt` emit `AGENTS.md`-shaped output for OpenAI Codex, in addition to the existing provider-neutral Markdown, reusing the preview → create → apply → manifest flow. The external flow is preserved; the internal changes are: a `--adapter` axis with a small registry, two apply changes (a kind allowlist and adapter-driven new-file rendering), proposal-time conflict surfacing in `preview`/`create`, and a one-line manifest-schema widening of the `kind` field — all specified below.

**Ticket:** [GE-9](https://madjagstudios.atlassian.net/browse/GE-9), under epic GE-1.

**Related:** builds on the adoption-packs baseline slice (`docs/superpowers/specs/2026-08-26-adoption-packs-design.md`). GE-10 (Claude Code adapter) will reuse the seam introduced here.

## Motivation

Today `buildProposal` hardcodes one output: `chooseProviderNeutralTarget` picks `docs/grounded-engineering.md` (or `GROUNDED_ENGINEERING.md`) and `renderBaselineDocument` renders it. A Codex user wants that same selected guidance placed where Codex discovers it — a root `AGENTS.md` — framed as agent operating guidance. The practice content itself is provider-neutral by design; the adapter's job is **placement, discovery, and light document framing**, not rewriting guidance per vendor.

## Design principles

- Output format and target are a separate axis from card selection. `--profile` chooses cards; `--adapter` chooses output. (The design spec already treats profiles and adapters as distinct.)
- The per-card managed-block content is identical across adapters. A card (e.g. `GE-RC-001`) reads the same in the neutral doc and in `AGENTS.md`. Only the document-level preamble and the target file differ.
- Everything downstream of rendering — managed blocks, fingerprints, diff — stays generic and unchanged. Apply needs two narrow, explicit changes (kind allowlist and adapter-driven new-file rendering), specified below; it is not "unchanged."
- Fail closed on an unknown adapter. Preview and create never write; only explicit `apply --confirm` writes.

## Architecture

### Adapter registry (the new seam)

Introduce a small registry, one entry per adapter:

```
adapter = {
  id,                              // stable identifier used in flags and manifests
  chooseTarget(preflight) -> { path, kind, existing },
  renderDocument(pack, cards) -> string   // full-file content when the target is new
}
```

Registered adapters:

- `neutral` — the current behavior, refactored in place: `chooseTarget` wraps `chooseProviderNeutralTarget` (kind `provider-neutral-markdown`); `renderDocument` is `renderBaselineDocument`.
- `codex` — new: `chooseTarget` returns root `AGENTS.md` (kind `codex-agents-md`); `renderDocument` renders the same card blocks under a Codex-appropriate preamble.

`buildProposal(targetRoot, options)` gains `options.adapter` (default `neutral`). It resolves the adapter from the registry and calls the adapter's `chooseTarget`/`renderDocument` where it currently calls `chooseProviderNeutralTarget`/`renderBaselineDocument`. The `targets[].kind` is taken from `chooseTarget` rather than hardcoded. The proposal object also records the selected adapter id in a new `adapter` field, so apply can resolve the same adapter deterministically instead of inferring it. `fingerprintTarget` and `review_metadata` are otherwise unchanged.

The existing-file branch also stops discarding conflicts (see Conflict surfacing below): it captures `mergeManagedBlocks(...).conflicts` and threads them onto the target.

### Codex target selection

`chooseCodexTarget(report)`:

- `path`: `AGENTS.md` (repository root — where Codex discovers instructions).
- `kind`: `codex-agents-md`.
- `existing`: whether `AGENTS.md` already exists (from preflight / `existsSync`).

Behavior, via the existing merge machinery:

- `AGENTS.md` exists → insert/update the card-keyed managed block inside it; bytes outside the block are preserved exactly (`mergeManagedBlocks`).
- `AGENTS.md` absent → the proposal creates it containing only the managed block(s) under the Codex preamble.
- No safe insertion point (duplicate/malformed marker) → detected at **apply** time and fails closed (see Error handling); v1 does not invent a separate scoped file automatically.

**Override-file guard (Codex effective-instruction resolution).** The pinned Codex source (`CODEX-AGENTS-IMPLEMENTATION`, `agents_md.rs:39-46`) documents a default/override filename pair: when the override file (`AGENTS.override.md`) is present it supersedes `AGENTS.md`, so writing guidance to `AGENTS.md` would land it in a file Codex does not read. The Codex adapter must not silently write to a non-effective file. Preflight detects the override filename(s) named in that pinned source; if an override file is present in the repository, `chooseCodexTarget` **fails closed** — it emits no Codex target and the CLI explains that an override file governs Codex instruction resolution, so no provider-specific file was generated (mirroring the spec's "unsupported adapter → explain, don't guess" posture). Automatically targeting the override file is deliberately out of scope for v1; the exact candidate names are read from the pinned `agents_md.rs:39-46` during implementation rather than assumed.

### Rendering

- Per-card block content: unchanged. Reuse `renderCardContent`/`renderManagedBlock` exactly, so the managed block for a card is byte-identical to the neutral adapter's.
- Document preamble: a Codex-appropriate header replacing the neutral `# Grounded Engineering baseline` preamble — framing the section as agent operating guidance and noting it is managed by Grounded Engineering and edited via the tool.
- Provenance is unchanged from the neutral adapter and lives exactly where it does today: **card IDs** appear in the managed-block markers (`renderManagedBlock` keys on `card.id`); **source references** are *not* in the rendered block content (`renderCardContent` emits title/pattern/agent_snippet/boundary only) — they are carried in the proposal's `review_metadata` and in the applied manifest's `source_refs`. The Codex adapter changes none of this.
- `renderDocument` is only used when the target file is new; for an existing file, only the managed block is merged in, so the preamble applies to freshly created `AGENTS.md` files.

### Apply (adapter resolution) — required changes

`buildApplyChanges` re-derives and re-fingerprints target content independently of the stored proposal (a deliberate safety property), so it currently hardcodes the neutral path in two places that must change:

1. **Kind allowlist.** Today: `if (target.kind !== 'provider-neutral-markdown') throw 'Unsupported target kind'` (`proposals.mjs:256`). Replace the single-value check with a lookup against the adapter registry keyed by kind: resolve the adapter whose `kind` matches `target.kind`, and fail closed (unchanged error shape) if none matches. This admits `codex-agents-md` without loosening the guard for unknown kinds.

2. **New-file rendering.** Today the absent-file branch always calls `renderBaselineDocument(pack, cards)` (`proposals.mjs:267`). Change it to call the resolved adapter's `renderDocument(pack, cards)`, so a newly created `AGENTS.md` gets the Codex preamble. The existing-file branch (`mergeManagedBlocks`) is already adapter-agnostic — the block content is identical across adapters — and needs no change.

Adapter resolution uses the proposal's persisted `adapter` id, cross-checked against `target.kind` (they must agree, or apply fails closed): this keeps apply from guessing and catches a proposal whose `adapter` and `kind` were tampered with. The precondition-fingerprint, managed-block-fingerprint, confirmation, and manifest-write steps are otherwise unchanged. This path is covered by a new end-to-end Codex apply test (see Testing).

### Conflict surfacing (proposal time)

Today `buildProposal` calls `mergeManagedBlocks(existingText, blocks).text` and discards `.conflicts` (`proposals.mjs:107`), so a structural marker conflict (duplicate/malformed GE marker, stale full-file precondition) is invisible until apply. GE-9 closes this so the conflict is reported when it is first knowable.

- `buildProposal` captures `merged.conflicts` in the existing-file branch and attaches them to the target as `conflicts: [{ code, message }, ...]` (empty array when clean; absent/empty for the new-file branch, which cannot conflict).
- A proposal is "conflicted" if any target has a non-empty `conflicts`.
- `preview` prints the conflict codes/messages and returns a non-zero exit; it still performs no writes (read-only is preserved).
- `create` refuses to save a conflicted proposal — it prints the conflicts and exits non-zero, writing nothing under `.grounded-engineering/proposals/`.
- `apply` keeps its own conflict re-check (`proposals.mjs:272-273`) as defense in depth — proposal-time detection is the early signal, not a replacement for the apply-time gate.

This is a shared improvement to `buildProposal`, so it applies to the neutral adapter as well as `codex`; existing clean-fixture tests are unaffected. It removes the "known limitation" that an earlier draft of this spec carried.

### Manifest

The applied manifest records `target.path = AGENTS.md` and `target.kind = codex-agents-md`, in the same manifest shape as the neutral adapter.

**One applied adapter per repository in v1.** `buildApplyChanges` refuses to run when a `.grounded-engineering/manifest.yaml` already exists (`"update is reserved for a later release"`). That guard is unchanged here, so a repository can hold exactly one applied manifest: a user applies *either* the neutral doc *or* the Codex adapter, and a second apply of a different adapter is blocked until the update flow (GE-11 / GE-12) lands. Carrying both adapters simultaneously, and updating either independently, is explicitly out of scope for GE-9 and is not claimed. (The manifest's `targets[]` is an array, so the future update flow can extend to multiple targets without a shape change — but v1 writes a single-target manifest and blocks re-apply.)

One concrete schema change is required: `packs/manifest-schema.yaml` currently pins the target kind with `kind: { const: provider-neutral-markdown }` (line ~95). Change that `const` to `enum: [provider-neutral-markdown, codex-agents-md]` so an applied Codex manifest validates. This is the only schema edit; no other field changes. (The repository validator's own manifest checks run through this same schema.)

## CLI surface

```
grounded-engineering adopt preview --profile baseline --adapter codex
grounded-engineering adopt create  --profile baseline --adapter codex
grounded-engineering adopt apply <proposal-id> --confirm
```

- New flag `--adapter <id>`, default `neutral`. Valid ids: `neutral`, `codex`.
- Unknown adapter fails closed with a message listing valid ids (exit code 2, consistent with existing option errors).
- Orthogonal to `--profile` (which stays gated to `baseline`) and to `--cards` (which stays preview-only). `--adapter` composes with either.
- Interactive `adopt` (no args) stays neutral-default in this release; an interactive adapter prompt is deliberately deferred (YAGNI). The flag-driven path is the supported way to select an adapter.

## Error handling

- Unknown `--adapter` value → fail closed, list valid ids, exit 2. No proposal created.
- Codex override file present (`AGENTS.override.md`) → `chooseCodexTarget` fails closed; the CLI explains that an override governs Codex resolution and no provider-specific file was generated. No target, no write.
- Existing `.grounded-engineering/manifest.yaml` at apply → the existing guard throws (`"update is reserved for a later release"`), unchanged. This is why only one adapter can be applied per repo in v1.
- Existing `AGENTS.md` with a malformed/duplicate GE marker → surfaced at **proposal** time (`preview`/`create` report it and exit non-zero, no write — see Conflict surfacing) and re-checked at **apply** as defense in depth (`proposals.mjs:272-273`). AGENTS.md being a user-owned file makes this more likely to occur here than with the tool-owned neutral doc, which is the motivation for closing the earlier gap.
- Everything else (preflight, fingerprint precondition mismatch, apply confirmation) is unchanged from the baseline flow.

## Testing

Reuse the existing `test/` patterns (`node --test`, fixture copies, `spawnSync` for CLI).

Unit:
- `chooseCodexTarget` returns `AGENTS.md` / `codex-agents-md` / correct `existing`; and fails closed (no target) when an override file is present.
- Codex `renderDocument`: the per-card block content matches the neutral adapter's byte-for-byte; only the preamble differs.
- Adapter registry: `neutral` and `codex` resolve by id and by kind; an unknown id and an unknown kind both throw.

Integration (spawn):
- `adopt preview --adapter codex` on a repo with **no** `AGENTS.md` → plan targets `AGENTS.md`, lists the cards, writes nothing.
- `adopt preview --adapter codex` on a repo **with** an existing `AGENTS.md` containing unrelated content → the diff inserts the managed block and preserves the existing bytes.
- `adopt preview --adapter codex` on a repo **with** an override file (`AGENTS.override.md`) present → fails closed, explains the override governs, no target, no write.
- `adopt create --adapter codex` then `adopt apply <id> --confirm` → writes `AGENTS.md` (with the Codex preamble) and `.grounded-engineering/manifest.yaml` with `kind: codex-agents-md`; content outside the managed block preserved. This exercises the apply kind-allowlist and adapter-`renderDocument` changes end to end.
- `adopt preview --adapter codex` (and `create`) on a repo whose `AGENTS.md` has a **duplicate/malformed GE marker** → the conflict is reported and the command exits non-zero; `preview` writes nothing and `create` saves no proposal. (Proposal-time conflict surfacing; also add the neutral-adapter equivalent so the shared `buildProposal` change is covered.)
- `adopt preview --adapter bogus` → exits 2, lists valid adapters, no proposal.

## Scope guard (YAGNI)

In scope: the adapter registry seam, the `neutral` refactor-in-place, the `codex` adapter (including the override-file guard), the `--adapter` flag, the two apply changes (kind allowlist, adapter `renderDocument`), **proposal-time conflict surfacing** (capture `mergeManagedBlocks` conflicts in `buildProposal`; `preview`/`create` report and fail closed), the `manifest-schema.yaml` `const → enum` edit, and the tests above.

Out of scope (own tickets / follow-ups):
- the `claude-code` adapter (GE-10 — one registry entry once this lands);
- multi-adapter coexistence and independent update (blocked by the single-manifest guard; belongs with GE-11 `check` / GE-12 `update propose`);
- automatically targeting the Codex override file rather than failing closed;
- the `ai-assisted`/`custom` profiles, an interactive adapter prompt, and any nested/scoped `AGENTS.md` handling beyond root.
