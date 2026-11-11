/**
 * Mode examen INFO3 : tirage du sujet (graine), barème (INFO3.exam, H54), session dans sessionStorage,
 * feuille de notes. Logique pure, testée sans React. La note de configuration reprend wiringScore de src/lib/exam
 * (100 % au 1er essai, 50 % au 2e, 0 ensuite) ; les pénalités sont les manipulations refusées sous tension
 * (bench.lockAttempts du projet).
 */
import { INFO3 } from '../../data/reference'
import { INFO3_QUESTIONS } from '../../data/questions'
import { wiringScore } from '../../lib/exam'
import { mulberry32 } from '../models/prng'
import type { Project } from '../project/project'

const E = INFO3.exam
export type ExamVariant = 'mcc' | 'registres'
/** Sujet : TP choisi (1 à 6) ou 'random' (tous les TP) */
export type ExamTopic = number | 'random'

export interface ExamSubject {
  topic: ExamTopic
  seed: number
  variant: ExamVariant
  minutes: number
  /** Défis tirés, dans l'ordre du sujet */
  questions: string[]
}

/** Défis qu'on peut tirer pour un sujet */
export const examPool = (topic: ExamTopic): string[] => INFO3_QUESTIONS.filter((q) => q.challenge && !(E.excluded as readonly string[]).includes(q.id) && (topic === 'random' || q.tp === topic)).map((q) => q.id)

/** Tirage reproductible : 3 à 5 défis du pool (sans remise), selon la graine */
export function drawSubject(topic: ExamTopic, seed: number, variant: ExamVariant, minutes: number = E.defaultMinutes): ExamSubject {
  const rng = mulberry32(seed)
  const pool = examPool(topic)
  const n = Math.min(pool.length, E.questions.min + Math.floor(rng() * (E.questions.max - E.questions.min + 1)))
  const left = [...pool]
  const questions: string[] = []
  while (questions.length < n) questions.push(left.splice(Math.floor(rng() * left.length), 1)[0])
  // Ordre de l'énoncé, plus lisible qu'un ordre aléatoire
  questions.sort((a, b) => pool.indexOf(a) - pool.indexOf(b))
  return { topic, seed, variant, minutes, questions }
}

/** Copie rendue pour une question : verdict du professeur sur le code et le banc de ce moment */
export interface ExamHandIn {
  ok: boolean
  messages: string[]
  files: Record<string, string>
}

export interface ExamSession {
  version: 1
  subject: ExamSubject
  /** Départ de l'épreuve — ms depuis l'époque */
  startAt: number
  phase: 'exam' | 'done'
  /** Instant de la remise — ms */
  submittedAt?: number
  /** Copie : projet de l'étudiant (fichiers, MCC, cartes, câbles) */
  project: Project
  /** « Faire vérifier » par question : nombre d'essais jusqu'au premier succès, succès */
  checks: Record<string, { attempts: number; ok: boolean }>
  /** Dernière copie rendue par question */
  handIns: Record<string, ExamHandIn>
  /** Manipulations refusées sous tension (compteur du projet au départ, pour ne compter que l'épreuve) */
  lockAtStart: number
}

export function startSession(subject: ExamSubject, project: Project, now: number): ExamSession {
  return { version: 1, subject, startAt: now, phase: 'exam', project, checks: {}, handIns: {}, lockAtStart: project.bench.lockAttempts }
}

/** Temps restant — s (jamais négatif) */
export const remainingS = (s: ExamSession, now: number) => Math.max(0, s.subject.minutes * 60 - (now - s.startAt) / 1000)

/** Résultat d'un « Faire vérifier » : le premier succès fige le nombre d'essais */
export function recordCheck(s: ExamSession, id: string, ok: boolean): ExamSession {
  const c = s.checks[id] ?? { attempts: 0, ok: false }
  if (c.ok) return s
  return { ...s, checks: { ...s.checks, [id]: { attempts: c.attempts + 1, ok } } }
}

export const recordHandIn = (s: ExamSession, id: string, h: ExamHandIn): ExamSession => ({ ...s, handIns: { ...s.handIns, [id]: h } })

/** Manipulations sous tension pendant l'épreuve */
export const liveManips = (s: ExamSession) => Math.max(0, s.project.bench.lockAttempts - s.lockAtStart)

export function submit(s: ExamSession, now: number): ExamSession {
  return s.phase === 'done' ? s : { ...s, phase: 'done', submittedAt: Math.min(now, s.startAt + s.subject.minutes * 60_000) }
}

export interface SheetLine {
  id: string
  points: number
  config: { attempts: number; ok: boolean; score: number; points: number }
  question: { status: 'validée' | 'refusée' | 'non traitée'; points: number }
}

export interface Sheet {
  lines: SheetLine[]
  penalties: { count: number; points: number }
  raw: number
  note: number
  usedS: number
}

