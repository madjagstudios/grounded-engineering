# Reviewable Adoption Packs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a trustworthy first adoption-pack release that lets a user preview, save, review, and explicitly apply a provider-neutral baseline of Grounded Engineering practices without silently changing repository policy.

**Status:** The baseline vertical slice shipped in `main` at merge commit `ccac64e` via PR #1. Remaining unchecked items are fast-follow work explicitly excluded from the first release.

**Architecture:** Add a small Node.js ESM CLI around shared card, pack, repository-inspection, proposal, managed-block, fingerprint, and manifest modules. The first vertical slice consumes the existing eight Context & Instructions cards, generates a provider-neutral Markdown proposal, uses card-keyed managed regions for safe updates, and records the applied decision in a local manifest. Existing validator logic is extracted into shared modules instead of reimplemented.

**Tech Stack:** Node.js `>=20`, ESM, existing `yaml` parser, existing AJV 2020 validator, Node built-ins (`node:fs`, `node:path`, `node:crypto`, `node:test`, `node:assert/strict`), Markdown, and YAML. Do not add a runtime dependency for argument parsing, hashing, prompting, or patch generation.

**Spec:** `docs/superpowers/specs/2026-08-26-adoption-packs-design.md`

## Global Constraints

- The first supported release is the complete `baseline` vertical slice: `preview → create → apply → manifest`.
- Canonical card identifiers are frontmatter IDs such as `GE-RC-001`; manifests, markers, fingerprints, and generated metadata never use filename slugs as the primary identity.
- `--cards` accepts either an exact frontmatter ID or an exact filename slug and resolves both to the frontmatter ID; unknown or ambiguous references fail closed.
- The first pack contains the eight Context & Instructions cards from public release `v0.2.0`: `GE-RC-001`, `GE-RC-002`, `GE-CQ-001`, `GE-CQ-002`, `GE-TS-001`, `GE-TS-002`, `GE-VF-001`, and `GE-VF-002`.
- The durable manifest excludes generation and application timestamps; timestamps belong only to proposal metadata.
- Existing files may be changed only inside a Grounded Engineering managed block; bytes outside managed blocks are preserved exactly.
- A v1 conflict is structural and deterministic: duplicate or malformed card markers, an existing managed target whose full-file precondition fingerprint changed, an existing managed block whose content fingerprint differs from the proposal, an unsafe target, or an unresolved proposal conflict. Unmarked similar prose is not semantically classified as a conflict in v1.
- The first release generates provider-neutral Markdown only. The `ai-assisted` profile, `custom` selection, Codex and Claude Code adapters, `check`, and `update propose` are fast-follow work and are not implemented in this plan.
- Preview and create do not modify canonical policy or adapter files and do not make network requests. Only explicit apply writes approved target files and the manifest.
- Applying a proposal never creates a commit, installs hooks, changes CI, changes permissions, or alters remote state.
- Preserve source links and card IDs in proposals and manifests while keeping generated guidance concise.
- Keep private repository names, paths, tracker IDs, credentials, and internal policy out of public repository content.
- Use the existing repository validator and declared checks; do not create a parallel validation mechanism when an existing function can be extracted and reused.

## Planned file structure

The implementation should keep responsibilities narrow:

