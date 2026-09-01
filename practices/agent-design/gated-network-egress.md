---
record_type: practice
schema_version: 1.0.0
id: GE-AS-006
title: Gate network egress from agent-run work
category: Agent & Skill Design
subcategory: Capability scoping
pattern: Treat network access from agent-executed work as a capability mediated by an enforcing proxy and policy — allowed, denied, or routed to approval — not an ambient default of running code.
underlying_principle: Network egress is a distinct capability with its own risk, not an ambient default of running code.
observed_implementation: When managed network enforcement is active, an execution-scoped proxy and policy decider allow a request, deny it, or route it to approval; when enforcement is inactive, the tool does not mediate.
applicability: [AI_ASSISTED, REPOSITORY_GOVERNANCE]
control_types: [PERMISSION, APPROVAL, DETERMINISTIC_CHECK]
disposition: ADAPT
rationale: Gating network egress through an enforcing proxy and explicit policy — allow, deny, or approve — contains exfiltration and supply-chain risk that ambient network access would leave open.
delivery_horizon: V1
confidence: medium
evidence_level: recommended
source_ids: [CODEX-NETWORK-CAPABILITY]
evidence_refs:
  - source_id: CODEX-NETWORK-CAPABILITY
    locator: network_approval.rs:600-706, 1032-1136 for the allow/deny/approval decision and the execution-scoped proxy construction
    relationship: observed_implementation
validation:
  status: validated
  validated_against:
    - source_id: CODEX-NETWORK-CAPABILITY
      revisions:
        - 03861e69ef549717c0fc7045abad56321d4a082b
revisit:
  required: false
agent_snippet: Route network access from agent-run code through an enforcing proxy and explicit policy — allow, deny, or approve — rather than leaving egress ambient, and confirm a real proxy is in the path before relying on the gate.
---

# Gate network egress from agent-run work

Use this when agent-executed code or commands can reach the network. Route egress through an enforcing proxy and an explicit policy — allow, deny, or approve — so exfiltration and untrusted-fetch risk is a mediated decision rather than ambient. A task that genuinely needs the network — installing dependencies, calling a declared API — should get a scoped, explicit grant; the goal is an explicit decision, not a blanket block that pushes people to disable the control. The boundary: this contains egress only where an enforcing proxy is actually in the request path — without one there is nothing to gate — and telemetry recording that a request happened is not the same as a durable audit record.

## Evidence trail

- [CODEX-NETWORK-CAPABILITY](../../research/sources/codex.md#codex-network-capability): the policy decider and execution-scoped proxy that mediate agent network access when managed enforcement is active.
