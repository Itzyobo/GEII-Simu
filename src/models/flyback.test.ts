import { describe, expect, it } from 'vitest'
import { FLYBACK } from '../data/reference'
import { discontinuityThreshold, etaIsVoltageRatio, idleFraction, measureRatio, operatingPoint, releveChecks } from './flyback'

/** Générateur pseudo-aléatoire reproductible (LCG) pour le bruit. */
function seeded(seed = 1) {
  let s = seed
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296)
}

describe('flyback MAX17691B', () => {
  it('η à 0,5 A dans [80 %, 90 %], et η = Vs·Is/(Ve·Ie)', () => {
    const op = operatingPoint({ ve: 30, is: 0.5, linear: false })
    expect(op.eta).toBeGreaterThanOrEqual(0.8)
    expect(op.eta).toBeLessThanOrEqual(0.9)
    expect(op.ps / op.pe).toBeCloseTo(op.eta, 12)
    expect(op.ie).toBeCloseTo((5 * 0.5) / (op.eta * 30), 12)
  })

  it('alim linéaire : Ie = Is, η = 16,7 % à Ve = 30 V', () => {
    const op = operatingPoint({ ve: 30, is: 0.5, linear: true })
    expect(op.ie).toBe(0.5)
    expect(op.eta * 100).toBeCloseTo(16.67, 2)
  })

  it('m retrouvé par |V2_on| / Ve à ±2 % (avec bruit)', () => {
    for (const ve of [18, 30, 36]) {
      const m = measureRatio({ ve, is: 0.5, linear: false }, seeded(ve))
      expect(Math.abs(m - FLYBACK.m) / FLYBACK.m).toBeLessThan(0.02)
    }
  })

  it('rapport cyclique continu α = (Vs+Vd)/(Vs+Vd+m·Ve), plus petit et décroissant en discontinu', () => {
    const ccm = operatingPoint({ ve: 30, is: 0.4, linear: false })
    expect(ccm.alpha).toBeCloseTo((5.7) / (5.7 + 10), 9)
    const a1 = operatingPoint({ ve: 30, is: 0.1, linear: false }).alpha
    const a2 = operatingPoint({ ve: 30, is: 0.05, linear: false }).alpha
    expect(a1).toBeLessThan(ccm.alpha)
    expect(a2).toBeLessThan(a1)
  })

  it('conduction discontinue sous 0,15 A, continue au-dessus (vu sur V2)', () => {
    expect(operatingPoint({ ve: 30, is: 0.149, linear: false }).discontinuous).toBe(true)
    expect(operatingPoint({ ve: 30, is: 0.151, linear: false }).discontinuous).toBe(false)
    for (const is of [0.05, 0.1]) expect(idleFraction({ ve: 30, is, linear: false }, seeded(2))).toBeGreaterThan(0.05)
    for (const is of [0.2, 0.5]) expect(idleFraction({ ve: 30, is, linear: false }, seeded(3))).toBeLessThan(0.03)
  })
})

describe('tableau des relevés (partie 2)', () => {
  const bench = { ve: 30, ie: 0.0936, vs: 5, is: 0.5 }
  const row = (eta: number) => ({ ...bench, pin: 30 * 0.0936, pout: 2.5, eta })

  it('lectures à ±5 % du banc, calculs à ±3 % des mesures saisies', () => {
    const c = releveChecks(bench, { ...row(89), ve: 30.9 })
    expect(c.ve).toEqual({ expected: 30, tol: 0.05 })
    expect(c.pin.expected).toBeCloseTo(30.9 * 0.0936, 12)
    expect(c.eta.expected).toBeCloseTo((100 * 2.5) / (30.9 * 0.0936), 12)
    expect(c.eta.tol).toBe(0.03)
  })

  it('erreur pédagogique : η = Vs/Ve détecté, pas un η juste', () => {
    expect(etaIsVoltageRatio(row(16.7))).toBe(true) // 5/30
    expect(etaIsVoltageRatio(row(89))).toBe(false) // Ps/Pe correct
    expect(etaIsVoltageRatio(row(50))).toBe(false) // faux, mais pas Vs/Ve
    // alim linéaire : Ps/Pe = Vs/Ve, la réponse est juste donc pas signalée
    expect(etaIsVoltageRatio({ ve: 30, ie: 0.5, vs: 5, is: 0.5, pin: 15, pout: 2.5, eta: 16.7 })).toBe(false)
  })
})

describe('question conduction continue / discontinue (V2)', () => {
  it('courant de basculement trouvé par balayage du modèle = seuil de reference.ts', () => {
    expect(discontinuityThreshold(30)).toBeCloseTo(FLYBACK.iDiscontinu, 2)
  })
  it('palier visible sur V2 à charge mini, absent à charge maxi (réponse du QCM)', () => {
    expect(idleFraction({ ve: 30, is: FLYBACK.isMin, linear: false }, seeded(4))).toBeGreaterThan(0.05)
    expect(idleFraction({ ve: 30, is: FLYBACK.isMax, linear: false }, seeded(5))).toBeLessThan(0.03)
  })
})
