---
record_type: practice
schema_version: 1.0.0
id: GE-CQ-003
title: Express edits in an explicit, verifiable format
category: Code Quality
subcategory: Reliable edits
pattern: Express an agent-generated edit in an explicit, parseable format that carries surrounding context.
underlying_principle: An edit should carry enough context for its target to be checked before the file changes, not after it is corrupted.
observed_implementation: A patch parser turns text into typed hunks against an explicit grammar; it does not check filesystem applicability, which is resolved later at apply time.
applicability: [AI_ASSISTED, TRADITIONAL]
control_types: [DETERMINISTIC_CHECK, ADVISORY]
disposition: ADOPT
rationale: A context-anchored format lets a stale or mistargeted edit be caught before it is written.
delivery_horizon: V1
confidence: medium
evidence_level: recommended
source_ids: [CODEX-PATCH-FORMAT]
evidence_refs:
  - source_id: CODEX-PATCH-FORMAT
    locator: parser.rs:1-2, 6-25, 145-210 for the parse-into-hunks grammar and the note that applicability is not checked here
    relationship: observed_implementation
validation:
  status: validated
  validated_against:
    - source_id: CODEX-PATCH-FORMAT
      revisions:
        - 03861e69ef549717c0fc7045abad56321d4a082b
revisit:
  required: false
agent_snippet: Write edits in an explicit, context-anchored format and check that the context still matches the file before applying them.
---

# Express edits in an explicit, verifiable format

Use this when an agent or tool edits files programmatically. Prefer a format
that carries surrounding context, so a hunk that no longer matches the file is
rejected instead of applied blindly.

The boundary is apply time. A patch that parses can still fail to apply, so
the context has to be matched against the current file. For large or generated
files, a full rewrite or a structured transform can be safer than a context
patch; pick the format that fits the edit.

## Evidence trail

- [CODEX-PATCH-FORMAT](../../research/sources/codex.md#codex-patch-format): the explicit patch grammar, parsed separately from filesystem application.
