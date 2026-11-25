import { describe, expect, it } from 'vitest'
import { gradePartiel, subjectOf } from '../reseaux/partiel'
import { createHeadlessLab } from './headless'
import type { Lab } from './lab'
import { DemoRunner } from './runner'
import { demoSeed, scriptFor, seedsFor, VARIANTS, type Variant } from './scripts'

const PART_INDEX = { cable: 0, serie: 1, ping: 2 } as const
const MAX = [7, 6, 7] as const

async function play(v: Variant, seed: number) {
  const part = VARIANTS.find((x) => x.id === v)!.part
  const s = subjectOf(seed)
  const lab = createHeadlessLab(s, part)
  const r = new DemoRunner(scriptFor(part, s), lab, s)
  await r.runAll()
  return { s, lab, r, note: gradePartiel(s, lab.answers()).parts[PART_INDEX[part]]!.pts, max: MAX[PART_INDEX[part]] }
}

describe('démos jouées sans animation : réponses notées au maximum', () => {
  // 20 sujets par variante : demo.perf.test.ts (npm run test:perf)
  for (const { id } of VARIANTS)
    it(`${id} : 3 sujets`, async () => {
      const seeds = seedsFor(id, 3)
      expect(seeds).toHaveLength(3)
      for (const seed of seeds) {
        const { note, max } = await play(id, seed)
        expect(note, `${id} graine ${seed}`).toBe(max)
      }
    }, 300_000)
  it('seeds de démonstration fixes', async () => {
    for (const { id } of VARIANTS) {
      const { note, max } = await play(id, demoSeed(id))
      expect(note, id).toBe(max)
    }
  }, 120_000)
})

describe('Précédent / reprise', () => {
  it('restoreTo rétablit exactement l’état du début de l’étape', async () => {
    const s = subjectOf(demoSeed('cable75'))
    const lab = createHeadlessLab(s, 'cable')
    const r = new DemoRunner(scriptFor('cable', s), lab, s)
    for (let i = 0; i < 6; i++) await r.next()
    const atStep3 = JSON.stringify(lab.snapshot())
    for (let i = 0; i < 3; i++) await r.next()
    expect(JSON.stringify(lab.snapshot())).not.toBe(atStep3)
    r.restoreTo(6)
    expect(JSON.stringify(lab.snapshot())).toBe(atStep3)
    expect(r.index).toBe(6)
    // Précédent : rejoue l'étape d'avant l'étape affichée
    await r.next()
    await r.prev()
    expect(r.index).toBe(6)
  }, 60_000)
})

describe('aucune action ne contourne les setters', () => {
  it('rejouer les seuls appels au Lab sur un labo neuf redonne le même état final', async () => {
    for (const v of ['cable50', 'serie', 'pingCourt'] as const) {
      const part = VARIANTS.find((x) => x.id === v)!.part
      const s = subjectOf(demoSeed(v))
      const real = createHeadlessLab(s, part)
      const calls: [string, unknown[]][] = []
      // Le runner ne voit qu'un mandataire qui journalise chaque appel
      const spy = new Proxy(real, {
        get(target, prop: string) {
          const f = (target as unknown as Record<string, unknown>)[prop]
          return typeof f === 'function' ? (...args: unknown[]) => (calls.push([prop, args]), (f as (...a: unknown[]) => unknown).apply(target, args)) : f
        },
      }) as Lab
      await new DemoRunner(scriptFor(part, s), spy, s).runAll()
      const fresh = createHeadlessLab(s, part)
      for (const [m, args] of calls) await (fresh as unknown as Record<string, (...a: unknown[]) => unknown>)[m]!(...args)
      expect(JSON.stringify(fresh.snapshot()), v).toBe(JSON.stringify(real.snapshot()))
      expect(calls.some(([m]) => m === 'setAnswer')).toBe(true)
    }
  }, 120_000)
})
