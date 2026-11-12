import { AU3, type RefKey } from '../data/reference'

/** Vrai dès qu'une des clés a la source « hypothese » : la question ou la valeur affiche « valeur non vérifiée » */
export const dependDHypothese = (cles: readonly RefKey[]): boolean => cles.some((k) => AU3[k].source === 'hypothese')

/** Clés « hypothese » parmi celles données (pour l'infobulle du badge) */
export const hypothesesDe = (cles: readonly RefKey[]): RefKey[] => cles.filter((k) => AU3[k].source === 'hypothese')

/**
 * Règle du badge (PRD §3.4) : « valeur non vérifiée » si la réponse dépend d'une hypothèse ET n'est validée
 * par aucun test contre une valeur du CR dans sa tolérance (`validee` : clés CR testées dans regles.test.ts).
 */
export const badgeAffiche = (cles: readonly RefKey[], validee: readonly RefKey[] = []): boolean => dependDHypothese(cles) && validee.length === 0

/** Liste des hypothèses de reference.au3.ts, en Markdown (section générée du README du module) */
export const listeHypotheses = (): string =>
  (Object.keys(AU3) as RefKey[])
    .filter((k) => AU3[k].source === 'hypothese')
    .map((k) => `- \`${k}\` = ${AU3[k].valeur}${AU3[k].unite ? ` ${AU3[k].unite}` : ''}${AU3[k].note ? ` — ${AU3[k].note}` : ''}`)
    .join('\n')
