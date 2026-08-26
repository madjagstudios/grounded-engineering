---
record_type: practice
schema_version: 1.0.0
id: GE-TS-001
title: Test meaningful behavior
category: Testing
subcategory: Risk-based coverage
pattern: Test behavior and risk rather than an arbitrary test-count or line-count target.
underlying_principle: Verification effort should be proportional to the behavior and failure modes changed.
observed_implementation: Agent guidance is treated as scoped context that influences work selection and verification, not as a universal numeric quality threshold.
applicability: [AI_ASSISTED, TRADITIONAL, REPOSITORY_GOVERNANCE]
control_types: [ADVISORY, DETERMINISTIC_CHECK, HUMAN_REVIEW]
disposition: ADOPT
rationale: Behavior-focused tests provide stronger evidence than coverage theater while preserving room for judgment on genuinely trivial changes.
proposed_implementation: Identify changed behavior and plausible regressions, then add or update the smallest tests that exercise those risks.
delivery_horizon: V1
confidence: medium
evidence_level: recommended
source_ids: [CODEX-AGENTS-GUIDE, CLAUDE-ENFORCEMENT-BOUNDARY]
evidence_refs:
  - source_id: CODEX-AGENTS-GUIDE
    locator: repository instruction guide sections on guidance and verification
    relationship: generalized_principle
  - source_id: CLAUDE-ENFORCEMENT-BOUNDARY
    locator: memory documentation sections distinguishing guidance from enforcement
    relationship: generalized_principle
validation:
  status: not_validated
  note: Local validation has not yet been performed in a consuming repository.
revisit:
  required: false
  trigger: Revisit after source re-audit or local validation evidence.
agent_snippet: Test the changed behavior and its plausible failure modes; do not add tests solely to satisfy an arbitrary size threshold.
---

# Test meaningful behavior

Start from the behavior changed and the failure modes that matter. Add tests that make those risks observable; do not create a test solely because a file is small or because a numeric threshold says one is expected.

This card is a derived recommendation and does not claim that the cited vendor documents prescribe a universal test-count rule.

## Evidence trail

- [CODEX-AGENTS-GUIDE](../../research/sources/codex.md#codex-agents-guide): repository guidance and verification sections.
- [CLAUDE-ENFORCEMENT-BOUNDARY](../../research/sources/claude-code.md#claude-enforcement-boundary): guidance versus enforcement sections.
