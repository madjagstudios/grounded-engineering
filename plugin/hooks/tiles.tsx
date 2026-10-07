// Building blocks for the pane: pure functions of the element table, a palette and data.
import type { Palette, Tone } from './theme'

type Ui = any

// How many characters fit in the columns left after `overhead` cells of other things on the
// row. scale is characters per cell: 1 on the terminal's monospace grid, about 1.25 on the
// desktop, whose proportional font fits a little more. Zero columns means the width is unknown.
export function room(columns: number, overhead: number, scale: number): number {
  if (!columns) return 0
  return Math.max(0, Math.floor((columns - overhead) * scale))
}

// One line, cut with an ellipsis when it would not fit; room 10 or less means do not cut.
export function shorten(text: string, budget: number): string {
  const line = text.split('\n').find((l) => l.trim()) ?? ''
  if (budget <= 10 || line.length <= budget) return line
  return `${line.slice(0, budget - 1).trimEnd()}…`
}

// No margin of its own: every column of tiles is spaced with gap={1}.
export function tile(ui: Ui, p: Palette, tone: Tone, key: string, children: unknown[]) {
  const { Box } = ui
  const c = p[tone]
  return (
    <Box key={key} flexDirection="column" borderStyle="round" borderColor={c.edge} backgroundColor={c.bg} paddingX={1}>
      {children}
    </Box>
  )
}

export function laneHeader(ui: Ui, p: Palette, tone: Tone, key: string, label: string, count: number, isOpen: boolean, onToggle: () => void) {
  const { Box, Text, Button } = ui
  return (
    <Box key={key} flexDirection="row" justifyContent="space-between">
      <Button key={`lane-${key}`} plain label={`${isOpen ? '▾' : '▸'} ${label}`} onPress={onToggle} />
      <Text color={p[tone].text}>{String(count)}</Text>
    </Box>
  )
}

// A badge never shrinks: squeezed, it breaks into fragments.
export function badge(ui: Ui, p: Palette, tone: Tone, text: string) {
  const { Box, Text } = ui
  return <Box flexShrink={0} alignSelf="flex-start"><Text color={p[tone].text} wrap="truncate-end">{text}</Text></Box>
}

export function chip(ui: Ui, p: Palette, tone: Tone, text: string) {
  const { Text } = ui
  return <Text color={p[tone].text} backgroundColor={p[tone].bg} wrap="truncate-end">{` ${text} `}</Text>
}

// A picked-dot choice: a plain Button that reads as a radio option.
export function option(ui: Ui, p: Palette, key: string, label: string, isOn: boolean, onPress: () => void) {
  const { Button } = ui
  return <Button key={key} plain dimColor={!isOn} label={`${isOn ? '●' : '○'} ${label}`} onPress={onPress} />
}

// A labelled text field drawn inside a box on every surface, so the terminal shows where to type.
export function field(ui: Ui, p: Palette, key: string, label: string, value: string, onChange: (v: string) => void) {
  const { Box, Text, Input } = ui
  return (
    <Box key={`${key}-box`} flexDirection="column">
      <Text color={p.dim}>{label}</Text>
      <Box borderStyle="round" borderColor={p.neutral.edge} paddingX={1}>
        <Input key={key} value={value} onInput={(v: string) => onChange(v)} onSubmit={(v: string) => onChange(v)} />
      </Box>
    </Box>
  )
}
