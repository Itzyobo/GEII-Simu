/** Analyse de la trace gpio : fronts d'une broche, valeurs successives d'un groupe de broches. */
import type { Level, PinChange } from '../models/gpio'

/** Instants (Tcy) des changements de `pin` (vers `level` si précisé) */
export function pinEdges(trace: readonly PinChange[], pin: string, level?: Level): number[] {
  return trace.filter((c) => c.pin === pin && (level === undefined || c.level === level)).map((c) => c.t)
}

export interface BusSample {
  t: number
  value: number
}

/**
 * Valeurs successives du mot formé par `pins` (bit i = pins[i]), une entrée par instant où il change.
 * Les changements simultanés (écriture d'un registre entier) sont regroupés.
 */
export function busValues(trace: readonly PinChange[], pins: readonly string[], initial = 0): BusSample[] {
  const out: BusSample[] = []
  let value = initial
  let i = 0
  const relevant = trace.filter((c) => pins.includes(c.pin))
  while (i < relevant.length) {
    const t = relevant[i].t
    while (i < relevant.length && relevant[i].t === t) {
      const bit = pins.indexOf(relevant[i].pin)
      value = relevant[i].level ? value | (1 << bit) : value & ~(1 << bit)
      i++
    }
    if (!out.length || out[out.length - 1].value !== value) out.push({ t, value })
  }
  return out
}

/**
 * Signal périodique d'une broche entre t0 et t1 (ticks) : période moyenne entre fronts montants et rapport
 * cyclique (temps à 1 / durée). Sans front montant : période null, rapport cyclique = niveau constant.
 */
export function periodicOf(trace: readonly PinChange[], pin: string, t0: number, t1: number, initial: Level = 0): { period: number | null; duty: number } {
  let level: Level = initial
  for (const c of trace) {
    if (c.t > t0) break
    if (c.pin === pin) level = c.level
  }
  let high = 0
  let last = t0
  const rises: number[] = []
  for (const c of trace) {
    if (c.pin !== pin || c.t <= t0) continue
    if (c.t > t1) break
    if (level) high += c.t - last
    if (c.level && !level) rises.push(c.t)
    level = c.level
    last = c.t
  }
  if (level) high += t1 - last
  if (rises.length < 2) return { period: null, duty: t1 > t0 ? high / (t1 - t0) : level }
  // Périodes entières : temps à 1 entre le premier et le dernier front montant
  const a = rises[0]
  const z = rises[rises.length - 1]
  let lv: Level = 1
  let from = a
  let on = 0
  for (const c of trace) {
    if (c.pin !== pin || c.t <= a) continue
    if (c.t > z) break
    if (lv) on += c.t - from
    lv = c.level
    from = c.t
  }
  return { period: (z - a) / (rises.length - 1), duty: on / (z - a) }
}

/** Écarts successifs entre instants */
export const intervals = (times: readonly number[]) => times.slice(1).map((t, i) => t - times[i])
