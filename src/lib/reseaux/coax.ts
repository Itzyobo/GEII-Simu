/**
 * Ligne coaxiale en régime impulsionnel ou sinusoïdal : superposition des allers-retours (treillis),
 * sans aucun cas particulier. Pur ; fournit au banc des SignalSource pour l'oscilloscope.
 *
 *   τ = l/v ; Γg = (Zg−Zc)/(Zg+Zc) ; ΓL = (ZL−Zc)/(ZL+Zc) ; Ei = Eg·Zc/(Zg+Zc) ; A = 10^(−α·l/100/20)
 *   V_CH1(t) = Ei·p(t) + Σ_{k≥1} Ei·(1+Γg)·ΓL^k·Γg^(k−1)·A^(2k)·p(t−2kτ)
 *   V_ext(t) = Σ_{k≥0} Ei·(1+ΓL)·(ΓL·Γg)^k·A^(2k+1)·p(t−(2k+1)τ)
 */
import { RES3, type CableType } from '../../data/reference'
import { mulberry32 } from '../../au3/sim/prng'
import type { SignalSource } from '../scope/types'

export type Waveform = { kind: 'pulse'; width: number; period: number; rise?: number } | { kind: 'sine'; f: number }

export interface CoaxParams {
  /** Fém du générateur — V */
  Eg?: number
  /** Résistance interne du générateur — Ω */
  Zg?: number
  /** Impédance caractéristique — Ω */
  Zc: number
  /** Longueur — m */
  l: number
  /** Vitesse de propagation — m/s */
  v?: number
  /** Charge d'extrémité — Ω (Infinity = ouverte, 0 = court-circuit) */
  ZL: number
  /** Atténuation à la fréquence utile — dB/100 m */
  alpha: number
  wave: Waveform
}

/** Coefficient de réflexion d'une impédance Z sur une ligne Zc (Z = ∞ → +1). */
export const gamma = (Z: number, Zc: number) => (Z === Infinity ? 1 : (Z - Zc) / (Z + Zc))
/** Zc tirée de l'amplitude incidente : Ei = Eg·Zc/(Zg+Zc) ⇒ Zc = Zg·Ei/(Eg−Ei) — Ω */
export const zcFromAmplitude = (Eg: number, Ei: number, Zg: number) => (Zg * Ei) / (Eg - Ei)
/** Longueur tirée du retard aller-retour Δt = 2l/v — m */
export const lengthFromDelay = (dt: number, v: number) => (v * dt) / 2
/** Longueur estimée par l'enroulement : N spires de diamètre D — m */
export const lengthFromSpires = (N: number, D: number) => N * Math.PI * D
/** Atténuation entre entrée et sortie — dB (positive si Vs < Ve) */
export const attenuationDb = (Ve: number, Vs: number) => 20 * Math.log10(Ve / Vs)
/** Atténuation d'un câble à la fréquence f, loi de puissance passant par ses points à 5 et 10 MHz — dB/100 m */
export function alphaAt(cable: CableType, f: number) {
  const exp = Math.log(cable.alpha10M / cable.alpha5M) / Math.LN2
  return cable.alpha5M * (f / RES3.fSinus) ** exp
}
/** Déphasage de la sortie sur l'entrée d'une ligne adaptée — degrés dans [0, 360[ */
export const phaseLagDeg = (f: number, l: number, v: number) => (((360 * f * l) / v) % 360 + 360) % 360

/** Un terme du treillis : amplitude c (V) et retard d (s) */
export interface Term {
  c: number
  d: number
}

/** Termes du treillis vus sur CH1 (entrée) et à l'extrémité. */
export function coaxTerms(p: CoaxParams): { ch1: Term[]; end: Term[]; Ei: number; tau: number } {
  const Eg = p.Eg ?? RES3.eg
  const Zg = p.Zg ?? RES3.zg
  const tau = p.l / (p.v ?? RES3.v)
  const gg = gamma(Zg, p.Zc)
  const gl = gamma(p.ZL, p.Zc)
  const Ei = (Eg * p.Zc) / (Zg + p.Zc)
  // Impulsion longue (étude BF) : pertes négligées
  const bf = p.wave.kind === 'pulse' && p.wave.width >= RES3.seuilBF
  const A = bf ? 1 : 10 ** (-(p.alpha * p.l) / 100 / 20)
  const ch1: Term[] = [{ c: Ei, d: 0 }]
  for (let k = 1; k <= RES3.kMax; k++) {
    const c = Ei * (1 + gg) * gl ** k * gg ** (k - 1) * A ** (2 * k)
    if (Math.abs(c) < RES3.seuilTerme) break
    ch1.push({ c, d: 2 * k * tau })
  }
  const end: Term[] = []
  for (let k = 0; k <= RES3.kMax; k++) {
    const c = Ei * (1 + gl) * (gl * gg) ** k * A ** (2 * k + 1)
    if (Math.abs(c) < RES3.seuilTerme) break
    end.push({ c, d: (2 * k + 1) * tau })
  }
  return { ch1, end, Ei, tau }
}

