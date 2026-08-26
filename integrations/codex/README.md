# Codex integration

Use this integration when translating practices into Codex repository guidance.

## Translation rules

- Keep root guidance short and put narrower rules near the paths they govern.
- Inspect the repository's actual instruction discovery and verification behavior before assuming a file will be loaded.
- Use the repository's declared checks as the verification gate; do not substitute a convenient command without saying so.
- Treat instruction content as advisory context unless a separate hook, CI check, permission, or approval mechanism provides enforcement.
- Preserve the Grounded Engineering card ID and source link in the repository's review record while keeping the agent-facing block concise.

See the [Codex source observations](../../research/sources/codex.md) for the pinned documentation and implementation references.
