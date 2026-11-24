import { describe, expect, it } from 'vitest'
import { RES3 } from '../../data/reference'
import { generateCable, lengthFromDelay, zcFromAmplitude } from './coax'
import { tp1Attendus, tp1Conseils } from './tp1'

describe('attendus du TP1, calculés depuis le modèle', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const c = generateCable(seed)
    const a = tp1Attendus(c)
    it(`graine ${seed} (${c.type}, ${c.l} m) : les deux méthodes retrouvent Zc et l`, () => {
      expect(zcFromAmplitude(RES3.eg, a.Ei, RES3.zg)).toBeCloseTo(c.Zc, 9)
      expect(lengthFromDelay(a.dt, RES3.v)).toBeCloseTo(c.l, 9)
      expect(a.egVide).toBeCloseTo(RES3.eg, 3)
      expect(a.ratioOpen).toBeGreaterThan(0)
      expect(a.ratioShort).toBeCloseTo(-a.ratioOpen, 12)
      expect(a.bfOpen).toBe(RES3.eg)
      expect(a.bfShort).toBe(0)
      expect(a.phase).toBeGreaterThanOrEqual(0)
      expect(a.phase).toBeLessThan(360)
    })
  }
  it('réglages conseillés : l’écho tient dans l’écran, niveau à mi-hauteur', () => {
    const c = generateCable(3)
    const a = tp1Attendus(c)
    const k = tp1Conseils(c).b
    expect(8 * k.sdiv).toBeGreaterThanOrEqual(a.dt)
    expect(k.niveau).toBeCloseTo(a.Ei / 2, 12)
    expect(a.Ei / k.vdiv).toBeLessThanOrEqual(3.01)
  })
})
