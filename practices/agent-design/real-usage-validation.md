---
record_type: practice
schema_version: 1.0.0
id: GE-AS-005
title: Validate real skill usage
category: Agent & Skill Design
subcategory: Behavioral validation
pattern: Validate a reusable capability with realistic use when structural checks cannot show that its decisions are useful.
underlying_principle: Package validity and behavioral usefulness are different claims.
observed_implementation: Codex distinguishes frontmatter/package validation from realistic use and targeted iteration; Claude Code describes adding and revising extensions from repeated real triggers.
applicability: [AI_ASSISTED, ONBOARDING, REPOSITORY_GOVERNANCE]
control_types: [ADVISORY, HUMAN_REVIEW, DETERMINISTIC_CHECK]
disposition: ADAPT
rationale: Realistic forward use catches routing and decision failures, but a formal behavioral test should match the skill's complexity and consequence.
delivery_horizon: V1
confidence: medium
evidence_level: recommended
source_ids: [CODEX-SKILL-VALIDATION, CLAUDE-SKILL-SURFACE]
evidence_refs:
  - source_id: CODEX-SKILL-VALIDATION
    locator: pinned `SKILL.md:203-219` for structural validation and realistic use
    relationship: observed_implementation
  - source_id: CLAUDE-SKILL-SURFACE
    locator: official setup guidance on repeated prompts and updating extensions; retrieved 2026-08-26
    relationship: generalized_principle
validation:
  status: not_validated
revisit:
  required: false
agent_snippet: After structural validation, exercise a complex skill on representative tasks and revise it from observed routing or decision failures.
---

# Validate real skill usage

Run the package or frontmatter checks first, then decide whether realistic use
would add confidence. For a complex or consequential skill, use representative
tasks to test activation, context loading, permissions, outputs, and failure
boundaries.

Do not confuse a clean parser result with proof that the capability makes good
decisions. Conversely, a tiny self-contained skill does not need a large test
suite merely because it is packaged as a skill.

## Evidence trail

- [CODEX-SKILL-VALIDATION](../../research/sources/codex.md#codex-skill-validation): structural validation versus useful behavior.
- [CLAUDE-SKILL-SURFACE](../../research/sources/claude-code.md#claude-skill-surface): repeated triggers as a signal to revise an extension.
