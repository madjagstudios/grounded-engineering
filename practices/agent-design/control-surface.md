---
record_type: practice
schema_version: 1.0.0
id: GE-AS-003
title: Choose the control surface
category: Agent & Skill Design
subcategory: Mechanism selection
pattern: Put guidance, isolation, and invariant enforcement in the mechanism designed to provide that guarantee.
underlying_principle: A reusable prompt cannot provide the same guarantee as a deterministic control or an authority boundary.
observed_implementation: Claude Code separates persistent context, skills, subagents, MCP, and hooks by lifecycle, context behavior, and determinism.
applicability: [AI_ASSISTED, REPOSITORY_GOVERNANCE, PUBLICATION]
control_types: [ADVISORY, DETERMINISTIC_CHECK, HOOK, CI, PERMISSION, APPROVAL]
disposition: ADOPT
rationale: Matching mechanism to guarantee prevents advisory text from being mistaken for enforcement or authorization.
delivery_horizon: V1
confidence: high
evidence_level: observed
source_ids: [CLAUDE-SKILL-SURFACE, CLAUDE-HOOKS-DETERMINISM]
evidence_refs:
  - source_id: CLAUDE-SKILL-SURFACE
    locator: official feature-selection table for context, skills, subagents, and hooks; retrieved 2026-08-26
    relationship: observed_implementation
  - source_id: CLAUDE-HOOKS-DETERMINISM
    locator: official feature-selection and setup guidance; retrieved 2026-08-26
    relationship: generalized_principle
validation:
  status: not_validated
revisit:
  required: false
agent_snippet: Use skills for reusable reasoning, subagents for isolated specialization, and hooks or CI for behavior that must happen deterministically.
---

# Choose the control surface

Use a skill when the agent needs reusable knowledge or a reasoning-dependent
workflow. Use a subagent when a specialized or context-heavy task benefits
from isolation. Use a hook, CI check, permission, or approval when the rule
must hold even if the agent misunderstands the instruction.

The boundary is the required guarantee. Do not make a hook carry a long
decision procedure, and do not describe a deterministic safety requirement as
if a prompt alone could enforce it.

## Evidence trail

- [CLAUDE-SKILL-SURFACE](../../research/sources/claude-code.md#claude-skill-surface): extension surfaces and their distinct roles.
- [CLAUDE-HOOKS-DETERMINISM](../../research/sources/claude-code.md#claude-hooks-determinism): skills versus lifecycle hooks.
