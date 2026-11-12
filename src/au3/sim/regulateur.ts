import { au3, AU3_EPSILON } from '../../data/reference'

/**
 * Régulateur de la platine à impédances : R(p) = (Z2(p)/Z1(p)) · G1 · G2, avec G1 = Affichage/100, sortie bornée
 * à ±USAT (dans simulate, intégrateur sans anti-emballement, hypothèse 6 du PRD).
 * Chaque support Z reçoit les composants posés par l'étudiant (R1, R2, C2), seuls, en série ou en parallèle.
 * Cas de l'énoncé (TP4) : R1 sur Z1, R2 + C2 en série sur Z2 → R(p) = K(1 + Ti·p)/(Ti·p), K = (R2/R1)·G1·G2, Ti = R2·C2.
 * Les deux supports vides = les résistances égales de la platine : R(p) = G1·G2 (régulateur P du TP2).
 */
export type ComposantId = 'R1' | 'R2' | 'C2'
export interface Impedance {
  composants: readonly ComposantId[]
  montage: 'serie' | 'parallele'
}

/** Polynôme en p, coefficients par puissance croissante : [c0, c1, c2] = c0 + c1·p + c2·p² */
export type Poly = readonly number[]
/** H(p) = num(p) / den(p) */
export interface Transfert {
  num: Poly
  den: Poly
}

const coef = (a: Poly, i: number) => a[i] ?? 0
const plus = (a: Poly, b: Poly): Poly => Array.from({ length: Math.max(a.length, b.length) }, (_, i) => coef(a, i) + coef(b, i))
const fois = (a: Poly, b: Poly): Poly => {
  const r = new Array<number>(a.length + b.length - 1).fill(0)
  a.forEach((x, i) => b.forEach((y, j) => (r[i + j] = r[i + j]! + x * y)))
  return r
}
const echelle = (a: Poly, k: number): Poly => a.map((x) => x * k)
const nul = (x: number) => Math.abs(x) < AU3_EPSILON
/** Degré réel (coefficients nuls de tête ignorés) ; −1 pour le polynôme nul */
const degre = (a: Poly) => {
  for (let i = a.length - 1; i >= 0; i--) if (!nul(a[i]!)) return i
  return -1
}

/** Impédance d'un composant seul : R → R ; C → 1/(Cp) */
const zComposant = (c: ComposantId): Transfert => (c === 'C2' ? { num: [1], den: [0, au3('C2')] } : { num: [au3(c)], den: [1] })

/** Impédance d'un support ; null si vide */
export function impedance(z: Impedance | null): Transfert | null {
  if (!z || !z.composants.length) return null
  return z.composants.map(zComposant).reduce((a, b) =>
    z.montage === 'serie'
      ? { num: plus(fois(a.num, b.den), fois(b.num, a.den)), den: fois(a.den, b.den) } // Za + Zb
      : { num: fois(a.num, b.num), den: plus(fois(a.num, b.den), fois(b.num, a.den)) }, // Za·Zb/(Za + Zb)
  )
}

/** Gain d'affichage G1·G2 = Affichage G1 × G2 / 100 */
export const gainAffichage = (g1: number, g2: number) => (g1 * g2) / au3('K_P_DIVISEUR')

/** Simplifie les facteurs p communs (numérateur et dénominateur nuls en p = 0) */
function simplifier(h: Transfert): Transfert {
  let { num, den } = h
  while (num.length > 1 && den.length > 1 && nul(num[0]!) && nul(den[0]!)) {
    num = num.slice(1)
    den = den.slice(1)
  }
  return { num, den }
}

/**
 * R(p) = (Z2/Z1)·G1·G2 ; null si un seul support est câblé (« régulateur non câblé ») ou si le transfert est
 * impropre (dérivateur pur, C seul sur Z1 avec une résistance sur Z2 : non simulé).
 */
export function regulateur(z1: Impedance | null, z2: Impedance | null, g1: number, g2: number): Transfert | null {
  const k = gainAffichage(g1, g2)
  const a = impedance(z1)
  const b = impedance(z2)
  if (!a && !b) return { num: [k], den: [1] }
  if (!a || !b) return null
  const h = simplifier({ num: echelle(fois(b.num, a.den), k), den: fois(b.den, a.num) })
  return degre(h.num) > degre(h.den) || degre(h.den) < 0 ? null : h
}

/** K et Ti si R(p) a la forme d'un PI série K(1 + Ti·p)/(Ti·p) ; null sinon */
export function parametresPI(h: Transfert): { K: number; Ti: number } | null {
  if (degre(h.den) !== 1 || !nul(coef(h.den, 0)) || degre(h.num) !== 1 || nul(coef(h.num, 0))) return null
  const K = coef(h.num, 1) / coef(h.den, 1)
  return { K, Ti: coef(h.num, 1) / coef(h.num, 0) }
}

/**
 * Forme d'état commandable (ordre n ≤ 2) : x' = A·x + B·e, y = C·x + D·e, avec le dénominateur rendu unitaire.
 * Ordre 2 : x1' = x2, x2' = −a0·x1 − a1·x2 + e ; ordre 1 : x1' = −a0·x1 + e.
 */
export function formeEtat(h: Transfert): { ordre: number; a: [number, number]; c: [number, number]; D: number } {
  const n = degre(h.den)
  const lead = coef(h.den, n)
  const a: [number, number] = [coef(h.den, 0) / lead, coef(h.den, 1) / lead]
  const b = [coef(h.num, 0) / lead, coef(h.num, 1) / lead, coef(h.num, 2) / lead]
  const D = degre(h.num) === n ? b[n]! : 0
  return { ordre: n, a, c: [b[0]! - a[0] * D, b[1]! - (n === 2 ? a[1] : 0) * D], D }
}
