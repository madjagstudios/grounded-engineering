---
record_type: practice
schema_version: 1.0.0
id: GE-VF-003
title: Decide permission separately from the action
category: Verification
subcategory: Authorization
pattern: Decide whether an action is allowed with an explicit policy, separate from the code that performs it.
underlying_principle: Authorization is a different concern from execution, and should be decidable and testable on its own.
observed_implementation: A safety assessment returns auto-approve, ask-user, or reject for a write action, computed from the approval policy, permission profile, writable roots, and sandbox availability before the action runs.
applicability: [AI_ASSISTED, TRADITIONAL, REPOSITORY_GOVERNANCE]
control_types: [DETERMINISTIC_CHECK, APPROVAL, HUMAN_REVIEW]
disposition: ADOPT
rationale: A separate allow, ask, or reject verdict makes authorization auditable and sends risky writes to approval or refusal instead of letting them run.
delivery_horizon: V1
confidence: medium
evidence_level: recommended
source_ids: [CODEX-SAFETY-POLICY]
evidence_refs:
  - source_id: CODEX-SAFETY-POLICY
    locator: safety.rs:19-97, 100-188 for the three-way verdict, its policy inputs, and the rejection-reason helpers
    relationship: observed_implementation
validation:
  status: validated
  validated_against:
    - source_id: CODEX-SAFETY-POLICY
      revisions:
        - 03861e69ef549717c0fc7045abad56321d4a082b
revisit:
  required: false
agent_snippet: Before an escalating or irreversible action, compute an allow, ask, or reject verdict from explicit policy, and send risky writes to approval instead of running them.
---

# Decide permission separately from the action

Use this when an agent takes actions with real consequences, such as writing
files, running commands or leaving a sandbox. Compute the verdict (allow, ask
or reject) from explicit policy before acting, so the decision can be read,
tested and audited apart from the action.

The boundary is keeping the policy narrow. A decision function that grows to
re-implement the action has lost the separation it was there to provide.

## Evidence trail

- [CODEX-SAFETY-POLICY](../../research/sources/codex.md#codex-safety-policy): the three-way safety verdict computed separately from applying the action.
