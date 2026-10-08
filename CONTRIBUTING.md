# Contributing

Most changes add or revise a practice card, a source record, or a skill-repo record. The pane and skills live in `plugin/`, and the CLI in `src/`.

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

## Skill-repo records

To propose a skill repository, follow `research/skill-repos/README.md`. A maintainer approves each record before it is listed.

## Validation

Run the local checks before submitting a change:

```bash
npm install
npm test
```

After changing cards, skill-repo records, fit rules, or the package version, run `npm run build:catalog` and commit the updated `plugin/catalog.json`; `npm test` fails when it is stale.

When you change anything under `plugin/hooks`, also run `claude plugin test plugin`; CI runs it with `claude plugin validate`.

### Upstream drift

```bash
npm run check:sources
npm run check:skill-repos
```

`check:sources` compares each card's commit-pinned sources with the current heads of their repositories through the GitHub API. A drifted `validated` card should move to `needs_review` and be re-audited. `check:skill-repos` reads each listed skill repository and reports it if it was renamed, archived, or removed, if its license no longer matches the record, or if its README or `.claude-plugin/marketplace.json` changed since the pinned commit. It exits `1` when something needs a look, and `2` when a repository is gone, renamed, archived, or relicensed, loses its license or its pinned commit, or a lookup fails. Both commands only read. Set `GITHUB_TOKEN` to stay within GitHub's rate limit.

The Upstream watch workflow runs both every Monday and keeps one issue labelled `upstream-drift` up to date, closing it when a run finds nothing.

### Validation provenance

After using a card's practice in a real repository, print a `validated_against` block for it from the current source pins, ready to paste into the card:

```bash
npm run scaffold:validation -- GE-VF-003
```

It runs offline and never edits the card; recording the validation claim is the maintainer's call. Add `--check` to see whether a `validated` card's block still matches the pins. It works even when `npm test` is failing on other cards, so you can fix one card's provenance before the rest.

## Review standard

Changes to the evidence model are reviewed for source fidelity, licensing, broken links, unfinished-work markers, and accidental disclosure of private context.

Reviewers should be able to answer three questions:

1. What is being suggested?
2. What exact source observation supports it?
3. What boundary prevents the suggestion from being over-applied?
