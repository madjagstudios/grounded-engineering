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

## CLAUDE-SKILL-SURFACE

- Source: Anthropic Claude Code, [extension overview](https://code.claude.com/docs/en/features-overview)
- Immutable reference: official documentation page retrieved 2026-08-26; page content is unversioned and requires deliberate re-audit when changed
- Locator: `Extend Claude Code` overview and feature-selection table, including sections on persistent project instructions, skills, subagents, and hooks
- License/use: official vendor documentation; `link-only`; no verbatim redistribution
- Observed implementation: Claude Code presents persistent context, reusable skills, isolated subagents, and lifecycle hooks as different extension surfaces with different loading and execution behavior.
- Generalizable principle: choose an agent mechanism by its lifecycle, context cost, determinism, and need for isolation rather than by convenience.

## CLAUDE-SKILL-DISCOVERY

- Source: Anthropic Claude Code, [skills documentation](https://code.claude.com/docs/en/slash-commands)
- Immutable reference: official documentation page retrieved 2026-08-26; page content is unversioned and requires deliberate re-audit when changed
- Locator: `Extend Claude with skills` sections on invocation, automatic discovery, and the Agent Skills standard
- License/use: official vendor documentation; `link-only`; no verbatim redistribution
- Observed implementation: skills expose a reusable filesystem package with metadata that controls whether users or the model can invoke it, while the body and supporting resources load as needed.
- Generalizable principle: a reusable capability needs an explicit activation contract and a clear distinction between always-available metadata and on-demand detail.

## CLAUDE-SUBAGENT-BOUNDARIES

- Source: Anthropic Claude Code, [custom subagents](https://code.claude.com/docs/en/sub-agents)
- Immutable reference: official documentation page retrieved 2026-08-26; page content is unversioned and requires deliberate re-audit when changed
- Locator: supported frontmatter fields for `tools`, `disallowedTools`, `permissionMode`, `maxTurns`, `skills`, and `isolation`; sections on tool restrictions and worktree isolation
- License/use: official vendor documentation; `link-only`; no verbatim redistribution
- Observed implementation: custom subagents can receive bounded tools, permission modes, turn limits, preloaded skills, and isolated worktrees instead of inheriting an unrestricted task environment.
- Generalizable principle: delegated work should have capabilities, authority, duration, and isolation scoped to the result it must produce.

## CLAUDE-HOOKS-DETERMINISM

- Source: Anthropic Claude Code, [extension overview](https://code.claude.com/docs/en/features-overview)
- Immutable reference: official documentation page retrieved 2026-08-26; page content is unversioned and requires deliberate re-audit when changed
- Locator: feature-selection table entries for skills and hooks, and the `Build your setup over time` guidance on repeated workflows and always-run behavior
- License/use: official vendor documentation; `link-only`; no verbatim redistribution
- Observed implementation: skills are positioned for reusable knowledge and workflows, while hooks are positioned for actions that must run on matching lifecycle events.
- Generalizable principle: keep reasoning-dependent guidance in reusable instructions and put invariant behavior in deterministic controls.
