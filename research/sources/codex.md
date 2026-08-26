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
