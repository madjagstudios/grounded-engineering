---
record_type: practice
schema_version: 1.0.0
id: GE-VF-003
title: Decide permission separately from the action
category: Verification
subcategory: Authorization
pattern: Compute whether an action is allowed with an explicit policy, separate from the code that performs it.
underlying_principle: An action's authorization is a distinct concern from its execution and should be decidable and testable on its own.
observed_implementation: A safety assessment returns auto-approve, ask-user, or reject for a write action, computed from the approval policy, permission profile, writable roots, and sandbox availability before the action runs.
applicability: [AI_ASSISTED, TRADITIONAL, REPOSITORY_GOVERNANCE]
control_types: [DETERMINISTIC_CHECK, APPROVAL, HUMAN_REVIEW]
disposition: ADOPT
rationale: Separating the allow, ask, or reject decision from the action makes authorization auditable and lets risky or non-conforming writes route to approval or refusal instead of running unchecked.
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
agent_snippet: Before an escalating or irreversible action, compute an explicit allow/ask/reject verdict from policy, profile, and sandbox availability, and route risky writes to approval rather than running them unchecked.
---

# Decide permission separately from the action

Use this when an agent performs actions with real consequences — writing files, running commands, escaping a sandbox. Compute a verdict (allow, ask, or reject) from explicit policy before acting, so authorization is auditable and risky or non-conforming actions are refused or escalated rather than performed. The boundary: keep the policy narrow and explicit; a decision function that grows to re-encode the whole action's logic has lost the separation it was meant to provide.

## Evidence trail

- [CODEX-SAFETY-POLICY](../../research/sources/codex.md#codex-safety-policy): the three-way safety verdict computed separately from applying the action.
