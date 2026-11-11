import { au3 } from '../../data/reference'

/**
 * Régulateur de la platine : R(p) = (Affichage G1 × G2 / 100) · Z2(p) / Z1(p), sortie bornée à ±USAT
 * (dans simulate). Supports vides = les deux résistances égales de la platine (R(p) = K, TP2/TP3).
 * PI série : R1 sur Z1, R2 + C2 en série sur Z2 → K = (R2/R1)·G1·G2, Ti = R2·C2.
 */
export type ComposantId = 'R1' | 'R2' | 'C2'
export interface Impedance {
  composants: readonly ComposantId[]
  montage: 'serie' | 'parallele'
}

/** H(p) = (b0 + b1·p) / (a0 + a1·p) */
export interface Transfert {
  b0: number
  b1: number
  a0: number
  a1: number
}

/** Z(p) = (n0 + n1·p) / (d0 + d1·p) d'un composant seul */
const zComposant = (c: ComposantId): Transfert => (c === 'C2' ? { b0: 1, b1: 0, a0: 0, a1: au3('C2') } : { b0: au3(c), b1: 0, a0: 1, a1: 0 })

/** Impédance d'un support (un composant, ou une résistance avec le condensateur en série ou en parallèle) ; null si non géré */
export function impedance(z: Impedance): Transfert | null {
  const [x, y, ...reste] = z.composants
  if (!x || reste.length) return null
  if (!y) return zComposant(x)
  const r = [x, y].find((c) => c !== 'C2')
  const cap = [x, y].includes('C2')
  if (!r) return null
  const R = au3(r)
  if (!cap) return z.montage === 'serie' ? { b0: au3(x) + au3(y), b1: 0, a0: 1, a1: 0 } : { b0: (au3(x) * au3(y)) / (au3(x) + au3(y)), b1: 0, a0: 1, a1: 0 }
  const RC = R * au3('C2')
  // série : R + 1/(Cp) = (1 + RCp)/(Cp) ; parallèle : R/(1 + RCp)
  return z.montage === 'serie' ? { b0: 1, b1: RC, a0: 0, a1: au3('C2') } : { b0: R, b1: 0, a0: 1, a1: RC }
}

/**
 * Z2/Z1 en transfert du 1er ordre. Z1 doit être résistif (sinon null : régulateur non géré).
 * shortcut: Z1 non résistif (ordre 2) non simulé, à ajouter si l'étape 4 en a besoin.
 */
export function transfertRegulateur(z1: Impedance | null, z2: Impedance | null): Transfert | null {
  if (!z1 && !z2) return { b0: 1, b1: 0, a0: 1, a1: 0 }
  if (!z1 || !z2) return null
  const t1 = impedance(z1)
  const t2 = impedance(z2)
  if (!t1 || !t2 || t1.b1 !== 0 || t1.a1 !== 0) return null
  const r1 = t1.b0 / t1.a0
  return { b0: t2.b0, b1: t2.b1, a0: r1 * t2.a0, a1: r1 * t2.a1 }
}

/** Gain d'affichage K = Affichage G1 × G2 / 100 */
export const gainAffichage = (g1: number, g2: number) => (g1 * g2) / au3('K_P_DIVISEUR')

/**
 * Forme d'état d'un transfert du 1er ordre : y = D·e + x, dx/dt = A·x + B·e.
 * Un transfert à dérivée pure (a1 = 0 et b1 ≠ 0) est réduit à son gain statique.
 */
export function formeEtat(h: Transfert): { A: number; B: number; D: number } {
  if (h.a1 === 0) return { A: 0, B: 0, D: h.b0 / h.a0 }
  const D = h.b1 / h.a1
  return { A: -h.a0 / h.a1, B: (h.b0 - h.a0 * D) / h.a1, D }
}
