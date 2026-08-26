---
record_type: practice
schema_version: 1.0.0
id: GE-AS-001
title: Keep skill entrypoints lean
category: Agent & Skill Design
subcategory: Progressive disclosure
pattern: Keep the skill entrypoint focused and load conditional detail only when the task needs it.
underlying_principle: Agent context should contain the constraints and routing information that affect the current decision.
observed_implementation: Codex describes concise skill entrypoints with optional references, scripts, and assets loaded or used as the workflow requires.
applicability: [AI_ASSISTED, ONBOARDING, REPOSITORY_GOVERNANCE]
control_types: [ADVISORY, HUMAN_REVIEW]
disposition: ADOPT
rationale: Lean entrypoints reduce context cost and make the actual operating contract easier to inspect and maintain.
delivery_horizon: V1
confidence: high
evidence_level: observed
source_ids: [CODEX-SKILL-DESIGN, CLAUDE-SKILL-SURFACE]
evidence_refs:
  - source_id: CODEX-SKILL-DESIGN
    locator: pinned `SKILL.md:10-28` and `:30-60`
    relationship: observed_implementation
  - source_id: CLAUDE-SKILL-SURFACE
    locator: official feature-selection table for skills and context cost; retrieved 2026-08-26
    relationship: generalized_principle
validation:
  status: not_validated
revisit:
  required: false
agent_snippet: Keep the skill entrypoint focused; move conditional procedures and references out of the default context when they are not needed for every invocation.
---

# Keep skill entrypoints lean

Put the purpose, routing, essential constraints, and the normal workflow in
the entrypoint. Use references or scripts for substantial details that apply
only to a mode, format, provider, or edge case.

The boundary is usefulness, not file size. A short self-contained skill is
better than a router with nothing meaningful to route; a complex skill should
not make every invocation pay for unrelated detail.

## Evidence trail

- [CODEX-SKILL-DESIGN](../../research/sources/codex.md#codex-skill-design): focused skill anatomy and progressive disclosure.
- [CLAUDE-SKILL-SURFACE](../../research/sources/claude-code.md#claude-skill-surface): skills as reusable, on-demand context.
