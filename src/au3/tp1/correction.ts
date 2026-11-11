import { au3 } from '../../data/reference'
import { MISE_EN_PAGE } from '../miseEnPage'

/**
 * Correction d'une réponse numérique de l'étudiant (PRD §4.3) : tolérance relative ±5 % (mesure) ou ±10 %
 * (lecture d'abaque) autour de la réponse attendue calculée par le modèle. Une grandeur qui a une unité et
 * que l'étudiant donne sans unité est « incomplète » (pas fausse).
 */
export type Verdict = 'juste' | 'faux' | 'incomplete' | 'illisible'

export interface Correction {
  verdict: Verdict
  /** Valeur lue, convertie dans l'unité attendue */
  valeur: number | null
  ecart: number | null
  message: string
}

/** Préfixes acceptés à la saisie (u = µ) */
const PREFIXES = [...MISE_EN_PAGE.prefixes, { facteur: MISE_EN_PAGE.prefixes[2].facteur, symbole: 'u' }]

/** « 11,8 ms » → { nombre: 11.8, unite: 'ms' } ; null si ce n'est pas un nombre suivi d'une unité */
export function lireSaisie(saisie: string): { nombre: number; unite: string } | null {
  const m = /^\s*([+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][+-]?\d+)?)\s*([^\d\s].*?)?\s*$/.exec(saisie)
  if (!m) return null
  const nombre = Number(m[1]!.replace(',', '.'))
  return Number.isFinite(nombre) ? { nombre, unite: (m[2] ?? '').replace(/\s+/g, '') } : null
}

/** Convertit vers l'unité de base `unite` (s, V, rad/s…) ; null si l'unité saisie ne correspond pas */
export function convertir(nombre: number, uniteSaisie: string, unite: string): number | null {
  if (uniteSaisie === unite) return nombre
  const p = PREFIXES.find((x) => x.symbole && uniteSaisie === x.symbole + unite)
  return p ? nombre * p.facteur : null
}

export function corriger(saisie: string, attendu: number, unite: string, tolerance: number): Correction {
  const lu = lireSaisie(saisie)
  if (!lu) return { verdict: 'illisible', valeur: null, ecart: null, message: 'Réponse illisible : écrivez un nombre suivi de son unité.' }
  if (unite && !lu.unite) return { verdict: 'incomplete', valeur: lu.nombre, ecart: null, message: `Réponse incomplète : unité manquante (${unite}).` }
  const valeur = unite ? convertir(lu.nombre, lu.unite, unite) : lu.unite ? null : lu.nombre
  if (valeur === null) return { verdict: 'faux', valeur: null, ecart: null, message: unite ? `Unité « ${lu.unite} » incorrecte : attendu ${unite}.` : `Grandeur sans unité : « ${lu.unite} » en trop.` }
  const ecart = valeur / attendu - 1
  const juste = Math.abs(ecart) <= tolerance
  return { verdict: juste ? 'juste' : 'faux', valeur, ecart, message: juste ? 'Dans la tolérance.' : 'Hors tolérance.' }
}

export const corrigerMesure = (saisie: string, attendu: number, unite: string) => corriger(saisie, attendu, unite, au3('TOL_MESURE'))
export const corrigerAbaque = (saisie: string, attendu: number, unite: string) => corriger(saisie, attendu, unite, au3('TOL_ABAQUE'))
