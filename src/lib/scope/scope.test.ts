import { describe, expect, it } from 'vitest'
import { RES3 } from '../../data/reference'
import { coaxSources } from '../reseaux/coax'
import { autoScale, channelFn, defaultSetup, digitize, envelope, findTrigger, measure, measureDelay, sampleRate, screenWindow, TAU_BW } from './engine'
import { initRun, stepRun } from './runtime'
import type { ScopeSettings, SignalSource } from './types'

const l = 100
const tau = l / RES3.v
const pulse = { kind: 'pulse', width: RES3.largeur, period: RES3.periode } as const
const open = coaxSources({ Zc: 50, l, ZL: Infinity, alpha: 0, wave: pulse })
const matched = coaxSources({ Zc: 50, l, ZL: 50, alpha: 0, wave: pulse }).ch1
const gauss0 = () => 0
const NCOL = 2000

function settings(patch: (s: ScopeSettings) => void): ScopeSettings {
  const s = defaultSetup()
  patch(s)
  return s
}

/** Trace complète d'une voie pour un déclenchement à tTrig */
function traceOf(src: SignalSource, s: ScopeSettings, tTrig: number) {
  const view = screenWindow(s, tTrig)
  const f = channelFn(src, s.ch[0], view)
  const env = envelope(f, src, tTrig, sampleRate(s.sdiv), view, view, NCOL)
  return { f, view, env, tr: digitize(env, s.ch[0], gauss0) }
}

describe('déclenchement', () => {
  it('front montant au niveau demandé, sur les coins de la source', () => {
    const t = findTrigger(open.ch1, 2, 'montant', 0.5e-3, 2.5e-3)!
    expect(t).toBeGreaterThan(1e-3)
    expect(t - 1e-3).toBeCloseTo(RES3.front / 2, 12)
    const tf = findTrigger(open.ch1, 2, 'descendant', 1e-3, 2e-3)!
    expect(tf - 1e-3).toBeCloseTo(RES3.largeur + RES3.front / 2, 12)
  })
  it('sinus : recherche sur une période', () => {
    const sine = coaxSources({ Zc: 50, l, ZL: 50, alpha: 0, wave: { kind: 'sine', f: 5e6 } }).ch1
    const t = findTrigger(sine, 0, 'montant', 1e-7 / 3, 1e-6)!
    expect((t * 5e6) % 1).toBeCloseTo(0, 6)
  })
})

describe('acquisition', () => {
  it('impulsion de 40 ns visible à 50 µs/div (enveloppe min/max, 2 GSa/s)', () => {
    const s = settings((s) => (s.sdiv = 50e-6))
    expect(sampleRate(s.sdiv)).toBe(2e9)
    const tTrig = findTrigger(open.ch1, 2, 'montant', 0, 2e-3)!
    const { env } = traceOf(open.ch1, s, tTrig)
    const peak = Math.max(...env.max)
    expect(peak).toBeCloseTo(4, 6)
    // l'écho à 2τ = 1 µs reste dans la colonne voisine : deux colonnes au plus montent à 4 V
    expect(env.max.filter((v) => v > 2).length).toBeLessThanOrEqual(2)
  })
  it('à 10 s/div (10 kSa/s) l’impulsion tombe entre deux échantillons', () => {
    const s = settings((s) => (s.sdiv = 10))
    const { env } = traceOf(open.ch1, s, 0.5)
    expect(Math.max(...env.max.filter((v) => !Number.isNaN(v)))).toBeLessThan(1)
  })
  it('bande passante 100 MHz : un front de 3 ns s’arrondit, montée ≈ √(tr² + (2,2τ)²)', () => {
    const s = settings((s) => {
      s.sdiv = 5e-9
      s.ch[0].vdiv = 1
    })
    const tTrig = findTrigger(open.ch1, 2, 'montant', 0, 2e-3)!
    const { f, view, tr } = traceOf(open.ch1, s, tTrig)
    const m = measure(f, open.ch1, view, tr, sampleRate(s.sdiv))
    const expected = Math.hypot(0.8 * RES3.front, 2.2 * TAU_BW)
    expect(m.montee).toBeGreaterThan(0.8 * expected)
    expect(m.montee).toBeLessThan(1.2 * expected)
  })
  it('CAN 8 bits : niveaux multiples du LSB (8 div × V/div / 256), écrêtage signalé', () => {
    const s = settings((s) => (s.sdiv = 20e-9))
    const tTrig = findTrigger(open.ch1, 2, 'montant', 0, 2e-3)!
    const { tr } = traceOf(open.ch1, s, tTrig)
    const lsb = (8 * 5) / 256
    for (const v of tr.max) if (!Number.isNaN(v)) expect(Math.abs(v / lsb - Math.round(v / lsb))).toBeLessThan(1e-6)
    expect(tr.clipped).toBe(false)
    const s2 = settings((s) => {
      s.sdiv = 20e-9
      s.ch[0].vdiv = 0.2
    })
    expect(traceOf(open.ch1, s2, tTrig).tr.clipped).toBe(true)
  })
  it('sonde réglée sur 10:1 avec une liaison BNC : tout est lu 10 fois trop grand', () => {
    const s = settings((s) => {
      s.sdiv = 20e-9
      s.ch[0].probe = 10
      s.ch[0].vdiv = 50
    })
    const tTrig = findTrigger(open.ch1, 0.2, 'montant', 0, 2e-3)!
    expect(Math.max(...traceOf(open.ch1, s, tTrig).env.max)).toBeCloseTo(40, 3)
  })
})

