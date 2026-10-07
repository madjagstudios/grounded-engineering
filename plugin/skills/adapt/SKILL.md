---
name: adapt
description: Adapt one Grounded Engineering practice card to the current repository as a reviewed, minimal change. Use when the Grounded pane's "Adapt to this repo" is pressed or the user asks to apply a GE-XX-NNN practice.
argument-hint: <card-id>
---

Adapt practice `$ARGUMENTS` to this repository.

1. If `$ARGUMENTS` is empty, ask the user for a card ID (for example `GE-XX-NNN`) and stop. Otherwise read `${CLAUDE_PLUGIN_ROOT}/catalog.json` and find the entry in `practices` whose `id` is `$ARGUMENTS`. The file is large; if you cannot read it whole, extract just that entry (for example with `node` or `jq`). If there is no such practice, say so and stop.
2. Read its `pattern`, `rationale`, `agent_snippet`, and `body`. Look up each of its `source_ids` in the catalog's `sources` array (entries with `id` and `url`) for the evidence links.
3. Inspect the repository before proposing anything:
   - its instruction files (`CLAUDE.md`, `AGENTS.md`, `.claude/`);
   - its settings and hooks;
   - its CI configuration;
   - the files the practice concerns.
4. Propose the smallest change that applies the practice here: instruction text, a hook or settings entry, or a CI step. Explain in two or three sentences why this is the right shape for this repository, citing the practice's evidence.
5. If `.grounded-engineering/manifest.yaml` exists, this repository adopted a Grounded Engineering pack with the CLI:
   - never edit text between `<!-- grounded-engineering:begin card=... -->` and `<!-- grounded-engineering:end card=... -->`;
   - put any new text outside those blocks;
   - you may show the output of `npx grounded-engineering adopt preview --cards $ARGUMENTS` for reference. It only previews and writes nothing.
6. Show the full diff and ask for approval. Write nothing until the user approves.
7. After writing, if the manifest exists, run `npx grounded-engineering check`. If it does not exit 0, report the output and offer to revert your change.
