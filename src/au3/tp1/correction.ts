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

/**
 * Correction en écart absolu (grandeur attendue proche de 0, ex. erreur statique en %) : |valeur − attendu| ≤ tolerance.
 */
export function corrigerAbsolu(saisie: string, attendu: number, unite: string, tolerance: number): Correction {
  const c = corriger(saisie, 1, unite, Infinity) // lecture et unité seulement : l'écart relatif n'a pas de sens près de 0
  if (c.verdict !== 'juste' || c.valeur === null) return c
  const juste = Math.abs(c.valeur - attendu) <= tolerance
  return { verdict: juste ? 'juste' : 'faux', valeur: c.valeur, ecart: null, message: juste ? 'Dans la tolérance.' : 'Hors tolérance.' }
}

export const EXPLICATION_TR5 =
  'Sur votre trace, un creux (ou une bosse) frôle la bande m(∞) ± 5 % : l’entrée dans la bande et le dernier franchissement donnent deux lectures. L’énoncé définit TR5% comme l’instant où la mesure atteint 0,95·m(∞) ou 1,05·m(∞) « sans jamais s’en éloigner de plus de 5 % ensuite » ; les deux lectures sont acceptées.'

/**
 * TR5% : si les lectures possibles sur la trace affichée (entrée dans la bande, dernier franchissement) diffèrent de
 * plus de TOL_MESURE, chacune est acceptée à ±TOL_MESURE ; sinon, correction habituelle contre la valeur du modèle.
 */
export function corrigerTr5(saisie: string, attendu: number, lectures?: readonly number[]): Correction {
  const [entree, dernier] = lectures ?? []
  if (entree === undefined || dernier === undefined || !(entree > 0) || Math.abs(dernier / entree - 1) <= au3('TOL_MESURE')) return corrigerMesure(saisie, attendu, 's')
  const a = corrigerMesure(saisie, entree, 's')
  const b = corrigerMesure(saisie, dernier, 's')
  const c = a.verdict === 'juste' ? a : b.verdict === 'juste' ? b : Math.abs(a.ecart ?? Infinity) <= Math.abs(b.ecart ?? Infinity) ? a : b
  return { ...c, message: `${c.message} ${EXPLICATION_TR5}` }
}

/** Valeurs acceptées pour un TR5% (pour l'affichage de la correction) */
export const valeursTr5 = (attendu: number, lectures?: readonly number[]): number[] => {
  const [entree, dernier] = lectures ?? []
  return entree !== undefined && dernier !== undefined && entree > 0 && Math.abs(dernier / entree - 1) > au3('TOL_MESURE') ? [entree, dernier] : [attendu]
}
