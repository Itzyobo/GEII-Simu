/**
 * Progression persistante : un seul objet versionné dans localStorage.
 * Toute lecture/écriture est protégée (navigation privée, stockage bloqué) : l'app fonctionne sans.
 */
import { useSyncExternalStore } from 'react'

export const STORAGE_KEY = 'tp-sim:progress'
const VERSION = 1

export interface ExamRecord {
  /** ISO 8601 */
  date: string
  /** Slug du TP, ou « blanc » pour l'examen blanc */
  kind: string
  /** Note sur 20 */
  note: number
}

export interface Progress {
  version: typeof VERSION
  questions: Record<string, { attempts: number; success: boolean }>
  exams: ExamRecord[]
}

const empty = (): Progress => ({ version: VERSION, questions: {}, exams: [] })

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
const defaultStorage = (): StorageLike | null => {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export function loadProgress(storage: StorageLike | null = defaultStorage()): Progress {
  try {
    const raw = storage?.getItem(STORAGE_KEY)
    if (!raw) return empty()
    const p = JSON.parse(raw) as Progress
    return p && p.version === VERSION && p.questions && Array.isArray(p.exams) ? p : empty()
  } catch {
    return empty()
  }
}

let current: Progress = loadProgress()
const listeners = new Set<() => void>()

function commit(next: Progress, storage: StorageLike | null = defaultStorage()) {
  current = next
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* stockage indisponible : la progression reste en mémoire pour la session */
  }
  listeners.forEach((l) => l())
}

export function recordAttempt(id: string, success: boolean, storage?: StorageLike | null) {
  const q = current.questions[id] ?? { attempts: 0, success: false }
  commit({ ...current, questions: { ...current.questions, [id]: { attempts: q.attempts + 1, success: q.success || success } } }, storage)
}

export function recordExam(exam: ExamRecord, storage?: StorageLike | null) {
  commit({ ...current, exams: [...current.exams, exam] }, storage)
}

export function resetProgress(storage?: StorageLike | null) {
  commit(empty(), storage)
}

/** Recharge depuis le stockage (tests, ou autre onglet). */
export function reloadProgress(storage?: StorageLike | null) {
  current = loadProgress(storage)
  listeners.forEach((l) => l())
}

export function useProgress(): Progress {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current,
  )
}
