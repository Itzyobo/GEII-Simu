/**
 * Oscilloscope 2 voies + Math, en fonction pure : signaux + réglages → ce que l'écran affiche.
 * Les signaux sont des escaliers périodiques (uartWaveform) : fronts et temps sont exacts, seul le gain
 * de chaque acquisition est bruité, et la trace reçoit un bruit visuel point par point qui n'entre pas dans les
 * mesures (H19). Une voie sans pince de masse flotte et capte du bruit (H20).
 */
import { REF } from '../data/reference'
import type { Waveform } from './uart'

export type Ch = 0 | 1
export type Probe = 1 | 10
export type Slope = 'rising' | 'falling'

export interface ChannelSettings {
  on: boolean
  /** V/div affichés */
  vdiv: number
  /** Tension au centre de l'écran — V */
  offset: number
  /** Atténuation réglée dans le menu de la voie */
  probe: Probe
}

export interface ScopeSettings {
  ch: [ChannelSettings, ChannelSettings]
  /** s/div */
  tdiv: number
  /** Retard du point de déclenchement par rapport au centre — s (> 0 : déclenchement à gauche du centre) */
  position: number
  trigger: { source: Ch; slope: Slope; level: number }
  mode: 'normal' | 'auto'
  math: { on: boolean; src1: Ch; src2: Ch; vdiv: number; offset: number }
  /** x : s depuis le bord gauche ; y : V */
  cursors: { on: boolean; x1: number; x2: number; y1: number; y2: number }
}

/** Ce qui est physiquement branché sur une voie. */
export interface ProbeInput {
  /** Signal au point de test (null : sonde en l'air → 0 V) */
  signal: Waveform | null
  /** Atténuation de la sonde physique */
  probe: Probe
  /** Pince de masse reliée */
  ground: boolean
}

export interface ScopeOptions {
  /** Graine du bruit (tests déterministes) */
  seed: number
  /** Instant courant — s ; sert au défilement en Auto sans déclenchement */
  phase: number
}

/** Points en divisions : x de 0 à 10, y de −4 à +4 (0 au centre). */
export type Trace = [number, number][]

export interface Measures {
  /** Hz ; NaN sans deux fronts montants à l'écran */
  freq: number
  max: number
  min: number
  pkpk: number
  /** Fronts à mi-hauteur — s depuis le bord gauche */
  edges: number[]
}

export type Status = "Trig'd" | 'Auto' | 'Attente'

export interface ScopeView {
  status: Status
  /** Instant du bord gauche — s */
  t0: number
  /** Ch1, Ch2, Math ; null si éteinte ou rien à afficher */
  traces: [Trace | null, Trace | null, Trace | null]
  measures: [Measures | null, Measures | null, Measures | null]
  cursors: { dt: number; invDt: number; dv: number }
  /** Voies sans pince de masse (badge hypothèse H20) */
  floating: [boolean, boolean]
}

export const DIV_X = 10
export const DIV_Y = 8
const FLOAT_POINTS = 500
const TRACE_PTS_PER_DIV = 50

/* ───────────── Aléatoire reproductible ───────────── */

export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Gaussienne centrée réduite (Box–Muller). */
export const gauss = (rnd: () => number) => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd())

/* ───────────── Escaliers ───────────── */

interface Steps {
  /** Valeur au bord gauche */
  start: number
  /** Changements dans ]t0, t1] */
  changes: { t: number; v: number }[]
}

const mod = (t: number, p: number) => t - Math.floor(t / p) * p

/** Valeur à l'instant t (limite à droite). */
export function valueAt(w: Waveform, t: number): number {
  const u = mod(t, w.period)
  let v = w.samples[0]?.v ?? 0
  for (const s of w.samples) {
    if (s.t > u) break
    v = s.v
  }
  return v
}

function stepsIn(w: Waveform, t0: number, t1: number, scale: (v: number) => number): Steps {
  const changes: Steps['changes'] = []
  const last = w.samples.at(-1)?.v ?? 0
  for (let k = Math.floor(t0 / w.period); k * w.period <= t1; k++) {
    let prev = last
    for (const s of w.samples) {
      const t = k * w.period + s.t
      if (s.v !== prev && t > t0 && t <= t1) changes.push({ t, v: scale(s.v) })
      prev = s.v
    }
  }
  return { start: scale(valueAt(w, t0)), changes }
}

/** Différence de deux escaliers (Math). */
function subtract(a: Steps, b: Steps): Steps {
  const all = [...a.changes.map((c) => ({ ...c, from: 'a' })), ...b.changes.map((c) => ({ ...c, from: 'b' }))].sort((x, y) => x.t - y.t)
  let va = a.start
  let vb = b.start
  const changes: Steps['changes'] = []
  all.forEach((c, k) => {
    if (c.from === 'a') va = c.v
    else vb = c.v
    // Fronts simultanés sur les deux voies : un seul point, sans pic intermédiaire
    if (all[k + 1]?.t !== c.t) changes.push({ t: c.t, v: va - vb })
  })
  return { start: a.start - b.start, changes }
}

