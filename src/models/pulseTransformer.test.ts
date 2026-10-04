import { describe, expect, it } from 'vitest'
import { ALIM } from '../data/reference'
import { accumulates, demagTime, peak, ripple, saturationOnset, simulatePulse } from './pulseTransformer'

const near = (x: number, target: number, tol: number) => expect(Math.abs(x - target) / target).toBeLessThan(tol)

describe('transformateur d’impulsions', () => {
  it('I1max ≈ 22,7 mA pour une impulsion de 100 µs (±3 %)', () => {
    near(peak(simulatePulse({ f: 5000, width: 100e-6, d2: false, c: false }).i1), 22.7e-3, 0.03)
  })

  it('t2 − t1 ≈ 32 µs (±5 %), v1 = −Vz pendant la démagnétisation', () => {
    const sim = simulatePulse({ f: 5000, width: 100e-6, d2: false, c: false })
    near(demagTime(sim), 32e-6, 0.05)
    expect(sim.v1.reduce((m, x) => Math.min(m, x), 0)).toBeCloseTo(-ALIM.vz, 6)
  })

  it('à 2 kHz, saturation à partir d’une largeur ≈ 176 µs (±10 %)', () => {
    near(saturationOnset(2000), 176e-6, 0.1)
    expect(simulatePulse({ f: 2000, width: 150e-6, d2: false, c: false }).saturates).toBe(false)
    expect(simulatePulse({ f: 2000, width: 250e-6, d2: false, c: false }).saturates).toBe(true)
  })

  it('démagnétisation incomplète : le courant s’accumule de période en période', () => {
    expect(accumulates(5000, 100e-6)).toBe(false)
    expect(accumulates(5000, 180e-6)).toBe(true)
    const sim = simulatePulse({ f: 5000, width: 180e-6, d2: false, c: false })
    const perPeriod = Math.round(200e-6 / sim.dt)
    expect(peak(sim.i1.slice(3 * perPeriod, 4 * perPeriod))).toBeGreaterThan(peak(sim.i1.slice(0, perPeriod)))
  })

  it('sortie : rien sans D2, vs = max(v2 − Vd, 0) avec D2 + Rs', () => {
    expect(peak(simulatePulse({ f: 2000, width: 150e-6, d2: false, c: false }).vs)).toBe(0)
    const sim = simulatePulse({ f: 2000, width: 150e-6, d2: true, c: false })
    expect(peak(sim.vs)).toBeCloseTo(ALIM.E - ALIM.vd, 5)
    expect(sim.vs.reduce((m, x) => Math.min(m, x), Infinity)).toBe(0)
  })

  it('avec C : ΔV de vs plus petit à 5 kHz qu’à 1 kHz, et plus petit avec une capacité plus grande', () => {
    const at = (f: number, cap?: number) => ripple(simulatePulse({ f, width: 100e-6, d2: true, c: true, cap }).vs)
    expect(at(5000)).toBeLessThan(at(1000))
    expect(at(1000, 2 * ALIM.c)).toBeLessThan(at(1000))
  })
})
