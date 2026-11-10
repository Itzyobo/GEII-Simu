import { describe, expect, it } from 'vitest'
import { CR_FIXTURES, MCC_TP1, project } from '../fixtures'
import { SOLUTIONS } from '../solutions'
import { compile } from '../compiler'
import { gradeTp1, type Tp1Challenge } from './tp1'
// main.c réel du TP1 (MPLAB X 5.45, CRLF d'origine)
import REAL_MAIN from '../../../docs/sources/mplab/tp1/main.c?raw'

const RUNS = 20
/** Verdict identique sur 20 exécutions */
function stable(id: Tp1Challenge, main: string) {
  const first = gradeTp1(id, project(main, MCC_TP1))
  for (let k = 1; k < RUNS; k++) expect(gradeTp1(id, project(main, MCC_TP1))).toEqual(first)
  return first
}

describe('professeur virtuel TP1 sur les fixtures du CR (verdicts identiques sur 20 exécutions)', () => {
  it.each([
    ['tp1-3-3', 'tp1/q3_3'],
    ['tp1-3-4', 'tp1/q3_4'],
    ['tp1-3-5', 'tp1/q3_5'],
    ['tp1-3-6', 'tp1/q3_6'],
  ] as const)('%s validée avec %s', (id, fx) => {
    const v = stable(id, CR_FIXTURES[fx])
    expect(v.messages).toBeTruthy()
    expect(v.ok).toBe(true)
  })

  it('3.6 (R2) : pas libre — CR q3_6 avec __delay_ms(300) validé ; 2,5 s refusé (hors 100 ms – 2 s)', () => {
    expect(CR_FIXTURES['tp1/q3_6']).toContain('__delay_ms(500);')
    const v300 = stable('tp1-3-6', CR_FIXTURES['tp1/q3_6'].replace('__delay_ms(500);', '__delay_ms(300);'))
    expect(v300, v300.messages.join(' | ')).toMatchObject({ ok: true })
    const slow = gradeTp1('tp1-3-6', project(CR_FIXTURES['tp1/q3_6'].replace('__delay_ms(500);', '__delay_ms(2500);'), MCC_TP1))
    expect(slow.ok).toBe(false)
  })

  it('3.7 refusée : « Fonction Rotate_Right_4Bits introuvable »', () => {
    const v = stable('tp1-3-7', CR_FIXTURES['tp1/q3_7'])
    expect(v.ok).toBe(false)
    expect(v.messages[0]).toBe('Fonction Rotate_Right_4Bits introuvable')
  })

  it('3.7 avec les noms seulement renommés : « Rotate_Right_4Bits(0b0110) = 0b1100, attendu 0b0011 »', () => {
    const renamed = CR_FIXTURES['tp1/q3_7'].replaceAll('Decale_Droite', 'Rotate_Right_4Bits').replaceAll('Decale_Gauche', 'Rotate_Left_4Bits')
    const v = stable('tp1-3-7', renamed)
    expect(v.ok).toBe(false)
    expect(v.messages[0]).toBe('Rotate_Right_4Bits(0b0110) = 0b1100, attendu 0b0011')
  })

  it('4.2 refusée : « Tempo initiale : 500 ms attendu, 1 000 ms mesuré »', () => {
    const v = stable('tp1-4-2', CR_FIXTURES['tp1/q4'])
    expect(v.ok).toBe(false)
    expect(v.messages[0]).toBe('Tempo initiale : 500 ms attendu, 1 000 ms mesuré')
  })

  it('solutions/tp1/q3_7.c validée', () => {
    expect(stable('tp1-3-7', SOLUTIONS['tp1/q3_7'])).toMatchObject({ ok: true })
  })

  it('solutions/tp1/q4.c validée (4.2)', () => {
    const v = stable('tp1-4-2', SOLUTIONS['tp1/q4'])
    expect(v.messages).toEqual(['Cahier des charges respecté : saisie, sens, cycle de tempo 500 ms → 1 s → 2 s → 500 ms'])
    expect(v.ok).toBe(true)
  })

  it('4.3 (bonus) refusée pour le CR et la solution, qui ne font pas clignoter les LED', () => {
    const v = gradeTp1('tp1-4-3', project(SOLUTIONS['tp1/q4'], MCC_TP1))
    expect(v.ok).toBe(false)
    expect(v.messages[0]).toMatch(/^Validation du bit D2 : aucun clignotement/)
  })

  it('un programme qui ne compile pas est refusé avec l’erreur', () => {
    const v = gradeTp1('tp1-3-3', project('void main(void) { x = 1; }\n', MCC_TP1))
    expect(v).toEqual({ ok: false, messages: ["Le programme ne compile pas : main.c:1:19: error: use of undeclared identifier 'x'"] })
  })
})

describe('F11 : main.c réel du TP1 avec les vrais fichiers MCC', () => {
  it('compile sans erreur ni warning', () => {
    const r = compile(project(REAL_MAIN, MCC_TP1))
    expect(r.diagnostics).toEqual([])
    expect(r.ok).toBe(true)
  })
  it('refusé en 4.2 : « Tempo initiale : 500 ms attendu, 1 000 ms mesuré »', () => {
    const v = stable('tp1-4-2', REAL_MAIN)
    expect(v.ok).toBe(false)
    expect(v.messages[0]).toBe('Tempo initiale : 500 ms attendu, 1 000 ms mesuré')
  })
})