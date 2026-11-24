/**
 * Moteur pur de l'oscilloscope réaliste : déclenchement, échantillonnage (mémoire, Sa/s), bande passante,
 * CAN 8 bits, bruit, enveloppe min/max par colonne de pixels, mesures automatiques, Auto Scale.
 * Il ne connaît le banc qu'à travers le contrat SignalSource (types.ts).
 */
import { OSCILLO } from '../../data/reference'
import type { Ch, ChannelSettings, Horizontal, ScopeSettings, SignalSource, Slope } from './types'

const { divX, divY } = OSCILLO
/** Constante de temps du passe-bas d'entrée (1er ordre) — s (≈ 1,6 ns à 100 MHz) */
export const TAU_BW = 1 / (2 * Math.PI * OSCILLO.bandePassante)
/** Au-delà, l'échantillonnage exact coin par coin coûterait trop : quelques échantillons par colonne. */
const CORNER_BUDGET = 200_000
/** Itérations de dichotomie (précision ≪ 1 ps sur un front de quelques ns) */
const BISECT = 50
/** Points par période pour chercher un franchissement sur un signal lisse */
const GRID_PER_PERIOD = 64
/** Échantillons supplémentaires par colonne pour un signal lisse (sans coins) */
const EXTRA_PER_COL = 8
/** Points du profil d'un signal lisse pour les mesures */
const PROFILE_POINTS = 4096
/** Bande passante ≪ Sa/s : la reconstruction sin(x)/x redonne le signal analogique filtré. */
const OVERSAMPLING_ANALOG = 4

/** Suite 1-2-5 entre deux valeurs, comme les calibres d'un vrai oscilloscope. */
export function seq125(from: number, to: number): number[] {
  const out: number[] = []
  for (let d = Math.floor(Math.log10(from)); d <= Math.ceil(Math.log10(to)); d++)
    for (const m of [1, 2, 5]) {
      const v = Number((m * 10 ** d).toPrecision(3))
      if (v >= from * 0.999 && v <= to * 1.001) out.push(v)
    }
  return out
}
export const VDIV_STEPS = seq125(OSCILLO.vdivMin, OSCILLO.vdivMax)
export const SDIV_STEPS = seq125(OSCILLO.sdivMin, OSCILLO.sdivMax)
/** Plus petit cran ≥ x (le dernier sinon) */
const stepAtLeast = (steps: readonly number[], x: number) => steps.find((s) => s >= x * 0.999) ?? steps[steps.length - 1]

/** Divisions entre le bord gauche et le point de référence */
export const refDiv = (h: Horizontal) => (h.ref === 'centre' ? divX / 2 : 1)
/** Fenêtre de l'écran [gauche, droite] pour un déclenchement à tTrig — s */
export function screenWindow(h: Horizontal, tTrig: number): [number, number] {
  const tL = tTrig + h.delay - refDiv(h) * h.sdiv
  return [tL, tL + divX * h.sdiv]
}
/** Fréquence d'échantillonnage effective : la mémoire couvre l'écran — Sa/s */
export const sampleRate = (sdiv: number) => Math.min(OSCILLO.fsMax, OSCILLO.memoire / (divX * sdiv))

export function defaultSetup(): ScopeSettings {
  const ch = (on: boolean): ChannelSettings => ({ on, vdiv: OSCILLO.defautVdiv, fine: false, offset: 0, coupling: 'DC', probe: 1 })
  const s = OSCILLO.defautSdiv
  return {
    ch: [ch(true), ch(false)],
    sdiv: s,
    delay: 0,
    ref: 'centre',
    trig: { source: 0, slope: 'montant', level: 0, holdoff: OSCILLO.holdoffMin, mode: 'auto' },
    cursors: { on: false, x1: -2 * s, x2: 2 * s, y1: -OSCILLO.defautVdiv, y2: OSCILLO.defautVdiv, ych: 0 },
    measures: { source: 0, kinds: [] },
    acq: { mode: 'normal', n: 16 },
  }
}

/* ─────────────── Signal vu par une voie ─────────────── */

/** Coins dans [a, b], ou null s'il y en a trop pour les traiter un par un. */
function cornersIn(src: SignalSource, a: number, b: number): number[] | null {
  if (src.period) {
    const perPeriod = src.edges(0, src.period).length
    if ((perPeriod * (b - a)) / src.period > CORNER_BUDGET) return null
  }
  const e = src.edges(a, b)
  return e.length > CORNER_BUDGET ? null : e
}

