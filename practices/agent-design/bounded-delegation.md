---
record_type: practice
schema_version: 1.0.0
id: GE-AS-004
title: Bound delegated work
category: Agent & Skill Design
subcategory: Delegation safety
pattern: Scope delegated agents by capability, authority, duration, and isolation.
underlying_principle: A delegated task should receive only the powers and context required to produce its result.
observed_implementation: Claude Code supports tool restrictions, permission modes, turn limits, preloaded skills, and isolated worktrees for custom subagents.
applicability: [AI_ASSISTED, REPOSITORY_GOVERNANCE]
control_types: [PERMISSION, APPROVAL, HUMAN_REVIEW]
disposition: ADAPT
rationale: Least privilege and isolation reduce accidental side effects, but the right boundary depends on the repository and the delegated task's risk.
delivery_horizon: V1
confidence: high
evidence_level: observed
source_ids: [CLAUDE-SUBAGENT-BOUNDARIES, CODEX-SKILL-DESIGN]
evidence_refs:
  - source_id: CLAUDE-SUBAGENT-BOUNDARIES
    locator: official subagent fields for tools, permissions, turns, and isolation; retrieved 2026-08-26
    relationship: observed_implementation
  - source_id: CODEX-SKILL-DESIGN
    locator: pinned `SKILL.md:16-22` for scope and permission boundaries
    relationship: generalized_principle
validation:
  status: not_validated
revisit:
  required: false
agent_snippet: Give delegated work only the tools, authority, context, and duration required for its result; isolate repository changes when the task warrants it.
---

# Bound delegated work

Before delegating, define the result the worker must return and the minimum
capabilities needed to produce it. Restrict tools or permissions, cap an
unbounded loop, and use an isolated worktree when edits should not touch the
parent working copy.

The boundary is proportionality. Read-only research may need broad reading
but no writes; an implementation worker may need edits but not unrelated
external actions. The parent remains responsible for reviewing the result.

## Evidence trail

- [CLAUDE-SUBAGENT-BOUNDARIES](../../research/sources/claude-code.md#claude-subagent-boundaries): subagent capability and isolation controls.
- [CODEX-SKILL-DESIGN](../../research/sources/codex.md#codex-skill-design): preserve scope and do not imply additional permissions.
