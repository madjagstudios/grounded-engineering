// The desktop Client's press queue: pure helpers with no Node imports, since the Client runs in the app's view.
import type { Msg } from './apply'

// Edits carry the whole value, so a newer one replaces an unsent older one.
const EDITS = new Set(['search'])

export function enqueue(outbox: Msg[], msg: Msg): Msg[] {
  const kept = EDITS.has(msg.name) ? outbox.filter((m) => m.name !== msg.name) : outbox
  return [...kept, msg]
}

export type PostState = { syncDue: boolean; sentKey: string; sinceSend: number }
export type Post = { kind: 'acts'; acts: Msg[] } | { kind: 'sync' }

// What the Client posts on this tick. The app keeps only the last post of a frame, and a
// busy or background window can run several ticks in one frame, so a press posted on its
// own could be silently replaced (a skill that never starts). Instead every post carries
// all the presses the plugin has not yet said it received (model.seen); the plugin skips
// ids it has seen, so a replaced post loses nothing. Unchanged, the batch is sent again
// after RESEND ticks; with nothing waiting, a due sync goes.
export const RESEND = 8
export function nextPost(outbox: Msg[], s: PostState): { post: Post | null; s: PostState } {
  const key = outbox.map((m) => m.id).join(',')
  if (outbox.length && (key !== s.sentKey || s.sinceSend >= RESEND)) {
    return { post: { kind: 'acts', acts: outbox }, s: { syncDue: false, sentKey: key, sinceSend: 0 } }
  }
  if (!outbox.length && s.syncDue) return { post: { kind: 'sync' }, s: { syncDue: false, sentKey: '', sinceSend: 0 } }
  return { post: null, s: { ...s, sinceSend: s.sinceSend + 1 } }
}

// Drops the presses the plugin has received.
export function unseen(outbox: Msg[], seen: string[] | undefined): Msg[] {
  const got = new Set(seen ?? [])
  return outbox.filter((m) => !got.has(m.id))
}
