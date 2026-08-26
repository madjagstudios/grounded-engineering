# Changelog

All notable changes to Grounded Engineering are recorded here. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the
project aims to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Practice cards are point-in-time observations against pinned sources; a release
records the state of the catalog and tooling at that tag.

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

[0.3.0]: https://github.com/madjagstudios/grounded-engineering/releases/tag/v0.3.0
[0.2.0]: https://github.com/madjagstudios/grounded-engineering/releases/tag/v0.2.0
[0.1.0]: https://github.com/madjagstudios/grounded-engineering/releases/tag/v0.1.0
