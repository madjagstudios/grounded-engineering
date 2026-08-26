---
record_type: practice
schema_version: 1.0.0
id: GE-RC-002
title: Keep canonical context discoverable
category: Repository Context
subcategory: Source of truth
pattern: Keep durable repository policy canonical and make tool-specific adapters point back to it.
underlying_principle: Agent instruction files should be views or adapters of governed knowledge, not disconnected copies of human policy.
observed_implementation: Public repositories use shared root guidance, thin adapters, nested scopes, and imported instruction content.
applicability: [AI_ASSISTED, TRADITIONAL, ONBOARDING, REPOSITORY_GOVERNANCE]
control_types: [ADVISORY, HUMAN_REVIEW, CI]
disposition: ADOPT
rationale: A discoverable canonical source reduces semantic drift while allowing each tool to receive the syntax and scope it can actually consume.
proposed_implementation: Maintain durable policy once, link or generate thin adapters, and check adapter parity during review or CI.
delivery_horizon: V1
confidence: high
evidence_level: observed
source_ids: [CODEX-AGENTS-GUIDE, CLAUDE-MEMORY-HIERARCHY, CLAUDE-ENFORCEMENT-BOUNDARY]
evidence_refs:
  - source_id: CODEX-AGENTS-GUIDE
    locator: repository instruction guide sections on repository and nested guidance
    relationship: generalized_principle
  - source_id: CLAUDE-MEMORY-HIERARCHY
    locator: memory documentation sections on imports and scoped instructions
    relationship: observed_implementation
  - source_id: CLAUDE-ENFORCEMENT-BOUNDARY
    locator: memory documentation sections distinguishing instructions from controls
    relationship: generalized_principle
validation:
  status: not_validated
  note: Local validation has not yet been performed in a consuming repository.
revisit:
  required: false
  trigger: Revisit after source re-audit or local validation evidence.
agent_snippet: Keep durable policy canonical and make agent-specific files thin, discoverable adapters rather than disconnected copies.
---

# Keep canonical context discoverable

Keep durable human-facing policy in one maintained source. Use tool-specific instruction files as thin adapters or views, and make their relationship to the canonical source reviewable.

## Evidence trail

- [CODEX-AGENTS-GUIDE](../../research/sources/codex.md#codex-agents-guide): repository and nested guidance.
- [CLAUDE-MEMORY-HIERARCHY](../../research/sources/claude-code.md#claude-memory-hierarchy): imports and scoped instructions.
- [CLAUDE-ENFORCEMENT-BOUNDARY](../../research/sources/claude-code.md#claude-enforcement-boundary): guidance versus controls.
