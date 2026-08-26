# Contributing

Grounded Engineering is a research-backed documentation project. A useful contribution is specific, bounded, and traceable from source observation to practical recommendation.

## Before opening a change

- Read the relevant research and practice cards.
- Search for an existing card or validation rule before adding a new one.
- Decide whether the change belongs in `research/sources/`, `research/audits/`, `practices/`, or `integrations/`.
- Keep private repository names, paths, tracker IDs, credentials, and internal policy out of public content.

## Evidence requirements

For new source-backed content, record:

- the source name and URL;
- an immutable commit, release, or retrieval date;
- a locator that lets a reviewer find the relevant section or file;
- the source license and whether redistribution is `link-only` or `quote-ok`;
- the observed implementation separately from the generalized principle;
- applicability, confidence, and validation status.

Paraphrase by default. A short quotation is an exception, not a substitute for analysis, and must be permitted by the source's license or terms. Do not copy full prompt files, large instruction files, or vendor documentation pages.

## Practice cards

Practice cards should be small enough to use during a real change. They should state the practice, explain its boundary, identify control types, link to evidence, and avoid turning a local preference into a universal rule. `ADOPT`, `ADAPT`, `REJECT`, and `DEFER` describe the evaluated principle in its category; they do not rate an entire vendor or repository.

## Validation

Run the local checks before submitting a change:

```bash
npm install
npm test
```

Changes to the evidence model must also be reviewed for source fidelity, licensing, broken links, temporary markers, and accidental disclosure of private context.

## Review standard

Reviewers should be able to answer three questions:

1. What is being suggested?
2. What exact source observation supports it?
3. What boundary prevents the suggestion from being over-applied?
