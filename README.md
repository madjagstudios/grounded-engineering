# Grounded Engineering

Grounded Engineering is a source-backed catalog of practical engineering habits for professional software development, including AI-assisted development, traditional development, and repository onboarding.

The project turns observations from mature engineering and agent repositories into small, reviewable practices. Each recommendation keeps its evidence, scope, confidence, and validation status visible so contributors can improve it instead of treating it as unexplained doctrine.

## Repository layers

```text
research/       Source observations, pinned references, and category audits
practices/      Short, reusable engineering-practice cards
integrations/   Consumer-specific translation guidance for agent instruction files
scripts/        Deterministic local validation
```

The layers are intentionally separate. Research preserves provenance and decision history; practice cards are the concise consumption surface; integrations explain how to adapt cards to a local repository without creating another source of truth.

## Current status

`v0.1.0` is the first release. The first category is Context & Instructions, and the initial source families are OpenAI Codex and Anthropic Claude Code. The repository currently focuses on eight practices around repository context, code quality, testing, and verification.

The recommendations are point-in-time observations against pinned sources. Source changes do not silently rewrite cards; re-auditing is a deliberate maintenance step.

## Use it

1. Read the relevant card in [`practices/`](practices/).
2. Follow its evidence links and review its applicability and boundaries.
3. Translate only the needed guidance into your repository's canonical policy and agent adapters.
4. Put deterministic requirements in hooks, CI, permissions, or approval workflows rather than relying on prose alone.
5. Run the local validator before proposing a change.

```bash
npm install
npm test
```

The validator is local and deterministic. It does not fetch sources or make repository changes.

## Evidence posture

The default public evidence form is a paraphrase with an immutable source link and a locator such as a section heading, file path, or pinned commit. Verbatim excerpts are exceptional and require an explicit redistribution decision. Large vendor prompt files and instruction documents are not copied into this repository.

Every practice identifies whether it is observed, recommended, or locally validated. Validation notes are generalized and do not disclose private repository names, paths, tracker IDs, or other internal details.

## Contributing

Start with [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`research/README.md`](research/README.md). Contributions should improve the evidence, the practice, or the translation boundary without collapsing those layers together.

## License

Original repository content is available under the [MIT License](LICENSE). Third-party sources remain subject to their own licenses and terms; links, attribution, and redistribution decisions are recorded with the evidence.
