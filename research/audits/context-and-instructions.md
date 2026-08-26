# Context & Instructions audit

Status: completed initial category audit
Evidence policy: paraphrase plus pinned link and locator
Next category: Agent & Skill Design

This audit translates source observations into reusable engineering principles. A disposition applies to the evaluated principle within this category; it is not a blanket rating of the original vendor implementation.

## Initial practice decisions

| Practice | Disposition | Decision |
| --- | --- | --- |
| Search existing repository capabilities before adding a helper | ADAPT | Inspect first, but do not turn the heuristic into a ban on new abstractions when the repository lacks the needed capability. |
| Test meaningful behavior and risk | ADOPT | Verification should protect behavior and risk, not an arbitrary line-count threshold. |
| Test real wiring and call paths | ADOPT | A repository-aware change needs evidence that the actual path works, not only an isolated unit. |
| Inspect repository structure and declared commands before acting | ADOPT | Effective context depends on root, scope, path, and available repository evidence. |
| Use a real repository verification gate | ADAPT | Require the repository's real checks, but let each repository define the appropriate gate rather than prescribing one universal command. |
| Prefer proportional changes and avoid speculative refactors | ADAPT | Keep scope visible and evidence-based while allowing a necessary refactor when the change cannot be correct without it. |
| Put deterministic requirements in deterministic controls | ADOPT | Classify advisory guidance separately from hooks, CI, permissions, and approvals. |
| Make completion claims match evidence | ADOPT | A green check, a source inspection, and a live acceptance result are different claims. Report only what the evidence proves. |

## Scope and exclusions

This first audit does not perform the next Agent & Skill Design category. It also does not establish a universal coding style, require tests for every tiny change, or replace repository-specific judgment. The cards are recommendations and translation aids; deterministic enforcement belongs in the consuming repository's own controls.

The source register is intentionally narrow for the MVP. Additional public repositories may be audited after the source/evidence/card/release pipeline has proved stable.