- `bin/grounded-engineering.mjs` — executable entrypoint and exit-code handling.
- `src/lib/frontmatter.mjs` — shared practice frontmatter parsing.
- `src/lib/repository-walk.mjs` — shared repository traversal used by the validator and CLI.
- `src/lib/cards.mjs` — practice-card loading, slug/ID resolution, and canonical card records.
- `src/lib/packs.mjs` — pack loading and pack-to-card validation.
- `src/lib/preflight.mjs` — read-only repository inspection and target selection.
- `src/lib/managed-blocks.mjs` — marker parsing, rendering, replacement, and structural conflict detection.
- `src/lib/fingerprints.mjs` — SHA-256 file and normalized-block fingerprints.
- `src/lib/proposals.mjs` — proposal IDs, proposal serialization, diff rendering, and proposal loading.
- `src/lib/manifest.mjs` — durable manifest construction and validation.
- `src/cli.mjs` — command dispatch and interactive/non-interactive orchestration.
- `packs/schema.yaml` — pack contract.
- `packs/baseline.yaml` — the first versioned baseline pack.
- `packs/manifest-schema.yaml` — local adoption-manifest contract.
- `test/` — Node test-runner tests and repository fixtures.
- `scripts/validate.mjs` — import shared loaders and validate pack/manifest contracts without duplicating frontmatter or traversal logic.
- `package.json` — expose the CLI through `bin` and add test scripts only where they remain thin wrappers around the existing validator.
- `README.md`, `practices/README.md`, and `integrations/agents-md/README.md` — document the supported baseline adoption path and its boundaries.

The first release should not add provider-specific integration files, a hosted service, a database, or a second practice-card source of truth.

---

### Task 1: Extract reusable repository and frontmatter primitives

**Files:**
- Create: `src/lib/repository-walk.mjs`
- Create: `src/lib/frontmatter.mjs`
- Modify: `scripts/validate.mjs`
- Test: `test/frontmatter.test.mjs`
- Test: `test/repository-walk.test.mjs`

**Interfaces:**
- `walkRepository(root, options = {}) -> string[]` returns absolute file paths in stable lexical order and skips `.git`, `node_modules`, `coverage`, and `dist`.
- `parsePracticeFrontmatter(filePath, text) -> { record, body, frontmatterEndLine }` throws a descriptive error for a missing delimiter, unclosed frontmatter, or invalid YAML.
- The validator imports these functions and preserves its current error wording and public-content checks.

- [ ] **Step 1: Write failing tests for the extracted primitives.**

  Add fixtures containing one valid practice card, one file without frontmatter, one file with unclosed frontmatter, and ignored directories. Assert that stable ordering is returned, ignored directories are absent, and parse errors include the relative path.

- [ ] **Step 2: Run the focused tests and verify they fail.**

  Run:

  ```bash
  node --test test/frontmatter.test.mjs test/repository-walk.test.mjs
  ```

  Expected: FAIL because the shared modules do not exist yet.

- [ ] **Step 3: Move the existing logic into the shared modules.**

  Extract the behavior of `walk` and `parseFrontmatter` from `scripts/validate.mjs` without changing their semantics. Keep path display and error accumulation in the validator; the shared functions should return values or throw typed errors rather than write to global validator state.

- [ ] **Step 4: Update the validator to use the shared functions and run focused tests.**

  Run:

  ```bash
  node --test test/frontmatter.test.mjs test/repository-walk.test.mjs
  npm test
  ```

  Expected: all focused tests pass and the existing Grounded Engineering validator still reports its normal success message.

- [ ] **Step 5: Commit the reusable primitives.**

  ```bash
  git add src/lib/repository-walk.mjs src/lib/frontmatter.mjs scripts/validate.mjs test/frontmatter.test.mjs test/repository-walk.test.mjs
  git commit -m "refactor: share repository and frontmatter loading"
  ```

### Task 2: Define pack, card-resolution, and manifest contracts

**Files:**
- Create: `packs/schema.yaml`
- Create: `packs/manifest-schema.yaml`
- Create: `packs/baseline.yaml`
- Create: `src/lib/cards.mjs`
- Create: `src/lib/packs.mjs`
- Create: `src/lib/manifest.mjs`
- Create: `test/cards-and-packs.test.mjs`
- Create: `test/manifest-contract.test.mjs`
- Modify: `scripts/validate.mjs`