/** Points intermédiaires entre coins : marches franches et segments courbes (filtre de câble) restent bien vus. */
const SUBDIV = 4
function withMidpoints(T: number[]): number[] {
  const out = [T[0]]
  for (let i = 1; i < T.length; i++) if (T[i] > T[i - 1]) for (let k = 1; k <= SUBDIV; k++) out.push(T[i - 1] + ((T[i] - T[i - 1]) * k) / SUBDIV)
  return out
}

/** Instants du profil d'un signal : coins + bornes, ou grille régulière s'il est lisse. */
function profileTimes(src: SignalSource, a: number, b: number): number[] {
  const c = cornersIn(src, a, b)
  if (c && c.length) return withMidpoints([a, ...c.filter((t) => t > a && t < b), b])
  return Array.from({ length: PROFILE_POINTS + 1 }, (_, i) => a + ((b - a) * i) / PROFILE_POINTS)
}

/** Valeur moyenne (trapèzes entre coins) sur une période, ou sur [a, b] — V */
export function meanOf(src: SignalSource, a: number, b: number): number {
  const [lo, hi] = src.period ? [0, src.period] : [a, b]
  const T = profileTimes(src, lo, hi)
  let s = 0
  for (let i = 1; i < T.length; i++) s += ((src.value(T[i - 1]) + src.value(T[i])) / 2) * (T[i] - T[i - 1])
  return s / (hi - lo)
}

/** Tension affichée par la voie (sonde réglée, couplage) en fonction du temps — V */
export function channelFn(src: SignalSource, ch: ChannelSettings, window: [number, number]): (t: number) => number {
  if (ch.coupling === 'GND') return () => 0
  // shortcut: couplage AC = moyenne retirée (passe-haut de quelques Hz idéal), sans transitoire de charge du condensateur
  const dc = ch.coupling === 'AC' ? meanOf(src, window[0], window[1]) : 0
  return (t) => ch.probe * (src.value(t) - dc)
}

/* ─────────────── Déclenchement ─────────────── */

const crosses = (va: number, vb: number, level: number, slope: Slope) => (slope === 'montant' ? va < level && vb >= level : va > level && vb <= level)

function bisect(f: (t: number) => number, level: number, slope: Slope, lo: number, hi: number) {
  for (let k = 0; k < BISECT; k++) {
    const mid = (lo + hi) / 2
    if (crosses(f(lo), f(mid), level, slope)) hi = mid
    else lo = mid
  }
  return hi
}

function findIn(src: SignalSource, level: number, slope: Slope, a: number, b: number): number | null {
  const f = (t: number) => src.value(t)
  let T: number[]
  const c = src.edges(a, b)
  if (c.length) T = withMidpoints([a, ...c.filter((t) => t > a && t < b), b])
  else if (src.period) {
    const step = src.period / GRID_PER_PERIOD
    const end = Math.min(b, a + src.period + step)
    T = Array.from({ length: Math.ceil((end - a) / step) + 1 }, (_, i) => Math.min(end, a + i * step))
  } else T = Array.from({ length: GRID_PER_PERIOD * 4 + 1 }, (_, i) => a + ((b - a) * i) / (GRID_PER_PERIOD * 4))
  let va = f(T[0])
  for (let i = 1; i < T.length; i++) {
    const vb = f(T[i])
    if (crosses(va, vb, level, slope)) return bisect(f, level, slope, T[i - 1], T[i])
    va = vb
  }
  return null
}

/**
 * Premier franchissement de `level` (V à l'entrée) sur le front `slope` dans [a, b], ou null.
 * Recherche par tranches doublées : on ne demande les coins que là où il le faut.
 */
export function findTrigger(src: SignalSource, level: number, slope: Slope, a: number, b: number, firstChunk = 1e-6): number | null {
  let chunk = firstChunk
  for (let lo = a; lo < b; lo += chunk, chunk *= 2) {
    const t = findIn(src, level, slope, lo, Math.min(b, lo + chunk))
    if (t !== null) return t
  }
  return null
}

/* ─────────────── Acquisition : enveloppe par colonne ─────────────── */

export interface Envelope {
  /** V affichés, NaN = aucun échantillon dans la colonne */
  min: Float64Array
  max: Float64Array
  /** Échantillons réels dans la colonne (pour le bruit de l'enveloppe) */
  n: Float64Array
}

