import { describe, expect, it } from 'vitest'
import { fmtTime, tracePoints, TRACE_HIGH, TRACE_LOW, TRACE_W } from './analyzer'
import { createSimState, handleMessage } from '../worker/handler'
import { generate } from '../mcc/generator'
import { tp32Config } from '../mcc/presets'
import { CR_FIXTURES } from '../fixtures'
import type { OutMsg, TraceChange } from '../worker/protocol'

describe('analyseur logique', () => {
  it('fmtTime', () => {
    expect(fmtTime(0.009984)).toBe('9,984 ms')
    expect(fmtTime(1e-6)).toBe('1 µs')
    expect(fmtTime(1)).toBe('1 s')
  })
  it('tracePoints : niveau initial, un créneau, fin de fenêtre', () => {
    const a: TraceChange[] = [
      { ch: 'RC5', t: 0, level: 1 },
      { ch: 'RC5', t: 0.5, level: 0 },
    ]
    expect(tracePoints(a, 0, 1)).toBe(`0.0,${TRACE_HIGH} 500.0,${TRACE_HIGH} 500.0,${TRACE_LOW} ${TRACE_W},${TRACE_LOW}`)
    expect(tracePoints(a, 0.6, 1)).toBe(`0.0,${TRACE_LOW} ${TRACE_W},${TRACE_LOW}`)
  })
  it('Worker : TP3 §2, RC5 et l’ISR TMR2 10 ms après le front descendant (voies RC5, ISR, TMR2IF)', () => {
    const state = createSimState(() => 0)
    const all: OutMsg[] = []
    all.push(...handleMessage(state, { type: 'analyzer', channels: ['RC5', 'ISR', 'TMR2IF', 'RA4'] }))
    all.push(...handleMessage(state, { type: 'load', files: { 'main.c': CR_FIXTURES['tp3/q2'], ...generate(tp32Config()) } }))
    handleMessage(state, { type: 'run', speed: 1 })
    all.push(...handleMessage(state, { type: 'tick', wallMs: 10 }))
    handleMessage(state, { type: 'stimulus', action: 'press', button: 'S2', bounce: false })
    for (let i = 0; i < 5; i++) all.push(...handleMessage(state, { type: 'tick', wallMs: 10 }))
    const changes = all.flatMap((m) => (m.type === 'trace' ? m.changes : []))
    const fall = changes.find((c) => c.ch === 'RC5' && c.level === 0)!
    const flag = changes.find((c) => c.ch === 'TMR2IF' && c.level === 1)!
    const isr = changes.find((c) => c.ch === 'ISR' && c.level === 1 && c.t > fall.t)!
    expect(flag.t - fall.t).toBeCloseTo(0.01, 4)
    expect(isr.t).toBeGreaterThanOrEqual(flag.t)
    expect(changes.some((c) => c.ch === 'TMR2IF' && c.level === 0 && c.t > flag.t)).toBe(true)
  })
})
