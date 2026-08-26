# Agent & Skill Design audit

Status: completed initial category audit
Evidence policy: paraphrase plus pinned link and locator
Sources: OpenAI Codex and Anthropic Claude Code

This audit evaluates how reusable agent capabilities are shaped, discovered,
delegated, and verified. A disposition applies to the evaluated principle
within this category; it is not a blanket rating of either source.

## Initial practice decisions

| Practice | Disposition | Decision |
| --- | --- | --- |
| Keep skill entrypoints lean and disclose detail progressively | ADOPT | Put only routing, essential constraints, and the current workflow in the entrypoint; move conditional detail into references when that reduces context cost. |
| Write discriminating activation descriptions | ADOPT | Treat names and descriptions as an interface: describe the real capability and trigger, and exclude adjacent work only when it prevents misrouting. |
| Choose the control surface by the guarantee required | ADOPT | Use skills for reusable reasoning and workflows, subagents for isolated specialization, and hooks or other deterministic controls for invariant behavior. |
| Bound delegated work by capability and isolation | ADAPT | Use least-privilege tools, permissions, turn limits, and worktree isolation where appropriate, but let the consuming repository set the authority and risk thresholds. |
| Validate a reusable capability through realistic use | ADAPT | Structural checks are necessary but not sufficient; forward-test complex or high-impact skills and revise them from observed failures without making every small skill carry a formal test suite. |

## Scope and exclusions

This category does not prescribe one vendor's folder layout, permission model,
model choice, or invocation syntax. It does not treat automatic activation as
always desirable, and it does not turn a skill into a substitute for a hook,
CI check, permission boundary, or human approval when those controls are
required.

The initial cards are recommendations. Their public validation status remains
`not_validated` until they are exercised in representative consuming work.
