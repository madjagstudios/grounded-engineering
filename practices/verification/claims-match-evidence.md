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
proposed_implementation: Label each completion claim with its evidence lane and state remaining uncertainty instead of converting a partial check into a full success claim.
delivery_horizon: V1
confidence: high
evidence_level: recommended
source_ids: [CODEX-TRUST-BOUNDARY, CLAUDE-ENFORCEMENT-BOUNDARY]
evidence_refs:
  - source_id: CODEX-TRUST-BOUNDARY
    locator: Guardian policy sections separating authorization evidence from implementation evidence
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
agent_snippet: Make each completion claim match the evidence lane that actually passed, and name any unverified lane.
---

# Match claims to evidence

Separate repository inspection, automated checks, deployment evidence, and live acceptance. Report each one precisely, and name the remaining uncertainty rather than allowing a partial result to sound like a full completion claim.

## Evidence trail

- [CODEX-TRUST-BOUNDARY](../../research/sources/codex.md#codex-trust-boundary): authorization and implementation evidence.
- [CLAUDE-ENFORCEMENT-BOUNDARY](../../research/sources/claude-code.md#claude-enforcement-boundary): guidance and enforcement.
