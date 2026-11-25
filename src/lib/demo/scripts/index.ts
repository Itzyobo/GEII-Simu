/** Scripts de démonstration du partiel et seeds de démonstration fixes par variante */
import { RES3 } from '../../../data/reference'
import { subjectOf, type PartielSubject } from '../../reseaux/partiel'
import type { DemoScript } from '../types'
import { cableScript } from './cable'
import { pingScript } from './ping'
import { serieScript } from './serie'

export type DemoPart = 'cable' | 'serie' | 'ping'
export type Variant = 'cable50' | 'cable75' | 'serie' | 'pingCourt' | 'pingLong'

export const VARIANTS: { id: Variant; part: DemoPart; label: string }[] = [
  { id: 'cable50', part: 'cable', label: 'Câble 50 Ω' },
  { id: 'cable75', part: 'cable', label: 'Câble 75 Ω' },
  { id: 'serie', part: 'serie', label: 'Trame série' },
  { id: 'pingCourt', part: 'ping', label: 'Ping court, avec bourrage' },
  { id: 'pingLong', part: 'ping', label: 'Ping long' },
]

/** Le sujet convient-il à la variante ? */
export function fits(v: Variant, s: PartielSubject): boolean {
  if (v === 'cable50') return s.coax.cable.Zc === RES3.cables.RG58.zc
  if (v === 'cable75') return s.coax.cable.Zc === RES3.cables.RG59.zc
  if (v === 'pingCourt') return s.ping.L < 18
  if (v === 'pingLong') return s.ping.L > 18
  return true
}

/** Seeds qui conviennent à une variante, à partir de `from` */
export function seedsFor(v: Variant, count: number, from = 1): number[] {
  const out: number[] = []
  for (let s = from; out.length < count && s < from + 5000; s++) if (fits(v, subjectOf(s))) out.push(s)
  return out
}

/** Seed de démonstration fixe (le premier qui convient à partir de 100) */
export const demoSeed = (v: Variant) => seedsFor(v, 1, 100)[0]!

/** Seed qui convient à plusieurs variantes à la fois (démonstration complète) */
export function demoSeedFor(vs: readonly Variant[]): number {
  for (let s = 100; s < 5100; s++) if (vs.every((v) => fits(v, subjectOf(s)))) return s
  return 100
}

/** Démonstration complète : câble 50 Ω, trame série, ping court (avec bourrage) */
export const COMPLETE: Variant[] = ['cable50', 'serie', 'pingCourt']
export const PART_INDEX: Record<DemoPart, 0 | 1 | 2> = { cable: 0, serie: 1, ping: 2 }
export const partOf = (v: Variant): DemoPart => VARIANTS.find((x) => x.id === v)!.part

export function scriptFor(part: DemoPart, s: PartielSubject): DemoScript {
  return part === 'cable' ? cableScript() : part === 'serie' ? serieScript(s.serie.expected.message.length) : pingScript()
}
