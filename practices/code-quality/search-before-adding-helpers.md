---
record_type: practice
schema_version: 1.0.0
id: GE-CQ-001
title: Search before adding helpers
category: Code Quality
subcategory: Existing capability discovery
pattern: Search the repository before introducing a helper or parallel abstraction.
underlying_principle: Reuse an existing repository capability when it already satisfies the need.
observed_implementation: Agent context systems make repository scope and available guidance discoverable before work begins.
applicability: [AI_ASSISTED, TRADITIONAL, ONBOARDING]
control_types: [ADVISORY, HUMAN_REVIEW]
disposition: ADAPT
rationale: The search-first heuristic prevents duplicate abstractions, but it must allow a new helper when existing capabilities do not meet the requirement.
proposed_implementation: Search symbols, scripts, tests, and nearby modules before adding a helper; record why an existing capability was insufficient.
delivery_horizon: V1
confidence: medium
evidence_level: recommended
source_ids: [CODEX-AGENTS-GUIDE, CLAUDE-MEMORY-HIERARCHY]
evidence_refs:
  - source_id: CODEX-AGENTS-GUIDE
    locator: official guide section `How Codex discovers guidance`
    relationship: generalized_principle
  - source_id: CLAUDE-MEMORY-HIERARCHY
    locator: official memory documentation sections on instruction scope and path-scoped rules; retrieved 2026-08-26
    relationship: generalized_principle
validation:
  status: not_validated
  note: Local validation has not yet been performed in a consuming repository.
revisit:
  required: false
  trigger: Revisit after source re-audit or local validation evidence.
agent_snippet: Before adding a helper, search the repository for an existing capability and explain why it is insufficient if you add a new abstraction.
---

# Search before adding helpers

Before creating a helper, search the repository's existing symbols, scripts, tests, and nearby modules. Reuse the existing capability when it is suitable; add a new abstraction only when the search shows a real gap or a materially safer boundary.

This is a derived recommendation. The cited sources establish the importance of repository-aware discovery and scoped context; they do not claim this exact sentence as vendor policy.

## Evidence trail

- [CODEX-AGENTS-GUIDE](../../research/sources/codex.md#codex-agents-guide): discovery and scoped context sections.
- [CLAUDE-MEMORY-HIERARCHY](../../research/sources/claude-code.md#claude-memory-hierarchy): project and path-scoped instruction sections.
