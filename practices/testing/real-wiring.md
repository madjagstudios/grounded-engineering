---
record_type: practice
schema_version: 1.0.0
id: GE-TS-002
title: Test real wiring
category: Testing
subcategory: Integration paths
pattern: Exercise the real call path or integration boundary when wiring is part of the change.
underlying_principle: Isolated unit evidence is insufficient when failure can occur in composition, configuration, or registration.
observed_implementation: Codex and Claude Code model effective context as the result of multiple roots, scopes, paths, and sources rather than one isolated file.
applicability: [AI_ASSISTED, TRADITIONAL, ONBOARDING]
control_types: [DETERMINISTIC_CHECK, CI, HUMAN_REVIEW]
disposition: ADOPT
rationale: End-to-end or integration-level evidence catches registration and composition failures that isolated tests cannot see.
delivery_horizon: V1
confidence: medium
evidence_level: recommended
source_ids: [CODEX-AGENTS-IMPLEMENTATION, CLAUDE-LOCAL-CONTEXT]
evidence_refs:
  - source_id: CODEX-AGENTS-IMPLEMENTATION
    locator: agents_md.rs:1-16, :115-183, and :185-187 for roots, ordering, bounded reads, and provenance
    relationship: generalized_principle
  - source_id: CLAUDE-LOCAL-CONTEXT
    locator: official memory documentation sections on nested, imported, and path-scoped context; retrieved 2026-08-26
    relationship: generalized_principle
validation:
  status: not_validated
revisit:
  required: false
agent_snippet: When wiring or registration changes, run the narrowest real-path check that exercises the composition boundary.
---

# Test real wiring

Use this when a change affects registration, configuration, imports, routing, or composition. Keep unit tests for local logic, then add the narrowest real-path check that exercises the boundary.

## Evidence trail

- [CODEX-AGENTS-IMPLEMENTATION](../../research/sources/codex.md#codex-agents-implementation): multiple roots and loaded-source provenance.
- [CLAUDE-LOCAL-CONTEXT](../../research/sources/claude-code.md#claude-local-context): nested and imported context.
