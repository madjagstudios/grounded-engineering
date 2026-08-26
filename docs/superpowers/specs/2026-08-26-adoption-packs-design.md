# Reviewable Adoption Packs: UX and Product Design

Status: proposed for review  
Date: 2026-08-26  
Related work: [GE-7](https://madjagstudios.atlassian.net/browse/GE-7)

## Summary

Grounded Engineering should offer a guided, local adoption workflow that turns selected practice cards into a reviewable repository proposal. The workflow should help a public adopter move from “these practices look useful” to “this repository has explicitly accepted and adapted these practices” without requiring manual copy-and-paste through every card.

The quality release is a local CLI experience. It does not silently edit a repository, upload repository contents, replace local policy, or claim that a generated instruction block is a complete enforcement system. It generates a proposed integration, shows the evidence and boundaries behind it, and requires an explicit human decision before applying changes.

## Problem and users

The current public experience is catalog-oriented: an adopter reads individual cards, chooses relevant practices, and translates them manually into local policy or agent instructions. That is safe but creates unnecessary friction and makes consistent adoption difficult.

The workflow serves three related users:

1. A developer who wants a sensible engineering baseline without using AI coding tools.
2. A developer or team that uses AI assistants and wants concise, provider-neutral repository guidance plus optional Codex or Claude Code adapters.
3. A team with existing repository policy that wants to compare Grounded Engineering recommendations against its current controls without overwriting them.

The first quality release establishes one complete, provider-neutral baseline path. The AI-assisted profile, custom card selection, and provider-specific adapters follow the same contract after that path is proven. The third user is supported through conflict detection and proposal review rather than a separate profile.

## Product principles

- Proposal before mutation: discovery and generation are read-only by default; applying a proposal is a separate, explicit action.
- Local first: repository contents stay local. Network access is not required for a pinned pack to generate a proposal.
- Canonical policy remains local: generated text is an adapter or proposed policy contribution, not a new source of truth.
- Evidence stays visible without consuming agent context: source links, card IDs, dispositions, and rationale belong in review metadata and the manifest; model-facing text stays concise.
- Scope is explicit: the proposal names target files, precedence, applicability, and local adaptation points.
- Controls remain distinct: prose, hooks, CI, permissions, and human approvals are presented as different mechanisms.
- Reversible and repeatable: proposals are diffable, safe to reject, and stable when generated twice from the same inputs.

## Proposed user journey

```text
Preflight repository
        ↓
Choose profile or cards
        ↓
Review local integration plan
        ↓
Generate proposal and diff
        ↓
Review evidence and conflicts
        ↓
Explicitly apply or reject
        ↓
Record accepted decisions
        ↓
Check for drift and propose updates later
```

### 1. Preflight

The user starts from the repository root with the interactive command:

```text
grounded-engineering adopt
```

Bare `adopt` is interactive. It ends with a preview and asks whether to save a proposal; it never applies changes. Non-interactive operations use explicit action subcommands:

```text
grounded-engineering adopt preview --profile baseline
grounded-engineering adopt create --profile baseline
grounded-engineering adopt apply <proposal-id> --confirm
grounded-engineering check
grounded-engineering update propose --release v0.3.0
```

The canonical profile IDs are `baseline`, `ai-assisted`, and `custom`. The interactive labels may be friendlier, but the IDs are stable everywhere in manifests, commands, documentation, and tests.

The tool performs a read-only inspection and reports:

- repository root and detected project type;
- existing `AGENTS.md`, `CLAUDE.md`, Copilot instruction files, policy documents, hooks, and CI configuration;
- declared package-manager and verification commands when they can be identified;
- whether a Grounded Engineering manifest already exists;
- files that would be candidates for an adapter or policy contribution.

The preflight does not infer permission to change files. If the repository shape is unknown, the tool explains what it found and offers a generic proposal target rather than guessing a provider-specific location.

### 2. Profile or card selection

The interactive path presents:

- `baseline` — Engineering baseline;
- `ai-assisted` — AI-assisted development;
- `custom` — Custom selection.

Each profile shows its included cards, excluded or non-applicable cards, disposition, evidence level, and a one-sentence purpose. The user can remove a card before generation. `ADOPT` and `ADAPT` are not treated as automatic approval: they describe the public category decision and still require local review.

The same selection must be available non-interactively for repeatable use. `preview` is the non-interactive dry-run; it does not persist a proposal or mutate repository files:

```text
grounded-engineering adopt preview --profile baseline
grounded-engineering adopt preview --cards inspect-repository-first,claims-match-evidence
```

In the first release, arbitrary `--cards` selection is preview-only. `create` and `apply` support the versioned `baseline` pack; custom selections become applicable once custom packs have a complete proposal and apply contract.

### 3. Integration plan

Before producing files, the tool explains where each selected practice would go:

| Concern | Proposed destination | Review question |
| --- | --- | --- |
| Human-facing engineering policy | Existing canonical policy or a proposed new document | Does this belong in the team's durable policy? |
| General repository guidance | Existing root instruction file or a proposed scoped adapter | Is the scope and precedence correct? |
| Codex or Claude Code translation | Provider-specific adapter proposal | Is this adapter concise and discoverable? |
| Deterministic requirement | Hook, CI, permission, or approval recommendation | Does prose provide enough guarantee, or is enforcement required? |

Existing files are never silently replaced. Grounded Engineering owns only marker-delimited blocks keyed by card ID; the managed-region contract is defined below. If the tool detects overlapping or conflicting guidance outside a managed block, it marks the target as a conflict and requires the user to resolve or explicitly exclude it before application.

### 4. Proposal and diff

The default interactive command and `adopt preview` render a plan and diff without modifying repository files. `adopt create` explicitly saves a proposal under `.grounded-engineering/proposals/<proposal-id>/`; this creates review artifacts but does not modify canonical policy or adapter files.

```text
grounded-engineering adopt create --profile baseline
```

Proposal IDs use UTC timestamp plus a random suffix: `YYYYMMDD-HHMMSS-<8-hex>`. The proposal directory is not gitignored automatically, so an adopter can commit it for review or remove it explicitly. The interactive preview may instead use a temporary directory and report that path.

A saved proposal contains:

- human-readable proposed changes;
- a patch or equivalent structured diff;
- proposed policy and adapter files separated by concern;
- a machine-readable manifest;
- a validation report;
- any conflicts, assumptions, or excluded cards.

The proposal must make it easy to answer: what will change, why, which cards support it, what remains local judgment, and what will not be changed.

### 5. Explicit application

Application is a separate action against a named proposal:

```text
grounded-engineering adopt apply <proposal-id> --confirm
```

The tool rechecks the repository before writing. It refuses to apply when a target file changed since proposal generation, the pack or schema is invalid, a conflict remains unresolved, or the proposed target is outside the repository boundary. It requires an explicit confirmation listing every file to be modified. In non-interactive use, `--confirm` is required and is refused if the proposal is not clean.

New proposal files may be created. An existing target file may be edited only inside a Grounded Engineering managed block; bytes outside the block are never changed. If an existing file has no safe managed-block insertion point, the tool creates a separate adapter proposal instead of editing the file. Application does not create a commit, alter remote state, install hooks, enable permissions, or change CI unless those actions are separately represented as reviewed instructions and explicitly performed by the user.

Managed blocks use a syntax appropriate to the target file. Markdown-compatible files use:

```text
<!-- grounded-engineering:begin card=GE-EXAMPLE-001 -->
Generated guidance for the selected card.
<!-- grounded-engineering:end card=GE-EXAMPLE-001 -->
```

There is one block per card. The marker key is the card ID, and the generator may update only the content between matching markers. A first insertion into an existing file is shown as a complete diff and requires explicit approval; later updates replace only the owned block.

### 6. Recorded decision

After application, the repository receives a small `.grounded-engineering/manifest.yaml` containing:

- Grounded Engineering release and pack version;
- `schema_version`;
- selected card IDs;
- the public category `disposition` copied from the card using the exact `ADOPT`, `ADAPT`, `REJECT`, or `DEFER` enum;
- `local_decision` for the consuming repository using the separate `ACCEPT`, `ADAPT`, `DECLINE`, or `DEFER` enum;
- `local_applicability` using `APPLICABLE`, `NOT_APPLICABLE`, or `NEEDS_REVIEW`; `NOT_APPLICABLE` is not a disposition and carries no local decision;
- target files and adapter types;
- source links and immutable references;
- a content fingerprint for every generated target and managed block;
- validation status.

The durable manifest intentionally excludes generation and application timestamps so repeated generation from the same inputs does not create meaningless diff churn. Timestamps belong in the non-durable proposal metadata. The manifest is for humans and tooling, not routine agent context. It lets the user explain what was accepted and lets later checks identify drift without rereading every card manually.

If `local_decision` is `DEFER`, `revisit_trigger` is required, matching the public research rule. If `local_applicability` is `NOT_APPLICABLE`, the applicability status explains why and the card is not treated as rejected.

Application refuses any card that remains `NEEDS_REVIEW`; every selected card must be explicitly marked `APPLICABLE` with a local decision or `NOT_APPLICABLE` without one before confirmation can write files.

For each target, the manifest records both the full-file precondition fingerprint captured at proposal generation and the normalized managed-block fingerprint expected after application. This allows application to refuse stale targets and allows `check` to detect edits inside managed blocks without pretending it can judge arbitrary policy prose semantically.

The user may also keep the proposal archive outside the repository. The manifest is the durable minimum; proposal history is not required to run the repository.

### 7. Follow-up and updates

The workflow includes two read-only follow-up concepts:

```text
grounded-engineering check
grounded-engineering update propose --release v0.3.0
```

`check` verifies that the local manifest, selected cards, schema version, pack version, and generated target fingerprints remain internally consistent. `update propose` compares the local manifest with an explicitly selected newer release and creates a new proposal. Fetching a newer release is the explicit network boundary: ordinary generation and `check` work from pinned local content, while `update propose` may fetch only after the user requests a release or supplies a local release path. Neither command silently rewrites local policy.

## Pack and artifact model

Packs are public, versioned selections of existing practice cards. They do not duplicate card evidence or create a second practice model.

A pack declares:

- stable pack ID and version;
- intended audience and use case;
- included card IDs;
- excluded cards and the reason for exclusion when useful;
- expected output surfaces;
- required review questions;
- exact public release and schema version used to publish the pack;
- minimum compatible CLI/release when older tooling must be refused.

The generated manifest records the exact public release, pack, schema version, cards, and source references used. Schema compatibility follows semantic versioning: the same schema major is compatible; a major-version mismatch fails closed, and a pack may require a minimum public release. A newer release is never substituted implicitly. The manifest does not copy vendor prompts, large source documents, or unnecessary research history.

## Safety and authority boundaries

The workflow must preserve these boundaries:

- A public pack is guidance, not an automatic organization policy.
- A category disposition is not a blanket judgment about a vendor or a universal rule for every repository.
- Existing local instructions have to be inspected for scope and precedence before a proposal is generated.
- A generated adapter cannot establish deterministic guarantees that only hooks, CI, permissions, or approvals can provide.
- No repository data is uploaded as part of normal local generation.
- Source links and provenance are retained in review artifacts even when the agent-facing output omits them.
- Applying a proposal does not imply that the practices have been validated in production or in live user workflows.

## Failure and recovery behavior

- Unknown repository shape: produce a generic, clearly labeled proposal and explain the missing detection rather than guessing.
- Existing target conflict: stop application and show the overlapping lines or files that require a human decision.
- Dirty target file: refuse to apply until the proposal is regenerated or the user explicitly resolves the changed target.
- Invalid pack, schema, or manifest: fail closed with the exact validation error.
- Unsupported adapter: retain the provider-neutral proposal and explain that no provider-specific file was generated.
- Partial generation: keep output in the proposal area, mark it incomplete, and provide no apply action.
- Rejected proposal: leave tracked repository policy untouched and retain no hidden state.

## Quality-release acceptance bar

The first release of the adoption capability is a complete, reliable vertical slice rather than a broad collection of partial integrations. Breadth expands only after the supported path is trustworthy.

### First supported release

- clean-fixture walkthrough for the `baseline` profile;
- provider-neutral Markdown output;
- the complete `preview → create → apply → manifest` journey;
- marker-delimited managed blocks for every generated card;
- full-file precondition and managed-block fingerprint validation;
- existing policy fixture proving bytes outside a managed block are unchanged;
- conflicting-policy and modified-target fixtures that fail closed;
- deterministic schema and manifest validation;
- idempotent generation with no meaningless diff churn;
- proof that preview and create do not mutate canonical policy files or make network requests;
- explicit apply, rejection, and recovery behavior;
- documentation explaining review, adaptation, rejection, and deferred decisions.

### Fast-follow releases

- the `ai-assisted` profile;
- the `custom` card-selection path;
- Codex and Claude Code adapter proposals;
- `check` drift reporting against managed-block fingerprints;
- `update propose` against an explicitly selected newer release;
- additional target formats and repository-language detection.

Fast-follow work must preserve the first-release command, manifest, managed-region, provenance, and approval contracts.

## Out of scope for this design

- A hosted web application or service.
- Automatic installation or activation of every practice.
- Silent repository mutation or automatic commits.
- Copying vendor prompt files or full research history into agent context.
- Replacing local policy, hooks, CI, permissions, or approval workflows.
- Claiming that adoption equals local or production validation.

## Relationship to the existing repository

The public repository remains organized as:

- `research/` for source observations and category decisions;
- `practices/` for concise reusable cards;
- `integrations/` for consumer-specific translation rules;
- a future pack area for versioned selections of existing cards;
- local consumer manifests for explicit adoption state.

The pack workflow should search the existing cards and integration guidance before adding new helpers, templates, or translation rules. If an existing repository mechanism can perform a required function, the implementation should use it rather than creating a parallel mechanism.

This design does not choose the package-distribution mechanism. The implementation plan must preserve the command, artifact, safety, and review contracts above while selecting the least burdensome distribution approach.
