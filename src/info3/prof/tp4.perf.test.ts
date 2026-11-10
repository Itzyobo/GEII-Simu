// Assertions de temps réel (performance.now()) : hors de `npm test`, lancées par `npm run test:perf` en série.
import { describe, expect, it } from 'vitest'
import { generate } from '../mcc/generator'
import { tp42Config } from '../mcc/presets'
import type { MccConfig } from '../mcc/config'
import { createSimState, handleMessage } from '../worker/handler'
import { SOLUTIONS } from '../solutions'

const files = (main: string, cfg: MccConfig) => ({ 'main.c': main, ...generate(cfg) })
const REF = { 'tp4-4': ['tp4/q4', tp42Config(0)], 'tp4-6': ['tp4/q6', tp42Config(0)] } as const

describe('performance (test 12) : 60 s simulées à ×10 dans le Worker', () => {
  for (const id of ['tp4-4', 'tp4-6'] as const) {
    it(`${id} : aucun tick de plus de 50 ms, 60 s simulées`, () => {
      const state = createSimState()
      handleMessage(state, { type: 'bench', rotary: 'mikrobus2' })
      handleMessage(state, { type: 'load', files: files(SOLUTIONS[REF[id][0]], REF[id][1]) })
      handleMessage(state, { type: 'run', speed: 10 })
      let worst = 0
      for (let k = 0; k < 600; k++) {
        const t = performance.now()
        handleMessage(state, { type: 'tick', wallMs: 10 })
        worst = Math.max(worst, performance.now() - t)
      }
      expect(worst).toBeLessThan(50)
      expect(state.vm!.timeS).toBeGreaterThan(59)
    })
  }
})
