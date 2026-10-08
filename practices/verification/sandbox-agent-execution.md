---
record_type: practice
schema_version: 1.0.0
id: GE-VF-004
title: Confine agent-executed commands in an OS sandbox
category: Verification
subcategory: Execution isolation
pattern: Run agent-executed commands inside an operating-system sandbox with a least-privilege policy.
underlying_principle: The operating system should enforce isolation, not the agent's judgment about what is safe to run.
observed_implementation: A sandboxing crate exposes platform sandbox managers (Landlock, Seatbelt, Windows) and filesystem and network violation recorders behind a common interface.
applicability: [AI_ASSISTED, REPOSITORY_GOVERNANCE]
control_types: [DETERMINISTIC_CHECK, PERMISSION]
disposition: ADAPT
rationale: Where a supported sandbox backend is enabled, it limits what an agent-run command can reach whatever the agent intended, and recorded violations make over-broad access visible.
delivery_horizon: V1
confidence: medium
evidence_level: recommended
source_ids: [CODEX-SANDBOX-ISOLATION]
evidence_refs:
  - source_id: CODEX-SANDBOX-ISOLATION
    locator: lib.rs:1-48 for the module surface — platform sandbox managers and filesystem/network violation recorders re-exported behind a common interface
    relationship: observed_implementation
validation:
  status: validated
  validated_against:
    - source_id: CODEX-SANDBOX-ISOLATION
      revisions:
        - 03861e69ef549717c0fc7045abad56321d4a082b
revisit:
  required: false
agent_snippet: Run agent-executed commands in a least-privilege OS sandbox where one is available, surface violations instead of widening the policy, and treat "no sandbox available" as a case that fails safe, not as permission to run unconfined.
---

# Confine agent-executed commands in an OS sandbox

Use this when an agent runs shell commands or generated code. Confine it with
an operating-system sandbox scoped to least privilege, and treat recorded
violations as a signal, so a mistaken or malicious command is stopped by the
platform rather than by trust.

The boundary is availability. Platform selection can resolve to no sandbox,
and that case has to fail safe. A policy widened until nothing is denied
isolates nothing, so tighten it and surface the violation instead of relaxing
it to get a task through.

## Evidence trail

- [CODEX-SANDBOX-ISOLATION](../../research/sources/codex.md#codex-sandbox-isolation): the re-exported platform sandbox managers and violation recorders.
