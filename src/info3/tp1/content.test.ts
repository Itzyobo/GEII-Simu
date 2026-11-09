import { describe, expect, it } from 'vitest'
import { INFO3_QUESTIONS, INFO3_VALIDATION, coverage } from '../../data/questions'
import { INFO3 } from '../../data/reference'
import { tp1Config } from '../mcc/presets'
import { blankProject, runGenerate } from '../project/project'
// Le test lit le fichier de l'énoncé tel quel
import ENONCE from '../../../docs/info3/enonce.md?raw'
import { enonceMissing, parseRegisterAnswer, qcm31, qcm32, questionTitle, registersOf } from './content'

const TP1 = INFO3_QUESTIONS.filter((q) => q.tp === 1)

describe('réponses calculées (jamais écrites en dur)', () => {
  it('3.1 : modifier INFO3.pins (LED D2) change la réponse attendue', () => {
    const leds = INFO3.pins.leds as unknown as { pin: string }[]
    const saved = leds[0].pin
    try {
      expect(qcm31().answer).toBe('RA4')
      leds[0].pin = 'RC5'
      expect(qcm31().answer).toBe('RC5')
    } finally {
      leds[0].pin = saved
    }
  })
  it('3.2 et 3.4 : lues dans les fichiers générés du projet', () => {
    const p = runGenerate({ ...blankProject('tp1', 'TP1'), mcc: tp1Config() }).project
    expect(qcm32(p)?.answer).toBe('PORTAbits.RA4 = 1;')
    expect(registersOf(p, ['TRISB', 'ANSELB'])).toEqual({ TRISB: 0xff, ANSELB: 0xef })
    expect([parseRegisterAnswer('0xEF'), parseRegisterAnswer('239'), parseRegisterAnswer('0b11101111'), parseRegisterAnswer('xyz')]).toEqual([0xef, 0xef, 0xef, null])
  })
})

describe('énoncé', () => {
  it.skipIf(enonceMissing(ENONCE))('chaque intitulé de question TP1 se retrouve à l’identique dans docs/info3/enonce.md', () => {
    for (const q of TP1) {
      const title = questionTitle(ENONCE, q.id)
      expect(title, q.id).toBeTruthy()
      expect(ENONCE).toContain(title!)
    }
  })
  it('lecture d’un intitulé par ancre', () => {
    const md = 'texte\n\n<a id="tp1-3-3"></a>\n3.3 Faire clignoter la LED.\nSuite.\n\n<a id="tp1-3-4"></a>\n3.4 Autre'
    expect(questionTitle(md, 'tp1-3-3')).toBe('3.3 Faire clignoter la LED.\nSuite.')
    expect(questionTitle(md, 'tp1-9-9')).toBeNull()
  })
})

describe('points de validation A1 à A10', () => {
  it('TP1 à TP4 : A1, A2, A4, A6, A10 couverts ; A5, A7, A8, A9 partiels ; A3 (TP5) non couvert (rouge)', () => {
    const state = Object.fromEntries(INFO3_VALIDATION.map((v) => [v.id, coverage(v).state]))
    expect(state).toEqual({ A1: 'covered', A2: 'covered', A3: 'none', A4: 'covered', A5: 'partial', A6: 'covered', A7: 'partial', A8: 'partial', A9: 'partial', A10: 'covered' })
    expect(coverage(INFO3_VALIDATION[3]).linked).toEqual(['tp1-3-3', 'tp1-3-4', 'tp1-3-5', 'tp1-3-6', 'tp1-3-7', 'tp1-4-2', 'tp1-4-3', 'tp2-1-1', 'tp2-2-2', 'tp2-2-3', 'tp2-2-4', 'tp3-1', 'tp3-2', 'tp4-1', 'tp4-2', 'tp4-3', 'tp4-4', 'tp4-5', 'tp4-6'])
    // A10 (chronogrammes) : TP2 2.2, 2.3, TP3 2 et TP4 1
    expect(coverage(INFO3_VALIDATION[9]).available).toEqual(['tp2-2-2', 'tp2-2-3', 'tp3-2', 'tp4-1'])
  })
})