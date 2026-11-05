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

/** Écarts successifs entre instants */
export const intervals = (times: readonly number[]) => times.slice(1).map((t, i) => t - times[i])
