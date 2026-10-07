// How the desktop Client draws the pane's controls. The Client paints a Button with no
// chrome, stretched across its row with the label centred, so these wrap the table's
// Button (and Link) and the shared screens read there as they do in the terminal, which
// keeps its own table untouched. A filled Box reads as highlighted text in the Client (it
// fills only the text's own line), so a button is an outlined box sized to its label; the
// label carries the padding, so every cell inside the outline is the Button.
import type { Palette } from '../theme'

// A short, stable name for an address, so a link's Button keeps its key across draws.
function hashOf(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193)
  return (h >>> 0).toString(36)
}

export function clientLook(el: any, p: Palette, columns = 0, go: { link?: (url: string) => void } = {}) {
  const { Box, Button } = el
  const outline = (button: unknown, primary = false) => (
    <Box flexDirection="row" flexShrink={0}>
      <Box borderStyle="round" borderColor={primary ? p.accent.edge : p.neutral.edge} {...(primary ? { backgroundColor: p.accent.bg } : {})}>
        {button}
      </Box>
    </Box>
  )
  const LookButton = (props: any) => {
    // A hotkey answers only in the terminal pane, and a dim label is not known to draw in
    // the Client: the picked dot already marks which option is on.
    const { children, hotkey: _hotkey, dimColor: _dimColor, ...rest } = props
    const label = String(rest.label ?? (typeof children === 'string' ? children : ''))
    const key = String(rest.key ?? '')
    // A title that opens a tile is outlined like any action, but gives way to what sits
    // beside it: the screens cut it to one line, and minWidth 0 lets it shrink, not wrap.
    if (key.startsWith('open-')) {
      delete rest.plain
      return (
        <Box flexDirection="row" flexShrink={1} minWidth={0}>
          <Box borderStyle="round" borderColor={p.neutral.edge} flexShrink={1} minWidth={0}>
            <Button {...rest} label={` ${label} `} />
          </Box>
        </Box>
      )
    }
    // Text stays a plain control where its symbol or place says so: a picked dot, a lane
    // arrow, the details toggle.
    if (/^(opt-|lane-|details)/.test(key) || /^[▾▸●○]/u.test(label)) {
      return <Box flexDirection="row" minWidth={0}><Button {...rest} plain label={label} /></Box>
    }
    delete rest.plain
    return outline(<Button {...rest} label={` ${label} `} />, rest.variant === 'primary')
  }
  // The desktop refuses a Link (and a Markdown) inside a Client and unmounts the whole Client
  // over it, and a Client has no way to open an address. So a link is an outlined button
  // that asks the plugin to print the address in the transcript, where it opens; the plugin
  // prints only addresses the pane itself draws. Its key comes from the address, numbered
  // when the same address is drawn twice in one draw.
  const drawn = new Map<string, number>()
  const LookLink = ({ href, children, label }: any) => {
    const own = [children].flat().filter((c) => typeof c === 'string').join('')
    const text = String(own || label || href).replace(/ ›$/, '')
    const base = `link-${hashOf(String(href))}`
    const n = (drawn.get(base) ?? 0) + 1
    drawn.set(base, n)
    const key = n === 1 ? base : `${base}-${n}`
    return outline(<Button key={key} label={` ${text} ↗ `} onPress={() => go.link?.(String(href))} />)
  }
  // columns: how wide the Client is, for screens that cut a label to one line;
  // outlinesTitles: titles are drawn outlined here, so the screens budget for the outline.
  return { ...el, Button: LookButton, Link: LookLink, columns, outlinesTitles: true }
}
