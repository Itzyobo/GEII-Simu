/**
 * Platine flyback MAX17691B (partie 2 de l'alim à découpage) — modèle moyen + formes d'onde, sans React.
 */
import { FLYBACK } from '../data/reference'
import type { Signal } from '../lib/scope'

export interface FlybackParams {
  /** Tension d'entrée — V */
  ve: number
  /** Courant de sortie réglé par le rhéostat — A */
  is: number
  /** Remplace le convertisseur par une alim linéaire (Ie = Is) */
  linear: boolean
}

export interface FlybackPoint {
  vs: number
  ie: number
  /** Puissances entrée / sortie — W */
  pe: number
  ps: number
  eta: number
  /** Rapport cyclique de conduction (0 en linéaire) */
  alpha: number
  /** Fraction de période en démagnétisation */
  delta: number
  discontinuous: boolean
}

/** Rendement interpolé linéairement en fonction de Ps sur les points du CR (bornes : valeurs extrêmes). */
export function efficiency(ps: number): number {
  const r = FLYBACK.rendement
  if (ps <= r[0].ps) return r[0].eta
  for (let k = 1; k < r.length; k++)
    if (ps <= r[k].ps) return r[k - 1].eta + ((ps - r[k - 1].ps) / (r[k].ps - r[k - 1].ps)) * (r[k].eta - r[k - 1].eta)
  return r[r.length - 1].eta
}

/** Point de fonctionnement moyen : η = Ps/Pe = Vs·Is/(Ve·Ie). */
export function operatingPoint({ ve, is, linear }: FlybackParams): FlybackPoint {
  const { vs, vd, m, iDiscontinu } = FLYBACK
  const ps = vs * is
  if (linear) return { vs, ie: is, pe: ve * is, ps, eta: vs / ve, alpha: 0, delta: 0, discontinuous: false }
  const eta = efficiency(ps)
  const ie = ps / (eta * ve)
  const alphaCcm = (vs + vd) / (vs + vd + m * ve)
  const discontinuous = is < iDiscontinu
  // Conduction discontinue : à Ve fixé, α ∝ √Is (énergie par période ∝ Is), raccordé à α continu au seuil.
  const alpha = discontinuous ? alphaCcm * Math.sqrt(is / iDiscontinu) : alphaCcm
  // Équilibre des volts-secondes sur Lm : Ve·α = (Vs + Vd)/m · δ
  const delta = discontinuous ? (alpha * m * ve) / (vs + vd) : 1 - alpha
  return { vs, ie, pe: ve * ie, ps, eta, alpha, delta, discontinuous }
}

/**
 * Tension primaire V1(t) idéale + commutation : Ve pendant α·T, −(Vs+Vd)/m pendant δ·T,
 * puis oscillation amortie autour de 0 en conduction discontinue. Pic amorti au blocage.
 */
function v1Clean(p: FlybackParams, op: FlybackPoint, t: number): number {
  if (p.linear) return 0
  const T = 1 / FLYBACK.fDecoupage
  const { vs, vd, m, formeOnde: w } = FLYBACK
  const tau = ((t % T) + T) % T
  const ton = op.alpha * T
  const toff = (op.alpha + op.delta) * T
  const vRefl = (vs + vd) / m
  if (tau < ton) return p.ve
  const sinceOff = tau - ton
  const spike = -w.pic * vRefl * Math.exp(-sinceOff / w.tauPic) * Math.cos(2 * Math.PI * w.fPic * sinceOff)
  if (tau < toff) return -vRefl + spike
  const sinceDemag = tau - toff
  return -vRefl * Math.exp(-sinceDemag / w.tauDcm) * Math.cos(2 * Math.PI * w.fDcm * sinceDemag) + spike
}

