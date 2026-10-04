import { describe, expect, it } from 'vitest'
import { acquire, frameStart, measure, SCOPE_POINTS } from './scope'
import { demoSine, demoSquare } from '../pages/demoSignals'

/** Même chaîne que l'écran : trigger sur CH1 (sinus, niveau 0 V), mesure de CH2 (carré). */
function measureDemo(tNow: number, secPerDiv: number) {
  const span = 10 * secPerDiv
  const { t0, triggered } = frameStart(demoSine, 0, tNow, span, SCOPE_POINTS)
  return { t0, triggered, m: measure(acquire(demoSquare, t0, span, SCOPE_POINTS), span / SCOPE_POINTS) }
}

describe('mesures auto de l’oscilloscope sur le carré de démo', () => {
  for (const secPerDiv of [0.2e-3, 0.5e-3, 1e-3]) {
    it(`1 kHz et 30 % à ±1 % (${secPerDiv * 1e3} ms/div)`, () => {
      const { triggered, m } = measureDemo(12.3456, secPerDiv)
      expect(triggered).toBe(true)
      expect(Math.abs(m.freq - 1000) / 1000).toBeLessThan(0.01)
      expect(Math.abs(m.duty - 0.3) / 0.3).toBeLessThan(0.01)
      expect(m.max).toBe(5)
      expect(m.min).toBe(0)
    })
  }

  it('trace stable : le trigger cale la fenêtre sur la même phase quel que soit l’instant', () => {
    const phase = (t: number) => ((t * 1000) % 1 + 1) % 1
    const a = measureDemo(3.21, 0.2e-3)
    const b = measureDemo(987.654321, 0.2e-3)
    expect(Math.abs(phase(a.t0) - phase(b.t0))).toBeLessThan(1e-4)
  })

  it('moins d’une période à l’écran → fréquence non mesurée', () => {
    expect(Number.isNaN(measureDemo(1, 20e-6).m.freq)).toBe(true)
  })
})
