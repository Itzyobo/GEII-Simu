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
