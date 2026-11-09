/**
 * Oscilloscope INFO3 : signaux logiques reconstruits à partir des changements datés des broches
 * (0 à 3,3 V, fronts de 20 ns : H40), déclenchement sur front, période automatique (src/lib/scope.ts)
 * et décodage SPI (octets MSB en premier, lus au front de lecture du mode choisi).
 */
import { INFO3 } from '../../data/reference'
import { acquire, measure, SCOPE_POINTS, type Signal } from '../../lib/scope'
import type { TraceChange } from '../worker/protocol'

const S = INFO3.scope

/** Dernier indice de `a` dont t ≤ x (−1 si aucun) */
function lastBefore(a: readonly TraceChange[], x: number): number {
  let lo = 0
  let hi = a.length - 1
  let r = -1
  while (lo <= hi) {
    const m = (lo + hi) >> 1
    if (a[m].t <= x) {
      r = m
      lo = m + 1
    } else hi = m - 1
  }
  return r
}

/** Tension de la voie à l'instant t : niveau logique avec rampe linéaire de riseTime après chaque changement */
export function signalOf(a: readonly TraceChange[]): Signal {
  return (t) => {
    const i = lastBefore(a, t)
    if (i < 0) return a.length ? a[0].level * S.vHigh : 0
    const c = a[i]
    const prev = i > 0 ? a[i - 1].level : c.level
    const u = Math.min(1, (t - c.t) / S.riseTime)
    return (prev + (c.level - prev) * u) * S.vHigh
  }
}

export type TriggerEdge = 'rising' | 'falling'

/** Instant où un front de la voie franchit `level` (V) */
const crossing = (c: TraceChange, level: number) => c.t + S.riseTime * (c.level ? level / S.vHigh : 1 - level / S.vHigh)

/**
 * Déclenchement : dernier front du type demandé dont la fenêtre [t − span/2, t + span/2] est entièrement
 * acquise (t + span/2 ≤ tEnd), avec un temps de retenue d'une demi-fenêtre : on retient le premier front
 * d'une salve (aucun front du même type dans la demi-fenêtre qui précède), comme un oscilloscope réarmé.
 * Sans salve isolée, le dernier front convenable. null : pas de front → l'écran défile (mode auto).
 */
export function findTriggerTime(a: readonly TraceChange[], edge: TriggerEdge, level: number, tEnd: number, span: number): number | null {
  const want = edge === 'rising' ? 1 : 0
  const fronts: number[] = []
  for (let i = 1; i < a.length; i++) if (a[i].level === want && a[i - 1].level !== want) fronts.push(crossing(a[i], level))
  let fallback: number | null = null
  for (let i = fronts.length - 1; i >= 0; i--) {
    const t = fronts[i]
    if (t + span / 2 > tEnd) continue
    fallback ??= t
    if (i === 0 || t - fronts[i - 1] > span / 2) return t
  }
  return fallback
}

/** Période mesurée automatiquement sur [t0, t0 + span] (s), NaN s'il n'y a pas deux fronts de même sens */
export function autoPeriod(a: readonly TraceChange[], t0: number, span: number): number {
  const samples = acquire(signalOf(a), t0, span, SCOPE_POINTS)
  return 1 / measure(samples, span / SCOPE_POINTS).freq
}

export interface DecodedByte {
  /** Premier front de lecture de l'octet — s */
  t: number
  value: number
}

/**
 * Décodage SPI : bits lus sur `data` au front de lecture de `clk` (repos → actif si CKE = 1, sinon
 * actif → repos), MSB en premier ; un nouvel octet commence après 8 bits ou un silence de plus de 4 périodes.
 */
export function decodeSpi(clk: readonly TraceChange[], data: readonly TraceChange[], mode: number, t0: number, t1: number): DecodedByte[] {
  const m = INFO3.spi.modes.find((x) => x.mode === mode) ?? INFO3.spi.modes[0]
  const readLevel = m.cke ? 1 - m.ckp : m.ckp
  const edges = clk.filter((c, i) => c.t >= t0 && c.t <= t1 && c.level === readLevel && i > 0 && clk[i - 1].level !== readLevel).map((c) => c.t)
  const levelAt = (t: number) => {
    const i = lastBefore(data, t - S.riseTime)
    return i < 0 ? 0 : data[i].level
  }
  const out: DecodedByte[] = []
  const bits = INFO3.c.bitsPerByte
  const gapFactor = 4
  let cur: number[] = []
  let start = 0
  // Période de SCK = plus petit écart entre fronts de lecture ; un silence plus long sépare les trames
  let period = Infinity
  for (let i = 1; i < edges.length; i++) period = Math.min(period, edges[i] - edges[i - 1])
  edges.forEach((t, i) => {
    if (i > 0 && cur.length && t - edges[i - 1] > gapFactor * period) cur = []
    if (!cur.length) start = t
    cur.push(levelAt(t))
    if (cur.length === bits) {
      out.push({ t: start, value: cur.reduce((v, b) => (v << 1) | b, 0) })
      cur = []
    }
  })
  return out
}
