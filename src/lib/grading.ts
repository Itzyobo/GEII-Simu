/** « 1,5 » ou « 1.5 » → 1.5 ; NaN si illisible. */
export function parseAnswer(s: string): number {
  const t = s.trim().replace(/\s/g, '').replace(',', '.')
  return t === '' ? NaN : Number(t)
}

/** Réponse juste si |réponse − attendu| ≤ tolérance relative × |attendu| (absolue si attendu = 0). */
export function isCorrect(answer: number, expected: number, tolerance = 0.05): boolean {
  if (!Number.isFinite(answer)) return false
  return Math.abs(answer - expected) <= tolerance * (expected === 0 ? 1 : Math.abs(expected))
}

/** Points dégressifs : 1 si |écart relatif| ≤ full, ½ si ≤ half, 0 sinon (ou si la réponse est illisible). */
export function tieredScore(answer: number, expected: number, full: number, half: number): number {
  if (!Number.isFinite(answer)) return 0
  const r = Math.abs(answer - expected) / Math.abs(expected)
  // Marge d'arrondi : 5 % pile reste dans la tranche (les seuils sont saisis à la main)
  const eps = 1e-12
  return r <= full + eps ? 1 : r <= half + eps ? 0.5 : 0
}