/** Passe-bas du 1er ordre appliqué à une suite de points au pas h (sans effet si h ≫ τ). */
function lowpass(x: Float64Array, h: number) {
  if (h > TAU_BW) return x
  const k = 1 - Math.exp(-h / TAU_BW)
  for (let i = 1; i < x.length; i++) x[i] = x[i - 1] + k * (x[i] - x[i - 1])
  return x
}

/**
 * Enveloppe min/max de chaque colonne de la vue [vL, vR], telle que l'oscillo l'obtient en échantillonnant
 * `f` à `fs` (grille calée sur tTrig) sur l'enregistrement `rec`. Sans bruit ni quantification.
 * - Colonne ≥ 1 échantillon et ≫ τ : échantillonnage exact (échantillons voisins de chaque coin + bords).
 * - Sinon : signal reconstruit (sin(x)/x ≈ analogique filtré si fs ≫ BP, segments entre échantillons sinon).
 */
export function envelope(f: (t: number) => number, src: SignalSource, tTrig: number, fs: number, rec: [number, number], view: [number, number], ncol: number, peak = false): Envelope {
  const [vL, vR] = view
  const env: Envelope = { min: new Float64Array(ncol).fill(NaN), max: new Float64Array(ncol).fill(NaN), n: new Float64Array(ncol) }
  const w = (vR - vL) / ncol
  const s = 1 / fs
  const kOf = (t: number) => (t - tTrig) * fs
  const eps = 1e-9
  const kA = Math.ceil(kOf(rec[0]) - eps)
  const kB = Math.floor(kOf(rec[1]) + eps)
  if (w >= s && w >= 5 * TAU_BW) {
    const corners = cornersIn(src, vL, vR)
    const smooth = !corners || corners.length === 0
    let j = 0
    for (let i = 0; i < ncol; i++) {
      const ca = vL + i * w
      const cb = ca + w
      const k0 = Math.max(kA, Math.ceil(kOf(ca) - eps))
      const k1 = Math.min(kB, Math.ceil(kOf(cb) - eps) - 1)
      if (k1 < k0) {
        while (corners && j < corners.length && corners[j] < cb) j++
        continue
      }
      let mn = Infinity
      let mx = -Infinity
      const take = (k: number) => {
        if (k < k0 || k > k1) return
        const v = f(tTrig + k / fs)
        if (v < mn) mn = v
        if (v > mx) mx = v
      }
      take(k0)
      take(k1)
      const takeT = (t: number) => {
        const v = f(t)
        if (v < mn) mn = v
        if (v > mx) mx = v
      }
      while (corners && j < corners.length && corners[j] < cb) {
        if (corners[j] >= ca) {
          const kf = Math.floor(kOf(corners[j]))
          take(kf)
          take(kf + 1)
          // Peak Detect : le min/max analogique est vu à 2 GSa/s, même entre deux échantillons mémorisés
          if (peak) takeT(corners[j])
        }
        j++
      }
      if (smooth) for (let m = 1; m < EXTRA_PER_COL; m++) take(k0 + Math.round((m * (k1 - k0)) / EXTRA_PER_COL))
      env.min[i] = mn
      env.max[i] = mx
      env.n[i] = peak ? Math.max(1, w * OSCILLO.fsMax) : k1 - k0 + 1
    }
    return env
  }
  const lo = Math.max(vL, rec[0])
  const hi = Math.min(vR, rec[1])
  if (hi <= lo) return env
  const analog = fs >= OVERSAMPLING_ANALOG * OSCILLO.bandePassante
  const h = analog ? Math.min(w, TAU_BW / 4) : s
  const warm = 10 * TAU_BW
  const start = analog ? lo - warm : tTrig + Math.floor(kOf(lo - warm)) / fs
  const npts = Math.ceil((hi - start) / h) + 2
  const y = new Float64Array(npts)
  for (let n = 0; n < npts; n++) y[n] = f(start + n * h)
  lowpass(y, h)
  const at = (t: number) => {
    const u = (t - start) / h
    const n = Math.min(npts - 2, Math.max(0, Math.floor(u)))
    return y[n] + (u - n) * (y[n + 1] - y[n])
  }
  for (let i = 0; i < ncol; i++) {
    const ca = vL + i * w
    const cb = ca + w
    if (cb <= lo || ca >= hi) continue
    const a = Math.max(ca, lo)
    const b = Math.min(cb, hi)
    let mn = at(a)
    let mx = mn
    if (h <= w) {
      for (let n = Math.ceil((a - start) / h); n * h + start < b; n++) {
        mn = Math.min(mn, y[n])
        mx = Math.max(mx, y[n])
      }
    } else mn = mx = at((a + b) / 2)
    env.min[i] = mn
    env.max[i] = mx
    env.n[i] = Math.max(1, w * fs)
  }
  return env
}