/** Feuille de notes : configuration (wiringScore) et défi par question, pénalités, note sur 20 plancher 0 */
export function examSheet(s: ExamSession, now: number = s.submittedAt ?? Date.now()): Sheet {
  const per = E.scale / s.subject.questions.length
  const lines = s.subject.questions.map((id): SheetLine => {
    const c = s.checks[id] ?? { attempts: 0, ok: false }
    const score = c.ok ? wiringScore(c.attempts) : 0
    const h = s.handIns[id]
    const status = !h ? 'non traitée' : h.ok ? 'validée' : 'refusée'
    const cfg = per * E.configShare * score
    const q = status === 'validée' ? per * (1 - E.configShare) : 0
    return { id, points: cfg + q, config: { ...c, score, points: cfg }, question: { status, points: q } }
  })
  const count = liveManips(s)
  const raw = lines.reduce((t, l) => t + l.points, 0)
  const minus = count * E.penaltyPerLiveManip
  return { lines, penalties: { count, points: minus }, raw, note: Math.max(0, raw - minus), usedS: Math.max(0, ((s.submittedAt ?? now) - s.startAt) / 1000) }
}

/* ───────────── Session (sessionStorage) ───────────── */

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
const KEY = 'tpsim.info3.v1.exam'
const store = (): StorageLike | null => {
  try {
    return globalThis.sessionStorage ?? null
  } catch {
    return null
  }
}

export function saveSession(s: ExamSession, storage: StorageLike | null = store()) {
  try {
    storage?.setItem(KEY, JSON.stringify(s))
  } catch {
    /* stockage indisponible : l'épreuve continue sans reprise possible */
  }
}

export function loadSession(storage: StorageLike | null = store()): ExamSession | null {
  try {
    const raw = storage?.getItem(KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as ExamSession
    return s.version === 1 && Array.isArray(s.subject?.questions) && typeof s.startAt === 'number' && s.project ? s : null
  } catch {
    return null
  }
}

export function clearSession(storage: StorageLike | null = store()) {
  try {
    storage?.removeItem(KEY)
  } catch {
    /* rien à effacer */
  }
}

/* ───────────── Correction ───────────── */

/** Code de référence de chaque défi : solution (solutions/) ou code du CR validé (fixtures/cr) */
export const REFERENCE: Record<string, { from: 'solution' | 'cr'; key: string }> = {
  'tp1-3-3': { from: 'cr', key: 'tp1/q3_3' },
  'tp1-3-4': { from: 'cr', key: 'tp1/q3_4' },
  'tp1-3-5': { from: 'cr', key: 'tp1/q3_5' },
  'tp1-3-6': { from: 'cr', key: 'tp1/q3_6' },
  'tp1-3-7': { from: 'solution', key: 'tp1/q3_7' },
  'tp1-4-2': { from: 'solution', key: 'tp1/q4' },
  'tp2-1-1': { from: 'cr', key: 'tp2/q1_1' },
  'tp2-2-2': { from: 'cr', key: 'tp2/q2_2' },
  'tp2-2-3': { from: 'cr', key: 'tp2/q2_3' },
  'tp2-2-4': { from: 'solution', key: 'tp2/q2_4' },
  'tp3-1': { from: 'cr', key: 'tp3/q1' },
  'tp3-2': { from: 'cr', key: 'tp3/q2' },
  'tp4-1': { from: 'solution', key: 'tp4/q1' },
  'tp4-2': { from: 'solution', key: 'tp4/q2' },
  'tp4-3': { from: 'solution', key: 'tp4/q3' },
  'tp4-4': { from: 'solution', key: 'tp4/q4' },
  'tp4-5': { from: 'solution', key: 'tp4/q5' },
  'tp4-6': { from: 'solution', key: 'tp4/q6' },
  'tp5-1': { from: 'solution', key: 'tp5/q1' },
  'tp5-2': { from: 'solution', key: 'tp5/q2' },
  'tp5-3': { from: 'solution', key: 'tp5/q3' },
  'tp5-4': { from: 'solution', key: 'tp5/q4' },
  'tp6-1-1': { from: 'solution', key: 'tp6/q1_1' },
  'tp6-1-3': { from: 'solution', key: 'tp6/q1_3' },
  'tp6-2': { from: 'solution', key: 'tp6/q2' },
  'tp6-3': { from: 'solution', key: 'tp6/q3' },
  'tp6-4': { from: 'solution', key: 'tp6/q4' },
}

/** Page du cours citée pour un défi */
export const coursePageOf = (id: string) => E.coursePages[Number(/^tp(\d)/.exec(id)?.[1])] ?? ''

/** Correction affichée par défaut : seulement pour une question refusée ou non traitée */
export const showCorrectionByDefault = (l: SheetLine) => l.question.status !== 'validée'
