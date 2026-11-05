/** Corrigés (CR corrigé, diff minimal limité aux bugs) : tests du professeur virtuel et, plus tard, correction. */
const SOL = import.meta.glob('./**/*.c', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

/** Indexés par identifiant : tp1/q3_7, tp1/q4 */
export const SOLUTIONS: Record<string, string> = Object.fromEntries(Object.entries(SOL).map(([k, v]) => [k.replace('./', '').replace(/\.c$/, ''), v]))
