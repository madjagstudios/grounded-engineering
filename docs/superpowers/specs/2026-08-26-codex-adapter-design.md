# Codex Adapter Design (GE-9)

**Goal:** Let `grounded-engineering adopt` emit `AGENTS.md`-shaped output for OpenAI Codex, in addition to the existing provider-neutral Markdown, without changing the preview → create → apply → manifest contract.

**Ticket:** [GE-9](https://madjagstudios.atlassian.net/browse/GE-9), under epic GE-1.

**Related:** builds on the adoption-packs baseline slice (`docs/superpowers/specs/2026-08-26-adoption-packs-design.md`). GE-10 (Claude Code adapter) will reuse the seam introduced here.

## Motivation

Today `buildProposal` hardcodes one output: `chooseProviderNeutralTarget` picks `docs/grounded-engineering.md` (or `GROUNDED_ENGINEERING.md`) and `renderBaselineDocument` renders it. A Codex user wants that same selected guidance placed where Codex discovers it — a root `AGENTS.md` — framed as agent operating guidance. The practice content itself is provider-neutral by design; the adapter's job is **placement, discovery, and light document framing**, not rewriting guidance per vendor.

## Design principles

- Output format and target are a separate axis from card selection. `--profile` chooses cards; `--adapter` chooses output. (The design spec already treats profiles and adapters as distinct.)
- The per-card managed-block content is identical across adapters. A card (e.g. `GE-RC-001`) reads the same in the neutral doc and in `AGENTS.md`. Only the document-level preamble and the target file differ.
- Everything downstream of rendering — managed blocks, fingerprints, diff, manifest, apply — stays generic and unchanged. The adapter only supplies a target and a document renderer.
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

`buildProposal(targetRoot, options)` gains `options.adapter` (default `neutral`). It resolves the adapter from the registry and calls the adapter's `chooseTarget`/`renderDocument` where it currently calls `chooseProviderNeutralTarget`/`renderBaselineDocument`. No other change to `buildProposal`'s structure: the existing/absent-file branch, `mergeManagedBlocks`, `fingerprintTarget`, `targets[]`, and `review_metadata` all stay as they are.

### Codex target selection

`chooseCodexTarget(report)`:

- `path`: `AGENTS.md` (repository root — where Codex discovers instructions).
- `kind`: `codex-agents-md`.
- `existing`: whether `AGENTS.md` already exists (from preflight / `existsSync`).

Behavior, via the existing merge machinery:

- `AGENTS.md` exists → insert/update the card-keyed managed block inside it; bytes outside the block are preserved exactly (`mergeManagedBlocks`).
- `AGENTS.md` absent → the proposal creates it containing only the managed block(s) under the Codex preamble.
- No safe insertion point (duplicate/malformed marker, etc.) → the existing conflict path applies; v1 does not invent a separate scoped file automatically (that remains the spec's documented fallback, not implemented here).

### Rendering

- Per-card block content: unchanged. Reuse `renderCardContent`/`renderManagedBlock` exactly, so the managed block for a card is byte-identical to the neutral adapter's.
- Document preamble: a Codex-appropriate header replacing the neutral `# Grounded Engineering baseline` preamble — framing the section as agent operating guidance and noting it is managed by Grounded Engineering and edited via the tool. Card IDs and source references are preserved (they live in the block content, which is unchanged).
- `renderDocument` is only used when the target file is new; for an existing file, only the managed block is merged in, so the preamble applies to freshly created `AGENTS.md` files.

### Manifest

The applied manifest records `target.path = AGENTS.md` and `target.kind = codex-agents-md`. This is the same manifest shape as the neutral adapter, so a repository can carry both a neutral doc and a Codex adapter, each independently fingerprinted and updatable.

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
- Existing `AGENTS.md` with a malformed/duplicate GE marker → the existing conflict detection reports it; no write.
- Everything else (preflight, fingerprint precondition mismatch, apply confirmation) is unchanged from the baseline flow.

## Testing

Reuse the existing `test/` patterns (`node --test`, fixture copies, `spawnSync` for CLI).

Unit:
- `chooseCodexTarget` returns `AGENTS.md` / `codex-agents-md` / correct `existing`.
- Codex `renderDocument`: the per-card block content matches the neutral adapter's byte-for-byte; only the preamble differs.
- Adapter registry: `neutral` and `codex` resolve; an unknown id throws.

Integration (spawn):
- `adopt preview --adapter codex` on a repo with **no** `AGENTS.md` → plan targets `AGENTS.md`, lists the cards, writes nothing.
- `adopt preview --adapter codex` on a repo **with** an existing `AGENTS.md` containing unrelated content → the diff inserts the managed block and preserves the existing bytes.
- `adopt create --adapter codex` then `adopt apply <id> --confirm` → writes `AGENTS.md` and `.grounded-engineering/manifest.yaml` with `kind: codex-agents-md`; content outside the managed block preserved.
- `adopt preview --adapter bogus` → exits 2, lists valid adapters, no proposal.

## Scope guard (YAGNI)

In scope: the adapter registry seam, the `neutral` refactor-in-place, the `codex` adapter, the `--adapter` flag, and the tests above.

Out of scope (own tickets): the `claude-code` adapter (GE-10 — one registry entry once this lands), the `ai-assisted`/`custom` profiles, an interactive adapter prompt, provider-specific auto-detection, and any nested/scoped `AGENTS.md` handling beyond root.
