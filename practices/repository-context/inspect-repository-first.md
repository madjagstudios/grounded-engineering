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
proposed_implementation: Read applicable instructions, inspect status and recent history, locate existing commands, and identify affected paths before editing.
delivery_horizon: V1
confidence: high
evidence_level: observed
source_ids: [CODEX-AGENTS-GUIDE, CODEX-AGENTS-IMPLEMENTATION, CLAUDE-MEMORY-HIERARCHY]
evidence_refs:
  - source_id: CODEX-AGENTS-GUIDE
    locator: repository instruction guide sections on discovery order and nested instructions
    relationship: observed_implementation
  - source_id: CODEX-AGENTS-IMPLEMENTATION
    locator: agents_md.rs root detection and candidate ordering
    relationship: observed_implementation
  - source_id: CLAUDE-MEMORY-HIERARCHY
    locator: memory documentation sections on hierarchy and path rules
    relationship: observed_implementation
validation:
  status: not_validated
  note: Local validation has not yet been performed in a consuming repository.
revisit:
  required: false
  trigger: Revisit after source re-audit or local validation evidence.
agent_snippet: Before editing, inspect applicable instructions, repository status, structure, declared commands, and affected paths.
---

# Inspect the repository first

Before acting, inspect the applicable instructions, repository status, structure, declared commands, recent changes, and affected paths. Record the boundaries that matter to the task before choosing an implementation.

## Evidence trail

- [CODEX-AGENTS-GUIDE](../../research/sources/codex.md#codex-agents-guide): discovery order and nested instructions.
- [CODEX-AGENTS-IMPLEMENTATION](../../research/sources/codex.md#codex-agents-implementation): root detection and candidate ordering.
- [CLAUDE-MEMORY-HIERARCHY](../../research/sources/claude-code.md#claude-memory-hierarchy): instruction hierarchy and path rules.
