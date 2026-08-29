# OpenAI Codex source observations

This file records link-first observations from public OpenAI Codex guidance and the pinned `openai/codex` repository. It does not reproduce the repository's instruction files or source code.

Retrieval date for the documentation pages: 2026-08-26. Repository observations are pinned to commit `dc08ace7821614a702b1214c9d08ae0db2634d82`.

## CODEX-AGENTS-GUIDE

- Source: OpenAI Codex, [repository instruction guide](https://developers.openai.com/codex/guides/agents-md#how-codex-discovers-guidance)
- Immutable reference: official documentation page retrieved 2026-08-26; page content is unversioned and requires deliberate re-audit when changed
- Locator: `How Codex discovers guidance` section, including discovery precedence and one-file-per-directory behavior
- License/use: official vendor documentation; `link-only`; no verbatim redistribution
- Observed implementation: Codex resolves repository instruction files through documented scope and filename rules before using them as task context.
- Generalizable principle: repository guidance should be discoverable, scoped, and explainable before an agent acts.

## CODEX-AGENTS-IMPLEMENTATION

- Source: `openai/codex`, [`codex-rs/core/src/agents_md.rs`](https://github.com/openai/codex/blob/dc08ace7821614a702b1214c9d08ae0db2634d82/codex-rs/core/src/agents_md.rs#L1-L16)
- Immutable reference: commit `dc08ace7821614a702b1214c9d08ae0db2634d82`
- Locator: `agents_md.rs:1-16` for root traversal and concatenation; `:39-46` for default/override names; `:53-65` for untrusted-project handling; `:115-183` for bounded reads, truncation, and source provenance; `:185-187` for inclusive root-to-working-directory discovery
- License/use: repository Apache-2.0; `link-only` for this repository; concepts are paraphrased
- Observed implementation: the loader makes root selection, candidate order, size limits, and loaded-source metadata explicit in code.
- Generalizable principle: context resolution should expose the inputs and constraints that determine the effective instruction set.

## CODEX-TRUST-BOUNDARY

- Source: `openai/codex`, [Guardian reviewer policy](https://github.com/openai/codex/blob/dc08ace7821614a702b1214c9d08ae0db2634d82/codex-rs/ext/guardian-v2/src/sync_reviewer/policy_template.md#L5-L13)
- Immutable reference: commit `dc08ace7821614a702b1214c9d08ae0db2634d82`
- Locator: `policy_template.md:5-13` for trusted versus untrusted evidence; `:15-26` for authorization scoring and avoiding over-interpretation; `:64-76` for outcome handling
- License/use: repository Apache-2.0; `link-only` for this repository; no policy text copied
- Observed implementation: the reviewer policy treats tool output and implementation content as evidence that must not silently expand authorization.
- Generalizable principle: relevance, trust, and authorization are separate dimensions.

## CODEX-SKILL-DESIGN

- Source: `openai/codex`, [skill creator](https://github.com/openai/codex/blob/f5420174dafba153913a3e697f89002c338dfd7e/codex-rs/skills/src/assets/samples/skill-creator/SKILL.md)
- Immutable reference: commit `f5420174dafba153913a3e697f89002c338dfd7e`
- Locator: `SKILL.md:10-28` for non-obvious, scoped guidance and progressive disclosure; `:30-46` for the minimal skill anatomy
- License/use: repository Apache-2.0; `link-only`; concepts are paraphrased
- Observed implementation: the skill guidance keeps entrypoints focused, moves conditional detail into references, and avoids ancillary files without a concrete use.
- Generalizable principle: reusable agent capabilities should expose only the context and structure needed for the current task.

## CODEX-SKILL-DESCRIPTION

- Source: `openai/codex`, [skill creator](https://github.com/openai/codex/blob/f5420174dafba153913a3e697f89002c338dfd7e/codex-rs/skills/src/assets/samples/skill-creator/SKILL.md)
- Immutable reference: commit `f5420174dafba153913a3e697f89002c338dfd7e`
- Locator: `SKILL.md:48-60` for frontmatter, loading stages, and entrypoint scope; `:189-201` for descriptions and instruction boundaries
- License/use: repository Apache-2.0; `link-only`; concepts are paraphrased
- Observed implementation: skill names and descriptions are treated as the pre-load discovery surface, while detailed procedures remain in the body or references.
- Generalizable principle: activation metadata is an interface and should be concise, discriminating, and honest about when a capability applies.

## CODEX-SKILL-VALIDATION

- Source: `openai/codex`, [skill creator](https://github.com/openai/codex/blob/f5420174dafba153913a3e697f89002c338dfd7e/codex-rs/skills/src/assets/samples/skill-creator/SKILL.md)
- Immutable reference: commit `f5420174dafba153913a3e697f89002c338dfd7e`
- Locator: `SKILL.md:203-219` for structural validation, realistic use, and iterative improvement
- License/use: repository Apache-2.0; `link-only`; concepts are paraphrased
- Observed implementation: the guidance distinguishes frontmatter validation from proving that a skill makes good decisions, then recommends real usage and targeted iteration when complexity warrants it.
- Generalizable principle: a valid skill package is not necessarily a useful skill; behavioral validation should match risk and complexity.

## CODEX-PATCH-FORMAT

- Source: `openai/codex`, [`apply-patch/src/parser.rs`](https://github.com/openai/codex/blob/03861e69ef549717c0fc7045abad56321d4a082b/codex-rs/apply-patch/src/parser.rs)
- Immutable reference: commit `03861e69ef549717c0fc7045abad56321d4a082b`
- Locator: `parser.rs:1-2, 6-25, 145-210` for the module's own statement that it does not check filesystem applicability, the explicit patch grammar, and the parse-into-hunks logic
- License/use: repository Apache-2.0; `link-only`; concepts are paraphrased
- Observed implementation: the module parses a patch into typed hunks against an explicit grammar; its own doc comment states it does not check whether the patch can be applied to the filesystem, so applicability is resolved separately at apply time rather than during parsing.
- Generalizable principle: agent-generated edits should be expressed in an explicit, parseable format with surrounding context, so a malformed edit is rejected during parsing and the target's applicability is validated before mutation, instead of silently corrupting files.

## CODEX-SAFETY-POLICY

- Source: `openai/codex`, [`core/src/safety.rs`](https://github.com/openai/codex/blob/03861e69ef549717c0fc7045abad56321d4a082b/codex-rs/core/src/safety.rs)
- Immutable reference: commit `03861e69ef549717c0fc7045abad56321d4a082b`
- Locator: `safety.rs:19-97, 100-188` for the three-way safety verdict, the assessment function's inputs, and the rejection-reason helpers
- License/use: repository Apache-2.0; `link-only`; concepts are paraphrased
- Observed implementation: a dedicated function returns one of auto-approve, ask-the-user, or reject-with-reason for a patch action, computed from the approval policy, permission profile, filesystem sandbox policy, and whether a platform sandbox can be enforced; a write constrained to writable roots may be auto-approved when a sandbox can contain it, asked about, or rejected depending on that combination, rather than uniformly rejected.
- Generalizable principle: whether an action is permitted should be computed by an explicit policy, separate from the code that performs the action, with risky or non-conforming actions routed to approval or refusal rather than performed unchecked.

## CODEX-NETWORK-CAPABILITY

- Source: `openai/codex`, [`core/src/tools/network_approval.rs`](https://github.com/openai/codex/blob/03861e69ef549717c0fc7045abad56321d4a082b/codex-rs/core/src/tools/network_approval.rs)
- Immutable reference: commit `03861e69ef549717c0fc7045abad56321d4a082b`
- Locator: `network_approval.rs:600-706, 1032-1136` for the policy decider's allow/deny/approval decision and the execution-scoped proxy construction
- License/use: repository Apache-2.0; `link-only`; concepts are paraphrased
- Observed implementation: when managed network enforcement is active, network access for agent-run work is mediated by an execution-scoped proxy and a policy decider that yields an allow, deny, or approval decision — an allowlist miss can enter the approval flow rather than being denied outright; when managed enforcement is inactive the approval path returns without mediating.
- Generalizable principle: treat network access from agent-executed work as a distinct capability mediated by an enforcing proxy and explicit policy — allowed, denied, or routed to approval — rather than an ambient default of running code.

## CODEX-SANDBOX-ISOLATION

- Source: `openai/codex`, [`sandboxing/src/lib.rs`](https://github.com/openai/codex/blob/03861e69ef549717c0fc7045abad56321d4a082b/codex-rs/sandboxing/src/lib.rs)
- Immutable reference: commit `03861e69ef549717c0fc7045abad56321d4a082b`
- Locator: `lib.rs:1-48` for the crate's module surface — the platform sandbox managers (Landlock, Seatbelt, Windows) and the filesystem/network violation recorders declared and re-exported behind a common interface
- License/use: repository Apache-2.0; `link-only`; concepts are paraphrased
- Observed implementation: the crate's root module declares and re-exports platform-specific sandbox backends (Landlock on Linux, Seatbelt on macOS, and a Windows backend) through a common `SandboxManager`, along with filesystem and network violation recorders; the enforcement and recording behavior itself lives in the backend modules, not this file, and platform selection can resolve to no sandbox.
- Generalizable principle: confine agent-executed commands in an operating-system sandbox with a least-privilege policy and recorded violations where a supported backend is enabled, so isolation is enforced by the platform rather than by the agent's judgment.
