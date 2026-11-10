// Assertions de temps réel (performance.now()) : hors de `npm test`, lancées par `npm run test:perf` en série.
import { describe, expect, it } from 'vitest'
import { simulate } from './stepper'

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
