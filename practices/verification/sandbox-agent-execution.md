---
record_type: practice
schema_version: 1.0.0
id: GE-VF-004
title: Confine agent-executed commands in an OS sandbox
category: Verification
subcategory: Execution isolation
pattern: Run agent-executed commands inside an operating-system sandbox with a least-privilege policy.
underlying_principle: Execution isolation should be enforced by the operating system, not by the agent's judgment about what is safe to run.
observed_implementation: A sandboxing crate exposes platform operating-system sandbox managers (Landlock, Seatbelt, Windows) and filesystem/network violation recorders behind a common interface.
applicability: [AI_ASSISTED, REPOSITORY_GOVERNANCE]
control_types: [DETERMINISTIC_CHECK, PERMISSION]
disposition: ADAPT
rationale: Where a supported OS sandbox backend is enabled, it contains the blast radius of an agent-run command regardless of the agent's intent, and recorded violations make over-broad access visible instead of silent.
delivery_horizon: V1
confidence: medium
evidence_level: recommended
source_ids: [CODEX-SANDBOX-ISOLATION]
evidence_refs:
  - source_id: CODEX-SANDBOX-ISOLATION
    locator: lib.rs:1-48 for the module surface — platform sandbox managers and filesystem/network violation recorders re-exported behind a common interface
    relationship: observed_implementation
validation:
  status: not_validated
revisit:
  required: false
agent_snippet: Run agent-executed commands inside an OS sandbox with least privilege where a supported backend is enabled, surface violations instead of widening the policy silently, and treat "no sandbox available" as fail-safe rather than permission to run unconfined.
---

# Confine agent-executed commands in an OS sandbox

Use this when an agent runs shell commands or executes generated code. Confine execution with an operating-system sandbox scoped to least privilege, and treat recorded violations as signal, so a mistaken or malicious command is contained by the platform rather than by trust. The boundary: this holds only where a supported OS backend is available and enabled — platform selection can resolve to no sandbox, and that case must fail safe rather than silently run unconfined. And a sandbox widened until nothing is denied provides no isolation — tighten the policy and surface violations rather than relaxing it to make a task pass.

## Evidence trail

- [CODEX-SANDBOX-ISOLATION](../../research/sources/codex.md#codex-sandbox-isolation): the re-exported platform sandbox managers and violation recorders.
