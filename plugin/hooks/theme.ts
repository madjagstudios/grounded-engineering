// Colours for the pane. Every value is a theme key, not a hex colour: the drawing surface
// resolves keys for the app's light or dark mode, which a plugin cannot read.
export type Tone = 'ok' | 'warn' | 'neutral' | 'accent' | 'failed'
type Swatch = { bg?: string; edge: string; text: string }
export type Palette = Record<Tone, Swatch> & { dim: string }

export const PALETTE: Palette = {
  ok: { bg: 'diffAddedDimmed', edge: 'success', text: 'success' },
  warn: { bg: 'userMessageBackground', edge: 'warning', text: 'warning' },
  neutral: { bg: 'userMessageBackground', edge: 'promptBorder', text: 'text' },
  accent: { bg: 'background', edge: 'claude', text: 'claude' },
  failed: { bg: 'diffRemovedDimmed', edge: 'error', text: 'error' },
  dim: 'inactive',
}

// The terminal theme has no 'background' key for a surface fill; it draws one in solid cyan,
// so an open card there keeps only its accent edge.
export const TERMINAL_PALETTE: Palette = { ...PALETTE, accent: { edge: 'claude', text: 'claude' } }
