import { MISE_EN_PAGE } from '../miseEnPage'

const C = MISE_EN_PAGE.cable

export interface Point {
  x: number
  y: number
}
export interface Rect {
  left: number
  top: number
  right: number
  bottom: number
}

const lerp = (p: Point, q: Point, t: number): Point => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t })

/** Points d'une Bézier cubique a → b de points de contrôle (a.x, ya) et (b.x, yb), par De Casteljau */
function echantillons(a: Point, b: Point, ya: number, yb: number): Point[] {
  const c1 = { x: a.x, y: ya }
  const c2 = { x: b.x, y: yb }
  return Array.from({ length: C.echantillons + 1 }, (_, i) => {
    const t = i / C.echantillons
    const [p, q, r] = [lerp(a, c1, t), lerp(c1, c2, t), lerp(c2, b, t)]
    return lerp(lerp(p, q, t), lerp(q, r, t), t)
  })
}

const dedans = (p: Point, r: Rect) => p.x > r.left - C.marge && p.x < r.right + C.marge && p.y > r.top - C.marge && p.y < r.bottom + C.marge
const traverse = (pts: Point[], zones: readonly Rect[]) => pts.some((p) => zones.some((r) => dedans(p, r)))
const d = (a: Point, b: Point, ya: number, yb: number) => `M ${a.x} ${a.y} C ${a.x} ${ya} ${b.x} ${yb} ${b.x} ${b.y}`

/**
 * Câble souple entre deux bornes, qui pend sous son poids. S'il traverse une zone d'exclusion (panneau de
 * commandes de l'oscilloscope), on cherche une courbe qui passe au-dessus ou au-dessous, de plus en plus loin.
 * Sans solution (GBF au-dessus de l’écran → voie 1 en dessous), la courbe d’origine est gardée : elle passe
 * alors sous l’écran ou le panneau, placés au-dessus des câbles (ordre d’empilement).
 */
export function cheminCable(a: Point, b: Point, zones: readonly Rect[] = []): string {
  const ya = a.y + C.affaissement
  const yb = b.y + C.affaissement
  if (!traverse(echantillons(a, b, ya, yb), zones)) return d(a, b, ya, yb)
  for (let k = 1; k <= C.essaisContour; k++) {
    const dessous = Math.max(a.y, b.y) + k * C.pasContour
    if (!traverse(echantillons(a, b, dessous, dessous), zones)) return d(a, b, dessous, dessous)
    const dessus = Math.min(a.y, b.y) - k * C.pasContour
    if (!traverse(echantillons(a, b, dessus, dessus), zones)) return d(a, b, dessus, dessus)
  }
  return d(a, b, ya, yb)
}

/** Vrai si le chemin calculé évite toutes les zones (pour les tests) */
export function eviteZones(a: Point, b: Point, zones: readonly Rect[]): boolean {
  const m = /C \S+ (\S+) \S+ (\S+)/.exec(cheminCable(a, b, zones))
  return !!m && !traverse(echantillons(a, b, Number(m[1]), Number(m[2])), zones)
}