/** Limite de l'écran pour une voie : centre et demi-plage en V affichés */
export const screenRange = (ch: ChannelSettings) => ({ center: ch.offset, half: (divY / 2) * ch.vdiv })

export interface Trace {
  min: Float32Array
  max: Float32Array
  /** Signal hors de la plage du CAN (écrêté) quelque part sur l'écran */
  clipped: boolean
}

/** Ajoute le bruit (σ par échantillon, enveloppe élargie de σ·√(2 ln n)) puis quantifie sur 8 bits. */
export function digitize(env: Envelope, ch: ChannelSettings, gauss: () => number, single = false): Trace {
  const n = env.min.length
  const out: Trace = { min: new Float32Array(n), max: new Float32Array(n), clipped: false }
  const sigma = OSCILLO.bruit * ch.probe
  const levels = 2 ** OSCILLO.bits
  const lsb = (divY * ch.vdiv) / levels
  const { center, half } = screenRange(ch)
  const q = (v: number) => {
    const c = center + Math.round((v - center) / lsb) * lsb
    if (c > center + half || c < center - half) out.clipped = true
    return Math.min(center + half, Math.max(center - half, c))
  }
  for (let i = 0; i < n; i++) {
    if (Number.isNaN(env.min[i])) {
      out.min[i] = out.max[i] = NaN
      continue
    }
    const spread = !single && env.n[i] > 1 ? sigma * Math.sqrt(2 * Math.log(env.n[i])) : 0
    out.min[i] = q(env.min[i] - spread + sigma * gauss())
    out.max[i] = spread ? q(env.max[i] + spread + sigma * gauss()) : out.min[i]
    if (out.max[i] < out.min[i]) out.max[i] = out.min[i]
  }
  return out
}

/* ─────────────── Acquisition mémorisée (Stop / Single) ─────────────── */

/** Échantillons numérisés d'une acquisition : l'échantillon i est pris à tTrig + (k0 + i)/fs. */
export interface StoredRecord {
  k0: number
  min: Float32Array
  max: Float32Array
  clipped: boolean
}

/** Numérise l'enregistrement complet à fs (≤ 1 Mpts) : c'est ce que l'oscillo garde après Stop. */
export function recordChannel(
  f: (t: number) => number,
  src: SignalSource,
  tTrig: number,
  fs: number,
  rec: [number, number],
  ch: ChannelSettings,
  peak: boolean,
  gauss: () => number,
): StoredRecord {
  const k0 = Math.ceil((rec[0] - tTrig) * fs - 1e-9)
  const k1 = Math.floor((rec[1] - tTrig) * fs + 1e-9)
  const n = Math.max(1, k1 - k0 + 1)
  // Une colonne par échantillon, centrée dessus
  const view: [number, number] = [tTrig + (k0 - 0.5) / fs, tTrig + (k0 + n - 0.5) / fs]
  const tr = digitize(envelope(f, src, tTrig, fs, [view[0], view[1]], view, n, peak), ch, gauss, !peak)
  return { k0, min: tr.min, max: tr.max, clipped: tr.clipped }
}

/**
 * Relit un enregistrement mémorisé sur la vue [vL, vR] : min/max des échantillons de chaque colonne,
 * ou interpolation linéaire entre échantillons quand on zoome au-delà de la résolution (aucun détail inventé).
 */
export function renderRecord(r: StoredRecord, tTrig: number, fs: number, view: [number, number], ncol: number): Trace {
  const out: Trace = { min: new Float32Array(ncol).fill(NaN), max: new Float32Array(ncol).fill(NaN), clipped: r.clipped }
  const n = r.min.length
  const w = (view[1] - view[0]) / ncol
  const kOf = (t: number) => (t - tTrig) * fs - r.k0
  for (let c = 0; c < ncol; c++) {
    const ca = view[0] + c * w
    if (w * fs >= 1) {
      const i0 = Math.max(0, Math.ceil(kOf(ca) - 1e-9))
      const i1 = Math.min(n - 1, Math.ceil(kOf(ca + w) - 1e-9) - 1)
      if (i1 < i0) continue
      let mn = Infinity
      let mx = -Infinity
      for (let i = i0; i <= i1; i++) {
        if (r.min[i] < mn) mn = r.min[i]
        if (r.max[i] > mx) mx = r.max[i]
      }
      out.min[c] = mn
      out.max[c] = mx
    } else {
      const u = kOf(ca + w / 2)
      const i = Math.floor(u)
      if (i < 0 || i >= n - 1) continue
      const x = u - i
      out.min[c] = r.min[i] + x * (r.min[i + 1] - r.min[i])
      out.max[c] = r.max[i] + x * (r.max[i + 1] - r.max[i])
    }
  }
  return out
}

