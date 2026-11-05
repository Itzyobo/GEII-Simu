/** Point d'entrée du Web Worker de simulation (module Vite). */
import { INFO3 } from '../../data/reference'
import { createSimState, handleMessage } from './handler'
import type { InMsg, OutMsg } from './protocol'

interface WorkerScope {
  postMessage(m: OutMsg): void
  onmessage: ((e: MessageEvent<InMsg>) => void) | null
}

const scope = self as unknown as WorkerScope
const state = createSimState()
const post = (msgs: OutMsg[]) => {
  for (const m of msgs) scope.postMessage(m)
}

scope.onmessage = (e) => post(handleMessage(state, e.data))

let last = performance.now()
setInterval(() => {
  const now = performance.now()
  post(handleMessage(state, { type: 'tick', wallMs: now - last }))
  last = now
}, INFO3.vm.tickIntervalMs)
