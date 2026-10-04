/** Logique pure de l'oscilloscope : trigger, acquisition, mesures auto. */

/** Points par trace (et par mesure) sur les 10 divisions horizontales. */
export const SCOPE_POINTS = 1000

export type Signal = (t: number) => number

/**
 * Premier front montant de `fn` à travers `level` à partir de `tStart`
 * (pas `step`, au plus `maxSteps`), affiné par dichotomie. null si aucun.
 */
export function findTrigger(fn: Signal, level: number, tStart: number, step: number, maxSteps: number): number | null {
  let prev = fn(tStart)
  for (let i = 1; i <= maxSteps; i++) {
    const t = tStart + i * step
    const cur = fn(t)
    if (prev < level && cur >= level) {
      let lo = t - step
      let hi = t
      for (let k = 0; k < 30; k++) {
        const mid = (lo + hi) / 2
        if (fn(mid) < level) lo = mid
        else hi = mid
      }
      return hi
    }
    prev = cur
  }
  return null
}

/**
 * Début de la fenêtre affichée (largeur `span`, n points) : trigger au centre de l'écran.
 * Recherche sur 20 écrans et au moins 100 ms de signal (≤ 200 000 points) ; sans front → mode auto, la trace défile.
 */
export function frameStart(trig: Signal, level: number, tNow: number, span: number, n: number) {
  const step = span / n
  const tTrig = findTrigger(trig, level, tNow, step, Math.min(200_000, Math.max(20 * n, Math.ceil(0.1 / step))))
  return tTrig === null ? { t0: tNow, triggered: false } : { t0: tTrig - span / 2, triggered: true }
}

/** n échantillons de `fn` sur [t0, t0 + span[. */
export function acquire(fn: Signal, t0: number, span: number, n: number): Float64Array {
  const out = new Float64Array(n)
  const dt = span / n
  for (let i = 0; i < n; i++) out[i] = fn(t0 + i * dt)
  return out
}

export interface Measures {
  /** Hz, NaN si moins d'une période complète à l'écran */
  freq: number
  max: number
  min: number
  /** 0…1, NaN si moins d'une période complète */
  duty: number
}

/**
 * Mesures auto sur un enregistrement échantillonné au pas `dt`.
 * Fronts détectés au niveau médian avec hystérésis (10 % de l'amplitude),
 * instants interpolés linéairement entre échantillons.
 */
export function measure(samples: ArrayLike<number>, dt: number): Measures {
  let max = -Infinity
  let min = Infinity
  for (let i = 0; i < samples.length; i++) {
    max = Math.max(max, samples[i])
    min = Math.min(min, samples[i])
  }
  const mid = (max + min) / 2
  const hyst = 0.1 * (max - min)
  const rises: number[] = []
  const falls: number[] = []
  if (hyst > 0) {
    let high = samples[0] > mid
    let lastUp = NaN
    let lastDown = NaN
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1]
      const b = samples[i]
      const tc = (i - 1 + (mid - a) / (b - a)) * dt
      if (a < mid && b >= mid) lastUp = tc
      if (a >= mid && b < mid) lastDown = tc
      if (!high && b > mid + hyst) {
        high = true
        if (!Number.isNaN(lastUp)) rises.push(lastUp)
      } else if (high && b < mid - hyst) {
        high = false
        if (!Number.isNaN(lastDown)) falls.push(lastDown)
      }
    }
  }
  // Périodes mesurées entre fronts de même sens : montants si possible, sinon descendants.
  const useRises = rises.length >= 2
  const edges = useRises ? rises : falls
  const others = useRises ? falls : rises
  if (edges.length < 2) return { freq: NaN, max, min, duty: NaN }
  const span = edges[edges.length - 1] - edges[0]
  let firstStateTime = 0 // temps à l'état haut (montants) ou bas (descendants)
  for (let k = 0; k < edges.length - 1; k++) {
    const other = others.find((t) => t > edges[k] && t < edges[k + 1])
    if (other !== undefined) firstStateTime += other - edges[k]
  }
  const duty = useRises ? firstStateTime / span : 1 - firstStateTime / span
  return { freq: (edges.length - 1) / span, max, min, duty }
}

/** Signal lu en boucle dans un buffer échantillonné au pas `dt` (durée = arr.length·dt). */
export function bufferSignal(arr: ArrayLike<number>, dt: number): Signal {
  const duration = arr.length * dt
  return (t) => {
    const u = ((t % duration) + duration) % duration
    return arr[Math.min(arr.length - 1, Math.floor(u / dt))]
  }
}
