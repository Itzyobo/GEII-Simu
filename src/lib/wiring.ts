export type Pair = readonly [string, string]

export interface WiringResult {
  ok: boolean
  errors: string[]
}

const key = ([a, b]: Pair) => (a < b ? `${a}|${b}` : `${b}|${a}`)

/**
 * Compare des connexions en paires non orientées (ordre libre, doublons ignorés).
 * `optional` : fils autorisés mais non exigés (ex. masses de sondes).
 */
export function checkWiring(
  wires: readonly Pair[],
  expected: readonly Pair[],
  labels: Record<string, string> = {},
  optional: readonly Pair[] = [],
): WiringResult {
  const name = (id: string) => labels[id] ?? id
  const have = new Map(wires.map((p) => [key(p), p]))
  const want = new Map(expected.map((p) => [key(p), p]))
  const allowed = new Set(optional.map(key))
  const errors: string[] = []
  for (const [k, [a, b]] of want) if (!have.has(k)) errors.push(`Fil manquant entre ${name(a)} et ${name(b)}`)
  for (const [k, [a, b]] of have) if (!want.has(k) && !allowed.has(k)) errors.push(`Fil en trop entre ${name(a)} et ${name(b)}`)
  return { ok: errors.length === 0, errors }
}
