/** Mode examen : tirage, barème, pénalités, remise, reprise (consigne étape 7, tests 2 à 8). */
import { describe, expect, it } from 'vitest'
import { INFO3 } from '../../data/reference'
import { compile } from '../compiler'
import { gradeTp1 } from '../prof/tp1'
import { blankProject } from '../project/project'
import { drawSubject, examPool, examSheet, loadSession, recordCheck, recordHandIn, remainingS, saveSession, showCorrectionByDefault, startSession, submit, REFERENCE } from './exam'
import { benchErrors } from './verify'

const T0 = 1_700_000_000_000
const fresh = (seed = 42, topic: number | 'random' = 2) => startSession(drawSubject(topic, seed, 'mcc'), blankProject('examen', 'Examen', 'examen'), T0)
const memory = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
}
const per = (s: ReturnType<typeof fresh>) => INFO3.exam.scale / s.subject.questions.length

describe('sujet tiré par graine (test 8)', () => {
  it('même graine → même sujet ; 20 graines différentes → au moins 2 sujets différents ; 3 à 5 défis du TP choisi', () => {
    expect(drawSubject(2, 7, 'mcc')).toEqual(drawSubject(2, 7, 'mcc'))
    const subjects = new Set(Array.from({ length: 20 }, (_, k) => drawSubject('random', k + 1, 'mcc').questions.join(',')))
    expect(subjects.size).toBeGreaterThan(1)
    for (let k = 1; k <= 20; k++) {
      const s = drawSubject(4, k, 'mcc')
      expect(s.questions.length).toBeGreaterThanOrEqual(3)
      expect(s.questions.length).toBeLessThanOrEqual(5)
      expect(s.questions.every((q) => q.startsWith('tp4-'))).toBe(true)
    }
    expect(examPool(1)).not.toContain('tp1-4-3')
    for (const id of examPool('random')) expect(REFERENCE[id], id).toBeDefined()
  })
})

describe('configuration notée (test 2)', () => {
  it('conforme au 1er essai → 100 % ; échec puis conforme → 50 % ; deux échecs puis conforme → 0 %', () => {
    let s = fresh()
    const [a, b, c] = s.subject.questions
    s = recordCheck(s, a, true)
    s = recordCheck(recordCheck(s, b, false), b, true)
    s = recordCheck(recordCheck(recordCheck(s, c, false), c, false), c, true)
    s = recordCheck(s, a, false) // après un succès, plus rien ne change
    const sh = examSheet(submit(s, T0 + 1000))
    expect(sh.lines.map((l) => l.config.score)).toEqual([1, 0.5, 0, ...sh.lines.slice(3).map(() => 0)])
    expect(sh.lines[0].config.points).toBeCloseTo(per(s) * INFO3.exam.configShare, 9)
  })
})

describe('pénalités (test 3)', () => {
  it('3 manipulations sous tension → 3 × la pénalité, compteur sur la feuille', () => {
    let s = fresh()
    s = recordHandIn(recordCheck(s, s.subject.questions[0], true), s.subject.questions[0], { ok: true, messages: [], files: {} })
    s = { ...s, project: { ...s.project, bench: { ...s.project.bench, lockAttempts: s.project.bench.lockAttempts + 3 } } }
    const sh = examSheet(submit(s, T0 + 1000))
    expect(sh.penalties).toEqual({ count: 3, points: 3 * INFO3.exam.penaltyPerLiveManip })
    expect(sh.note).toBe(Math.max(0, sh.raw - 3 * INFO3.exam.penaltyPerLiveManip))
  })
})

describe('remise automatique (test 4)', () => {
  it('à 0 s, la copie est notée avec l’état du moment ; une copie rendue ensuite ne compte pas', () => {
    let s = fresh()
    const end = T0 + s.subject.minutes * 60_000
    s = recordHandIn(recordCheck(s, s.subject.questions[0], true), s.subject.questions[0], { ok: true, messages: [], files: {} })
    expect(remainingS(s, end + 5000)).toBe(0)
    const done = submit(s, end + 5000)
    expect(done.submittedAt).toBe(end)
    const sh = examSheet(done)
    expect(sh.usedS).toBe(s.subject.minutes * 60)
    expect(sh.lines[0].question.status).toBe('validée')
    expect(sh.lines.slice(1).every((l) => l.question.status === 'non traitée' && l.points === 0)).toBe(true)
    expect(submit(recordHandIn(done, done.subject.questions[1], { ok: true, messages: [], files: {} }), end + 9000).submittedAt).toBe(end)
  })
})

describe('reprise après rechargement (test 5)', () => {
  it('sujet, code, configuration, essais et pénalités identiques ; chrono = durée − (maintenant − départ) ± 1 s', () => {
    const st = memory()
    let s = fresh(9)
    s = { ...s, project: { ...s.project, files: { 'main.c': 'int x;' }, bench: { ...s.project.bench, lockAttempts: 1 } } }
    s = recordCheck(s, s.subject.questions[0], false)
    saveSession(s, st)
    const back = loadSession(st)!
    expect(back).toEqual(s)
    const now = T0 + 125_000
    expect(Math.abs(remainingS(back, now) - (s.subject.minutes * 60 - 125))).toBeLessThanOrEqual(1)
  })
})

describe('correction (test 6)', () => {
  it('question non traitée : correction affichée par défaut (code de référence connu) ; question validée : non', () => {
    let s = fresh()
    const [a, b] = s.subject.questions
    s = recordHandIn(s, a, { ok: true, messages: [], files: {} })
    const sh = examSheet(submit(s, T0 + 1000))
    expect(showCorrectionByDefault(sh.lines.find((l) => l.id === a)!)).toBe(false)
    expect(showCorrectionByDefault(sh.lines.find((l) => l.id === b)!)).toBe(true)
    expect(REFERENCE[b]).toBeDefined()
  })
})

describe('variante registres seuls (test 7)', () => {
  it('TP1 3.3 écrite en registres (TRISA, ANSELA, LATA, __delay_ms) : validée sans fichier MCC ; vérification = cartes et câbles', () => {
    const main = `#include <xc.h>
#define _XTAL_FREQ 4000000
#pragma config RSTOSC = HFINT1
void main(void)
{
    OSCCON1 = 0x60;
    OSCFRQ = 0x02;
    ANSELA = ANSELA & 0xEF;
    TRISA = TRISA & 0xEF;
    while (1)
    {
        LATA = LATA ^ 0x10;
        __delay_ms(500);
    }
}
`
    expect(compile({ 'main.c': main }).ok).toBe(true)
    const v = gradeTp1('tp1-3-3', { 'main.c': main })
    expect(v, v.messages.join(' | ')).toMatchObject({ ok: true })
    expect(benchErrors(blankProject('examen', 'x', 'x'), 'tp1-3-3')).toEqual([])
    expect(benchErrors(blankProject('examen', 'x', 'x'), 'tp4-2').join(' ')).toContain('absente')
  })
})
