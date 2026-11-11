/** Calculs de l'analyseur logique : format des durées, points d'un chronogramme. */
import type { TraceChange } from '../worker/protocol'

/** Largeur du tracé (unités SVG) et ordonnées des niveaux dans une voie */
export const TRACE_W = 1000
export const TRACE_HIGH = 6
export const TRACE_LOW = 28

/** Format numérique français, créé une fois (toLocaleString en recrée un à chaque appel : coûteux à 30 images/s) */
const NF_FR = new Intl.NumberFormat('fr-FR')
export const fmtNumberFr = (x: number) => NF_FR.format(x)

/** Durée lisible : 9,984 ms, 64,52 µs, 1,2 s */
export function fmtTime(s: number): string {
  const abs = Math.abs(s)
  const [k, u] = abs >= 1 ? [1, 's'] : abs >= 1e-3 ? [1e3, 'ms'] : abs >= 1e-6 ? [1e6, 'µs'] : [1e9, 'ns']
  return `${fmtNumberFr(Number((s * k).toPrecision(4)))} ${u}`
}

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

/** Points du tracé d'une voie sur [t0, t1] (créneaux : un segment vertical par changement) */
export function tracePoints(a: readonly TraceChange[], t0: number, t1: number): string {
  if (!a.length || t1 <= t0) return ''
  const x = (t: number) => ((t - t0) / (t1 - t0)) * TRACE_W
  const y = (l: number) => (l ? TRACE_HIGH : TRACE_LOW)
  const i0 = lastBefore(a, t0)
  let level = i0 >= 0 ? a[i0].level : a[0].level
  const start = i0 >= 0 ? t0 : Math.max(t0, a[0].t)
  if (start > t1) return ''
  const pts = [`${x(start).toFixed(1)},${y(level)}`]
  for (let i = i0 + 1; i < a.length && a[i].t <= t1; i++) {
    const c = a[i]
    pts.push(`${x(c.t).toFixed(1)},${y(level)}`, `${x(c.t).toFixed(1)},${y(c.level)}`)
    level = c.level
  }
  pts.push(`${TRACE_W},${y(level)}`)
  return pts.join(' ')
}
