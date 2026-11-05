/** Générateur pseudo-aléatoire à graine (mulberry32) : tirages reproductibles dans les tests. */

// Constantes de l'algorithme mulberry32 (Tommy Ettinger), pas des valeurs matérielles
const MB_INC = 0x6d2b79f5
const MB_S1 = 15
const MB_S2 = 7
const MB_S3 = 14
const MB_M = 61
const UINT32_RANGE = 2 ** 32

export type Rng = () => number

/** Renvoie une fonction qui tire un réel uniforme dans [0, 1) */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + MB_INC) | 0
    let t = Math.imul(a ^ (a >>> MB_S1), 1 | a)
    t = (t + Math.imul(t ^ (t >>> MB_S2), MB_M | t)) ^ t
    return ((t ^ (t >>> MB_S3)) >>> 0) / UINT32_RANGE
  }
}
