import { describe, expect, it } from 'vitest'
import { REF } from '../data/reference'
import { scopeView, type ProbeInput, type ScopeSettings } from './scope'
import { uartFrame, uartWaveform, type Level } from './uart'

const FMT = { dataBits: REF.serie1DataBits.value, parity: REF.serie1Parity.value, stopBits: REF.serie1StopBits.value }
const wave = (level: Level) => uartWaveform(uartFrame(0x55, FMT), { baud: REF.serie1Baud.value, level })
const bit = 1 / REF.serie1Baud.value
const tdiv = REF.scopeSerie1TimeDiv.value

const settings = (level: Level, over: Partial<ScopeSettings> = {}): ScopeSettings => ({
  ch: [
    { on: true, vdiv: level === 'TTL' ? REF.scopeSerie1TtlVoltDiv.value : REF.scopeSerie1Rs232VoltDiv.value, offset: 0, probe: 1 },
    { on: false, vdiv: 1, offset: 0, probe: 1 },
  ],
  tdiv,
  position: 4 * tdiv,
  trigger: { source: 0, slope: level === 'TTL' ? 'falling' : 'rising', level: level === 'TTL' ? REF.scopeSerie1TtlLevel.value : 0 },
  mode: 'normal',
  math: { on: false, src1: 0, src2: 1, vdiv: 1, offset: 0 },
  cursors: { on: true, x1: 0, x2: 0, y1: 0, y2: 0 },
  ...over,
})
const input = (level: Level, probe: 1 | 10 = 1): [ProbeInput, ProbeInput] => [
  { signal: wave(level), probe, ground: true },
  { signal: null, probe: 1, ground: true },
]
const OPT = { seed: 42, phase: 0 }
const near = (x: number, target: number, tol: number) => expect(Math.abs(x / target - 1)).toBeLessThanOrEqual(tol)

describe('scopeView sur 55H 8O1', () => {
  it('curseurs sur deux fronts consécutifs : Δt = 416,7 µs (± 0,5 %)', () => {
    const v = scopeView(input('TTL'), settings('TTL'), OPT)
    expect(v.status).toBe("Trig'd")
    const [e0, e1] = v.measures[0]!.edges
    const c = scopeView(input('TTL'), settings('TTL', { cursors: { on: true, x1: e0!, x2: e1!, y1: 0, y2: 0 } }), OPT).cursors
    near(c.dt, 416.7e-6, 0.005)
    near(c.invDt, 1 / 416.7e-6, 0.005)
  })
  it('Freq = 1 200 Hz (période = 2 bits) et Max TTL = 5 V', () => {
    const m = scopeView(input('TTL'), settings('TTL'), OPT).measures[0]!
    near(m.freq, 1200, 0.005)
    near(m.max, 5, 0.02)
  })
  it('RS232 : Max 11,5 V et crête à crête 23,3 V', () => {
    const m = scopeView(input('RS232'), settings('RS232'), OPT).measures[0]!
    near(m.max, 11.5, 0.02)
    near(m.pkpk, 23.3, 0.02)
  })
  it('Max reste à ± 2 % sur 2 000 acquisitions (gain tronqué, bruit point par point hors mesures)', () => {
    for (let seed = 1; seed <= 2000; seed++) {
      near(scopeView(input('TTL'), settings('TTL'), { seed, phase: 0 }).measures[0]!.max, 5, 0.02)
      near(scopeView(input('RS232'), settings('RS232'), { seed, phase: 0 }).measures[0]!.max, 11.5, 0.02)
    }
  })
  it('sonde physique 10:1, atténuation réglée à 1:1 → amplitude ÷ 10', () => {
    const real = scopeView(input('TTL'), settings('TTL'), OPT).measures[0]!
    const m = scopeView(input('TTL', 10), settings('TTL', { trigger: { source: 0, slope: 'falling', level: 0.25 } }), OPT).measures[0]!
    near(m.max, real.max / 10, 0.02)
  })
  it('mauvais front → trace décalée d’un bit', () => {
    const a = scopeView(input('TTL'), settings('TTL'), OPT)
    const b = scopeView(input('TTL'), settings('TTL', { trigger: { source: 0, slope: 'rising', level: 2.5 } }), OPT)
    near(a.measures[0]!.edges[0]! - b.measures[0]!.edges[0]!, bit, 0.005)
  })
  it('Auto sans déclenchement → la trace défile ; Normal → attente', () => {
    const st = settings('TTL', { mode: 'auto', trigger: { source: 0, slope: 'falling', level: 8 } })
    const a = scopeView(input('TTL'), st, { seed: 1, phase: 0 })
    const b = scopeView(input('TTL'), st, { seed: 1, phase: 1e-4 })
    expect(a.status).toBe('Auto')
    expect(a.measures[0]!.edges[0]).not.toBeCloseTo(b.measures[0]!.edges[0]!, 9)
    expect(scopeView(input('TTL'), { ...st, mode: 'normal' }, OPT).status).toBe('Attente')
  })
  it('sans pince de masse → voie flottante, sans fréquence mesurable', () => {
    const inp = input('TTL')
    inp[0] = { ...inp[0], ground: false }
    const v = scopeView(inp, settings('TTL'), OPT)
    expect(v.floating[0]).toBe(true)
    expect(v.measures[0]!.freq).toBeNaN()
  })
  it('Math = Ch1 − Ch2 : deux signaux identiques s’annulent au bruit de gain près', () => {
    const inp: [ProbeInput, ProbeInput] = [input('TTL')[0], { signal: wave('TTL'), probe: 1, ground: true }]
    const v = scopeView(inp, settings('TTL', { math: { on: true, src1: 0, src2: 1, vdiv: 1, offset: 0 } }), OPT)
    expect(Math.abs(v.measures[2]!.max)).toBeLessThan(0.2)
  })
  it('même graine → même affichage', () => {
    expect(scopeView(input('TTL'), settings('TTL'), OPT)).toEqual(scopeView(input('TTL'), settings('TTL'), OPT))
  })
})
