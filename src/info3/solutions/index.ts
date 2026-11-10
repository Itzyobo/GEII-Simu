/** Corrigés (CR corrigé, diff minimal limité aux bugs) : tests du professeur virtuel et, plus tard, correction. */
const SOL = import.meta.glob('./**/*.{c,h}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

/** Indexés par identifiant : tp1/q3_7, tp1/q4 (fichiers .c) ; tp6/LED8x8.h (en-têtes, extension gardée). Fins de ligne CRLF → LF (dépôt extrait sous Windows), comme les gabarits MCC */
export const SOLUTIONS: Record<string, string> = Object.fromEntries(Object.entries(SOL).map(([k, v]) => [k.replace('./', '').replace(/\.c$/, ''), v.replace(/\r\n/g, '\n')]))
