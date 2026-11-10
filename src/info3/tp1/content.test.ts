import { describe, expect, it } from 'vitest'
import { INFO3_ANCHORS_HORS_QUESTION, INFO3_QUESTIONS, INFO3_VALIDATION, coverage } from '../../data/questions'
import { INFO3 } from '../../data/reference'
import { tp1Config } from '../mcc/presets'
import { blankProject, runGenerate } from '../project/project'
// Le test lit le fichier de l'énoncé tel quel
import ENONCE from '../../../docs/info3/enonce.md?raw'
import { enonceAnchors, enonceSection, parseRegisterAnswer, qcm31, qcm32, questionLabel, questionTitle, registersOf } from './content'


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

describe('énoncé (F9)', () => {
  it('docs/info3/enonce.md est la transcription (plus le fichier d’attente)', () => {
    expect(ENONCE).not.toContain('Transcription non faite')
    for (let tp = 1; tp <= 6; tp++) expect(enonceSection(ENONCE, tp), `TP${tp}`).toBeTruthy()
  })
  it('chaque question (TP1 à TP5) a son ancre et un intitulé lu à l’identique dans l’énoncé', () => {
    const anchors = new Set(enonceAnchors(ENONCE))
    for (const q of INFO3_QUESTIONS) {
      expect(anchors.has(q.id), q.id).toBe(true)
      const title = questionTitle(ENONCE, q.id)
      expect(title, q.id).toBeTruthy()
      expect(ENONCE).toContain(title!)
      if (q.contexte) expect(anchors.has(q.contexte), q.contexte).toBe(true)
    }
  })
  it('chaque ancre de question d’un TP livré est couverte par une question (ou exclue avec sa raison)', () => {
    const delivered = new Set(INFO3_QUESTIONS.map((q) => q.tp))
    const ids = new Set(INFO3_QUESTIONS.map((q) => q.id))
    const questionAnchors = enonceAnchors(ENONCE).filter((a) => /^tp\d+-/.test(a) && delivered.has(Number(/^tp(\d+)/.exec(a)![1])))
    expect(questionAnchors.filter((a) => !ids.has(a) && !(a in INFO3_ANCHORS_HORS_QUESTION))).toEqual([])
    // Une exclusion porte sur une ancre réelle, qui n'est pas aussi une question
    for (const a of Object.keys(INFO3_ANCHORS_HORS_QUESTION)) {
      expect(questionAnchors, a).toContain(a)
      expect(ids.has(a), a).toBe(false)
    }
  })
  it('lecture d’un intitulé par ancre : jusqu’à l’ancre suivante, un filet ou un titre', () => {
    const md = 'texte\n\n<a id="tp1-3-3"></a>\n3.3 Faire clignoter la LED.\nSuite.\n\nAutre paragraphe.\n\n<a id="tp1-3-4"></a>\n### 4. Titre\n\nCorps.\n\n### 5. Suivant\n\n<a id="z"></a>\nfin\n\n---\napres'
    expect(questionTitle(md, 'tp1-3-3')).toBe('3.3 Faire clignoter la LED.\nSuite.\n\nAutre paragraphe.')
    expect(questionTitle(md, 'tp1-3-4')).toBe('### 4. Titre\n\nCorps.')
    expect(questionTitle(md, 'z')).toBe('fin')
    expect(questionTitle(md, 'tp1-9-9')).toBeNull()
    expect(questionLabel('### 1. Interruption Timer2 (mode free running) :')).toBe('Interruption Timer2 (mode free running) :')
    expect(questionLabel('3.5 Modifier votre programme')).toBe('Modifier votre programme')
  })
  it('intitulés exacts : TP4 §6 ne parle pas de S1, TP5 §1 demande « (R,G,B) = (255,0,0) »', () => {
    expect(questionTitle(ENONCE, 'tp4-6')).toBe("6. Modifier le programme pour créer une animation sur l'anneau de leds. On fera cheniller le motif 0xF0F0 en boucle sur les 16 leds. Puis proposer une autre animation du même type.")
    expect(questionTitle(ENONCE, 'tp5-1')).toContain('(R,G,B) = (255,0,0)')
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