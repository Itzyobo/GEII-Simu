import { describe, expect, it } from 'vitest'
import { INFO3 } from '../../data/reference'
import { Button, transitionEdges } from './button'
import { createGpioState, Gpio, pinLevel, readPort } from './gpio'
import { mulberry32 } from './prng'

describe('gpio (sans VM)', () => {
  it('niveau = LAT si TRIS = 0, sinon niveau externe', () => {
    const g = new Gpio()
    g.writeReg('TRIS', 'A', 0x0f, 0)
    g.writeReg('LAT', 'A', 0x10, 1)
    expect(g.level('RA4')).toBe(1)
    g.setExternal('RA4', 0, 2)
    expect(g.level('RA4')).toBe(1) // la sortie impose son niveau
    g.setExternal('RA0', 1, 3)
    expect(g.level('RA0')).toBe(1)
    g.setExternal('RA0', 0, 4)
    expect(g.level('RA0')).toBe(0)
  })

  it('lecture du PORT = 0 si ANSEL = 1', () => {
    const g = new Gpio()
    g.setExternal('RB4', 1, 0)
    expect(g.readReg('ANSEL', 'B')).toBe(INFO3.sfr.ANSELB.reset)
    expect(g.readPort('B') & 0x10).toBe(0)
    g.writeReg('ANSEL', 'B', 0xef, 1)
    expect(g.readPort('B') & 0x10).toBe(0x10)
  })

  it('WPU : niveau 1 si la broche est en entrée et flottante ; flottante sans WPU = H20', () => {
    const st = createGpioState()
    expect(pinLevel(st.C, 'C', 5)).toBe(INFO3.floatingInputLevel)
    st.C.WPU = 0x20
    expect(pinLevel(st.C, 'C', 5)).toBe(1)
    st.C.ext[5] = 0
    expect(pinLevel(st.C, 'C', 5)).toBe(0)
  })

  it('drain ouvert : une sortie à 1 relâche la broche', () => {
    const st = createGpioState()
    st.A.TRIS = 0
    st.A.LAT = 0x01
    st.A.ODCON = 0x01
    st.A.ext[0] = null
    expect(pinLevel(st.A, 'A', 0)).toBe(INFO3.floatingInputLevel)
    st.A.WPU = 0x01
    expect(pinLevel(st.A, 'A', 0)).toBe(1)
    st.A.LAT = 0
    expect(pinLevel(st.A, 'A', 0)).toBe(0)
  })

  it('RE3 (MCLR) reste une entrée, TRISE limité à 3 bits', () => {
    const g = new Gpio()
    g.writeReg('TRIS', 'E', 0x00, 0)
    expect(g.readReg('TRIS', 'E')).toBe(0)
    g.setExternal('RE3', 1, 1)
    g.writeReg('ANSEL', 'E', 0, 2)
    expect(readPort(g.state.E, 'E') & 0x08).toBe(0x08)
  })

  it('trace horodatée de chaque changement', () => {
    const g = new Gpio()
    g.writeReg('TRIS', 'A', 0x0f, 10)
    g.writeReg('LAT', 'A', 0x30, 20)
    g.writeReg('LAT', 'A', 0x30, 30)
    g.writeReg('LAT', 'A', 0x10, 40)
    expect(g.trace).toEqual([
      { t: 20, pin: 'RA4', level: 1 },
      { t: 20, pin: 'RA5', level: 1 },
      { t: 40, pin: 'RA5', level: 0 },
    ])
  })
})

describe('bouton (H3)', () => {
  it('10 000 transitions, graine fixe : 30 % ± 2 % rebondissent, aucun rebond après 3 ms, niveau final correct', () => {
    const rng = mulberry32(12345)
    let bounced = 0
    let maxSpan = 0
    let finalOk = 0
    let minWidth = Infinity
    let countsOk = true
    const N = 10_000
    for (let k = 0; k < N; k++) {
      const target = (k % 2) as 0 | 1
      const t0 = k * 0.01
      const edges = transitionEdges(t0, target, rng, true)
      if (edges.length > 1) bounced++
      const n = (edges.length - 1) / 2
      if (edges.length > 1 && (n < INFO3.button.bounceCount.min || n > INFO3.button.bounceCount.max || !Number.isInteger(n))) countsOk = false
      maxSpan = Math.max(maxSpan, edges[edges.length - 1].t - t0)
      for (let j = 1; j < edges.length; j++) minWidth = Math.min(minWidth, edges[j].t - edges[j - 1].t)
      if (edges[edges.length - 1].level === target) finalOk++
    }
    expect(Math.abs(bounced / N - INFO3.button.bounceProbability)).toBeLessThanOrEqual(0.02)
    expect(maxSpan).toBeLessThanOrEqual(INFO3.button.bounceDuration.max)
    expect(minWidth).toBeGreaterThanOrEqual(INFO3.button.minBounceWidth - 1e-12)
    expect(countsOk).toBe(true)
    expect(finalOk).toBe(N)
  })

  it('reproductible avec la même graine ; appui « propre » sans rebond', () => {
    const a = transitionEdges(0, 0, mulberry32(7), true)
    const b = transitionEdges(0, 0, mulberry32(7), true)
    expect(a).toEqual(b)
    const btn = new Button({ activeLevel: 0, rng: mulberry32(1) })
    expect(btn.press(1, false)).toEqual([{ t: 1, level: 0 }])
    expect(btn.release(2, false)).toEqual([{ t: 2, level: 1 }])
  })

  it('S1 et S2 actifs à 0 (brochage)', () => {
    for (const b of INFO3.pins.buttons) expect(b.activeLevel).toBe(0)
  })
})
