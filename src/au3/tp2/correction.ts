import { au3 } from '../../data/reference'
import { corriger, type Correction } from '../tp1/correction'

export const CONSEIL_FORMULE = 'Conseil : la formule est plus précise qu’une lecture d’abaque.'

/**
 * zb à K = 40 (I.2.1 Q8) : l'énoncé autorise « la formule … ou l'abaque » : tolérance d'une lecture d'abaque (±10 %).
 * Hors ±5 % (précision de la formule) mais dans ±10 %, la réponse est acceptée avec le conseil CONSEIL_FORMULE.
 */
export function corrigerFormule(saisie: string, attendu: number): Correction {
  const c = corriger(saisie, attendu, '', au3('TOL_ABAQUE'))
  return c.verdict === 'juste' && c.ecart !== null && Math.abs(c.ecart) > au3('TOL_MESURE') ? { ...c, message: `${c.message} ${CONSEIL_FORMULE}` } : c
}
