/**
 * Progression des questions INFO3 (localStorage), sans dépendance au modèle de projet : l'accueil /info3 la lit
 * sans charger MCC ni le compilateur. Réexportée par storage.ts.
 */
export const STORAGE_PREFIX = 'tpsim.info3.v1.'
const KEY = `${STORAGE_PREFIX}progress`

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>
const store = (): KeyValueStore | null => {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}
function readJson(key: string, s: KeyValueStore | null): unknown {
  try {
    const raw = s?.getItem(key)
    return raw ? (JSON.parse(raw) as unknown) : undefined
  } catch {
    return undefined
  }
}
function writeJson(key: string, value: unknown, s: KeyValueStore | null) {
  try {
    s?.setItem(key, JSON.stringify(value))
  } catch {
    /* stockage plein ou bloqué */
  }
}


export type QuestionState = 'todo' | 'failed' | 'passed'
export type Progress = Record<string, { state: QuestionState; attempts: number; answer?: string }>

export function loadProgress(s?: KeyValueStore | null): Progress {
  const x = readJson(KEY, s === undefined ? store() : s)
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
  writeJson(KEY, p, s === undefined ? store() : s)
}
