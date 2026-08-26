---
record_type: practice
schema_version: 1.0.0
id: GE-CQ-002
title: Make proportional changes
category: Code Quality
subcategory: Change scope
pattern: Keep a change limited to the behavior and evidence needed for the task.
underlying_principle: Prefer the smallest complete change over speculative cleanup or unrelated refactoring.
observed_implementation: Scoped instruction systems distinguish repository-wide guidance from narrower path and task context.
applicability: [AI_ASSISTED, TRADITIONAL, REPOSITORY_GOVERNANCE]
control_types: [ADVISORY, HUMAN_REVIEW]
disposition: ADAPT
rationale: Narrow scope reduces review and regression risk, but a necessary refactor is appropriate when the requested behavior cannot be correct without it.
proposed_implementation: State the task boundary, separate required cleanup from optional cleanup, and defer unrelated improvements to a separate change.
delivery_horizon: V1
confidence: medium
evidence_level: recommended
source_ids: [CLAUDE-LOCAL-CONTEXT, CODEX-AGENTS-IMPLEMENTATION]
evidence_refs:
  - source_id: CLAUDE-LOCAL-CONTEXT
    locator: memory documentation sections on local context and scoped instructions
    relationship: generalized_principle
  - source_id: CODEX-AGENTS-IMPLEMENTATION
    locator: agents_md.rs sections on root, path, and context boundaries
    relationship: generalized_principle
validation:
  status: not_validated
  note: Local validation has not yet been performed in a consuming repository.
revisit:
  required: false
  trigger: Revisit after source re-audit or local validation evidence.
agent_snippet: Keep the change proportional to the requested behavior; separate required refactoring from unrelated cleanup.
---

# Make proportional changes

Define the change boundary before editing. Include the refactor required for correctness, but keep unrelated cleanup, speculative abstractions, and style migrations separate so the evidence remains reviewable.

## Evidence trail

- [CLAUDE-LOCAL-CONTEXT](../../research/sources/claude-code.md#claude-local-context): local and scoped context sections.
- [CODEX-AGENTS-IMPLEMENTATION](../../research/sources/codex.md#codex-agents-implementation): root and path boundary implementation.
