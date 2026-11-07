/** File d'événements datés (tas binaire, ordre stable à temps égal) : fronts externes, rebonds, périphériques. */
import type { Level } from '../models/gpio'

export interface SimEvent {
  /** Temps — ticks */
  t: number
  seq: number
  pin: string
  level: Level | null
  /** Événement de périphérique (timer…) : appelé à l'instant t à la place d'un front */
  fn?: () => void
}

export class EventQueue {
  private heap: SimEvent[] = []
  private seq = 0

  get size() {
    return this.heap.length
  }

  peekTime(): number {
    return this.heap.length ? this.heap[0].t : Infinity
  }

  clear() {
    this.heap = []
  }

  push(t: number, pin: string, level: Level | null) {
    this.insert({ t, seq: this.seq++, pin, level })
  }

  /** Événement de périphérique */
  pushFn(t: number, fn: () => void) {
    this.insert({ t, seq: this.seq++, pin: '', level: null, fn })
  }

  private insert(e: SimEvent) {
    const h = this.heap
    h.push(e)
    let i = h.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (!less(h[i], h[parent])) break
      ;[h[i], h[parent]] = [h[parent], h[i]]
      i = parent
    }
  }

  pop(): SimEvent | undefined {
    const h = this.heap
    if (!h.length) return undefined
    const top = h[0]
    const last = h.pop()!
    if (h.length) {
      h[0] = last
      let i = 0
      for (;;) {
        const l = i + i + 1
        const r = l + 1
        let m = i
        if (l < h.length && less(h[l], h[m])) m = l
        if (r < h.length && less(h[r], h[m])) m = r
        if (m === i) break
        ;[h[i], h[m]] = [h[m], h[i]]
        i = m
      }
    }
    return top
  }
}

const less = (a: SimEvent, b: SimEvent) => a.t < b.t || (a.t === b.t && a.seq < b.seq)
