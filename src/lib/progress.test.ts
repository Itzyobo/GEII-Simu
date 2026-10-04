import { describe, expect, it } from 'vitest'
import { loadProgress, recordAttempt, recordExam, reloadProgress, resetProgress, STORAGE_KEY } from './progress'

function memoryStorage() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m }
}

describe('progression (localStorage)', () => {
  it('tentatives, réussite et examens survivent à un rechargement', () => {
    const s = memoryStorage()
    resetProgress(s)
    recordAttempt('pap-q4', false, s)
    recordAttempt('pap-q4', true, s)
    recordAttempt('pap-q4', false, s)
    recordExam({ date: '2026-10-04T10:00:00Z', kind: 'pas-a-pas', note: 14.5 }, s)
    reloadProgress(s)
    const p = loadProgress(s)
    expect(p.questions['pap-q4']).toEqual({ attempts: 3, success: true })
    expect(p.exams).toHaveLength(1)
    expect(JSON.parse(s.m.get(STORAGE_KEY)!).version).toBe(1)
  })

  it('version inconnue ou JSON illisible → progression vide', () => {
    const s = memoryStorage()
    s.setItem(STORAGE_KEY, '{"version":99,"questions":{},"exams":[]}')
    expect(loadProgress(s).questions).toEqual({})
    s.setItem(STORAGE_KEY, 'pas du json')
    expect(loadProgress(s).exams).toEqual([])
  })
})
