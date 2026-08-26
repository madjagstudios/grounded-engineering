---
record_type: practice
schema_version: 1.0.0
id: GE-RC-001
title: Inspect the repository first
category: Repository Context
subcategory: Orientation
pattern: Inspect repository structure, instruction files, scripts, and declared checks before acting.
underlying_principle: Effective work begins with an accurate model of repository scope, policy, commands, and affected paths.
observed_implementation: Codex and Claude Code document hierarchical discovery, path scope, imports, and context diagnostics.
applicability: [AI_ASSISTED, TRADITIONAL, ONBOARDING, REPOSITORY_GOVERNANCE]
control_types: [ADVISORY, HUMAN_REVIEW]
disposition: ADOPT
rationale: Orientation prevents agents and humans from inventing incompatible conventions or repeating work already represented in the repository.
delivery_horizon: V1
confidence: high
evidence_level: observed
source_ids: [CODEX-AGENTS-GUIDE, CODEX-AGENTS-IMPLEMENTATION, CLAUDE-MEMORY-HIERARCHY]
evidence_refs:
  - source_id: CODEX-AGENTS-GUIDE
    locator: official guide section `How Codex discovers guidance`
    relationship: observed_implementation
  - source_id: CODEX-AGENTS-IMPLEMENTATION
    locator: agents_md.rs:1-16 and :185-187 for root detection and candidate ordering
    relationship: observed_implementation
  - source_id: CLAUDE-MEMORY-HIERARCHY
    locator: official memory documentation sections on hierarchy and path rules; retrieved 2026-08-26
    relationship: observed_implementation
validation:
  status: not_validated
revisit:
  required: false
agent_snippet: Before editing, inspect applicable instructions, repository status, structure, declared commands, and affected paths.
---

# Inspect the repository first

Use this as the first pass on an unfamiliar or changed repository. Learn its local contract—applicable instructions, status, structure, commands, recent changes, and affected paths—before choosing an implementation.

## Evidence trail

- [CODEX-AGENTS-GUIDE](../../research/sources/codex.md#codex-agents-guide): discovery order and nested instructions.
- [CODEX-AGENTS-IMPLEMENTATION](../../research/sources/codex.md#codex-agents-implementation): root detection and candidate ordering.
- [CLAUDE-MEMORY-HIERARCHY](../../research/sources/claude-code.md#claude-memory-hierarchy): instruction hierarchy and path rules.