**Interfaces:**
- `loadPracticeCards(root) -> { byId: Map, bySlug: Map }` loads every practice card and rejects duplicate frontmatter IDs or duplicate filename slugs.
- `resolveCardReference(reference, cardIndex) -> CardRecord` accepts an exact `GE-*` frontmatter ID or an exact filename slug and returns a record whose canonical `id` is the frontmatter ID.
- `loadPack(root, packId) -> PackRecord` parses and validates a pack, resolves every listed card, and rejects a pack whose release/schema metadata or card IDs are inconsistent.
- `buildManifest(input) -> ManifestRecord` constructs a timestamp-free durable manifest with `schema_version`, public dispositions, separate local decisions, applicability status, source references, target fingerprints, and validation status.
- `validateManifest(manifest) -> { valid, errors }` validates the local manifest against `packs/manifest-schema.yaml` using the existing AJV dependency.

- [ ] **Step 1: Write the pack and manifest contract tests.**

  Assert that `GE-RC-001` and `inspect-repository-first` resolve to the same card, that a bad slug and bad ID fail, and that the baseline pack resolves exactly these eight canonical IDs:

  ```text
  GE-RC-001 GE-RC-002 GE-CQ-001 GE-CQ-002
  GE-TS-001 GE-TS-002 GE-VF-001 GE-VF-002
  ```

  Assert that a valid manifest contains `schema_version: 1.0.0`, `public_disposition` from the public card, `local_decision` from `[ACCEPT, ADAPT, DECLINE, DEFER]`, and `local_applicability` from `[APPLICABLE, NOT_APPLICABLE, NEEDS_REVIEW]`. Assert that `NOT_APPLICABLE` carries no local decision and that `DEFER` requires `revisit_trigger`.

- [ ] **Step 2: Run the focused tests and verify they fail.**

  ```bash
  node --test test/cards-and-packs.test.mjs test/manifest-contract.test.mjs
  ```

  Expected: FAIL because the pack files, loaders, and manifest schema do not exist.

- [ ] **Step 3: Add the versioned pack contracts and baseline pack.**

  Set `packs/baseline.yaml` to `pack_id: baseline`, `pack_version: 1.0.0`, `schema_version: 1.0.0`, `grounded_engineering_release: v0.2.0`, and the eight card IDs above. Include the intended audience, provider-neutral Markdown output, and the minimum CLI/release constraint. Keep card evidence in the cards and source register; the pack contains selections and rendering policy only.

  Define the manifest schema so timestamps are not valid durable properties. Require target entries to contain a relative path, target kind, full-file precondition fingerprint, and normalized managed-block fingerprint.

- [ ] **Step 4: Implement canonical card, pack, and manifest loading.**

  Use the shared frontmatter loader from Task 1. Resolve slug input only as an ergonomic alias; serialize frontmatter IDs everywhere else. Validate pack card references against the loaded cards and validate public dispositions against the source card rather than trusting pack duplication. Use the existing AJV/YAML dependencies.

- [ ] **Step 5: Extend the repository validator and run the focused suite.**

  Make `scripts/validate.mjs` validate `packs/schema.yaml`, `packs/manifest-schema.yaml`, and `packs/baseline.yaml`. Run:

  ```bash
  node --test test/cards-and-packs.test.mjs test/manifest-contract.test.mjs
  npm test
  ```

  Expected: focused tests pass and the repository validator confirms the baseline pack and manifest contract.

- [ ] **Step 6: Commit the contracts and baseline pack.**

  ```bash
  git add packs src/lib/cards.mjs src/lib/packs.mjs src/lib/manifest.mjs scripts/validate.mjs test/cards-and-packs.test.mjs test/manifest-contract.test.mjs
  git commit -m "feat: define baseline adoption pack contracts"
  ```

### Task 3: Implement read-only preflight and baseline rendering

**Files:**
- Create: `src/lib/preflight.mjs`
- Create: `src/lib/rendering.mjs`
- Create: `test/preflight.test.mjs`
- Create: `test/rendering.test.mjs`
- Create: `test/fixtures/clean-repository/README.md`
- Create: `test/fixtures/existing-policy/docs/engineering.md`
- Create: `test/fixtures/existing-policy/AGENTS.md`

