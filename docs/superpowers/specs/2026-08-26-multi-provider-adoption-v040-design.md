# Multi-provider adoption release (v0.4.0)

Status: proposed after approval of the v0.4.0 launch bundle.
Date: 2026-08-26
Related work: Codex adapter and adoption-packs baseline workflow.

## Summary

Grounded Engineering v0.4.0 will turn the shipped adoption workflow into a
coherent, multi-provider release. It adds a Claude Code adapter, exposes an
`ai-assisted` adoption profile containing all thirteen current practice cards,
and completes the first post-application lifecycle command with read-only
drift checking.

The release remains local-first and reviewable. It does not silently edit
policy, import or overwrite other providers' files, install hooks, or claim
that generated guidance is deterministic enforcement. A repository still has
one applied Grounded Engineering manifest in v0.4.0; users choose one output
adapter per adoption. Applying Codex and Claude targets together is deferred
until the manifest and proposal model explicitly support multi-target apply.

## User outcome

A team using either Codex or Claude Code can select the complete AI-assisted
practice set, review a proposal, apply it explicitly, and later verify that the
managed guidance has not drifted:

```text
Choose the ai-assisted profile
        ↓
Choose neutral Markdown, Codex, or Claude Code output
        ↓
Preview the target and evidence metadata
        ↓
Create and review a proposal
        ↓
Apply only after explicit local decisions and confirmation
        ↓
Run check later to detect stale or edited managed guidance
```

Supported examples:

```bash
npx grounded-engineering adopt preview --profile ai-assisted --adapter claude
grounded-engineering adopt create --profile ai-assisted --adapter codex
grounded-engineering adopt apply <proposal-id> --confirm
grounded-engineering check
```

The released npm package and GitHub release will be v0.4.0. The current
v0.3.0 package remains unchanged until this release is published.

## Goals

- Add a tested Claude Code adapter through the existing adapter registry.
- Make the complete thirteen-card AI-assisted catalog selectable and
  applicable through the existing proposal contract.
- Make `check` useful in local and CI workflows without network access or
  writes.
- Preserve the existing preview, create, apply, manifest, managed-block,
  provenance, and explicit-approval contracts.
- Publish documentation and package metadata that describe the actual v0.4.0
  surface.

## Non-goals

- Applying multiple provider adapters in one proposal or repository manifest.
- Automatically importing `AGENTS.md` into `CLAUDE.md`, creating symlinks, or
  modifying `.claude/` rules.
- Supporting `custom` selection for create/apply.
- Implementing `update propose` or fetching release content.
- Adding more providers, language-specific targets, hooks, CI enforcement, or
  a hosted service.
- Treating an instruction file as a deterministic control.

## Claude Code adapter

### Target and discovery

The adapter registry gains:

```text
id: claude
kind: claude-md
target: CLAUDE.md
```

The target is the repository-root `CLAUDE.md`. Claude Code documents
`CLAUDE.md` as the project instruction file and separately supports
`.claude/CLAUDE.md`, nested files, `CLAUDE.local.md`, and path-scoped rules.
This release chooses the root target only so the adapter has one bounded,
reviewable write surface. A repository whose Claude instructions currently
live in `.claude/CLAUDE.md` will therefore receive a second, root-level
managed file; v0.4.0 reports that situation but does not silently relocate or
merge the existing instructions. The pinned source is the official Claude
Code memory documentation: https://code.claude.com/docs/en/memory.

The adapter must:

- report whether root `CLAUDE.md` exists;
- preserve all bytes outside Grounded Engineering card-keyed managed blocks;
- fail closed on malformed, duplicate, nested, or mismatched managed markers;
- use the existing full-file precondition and managed-block fingerprints;
- create no target during preview or create;
- require the same explicit local decisions and `--confirm` as other adapters.

The preflight report may identify `.claude/CLAUDE.md`, nested `CLAUDE.md`, and
`CLAUDE.local.md` files as context, but v0.4.0 does not modify them. The
implementation must extend the current instruction-name set to include
`CLAUDE.local.md`; the existing relative paths keep root, `.claude/`, and
nested files distinguishable in the flat report. A detected `AGENTS.md` is
reported as an existing provider surface; the Claude adapter does not
automatically import or rewrite it. This avoids silently changing provider
precedence and keeps shared guidance a local review decision.

### Rendering

The Claude document has a short Claude-appropriate preamble stating that the
following practices are managed by Grounded Engineering. The per-card content
and marker format are byte-identical to the neutral and Codex adapters. Source
references remain in proposal review metadata and the applied manifest, not in
the model-facing block.

The renderer must not copy vendor prompts, research history, or auto-memory
content into `CLAUDE.md`.

### Apply semantics

The manifest schema gains the `claude-md` target kind. Apply resolves the
persisted adapter and target kind together, refusing a mismatch. The existing
one-manifest guard remains unchanged; a second adapter application is rejected
with the existing update-reserved message.

## AI-assisted profile

Add `packs/ai-assisted.yaml` as a versioned adoption pack with the thirteen
canonical cards currently in `practices/`:

- the eight baseline Context & Instructions cards;
- the five Agent & Skill Design cards.

The profile uses the existing provider-neutral target strategy. The selected
adapter controls placement and document framing. `loadPack` already resolves a
pack by ID, so the implementation should extend profile validation and pack
validation rather than introduce a second card-selection mechanism.

