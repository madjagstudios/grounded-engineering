# Multi-provider adoption v0.4.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a v0.4.0 release that adds a Claude Code adapter, makes all thirteen practices available through an `ai-assisted` profile, and provides read-only managed-guidance drift checking without breaking existing baseline adopters.

**Architecture:** Extend the existing adapter registry and proposal pipeline with a root `CLAUDE.md` target while preserving shared card blocks, managed markers, preconditions, provenance, and explicit apply. Add `ai-assisted` as a second versioned pack while leaving the historical baseline pack at `v0.2.0`. Implement `check` as a read-only command that validates the manifest against the pack bundled with the installed CLI and compares parsed target blocks against the manifest's stored managed-block fingerprint.

**Tech Stack:** Node.js >=20 ESM, `node:test`, `node:assert/strict`, YAML, AJV 2020, existing SHA-256 and managed-block helpers. No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-08-26-multi-provider-adoption-v040-design.md`

## Global Constraints

- Preserve the existing preview -> create -> apply -> manifest contract.
- Preview and create remain repository-write-free; only explicit `apply --confirm` writes targets and the manifest.
- The existing baseline pack keeps `grounded_engineering_release: v0.2.0` and `pack_version: 1.0.0`.
- The new `ai-assisted` pack is released with `grounded_engineering_release: v0.4.0` and `pack_version: 1.0.0`.
- The v0.4.0 manifest still supports one applied adapter per repository; do not implement multi-target application.
- Claude v0.4.0 writes only the repository-root `CLAUDE.md`; it does not write `.claude/CLAUDE.md`, nested `CLAUDE.md`, `CLAUDE.local.md`, or `.claude/rules/`.
- `check` loads packs and practice cards from the CLI's `sourceRoot`, not from the target repository.
- `check` returns `0` when clean, `1` for drift or repository-state mismatch, and `2` for invocation errors.
- `check` uses the manifest's stored `managed_block_sha256` as the canonical expected target state; `precondition_sha256` is never used as a drift signal.
- Use the existing marker grammar and SHA-256 normalization; do not create a second managed-block implementation.
- Keep `custom --cards` preview-only and keep `update propose` reserved.
- Do not copy vendor prompt files, full research documents, private repository names, private paths, tracker IDs, credentials, PII, or internal endpoints into public content.
- This is a public repository: future commits must contain no `Co-Authored-By:` or generated-with/by agent trailers. The local commit hook is enforcement only and must not be vendored or documented in the public tree.
- Preserve the existing MIT license and verify dependency licenses remain compatible.
- No new public CI gate is added for agent attribution before the first outside contribution; the local hook plus publication scans remain the standing layer.
- Keep publication evidence separate from product/test evidence: source validation, package/release state, and remote publication scans must be reported as distinct lanes.

---

### Task 1: Add the versioned AI-assisted pack and supported profile

**Files:**
- Create: `packs/ai-assisted.yaml`
- Modify: `src/cli.mjs`
- Modify: `scripts/validate.mjs`
- Test: `test/cards-and-packs.test.mjs`
- Test: `test/cli-preview.test.mjs`

**Interfaces:**
- `loadPack(root, 'ai-assisted') -> pack` returns the thirteen canonical cards in stable card-ID order.
- `validateSelection(options)` accepts `baseline` and `ai-assisted`, while rejecting other profiles as reserved.
- `adopt preview --profile ai-assisted` and `adopt create --profile ai-assisted` use the existing proposal pipeline.

- [ ] **Step 1: Write the failing pack and CLI tests**

Add a pack test that loads `ai-assisted` and asserts its metadata and exact card IDs:

```js
test('loads the ai-assisted pack with all thirteen canonical cards', () => {
  const pack = loadPack(root, 'ai-assisted');
  assert.equal(pack.pack_id, 'ai-assisted');
  assert.equal(pack.pack_version, '1.0.0');
  assert.equal(pack.grounded_engineering_release, 'v0.4.0');
  assert.deepEqual(pack.cards.map((card) => card.id), [
    'GE-RC-001', 'GE-RC-002', 'GE-CQ-001', 'GE-CQ-002',
    'GE-TS-001', 'GE-TS-002', 'GE-VF-001', 'GE-VF-002',
    'GE-AS-001', 'GE-AS-002', 'GE-AS-003', 'GE-AS-004', 'GE-AS-005'
  ]);
});
```

Add CLI coverage that previews `--profile ai-assisted` successfully and that
`create --profile ai-assisted` saves a proposal instead of treating the
profile as reserved.

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```bash
node --test test/cards-and-packs.test.mjs test/cli-preview.test.mjs
```

Expected: the pack file is missing and the CLI rejects the profile as reserved.

- [ ] **Step 3: Add the pack and widen profile validation**

Create `packs/ai-assisted.yaml` using the existing adoption-pack schema:

```yaml
record_type: adoption_pack
pack_id: ai-assisted
pack_version: 1.0.0
schema_version: 1.0.0
grounded_engineering_release: v0.4.0
min_cli_version: 0.4.0
title: AI-assisted engineering baseline
description: Source-backed guidance for repositories that use coding agents and want explicit context, capability, testing, and verification practices.
target:
  kind: provider-neutral-markdown
  path_strategy: docs-or-root-grounded-engineering