describe('mesures', () => {
  it('impulsion seule à 20 ns/div : amplitude, largeur, période absente', () => {
    const s = settings((s) => {
      s.sdiv = 20e-9
      s.ch[0].vdiv = 1
    })
    const tTrig = findTrigger(open.ch1, 2, 'montant', 0, 2e-3)!
    const { f, view, tr } = traceOf(open.ch1, s, tTrig)
    const m = measure(f, open.ch1, view, tr, sampleRate(s.sdiv))
    expect(m.ampl).toBeCloseTo(4, 6)
    expect(m.largeurP).toBeCloseTo(RES3.largeur, 11)
    expect(m.periode).toBeNaN()
  })
  it('train à 500 µs/div sur ligne adaptée : période 1 ms, fréquence 1 kHz', () => {
    const s = settings((s) => (s.sdiv = 500e-6))
    const tTrig = findTrigger(matched, 2, 'montant', 0, 2e-3)!
    const { f, view, tr } = traceOf(matched, s, tTrig)
    const m = measure(f, matched, view, tr, sampleRate(s.sdiv))
    expect(m.periode).toBeCloseTo(1e-3, 12)
    expect(m.freq).toBeCloseTo(1000, 6)
  })
  it('retard CH1 → extrémité = τ', () => {
    const s = settings((s) => (s.sdiv = 200e-9))
    const tTrig = findTrigger(open.ch1, 2, 'montant', 0, 2e-3)!
    const view = screenWindow(s, tTrig)
    const f1 = channelFn(open.ch1, s.ch[0], view)
    const f2 = channelFn(open.end, s.ch[0], view)
    expect(measureDelay(f1, open.ch1, f2, open.end, view, tTrig)).toBeCloseTo(tau, 11)
  })
})

