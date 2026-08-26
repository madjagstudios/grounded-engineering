# Anthropic Claude Code source observations

This file records link-first observations from Anthropic's public Claude Code documentation. It does not claim that a public prompt library or a permissive license exists for all Claude Code instruction material.

Retrieval date: 2026-08-25.

## CLAUDE-MEMORY-HIERARCHY

- Source: Anthropic Claude Code, [memory and instruction documentation](https://code.claude.com/docs/en/memory)
- Immutable reference: documentation page retrieved 2026-08-25
- Locator: sections covering user, project, local, managed, nested, imported, and path-scoped instructions
- License/use: official vendor documentation; `link-only`; no verbatim redistribution
- Observed implementation: Claude Code describes multiple instruction scopes, path-specific rules, imports, and context diagnostics as distinct mechanisms.
- Generalizable principle: guidance needs explicit scope, precedence, provenance, and visibility rather than being treated as undifferentiated prompt text.

## CLAUDE-LOCAL-CONTEXT

- Source: Anthropic Claude Code, [memory and instruction documentation](https://code.claude.com/docs/en/memory)
- Immutable reference: documentation page retrieved 2026-08-25
- Locator: sections covering local instructions, imports, context diagnostics, and memory behavior
- License/use: official vendor documentation; `link-only`; no verbatim redistribution
- Observed implementation: local and durable context are described separately, and context diagnostics help users inspect what is available to the model.
- Generalizable principle: local context can be useful without becoming an invisible shared source of truth.

## CLAUDE-ENFORCEMENT-BOUNDARY

- Source: Anthropic Claude Code, [memory and instruction documentation](https://code.claude.com/docs/en/memory)
- Immutable reference: documentation page retrieved 2026-08-25
- Locator: sections distinguishing instructions from hooks, settings, and other enforcement mechanisms
- License/use: official vendor documentation; `link-only`; no verbatim redistribution
- Observed implementation: the documentation distinguishes behavioral guidance from mechanisms that can enforce or gate behavior.
- Generalizable principle: advisory instructions, deterministic checks, hooks, permissions, and approvals should remain separately classified.