/** Trace en escalier, un point tous les 1/50 div sur chaque palier, chacun bruité de σ relatif (H19). */
function stepTrace(s: Steps, t0: number, tdiv: number, toDiv: (v: number) => number, rnd: () => number): Trace {
  const noisy = (v: number) => toDiv(v * (1 + REF.scopeBruitPoint.value * gauss(rnd)))
  const pts: Trace = []
  const flat = (x0: number, x1: number, v: number) => {
    for (let x = x0; x < x1; x += 1 / TRACE_PTS_PER_DIV) pts.push([x, noisy(v)])
    pts.push([x1, noisy(v)])
  }
  let x0 = 0
  let prev = s.start
  for (const c of s.changes) {
    const x = (c.t - t0) / tdiv
    flat(x0, x, prev)
    x0 = x
    prev = c.v
  }
  flat(x0, DIV_X, prev)
  return pts
}

function stepMeasures(s: Steps, t0: number): Measures {
  const values = [s.start, ...s.changes.map((c) => c.v)]
  const max = Math.max(...values)
  const min = Math.min(...values)
  const mid = (max + min) / 2
  const edges: number[] = []
  const rises: number[] = []
  let prev = s.start
  for (const c of s.changes) {
    if ((prev < mid) !== (c.v < mid)) {
      edges.push(c.t - t0)
      if (c.v >= mid) rises.push(c.t - t0)
    }
    prev = c.v
  }
  const [r0, r1] = rises
  return { freq: r0 !== undefined && r1 !== undefined ? 1 / (r1 - r0) : NaN, max, min, pkpk: max - min, edges }
}

/** Premier front de la période qui franchit `level` dans le sens demandé ; null si aucun. */
export function findTrigger(w: Waveform, slope: Slope, level: number, scale: (v: number) => number): number | null {
  let prev = scale(w.samples.at(-1)?.v ?? 0)
  for (const s of w.samples) {
    const v = scale(s.v)
    if (slope === 'rising' ? prev < level && v >= level : prev >= level && v < level) return s.t
    prev = v
  }
  return null
}

/* ───────────── Vue de l'écran ───────────── */

const ZERO: Waveform = { samples: [{ t: 0, v: 0 }], period: 1 }

export function scopeView(inputs: [ProbeInput, ProbeInput], st: ScopeSettings, { seed, phase }: ScopeOptions): ScopeView {
  const rnd = mulberry32(seed)
  const span = DIV_X * st.tdiv
  const chans = ([0, 1] as const).map((c) => {
    const inp = inputs[c]
    const w = inp.signal ?? ZERO
    const ratio = st.ch[c].probe / inp.probe
    const g = REF.scopeBruitMax.value
    const gain = 1 + Math.min(g, Math.max(-g, REF.scopeBruit.value * gauss(rnd)))
    const drift = inp.ground ? 0 : REF.sansMasseDerive.value * (2 * rnd() - 1)
    return { w, ratio, gain, drift, floating: !inp.ground, scale: (v: number) => v * ratio * gain + drift }
  }) as [ChanState, ChanState]

  const src = chans[st.trigger.source]
  const tTrig = findTrigger(src.w, st.trigger.slope, st.trigger.level, (v) => v * src.ratio + src.drift)
  const status: Status = tTrig !== null ? "Trig'd" : st.mode === 'auto' ? 'Auto' : 'Attente'
  const t0 = tTrig !== null ? tTrig + st.position - span / 2 : phase
  const t1 = t0 + span

  const cursors = {
    dt: Math.abs(st.cursors.x2 - st.cursors.x1),
    invDt: 1 / Math.abs(st.cursors.x2 - st.cursors.x1),
    dv: Math.abs(st.cursors.y2 - st.cursors.y1),
  }
  const floating: [boolean, boolean] = [chans[0].floating, chans[1].floating]
  if (status === 'Attente') return { status, t0, traces: [null, null, null], measures: [null, null, null], cursors, floating }

  const steps = chans.map((c) => stepsIn(c.w, t0, t1, c.scale)) as [Steps, Steps]
  const traces: ScopeView['traces'] = [null, null, null]
  const measures: ScopeView['measures'] = [null, null, null]

  for (const c of [0, 1] as const) {
    const { vdiv, offset, on } = st.ch[c]
    const toDiv = (v: number) => (v - offset) / vdiv
    const s = steps[c]
    if (chans[c].floating) {
      // Sans masse : la voie capte du bruit, la trace flotte (effet qualitatif, H20)
      const pts: Trace = []
      const vals: number[] = []
      for (let i = 0; i <= FLOAT_POINTS; i++) {
        const t = t0 + (i / FLOAT_POINTS) * span
        const v = chans[c].scale(valueAt(chans[c].w, t)) + REF.sansMasseBruit.value * gauss(rnd)
        vals.push(v)
        pts.push([(i / FLOAT_POINTS) * DIV_X, toDiv(v)])
      }
      const max = Math.max(...vals)
      const min = Math.min(...vals)
      measures[c] = { freq: NaN, max, min, pkpk: max - min, edges: [] }
      if (on) traces[c] = pts
    } else {
      measures[c] = stepMeasures(s, t0)
      if (on) traces[c] = stepTrace(s, t0, st.tdiv, toDiv, rnd)
    }
  }

  if (st.math.on) {
    const m = subtract(steps[st.math.src1], steps[st.math.src2])
    measures[2] = stepMeasures(m, t0)
    traces[2] = stepTrace(m, t0, st.tdiv, (v) => (v - st.math.offset) / st.math.vdiv, rnd)
  }
  return { status, t0, traces, measures, cursors, floating }
}

interface ChanState {
  w: Waveform
  ratio: number
  gain: number
  drift: number
  floating: boolean
  scale: (v: number) => number
}
