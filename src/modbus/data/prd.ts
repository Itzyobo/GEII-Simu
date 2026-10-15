/** Lignes de la « Liste des hypothèses à vérifier » du PRD (§3), générées depuis reference.ts. */
import type { HYPOTHESES } from './reference'

export function listeHypotheses(h: typeof HYPOTHESES): string[] {
  return Object.entries(h)
    .sort(([a], [b]) => Number(a.slice(1)) - Number(b.slice(1)))
    .map(([k, { text }]) => `${k.slice(1)}. ${k} — ${text.replace(/’/g, "'").replace(/SERIE_/g, 'SERIE\\_')}`)
}
