import type { Host } from './catalog'

export const SIGNAL_NAMES = ['has_claude_md', 'has_agents_md', 'has_skills', 'has_large_skill_md', 'has_subagents', 'subagents_without_tool_limits', 'hooks_configured', 'sandbox_enabled', 'has_tests', 'has_ci', 'grounded_adopted', 'languages', 'test_framework'] as const

export type Signals = {
  has_claude_md: boolean; has_agents_md: boolean; has_skills: boolean; has_large_skill_md: boolean
  has_subagents: boolean; subagents_without_tool_limits: boolean; hooks_configured: boolean
  sandbox_enabled: boolean; has_tests: boolean; has_ci: boolean; grounded_adopted: boolean
  languages: string[]; test_framework: string | null
}

export type Adoption = { profile: string | null; cards: string[] }

type Fs = Host['fs']

const exists = (fs: Fs, path: string) => fs.exists(path).catch(() => false)
const readText = (fs: Fs, path: string) => fs.read(path).then(String, () => null)
const list = (fs: Fs, path: string) => fs.list(path).catch(() => [])
const readJson = async (fs: Fs, path: string) => {
  const text = await readText(fs, path)
  if (text === null) return null
  try { return JSON.parse(text) } catch { return null }
}

export async function readSignals(host: Host): Promise<Signals> {
  const fs = host.fs
  const skillDirs = (await list(fs, '.claude/skills')).filter((e) => e.kind === 'dir').map((e) => e.name)
  const skillTexts = (await Promise.all(skillDirs.map((d) => readText(fs, `.claude/skills/${d}/SKILL.md`)))).filter((t): t is string => t !== null)
  const agentFiles = (await list(fs, '.claude/agents')).filter((e) => e.kind === 'file' && e.name.endsWith('.md'))
  const agentTexts = (await Promise.all(agentFiles.map((e) => readText(fs, `.claude/agents/${e.name}`)))).filter((t): t is string => t !== null)
  const settings = await readJson(fs, '.claude/settings.json')
  const pkg = await readJson(fs, 'package.json')
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) }
  const workflows = (await list(fs, '.github/workflows')).filter((e) => /\.ya?ml$/.test(e.name))
  const hasPython = (await exists(fs, 'pyproject.toml')) || (await exists(fs, 'requirements.txt'))
  const hasGo = await exists(fs, 'go.mod')
  const hasRust = await exists(fs, 'Cargo.toml')

  let test_framework: string | null = null
  if (deps.vitest) test_framework = 'vitest'
  else if (deps.jest) test_framework = 'jest'
  else if (/node --test/.test(String(pkg?.scripts?.test ?? ''))) test_framework = 'node-test'
  else if (hasPython && ((await exists(fs, 'pytest.ini')) || (await exists(fs, 'conftest.py')) || /pytest/.test((await readText(fs, 'pyproject.toml')) ?? ''))) test_framework = 'pytest'
  else if (hasGo) test_framework = 'go-test'
  else if (hasRust) test_framework = 'cargo-test'

  const languages: string[] = []
  if (pkg) languages.push((await exists(fs, 'tsconfig.json')) || deps.typescript ? 'typescript' : 'javascript')
  if (hasPython) languages.push('python')
  if (hasGo) languages.push('go')
  if (hasRust) languages.push('rust')

  const hasTestDir = (await exists(fs, 'test')) || (await exists(fs, 'tests')) || (await exists(fs, '__tests__'))

  return {
    has_claude_md: (await exists(fs, 'CLAUDE.md')) || (await exists(fs, '.claude/CLAUDE.md')),
    has_agents_md: await exists(fs, 'AGENTS.md'),
    has_skills: skillTexts.length > 0,
    has_large_skill_md: skillTexts.some((t) => t.replace(/\r?\n$/, '').split('\n').length > 500),
    has_subagents: agentTexts.length > 0,
    subagents_without_tool_limits: agentTexts.some((t) => !/^tools\s*:/m.test(frontmatter(t))),
    hooks_configured: !!settings?.hooks && Object.keys(settings.hooks).length > 0,
    sandbox_enabled: settings?.sandbox?.enabled === true,
    has_tests: test_framework !== null || hasTestDir,
    has_ci: workflows.length > 0 || (await exists(fs, '.gitlab-ci.yml')) || (await exists(fs, '.circleci/config.yml')),
    grounded_adopted: await exists(fs, '.grounded-engineering/manifest.yaml'),
    languages,
    test_framework,
  }
}

function frontmatter(text: string): string {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
  return m?.[1] ?? ''
}

export async function readAdoption(host: Host): Promise<Adoption | null> {
  const text = await readText(host.fs, '.grounded-engineering/manifest.yaml')
  if (text === null) return null
  const profile = /^pack_id:\s*([\w-]+)/m.exec(text)?.[1] ?? null
  // Card ids are the `id:` of each entry under the top-level `cards:`; an id named in a
  // card's free text (a decision, a revisit trigger) is not an adopted card.
  const cards = new Set<string>()
  let inCards = false
  for (const line of text.split(/\r?\n/)) {
    if (/^\S/.test(line)) inCards = /^cards:/.test(line)
    else if (inCards) {
      const id = /^\s*(?:-\s+)?id:\s*["']?(GE-[A-Z]{2}-\d{3})["']?\s*$/.exec(line)?.[1]
      if (id) cards.add(id)
    }
  }
  return { profile, cards: [...cards].sort() }
}
