/** Sauvegarde de l'examen en cours dans sessionStorage : chrono et réponses survivent à un rechargement. */
import type { ExamAnswer, Penalty, QuestionMeta } from './exam'

export interface ExamSession {
  phase: 'exam' | 'results'
  examId: number
  index: number
  /** Échéance du chrono — ms depuis l'époque */
  endAt: number
  answers: Record<string, ExamAnswer>
  meta: Record<string, QuestionMeta>
  penalties: Record<string, Penalty[]>
  /** Ordre des TP (examen blanc) */
  order?: string[]
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
const session = (): StorageLike | null => {
  try {
    return globalThis.sessionStorage ?? null
  } catch {
    return null
  }
}
const key = (kind: string) => `tp-sim:exam:${kind}`

export function loadExamSession(kind: string, storage: StorageLike | null = session()): ExamSession | null {
  try {
    const raw = storage?.getItem(key(kind))
    if (!raw) return null
    const s = JSON.parse(raw) as ExamSession
    return (s.phase === 'exam' || s.phase === 'results') && typeof s.endAt === 'number' && s.answers ? s : null
  } catch {
    return null
  }
}

export function saveExamSession(kind: string, s: ExamSession, storage: StorageLike | null = session()) {
  try {
    storage?.setItem(key(kind), JSON.stringify(s))
  } catch {
    /* stockage indisponible : l'examen continue sans reprise possible */
  }
}

export function clearExamSession(kind: string, storage: StorageLike | null = session()) {
  try {
    storage?.removeItem(key(kind))
  } catch {
    /* rien à effacer */
  }
}
