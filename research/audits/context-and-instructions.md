# Context & Instructions audit

Status: completed initial category audit
Evidence policy: paraphrase plus pinned link and locator
Next category: Agent & Skill Design

This audit translates source observations into reusable engineering principles. A disposition applies to the evaluated principle within this category; it is not a blanket rating of the original vendor implementation.

## Initial practice decisions

| Practice | Evaluated subject | Disposition | Horizon | Evidence | Decision |
| --- | --- | --- | --- | --- | --- |
| Search existing repository capabilities before adding a helper | Generalized principle | ADAPT | V1 | [Codex guide](../sources/codex.md#codex-agents-guide), [Claude hierarchy](../sources/claude-code.md#claude-memory-hierarchy) | Inspect first, but do not turn the heuristic into a ban on new abstractions when the repository lacks the needed capability. |
| Test meaningful behavior and risk | Generalized principle | ADOPT | V1 | [Codex guide](../sources/codex.md#codex-agents-guide) | Verification should protect behavior and risk, not an arbitrary line-count threshold. |
| Test real wiring and call paths | Generalized principle | ADOPT | V1 | [Codex implementation](../sources/codex.md#codex-agents-implementation), [Claude local context](../sources/claude-code.md#claude-local-context) | A repository-aware change needs evidence that the actual path works, not only an isolated unit. |
| Inspect repository structure and declared commands before acting | Generalized principle | ADOPT | V1 | [Codex implementation](../sources/codex.md#codex-agents-implementation), [Claude hierarchy](../sources/claude-code.md#claude-memory-hierarchy) | Effective context depends on root, scope, path, and available repository evidence. |
| Use a real repository verification gate | Generalized principle | ADAPT | V1 | [Codex guide](../sources/codex.md#codex-agents-guide), [Claude enforcement boundary](../sources/claude-code.md#claude-enforcement-boundary) | Require the repository's real checks, but let each repository define the appropriate gate rather than prescribing one universal command. |
| Prefer proportional changes and avoid speculative refactors | Generalized principle | ADAPT | V1 | [Claude local context](../sources/claude-code.md#claude-local-context) | Keep scope visible and evidence-based while allowing a necessary refactor when the change cannot be correct without it. |
| Put deterministic requirements in deterministic controls | Observed control distinction | ADOPT | V1 | [Claude enforcement boundary](../sources/claude-code.md#claude-enforcement-boundary), [Codex trust boundary](../sources/codex.md#codex-trust-boundary) | Classify advisory guidance separately from hooks, CI, permissions, and approvals. |
| Make completion claims match evidence | Generalized principle | ADOPT | V1 | [Codex trust boundary](../sources/codex.md#codex-trust-boundary), [Claude enforcement boundary](../sources/claude-code.md#claude-enforcement-boundary) | A green check, a source inspection, and a live acceptance result are different claims. Report only what the evidence proves. |

## Scope and exclusions

This first audit does not perform the next Agent & Skill Design category. It also does not establish a universal coding style, require tests for every tiny change, or replace repository-specific judgment. The cards are recommendations and translation aids; deterministic enforcement belongs in the consuming repository's own controls.

The source register is intentionally narrow for the MVP. Additional public repositories may be audited after the source/evidence/card/release pipeline has proved stable.