/* ─────────────── Mesures automatiques ─────────────── */

export interface Measures {
  vpp: number
  max: number
  min: number
  ampl: number
  largeurP: number
  largeurN: number
  periode: number
  freq: number
  montee: number
}

interface Levels {
  top: number
  base: number
  rises: number[]
  falls: number[]
}

/** Niveaux haut/bas (histogramme des paliers, sinon max/min) et franchissements à mi-hauteur sur [a, b]. */
function levelsOf(f: (t: number) => number, src: SignalSource, a: number, b: number): Levels {
  const T = profileTimes(src, a, b)
  const V = T.map(f)
  let max = -Infinity
  let min = Infinity
  for (const v of V) {
    max = Math.max(max, v)
    min = Math.min(min, v)
  }
  const range = max - min
  const bins = new Map<number, number>()
  const bin = range / 100 || 1
  for (let i = 1; i < T.length; i++)
    if (Math.abs(V[i] - V[i - 1]) <= 0.02 * range) {
      const k = Math.round((V[i] + V[i - 1]) / 2 / bin)
      bins.set(k, (bins.get(k) ?? 0) + T[i] - T[i - 1])
    }
  const mid0 = (max + min) / 2
  let top = max
  let base = min
  let dTop = 0
  let dBase = 0
  for (const [k, d] of bins) {
    const v = k * bin
    if (v > mid0 && d > dTop) [top, dTop] = [v, d]
    if (v < mid0 && d > dBase) [base, dBase] = [v, d]
  }
  const mid = (top + base) / 2
  const rises: number[] = []
  const falls: number[] = []
  for (let i = 1; i < T.length; i++) {
    const [va, vb] = [V[i - 1], V[i]]
    if (va === vb) continue
    const t = T[i - 1] + ((mid - va) / (vb - va)) * (T[i] - T[i - 1])
    if (va < mid && vb >= mid) rises.push(t)
    if (va > mid && vb <= mid) falls.push(t)
  }
  return { top, base, rises, falls }
}

/** Instant où le signal filtré par la bande passante franchit `level` en montant, autour de [a, b]. */
function filteredCrossing(f: (t: number) => number, a: number, b: number, level: number): number {
  const h = TAU_BW / 8
  const start = a - 10 * TAU_BW
  const n = Math.ceil((b - start) / h) + 1
  const y = new Float64Array(n)
  for (let i = 0; i < n; i++) y[i] = f(start + i * h)
  lowpass(y, h)
  for (let i = Math.max(1, Math.floor((a - start) / h)); i < n; i++) if (y[i - 1] < level && y[i] >= level) return start + (i - 1 + (level - y[i - 1]) / (y[i] - y[i - 1])) * h
  return NaN
}

/**
 * Mesures sur l'écran [a, b] : max/min sur la trace numérisée (bruit compris), le reste sur le profil exact
 * du signal (comme l'oscillo sur son enregistrement complet), montée sur le signal filtré par la bande passante.
 */