/** Forme élémentaire p(t), ses coins et sa période. */
function shape(w: Waveform): { p: (t: number) => number; corners: (a: number, b: number, out: number[], shift: number) => void; period: number } {
  if (w.kind === 'sine') return { p: (t) => Math.sin(2 * Math.PI * w.f * t), corners: () => {}, period: 1 / w.f }
  const r = w.rise ?? RES3.front
  const T = w.period
  const W = w.width
  // Trapèze : montée [0, r], palier jusqu'à W, descente [W, W + r] ; largeur à mi-hauteur = W
  const pts = [0, r, W, W + r]
  return {
    p: (t) => {
      const u = ((t % T) + T) % T
      if (u < r) return u / r
      if (u < W) return 1
      if (u < W + r) return 1 - (u - W) / r
      return 0
    },
    corners: (a, b, out, shift) => {
      for (let n = Math.floor(a / T); n * T <= b; n++)
        for (const c of pts) {
          const t = n * T + c
          if (t >= a && t <= b) out.push(t + shift)
        }
    },
    period: T,
  }
}

/** Somme de termes c·p(t − d) présentée comme une source d'oscilloscope. */
export function termsSource(terms: readonly Term[], w: Waveform): SignalSource {
  const s = shape(w)
  return {
    value: (t) => terms.reduce((acc, { c, d }) => acc + c * s.p(t - d), 0),
    edges: (t0, t1) => {
      const out: number[] = []
      for (const { d } of terms) s.corners(t0 - d, t1 - d, out, d)
      return out.sort((a, b) => a - b)
    },
    period: s.period,
  }
}

/** Sources « entrée du câble » (CH1) et « extrémité » du banc. */
export function coaxSources(p: CoaxParams): { ch1: SignalSource; end: SignalSource } {
  const { ch1, end } = coaxTerms(p)
  return { ch1: termsSource(ch1, p.wave), end: termsSource(end, p.wave) }
}

/* ─────────────── Câble mystère ─────────────── */

export interface Cable {
  seed: number
  type: keyof typeof RES3.cables
  Zc: number
  /** Longueur réelle — m */
  l: number
  /** Spires visibles sur l'enroulement */
  N: number
  /** Diamètre de l'enroulement — m */
  D: number
}

/** Câble tiré à partir d'une graine : Zc ∈ {50, 75}, l entière dans [40 ; 120] m, N·π·D = l à ±8 %. */
export function generateCable(seed: number): Cable {
  const rnd = mulberry32(seed)
  const type = rnd() < 0.5 ? 'RG58' : 'RG59'
  const l = RES3.lMin + Math.floor(rnd() * (RES3.lMax - RES3.lMin + 1))
  const D = RES3.diametres[Math.floor(rnd() * RES3.diametres.length)]
  // Enroulement imparfait : écart tiré à ±(8 % − marge d'arrondi d'une spire)
  const margin = RES3.ecartSpires - (Math.PI * D) / l
  const N = Math.round((l * (1 + (2 * rnd() - 1) * margin)) / (Math.PI * D))
  return { seed, type, Zc: RES3.cables[type].zc, l, N, D }
}

/* ─────────────── API du partiel ─────────────── */

export interface CoaxExpected {
  Zc: number
  l: number
  gammaOpen: number
  gammaShort: number
}

export function createCoaxExercise(seed: number): { cable: Cable; expected: CoaxExpected } {
  const cable = generateCable(seed)
  return { cable, expected: { Zc: cable.Zc, l: cable.l, gammaOpen: gamma(Infinity, cable.Zc), gammaShort: gamma(0, cable.Zc) } }
}

export interface GradeDetail {
  key: keyof CoaxExpected
  given: number
  expected: number
  ok: boolean
}

/** Correction : Zc et l à ±5 % ; Γ à ±0,05 en absolu (Γ attendus = ±1). Score dans [0, 1]. */
export function gradeCoax(expected: CoaxExpected, answers: Partial<Record<keyof CoaxExpected, number>>): { score: number; details: GradeDetail[] } {
  const keys = Object.keys(expected) as (keyof CoaxExpected)[]
  const details = keys.map((key) => {
    const given = answers[key] ?? NaN
    const e = expected[key]
    const tol = key === 'gammaOpen' || key === 'gammaShort' ? RES3.tolMesure : RES3.tolMesure * Math.abs(e)
    return { key, given, expected: e, ok: Number.isFinite(given) && Math.abs(given - e) <= tol }
  })
  return { score: details.filter((d) => d.ok).length / details.length, details }
}
