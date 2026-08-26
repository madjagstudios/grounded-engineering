---
record_type: practice
schema_version: 1.0.0
id: GE-VF-001
title: Use the real verification gate
category: Verification
subcategory: Repository checks
pattern: Run the repository's real verification gate before claiming a change is complete.
underlying_principle: Completion requires evidence from the checks and acceptance conditions that actually govern the changed behavior.
observed_implementation: Codex and Claude Code distinguish instructions from deterministic controls and expose context used for a run.
applicability: [AI_ASSISTED, TRADITIONAL, REPOSITORY_GOVERNANCE]
control_types: [DETERMINISTIC_CHECK, HOOK, CI, APPROVAL]
disposition: ADAPT
rationale: A real gate makes evidence repeatable, but the consuming repository must define which checks and human acceptance conditions are authoritative.
proposed_implementation: Discover the repository's declared checks, run the relevant gate, record the result, and identify any unrun acceptance lane explicitly.
delivery_horizon: V1
confidence: high
evidence_level: recommended
source_ids: [CODEX-AGENTS-GUIDE, CLAUDE-ENFORCEMENT-BOUNDARY]
evidence_refs:
  - source_id: CODEX-AGENTS-GUIDE
    locator: official guide section `How Codex discovers guidance`
    relationship: generalized_principle
  - source_id: CLAUDE-ENFORCEMENT-BOUNDARY
    locator: official memory documentation sections on hooks, settings, and enforcement; retrieved 2026-08-26
    relationship: generalized_principle
validation:
  status: not_validated
  note: Local validation has not yet been performed in a consuming repository.
revisit:
  required: false
  trigger: Revisit after source re-audit or local validation evidence.
agent_snippet: Run the repository's declared verification gate and report exactly what passed, what was skipped, and what remains unverified.
---

# Use the real verification gate

Find the repository's declared verification command or acceptance gate and run the checks relevant to the change. Report the exact result and any skipped lane; a nearby substitute check is not equivalent evidence.

## Evidence trail

- [CODEX-AGENTS-GUIDE](../../research/sources/codex.md#codex-agents-guide): verification sections.
- [CLAUDE-ENFORCEMENT-BOUNDARY](../../research/sources/claude-code.md#claude-enforcement-boundary): hooks and enforcement sections.
