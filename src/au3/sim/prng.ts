/**
 * PRNG à graine (mulberry32) et bruit gaussien (Box-Muller).
 * Les nombres de ce fichier sont les constantes de l'algorithme mulberry32, pas des valeurs de modèle
 * (fichier en liste blanche du test des constantes).
 */
export function mulberry32(graine: number): () => number {
  let a = graine >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Générateur gaussien centré réduit, déterministe pour une graine donnée */
export function gaussien(uniforme: () => number): () => number {
  return () => {
    const u = 1 - uniforme() // ]0, 1] : log défini
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * uniforme())
  }
}
