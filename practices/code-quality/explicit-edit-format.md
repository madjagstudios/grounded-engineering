---
record_type: practice
schema_version: 1.0.0
id: GE-CQ-003
title: Express edits in an explicit, verifiable format
category: Code Quality
subcategory: Reliable edits
pattern: Express an agent-generated edit in an explicit, parseable format with surrounding context.
underlying_principle: An edit should carry enough surrounding context that its target can be validated before the file is mutated, not after corruption.
observed_implementation: A patch parser turns text into typed hunks against an explicit grammar; it does not check filesystem applicability, which is resolved later at apply time.
applicability: [AI_ASSISTED, TRADITIONAL]
control_types: [DETERMINISTIC_CHECK, ADVISORY]
disposition: ADOPT
rationale: An explicit, context-anchored edit format lets the target be checked for a match before mutation, so a stale or mistargeted edit is caught rather than silently corrupting the file.
delivery_horizon: V1
confidence: medium
evidence_level: recommended
source_ids: [CODEX-PATCH-FORMAT]
evidence_refs:
  - source_id: CODEX-PATCH-FORMAT
    locator: parser.rs:1-2, 6-25, 145-210 for the parse-into-hunks grammar and the note that applicability is not checked here
    relationship: observed_implementation
validation:
  status: not_validated
revisit:
  required: false
agent_snippet: Produce edits in an explicit, context-anchored format and verify the target context matches before mutating, so a stale or mistargeted change is caught rather than corrupting the file.
---

# Express edits in an explicit, verifiable format

Use this when an agent or tool applies edits to files programmatically. Prefer a format that carries surrounding context and is validated against the target before it touches the filesystem, so a hunk that no longer matches is rejected rather than applied blindly. The boundary: parsing a well-formed patch is not proof it applies safely — the context still has to match the current file at apply time. And a full-file rewrite or a structured code transform can be safer than a context patch for large or generated files: match the format to the edit rather than forcing every change through one shape.

## Evidence trail

- [CODEX-PATCH-FORMAT](../../research/sources/codex.md#codex-patch-format): the explicit patch grammar, parsed separately from filesystem application.
