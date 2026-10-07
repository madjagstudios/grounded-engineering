// How the desktop Client draws the pane's controls. The Client paints a Button with no
// chrome, stretched across its row with the label centred, so these wrap the table's
// Button (and Link) and the shared screens read there as they do in the terminal, which
// keeps its own table untouched. A filled Box reads as highlighted text in the Client (it
// fills only the text's own line), so a button is an outlined box; the label carries the
// padding, so every cell inside the outline is the Button.
import type { Palette } from '../theme'

export function clientLook(el: any, p: Palette, columns = 0) {
  const { Box, Text, Button } = el
  const LookButton = (props: any) => {
    // A hotkey answers only in the terminal pane, and a dim label is not known to draw in
    // the Client: the picked dot already marks which option is on.
    const { children, hotkey: _hotkey, dimColor: _dimColor, ...rest } = props
    const label = String(rest.label ?? (typeof children === 'string' ? children : ''))
    const key = String(rest.key ?? '')
    // Text stays a plain control where its symbol or place says so: a title, a picked dot,
    // a lane arrow, the details toggle. Row titles open a tile: text with a › after it.
    if (/^(open-|opt-|lane-|details)/.test(key) || /^[▾▸●○]/u.test(label)) {
      const opensRow = /^open-(all|repo)-/.test(key)
      return <Box flexDirection="row" minWidth={0}><Button {...rest} plain label={opensRow ? `${label} ›` : label} /></Box>
    }
    const primary = rest.variant === 'primary'
    delete rest.plain
    return (
      <Box flexDirection="row" flexShrink={0}>
        <Box borderStyle="round" borderColor={primary ? p.accent.edge : p.neutral.edge} {...(primary ? { backgroundColor: p.accent.bg } : {})}>
          <Button {...rest} label={` ${label} `} />
        </Box>
      </Box>
    )
  }
  // The desktop refuses a Link inside a Client and unmounts the whole Client over it, so a
  // link is drawn as its text with the address under it, for the person to copy.
  const LookLink = ({ href, children, label }: any) => (
    <Box flexDirection="column"><Text>{children ?? label ?? href}</Text><Text color={p.dim}>{href}</Text></Box>
  )
  // columns: how wide the Client is, for screens that cut a label to one line.
  return { ...el, Button: LookButton, Link: LookLink, columns }
}
