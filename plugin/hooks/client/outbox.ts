// The desktop Client's press queue: pure helpers with no Node imports, since the Client runs in the app's view.
import type { Msg } from './apply'
import type { Ack, Acks } from '../model'

// Edits carry the whole value, so a newer one replaces an unsent older one.
const EDITS = new Set(['search'])

export function enqueue(outbox: Msg[], msg: Msg): Msg[] {
  const kept = EDITS.has(msg.name) ? outbox.filter((m) => m.name !== msg.name) : outbox
  return [...kept, msg]
}

export type PostState = { syncDue: boolean; sentKey: string; sinceSend: number }
export type Post = { kind: 'acts'; acts: Msg[] } | { kind: 'sync' }

// The post for this tick. The app keeps only the last post of a frame, and a busy or background
// window can run several ticks in one frame, so a press posted on its own could be silently
// replaced (a skill that never starts). Every post therefore carries all presses not yet
// received, in order; the plugin skips any `seq` at or below the last it received.
export const RESEND = 8
export function nextPost(outbox: Msg[], s: PostState): { post: Post | null; s: PostState } {
  const key = outbox.map((m) => m.seq).join(',')
  if (outbox.length && (key !== s.sentKey || s.sinceSend >= RESEND)) {
    return { post: { kind: 'acts', acts: outbox }, s: { syncDue: false, sentKey: key, sinceSend: 0 } }
  }
  if (!outbox.length && s.syncDue) return { post: { kind: 'sync' }, s: { syncDue: false, sentKey: '', sinceSend: 0 } }
  return { post: null, s: { ...s, sinceSend: s.sinceSend + 1 } }
}

export function ackOf(acks: Acks | undefined, cid: string): Ack {
  return acks?.[cid] ?? { received: 0, done: 0 }
}

// Still to post.
export function unseen(outbox: Msg[], ack: Ack): Msg[] {
  return outbox.filter((m) => m.seq > ack.received)
}

// Still to show.
export function unfinished(local: Msg[], ack: Ack): Msg[] {
  return local.filter((m) => m.seq > ack.done)
}

export function starting(local: Msg[]): boolean {
  return local.some((m) => m.name === 'adapt' || m.name === 'explain')
}
