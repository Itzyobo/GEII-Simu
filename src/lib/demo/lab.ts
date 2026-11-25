/**
 * Mode démonstration : ce que la démo a le droit de faire sur le simulateur. Chaque méthode correspond à un geste
 * de l'utilisateur et passe par les mêmes setters (lib/scope/settings.ts, plugInto/unplugDeep, setters de la copie).
 * Deux implémentations : LiveLab (pages, composants montés) et HeadlessLab (tests, même moteur sans React).
 */
import type { Connections, Female, Male } from '../reseaux/benchTopology'
import type { PartielAnswers } from '../reseaux/partiel'
import type { StoredRecord } from '../scope/engine'
import type { RunMode } from '../scope/runtime'
import type { Ch, ChannelSettings, ScopeSettings } from '../scope/types'

/** Réglages du générateur d'impulsions PG-50 (face avant) */
export interface BenchGen {
  on: boolean
  mode: 'pulse' | 'sine'
  eg: number
  width: number
  period: number
  f: number
}

/** Zone colorée sur l'écran de l'oscilloscope (temps du banc) */
export interface Zone {
  from: number
  to: number
  label: string
  color: string
}

/** Acquisition mémorisée après Single : ce que l'étudiant lit à l'écran */
export interface CaptureInfo {
  tTrig: number
  fs: number
  rec: [number, number]
  records: (StoredRecord | null)[]
  /** Réglages au moment de l'acquisition */
  settings: ScopeSettings
}

export interface LabSnapshot {
  scope: ScopeSettings
  conn: Connections
  gen: BenchGen
  potR: number
  answers: PartielAnswers
  tab: 0 | 1 | 2
  zones: Zone[]
}

export interface Lab {
  /* Oscilloscope */
  scope(): ScopeSettings
  /** Remplace tous les réglages (Default Setup, reprise d'un instantané) */
  setSettings(s: ScopeSettings): void
  set(p: Partial<ScopeSettings>): void
  setCh(c: Ch, p: Partial<ChannelSettings>): void
  setTrig(p: Partial<ScopeSettings['trig']>): void
  setCur(p: Partial<ScopeSettings['cursors']>): void
  setMode(m: RunMode): void
  /** Touche Single, puis attente de l'acquisition mémorisée (null si rien ne déclenche) */
  single(): Promise<CaptureInfo | null>
  /** Run pendant `seconds` (le holdoff cale les déclenchements), puis Stop : acquisition affichée */
  runThenStop(seconds: number): Promise<CaptureInfo | null>
  /** ΔX, ΔY tels qu'affichés par les readouts des curseurs */
  cursorReadout(): { dx: number; dy: number }
  /* Banc de la partie 1 */
  conn(): Connections
  plug(m: Male, f: Female): void
  unplug(m: Male): void
  range(): void
  gen(): BenchGen
  setGen(p: Partial<BenchGen>): void
  potR(): number
  setPotR(r: number): void
  /** Lecture du multimètre (null : « débranchez le potentiomètre ») */
  ohmmeter(): number | null
  /* Copie et mise en scène */
  answers(): PartielAnswers
  setAnswer<K extends keyof PartielAnswers>(part: K, patch: Partial<PartielAnswers[K]>): void
  setTab(i: 0 | 1 | 2): void
  setZones(z: Zone[]): void
  zones(): Zone[]
  snapshot(): LabSnapshot
  restore(s: LabSnapshot): void
}

/* ─────────────── Lecture de la trace mémorisée (comme un étudiant, bruit compris) ─────────────── */

const sampleOf = (r: StoredRecord, i: number) => (r.min[i]! + r.max[i]!) / 2

/** Échantillons d'une voie entre t0 et t1 */
export function samplesIn(c: CaptureInfo, ch: Ch, t0: number, t1: number): { t: number[]; v: number[] } {
  const r = c.records[ch]
  if (!r) return { t: [], v: [] }
  const i0 = Math.max(0, Math.ceil((t0 - c.tTrig) * c.fs - r.k0))
  const i1 = Math.min(r.min.length - 1, Math.floor((t1 - c.tTrig) * c.fs - r.k0))
  const t: number[] = []
  const v: number[] = []
  for (let i = i0; i <= i1; i++) {
    t.push(c.tTrig + (r.k0 + i) / c.fs)
    v.push(sampleOf(r, i))
  }
  return { t, v }
}

/** Niveau moyen lu entre t0 et t1 — V */
export function meanLevel(c: CaptureInfo, ch: Ch, t0: number, t1: number): number {
  const { v } = samplesIn(c, ch, t0, t1)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN
}

/** Valeur lue à l'instant t (échantillon le plus proche) — V */
export function valueAt(c: CaptureInfo, ch: Ch, t: number): number {
  const { v } = samplesIn(c, ch, t - 0.6 / c.fs, t + 0.6 / c.fs)
  return v[0] ?? NaN
}

/** Valeurs extrêmes lues entre t0 et t1 */
export function extremes(c: CaptureInfo, ch: Ch, t0: number, t1: number): { min: number; max: number; tMin: number; tMax: number } {
  const { t, v } = samplesIn(c, ch, t0, t1)
  let [min, max, tMin, tMax] = [Infinity, -Infinity, NaN, NaN]
  v.forEach((x, i) => {
    if (x < min) [min, tMin] = [x, t[i]!]
    if (x > max) [max, tMax] = [x, t[i]!]
  })
  return { min, max, tMin, tMax }
}

export interface Crossing {
  t: number
  /** +1 montant, −1 descendant */
  dir: 1 | -1
}

/** Franchissements d'un niveau (hystérésis `h` en V contre le bruit), instants interpolés entre échantillons */
export function crossings(c: CaptureInfo, ch: Ch, level: number, t0: number, t1: number, h = 0.02): Crossing[] {
  const { t, v } = samplesIn(c, ch, t0, t1)
  const out: Crossing[] = []
  if (v.length < 2) return out
  let state = v[0]! > level ? 1 : -1
  let last = NaN
  let lastDir: 1 | -1 = 1
  for (let i = 1; i < v.length; i++) {
    const [a, b] = [v[i - 1]!, v[i]!]
    if ((a < level && b >= level) || (a > level && b <= level)) {
      last = t[i - 1]! + ((level - a) / (b - a)) * (t[i]! - t[i - 1]!)
      lastDir = b > a ? 1 : -1
    }
    if (state < 0 && b > level + h) {
      state = 1
      if (!Number.isNaN(last) && lastDir === 1) out.push({ t: last, dir: 1 })
    } else if (state > 0 && b < level - h) {
      state = -1
      if (!Number.isNaN(last) && lastDir === -1) out.push({ t: last, dir: -1 })
    }
  }
  return out
}
