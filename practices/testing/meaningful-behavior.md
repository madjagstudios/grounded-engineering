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
delivery_horizon: V1
confidence: medium
evidence_level: recommended
source_ids: [CODEX-AGENTS-GUIDE, CLAUDE-ENFORCEMENT-BOUNDARY]
evidence_refs:
  - source_id: CODEX-AGENTS-GUIDE
    locator: official guide section `How Codex discovers guidance`
    relationship: generalized_principle
  - source_id: CLAUDE-ENFORCEMENT-BOUNDARY
    locator: official memory documentation sections distinguishing context from enforcement; retrieved 2026-08-26
    relationship: generalized_principle
validation:
  status: not_validated
revisit:
  required: false
agent_snippet: Test the changed behavior and its plausible failure modes; do not add tests solely to satisfy an arbitrary size threshold.
---

# Test meaningful behavior

Use this when deciding whether a small change needs a test. Cover the behavior and plausible failure modes; a file’s size or a numeric threshold is not itself a risk signal.

## Evidence trail

- [CODEX-AGENTS-GUIDE](../../research/sources/codex.md#codex-agents-guide): repository guidance and verification sections.
- [CLAUDE-ENFORCEMENT-BOUNDARY](../../research/sources/claude-code.md#claude-enforcement-boundary): guidance versus enforcement sections.
