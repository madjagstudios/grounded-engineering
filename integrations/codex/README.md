# Codex integration

Use this integration when a repository adopts Grounded Engineering into Codex
repository guidance.

## Target and boundary

`grounded-engineering adopt ... --adapter codex` writes only to `AGENTS.md`.
Managed practice content stays inside card-keyed Grounded Engineering markers,
and any unmanaged prose outside those markers remains under repository control.

If a Codex override file governs instruction discovery, v0.4.0 reports that
state and fails closed rather than writing to an ignored file. Applying both a
Codex target and a Claude target in the same repository manifest remains
deferred until `update propose` exists.

## Translation rules

- Keep root guidance short and put narrower rules near the paths they govern.
- Inspect the repository's actual instruction discovery and verification behavior before assuming a file will be loaded.
- Use the repository's declared checks as the verification gate; do not substitute a convenient command without saying so.
- Treat instruction content as advisory context unless a separate hook, CI check, permission, or approval mechanism provides enforcement.
- Preserve the Grounded Engineering card ID and source link in the repository's
  proposal and manifest review record while keeping the agent-facing block
  concise.

## Adoption example

```bash
grounded-engineering adopt preview --profile ai-assisted --adapter codex
grounded-engineering adopt create --profile ai-assisted --adapter codex
grounded-engineering adopt apply <proposal-id> --confirm
grounded-engineering check
```

This adapter is a translation surface. Canonical human-facing policy and source
provenance stay outside `AGENTS.md`.

See the [Codex source observations](../../research/sources/codex.md) for the pinned documentation and implementation references.
