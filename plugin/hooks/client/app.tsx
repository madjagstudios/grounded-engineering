// The desktop pane: draws the shared screens from the model it is given and shows a press at
// once; ./outbox says how presses reach the plugin.
import { paneScreen, HANDLER_NAMES } from '../screens'
import type { PaneModel } from '../model'
import { PALETTE } from '../theme'
import { enqueue, nextPost, unseen, type PostState } from './outbox'
import { applyLocal, LOCAL_NAMES, type Msg } from './apply'
import { clientLook } from './look'

const CHARS_PER_CELL = 1.25

type Outbox = { outbox: Msg[]; local: Msg[]; seq: number }
type Local = { box: Outbox; n: number }

export default function GroundedApp(model: PaneModel, surface: any) {
  let created: Outbox | null = null
  if (surface.state === undefined) {
    // First call: start the timers. State is set from a timer or a press, never while drawing.
    const box: Outbox = { outbox: [], local: [], seq: 0 }
    created = box
    // Draws before the first tick each start timers, since state is only set on that tick.
    // The box the state holds is the one in use; a timer whose box is not it stops itself
    // and its twin, so one poster and one sync timer remain.
    let sent: PostState = { syncDue: false, sentKey: '', sinceSend: 0 }
    const stopPoster = surface.every(60, () => {
      if (surface.state !== undefined && (surface.state as Local).box !== box) { stopPoster(); stopSync(); return }
      if (surface.state === undefined) surface.setState({ box, n: 0 })
      const r = nextPost(box.outbox, sent)
      sent = r.s
      if (r.post) surface.post(r.post)
    })
    // Once a second a sync is due, which brings what changed outside the pane.
    const stopSync = surface.every(1000, () => {
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
    const b = (surface.state as Local | undefined)?.box ?? box
    if (!b) return
    b.seq += 1
    const msg: Msg = { kind: 'act', id: `${Date.now()}-${b.seq}`, name, args }
    const before = b.outbox
    b.outbox = enqueue(before, msg)
    // An edit that replaced an unsent one: the older will never be acknowledged, so it goes.
    const replaced = new Set(before.filter((m) => !b.outbox.includes(m)).map((m) => m.id))
    b.local = [...b.local.filter((m) => !replaced.has(m.id)), msg]
    surface.setState({ box: b, n: b.seq })
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
      {paneScreen(clientLook(surface.elements, PALETTE, go), shown, go as any, PALETTE, columns, CHARS_PER_CELL)}
    </Box>
  )
}
