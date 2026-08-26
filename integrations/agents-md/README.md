# Repository instruction integration

Use this integration when a repository consumes Grounded Engineering practices through a repository instruction file.

## Translation rules

1. Select only cards relevant to the repository and task.
2. Copy the concise `agent_snippet` or write an equivalent local rule; do not copy the research history into agent context.
3. Link the local rule to the repository's canonical human-facing policy when the obligation affects people, release behavior, or security.
4. Keep local scope and precedence explicit.
5. Put requirements that must not be skipped in a hook, CI check, permission, or approval workflow.

The instruction file is a consumer view, not an independent source of truth. Preserve the card ID and local policy reference so drift can be reviewed.

The adoption workflow generates provider-neutral guidance beside existing instruction files. Treat its proposal and manifest as the review and provenance record; adapt approved content into `AGENTS.md` only through an explicit, repository-owned decision.
