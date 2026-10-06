// Repository signals the plugin reads. Fit rules may reference only the boolean ones.
export const SIGNALS = Object.freeze([
  { name: 'has_claude_md', type: 'boolean', description: 'CLAUDE.md exists at the repository root or in .claude/.' },
  { name: 'has_agents_md', type: 'boolean', description: 'AGENTS.md exists at the repository root.' },
  { name: 'has_skills', type: 'boolean', description: 'At least one .claude/skills/*/SKILL.md exists.' },
  { name: 'has_large_skill_md', type: 'boolean', description: 'A .claude/skills/*/SKILL.md is longer than 500 lines.' },
  { name: 'has_subagents', type: 'boolean', description: 'At least one .claude/agents/*.md exists.' },
  { name: 'subagents_without_tool_limits', type: 'boolean', description: 'A .claude/agents/*.md frontmatter has no tools field.' },
  { name: 'hooks_configured', type: 'boolean', description: '.claude/settings.json defines at least one hook.' },
  { name: 'sandbox_enabled', type: 'boolean', description: '.claude/settings.json sets sandbox.enabled to true.' },
  { name: 'has_tests', type: 'boolean', description: 'A test framework or a test directory is detected.' },
  { name: 'has_ci', type: 'boolean', description: 'A CI configuration exists, such as .github/workflows/*.yml.' },
  { name: 'grounded_adopted', type: 'boolean', description: '.grounded-engineering/manifest.yaml exists.' },
  { name: 'languages', type: 'string[]', description: 'Languages detected from manifests: typescript, javascript, python, go, rust.' },
  { name: 'test_framework', type: 'string|null', description: 'Detected test framework: vitest, jest, node-test, pytest, go-test, cargo-test.' }
]);

export const BOOLEAN_SIGNALS = new Set(SIGNALS.filter((s) => s.type === 'boolean').map((s) => s.name));
