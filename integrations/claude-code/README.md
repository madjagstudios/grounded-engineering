# Claude Code integration

Use this integration when a repository adopts Grounded Engineering into Claude
Code guidance.

## Target and boundary

`grounded-engineering adopt ... --adapter claude` writes only to the
repository-root `CLAUDE.md`. The managed content lives inside card-keyed
Grounded Engineering markers, so unmanaged prose before and after the block
stays local and reviewable.

v0.4.0 does not edit `.claude/CLAUDE.md`, nested `CLAUDE.md`, `CLAUDE.local.md`,
or `.claude/` rules. If those files exist, the preflight report surfaces them
so the repository can decide whether a root `CLAUDE.md` is still the right
place for shared guidance.

## Translation rules

- Use the narrowest applicable instruction scope for repository, directory, or task context.
- Keep durable human policy in a maintained canonical document and make the Claude-specific instruction file or path rules a discoverable adapter.
- Use local or user context for workflow refinement, not for silently weakening shared policy.
- Treat skills and hooks as different control types: a skill can guide a workflow, while a hook or other deterministic mechanism can gate behavior.
- Preserve the Grounded Engineering card ID and source link in the proposal and
  manifest review record, not in every model-facing instruction block.

## Adoption example

```bash
grounded-engineering adopt preview --profile ai-assisted --adapter claude
grounded-engineering adopt create --profile ai-assisted --adapter claude
grounded-engineering adopt apply <proposal-id> --confirm
grounded-engineering check
```

The Claude adapter is nominative translation guidance, not a second source of
truth. Canonical human policy, evidence, and provenance stay in the repository's
own review flow and Grounded Engineering manifest.

See the [Claude Code source observations](../../research/sources/claude-code.md) for the pinned documentation references.