describe('automate Run / Stop / Single', () => {
  /** Une seule impulsion à t = 5 ms, rien ensuite */
  const once: SignalSource = {
    value: (t) => (t >= 5e-3 && t < 5e-3 + 1e-6 ? 1 : 0),
    edges: (a, b) => [5e-3, 5e-3 + 1e-6].filter((t) => t >= a && t <= b),
  }
  const s = settings((s) => {
    s.sdiv = 1e-6
    s.trig.level = 0.5
  })
  it('Normal : écran figé sur la dernière capture tant que rien ne déclenche', () => {
    const n = settings((x) => Object.assign(x, s, { trig: { ...s.trig, mode: 'normal' } }))
    let st = stepRun(initRun(0), n, [once, null], 1e-3)
    expect(st.status).toBe('Armé')
    expect(st.capture).toBeNull()
    st = stepRun(st, n, [once, null], 10e-3)
    expect(st.status).toBe("Trig'd")
    expect(st.capture!.tTrig).toBeCloseTo(5e-3, 12)
    st = stepRun(st, n, [once, null], 500e-3)
    expect(st.status).toBe('Armé')
    expect(st.capture!.tTrig).toBeCloseTo(5e-3, 12)
  })
  it('Auto : balayage libre si rien ne déclenche', () => {
    const st = stepRun(stepRun(initRun(0), s, [once, null], 10e-3), s, [once, null], 500e-3)
    expect(st.status).toBe('Auto')
    expect(st.capture!.triggered).toBe(false)
  })
  it('Single : une capture puis Stop', () => {
    const st = stepRun({ ...initRun(0), mode: 'single' }, s, [once, null], 10e-3)
    expect(st.mode).toBe('stop')
    expect(st.capture!.triggered).toBe(true)
    expect(stepRun(st, s, [once, null], 1).capture).toBe(st.capture)
  })
  it('holdoff : sur une salve, le déclenchement retombe toujours sur le premier front', () => {
    // salve de 5 impulsions toutes les 200 ns, répétée toutes les 1 ms
    const burst: SignalSource = {
      value: (t) => {
        const u = ((t % 1e-3) + 1e-3) % 1e-3
        return u < 1e-6 && u % 200e-9 < 100e-9 ? 1 : 0
      },
      edges: (a, b) => {
        const out: number[] = []
        for (let n = Math.floor(a / 1e-3); n * 1e-3 <= b; n++)
          for (let k = 0; k < 10; k++) {
            const t = n * 1e-3 + k * 100e-9
            if (t >= a && t <= b) out.push(t)
          }
        return out
      },
      period: 1e-3,
    }
    const h = settings((x) => Object.assign(x, { ...s, sdiv: 100e-9, trig: { ...s.trig, holdoff: 2e-6 } }))
    let st = initRun(0.123_456_7)
    for (let k = 1; k <= 20; k++) {
      st = stepRun(st, h, [burst, null], 0.123_456_7 + k * 0.033)
      const phase = ((st.capture!.tTrig % 1e-3) + 1e-3) % 1e-3
      expect(Math.min(phase, 1e-3 - phase)).toBeLessThan(1e-12)
    }
  })
})

describe('Auto Scale', () => {
  it('train d’impulsions : CH1 allumée, déclenchement à mi-hauteur, ≈ 2 périodes à l’écran', () => {
    const s = autoScale([open.ch1, null], defaultSetup(), 0.01)
    expect(s.ch[0].on).toBe(true)
    expect(s.ch[1].on).toBe(false)
    expect(s.trig.level).toBeCloseTo(2, 6)
    expect(s.sdiv).toBe(200e-6)
    expect(s.ch[0].vdiv).toBe(1)
  })
})

describe('performance', () => {
  it('trame Manchester de 1526 octets à 10 Mbit/s : enveloppe 2000 colonnes rapide', () => {
    const bits = 1526 * 8
    const t0 = 0.4
    const half = 50e-9
    const rnd = Array.from({ length: bits }, (_, i) => (i * 2654435761) % 7 > 3)
    const levelAt = (t: number) => {
      const k = Math.floor((t - t0) / half)
      if (k < 0 || k >= 2 * bits) return 0
      return (rnd[k >> 1] ? k & 1 : 1 - (k & 1)) ? 1 : -1
    }
    const frame: SignalSource = {
      value: levelAt,
      edges: (a, b) => {
        const out: number[] = []
        for (let k = Math.max(0, Math.ceil((a - t0) / half)); k <= 2 * bits && t0 + k * half <= b; k++) out.push(t0 + k * half)
        return out
      },
    }
    const s = settings((x) => (x.sdiv = 200e-6))
    const view = screenWindow(s, t0)
    const t = performance.now()
    for (let i = 0; i < 10; i++) envelope(levelAt, frame, t0, sampleRate(s.sdiv), view, view, NCOL)
    expect((performance.now() - t) / 10).toBeLessThan(30)
  })
})
