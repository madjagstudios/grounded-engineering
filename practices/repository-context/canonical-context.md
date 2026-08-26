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
delivery_horizon: V1
confidence: high
evidence_level: observed
source_ids: [CODEX-AGENTS-GUIDE, CLAUDE-MEMORY-HIERARCHY, CLAUDE-ENFORCEMENT-BOUNDARY]
evidence_refs:
  - source_id: CODEX-AGENTS-GUIDE
    locator: official guide section `How Codex discovers guidance`
    relationship: generalized_principle
  - source_id: CLAUDE-MEMORY-HIERARCHY
    locator: official memory documentation sections on imports and scoped instructions; retrieved 2026-08-26
    relationship: observed_implementation
  - source_id: CLAUDE-ENFORCEMENT-BOUNDARY
    locator: official memory documentation sections distinguishing guidance from controls; retrieved 2026-08-26
    relationship: generalized_principle
validation:
  status: not_validated
revisit:
  required: false
agent_snippet: Keep durable policy canonical and make agent-specific files thin, discoverable adapters rather than disconnected copies.
---

# Keep canonical context discoverable

Use this when several tools need the same repository guidance. Keep durable policy in one maintained source; adapters may change syntax or scope, but their relationship to that source should stay reviewable.

## Evidence trail

- [CODEX-AGENTS-GUIDE](../../research/sources/codex.md#codex-agents-guide): repository and nested guidance.
- [CLAUDE-MEMORY-HIERARCHY](../../research/sources/claude-code.md#claude-memory-hierarchy): imports and scoped instructions.
- [CLAUDE-ENFORCEMENT-BOUNDARY](../../research/sources/claude-code.md#claude-enforcement-boundary): guidance versus controls.