card_ids:
  - GE-RC-001
  - GE-RC-002
  - GE-CQ-001
  - GE-CQ-002
  - GE-TS-001
  - GE-TS-002
  - GE-VF-001
  - GE-VF-002
  - GE-AS-001
  - GE-AS-002
  - GE-AS-003
  - GE-AS-004
  - GE-AS-005
```

Change the profile guard in `src/cli.mjs` to allow exactly `baseline` and
`ai-assisted`; keep arbitrary profile IDs rejected with the existing reserved
message. Make `scripts/validate.mjs` load and validate both packs. Do not edit
`packs/baseline.yaml` release or pack metadata.

- [ ] **Step 4: Run focused tests and the repository validator**

Run:

```bash
node --test test/cards-and-packs.test.mjs test/cli-preview.test.mjs
npm run validate
```

Expected: both packs validate, the baseline still reports `v0.2.0`, and the
AI-assisted preview/create path is accepted.

- [ ] **Step 5: Commit the pack slice**

```bash
git add packs/ai-assisted.yaml src/cli.mjs scripts/validate.mjs test/cards-and-packs.test.mjs test/cli-preview.test.mjs
git commit -m "feat: add the ai-assisted adoption profile"
```

---

### Task 2: Add the Claude Code adapter and preflight surface reporting

**Files:**
- Modify: `src/lib/adapters.mjs`
- Modify: `src/lib/preflight.mjs`
- Modify: `src/lib/rendering.mjs`
- Modify: `packs/manifest-schema.yaml`
- Test: `test/adapters.test.mjs`
- Test: `test/preflight.test.mjs`
- Test: `test/rendering.test.mjs`
- Test: `test/manifest-contract.test.mjs`
- Test: `test/cli-preview.test.mjs`
- Test: `test/cli-apply.test.mjs`

**Interfaces:**
- `chooseClaudeTarget(report) -> { path: 'CLAUDE.md', existing: boolean }`.
- `renderClaudeDocument(pack, cards) -> string`.
- `resolveAdapter('claude') -> { id: 'claude', kind: 'claude-md', chooseTarget, renderDocument }`.
- `resolveAdapterByKind('claude-md') -> claudeAdapter`.

- [ ] **Step 1: Write the failing adapter, renderer, preflight, schema, and CLI tests**

Extend the registry test:

```js
test('registry exposes neutral, codex, and Claude adapters', () => {
  assert.deepEqual(adapterIds().sort(), ['claude', 'codex', 'neutral']);
  assert.equal(resolveAdapter('claude').kind, 'claude-md');
  assert.equal(resolveAdapterByKind('claude-md').id, 'claude');
});
```

Add renderer coverage proving the Claude output contains the same
`renderManagedBlock(card.id, renderCardContent(card))` as the neutral and Codex
documents, while its preamble names Claude guidance. Add preflight coverage for
root `CLAUDE.md`, `.claude/CLAUDE.md`, nested `CLAUDE.md`, and
`CLAUDE.local.md`; assert that relative paths make the locations distinguishable.
Add CLI preview/apply coverage for a new root `CLAUDE.md`, an existing file, and
preservation of unmanaged bytes. Add a manifest test accepting `claude-md` and
rejecting another unknown kind.

- [ ] **Step 2: Run focused tests and verify they fail**

Run:

```bash
node --test test/adapters.test.mjs test/preflight.test.mjs test/rendering.test.mjs test/manifest-contract.test.mjs test/cli-preview.test.mjs test/cli-apply.test.mjs
```

Expected: Claude registry, renderer, target, manifest kind, and CLI tests fail
because the adapter and target kind do not exist.

- [ ] **Step 3: Implement the Claude adapter seam**

In `src/lib/preflight.mjs`, add `CLAUDE.local.md` to the instruction-name set
and implement root-only target selection:

```js
export function chooseClaudeTarget(report) {
  const path = 'CLAUDE.md';
  return { path, existing: existsSync(join(report.root, path)) };
}
```

In `src/lib/rendering.mjs`, add a Claude-specific preamble and reuse the
existing private card renderer so managed blocks remain byte-identical:

```js
export function renderClaudeDocument(pack, cards) {
  return [
    '# Claude Code guidance (Grounded Engineering)',
    '',
    'The following practices are managed by Grounded Engineering. Edit them with the `grounded-engineering` CLI, not by hand.',
    '',
    cards.map(renderCard).join('\n\n'),
    '',
  ].join('\n');
}
```

Register the adapter in `src/lib/adapters.mjs`, widen the target-kind enum in
`packs/manifest-schema.yaml`, and rely on the existing proposal/apply adapter
resolution. Do not add automatic `@AGENTS.md` imports or modify `.claude/`
files. Keep `AGENTS.md` detection as report metadata only.

- [ ] **Step 4: Run the focused tests and full unit suite**

Run:

```bash
node --test test/adapters.test.mjs test/preflight.test.mjs test/rendering.test.mjs test/manifest-contract.test.mjs test/cli-preview.test.mjs test/cli-apply.test.mjs
npm test
```

Expected: Claude preview/create/apply uses `CLAUDE.md`, managed blocks are
preserved, and all existing neutral/Codex tests remain green.

- [ ] **Step 5: Commit the Claude adapter slice**

```bash
git add src/lib/adapters.mjs src/lib/preflight.mjs src/lib/rendering.mjs packs/manifest-schema.yaml test/adapters.test.mjs test/preflight.test.mjs test/rendering.test.mjs test/manifest-contract.test.mjs test/cli-preview.test.mjs test/cli-apply.test.mjs
git commit -m "feat: add Claude Code adoption adapter"
```

---

### Task 3: Implement canonical manifest-fingerprint drift checking

**Files:**
- Create: `src/lib/check.mjs`
- Modify: `src/lib/fingerprints.mjs`
- Test: `test/check.test.mjs`
- Test: `test/fingerprints.test.mjs`

**Interfaces:**
- `fingerprintManagedBlocks(blocks) -> string` hashes normalized marker-inclusive blocks in the supplied order, where each block is `{ cardId, content }`.
- `checkRepository(targetRoot, { sourceRoot }) -> { ok: boolean, diagnostics: Array<{ code: string, message: string }> }`.
- `checkRepository` reads the manifest and targets from `targetRoot`; it loads packs/cards/schema from `sourceRoot`.

- [ ] **Step 1: Write failing fingerprint and checker tests**

Add a fingerprint test that hashes parsed blocks in manifest card order and
proves the result is stable across CRLF versus LF content. Add checker tests
using an applied fixture that cover:

```js
test('reports a clean applied repository', () => {
  const result = checkRepository(targetRoot, { sourceRoot: root });
  assert.deepEqual(result, { ok: true, diagnostics: [] });
});

