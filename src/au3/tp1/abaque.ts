import { au3, AU3_EPSILON } from '../../data/reference'

/**
 * Abaque du TP1 (I.2.2), calculé depuis la réponse indicielle d'ordre 2 normalisée (aucune image) :
 *   s(x ; z) avec x = ωn·t, G0 = 1.
 * t1, t3 : instants où s atteint 26.4 % et 80.1 % ; courbes t3/t1(z) et ωn·t3(z) pour 0,5 < z < 3.
 */

/** Réponse indicielle normalisée d'un 2e ordre, à x = ωn·t */
export function indicielleNormalisee(x: number, z: number): number {
  if (x <= 0) return 0
  if (Math.abs(z - 1) < AU3_EPSILON) return 1 - (1 + x) * Math.exp(-x)
  if (z < 1) {
    const wd = Math.sqrt(1 - z * z)
    return 1 - Math.exp(-z * x) * (Math.cos(wd * x) + (z / wd) * Math.sin(wd * x))
  }
  const r = Math.sqrt(z * z - 1)
  const r1 = z - r
  const r2 = z + r
  return 1 - (r2 * Math.exp(-r1 * x) - r1 * Math.exp(-r2 * x)) / (r2 - r1)
}

/** Dichotomie : f croissante sur [a, b], renvoie x tel que f(x) = cible */
function dichotomie(f: (x: number) => number, cible: number, a: number, b: number): number {
  let lo = a
  let hi = b
  for (let i = 0; i < au3('ITERATIONS_DICHOTOMIE'); i++) {
    const mi = (lo + hi) / 2
    if (f(mi) < cible) lo = mi
    else hi = mi
  }
  return (lo + hi) / 2
}

/** Premier x = ωn·t où la réponse normalisée atteint la fraction p (0 < p < 1) */
export function xNiveau(p: number, z: number): number {
  // z < 1 : s croît jusqu'au premier pic x = π/ωd ; z ≥ 1 : s croît toujours, on double la borne
  let hi = z < 1 ? Math.PI / Math.sqrt(1 - z * z) : 1
  while (z >= 1 && indicielleNormalisee(hi, z) < p) hi *= 2
  return dichotomie((x) => indicielleNormalisee(x, z), p, 0, hi)
}

/** Ordonnée de la courbe t3/t1 de l'abaque */
export const rapportT3T1 = (z: number) => xNiveau(au3('NIVEAU_T3'), z) / xNiveau(au3('NIVEAU_T1'), z)
/** Ordonnée de la courbe ωn·t3 de l'abaque */
export const wnT3 = (z: number) => xNiveau(au3('NIVEAU_T3'), z)
/** Ordonnée de la courbe ωn·t1 (méthode hors énoncé, signalée) */
export const wnT1 = (z: number) => xNiveau(au3('NIVEAU_T1'), z)

/** Inversion de la courbe t3/t1 : z dont le rapport vaut `rapport`, ou null hors de l'abaque */
export function zDepuisRapport(rapport: number): number | null {
  const a = au3('ABAQUE_Z_MIN')
  const b = au3('ABAQUE_Z_MAX')
  if (!(rapport >= rapportT3T1(a) && rapport <= rapportT3T1(b))) return null
  return dichotomie(rapportT3T1, rapport, a, b)
}

/** Lecture complète de l'abaque, méthode de l'énoncé : z par t3/t1, puis ωn = (ωn·t3)/t3 */
export function lireAbaque(t1: number, t3: number): { rapport: number; z: number; wnT3: number; wn: number } | null {
  const rapport = t3 / t1
  const z = zDepuisRapport(rapport)
  if (z === null) return null
  const y = wnT3(z)
  return { rapport, z, wnT3: y, wn: y / t3 }
}
