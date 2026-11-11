import { AU3, type RefKey } from '../data/reference'

/** Vrai dès qu'une des clés a la source « hypothese » : la question ou la valeur affiche « valeur non vérifiée » */
export const dependDHypothese = (cles: readonly RefKey[]): boolean => cles.some((k) => AU3[k].source === 'hypothese')

/** Clés « hypothese » parmi celles données (pour l'infobulle du badge) */
export const hypothesesDe = (cles: readonly RefKey[]): RefKey[] => cles.filter((k) => AU3[k].source === 'hypothese')
