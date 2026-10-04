import { describe, expect, it } from 'vitest'
import { MAS } from '../data/reference'
import {
  exactNoLoad, inverterVoltage, lossSeparation, lossVerdict, motorState, nominalTorque, ohmmeter, polePairs, powerBalance,
  STAR_ALERT, syncSpeed, tripReason, wattmeterPhases,
} from './asyncMotor'

const tri = (couple: number) => motorState({ couple, couplage: 'triangle', source: 'reseau', f: 50 })
const star = (couple: number) => motorState({ couple, couplage: 'etoile', source: 'reseau', f: 50 })
const rel = (x: number, target: number) => Math.abs(x - target) / Math.abs(target)

describe('machine asynchrone — triangle sur 400 V', () => {
  it('Cu nominal = Pn/Ωn = 9,95 N·m (±1 %), p = 2, Ns = 1500 tr/min', () => {
    expect(rel(nominalTorque(), 9.95)).toBeLessThan(0.01)
    expect(polePairs()).toBe(2)
    expect(syncSpeed(50)).toBe(1500)
  })

  it('à 10 N·m : N = 1436 tr/min (±0,5 %), Is = 3,6 A (±3 %)', () => {
    const st = tri(10)
    expect(rel(st.n, 1436)).toBeLessThan(0.005)
    expect(rel(st.is, 3.6)).toBeLessThan(0.03)
  })

  it('g nominal = 4,3 % (±0,3 point), η nominal = 74 % (±2 points)', () => {
    const st = tri(10)
    expect(Math.abs(st.g * 100 - 4.3)).toBeLessThanOrEqual(0.3)
    expect(Math.abs(st.eta * 100 - 74)).toBeLessThanOrEqual(2)
    expect(st.s).toBeCloseTo(Math.hypot(st.pa, st.qa), 9)
    expect(st.cosPhi).toBeCloseTo(st.pa / st.s, 9)
  })

  it('wattmètre : chaque phase indique le tiers, le total est la somme', () => {
    const w = wattmeterPhases(2027, 1489)
    expect(w.phases[0].p * 3).toBeCloseTo(2027, 9)
    expect(w.phases.reduce((s, ph) => s + ph.q, 0)).toBeCloseTo(w.total.q, 9)
  })
})

describe('protections', () => {
  it('aucune coupure à 10 N·m ; coupure au-delà de 3 V au capteur ou de 3,9 A', () => {
    expect(tri(10).trip).toBeNull()
    expect(tri(10.2).trip).toMatch(/capteur/)
    expect(tripReason(2.5, 3.95)).toMatch(/courant/)
    expect(tripReason(2.5, 3.85)).toBeNull()
    expect(tripReason(3.01, 1)).toMatch(/capteur/)
  })
})

describe('étoile sur 400 V (mauvais couplage)', () => {
  it('à vide : P\'0 = 49,8 W, I\'0 = 0,5 A, N ≈ 1500 tr/min', () => {
    const st = star(0)
    expect(st.pa).toBeCloseTo(MAS.p0Etoile400, 9)
    expect(st.is).toBeCloseTo(MAS.i0Etoile400, 9)
    expect(rel(st.n, 1500)).toBeLessThan(0.01)
    expect(st.v).toBeCloseTo(230.9, 1)
  })

  it('glissement ×3 à couple égal ; alerte au-delà de 3 N·m', () => {
    expect(star(2).g).toBeCloseTo(3 * tri(2).g, 9)
    expect(star(3).alerts).toEqual([])
    expect(star(3.5).alerts).toEqual([STAR_ALERT])
  })
})

describe('ohmmètre', () => {
  it('12 / 8 / 24 Ω selon les barrettes, refus sous tension', () => {
    expect(ohmmeter('aucune', 'U1-U2', false)).toBe(12)
    expect(ohmmeter('triangle', 'U1-V1', false)).toBeCloseTo(8, 9)
    expect(ohmmeter('etoile', 'U1-V1', false)).toBe(24)
    expect(ohmmeter('aucune', 'U1-V1', false)).toBe(Infinity)
    expect(ohmmeter('triangle', 'U1-V1', true)).toBeNull()
  })
})

