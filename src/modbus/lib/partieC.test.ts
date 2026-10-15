import { describe, expect, it } from 'vitest'
import { QUESTIONS, unverifiedOf } from '../data/questions'
import { points } from '../models/answers'
import { champsPartieC } from './partieC'

const C = champsPartieC()
const pts = (q: string, k: string, v: string) => points(C[q]!.find((c) => c.key === k)!.check(v))

describe('correction 3.2 par les modèles', () => {
  it('chaque question 3.2 a des champs', () => {
    for (const q of QUESTIONS.filter((x) => x.section.startsWith('3.2'))) expect(C[q.id]?.length, q.id).toBeGreaterThan(0)
  })
  it('OTB : registres, fonction, trames, LED, mot des entrées', () => {
    expect(pts('s32a-registres', 'sorties', '100')).toBe(1)
    expect(pts('s32a-fonction-sorties', 'fonction', '06')).toBe(1)
    expect(pts('s32a-trame-sorties', 'requete', '17 06 00 64 00 5A 4A D8')).toBe(1)
    expect(C['s32a-trame-sorties']![0]!.check('17 06 00 64 00 5A D8 4A').message).toMatch(/^CRC faux/)
    expect(pts('s32a-leds', 'leds', 'Q1 Q3 Q4 Q6')).toBe(1)
    expect(pts('s32a-relire', 'reponse', '17 03 02 00 5A 71 BC')).toBe(1)
    expect(pts('s32a-trame-entrees', 'requete', '17 03 00 00 00 01 86 FC')).toBe(1)
    expect(pts('s32a-comparer', 'mot', '0F0F')).toBe(1)
  })
  it('TDS : 1234, piège BCD → 4660, « abcd » → AbCd', () => {
    expect(pts('s32b-entier', 'requete', '1E 06 00 71 04 D2 59 23')).toBe(1)
    expect(pts('s32b-entier', 'bcd', '4660')).toBe(1)
    expect(pts('s32b-texte', 'affichage', 'AbCd')).toBe(1)
    expect(pts('s32b-texte', 'affichage', 'abcd')).toBe(0)
  })
  it('TQS et THT : trames, 24,3 °C, 24,0 °C, 23,9 %HR, écart 0,3 °C', () => {
    expect(pts('s32c-trame', 'requete', '23 04 00 01 00 01 66 88')).toBe(1)
    expect(pts('s32c-trame', 'temperature', '24,3')).toBe(1)
    expect(pts('s32d-trame', 'requete', '29 04 00 01 00 01 66 22')).toBe(1)
    expect(pts('s32d-trame', 'temperature', '24.0')).toBe(1)
    expect(pts('s32d-trame', 'humidite', '23,9')).toBe(1)
    expect(pts('s32d-trame', 'ecart', '0,3')).toBe(1)
  })
  it('les questions qui dépendent de H12 ou H13 portent le badge', () => {
    const hyps = unverifiedOf(QUESTIONS.find((q) => q.id === 's32d-trame')!.deps).map((h) => h.hyp)
    expect(hyps).toEqual(expect.arrayContaining(['H12', 'H13']))
  })
})
