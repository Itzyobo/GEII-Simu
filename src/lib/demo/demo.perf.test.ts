import { describe, expect, it } from 'vitest'
import { gradePartiel, subjectOf } from '../reseaux/partiel'
import { createHeadlessLab } from './headless'
import { DemoRunner } from './runner'
import { scriptFor, seedsFor, VARIANTS, type Variant } from './scripts'

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

describe('démos jouées sans animation : 20 sujets par variante, réponses notées au maximum', () => {
  for (const { id } of VARIANTS)
    it(`${id} : 20 sujets`, async () => {
      const seeds = seedsFor(id, 20)
      expect(seeds).toHaveLength(20)
      for (const seed of seeds) {
        const { note, max } = await play(id, seed)
        expect(note, `${id} graine ${seed}`).toBe(max)
      }
    }, 300_000)
})
