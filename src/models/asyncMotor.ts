/**
 * Machine asynchrone triphasée à cage — modèle pur, sans React.
 * Triangle sur 400 V : interpolation des relevés du CR selon le couple ; étoile et variateur dérivés.
 */
import { BRUIT, MAS, type PointMas } from '../data/reference'

export type Barrettes = 'triangle' | 'etoile' | 'aucune'
export type Source = 'reseau' | 'variateur'

export interface MasParams {
  /** Couple utile imposé par la charge active — N·m */
  couple: number
  couplage: 'triangle' | 'etoile'
  source: Source
  /** Fréquence du variateur — Hz (ignorée sur le réseau) */
  f: number
}

export interface MasState {
  /** Vitesse — tr/min ; vitesse de synchronisme — tr/min */
  n: number
  ns: number
  g: number
  /** Vitesse angulaire — rad/s */
  omega: number
  /** Courant de ligne — A */
  is: number
  /** Tension simple du réseau — V */
  v: number
  /** Tension composée fondamentale aux bornes du moteur — V */
  u: number
  pa: number
  qa: number
  s: number
  cosPhi: number
  pu: number
  eta: number
  /** Tension du capteur de couple — V */
  sensor: number
  alerts: string[]
  /** Raison de coupure, ou null */
  trip: string | null
}

const P = MAS.plaque.p
export const STAR_ALERT = 'Enroulements sous-alimentés : couplage incorrect pour un réseau 400 V.'
/** Couple au-delà duquel l'étoile sur 400 V déclenche l'alerte — N·m (énoncé du besoin) */
const STAR_TORQUE_LIMIT = 3

/** Vitesse de synchronisme Ns = 60·f/p — tr/min. */
export const syncSpeed = (f: number) => (60 * f) / P

/** Couple utile nominal Cu = Pn / Ωn — N·m. */
export const nominalTorque = () => MAS.plaque.pn / ((MAS.plaque.nn * Math.PI) / 30)

/** Paires de pôles déduites de la plaque : Ns juste au-dessus de Nn. */
export const polePairs = () => Math.floor((60 * MAS.fReseau) / MAS.plaque.nn)

/** Interpolation linéaire des relevés (triangle, 400 V) ; dernier segment prolongé au-delà de 10 N·m. */
export function interpolate(couple: number): PointMas {
  const r = MAS.releves
  const c = Math.max(0, couple)
  let k = 1
  while (k < r.length - 1 && c > r[k].couple) k++
  const a = r[k - 1]
  const b = r[k]
  const t = (c - a.couple) / (b.couple - a.couple)
  const lerp = (x: number, y: number) => x + t * (y - x)
  return { couple: c, n: lerp(a.n, b.n), is: lerp(a.is, b.is), v: lerp(a.v, b.v), pa: lerp(a.pa, b.pa), qa: lerp(a.qa, b.qa) }
}

/** Protection : capteur de couple > 3 V ou courant de ligne > 3,9 A. */
export function tripReason(sensor: number, is: number): string | null {
  if (sensor > MAS.capteurLimite) return `Coupure : tension du capteur de couple ${sensor.toFixed(2)} V > ${MAS.capteurLimite} V.`
  if (is > MAS.iLimite) return `Coupure : courant de ligne ${is.toFixed(2)} A > ${MAS.iLimite} A.`
  return null
}

function finish(base: Omit<MasState, 's' | 'cosPhi' | 'pu' | 'eta' | 'omega' | 'sensor' | 'trip'>, couple: number): MasState {
  const s = Math.hypot(base.pa, base.qa)
  const omega = (base.n * Math.PI) / 30
  const pu = couple * omega
  const sensor = MAS.capteurCouple * couple
  return { ...base, s, cosPhi: base.pa / s, omega, pu, eta: base.pa > 0 ? pu / base.pa : 0, sensor, trip: tripReason(sensor, base.is) }
}

