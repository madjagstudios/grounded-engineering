---
record_type: practice
schema_version: 1.0.0
id: GE-VF-002
title: Match claims to evidence
category: Verification
subcategory: Reporting
pattern: Describe completion, validation, and acceptance only as strongly as the evidence supports.
underlying_principle: A source inspection, automated check, deployment observation, and live acceptance result prove different things.
observed_implementation: Codex trust guidance separates authorization evidence from untrusted implementation or tool content; Claude Code separates guidance from enforcement.
applicability: [AI_ASSISTED, TRADITIONAL, ONBOARDING, REPOSITORY_GOVERNANCE]
control_types: [ADVISORY, DETERMINISTIC_CHECK, HUMAN_REVIEW, APPROVAL]
disposition: ADOPT
rationale: Evidence-scoped reporting prevents false confidence and preserves the distinction between what was inspected, tested, deployed, and accepted.
delivery_horizon: V1
confidence: high
evidence_level: recommended
source_ids: [CODEX-TRUST-BOUNDARY, CLAUDE-ENFORCEMENT-BOUNDARY]
evidence_refs:
  - source_id: CODEX-TRUST-BOUNDARY
    locator: policy_template.md:5-13, :15-26, and :64-76 for evidence handling, authorization, and outcome policy
    relationship: generalized_principle
  - source_id: CLAUDE-ENFORCEMENT-BOUNDARY
    locator: official memory documentation sections distinguishing guidance from enforcement; retrieved 2026-08-26
    relationship: generalized_principle
validation:
  status: not_validated
revisit:
  required: false
agent_snippet: Make each completion claim match the evidence lane that actually passed, and name any unverified lane.
---

# Match claims to evidence

Use this when a result could be mistaken for a stronger result. Keep repository inspection, automated checks, deployment evidence, and live acceptance separate, and name the unverified lane.

## Evidence trail

- [CODEX-TRUST-BOUNDARY](../../research/sources/codex.md#codex-trust-boundary): authorization and implementation evidence.
- [CLAUDE-ENFORCEMENT-BOUNDARY](../../research/sources/claude-code.md#claude-enforcement-boundary): guidance and enforcement.