**Interfaces:**
- `inspectRepository(root) -> PreflightReport` reports root, detected project markers, instruction files, policy files, hooks, CI files, declared commands, existing manifest/proposal paths, and candidate target paths without writing or networking.
- `chooseProviderNeutralTarget(report) -> { path, reason, existing }` selects `docs/grounded-engineering.md` when `docs/` exists, otherwise `GROUNDED_ENGINEERING.md`; an existing selected target is handled by managed-block logic in Task 4.
- `renderBaselineDocument(pack, cards) -> string` renders concise provider-neutral Markdown using each card title, `agent_snippet`, and human-facing boundary/body; it does not copy research history or source prose.
- `renderReviewMetadata(pack, cards, preflight) -> string` renders a proposal-readable explanation containing canonical IDs, dispositions, applicability, evidence level, and source links.

- [ ] **Step 1: Write preflight and rendering tests.**

  Assert that preflight identifies `AGENTS.md`, an existing human policy document, CI configuration, and the absence of a Grounded Engineering manifest in the existing-policy fixture. Assert that target selection is deterministic and that rendered Markdown contains each baseline card ID only in review metadata/markers, not copied source documents.

- [ ] **Step 2: Run the focused tests and verify they fail.**

  ```bash
  node --test test/preflight.test.mjs test/rendering.test.mjs
  ```

  Expected: FAIL because preflight and rendering modules do not exist.

- [ ] **Step 3: Implement read-only repository inspection.**

  Inspect only the repository root and bounded known paths. Detect instruction files by exact names (`AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md` and matching instruction files already documented by the repository), policy documents under `docs/`, hook directories, CI workflow files, and package-manager manifests. Read declared scripts from `package.json` when present. Do not execute repository commands during preflight.

- [ ] **Step 4: Implement baseline target selection and concise rendering.**

  Generate one provider-neutral Markdown target. Use a stable heading per card and leave marker insertion to Task 4. Include the card's concise instruction and boundary, but keep evidence links and disposition detail in proposal review metadata rather than the model-facing guidance section.

- [ ] **Step 5: Run focused tests and the validator.**

  ```bash
  node --test test/preflight.test.mjs test/rendering.test.mjs
  npm test
  ```

  Expected: all tests pass and no fixture is modified.

- [ ] **Step 6: Commit preflight and rendering.**

  ```bash
  git add src/lib/preflight.mjs src/lib/rendering.mjs test/preflight.test.mjs test/rendering.test.mjs test/fixtures
  git commit -m "feat: add adoption preflight and baseline rendering"
  ```

### Task 4: Add managed blocks, exact conflict rules, and fingerprints

**Files:**
- Create: `src/lib/managed-blocks.mjs`
- Create: `src/lib/fingerprints.mjs`
- Create: `test/managed-blocks.test.mjs`
- Create: `test/fingerprints.test.mjs`
- Create: `test/fixtures/managed-policy/docs/grounded-engineering.md`
- Create: `test/fixtures/conflicting-policy/docs/grounded-engineering.md`
- Create: `test/fixtures/modified-target/docs/grounded-engineering.md`

**Interfaces:**
- `renderManagedBlock(cardId, content) -> string` returns Markdown markers using `grounded-engineering:begin card=<frontmatter-id>` and `grounded-engineering:end card=<frontmatter-id>`.
- `parseManagedBlocks(text) -> ManagedBlock[]` returns card ID, byte offsets, raw content, and normalized content; it rejects duplicate IDs, missing end markers, mismatched IDs, and nested blocks.
- `mergeManagedBlocks(existingText, proposedBlocks, options) -> { text, conflicts }` appends new blocks or replaces only existing matching blocks; it never changes bytes outside owned blocks.
- `sha256Text(text) -> string` returns lowercase hexadecimal SHA-256.
- `fingerprintTarget(path, text, proposedBlocks) -> TargetFingerprint` records `precondition_sha256`, `managed_block_sha256`, and `absent` for a missing target.