/** État du moteur pour un réglage donné (valeurs exactes, sans bruit). */
export function motorState({ couple, couplage, source, f }: MasParams): MasState {
  const c = Math.max(0, couple)
  const tri = interpolate(c)
  const ns0 = syncSpeed(MAS.fReseau)
  const gTri = (ns0 - tri.n) / ns0

  if (source === 'variateur') {
    // Triangle obligatoire (refusé à la vérification sinon). Même glissement qu'au réseau à couple égal.
    const ns = syncSpeed(f)
    const n = ns * (1 - gTri)
    const u = MAS.variateurUsurF * f
    const puTri = c * ((tri.n * Math.PI) / 30)
    const pa = tri.pa - puTri + c * ((n * Math.PI) / 30) // pertes inchangées, puissance utile à la nouvelle vitesse
    const qa = tri.qa * (f / MAS.fReseau) // U/f constant : Q = U²/X ∝ f
    return finish({ n, ns, g: gTri, is: tri.is, v: u / Math.sqrt(3), u, pa, qa, alerts: [] }, c)
  }

  if (couplage === 'etoile') {
    // Chaque enroulement reçoit 400/√3 ≈ 231 V au lieu de 400 V : couple ∝ V², glissement ×3 à couple égal.
    const vWinding = MAS.uReseau / Math.sqrt(3)
    const g = 3 * gTri
    const n = ns0 * (1 - g)
    const s0 = 3 * vWinding * MAS.i0Etoile400
    const q0 = Math.sqrt(s0 ** 2 - MAS.p0Etoile400 ** 2)
    const pa = MAS.p0Etoile400 + c * ((ns0 * Math.PI) / 30) // bilan simple : pertes à vide + puissance transmise Cu·Ωs
    const is = Math.hypot(pa, q0) / (3 * vWinding)
    return finish(
      { n, ns: ns0, g, is, v: vWinding, u: MAS.uReseau, pa, qa: q0, alerts: c > STAR_TORQUE_LIMIT ? [STAR_ALERT] : [] },
      c,
    )
  }

  return finish({ n: tri.n, ns: ns0, g: gTri, is: tri.is, v: tri.v, u: MAS.uReseau, pa: tri.pa, qa: tri.qa, alerts: [] }, c)
}

export interface Readings {
  n: number
  is: number
  v: number
  pa: number
  qa: number
  sensor: number
}

/**
 * Lectures des appareils : bruit ±1,5 % sur les grandeurs électriques et le capteur de couple.
 * Vitesse lue au variateur de la charge active : ±0,1 % (un bruit de 1,5 % rendrait g inexploitable).
 */
export function readings(st: MasState, rand: () => number = Math.random): Readings {
  const k = (BRUIT.min + BRUIT.max) / 2
  const noisy = (x: number, r = k) => x * (1 + (rand() * 2 - 1) * r)
  return { n: noisy(st.n, 0.001), is: noisy(st.is), v: noisy(st.v), pa: noisy(st.pa), qa: noisy(st.qa), sensor: noisy(st.sensor) }
}

/** Méthode des 3 wattmètres : chaque phase indique le tiers ; le total est la somme (Boucherot). */
export function wattmeterPhases(pa: number, qa: number) {
  const phase = { p: pa / 3, q: qa / 3, s: Math.hypot(pa, qa) / 3 }
  return { phases: [phase, phase, phase], total: { p: pa, q: qa, s: Math.hypot(pa, qa) } }
}

/** Tension composée lue au wattmètre en sortie de variateur : fondamental (mode harmonique) ou RMS vrai. */
export function inverterVoltage(f: number, mode: 'fondamental' | 'rms'): number {
  const uf = MAS.variateurUsurF * f
  return mode === 'fondamental' ? uf : Math.hypot(uf, MAS.variateurUh)
}

export type OhmPair = 'U1-U2' | 'U1-V1'

/**
 * Ohmmètre aux bornes de la boîte à bornes. null = refus (appareil sous tension), Infinity = circuit ouvert.
 * Triangle : chaque paire voit Rs ∥ 2·Rs = 2/3·Rs. Étoile : U1–V1 = 2·Rs, U1–U2 = Rs.
 */
export function ohmmeter(barrettes: Barrettes, pair: OhmPair, powered: boolean): number | null {
  if (powered) return null
  const rs = MAS.rsChaud
  if (barrettes === 'triangle') return (2 / 3) * rs
  if (barrettes === 'etoile') return pair === 'U1-V1' ? 2 * rs : rs
  return pair === 'U1-U2' ? rs : Infinity
}