The existing baseline pack's `grounded_engineering_release: v0.2.0` and
`pack_version: 1.0.0` remain unchanged. This preserves compatibility for
repositories that adopted the baseline before v0.4.0: the v0.4.0 CLI still
bundles the same historical baseline pack, so `check` can remain green without
`update propose` or destructive manifest deletion. The new AI-assisted pack is
born at v0.4.0 with its own explicit release metadata. Pack and manifest
versions remain explicit and schema-validated. Public card dispositions remain
separate from consuming repository local decisions.

Custom `--cards` selection remains preview-only in this release.

## Read-only drift checking

Implement the currently reserved `grounded-engineering check` command. It
reads the target repository's `.grounded-engineering/manifest.yaml` and target
files from the current working directory, while loading the selected pack and
practice cards from the `sourceRoot` bundled with the installed CLI. It never
looks for a pack inside the target repository, fetches sources, writes files,
creates proposals, or changes the manifest.

The check must validate:

1. The manifest exists and passes the manifest schema.
2. The manifest release, pack ID, pack version, and schema version match the
   locally available pack and schema.
3. Every manifest card exists in the selected pack and retains its recorded
   public disposition and source references.
4. Every manifest target exists, has a supported target kind, and has valid
   managed-marker structure.
5. Every selected card has exactly the expected managed block content for the
   current local pack, using normalized marker-inclusive fingerprints.
6. A target's unmanaged prose may differ from the original file; v0.4.0 does
   not attempt semantic conflict detection outside managed blocks.

The command returns exit code `0` only when all checks pass. Drift, a missing
manifest, an invalid manifest, an unavailable pack, a missing target, or a
managed-block mismatch returns exit code `1` and names the failed lane.
Malformed `check` options or other invocation errors return exit code `2`,
matching the CLI's existing usage-error convention. The human-readable output
reports a concise status and actionable diagnostics; it does not claim that a
clean managed block proves the repository's broader policy is correct.

`precondition_sha256` is not a drift signal. It records the target file before
apply (or `absent`), so the current file is expected to differ after a
successful apply. Drift checking instead parses the current managed markers,
renders the expected card content from the CLI-bundled pack, and compares each
selected block—or an equivalent normalized aggregate—to the manifest's
expected managed-block fingerprint.

## Components and data flow

### Adapter components

- `src/lib/adapters.mjs` registers `claude` and resolves it by ID and target
  kind.
- `src/lib/preflight.mjs` chooses root `CLAUDE.md` and reports nearby Claude
  instruction surfaces without writing them. Its instruction-name set must
  include `CLAUDE.local.md`; relative paths remain visible so root,
  `.claude/`, and nested files can be distinguished in the flat report.
- `src/lib/rendering.mjs` renders the Claude preamble while reusing the shared
  card block renderer.
- `packs/manifest-schema.yaml` allows `claude-md`.

### Profile components

- `packs/ai-assisted.yaml` defines the thirteen-card profile.
- `src/cli.mjs` accepts `--profile ai-assisted` for preview and create.
- Existing pack/card loading and proposal serialization remain the source of
  truth.

### Check components

- `src/lib/check.mjs` or an equivalently focused module performs read-only
  manifest, pack, target, and managed-block checks.
- `src/cli.mjs` splits `check` out of the current reserved-command guard,
  routes it to the checker, and keeps `update` reserved.
- The checker reuses manifest validation, card loading, adapter-kind
  resolution, marker parsing, and fingerprint helpers rather than duplicating
  marker grammar. `fingerprintTarget` can provide the expected normalized
  aggregate, but extraction with `parseManagedBlocks` and comparison against
  rendered card content is still required to detect edits in the current file.

## Error handling and safety

- Unknown profile, adapter, target kind, or malformed option fails closed with
  usage text and no writes.
- Claude marker conflicts fail before proposal creation or application.
- A stale target or changed proposal content remains rejected by the existing
  apply preconditions.
- `check` treats missing or invalid evidence as a failed check, not as zero
  drift or success.
- No command in this release installs dependencies, changes CI, creates a
  commit, or performs network access as part of adoption or checking.

## Testing and acceptance

The release is ready only when all of the following are true:

- Adapter registry tests resolve neutral, Codex, and Claude entries.
- Claude renderer tests prove the card block is byte-identical to the other
  adapters and the preamble is Claude-specific.
- Claude preflight and CLI tests cover new `CLAUDE.md`, existing-file merge,
  preservation outside managed blocks, and malformed markers.
- Manifest tests accept `claude-md` and reject unknown kinds.
- AI-assisted pack validation proves all thirteen canonical IDs and stable
  preview/create/apply behavior.
- Check tests cover clean state, missing manifest, invalid manifest, missing
  target, changed managed block, malformed markers, changed card metadata, and
  unchanged unmanaged prose.
- `npm test` passes, including repository validation and the full unit/e2e
  suite.
- `npm audit --omit=dev --audit-level=moderate` passes with no findings.
- The package version, README, changelog, release notes, new AI-assisted pack
  metadata, and command help consistently describe v0.4.0; the historical
  baseline pack metadata remains explicitly v0.2.0 for adopter compatibility.
- A clean fixture or public example demonstrates the complete flow for both
  `--adapter codex` and `--adapter claude`, while clearly showing that a
  repository chooses one adapter in v0.4.0.

## Deferred follow-up

The next larger lifecycle release can add multi-target proposals and manifests,
then make Codex and Claude adapters installable together. After that, `update
propose` can use the manifest and check contracts to compare an explicitly
selected newer pack. Custom card selection and further provider adapters should
reuse the same proposal, provenance, and approval boundaries.
