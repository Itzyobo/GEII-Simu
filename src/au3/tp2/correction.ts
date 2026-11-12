import { au3 } from '../../data/reference'
import { corriger, type Correction } from '../tp1/correction'

export const MESSAGE_FORMULE = 'Lecture d’abaque refusée : la formule est plus précise.'

/**
 * zb à K = 40 (I.2.1 Q8) : la formule du dépassement est exigée, tolérance d'une mesure (±5 %). Une valeur
 * dans la tolérance d'une lecture d'abaque (±10 %) mais hors ±5 % est refusée avec MESSAGE_FORMULE.
 */
export function corrigerFormule(saisie: string, attendu: number): Correction {
  const c = corriger(saisie, attendu, '', au3('TOL_MESURE'))
  return c.verdict === 'faux' && c.ecart !== null && Math.abs(c.ecart) <= au3('TOL_ABAQUE') ? { ...c, message: MESSAGE_FORMULE } : c
}
