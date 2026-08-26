# Claude Code integration

Use this integration when translating practices into Claude Code instructions, skills, or hooks.

## Translation rules

- Use the narrowest applicable instruction scope for repository, directory, or task context.
- Keep durable human policy in a maintained canonical document and make the Claude-specific instruction file or path rules a discoverable adapter.
- Use local or user context for workflow refinement, not for silently weakening shared policy.
- Treat skills and hooks as different control types: a skill can guide a workflow, while a hook or other deterministic mechanism can gate behavior.
- Preserve the Grounded Engineering card ID and source link in review metadata, not in every model-facing instruction block.

See the [Claude Code source observations](../../research/sources/claude-code.md) for the pinned documentation references.
