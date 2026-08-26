# Anthropic Claude Code source observations

This file records link-first observations from Anthropic's public Claude Code documentation. It does not claim that a public prompt library or a permissive license exists for all Claude Code instruction material.

Retrieval date: 2026-08-26. The documentation page is unversioned; these observations are point-in-time and require deliberate re-audit when the page changes.

## CLAUDE-MEMORY-HIERARCHY

- Source: Anthropic Claude Code, [memory and instruction documentation](https://code.claude.com/docs/en/memory)
- Immutable reference: official documentation page retrieved 2026-08-26
- Locator: the documentation sections on instruction-file scope, load order, and path-scoped rules
- License/use: official vendor documentation; `link-only`; no verbatim redistribution
- Observed implementation: Claude Code describes multiple instruction scopes, path-specific rules, imports, and context diagnostics as distinct mechanisms.
- Generalizable principle: guidance needs explicit scope, precedence, provenance, and visibility rather than being treated as undifferentiated prompt text.

## CLAUDE-LOCAL-CONTEXT

- Source: Anthropic Claude Code, [memory and instruction documentation](https://code.claude.com/docs/en/memory)
- Immutable reference: official documentation page retrieved 2026-08-26
- Locator: the documentation sections comparing persistent instructions with auto memory, scope, and load order
- License/use: official vendor documentation; `link-only`; no verbatim redistribution
- Observed implementation: local and durable context are described separately, and context diagnostics help users inspect what is available to the model.
- Generalizable principle: local context can be useful without becoming an invisible shared source of truth.

## CLAUDE-ENFORCEMENT-BOUNDARY

- Source: Anthropic Claude Code, [memory and instruction documentation](https://code.claude.com/docs/en/memory)
- Immutable reference: official documentation page retrieved 2026-08-26
- Locator: the documentation sections comparing guidance with enforcement, describing managed policy, and troubleshooting missed instructions
- License/use: official vendor documentation; `link-only`; no verbatim redistribution
- Observed implementation: the documentation distinguishes behavioral guidance from mechanisms that can enforce or gate behavior.
- Generalizable principle: advisory instructions, deterministic checks, hooks, permissions, and approvals should remain separately classified.
