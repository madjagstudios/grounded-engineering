// The desktop pane. The app paints a Client on its own frame clock, so this draws at once;
// the plugin's own redraws of a Pane are not painted there until the next input.
// Every press is posted to the plugin (ui.message); its answer, and a sync each second,
// bring the next model as props. A press the plugin has not yet acknowledged is applied
// to that model here, so it shows at once.
import { paneScreen, HANDLER_NAMES } from '../screens'
import type { PaneModel } from '../model'
import { PALETTE } from '../theme'
import { enqueue, nextPost, unseen, type PostState } from './outbox'
import { applyLocal, LOCAL_NAMES, type Msg } from './apply'
import { clientLook } from './look'

type Outbox = { outbox: Msg[]; local: Msg[]; seq: number }
type Local = { box: Outbox; n: number }

export default function GroundedApp(model: PaneModel, surface: any) {
  let created: Outbox | null = null
  if (surface.state === undefined) {
    // First call: start the timers. State is set from a timer or a press, never while drawing.
    const box: Outbox = { outbox: [], local: [], seq: 0 }
    created = box
    // One poster: every post carries all presses the plugin has not yet received (nextPost).
    let sent: PostState = { syncDue: false, sentKey: '', sinceSend: 0 }
    surface.every(60, () => {
      if (surface.state === undefined) surface.setState({ box, n: 0 })
      const r = nextPost(box.outbox, sent)
      sent = r.s
      if (r.post) surface.post(r.post)
    })
    // Once a second a sync is due, which brings what changed outside the pane.
    surface.every(1000, () => {
      sent = { ...sent, syncDue: true }
    })
  }
  const local = surface.state as Local | undefined
  const box = local?.box ?? created
  if (box) {
    const acked = new Set(model.acked ?? [])
    box.local = box.local.filter((m) => !acked.has(m.id))
    box.outbox = unseen(box.outbox, model.seen)
  }
  const send = (name: string, args: unknown[]) => {
    if (!box) return
    box.seq += 1
    const msg: Msg = { kind: 'act', id: `${Date.now()}-${box.seq}`, name, args }
    const before = box.outbox
    box.outbox = enqueue(before, msg)
    // An edit that replaced an unsent one: the older will never be acknowledged, so it goes.
    const replaced = new Set(before.filter((m) => !box.outbox.includes(m)).map((m) => m.id))
    box.local = [...box.local.filter((m) => !replaced.has(m.id)), msg]
    // Called from a press, not while drawing: safe to set state here.
    surface.setState({ box, n: (local?.n ?? 0) + 1 })
  }
  const go: Record<string, (...args: unknown[]) => void> = {}
  for (const name of HANDLER_NAMES) go[name] = (...args: unknown[]) => send(name, args)
  const waiting = box?.local ?? []
  const shown = waiting.filter((m) => LOCAL_NAMES.has(m.name)).reduce(applyLocal, model)
  const starting = waiting.some((m) => m.name === 'adapt' || m.name === 'explain')
  const { Box, Text } = surface.elements
  const columns = surface.columns ?? 0
  return (
    <Box flexDirection="column" gap={1}>
      {starting ? <Text color={PALETTE.dim}>Starting…</Text> : null}
      {paneScreen(clientLook(surface.elements, PALETTE, columns), shown, go as any, PALETTE, columns, 1.25)}
    </Box>
  )
}
