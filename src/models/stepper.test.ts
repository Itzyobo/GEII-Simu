import { describe, expect, it } from 'vitest'
import { PAP } from '../data/reference'
import {
  apparentInductance, calibrate, clocksPerCurrentPeriod, findFreq2, modeFromSwitches,
  phaseShiftDeg, setpoint, simulate, speedRpm,
} from './stepper'

describe('TB6600 : modes S1-S2-S3', () => {
  it('table du driver, autre combinaison = inactif', () => {
    expect(modeFromSwitches([true, true, false])).toBe('entier')
    expect(modeFromSwitches([true, false, true])).toBe('demi')
    expect(modeFromSwitches([true, false, false])).toBe('quart')
    expect(modeFromSwitches([false, false, false])).toBeNull()
    expect(modeFromSwitches([true, true, true])).toBeNull()
  })
})

describe('vitesse N = 60·f/Np', () => {
  it('20 Hz pas entier → 6 tr/min ; 180 Hz demi-pas → 27 tr/min', () => {
    expect(speedRpm(20, 'entier')).toBeCloseTo(6, 9)
    expect(speedRpm(180, 'demi')).toBeCloseTo(27, 9)
    expect(simulate({ f: 20, mode: 'entier', dir: 1 }).rpm).toBeCloseTo(6, 9)
  })

  it('au-delà du décrochage : N = 0 mais les courants restent', () => {
    const sim = simulate({ f: PAP.fDecrochage * 1.2, mode: 'entier', dir: 1 })
    expect(sim.rpm).toBe(0)
    expect(Math.max(...sim.iA)).toBeGreaterThan(0.3)
  })
})

describe('régulation de courant', () => {
  it('200 Hz pas entier : paliers ±1 A hachés entre 0,9 et 1 A', () => {
    const sim = simulate({ f: 200, mode: 'entier', dir: 1 })
    let checked = 0
    let chops = 0
    for (let j = 1; j < sim.iA.length; j++) {
      const u = j * sim.dt * sim.f // en périodes d'horloge (buffer aligné sur l'horloge)
      // La consigne change toutes les 2 horloges : on ignore la montée (1,5 ms = 0,3 horloge) et la frontière.
      if (u % 2 < 0.3 || u % 2 > 1.99) continue
      const c = setpoint('entier', Math.floor(u) % 4, 'A', 1)
      const x = sim.iA[j] * Math.sign(c)
      // Tolérance = un pas d'Euler (1 µs × di/dt ≤ 2,6 A/ms) : le comparateur n'agit qu'à chaque pas.
      expect(x).toBeGreaterThanOrEqual(0.9 - 0.003)
      expect(x).toBeLessThanOrEqual(1 + 0.003)
      checked++
      if (Math.abs(sim.iA[j - 1]) < 0.95 && Math.abs(sim.iA[j]) >= 0.95) chops++
    }
    expect(checked).toBeGreaterThan(10_000)
    expect(chops).toBeGreaterThan(50) // le hachage est bien présent
  })

  it('passage en mode tension (Freq2) entre 1350 et 1450 Hz', () => {
    const f2 = findFreq2()
    expect(f2).toBeGreaterThanOrEqual(1350)
    expect(f2).toBeLessThanOrEqual(1450)
  })
})

describe('séquence des courants', () => {
  it('4 / 8 / 16 périodes d’horloge par période de courant', () => {
    expect(clocksPerCurrentPeriod(simulate({ f: 200, mode: 'entier', dir: 1 }))).toBeCloseTo(4, 2)
    expect(clocksPerCurrentPeriod(simulate({ f: 200, mode: 'demi', dir: 1 }))).toBeCloseTo(8, 2)
    expect(clocksPerCurrentPeriod(simulate({ f: 200, mode: 'quart', dir: 1 }))).toBeCloseTo(16, 2)
  })

  it('I_B en avance de T/4, puis en retard de T/4 avec DIR inversé', () => {
    for (const mode of ['entier', 'demi', 'quart'] as const) {
      expect(phaseShiftDeg(simulate({ f: 200, mode, dir: 1 }))).toBeCloseTo(90, -0.5)
      expect(phaseShiftDeg(simulate({ f: 200, mode, dir: -1 }))).toBeCloseTo(-90, -0.5)
    }
  })
})

describe('performance', () => {
  it('recalcul < 50 ms dans tous les modes, de 10 Hz à 10 kHz', () => {
    simulate({ f: 200, mode: 'entier', dir: 1 }) // préchauffage du JIT
    for (const mode of ['entier', 'demi', 'quart'] as const)
      for (const f of [10, 20, 50, 62, 63, 80, 81, 100, 200, 1400, 10000]) {
        const t = performance.now()
        const sim = simulate({ f, mode, dir: 1 })
        const ms = performance.now() - t
        expect(ms, `${mode} ${f} Hz : ${ms.toFixed(1)} ms`).toBeLessThan(50)
        expect(sim.duration).toBeGreaterThanOrEqual(sim.period * 0.999) // au moins une période
      }
  })
})

describe('inductance et calage', () => {
  it('à 1 kHz, L = 15·Δt/Δi sur la montée −1 A → +1 A : entre 9 et 10,5 mH, 9,7 mH ±3 %', () => {
    const l = apparentInductance()
    expect(l).toBeGreaterThanOrEqual(9e-3)
    expect(l).toBeLessThanOrEqual(10.5e-3)
    expect(Math.abs(l - PAP.lApparenteMesuree) / PAP.lApparenteMesuree).toBeLessThan(0.03)
  })

  it('script de calage : retrouve L réelle et Ke de reference.ts (Freq2 cible 1425 Hz)', () => {
    const r = calibrate(1425)
    expect(r.l).toBeGreaterThanOrEqual(5e-3)
    expect(r.l).toBeLessThanOrEqual(10e-3)
    expect(r.ke).toBeGreaterThan(0)
    expect(r.ke).toBeLessThan(0.15)
    expect(Math.abs(r.l - PAP.lReelle) / PAP.lReelle).toBeLessThan(0.01)
    expect(Math.abs(r.ke - PAP.ke) / PAP.ke).toBeLessThan(0.01)
  }, 60_000)
})
