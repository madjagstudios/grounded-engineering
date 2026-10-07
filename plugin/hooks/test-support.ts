import type { FsEntry, On } from 'claude-code'
import type { Catalog, Host } from './catalog'

export const FIXTURE_CATALOG: Catalog = {
  catalog_version: 1, package_version: '0.6.0', repository: 'https://github.com/madjagstudios/grounded-engineering',
  signals: [], categories: ['Agent & Skill Design', 'Verification'],
  practices: [
    { id: 'GE-AS-004', title: 'Bound delegated work', category: 'Agent & Skill Design', subcategory: 'Delegation safety', pattern: 'Scope delegated agents.', rationale: 'Least privilege reduces side effects.', agent_snippet: 'Give delegated work only the tools it needs.', applicability: ['AI_ASSISTED'], control_types: ['PERMISSION'], confidence: 'high', validation_status: 'validated', source_ids: ['S1'], path: 'practices/agent-design/bounded-delegation.md', body: 'Before delegating, define the result.' },
    { id: 'GE-VF-001', title: 'Use the real verification gate', category: 'Verification', subcategory: 'Gates', pattern: 'Run the real gate.', rationale: 'Claims need evidence.', agent_snippet: null, applicability: ['AI_ASSISTED'], control_types: ['CI'], confidence: 'high', validation_status: 'not_validated', source_ids: ['S1'], path: 'practices/verification/real-verification-gate.md', body: 'Run the declared gate before claiming done.' },
    { id: 'GE-VF-004', title: 'Confine agent-executed commands in an OS sandbox', category: 'Verification', subcategory: 'Sandboxing', pattern: 'Run commands in a sandbox.', rationale: 'Limits blast radius.', agent_snippet: null, applicability: ['AI_ASSISTED'], control_types: ['SANDBOX'], confidence: 'high', validation_status: 'validated', source_ids: ['S1'], path: 'practices/verification/sandbox-agent-execution.md', body: 'Use the sandbox where supported.' },
  ],
  skill_repos: [
    { id: 'GE-SR-001', name: 'alpha-skills', repo: 'example/alpha-skills', license: 'MIT', pinned_commit: 'a'.repeat(40), reviewed_on: '2026-10-06', best_for: ['AI_ASSISTED'], tags: ['planning'], summary: 'Planning skills for coding agents.', watch_out_for: 'Opinionated workflow.', install: '/plugin install alpha@example' },
    { id: 'GE-SR-002', name: 'beta-ts', repo: 'example/beta-ts', license: 'Apache-2.0', pinned_commit: 'b'.repeat(40), reviewed_on: '2026-10-06', best_for: ['AI_ASSISTED'], tags: ['typescript', 'testing'], summary: 'TypeScript testing skills.', watch_out_for: 'Assumes vitest.', install: '/plugin install beta@example' },
  ],
  fit_rules: [
    { card: 'GE-VF-001', when: { all: ['has_tests'], any: [], none: ['has_ci'] }, why: 'Tests exist, but no CI gate runs them.' },
    { card: 'GE-AS-004', when: { all: ['subagents_without_tool_limits'], any: [], none: [] }, why: 'Some subagents have no tool limits.' },
    { card: 'GE-VF-004', when: { all: ['has_claude_md'], any: [], none: ['sandbox_enabled'] }, why: "This repo's settings don't turn on the OS sandbox." },
  ],
  sources: [{ id: 'S1', url: 'https://example.com/source' }],
}

const strip = (p: string) => p.replace(/^\.\//, '')
const entriesOf = (dirs: Record<string, string[]>, path: string): FsEntry[] =>
  (dirs[strip(path)] ?? []).map((name): FsEntry => ({ name: name.replace(/\/$/, ''), kind: name.endsWith('/') ? 'dir' : 'file', size: 0, mtimeMs: 0, isLink: false }))

// A test's own `$` is the engine's and has no `fs`, and a hook's `$` cannot cross an import,
// so plain unit tests hand the core this Host, backed by the same files and dirs maps.
export function fakeHost(files: Record<string, string>, dirs: Record<string, string[]> = {}): Host {
  const fs = {
    read: async (path: string) => {
      const p = strip(path)
      const text = files[p]
      if (text !== undefined) return text
      throw new Error(`ENOENT: ${p}`)
    },
    exists: async (path: string) => strip(path) in files || strip(path) in dirs,
    list: async (path?: string) => entriesOf(dirs, path ?? '.'),
  }
  return { fs, plugin: { root: '/plugin' } }
}

// For hook-level tests: answers the plugin's fs.* calls beneath its hooks. The engine
// resolves a relative path against the working directory (the plugin folder under test)
// before a hook sees it, and a test cannot ask what that folder is, so an absolute path
// is matched back to the longest repo-relative key it ends with.
export function fakeRepo(on: On, files: Record<string, string>, dirs: Record<string, string[]> = {}) {
  const keys = [...Object.keys(files), ...Object.keys(dirs)].sort((a, b) => b.length - a.length)
  const rel = (p: string) => {
    const path = strip(p)
    return keys.find((k) => path === k || path.endsWith(`/${k}`)) ?? path
  }
  on('fs.read', async (_$, e) => {
    const path = rel(e.path)
    const text = files[path]
    if (text === undefined && e.path.endsWith('/catalog.json')) return { value: JSON.stringify(FIXTURE_CATALOG) }
    return text !== undefined ? { value: text } : { deny: `ENOENT: ${path}` }
  })
  on('fs.exists', async (_$, e) => ({ value: rel(e.path) in files || rel(e.path) in dirs }))
  on('fs.list', async (_$, e) => ({ value: entriesOf(dirs, rel(e.path)) }))
}
