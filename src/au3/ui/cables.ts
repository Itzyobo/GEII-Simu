import { MISE_EN_PAGE } from '../miseEnPage'
import { DEGRES_PAR_TOUR } from '../unites'

const C = MISE_EN_PAGE.cable
const DEMI_TOUR = DEGRES_PAR_TOUR / 2

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

/**
 * Fiche n° k empilée sur une borne de centre `centre` : hors du disque de la borne (elle n'intercepte jamais le clic
 * destiné à la borne), en éventail depuis le bas : k = 0 en bas, puis alternativement à droite et à gauche.
 */
export function positionFiche(centre: Point, k: number): Point {
  const cote = k % 2 === 1 ? 1 : -1
  const a = (cote * Math.ceil(k / 2) * C.pasAngleFiche * Math.PI) / DEMI_TOUR
  return { x: centre.x + C.rayonFiche * Math.sin(a), y: centre.y + C.rayonFiche * Math.cos(a) }
}

/** Fiches de chaque extrémité : rang de chaque câble parmi ceux de sa borne, dans l'ordre du câblage */
export function rangsFiches(cablage: readonly { id: string; a: string; b: string }[]): Map<string, { a: number; b: number }> {
  const parBorne = new Map<string, number>()
  const rang = (borne: string) => {
    const k = parBorne.get(borne) ?? 0
    parBorne.set(borne, k + 1)
    return k
  }
  return new Map(cablage.map((c) => [c.id, { a: rang(c.a), b: rang(c.b) }]))
}

/** Vrai si le chemin calculé évite toutes les zones (pour les tests) */
export function eviteZones(a: Point, b: Point, zones: readonly Rect[]): boolean {
  const m = /C \S+ (\S+) \S+ (\S+)/.exec(cheminCable(a, b, zones))
  return !!m && !traverse(echantillons(a, b, Number(m[1]), Number(m[2])), zones)
}
