# Grounded Engineering

Grounded Engineering is a source-backed catalog of practical engineering habits for professional software development, including AI-assisted development, traditional development, and repository onboarding.

The project turns observations from mature engineering and agent repositories into small, reviewable practices. Each recommendation keeps its evidence, scope, confidence, and validation status visible so contributors can improve it instead of treating it as unexplained doctrine.

## Repository layers

```text
research/       Source observations, pinned references, and category audits
practices/      Short, reusable engineering-practice cards
integrations/   Consumer-specific translation guidance for agent instruction files
scripts/        Deterministic local validation
```

The layers are intentionally separate. Research preserves provenance and decision history; practice cards are the concise consumption surface; integrations explain how to adapt cards to a local repository without creating another source of truth.

## Current status

`v0.4.0` is the current release. It ships the historical eight-card `baseline`
pack, the thirteen-card `ai-assisted` pack, provider-neutral Markdown output,
the Codex `AGENTS.md` adapter, the Claude root `CLAUDE.md` adapter, and the
read-only `check` command for managed-block drift detection.

The historical baseline pack metadata remains at `v0.2.0` with
`pack_version: 1.0.0` so existing adopters can stay green while
`update propose` is still reserved. The `ai-assisted` profile adds the full
thirteen-card set, but it does not rewrite existing policy; it creates a
reviewable proposal that the consuming repository must explicitly accept.

The recommendations are point-in-time observations against pinned sources. Source changes do not silently rewrite cards; re-auditing is a deliberate maintenance step. A card cannot report a validation state stronger than `not_validated` without recording, for each source, the full revision set it was checked against. A source re-pin is caught offline until the card is re-validated.

Grounded Engineering is built and maintained with AI agents in real engineering workflows.

## Use it

1. Read the relevant card in [`practices/`](practices/).
2. Follow its evidence links and review its applicability and boundaries.
3. Translate only the needed guidance into your repository's canonical policy and agent adapters.
4. Put deterministic requirements in hooks, CI, permissions, or approval workflows rather than relying on prose alone.
5. Run the local validator before proposing a change.

```bash
npm install
npm test
```

The validator is local and deterministic. It does not fetch sources or make repository changes.

## Adopt a profile

Every adoption flow is reviewable and local-first. `preview` and `create` are
read-only with respect to canonical policy; `create` stores a proposal under
`.grounded-engineering/proposals/<proposal-id>/`.

Run it straight from npm, no clone required:

```bash
# one-off, nothing installed
npx grounded-engineering adopt preview --profile ai-assisted --adapter claude

# or install the command
npm install -g grounded-engineering
grounded-engineering adopt preview --profile baseline
```

Profiles:

- `baseline`: the historical eight-card Context & Instructions starter pack.
  Its pack metadata stays pinned at `v0.2.0` for compatibility with existing
  adopters.
- `ai-assisted`: all thirteen current cards, adding the five Agent & Skill
  Design practices on top of the baseline set.

Adapter choices:

- `neutral` (default): writes provider-neutral Markdown to
  `GROUNDED_ENGINEERING.md`.
- `codex`: writes into a card-keyed managed block in `AGENTS.md`.
- `claude`: writes into a card-keyed managed block in the repository-root
  `CLAUDE.md`.

v0.4.0 supports one adapter target per repository manifest. Applying a second
adapter remains deferred until `update propose` exists.

The full preview → create → review → apply → check flow, using the installed
command:

```bash
grounded-engineering adopt preview --profile ai-assisted --adapter claude
grounded-engineering adopt create --profile ai-assisted --adapter claude
# Review proposal.yaml, plan.md, and diff.patch; complete local_decisions.
grounded-engineering adopt apply <proposal-id> --confirm
grounded-engineering check
```

### Provider adapters

By default `adopt` emits provider-neutral Markdown to
`GROUNDED_ENGINEERING.md`. Pass `--adapter codex` to target `AGENTS.md`, or
`--adapter claude` to target the repository-root `CLAUDE.md`:

```bash
grounded-engineering adopt preview --profile baseline --adapter codex
grounded-engineering adopt preview --profile ai-assisted --adapter claude
```

Both provider adapters write only inside card-keyed managed blocks and preserve
bytes outside those boundaries. The Codex adapter creates or updates
`AGENTS.md`. The Claude adapter creates or updates only the root `CLAUDE.md`;
if `.claude/CLAUDE.md`, nested `CLAUDE.md`, or `CLAUDE.local.md` are present,
the tool reports them during preflight but does not edit them in v0.4.0. If a
Codex override file governs instruction resolution, the tool reports it and
generates nothing rather than writing to a file Codex will not read.

Apply writes the selected target and `.grounded-engineering/manifest.yaml` only
after checking the saved preconditions and explicit local decisions. Existing
policy and instruction files are not silently overwritten; managed updates are
bounded by card-keyed markers.

`grounded-engineering check` is read-only. It reads the manifest and target
files from the current repository, but loads the selected pack and practice
cards from the pack bundled with the installed CLI. Exit code `0` means clean,
`1` means drift or repository-state mismatch, and `2` means invocation error.
`update propose` is still reserved in v0.4.0, and custom `--cards` selection
remains preview-only.

The current release's compatibility contract is exercised by the repository's
tests and validator and is summarized in the release notes.

## Evidence posture

The default public evidence form is a paraphrase with an immutable source link and a locator such as a section heading, file path, or pinned commit. Verbatim excerpts are exceptional and require an explicit redistribution decision. Large vendor prompt files and instruction documents are not copied into this repository.

Every practice identifies whether it is observed, recommended, or locally validated. Validation notes are generalized and do not disclose private repository names, paths, tracker IDs, or other internal details.

## Contributing

Start with [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`research/README.md`](research/README.md). Contributions should improve the evidence, the practice, or the translation boundary without collapsing those layers together.

## License

Original repository content is available under the [MIT License](LICENSE). Third-party sources remain subject to their own licenses and terms; links, attribution, and redistribution decisions are recorded with the evidence.
