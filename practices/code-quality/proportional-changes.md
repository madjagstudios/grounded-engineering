---
record_type: practice
schema_version: 1.0.0
id: GE-CQ-002
title: Make proportional changes
category: Code Quality
subcategory: Change scope
pattern: Keep a change limited to the behavior and evidence needed for the task.
underlying_principle: Prefer the smallest complete change over speculative cleanup or unrelated refactoring.
observed_implementation: Codex skill guidance directs authors to scope work to the requested task, include only what changes the outcome, and avoid expanding the assignment or modifying unrelated configuration.
applicability: [AI_ASSISTED, TRADITIONAL, REPOSITORY_GOVERNANCE]
control_types: [ADVISORY, HUMAN_REVIEW]
disposition: ADAPT
rationale: Narrow scope reduces review and regression risk, but a necessary refactor is appropriate when the requested behavior cannot be correct without it.
delivery_horizon: V1
confidence: medium
evidence_level: recommended
source_ids: [CODEX-SKILL-DESIGN]
evidence_refs:
  - source_id: CODEX-SKILL-DESIGN
    locator: SKILL.md:14-20 for scoping work to the task, removing speculative detail, and matching specificity to the risk
    relationship: generalized_principle
validation:
  status: validated
  validated_against:
    - source_id: CODEX-SKILL-DESIGN
      revisions:
        - f5420174dafba153913a3e697f89002c338dfd7e
revisit:
  required: false
agent_snippet: Keep the change proportional to the requested behavior; separate required refactoring from unrelated cleanup.
---

# Make proportional changes

Use this when a task touches more than the requested behavior. Include refactoring required for correctness; defer optional cleanup, speculative abstractions, and style migrations so the change remains reviewable.

## Evidence trail

- [CODEX-SKILL-DESIGN](../../research/sources/codex.md#codex-skill-design): scoping work to the task and matching specificity to the risk.
