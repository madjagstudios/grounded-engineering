export type GroundedScreen = 'practices' | 'skills'
export type GroundedSignals = {
  has_claude_md: boolean; has_agents_md: boolean; has_skills: boolean; has_large_skill_md: boolean
  has_subagents: boolean; subagents_without_tool_limits: boolean; hooks_configured: boolean
  sandbox_enabled: boolean; has_tests: boolean; has_ci: boolean; grounded_adopted: boolean
  languages: string[]; test_framework: string | null
}

declare module 'claude-code' {
  interface PluginState {
    'grounded-engineering': {
      screen: GroundedScreen
      selected: string | null
      query: string
      category: string
      tag: string
      sort: 'fit' | 'name'
      showSignals: boolean
      collapsed: { fits: boolean; all: boolean }
      signals: GroundedSignals | null
      adoption: { profile: string | null; cards: string[] } | null
    }
  }
}
