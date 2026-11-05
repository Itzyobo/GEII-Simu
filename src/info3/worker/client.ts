/** Côté fil principal : crée le Worker de simulation et expose un client typé. */
import type { InMsg, OutMsg } from './protocol'

export interface SimClient {
  send(msg: Exclude<InMsg, { type: 'tick' }>): void
  onMessage(cb: (m: OutMsg) => void): () => void
  terminate(): void
}

export function createSimClient(): SimClient {
  const worker = new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module' })
  const listeners = new Set<(m: OutMsg) => void>()
  worker.onmessage = (e: MessageEvent<OutMsg>) => {
    for (const cb of listeners) cb(e.data)
  }
  return {
    send: (msg) => worker.postMessage(msg),
    onMessage(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    terminate: () => worker.terminate(),
  }
}
