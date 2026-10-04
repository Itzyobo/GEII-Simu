/**
 * Transformateur d'impulsions IT237 (partie 1 de l'alim à découpage) — modèle pur, sans React.
 * État magnétique = flux réduit φ = ∫v1·dt (V·s) ; i1 = φ/Lm, avec Lm/20 au-delà de l'aire de saturation.
 */
import { ALIM } from '../data/reference'

export interface PulseParams {
  /** Fréquence des impulsions — Hz */
  f: number
  /** Largeur d'impulsion — s */
  width: number
  /** D2 + Rs branchés au secondaire */
  d2: boolean
  /** Condensateur C ajouté (avec D2 + Rs) */
  c: boolean
  /** Capacité — F (par défaut ALIM.c) */
  cap?: number
}

export interface PulseSim extends PulseParams {
  /** Pas du buffer — s */
  dt: number
  /** Durée du buffer, nombre entier de périodes — s */
  duration: number
  /** Courant primaire — A */
  i1: Float32Array
  v1: Float32Array
  v2: Float32Array
  /** Tension de sortie (0 si rien n'est branché au secondaire) — V */
  vs: Float32Array
  /** La démagnétisation n'a pas le temps de finir : le flux s'accumule de période en période */
  accumulates: boolean
  /** L'aire d'une impulsion dépasse le seuil de saturation (ou le flux accumulé le dépasse) */
  saturates: boolean
}

const DT = 0.25e-6

/** Courant magnétisant en fonction du flux réduit φ (V·s). */
export function currentFromFlux(phi: number): number {
  const s = ALIM.aireSaturationMesuree
  const i = phi <= s ? phi / ALIM.lm : s / ALIM.lm + ((phi - s) * ALIM.facteurSaturation) / ALIM.lm
  return Math.min(i, ALIM.iLimite)
}

/** Démagnétisation incomplète : l'aire E·tw dépasse ce que −Vz peut ramener pendant T − tw. */
export const accumulates = (f: number, width: number) => ALIM.E * width > ALIM.vz * (1 / f - width)

export function simulatePulse(p: PulseParams): PulseSim {
  const T = 1 / p.f
  const width = Math.min(p.width, T)
  const cap = p.cap ?? ALIM.c
  const acc = accumulates(p.f, width)
  // Régime établi : 6·Rs·C pour le filtre (sinon une période) ; rien à attendre si le flux s'accumule.
  const warmPeriods = acc ? 0 : Math.ceil((p.c ? 6 * ALIM.rCharge * cap : T) / T)
  const keepPeriods = acc ? 8 : Math.max(2, Math.ceil(2e-3 / T))
  const stepsPerPeriod = Math.round(T / DT)
  const dt = T / stepsPerPeriod // période = nombre entier de pas
  const n = keepPeriods * stepsPerPeriod
  const i1 = new Float32Array(n)
  const v1 = new Float32Array(n)
  const v2 = new Float32Array(n)
  const vs = new Float32Array(n)
  const tau = ALIM.rCharge * cap
  const onSteps = Math.round(width / dt)

  let phi = 0
  let vc = 0
  let peakPhi = 0
  for (let s = -warmPeriods * stepsPerPeriod; s < n; s++) {
    const k = ((s % stepsPerPeriod) + stepsPerPeriod) % stepsPerPeriod
    const pulse = k < onSteps
    const v = pulse ? ALIM.E : phi > 0 ? -ALIM.vz : 0 // roue libre D1 + Dz : −Vz jusqu'à φ = 0
    phi = Math.max(pulse ? phi : 0, phi + v * dt)
    peakPhi = Math.max(peakPhi, phi)
    const vRect = v - ALIM.vd // v2 = v1 (m = 1)
    let out = 0
    if (p.d2 && p.c) {
      // D2 idéale : C se charge à v2 − Vd, puis se décharge dans Rs (Euler)
      vc = vRect > vc ? vRect : vc - (vc / tau) * dt
      out = vc
    } else if (p.d2) out = Math.max(vRect, 0)
    if (s >= 0) {
      i1[s] = currentFromFlux(phi)
      v1[s] = v
      v2[s] = v
      vs[s] = out
    }
  }
  return {
    ...p,
    width,
    dt,
    duration: n * dt,
    i1,
    v1,
    v2,
    vs,
    accumulates: acc,
    saturates: peakPhi > ALIM.aireSaturationMesuree,
  }
}

/** Valeur crête d'un buffer. */
export const peak = (arr: Float32Array) => arr.reduce((m, x) => Math.max(m, x), -Infinity)

/** Ondulation crête à crête (max − min) — V. */
export const ripple = (arr: Float32Array) => peak(arr) - arr.reduce((m, x) => Math.min(m, x), Infinity)

/** Durée de démagnétisation t2 − t1 mesurée sur la première période du buffer — s. */
export function demagTime(sim: PulseSim): number {
  const start = Math.round(sim.width / sim.dt)
  for (let j = start; j < sim.i1.length; j++) if (sim.i1[j] <= 0) return (j - start) * sim.dt
  return NaN
}

/** Largeur d'impulsion (s) à partir de laquelle i1 crête dépasse de 5 % la rampe E·t/Lm, à fréquence f. */
export function saturationOnset(f: number): number {
  const linear = (w: number) => (ALIM.E * w) / ALIM.lm
  const saturated = (w: number) => peak(simulatePulse({ f, width: w, d2: false, c: false }).i1) > 1.05 * linear(w)
  let lo = 1e-6
  let hi = Math.min(0.7 / f, 1e-3)
  for (let k = 0; k < 20; k++) {
    const mid = (lo + hi) / 2
    if (saturated(mid)) hi = mid
    else lo = mid
  }
  return (lo + hi) / 2
}