- [ ] **Step 1: Write the marker and fingerprint tests.**

  Cover these exact cases:

  - New target receives one block per selected card.
  - Existing unrelated text remains byte-for-byte unchanged when a block is appended.
  - Existing matching block is replaced only between its markers.
  - Duplicate card marker, missing end marker, nested marker, and mismatched end marker produce a structural conflict.
  - An existing target with a changed full-file precondition fingerprint produces a stale-target conflict.
  - A managed block whose content fingerprint differs from the proposal produces a managed-block conflict.
  - Unmarked similar prose does not produce a v1 semantic conflict.

- [ ] **Step 2: Run focused tests and verify they fail.**

  ```bash
  node --test test/managed-blocks.test.mjs test/fingerprints.test.mjs
  ```

  Expected: FAIL because marker and fingerprint modules do not exist.

- [ ] **Step 3: Implement Markdown managed-region parsing and rendering.**

  Use the exact marker grammar:

  ```text
  <!-- grounded-engineering:begin card=GE-RC-001 -->
  Generated guidance.
  <!-- grounded-engineering:end card=GE-RC-001 -->
  ```

  Permit one block per card ID, preserve newline style when replacing, and reject malformed structure before any write. Keep syntax-specific marker selection out of this first release; Markdown-compatible output is the only supported target.

- [ ] **Step 4: Implement bounded merge and SHA-256 fingerprints.**

  For a new target, fingerprint the `absent` sentinel before generation. For an existing target, capture the full file hash at proposal creation. At apply time, require the full file hash to match before changing anything. After merge, compute the normalized hash for each owned block and store it for the manifest.

- [ ] **Step 5: Run focused tests and inspect fixture diffs.**

  ```bash
  node --test test/managed-blocks.test.mjs test/fingerprints.test.mjs
  git diff --check
  ```

  Expected: all tests pass; fixture comparisons show no changed bytes outside managed blocks.

- [ ] **Step 6: Commit managed regions and fingerprints.**

  ```bash
  git add src/lib/managed-blocks.mjs src/lib/fingerprints.mjs test/managed-blocks.test.mjs test/fingerprints.test.mjs test/fixtures/managed-policy test/fixtures/conflicting-policy test/fixtures/modified-target
  git commit -m "feat: protect adoption output with managed blocks"
  ```

### Task 5: Implement proposal lifecycle and CLI command grammar

**Files:**
- Create: `src/lib/proposals.mjs`
- Create: `src/cli.mjs`
- Create: `bin/grounded-engineering.mjs`
- Create: `test/proposals.test.mjs`
- Create: `test/cli-preview.test.mjs`
- Modify: `package.json`

**Interfaces:**
- `createProposalId(now, randomBytes) -> string` returns `YYYYMMDD-HHMMSS-<8-hex>` in UTC.
- `createProposal(root, options) -> ProposalRecord` writes `.grounded-engineering/proposals/<proposal-id>/` only when the explicit `create` action is used.
- `loadProposal(root, proposalId) -> ProposalRecord` accepts only IDs matching the defined format and resolves only inside the repository's proposal directory.
- `renderProposalDiff(preflight, proposedTargets) -> string` produces a stable unified diff or equivalent file-by-file diff with no timestamps.
- CLI actions are exactly:
  - bare `grounded-engineering adopt` — interactive selection and preview, with an optional explicit save prompt;
  - `grounded-engineering adopt preview --profile baseline` — read-only non-interactive preview;
  - `grounded-engineering adopt preview --cards GE-RC-001,inspect-repository-first` — read-only selection preview accepting IDs or slugs;
  - `grounded-engineering adopt create --profile baseline` — persist proposal artifacts, never canonical policy;
  - `grounded-engineering adopt apply 20260826-143000-a1b2c3d4 --confirm` — apply one saved proposal;
  - `grounded-engineering check` and `grounded-engineering update propose` are reserved fast-follow commands and return a documented not-supported exit code in this release.

  `--cards` is intentionally preview-only in this release. Create and apply accept the versioned `baseline` pack until custom pack proposal and apply semantics are implemented.

