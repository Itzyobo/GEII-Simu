import { describe, expect, it } from 'vitest'
import { RES3 } from '../../data/reference'
import {
  attenuationDb,
  coaxSources,
  coaxTerms,
  createCoaxExercise,
  gamma,
  generateCable,
  gradeCoax,
  lengthFromDelay,
  lengthFromSpires,
  phaseLagDeg,
  zcFromAmplitude,
  type CoaxParams,
} from './coax'

const W = RES3.largeur
const pulse = { kind: 'pulse', width: W, period: RES3.periode } as const
const base = (p: Partial<CoaxParams>): CoaxParams => ({ Zc: 50, l: 100, ZL: Infinity, alpha: 0, wave: pulse, ...p })
const tau = 100 / RES3.v
/** Milieu du palier de l'impulsion arrivée au retard d */
const mid = (d: number) => d + W / 2

describe('treillis en impulsions', () => {
  it('ligne adaptée 50 Ω : aucun écho sur CH1', () => {
    const { ch1 } = coaxTerms(base({ ZL: 50 }))
    expect(ch1).toHaveLength(1)
    const s = coaxSources(base({ ZL: 50 })).ch1
    expect(s.value(mid(0))).toBeCloseTo(4, 9)
    expect(s.value(mid(2 * tau))).toBeCloseTo(0, 9)
  })

  it('ouverte : écho +Ei à 2τ (sans pertes)', () => {
    const s = coaxSources(base({})).ch1
    expect(s.value(mid(2 * tau))).toBeCloseTo(4, 9)
    expect(coaxTerms(base({})).ch1).toHaveLength(2) // Γg = 0 : un seul écho
  })

  it('court-circuit : écho −Ei à 2τ', () => {
    expect(coaxSources(base({ ZL: 0 })).ch1.value(mid(2 * tau))).toBeCloseTo(-4, 9)
  })

  it('pertes : écho multiplié par A² = 10^(−2·α·l/100/20)', () => {
    const s = coaxSources(base({ alpha: 5 })).ch1
    expect(s.value(mid(2 * tau))).toBeCloseTo(4 * 10 ** (-10 / 20), 9)
  })

  it('Zc = 75 Ω ouvert : échos multiples alternés (Γg = −0,2)', () => {
    const { ch1, Ei } = coaxTerms(base({ Zc: 75 }))
    expect(gamma(50, 75)).toBeCloseTo(-0.2, 12)
    expect(Ei).toBeCloseTo(4.8, 12)
    expect(ch1.length).toBeGreaterThan(3)
    expect(ch1[1].c).toBeCloseTo(4.8 * 0.8, 9)
    expect(ch1[2].c).toBeCloseTo(4.8 * 0.8 * -0.2, 9)
    for (let k = 2; k < ch1.length; k++) expect(Math.sign(ch1[k].c)).toBe(-Math.sign(ch1[k - 1].c))
  })

  it('extrémité ouverte : 2·Ei arrive à τ', () => {
    const { end } = coaxSources(base({}))
    expect(end.value(mid(tau))).toBeCloseTo(8, 9)
    expect(end.value(mid(0))).toBeCloseTo(0, 9)
  })

  it('coins : début et fin de chaque front, triés', () => {
    const e = coaxSources(base({})).ch1.edges(-1e-9, 2 * tau + W + 10e-9)
    expect(e).toEqual([...e].sort((a, b) => a - b))
    expect(e).toHaveLength(8)
  })
})

