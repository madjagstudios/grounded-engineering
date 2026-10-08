# Adopt Apply Policy

Policy version: 1.0

This policy describes the write behavior of the Grounded Engineering CLI's
`adopt apply` command:

```text
grounded-engineering adopt apply <proposal-id> --confirm
```

## What apply may write

For a proposal created by this CLI, apply writes the one target selected by
the proposal's adapter and the repository manifest at
`.grounded-engineering/manifest.yaml`:

- `neutral`: `docs/grounded-engineering.md` when the consuming repository has
  a `docs/` directory; otherwise `GROUNDED_ENGINEERING.md`.
- `codex`: the repository-root `AGENTS.md`.
- `claude`: the repository-root `CLAUDE.md`.

When creating a proposal, the Codex adapter refuses to select a target when
`AGENTS.override.md` is present. The Claude adapter selects only the root
`CLAUDE.md`, not `.claude/CLAUDE.md`, nested `CLAUDE.md`, or
`CLAUDE.local.md`. Apply does not re-run adapter preflight; it uses the
serialized target path and kind from the saved proposal, while still refusing
unsafe paths outside the consuming repository root.

## Write boundary and gates

For an existing target, apply changes only the card-keyed managed blocks. All
bytes outside those blocks are preserved. A missing target is created with the
adapter's managed content. Apply writes only after all of these conditions
hold:

1. The proposal ID resolves to a saved proposal and its pack, schema, and
   release metadata are valid.
2. The target still matches the proposal's saved precondition. Proposal
   conflicts are checked when this CLI creates the proposal; apply does not
   re-check a saved proposal's conflict list.
3. Every local decision required by the proposal is present and accepted.
4. Non-interactive use includes the explicit `--confirm` flag. Interactive
   use asks for confirmation before writing.

The target and manifest are committed as one local transaction. If a write
fails, the transaction rolls back. The manifest records the selected pack,
cards, target precondition, managed-block fingerprint, and apply-time
validation result.

## Re-apply and checking

Apply refuses when `.grounded-engineering/manifest.yaml` already exists.
Re-applying, or applying a second adapter, is not supported yet.

`grounded-engineering check` is read-only. It schema-validates the manifest,
then compares its pack, card, and target metadata and the managed target with
the pack bundled in the CLI, and reports drift or a repository-state mismatch.

Apply does not refresh sources, fetch network content, write arbitrary paths,
or edit practice cards, source records, or their `validation.status` values.

If you build a tool around `adopt apply`, rely on this document, not on the
CLI's current code.
Grounded Engineering does not depend on or endorse any third-party wrapper for
the write path.
