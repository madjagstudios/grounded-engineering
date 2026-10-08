# Grounded Engineering

[![Validate](https://github.com/madjagstudios/grounded-engineering/actions/workflows/validate.yml/badge.svg)](https://github.com/madjagstudios/grounded-engineering/actions/workflows/validate.yml)
[![npm](https://img.shields.io/npm/v/grounded-engineering?label=npm)](https://www.npmjs.com/package/grounded-engineering)
[![License: MIT](https://img.shields.io/github/license/madjagstudios/grounded-engineering)](LICENSE)
[![Node](https://img.shields.io/node/v/grounded-engineering)](package.json)
[![Claude Code mod](https://img.shields.io/badge/Claude_Code_mod-2.1.288%2B-D97757)](#claude-code-mod)

Engineering practices drawn from mature open-source repositories, each tied to
the source it came from, plus a shelf of reviewed third-party skill
repositories. It runs as a mod inside Claude Code, a live pane installed as a
plugin, and as a command-line tool.

![The Grounded pane in Claude Code: it lists the practices that fit the open repository, and Adapt asks Claude to propose the change](docs/media/grounded-pane.gif)

Type `/grounded` and the pane reads the repository you have open. It shows the
practices that fit what it finds (tests with no CI gate, agent instructions
only Claude reads, no OS sandbox) and why each one applies. **Adapt** asks
Claude to propose the smallest change that brings the practice into your
repository; nothing is written until you approve it. Every card links to the
sources it was drawn from, pinned to the revision that was read.

## Install

### Claude Code mod

Needs Claude Code 2.1.288 or later, in the terminal or the desktop app's Code
tab. Mods install as plugins:

```text
/plugin marketplace add madjagstudios/grounded-engineering
/plugin install grounded-engineering@grounded-engineering
```

Then type `/grounded`. In the terminal the pane also has keyboard shortcuts:
`1` and `2` switch screens, `d` shows what it detected, and `a` runs the open
card's main action.

### Command-line tool

Needs Node.js 20 or later. It writes the same practices into `AGENTS.md`,
`CLAUDE.md` or a neutral Markdown file; see [Adopt a profile](#adopt-a-profile).

## Skill repos

![The Skill repos screen: Ponytail is featured at the top, and Explain install has Claude read the repository before anything is installed](docs/media/grounded-skill-repos.gif)

The second screen lists sixteen third-party skill repositories, each read at a
pinned commit and approved by a maintainer before it is listed. The shelf holds
links and our own short notes only; credit and stars go to the authors.
**Explain install** has Claude read the repository at that commit and list what
it would add (hooks, scripts, network use, settings it changes) before quoting
the author's own install steps. Claude installs nothing unless you agree, and
you type any slash commands yourself. Authors who ask to be removed are
delisted. The records live in [`research/skill-repos/`](research/skill-repos/).

## Repository layout

```text
research/       Source observations, pinned references, and category audits
practices/      Short, reusable engineering-practice cards
integrations/   Consumer-specific translation guidance for agent instruction files
plugin/         The Claude Code mod: pane, skills, and generated catalog
src/, bin/      The command-line tool
scripts/        Validation, catalog build, and source-drift tools
```

## Adopt a profile

Adoption does not rewrite existing policy. `preview` only reads, and `create`
stores a proposal under `.grounded-engineering/proposals/<proposal-id>/` for
you to review; nothing is written until `apply --confirm`.

```bash
# one-off, nothing installed
npx grounded-engineering adopt preview --profile ai-assisted --adapter claude

# or install the command
npm install -g grounded-engineering
grounded-engineering adopt create --profile ai-assisted --adapter claude
# Review proposal.yaml, plan.md, and diff.patch; complete local_decisions.
grounded-engineering adopt apply <proposal-id> --confirm
grounded-engineering check
```

Profiles:

- `baseline`: the original eight cards on repository context, code quality,
  testing and verification. Its pack metadata stays at `v0.2.0` so existing
  adopters stay green.
- `ai-assisted`: all seventeen cards.

Adapters:

- `neutral` (default) writes Markdown to `docs/grounded-engineering.md` if the
  repository has a `docs/` folder, otherwise to `GROUNDED_ENGINEERING.md`.
- `codex` writes to `AGENTS.md`. If `AGENTS.override.md` exists, Codex reads
  it instead, so the tool reports it and writes nothing.
- `claude` writes to the repository-root `CLAUDE.md`. It reports
  `.claude/CLAUDE.md`, nested `CLAUDE.md` and `CLAUDE.local.md` files but does
  not edit them.

Every adapter writes only inside managed blocks keyed by card ID, and leaves
everything outside them byte for byte. Apply writes the target and
`.grounded-engineering/manifest.yaml` only after re-checking the proposal's
preconditions. A repository can have one adapter target. Adding a second
target, and choosing cards with `--cards` outside `preview`, are not supported
yet.

`grounded-engineering check` reads the manifest and the target files and
compares them with the pack bundled in the installed CLI. It exits `0` when
clean, `1` on drift or a repository-state mismatch, and `2` on an invocation
error. The write path is specified in the
[adopt apply policy](policies/adopt-apply.md); compatibility notes for each
release are in [`CHANGELOG.md`](CHANGELOG.md).

## How sources are used

Cards paraphrase their sources and link to the revision and the file or
heading they draw on. We quote only where a source's license allows it, and
never copy vendor prompt files. Each card says whether its practice is
observed, recommended, or validated in use.

A card does not change when its source does. `npm run check:sources` reports
drift, and a card marked validated records which revision of each source it
was checked against.

## Contributing

Start with [`CONTRIBUTING.md`](CONTRIBUTING.md) and
[`research/README.md`](research/README.md). Keep source observations in
`research/`, the practice in `practices/`, and tool-specific wording in
`integrations/`; a change that mixes them is harder to review.

Grounded Engineering is built and maintained with AI agents.

## License

Original repository content is available under the [MIT License](LICENSE).
Third-party sources remain under their own licenses and terms; links and
attribution are recorded with the evidence.