- [ ] **Step 1: Write proposal and CLI contract tests.**

  Assert that proposal IDs match the exact UTC format, proposal paths cannot escape `.grounded-engineering/proposals`, preview leaves the fixture tree unchanged, `create` writes only proposal artifacts, unknown options fail with usage text, and `apply` without `--confirm` is rejected in non-interactive mode.

- [ ] **Step 2: Run focused tests and verify they fail.**

  ```bash
  node --test test/proposals.test.mjs test/cli-preview.test.mjs
  ```

  Expected: FAIL because the proposal and CLI modules do not exist.

- [ ] **Step 3: Implement proposal serialization and deterministic IDs.**

  Save these files under `.grounded-engineering/proposals/<proposal-id>/`:

  ```text
  proposal.yaml       # pack, schema, card refs, target preconditions, timestamps
  plan.md             # human-readable review plan and evidence links
  diff.patch          # proposed target changes
  validation.json     # deterministic validation result
  ```

  Proposal metadata may contain `created_at` and `updated_at`; the durable manifest produced after apply must not inherit those timestamps.

- [ ] **Step 4: Implement the command parser and read-only preview/create actions.**

  Use `process.argv` and a small explicit parser. Reject unknown flags, missing values, duplicate profile/card selectors, and card references that cannot resolve. Ensure preview performs no file writes by running the orchestration against an in-memory or temporary output directory. `create` persists only the proposal directory and leaves all canonical target files untouched.

- [ ] **Step 5: Expose the executable and run CLI tests.**

  Add this `package.json` shape without adding a dependency:

  ```json
  {
    "bin": {
      "grounded-engineering": "./bin/grounded-engineering.mjs"
    }
  }
  ```

  Run:

  ```bash
  node --test test/proposals.test.mjs test/cli-preview.test.mjs
  node bin/grounded-engineering.mjs adopt preview --profile baseline --help
  ```

  Expected: tests pass and help describes only the supported commands and reserved fast-follow commands.

- [ ] **Step 6: Commit the proposal lifecycle and CLI.**

  ```bash
  git add src/lib/proposals.mjs src/cli.mjs bin/grounded-engineering.mjs test/proposals.test.mjs test/cli-preview.test.mjs package.json
  git commit -m "feat: add reviewable adoption proposal workflow"
  ```

### Task 6: Implement explicit apply and durable manifest recording

**Files:**
- Modify: `src/cli.mjs`
- Modify: `src/lib/proposals.mjs`
- Modify: `src/lib/manifest.mjs`
- Create: `test/cli-apply.test.mjs`
- Create: `test/fixtures/apply-clean/README.md`
- Create: `test/fixtures/apply-existing/docs/grounded-engineering.md`
- Create: `test/fixtures/apply-dirty/docs/grounded-engineering.md`

**Interfaces:**
- `applyProposal(root, proposalId, options) -> ApplyResult` rechecks all preconditions, validates the pack/schema/proposal, obtains explicit local decisions, merges only managed blocks, writes approved targets and the manifest, and returns changed paths plus fingerprints.
- `collectLocalDecisions(cards, input) -> LocalDecisionRecord[]` requires `local_applicability`; requires a local decision when applicability is `APPLICABLE`; rejects `NEEDS_REVIEW` at apply time; requires `revisit_trigger` when local decision is `DEFER`.
- `writeApplyTransaction(root, changes) -> { committedPaths }` verifies every change in memory before writing, writes through temporary files, and restores the original target set if a write/rename fails.

