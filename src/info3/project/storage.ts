/**
 * Persistance INFO3 dans localStorage, clés `tpsim.info3.v1.*`, schéma versionné.
 * Tous les accès sont protégés : une donnée absente, illisible ou corrompue redonne un état vierge.
 */
import { blankProject, parseProject, runGenerate, type Project } from './project'

export const STORAGE_PREFIX = 'tpsim.info3.v1.'
export const KEYS = {
  tp1: `${STORAGE_PREFIX}project.tp1`,
  tp2: `${STORAGE_PREFIX}project.tp2`,
  tp3: `${STORAGE_PREFIX}project.tp3`,
  tp4: `${STORAGE_PREFIX}project.tp4`,
  libre: `${STORAGE_PREFIX}libre`,
  progress: `${STORAGE_PREFIX}progress`,
  prefs: `${STORAGE_PREFIX}prefs`,
} as const

/** Stockage minimal (localStorage ou substitut de test) */
export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function store(): KeyValueStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function readJson(key: string, s: KeyValueStore | null = store()): unknown {
  try {
    const raw = s?.getItem(key)
    return raw ? (JSON.parse(raw) as unknown) : undefined
  } catch {
    return undefined
  }
}

function writeJson(key: string, value: unknown, s: KeyValueStore | null = store()) {
  try {
    s?.setItem(key, JSON.stringify(value))
  } catch {
    /* quota dépassé ou stockage interdit : on continue sans sauvegarder */
  }
}

/* ───────────── TP1 ───────────── */

export function loadTp1(s?: KeyValueStore | null): Project {
  const p = parseProject(readJson(KEYS.tp1, s === undefined ? store() : s))
  return p && p.kind === 'tp1' ? p : blankProject('tp1', 'TP1 — Ports parallèles', 'tp1')
}

export function saveTp1(p: Project, s?: KeyValueStore | null) {
  writeJson(KEYS.tp1, p, s === undefined ? store() : s)
}

/* ───────────── TP2, TP3 ───────────── */

export type TpNumber = 2 | 3 | 4

export function loadTp(n: TpNumber, title: string, s?: KeyValueStore | null): Project {
  const kind = `tp${n}` as const
  const p = parseProject(readJson(KEYS[kind], s === undefined ? store() : s))
  return p && p.kind === kind ? p : blankProject(kind, title, kind)
}

export function saveTp(n: TpNumber, p: Project, s?: KeyValueStore | null) {
  writeJson(KEYS[`tp${n}`], p, s === undefined ? store() : s)
}

/* ───────────── Mode libre : plusieurs projets ───────────── */

export interface LibreState {
  version: 1
  projects: Project[]
  currentId: string
}

export function blankLibre(): LibreState {
  // Projet vierge : configuration MCC par défaut et main.c du cours (premier Generate)
  const p = runGenerate(blankProject('libre', 'Projet 1', 'libre-1')).project
  return { version: 1, projects: [p], currentId: p.id }
}

export function parseLibre(x: unknown): LibreState | null {
  if (!x || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  if (o.version !== 1 || !Array.isArray(o.projects) || typeof o.currentId !== 'string') return null
  const projects = o.projects.map(parseProject).filter((p): p is Project => !!p && p.kind === 'libre')
  if (!projects.length) return null
  const currentId = projects.some((p) => p.id === o.currentId) ? o.currentId : projects[0].id
  return { version: 1, projects, currentId }
}

export function loadLibre(s?: KeyValueStore | null): LibreState {
  return parseLibre(readJson(KEYS.libre, s === undefined ? store() : s)) ?? blankLibre()
}

export function saveLibre(st: LibreState, s?: KeyValueStore | null) {
  writeJson(KEYS.libre, st, s === undefined ? store() : s)
}

/** Export JSON d'un projet (bouton « Exporter ») */
export const exportProject = (p: Project) => JSON.stringify({ format: 'tpsim.info3.project', ...p }, null, 2)

/** Import JSON : projet libre valide, avec un nouvel identifiant ; null si le fichier est invalide */
export function importProject(text: string, newId: string): Project | null {
  try {
    const p = parseProject(JSON.parse(text) as unknown)
    return p ? { ...p, kind: 'libre', id: newId, verified: false, bench: { ...p.bench, usbBlack: false } } : null
  } catch {
    return null
  }
}

/* ───────────── Progression des questions ───────────── */

export type QuestionState = 'todo' | 'failed' | 'passed'
export type Progress = Record<string, { state: QuestionState; attempts: number; answer?: string }>

export function loadProgress(s?: KeyValueStore | null): Progress {
  const x = readJson(KEYS.progress, s === undefined ? store() : s)
  if (!x || typeof x !== 'object' || Array.isArray(x)) return {}
  const out: Progress = {}
  for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
    const o = v as Record<string, unknown> | null
    if (o && (o.state === 'todo' || o.state === 'failed' || o.state === 'passed') && typeof o.attempts === 'number') {
      out[k] = { state: o.state, attempts: o.attempts, answer: typeof o.answer === 'string' ? o.answer : undefined }
    }
  }
  return out
}

export function saveProgress(p: Progress, s?: KeyValueStore | null) {
  writeJson(KEYS.progress, p, s === undefined ? store() : s)
}

/* ───────────── Préférences d'affichage ───────────── */

export interface Prefs {
  /** Thème sombre de l'IDE (clair par défaut, comme MPLAB X) */
  dark: boolean
}

export function loadPrefs(s?: KeyValueStore | null): Prefs {
  const x = readJson(KEYS.prefs, s === undefined ? store() : s) as Record<string, unknown> | undefined
  return { dark: !!x && typeof x === 'object' && x.dark === true }
}

export function savePrefs(p: Prefs, s?: KeyValueStore | null) {
  writeJson(KEYS.prefs, p, s === undefined ? store() : s)
}