export interface LossInputs {
  /** Essai à vide triangle 400 V : P0Δ (W), I0Δ (A, ligne) */
  p0d: number
  i0d: number
  /** Essai à vide étoile 400 V : P0Y (W), I0Y (A) */
  p0y: number
  i0y: number
}

/** Séparation des pertes : Pmag = α·U² (Δ) ou α·V² (Y), Pméca identique dans les deux essais. */
export function lossSeparation({ p0d, i0d, p0y, i0y }: LossInputs, rs: number = MAS.rsChaud) {
  const U = MAS.uReseau
  const V = MAS.uReseau / Math.sqrt(3)
  const pjsD = 3 * rs * (i0d / Math.sqrt(3)) ** 2
  const pjsY = 3 * rs * i0y ** 2
  const pcD = p0d - pjsD
  const pcY = p0y - pjsY
  const alpha = (pcD - pcY) / (U ** 2 - V ** 2)
  return { pjsD, pjsY, pcD, pcY, alpha, pmeca: pcD - alpha * U ** 2 }
}

/** Valeurs exactes des essais à vide (relevé à 0 N·m en triangle, essai étoile du CR). */
export const exactNoLoad = (): LossInputs => ({
  p0d: MAS.releves[0].pa,
  i0d: MAS.releves[0].is,
  p0y: MAS.p0Etoile400,
  i0y: MAS.i0Etoile400,
})

/**
 * Incertitude (somme des valeurs absolues) sur Pméca pour une erreur relative `rel` sur chaque lecture.
 * Avec U²/(U² − V²) = 3/2 : Pméca = −½·P0Δ + ½·Rs·I0Δ² + 3/2·P0Y − 9/2·Rs·I0Y².
 */
export function pmecaUncertainty({ p0d, i0d, p0y, i0y }: LossInputs, rel = (BRUIT.min + BRUIT.max) / 2, rs: number = MAS.rsChaud): number {
  const k = MAS.uReseau ** 2 / (MAS.uReseau ** 2 - MAS.uReseau ** 2 / 3)
  return rel * ((k - 1) * p0d + (k - 1) * rs * 2 * i0d ** 2 + k * p0y + k * 3 * rs * 2 * i0y ** 2)
}

/** Explication de la question 8 selon le signe du Pméca calculé depuis les saisies. */
export function lossVerdict(inputs: LossInputs) {
  const { alpha, pmeca } = lossSeparation(inputs)
  const dp = pmecaUncertainty(inputs)
  const f = (x: number) => String(Number(x.toPrecision(3))).replace('.', ',')
  const kind: 'negatif' | 'positif' = pmeca < 0 ? 'negatif' : 'positif'
  const text =
    kind === 'negatif'
      ? `Pméca ≈ ${f(pmeca)} W est négatif, ce qui est physiquement impossible. À 400 V en triangle le circuit magnétique sature, donc l'hypothèse Pmag = α·U² est fausse ; de plus le wattmètre est imprécis à cos φ ≈ 0,15.`
      : `Pméca ≈ ${f(pmeca)} ± ${f(dp)} W : valeur positive mais très sensible, car Pméca est la petite différence de deux grandeurs proches (±1,5 % sur chaque lecture suffisent à donner ±${f(dp)} W).`
  return { alpha, pmeca, uncertainty: dp, kind, text }
}

export interface BalanceInputs {
  /** Mesures au point nominal : Pa (W), Is ligne (A), g (sans unité), Pu (W) ; α issu de la séparation (W/V²) */
  pa: number
  is: number
  g: number
  pu: number
  alpha: number
}

/** Bilan de puissance au point nominal, moteur en triangle sur 400 V. */
export function powerBalance({ pa, is, g, pu, alpha }: BalanceInputs, rs: number = MAS.rsChaud) {
  const pjs = 3 * rs * (is / Math.sqrt(3)) ** 2
  const pfer = alpha * MAS.uReseau ** 2
  const ptr = pa - pjs - pfer
  const pjr = g * ptr
  return { pjs, pfer, ptr, pjr, pmeca: ptr - pjr - pu, eta: pu / pa }
}