- [ ] **Step 1: Write apply and manifest tests.**

  Cover:

  - interactive apply lists every file and requires confirmation;
  - non-interactive apply without `--confirm` fails;
  - changed full-file precondition fails before any write;
  - malformed or duplicate markers fail before any write;
  - applying to a new target creates the target and manifest;
  - applying to an existing target preserves every byte outside managed blocks;
  - local `DEFER` without `revisit_trigger` fails;
  - `NOT_APPLICABLE` has no local decision;
  - the manifest contains no timestamp fields;
  - the manifest contains release, pack, schema, public disposition, local outcome, applicability, source references, and target fingerprints.

- [ ] **Step 2: Run focused tests and verify they fail.**

  ```bash
  node --test test/cli-apply.test.mjs
  ```

  Expected: FAIL because apply orchestration and transaction writing are not implemented.

- [ ] **Step 3: Implement local decision collection and apply preflight.**

  Interactive apply must display a table containing card ID, title, public disposition, and the requested local decision for every selected card, followed by a file list. Non-interactive apply must receive equivalent decisions from the saved proposal's reviewed decision data and require `--confirm`; reject missing or contradictory decisions rather than assuming that public `ADOPT` means local acceptance.

- [ ] **Step 4: Implement atomic apply around managed-region merge.**

  Load the proposal, validate its exact release/schema/pack, compare every target's recorded full-file precondition, parse markers, calculate proposed output in memory, and refuse all writes if any target fails. For existing files, replace only matching managed blocks or append a new managed block at the approved end-of-file insertion point. For new files, create the complete provider-neutral document. Write the manifest only after all target contents pass validation.

- [ ] **Step 5: Record the durable manifest.**

  Build `.grounded-engineering/manifest.yaml` with:

  ```yaml
  schema_version: 1.0.0
  grounded_engineering_release: v0.2.0
  pack_id: baseline
  pack_version: 1.0.0
  cards:
    - id: GE-RC-001
      public_disposition: ADOPT
      local_applicability: APPLICABLE
      local_decision: ACCEPT
  targets:
    - path: docs/grounded-engineering.md
      precondition_sha256: absent
      managed_block_sha256: 0000000000000000000000000000000000000000000000000000000000000000
  validation:
    status: validated
  ```

  The zero hash above is only a shape example; the implementation must serialize the actual computed 64-character lowercase SHA-256 value. The manifest records no generation/application timestamp.

- [ ] **Step 6: Run apply tests and inspect exact diffs.**

  ```bash
  node --test test/cli-apply.test.mjs
  npm test
  git diff --check
  ```

  Expected: all tests pass; dirty/conflict fixtures show no partial writes; clean fixtures contain only approved target files and manifest.

- [ ] **Step 7: Commit explicit apply and manifest recording.**

  ```bash
  git add src/cli.mjs src/lib/proposals.mjs src/lib/manifest.mjs test/cli-apply.test.mjs test/fixtures/apply-clean test/fixtures/apply-existing test/fixtures/apply-dirty
  git commit -m "feat: apply reviewed adoption proposals safely"
  ```

### Task 7: Add end-to-end quality fixtures, documentation, and release validation

**Files:**
- Create: `test/e2e-adoption.test.mjs`
- Create: `test/fixtures/e2e-clean/package.json`
- Create: `test/fixtures/e2e-existing/AGENTS.md`
- Create: `test/fixtures/e2e-existing/docs/engineering.md`
- Create: `test/fixtures/e2e-conflict/docs/grounded-engineering.md`
- Modify: `scripts/validate.mjs`
- Modify: `README.md`
- Modify: `practices/README.md`
- Modify: `integrations/agents-md/README.md`
- Modify: `package.json`

**Interfaces:**
- The end-to-end test invokes the real CLI entrypoint for `preview`, `create`, and `apply`, then compares fixture snapshots and validates the resulting manifest.
- The documentation describes the baseline profile, canonical card ID/slug behavior, proposal directory, managed markers, explicit apply, manifest provenance, and the unsupported fast-follow commands.