export function measure(f: (t: number) => number, src: SignalSource, view: [number, number], trace: Trace, fs: number): Measures {
  let max = -Infinity
  let min = Infinity
  for (let i = 0; i < trace.min.length; i++) {
    if (Number.isNaN(trace.min[i])) continue
    max = Math.max(max, trace.max[i])
    min = Math.min(min, trace.min[i])
  }
  const { top, base, rises, falls } = levelsOf(f, src, view[0], view[1])
  const ampl = top - base
  const r0 = rises[0]
  const f0 = falls[0]
  const periode = rises.length >= 2 ? rises[1] - rises[0] : falls.length >= 2 ? falls[1] - falls[0] : NaN
  const largeurP = r0 !== undefined ? (falls.find((t) => t > r0) ?? NaN) - r0 : NaN
  const largeurN = f0 !== undefined ? (rises.find((t) => t > f0) ?? NaN) - f0 : NaN
  let montee = NaN
  if (r0 !== undefined && ampl > 0) {
    const l10 = base + 0.1 * ampl
    const l90 = base + 0.9 * ampl
    const lv = levelsOfCross(f, src, view, l10, l90, r0)
    if (lv) {
      let [t10, t90] = lv
      if (t90 - t10 < 20 * TAU_BW) {
        t10 = filteredCrossing(f, t10 - 20 * TAU_BW, t90 + 20 * TAU_BW, l10)
        t90 = filteredCrossing(f, t10, t90 + 40 * TAU_BW, l90)
      }
      montee = t90 - t10 >= 2 / fs ? t90 - t10 : NaN
    }
  }
  return { vpp: max - min, max, min, ampl, largeurP, largeurN, periode, freq: 1 / periode, montee }
}

/** Franchissements montants à 10 % (dernier avant r0) et 90 % (premier après r0), sur le profil exact. */
function levelsOfCross(f: (t: number) => number, src: SignalSource, view: [number, number], l10: number, l90: number, r0: number): [number, number] | null {
  const T = profileTimes(src, view[0], view[1])
  let t10 = NaN
  let t90 = NaN
  for (let i = 1; i < T.length; i++) {
    const [va, vb] = [f(T[i - 1]), f(T[i])]
    const at = (l: number) => T[i - 1] + ((l - va) / (vb - va)) * (T[i] - T[i - 1])
    if (va < l10 && vb >= l10 && T[i - 1] <= r0) t10 = at(l10)
    if (va < l90 && vb >= l90 && T[i] >= r0 && Number.isNaN(t90)) t90 = at(l90)
  }
  return t90 > t10 ? [t10, t90] : null
}

/** Retard CH1 → CH2 : fronts montants à mi-hauteur les plus proches du déclenchement — s */
export function measureDelay(
  f1: (t: number) => number,
  s1: SignalSource,
  f2: (t: number) => number,
  s2: SignalSource,
  view: [number, number],
  tTrig: number,
): number {
  const nearest = (ts: number[], t: number) => ts.reduce((best, x) => (Number.isNaN(best) || Math.abs(x - t) < Math.abs(best - t) ? x : best), NaN)
  const a = nearest(levelsOf(f1, s1, view[0], view[1]).rises, tTrig)
  const b = nearest(levelsOf(f2, s2, view[0], view[1]).rises, a)
  return b - a
}

/* ─────────────── Auto Scale ─────────────── */

/** Règle voies, base de temps et déclenchement d'après les signaux présents (comme la touche Auto Scale). */
export function autoScale(sources: readonly (SignalSource | null)[], st: ScopeSettings, tNow: number): ScopeSettings {
  const next: ScopeSettings = { ...st, ch: [{ ...st.ch[0] }, { ...st.ch[1] }], trig: { ...st.trig, mode: 'auto', slope: 'montant' }, delay: 0, ref: 'centre' }
  let trigSet = false
  let period = NaN
  for (const c of [0, 1] as Ch[]) {
    const src = sources[c]
    const ch = next.ch[c]
    if (!src) {
      ch.on = false
      continue
    }
    const span = src.period ?? 20e-3
    const T = profileTimes(src, tNow - span, tNow)
    const V = T.map((t) => src.value(t))
    const max = V.reduce((m, v) => Math.max(m, v), -Infinity)
    const min = V.reduce((m, v) => Math.min(m, v), Infinity)
    if (max - min < 10 * OSCILLO.bruit) {
      ch.on = false
      continue
    }
    const mid = (max + min) / 2
    ch.on = true
    ch.coupling = 'DC'
    ch.fine = false
    ch.vdiv = stepAtLeast(VDIV_STEPS, (max - min) / 6) * ch.probe
    ch.offset = Math.round((mid * ch.probe) / (ch.vdiv / 10)) * (ch.vdiv / 10)
    if (!trigSet) {
      trigSet = true
      next.trig.source = c
      next.trig.level = mid * ch.probe
      const rises = levelsOf((t) => src.value(t), src, tNow - span, tNow).rises
      period = src.period ?? (rises.length >= 2 ? rises[1] - rises[0] : NaN)
    }
  }
  if (Number.isFinite(period)) next.sdiv = stepAtLeast(SDIV_STEPS, (2 * period) / divX)
  return next
}
