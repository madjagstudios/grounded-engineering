---
record_type: practice
schema_version: 1.0.0
id: GE-AS-002
title: Write discriminating skill triggers
category: Agent & Skill Design
subcategory: Activation contract
pattern: Describe what a capability does and when it applies without turning its trigger into a catchall.
underlying_principle: Activation metadata should route work accurately before the full capability is loaded.
observed_implementation: Codex and Claude Code use skill names and descriptions as an early discovery surface before loading full instructions.
applicability: [AI_ASSISTED, ONBOARDING]
control_types: [ADVISORY, HUMAN_REVIEW]
disposition: ADOPT
rationale: Precise triggers reduce accidental activation, missed capabilities, and context spent evaluating unrelated work.
delivery_horizon: V1
confidence: high
evidence_level: observed
source_ids: [CODEX-SKILL-DESCRIPTION, CLAUDE-SKILL-DISCOVERY]
evidence_refs:
  - source_id: CODEX-SKILL-DESCRIPTION
    locator: pinned `SKILL.md:48-60` and `:189-201`
    relationship: observed_implementation
  - source_id: CLAUDE-SKILL-DISCOVERY
    locator: official skills documentation on invocation and discovery; retrieved 2026-08-26
    relationship: observed_implementation
validation:
  status: validated
  validated_against:
    - source_id: CODEX-SKILL-DESCRIPTION
      revisions:
        - f5420174dafba153913a3e697f89002c338dfd7e
    - source_id: CLAUDE-SKILL-DISCOVERY
      revisions:
        - 2026-08-26
revisit:
  required: false
agent_snippet: Describe the capability and its real trigger in the skill description; add an exclusion only when it prevents likely misrouting.
---

# Write discriminating skill triggers

Treat the name and description as a user-facing activation contract. Say what
the skill helps accomplish and the kind of request that should activate it.

Avoid exhaustive keyword lists and broad descriptions that attract unrelated
work. Add a boundary when a neighboring skill or ordinary repository work is
likely to look similar.

## Evidence trail

- [CODEX-SKILL-DESCRIPTION](../../research/sources/codex.md#codex-skill-description): early discovery surface and trigger boundary.
- [CLAUDE-SKILL-DISCOVERY](../../research/sources/claude-code.md#claude-skill-discovery): skill invocation and automatic discovery.
