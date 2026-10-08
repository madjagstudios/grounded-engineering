# Changelog

All notable changes to Grounded Engineering are recorded here. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the
project aims to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Practice cards are point-in-time observations against pinned sources; a release
records the state of the catalog and tooling at that tag.

## [0.6.0] - 2026-10-08

### Added
- Claude Code plugin (`plugin/`), installable from this repository as a
  marketplace: a read-only pane with Practices and Skill repos screens, "Fits
  this repo" suggestions from repository signals, and `adapt` and `explain`
  skills that propose changes for approval. Its "Fits this repo" and "All
  practices" lists fold away. In the terminal the pane answers the keys `1` and
  `2` (screens), `d` (details) and `a` (the open card's main action). In the
  desktop app, pressing a link prints it in the transcript (through a hidden
  `/grounded-link` command), where it can be clicked.
- Skill-repo records: reviewed, link-only pointers to third-party skill
  repositories under `research/skill-repos/`, with a schema
  (`research/skill-repo-schema.yaml`) and validation in `npm test`. A listed
  record's license must be a valid SPDX expression, and every record's
  `install` steps must be literal commands, with other guidance in `install_note`. The first
  sixteen are listed, each read at a pinned commit. A record marked `featured`
  is listed first and labelled Featured; Ponytail is the first.
- Repository signal vocabulary and fit rules (`plugin/fit-rules.yaml`) that map
  signals to practice cards, validated against the real cards.
- Plugin catalog `plugin/catalog.json`, built by `npm run build:catalog`. It
  rebuilds byte-identical, so CI can tell when it is out of date.
- `npm run discover:skill-repos`, which prints candidate skill repositories for
  human review.
- Four practice cards sourced from `openai/codex`: expressing edits in an
  explicit, verifiable format (`GE-CQ-003`), deciding permission separately
  from the action (`GE-VF-003`), confining agent-executed commands in an OS
  sandbox (`GE-VF-004`), and gating network egress from agent-run work
  (`GE-AS-006`).

### Changed
- The validator's public-content check now ships only generic patterns
  (unfinished-work markers and home-directory paths). A maintainer can add their
  own in an untracked `.private/public-content-patterns.txt`.
- The `ai-assisted` pack now ships all seventeen cards, adding the four new
  cards above. Its `pack_version` is `1.1.0` and its release is `v0.6.0`, so in
  a repository that adopted the earlier `ai-assisted` pack, `check` reports a
  pack metadata mismatch once the CLI is upgraded. The `baseline` pack is
  unchanged.

### Security
- The repository lockfile now resolves `fast-uri` (via `ajv`) to 3.1.8, which
  addresses GHSA-qw65-cvwx-89v3 and GHSA-58mr-gqgx-xq4g (high) and
  GHSA-hrr3-gc8f-f4qj (moderate). npm does not publish this lockfile; a fresh
  install of the package already resolves 3.1.8 through `ajv`'s range, so only
  installs pinned by their own older lockfile need to update. The package
  compiles only its own bundled schemas, so untrusted input did not reach the
  affected code.

## [0.5.0] - 2026-08-28

### Added
- Opt-in `check:sources` source-drift command using the GitHub API. It is an
  online complement to the offline provenance check added in this release; it
  only reports, and exits non-zero when a lookup fails. It flags validated cards
  for re-audit.

### Changed
- Provenance floor for validation: a practice card whose `validation.status`
  is `validated` or `needs_review` must now record `validation.validated_against`
  as per-source `{source_id, revisions[]}` entries. Validated revision sets are
  cross-checked offline against the exact source registry pins; `needs_review`
  also requires a note, and retrieval dates must be calendar-valid. The record
  schema remains `1.0.0` as a pre-1.0 erratum because the scalar was declared but
  never populated. All existing cards are `not_validated`, so none needed changing.

## [0.4.0] - 2026-08-27

### Added
- Claude Code adapter: `grounded-engineering adopt ... --adapter claude` now
  targets the repository-root `CLAUDE.md`, preserves unmanaged prose outside
  card-keyed managed blocks, and reports nearby Claude instruction surfaces
  without editing them.
- AI-assisted adoption profile: `--profile ai-assisted` ships the full
  thirteen-card pack across repository context, code quality, testing,
  verification, and agent-skill design.
- Read-only drift checking: `grounded-engineering check` validates the local
  manifest and managed blocks against the pack bundled with the installed CLI.
  Exit code `0` means clean, `1` means drift or repository-state mismatch, and
  `2` remains reserved for invocation errors.

### Changed
- Public documentation now reflects the supported v0.4.0 adoption surface,
  including the three adapter choices, the one-adapter-per-manifest limitation,
  and the explicit review/apply/check lifecycle.
- The baseline pack metadata intentionally remains at `v0.2.0` with
  `pack_version: 1.0.0`, so existing baseline adopters are not forced into
  manual manifest deletion while `update propose` is still reserved.

## [0.3.0] - 2026-08-26

### Added
- Reviewable adoption CLI: `grounded-engineering adopt preview | create | apply`.
  Preview and create are read-only with respect to canonical policy; create
  stores a proposal under `.grounded-engineering/proposals/<id>/`, and only an
  explicit `apply … --confirm` writes the provider-neutral target and a local
  manifest, bounded by card-keyed managed blocks.
- npm installability: the package publishes as `grounded-engineering`, so it can
  be run with `npx grounded-engineering …` or installed via
  `npm install -g grounded-engineering`. The runtime payload (`practices/`,
  `packs/`) ships in the package.

### Fixed
- Package-root resolution now uses `fileURLToPath()` instead of `URL.pathname`,
  so the CLI locates its `practices/` and `packs/` payload correctly when
  installed under a path containing spaces or on Windows.

### Changed
- `yaml` and `ajv` moved to runtime `dependencies`; package metadata
  (`repository`, `homepage`, `bugs`, `license`, `keywords`, `files`) completed
  for publication.

## [0.2.0] - 2026-08-26

### Added
- Agent & Skill Design category: five practice cards covering bounded
  delegation, control surfaces, discriminating triggers, lean skill
  entrypoints, and real-usage validation.

## [0.1.0] - 2026-08-26

### Added
- Initial foundation and the Context & Instructions category: eight practice
  cards across repository context, code quality, testing, and verification, with
  the research provenance model, schema, and local validator.

[0.6.0]: https://github.com/madjagstudios/grounded-engineering/releases/tag/v0.6.0
[0.5.0]: https://github.com/madjagstudios/grounded-engineering/releases/tag/v0.5.0
[0.4.0]: https://github.com/madjagstudios/grounded-engineering/releases/tag/v0.4.0
[0.3.0]: https://github.com/madjagstudios/grounded-engineering/releases/tag/v0.3.0
[0.2.0]: https://github.com/madjagstudios/grounded-engineering/releases/tag/v0.2.0
[0.1.0]: https://github.com/madjagstudios/grounded-engineering/releases/tag/v0.1.0