describe('variateur', () => {
  it('U/f fondamental dans [7,7 ; 8,6] V/Hz à 15, 35, 50 Hz ; en RMS, écart > 30 % entre 15 et 50 Hz', () => {
    for (const f of [15, 35, 50]) {
      const uf = inverterVoltage(f, 'fondamental') / f
      expect(uf).toBeGreaterThanOrEqual(7.7)
      expect(uf).toBeLessThanOrEqual(8.6)
    }
    const r15 = inverterVoltage(15, 'rms') / 15
    const r50 = inverterVoltage(50, 'rms') / 50
    expect(Math.abs(r15 - r50) / r50).toBeGreaterThan(0.3)
  })

  it('Ns = 60·f/p et N = Ns·(1 − g) au glissement du couple courant', () => {
    const st = motorState({ couple: 5, couplage: 'triangle', source: 'variateur', f: 35 })
    expect(st.ns).toBe(1050)
    expect(st.n).toBeCloseTo(1050 * (1 - tri(5).g), 9)
  })
})

describe('séparation des pertes (valeurs exactes)', () => {
  it('α = 1,115·10⁻³ W/V² (±3 %) et Pméca ≈ −18,7 W', () => {
    const r = lossSeparation(exactNoLoad())
    expect(rel(r.alpha, 1.115e-3)).toBeLessThan(0.03)
    expect(Math.abs(r.pmeca - -18.7)).toBeLessThan(0.5)
    expect(r.pjsD).toBeCloseTo(3 * 12 * (1.8 / Math.sqrt(3)) ** 2, 9)
    expect(r.pjsY).toBeCloseTo(3 * 12 * 0.25, 9)
  })
})

describe('question 8 : explication selon le signe de Pméca', () => {
  it('Pméca < 0 avec les valeurs exactes : saturation et imprécision du wattmètre', () => {
    const v = lossVerdict(exactNoLoad())
    expect(v.kind).toBe('negatif')
    expect(v.text).toMatch(/satur/)
    expect(v.text).toMatch(/0,15/)
  })

  it('Pméca ≥ 0 : valeur sensible, incertitude propagée à ±1,5 % par lecture', () => {
    const inputs = { ...exactNoLoad(), p0y: 70 }
    const v = lossVerdict(inputs)
    expect(v.kind).toBe('positif')
    expect(v.pmeca).toBeGreaterThan(0)
    expect(v.text).toMatch(/petite différence/)
    // Contrôle de l'incertitude par différences finies : somme des |∂Pméca/∂x|·1,5 %·x
    const keys = ['p0d', 'i0d', 'p0y', 'i0y'] as const
    const sum = keys.reduce((s, k) => {
      const h = inputs[k] * 1e-6
      const d = (lossSeparation({ ...inputs, [k]: inputs[k] + h }).pmeca - lossSeparation(inputs).pmeca) / h
      return s + Math.abs(d) * 0.015 * inputs[k]
    }, 0)
    expect(v.uncertainty).toBeCloseTo(sum, 3)
  })
})

describe('bilan de puissance au point nominal', () => {
  it('Pméca(bilan) ≈ 117 W (±10 %) avec Pa = 2027 W, Is = 3,6 A, g = 4,27 %, Pu ≈ 1504 W', () => {
    const { alpha } = lossSeparation(exactNoLoad())
    const b = powerBalance({ pa: 2027, is: 3.6, g: 0.0427, pu: 1504, alpha })
    expect(Math.abs(b.pmeca - 117) / 117).toBeLessThan(0.1)
    expect(b.pjs).toBeCloseTo(12 * 3.6 ** 2, 9)
    expect(b.eta).toBeCloseTo(1504 / 2027, 9)
  })
})