test('uses the manifest managed-block fingerprint as the expected target state', () => {
  const alternateSourceRoot = mkdtempSync(join(tmpdir(), 'ge-check-source-'));
  cpSync(root, alternateSourceRoot, { recursive: true });
  const cardPath = join(alternateSourceRoot, 'practices', 'repository-context', 'inspect-repository-first.md');
  const cardText = readFileSync(cardPath, 'utf8');
  writeFileSync(cardPath, cardText.replace(
    'agent_snippet: Before editing, inspect applicable instructions, repository status, structure, declared commands, and affected paths.',
    'agent_snippet: Use a deliberately different local rendering for this test.'
  ));
  const result = checkRepository(targetRoot, { sourceRoot: alternateSourceRoot });
  assert.equal(result.ok, true);
});
```

Also cover missing manifest, invalid manifest, unavailable pack, release/pack
metadata mismatch, missing target, malformed markers, missing/extra managed
blocks, changed managed block, changed card metadata/source references, and
unmanaged prose edits. Assert that none of these checks writes to the target
repository.

- [ ] **Step 2: Run checker tests and verify they fail**

Run:

```bash
node --test test/check.test.mjs test/fingerprints.test.mjs
```

Expected: `src/lib/check.mjs` and the parsed-block fingerprint helper are not
available yet.

- [ ] **Step 3: Implement parsed-block hashing and checker diagnostics**

Add `fingerprintManagedBlocks` to `src/lib/fingerprints.mjs` using
`normalizeManagedContent(renderManagedBlock(...))` and `sha256Text`. Keep
`fingerprintTarget` unchanged for proposal/apply preconditions.

Implement `checkRepository` with this order:

1. Read `.grounded-engineering/manifest.yaml` from `targetRoot`; return code
   `MISSING_MANIFEST` in diagnostics when absent.
2. Validate the parsed manifest against the manifest schema loaded from
   `sourceRoot`.
3. Load `manifest.pack_id` with `loadPack(sourceRoot, manifest.pack_id)` and
   require exact schema version, pack ID, pack version, and release metadata
   matches.
4. For every manifest card, resolve the current bundled card by canonical ID
   and compare the recorded public disposition and source references.
5. For every manifest target, resolve its adapter by kind, read the target from
   `targetRoot`, and parse it with `parseManagedBlocks`.
6. Require the parsed managed-card ID set to equal the manifest card ID set.
   Reorder parsed blocks by manifest card order, normalize their marker-inclusive
   content, compute `fingerprintManagedBlocks`, and compare it to the target's
   stored `managed_block_sha256`.

Do not compare the current file to `precondition_sha256`; that hash represents
the file before apply and must differ after a successful new-file apply. Do not
compare unmanaged prose against `before_content` or infer semantic policy
conflicts.

- [ ] **Step 4: Run checker tests and confirm read-only behavior**

Run:

```bash
node --test test/check.test.mjs test/fingerprints.test.mjs
npm test
```

Expected: clean manifests return `ok: true`; all listed drift/state failures
return diagnostics without changing any fixture files.

- [ ] **Step 5: Commit the checker slice**

```bash
git add src/lib/check.mjs src/lib/fingerprints.mjs test/check.test.mjs test/fingerprints.test.mjs
git commit -m "feat: add manifest-backed adoption drift checks"
```

---

### Task 4: Wire `check` into the CLI and prove the end-to-end lifecycle

**Files:**
- Modify: `src/cli.mjs`
- Test: `test/cli-preview.test.mjs`
- Test: `test/e2e-adoption.test.mjs`
- Test: `test/cli-apply.test.mjs`

**Interfaces:**
- `grounded-engineering check` invokes `checkRepository(process.cwd(), { sourceRoot: repositoryRoot })`.
- Exit `0` is emitted only for a clean result; every checker diagnostic emits a concise message and returns `1`.
- `check --unknown` and other malformed invocations return `2`; `update` remains the reserved command with exit `2`.

- [ ] **Step 1: Write failing CLI and e2e tests**

Add tests that:

- apply a reviewed baseline proposal, run `check`, and assert exit `0` plus a
  concise clean status;
- apply a reviewed AI-assisted Claude proposal, run `check`, and assert exit
  `0` with `CLAUDE.md` as the target;
- edit only unmanaged prose and assert `check` remains clean;
- edit a managed block and assert exit `1` with the target/card diagnostic;
- remove the target or manifest and assert exit `1`;
- run `check --wat` and assert exit `2` with usage text;
- run `update` and assert it still returns the reserved-command response.

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```bash
node --test test/cli-preview.test.mjs test/e2e-adoption.test.mjs test/cli-apply.test.mjs
```

Expected: `check` is still caught by the reserved-command guard and returns
`2`, and the AI-assisted Claude end-to-end path is not yet wired.

- [ ] **Step 3: Split the CLI command routing**

In `src/cli.mjs`, route `check` before the existing `update` reserved guard:

```js
if (argv[0] === 'check') {
  try {
    const options = parseCheckOptions(argv.slice(1));
    if (options.help) {
      printCheckHelp(write);
      return 0;
    }
    const result = checkRepository(root, { sourceRoot });
    for (const diagnostic of result.diagnostics) error(`${diagnostic.code}: ${diagnostic.message}`);
    if (!result.ok) return 1;
    write('Status: clean');
    return 0;
  } catch (caught) {
    error(caught.message);
    printCheckHelp(error);
    return 2;
  }
}
if (argv[0] === 'update') {
  error('update is a reserved fast-follow command in this release.');
  return 2;
}
```

Keep check option parsing separate from adoption options so `--confirm`,
`--adapter`, and `--profile` are rejected by `check`. Import
`checkRepository`; do not duplicate checker logic in the CLI.

- [ ] **Step 4: Run focused, full, and smoke verification**

Run:

```bash
node --test test/cli-preview.test.mjs test/e2e-adoption.test.mjs test/cli-apply.test.mjs
npm test
npm audit --omit=dev --audit-level=moderate
node bin/grounded-engineering.mjs adopt preview --profile ai-assisted --adapter claude
```

Expected: the full suite is green, the audit reports no moderate-or-higher
findings, and the smoke command reports an `ai-assisted` Claude preview without
writing repository files.

- [ ] **Step 5: Commit the CLI lifecycle slice**

```bash
git add src/cli.mjs test/cli-preview.test.mjs test/e2e-adoption.test.mjs test/cli-apply.test.mjs
git commit -m "feat: expose adoption drift checks in the CLI"
```

---

### Task 5: Update release metadata, public documentation, and examples

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `integrations/claude-code/README.md`
- Modify: `integrations/codex/README.md`
- Modify: `practices/README.md`
- Test: `test/cli-preview.test.mjs`

**Interfaces:**
- Package version is `0.4.0` in both `package.json` and the root lockfile package entry.
- README commands and help describe `--profile ai-assisted`, `--adapter claude`, and `check` accurately.
- Changelog v0.4.0 distinguishes the new AI-assisted pack from the unchanged historical baseline pack.

- [ ] **Step 1: Write documentation/release assertions**

Add a CLI help test that checks for the v0.4.0-supported commands and profiles.
Add validator-facing content checks for the README examples:

```text
npx grounded-engineering adopt preview --profile ai-assisted --adapter claude
grounded-engineering check
```

The documentation test must also assert that the public baseline compatibility
note contains `v0.2.0` and that the new profile is not described as rewriting
existing policy.

- [ ] **Step 2: Update the public surface after behavior is settled**

Change package and lockfile versions to `0.4.0`. Add a `CHANGELOG.md` v0.4.0
section covering the Claude adapter, AI-assisted profile, and check command;
state that baseline pack metadata remains `v0.2.0` for existing adopters.

Rewrite the README status paragraph from v0.2.0 to the actual release state.
Document the three adapter choices, root `CLAUDE.md` behavior, the one-adapter
v0.4.0 limitation, and the `check` exit contract. Include one concise
before/after example showing preview, explicit review/apply, and later drift
checking. Add a plain provenance line that the project is built and maintained
with AI agents in real engineering workflows; do not add agent trailers or
machine-generated branding.

Update the Claude and Codex integration guides with the actual target files,
managed-block boundary, evidence/provenance separation, and provider-specific
limitations. Keep all examples generic and free of local paths, private project
names, and copied vendor prompt text. Update the practices overview to describe
the thirteen-card AI-assisted pack.

- [ ] **Step 3: Run documentation and package checks**

Run:

```bash
npm test
npm pack --dry-run
node bin/grounded-engineering.mjs --help
node bin/grounded-engineering.mjs check --help
```

Expected: the package dry run contains `packs/ai-assisted.yaml` and the Claude
adapter source, help text describes v0.4.0 capabilities, and repository
validation reports no private paths, tracker IDs, temporary markers, or broken
links.

- [ ] **Step 4: Inspect the public surface for scope and provenance**

Read `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`, all research source records,
and the changed README/integration docs as a stranger. Confirm MIT licensing,
link-first vendor attribution, no large copied vendor material, no secrets or
PII in fixtures, and no private endpoints or internal identifiers. Confirm the
only named vendor products are nominative references to the providers the
adapters support.

- [ ] **Step 5: Commit release documentation**

```bash
git add package.json package-lock.json README.md CHANGELOG.md integrations/claude-code/README.md integrations/codex/README.md practices/README.md test/cli-preview.test.mjs
git commit -m "docs: prepare Grounded Engineering v0.4.0"
```

---

### Task 6: Run public-release clearance and final release verification

**Files:**
- Review only: `.git/hooks/commit-msg` (local, never committed)
- Review only: `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`, `README.md`, `CHANGELOG.md`
- External evidence record: `docs/publications/grounded-engineering-v040-manifest.md` in the private source repository when the release publication record is created

**Interfaces:**
- Public scans inspect the exact staged tree and the remote rendered tree, not only the working tree.
- Publication evidence is redacted and recorded outside the public repository; raw scanner output is never copied into the public tree.
- Release publication remains a separate owner authorization after all local gates pass.

- [ ] **Step 1: Confirm public-repo standing protections**

From the repository root, confirm the local commit hook is executable and
rejects an agent-attribution trailer in a temporary commit-message file. Do not
copy the hook into the repository, add `.githooks/`, or document its internal
path in public content. Review recent commits for `Co-Authored-By:` and
generated-with/by lines; remediate any new finding before release.

- [ ] **Step 2: Run final source, staged, and commit scans**

Use an explicit allowlist maintained in the private source-repository
publication record, then run the fail-closed scans against the exact tree being
released. Resolve the private scanner checkout through the local environment;
do not commit that path or the allowlist into this public repository:

```bash
STUDIO_OPS_DIR="${MADJAG_STUDIO_OPS:?set the private studio operations checkout}"
PUBLIC_REPO_DIR="$(git rev-parse --show-toplevel)"
PUBLIC_ALLOWLIST="${PUBLIC_ALLOWLIST:?set the private publication allowlist}"
node "$STUDIO_OPS_DIR/tools/publish-scan/publish-scan.mjs" files --repo "$PUBLIC_REPO_DIR" --allowlist "$PUBLIC_ALLOWLIST" --staged --fail-closed
node "$STUDIO_OPS_DIR/tools/publish-scan/publish-scan.mjs" commits --repo "$PUBLIC_REPO_DIR" --fail-closed
```

The allowlist must include only the intended public repository files. Secrets,
PII, and ownership findings stop the release and cannot receive an exception.
License, third-party attribution, dependency licensing, telemetry/endpoints,
and trademark findings require a pass or a written approved exception in the
private publication record.

- [ ] **Step 3: Run fresh-eyes review**

Read `skills/going-public/ai-tells.md` and run two independent reviews using
the verbatim prompt in `skills/going-public/fresh-eyes-prompt.md` from the
private studio operations checkout. Each reviewer receives only the final
tree, the tells list, and the fixed prompt. Record model/version and redacted
findings in the private publication record; adjudicate every finding as fix or
reject with reason.

- [ ] **Step 4: Verify the remote rendered release surface**

After the approved commit is pushed to the intended remote, run the remote
publication scan and verify the GitHub repository metadata, package contents,
tag, and release notes all describe v0.4.0:

```bash
STUDIO_OPS_DIR="${MADJAG_STUDIO_OPS:?set the private studio operations checkout}"
PUBLIC_ALLOWLIST="${PUBLIC_ALLOWLIST:?set the private publication allowlist}"
node "$STUDIO_OPS_DIR/tools/publish-scan/publish-scan.mjs" publication --repo madjagstudios/grounded-engineering --allowlist "$PUBLIC_ALLOWLIST" --fail-closed
npm view grounded-engineering@0.4.0 version dist-tags --json
npm pack grounded-engineering@0.4.0 --dry-run
```

Do not claim npm or remote publication success from local tests. Keep local
validation, GitHub release/tag state, npm registry state, and remote scan
results as separate evidence lines.

- [ ] **Step 5: Complete the private publication record and post-release loop**

Complete `docs/publications/grounded-engineering-v040-manifest.md` in the
private source repository with the exact allowlist, scan results in redacted
form, clearance gates, fresh-eyes reports, adjudications, sign-off, and the
remote commit SHA. Never place this manifest or raw scanner output in the
public repository. After the release, update the private `ai-tells.md`
disposition with every fresh-eyes finding and record whether the tells list
changed.

---

## Plan self-review

- Baseline compatibility is covered by Task 1 metadata assertions and Task 3
  release/pack matching; no task changes the historical baseline release.
- Claude adapter support is covered by Task 2 registry, rendering, preflight,
  manifest, preview, and apply tests.
- Canonical manifest fingerprint behavior is explicit in Task 3 and does not
  use `precondition_sha256` as drift evidence.
- `check` routing and `update` reservation are separately covered in Task 4,
  including exit codes `0`, `1`, and `2`.
- Public documentation and package metadata are covered in Task 5.
- Going-public requirements are covered in Task 6 without vendoring private
  scanner/hook artifacts or placing the publication manifest in this public
  repository.
- No task implements multi-target application, custom create/apply, update
  proposals, additional providers, hosted behavior, or deterministic
  enforcement controls.