/** Signaux d'oscilloscope V1 (primaire, réf. PGND) et V2 = −m·V1 (secondaire, réf. GND0), avec bruit. */
export function flybackSignals(p: FlybackParams, rand: () => number = Math.random): { v1: Signal; v2: Signal } {
  const op = operatingPoint(p)
  const { m, formeOnde: w } = FLYBACK
  const noise = (scale: number) => (rand() - 0.5) * 2 * w.bruit * scale
  return {
    v1: (t) => v1Clean(p, op, t) + noise(p.ve),
    v2: (t) => -m * v1Clean(p, op, t) + noise(m * p.ve),
  }
}

/** m retrouvé comme au labo : |V2 pendant la conduction| / Ve, moyenné au centre du palier. */
export function measureRatio(p: FlybackParams, rand: () => number = Math.random): number {
  const op = operatingPoint(p)
  const { v2 } = flybackSignals(p, rand)
  const T = 1 / FLYBACK.fDecoupage
  let sum = 0
  const N = 200
  for (let k = 0; k < N; k++) sum += v2((0.25 + (0.5 * k) / N) * op.alpha * T)
  return Math.abs(sum / N) / p.ve
}

/** Fraction de période où |V2| reste proche de 0 (< 30 % de Vs+Vd) : signe de conduction discontinue. */
export function idleFraction(p: FlybackParams, rand: () => number = Math.random): number {
  const { v2 } = flybackSignals(p, rand)
  const T = 1 / FLYBACK.fDecoupage
  const N = 2000
  let idle = 0
  for (let k = 0; k < N; k++) if (Math.abs(v2((k / N) * T)) < 0.3 * (FLYBACK.vs + FLYBACK.vd)) idle++
  return idle / N
}

/** Valeurs du banc figées au moment du relevé (référence des lectures). */
export interface ReleveBench {
  ve: number
  ie: number
  vs: number
  is: number
}
/** Saisie d'une ligne du tableau (NaN si vide). */
export interface ReleveInput extends ReleveBench {
  pin: number
  pout: number
  /** Rendement saisi — % */
  eta: number
}

const READ_TOL = 0.05
const CALC_TOL = 0.03

/**
 * Contrôles d'une ligne : lectures à ±5 % du banc ; Pin = Ve·Ie, Pout = Vs·Is et η = Pout/Pin
 * à ±3 % des mesures saisies par l'étudiant.
 */
export function releveChecks(bench: ReleveBench, x: ReleveInput): Record<keyof ReleveInput, { expected: number; tol: number }> {
  const pin = x.ve * x.ie
  const pout = x.vs * x.is
  return {
    ve: { expected: bench.ve, tol: READ_TOL },
    ie: { expected: bench.ie, tol: READ_TOL },
    vs: { expected: bench.vs, tol: READ_TOL },
    is: { expected: bench.is, tol: READ_TOL },
    pin: { expected: pin, tol: CALC_TOL },
    pout: { expected: pout, tol: CALC_TOL },
    eta: { expected: (100 * pout) / pin, tol: CALC_TOL },
  }
}

const near = (v: number, target: number, tol: number) => Number.isFinite(v) && Number.isFinite(target) && Math.abs(v - target) <= tol * Math.abs(target)

/** Erreur classique : η saisi égal à Vs/Ve (±3 %) au lieu de Ps/Pe — signalée seulement si η est faux. */
export function etaIsVoltageRatio(x: ReleveInput): boolean {
  const right = (100 * x.vs * x.is) / (x.ve * x.ie)
  return !near(x.eta, right, CALC_TOL) && near(x.eta, (100 * x.vs) / x.ve, CALC_TOL)
}

/** Courant de sortie (A) où le fonctionnement bascule entre conduction discontinue et continue, trouvé par balayage. */
export function discontinuityThreshold(ve: number = FLYBACK.veDefaut): number {
  for (let is = FLYBACK.isMin; is <= FLYBACK.isMax; is += 0.001)
    if (!operatingPoint({ ve, is, linear: false }).discontinuous) return Math.round(is * 1000) / 1000
  return NaN
}
