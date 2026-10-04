import { describe, expect, it } from 'vitest'
import { QUESTIONS, type TpSlug } from '../data/questions'
import { loadAnswerKey } from './answerKeys'
import { clearExamSession, loadExamSession, saveExamSession, type ExamSession } from './examSession'

function memoryStorage() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
}

describe('examen : reprise après rechargement (sessionStorage)', () => {
  it('chrono, réponses, pénalités et ordre sont restaurés, puis effacés au retour à l’entraînement', () => {
    const s = memoryStorage()
    const state: ExamSession = {
      phase: 'exam',
      examId: 2,
      index: 1,
      endAt: 1_800_000_000_000,
      answers: { 'pap-q4': { id: 'pap-q4', given: '6 tr/min', expected: '6 tr/min', score: 1, explanation: '' } },
      meta: {},
      penalties: { 'pas-a-pas': [{ kind: 'live', what: 'x' }] },
      order: ['alim-decoupage', 'pas-a-pas', 'machine-asynchrone'],
    }
    saveExamSession('blanc', state, s)
    expect(loadExamSession('blanc', s)).toEqual(state)
    expect(loadExamSession('pas-a-pas', s)).toBeNull()
    clearExamSession('blanc', s)
    expect(loadExamSession('blanc', s)).toBeNull()
  })
})

describe('examen : clé de correction des questions non affichées', () => {
  it('chaque question du registre a une réponse attendue et une explication calculées', async () => {
    for (const slug of Object.keys(QUESTIONS) as TpSlug[]) {
      const key = await loadAnswerKey(slug)
      for (const { id } of QUESTIONS[slug]) {
        expect(key[id]?.expected, id).toBeTruthy()
        expect(key[id]?.explanation, id).toBeTruthy()
      }
    }
  }, 60_000)
})
