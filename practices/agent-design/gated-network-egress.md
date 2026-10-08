---
record_type: practice
schema_version: 1.0.0
id: GE-AS-006
title: Gate network egress from agent-run work
category: Agent & Skill Design
subcategory: Capability scoping
pattern: Treat network access from agent-run work as a capability that an enforcing proxy and an explicit policy decide on, not an ambient default.
underlying_principle: Network egress carries its own risk and deserves its own decision.
observed_implementation: When managed network enforcement is active, an execution-scoped proxy and a policy decider allow a request, deny it, or route it to approval; when enforcement is inactive, the tool does not mediate.
applicability: [AI_ASSISTED, REPOSITORY_GOVERNANCE]
control_types: [PERMISSION, APPROVAL, DETERMINISTIC_CHECK]
disposition: ADAPT
rationale: A per-request decision contains exfiltration and supply-chain risk that open network access leaves in place.
delivery_horizon: V1
confidence: medium
evidence_level: recommended
source_ids: [CODEX-NETWORK-CAPABILITY]
evidence_refs:
  - source_id: CODEX-NETWORK-CAPABILITY
    locator: network_approval.rs:625-820, 1095-1217 for the allow/deny/approval decision, the approval request, and the execution-scoped proxy construction
    relationship: observed_implementation
validation:
  status: validated
  validated_against:
    - source_id: CODEX-NETWORK-CAPABILITY
      revisions:
        - 515c291d875e07faa64e3fa43dc9bbffed8db31f
revisit:
  required: false
agent_snippet: Send network access from agent-run code through an enforcing proxy and an explicit allow, deny, or approve policy, and confirm a proxy is actually in the path before relying on it.
---

# Gate network egress from agent-run work

Use this when agent-run code or commands can reach the network. Put an
enforcing proxy in the request path and let an explicit policy allow the
request, deny it, or ask for approval. Work that needs the network, such as
installing dependencies or calling a declared API, should get a scoped grant:
the aim is a deliberate decision, not a blanket block that people learn to
switch off.

The boundary is the proxy itself. Without one in the path there is nothing to
gate, and telemetry showing that a request happened is not a durable audit
record.

## Evidence trail

- [CODEX-NETWORK-CAPABILITY](../../research/sources/codex.md#codex-network-capability): the policy decider and execution-scoped proxy that mediate agent network access when managed enforcement is active.
