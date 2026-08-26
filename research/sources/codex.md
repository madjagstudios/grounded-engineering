# OpenAI Codex source observations

This file records link-first observations from public OpenAI Codex guidance and the pinned `openai/codex` repository. It does not reproduce the repository's instruction files or source code.

Retrieval date for the documentation pages: 2026-08-25. Repository observations are pinned to commit `dc08ace7821614a702b1214c9d08ae0db2634d82`.

## CODEX-AGENTS-GUIDE

- Source: OpenAI Codex, [repository instruction guide](https://developers.openai.com/codex/guides/agents-md)
- Immutable reference: documentation page retrieved 2026-08-25
- Locator: sections describing discovery order, nested scope, fallback filenames, and verification
- License/use: official vendor documentation; `link-only`; no verbatim redistribution
- Observed implementation: Codex resolves repository instruction files through documented scope and filename rules before using them as task context.
- Generalizable principle: repository guidance should be discoverable, scoped, and explainable before an agent acts.

## CODEX-AGENTS-IMPLEMENTATION

- Source: `openai/codex`, [`codex-rs/core/src/agents_md.rs`](https://github.com/openai/codex/blob/dc08ace7821614a702b1214c9d08ae0db2634d82/codex-rs/core/src/agents_md.rs)
- Immutable reference: commit `dc08ace7821614a702b1214c9d08ae0db2634d82`
- Locator: `agents_md.rs`, root detection, candidate ordering, byte-budget handling, and provenance-bearing load results
- License/use: repository Apache-2.0; `link-only` for this repository; concepts are paraphrased
- Observed implementation: the loader makes root selection, candidate order, size limits, and loaded-source metadata explicit in code.
- Generalizable principle: context resolution should expose the inputs and constraints that determine the effective instruction set.

## CODEX-TRUST-BOUNDARY

- Source: `openai/codex`, [Guardian reviewer policy](https://github.com/openai/codex/blob/dc08ace7821614a702b1214c9d08ae0db2634d82/codex-rs/ext/guardian-v2/src/sync_reviewer/policy_template.md)
- Immutable reference: commit `dc08ace7821614a702b1214c9d08ae0db2634d82`
- Locator: policy sections separating authorization evidence from implementation evidence and tool output
- License/use: repository Apache-2.0; `link-only` for this repository; no policy text copied
- Observed implementation: the reviewer policy treats tool output and implementation content as evidence that must not silently expand authorization.
- Generalizable principle: relevance, trust, and authorization are separate dimensions.