describe('régime BF (W ≥ 1 µs) : escalier vers Eg·ZL/(Zg+ZL), A = 1', () => {
  const bf = { kind: 'pulse', width: RES3.largeurBF, period: RES3.periode } as const
  const late = RES3.largeurBF - 1e-6
  const at = (p: Partial<CoaxParams>, t: number) => coaxSources(base({ alpha: 5, wave: bf, ...p })).ch1.value(t)
  for (const Zc of [50, 75]) {
    it(`Zc = ${Zc} Ω : ouvert → Eg, CC → 0, adapté → Eg·Zc/(Zg+Zc)`, () => {
      expect(at({ Zc }, late)).toBeCloseTo(8, 3)
      expect(at({ Zc, ZL: 0 }, late)).toBeCloseTo(0, 3)
      expect(at({ Zc, ZL: Zc }, late)).toBeCloseTo((8 * Zc) / (50 + Zc), 9)
    })
  }
  it('adapté 50 Ω : 4 V constant dès le début', () => {
    for (const t of [10e-9, tau, 3 * tau, late]) expect(at({ ZL: 50 }, t)).toBeCloseTo(4, 9)
  })
  it('charge R quelconque : même limite que le pont diviseur', () => {
    expect(at({ Zc: 75, ZL: 120 }, late)).toBeCloseTo((8 * 120) / 170, 3)
  })
  it('CC : câble non équipotentiel pendant 2τ (Ei sur CH1), puis 0', () => {
    expect(at({ ZL: 0 }, 2 * tau - 10e-9)).toBeCloseTo(4, 9)
    expect(at({ ZL: 0 }, 2 * tau + 10e-9)).toBeCloseTo(0, 9)
  })
  it('escalier 75 Ω ouvert : marches 4,8 → 8,64 → 7,872 …', () => {
    const v = [1, 3, 5].map((k) => at({ Zc: 75 }, k * tau))
    expect(v[0]).toBeCloseTo(4.8, 6)
    expect(v[1]).toBeCloseTo(4.8 + 3.84, 6)
    expect(v[2]).toBeCloseTo(4.8 + 3.84 - 0.768, 6)
  })
})

describe('sinus sur ligne adaptée', () => {
  it('Ve = Eg·Zc/(Zg+Zc), Vs = Ve·A, retard l/v', () => {
    const f = RES3.fSinus
    const p = base({ ZL: 50, alpha: 3.5, wave: { kind: 'sine', f } })
    const { ch1, end } = coaxSources(p)
    expect(ch1.period).toBeCloseTo(1 / f, 15)
    expect(ch1.value(1 / f / 4)).toBeCloseTo(4, 9)
    const A = 10 ** (-3.5 / 20)
    expect(end.value(tau + 1 / f / 4)).toBeCloseTo(4 * A, 9)
    expect(attenuationDb(4, 4 * A)).toBeCloseTo(3.5, 9)
    expect(phaseLagDeg(f, 100, RES3.v)).toBeCloseTo(900 % 360, 9)
  })
})

describe('formules exportées', () => {
  it('zcFromAmplitude retrouve 50 et 75 Ω', () => {
    expect(zcFromAmplitude(8, 4, 50)).toBeCloseTo(50, 12)
    expect(zcFromAmplitude(8, 4.8, 50)).toBeCloseTo(75, 12)
  })
  it('longueurs', () => {
    expect(lengthFromDelay(1e-6, 2e8)).toBe(100)
    expect(lengthFromSpires(100, 0.25)).toBeCloseTo(78.54, 2)
  })
})

describe('câble mystère et API du partiel', () => {
  it('tirages reproductibles, dans les bornes, N·π·D = l à ±8 %', () => {
    expect(generateCable(42)).toEqual(generateCable(42))
    const zcs = new Set<number>()
    for (let seed = 1; seed <= 500; seed++) {
      const c = generateCable(seed)
      zcs.add(c.Zc)
      expect(Number.isInteger(c.l)).toBe(true)
      expect(c.l).toBeGreaterThanOrEqual(40)
      expect(c.l).toBeLessThanOrEqual(120)
      expect(Math.abs(lengthFromSpires(c.N, c.D) - c.l) / c.l).toBeLessThanOrEqual(0.08)
    }
    expect([...zcs].sort()).toEqual([50, 75])
  })
  it('createCoaxExercise / gradeCoax', () => {
    const { cable, expected } = createCoaxExercise(7)
    expect(expected).toEqual({ Zc: cable.Zc, l: cable.l, gammaOpen: 1, gammaShort: -1 })
    expect(gradeCoax(expected, { Zc: cable.Zc * 1.03, l: cable.l, gammaOpen: 0.97, gammaShort: -1 }).score).toBe(1)
    const g = gradeCoax(expected, { Zc: cable.Zc * 1.2, gammaOpen: -1, gammaShort: -1 })
    expect(g.score).toBe(0.25)
    expect(g.details.find((d) => d.key === 'l')?.ok).toBe(false)
  })
})