- [ ] **Step 1: Write the end-to-end acceptance test.**

  Exercise one clean repository from start to finish:

  ```text
  adopt preview --profile baseline
  adopt create --profile baseline
  adopt apply 20260826-143000-a1b2c3d4 --confirm
  ```

  The walkthrough uses a concrete example ID; the test captures the actual generated proposal ID rather than using a fixed timestamp. Assert that preview leaves the fixture unchanged, create adds only proposal artifacts, apply adds the provider-neutral target plus manifest, and a second generation from the same card/pack/repository inputs produces no meaningless target-content churn.

- [ ] **Step 2: Add existing-policy and conflict acceptance cases.**

  Assert that an existing `AGENTS.md` and human policy document are inspected but not overwritten, that a separate provider-neutral target is generated, that unrelated target bytes remain unchanged, and that a changed target precondition fails closed with no partial writes.

- [ ] **Step 3: Run the full quality suite and public-content checks.**

  ```bash
  npm test
  npm audit --audit-level=moderate
  git diff --check
  ```

  Expected: repository validation passes, including the existing public-content checks; the audit reports no moderate-or-higher vulnerability; and the diff check is clean. If the validator finds an intended public token, revise the content or narrow the validator with an evidence-backed reason.

- [ ] **Step 4: Document the supported UX and boundaries.**

  Add a concise “Adoption” section to `README.md` with the command flow and a link to the design spec. Update `practices/README.md` to explain that the baseline pack selects eight Context & Instructions cards. Update the repository-instruction integration page to explain that generated output is a reviewed adapter/proposal and that provenance stays in the manifest/proposal metadata. Extend `package.json` so the full suite runs both validation and Node tests:

  ```json
  {
    "scripts": {
      "validate": "node scripts/validate.mjs",
      "test:unit": "node --test test/*.test.mjs",
      "test": "npm run validate && npm run test:unit"
    }
  }
  ```

- [ ] **Step 5: Run the release walkthrough from a clean fixture.**

  Run the exact commands documented in `README.md` from a temporary copy of `test/fixtures/e2e-clean`, inspect the proposal plan and diff, apply with explicit confirmation, and compare the final tree against the expected snapshot. Record the command output in the GE-7 work record, not in public repository content.

- [ ] **Step 6: Commit the end-to-end validation and documentation.**

  ```bash
  git add test/e2e-adoption.test.mjs test/fixtures/e2e-clean test/fixtures/e2e-existing test/fixtures/e2e-conflict scripts/validate.mjs README.md practices/README.md integrations/agents-md/README.md package.json
  git commit -m "docs: release the baseline adoption workflow"
  ```

## Fast-follow work intentionally excluded

The following work is not part of this implementation plan and must not be pulled into the first release by implication:

- `ai-assisted` profile and custom card selection;
- Codex and Claude Code provider adapters;
- syntax-specific managed blocks beyond Markdown;
- `grounded-engineering check` drift reporting as a completed command;
- `grounded-engineering update propose` and release fetching;
- hosted UI, remote repository analysis, telemetry, or automatic commits;
- automatic installation of hooks, CI checks, permissions, or approval workflows.

These capabilities can reuse the contracts established here. They require separate tests and release notes after the baseline path has been exercised.

## Final verification checklist

- [ ] `npm test` passes from a clean checkout.
- [ ] `npm audit --audit-level=moderate` passes with no moderate-or-higher findings.
- [ ] `preview` performs no repository writes and no network requests.
- [ ] `create` writes only `.grounded-engineering/proposals/<proposal-id>/`.
- [ ] `apply` requires explicit confirmation and fails closed on stale or malformed targets.
- [ ] Existing file bytes outside managed blocks are preserved exactly.
- [ ] Markers and manifests use frontmatter IDs; slug input is only an alias.
- [ ] Durable manifests contain schema/release/pack metadata, separate public disposition and local decision fields, applicability status, source references, and fingerprints without timestamps.
- [ ] The first release covers only the baseline provider-neutral vertical slice.
- [ ] Public README and integration guidance explain the workflow without copying research history into agent context.
- [ ] No implementation is claimed for fast-follow commands.
