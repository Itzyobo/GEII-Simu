/**
 * Fixtures INFO3 : fichiers MCC du TP1 écrits à la main (mcc-tp1/) et code des CR copié tel quel (cr/).
 * `project(cr, mcc)` assemble un projet MPLAB : main.c + mcc_generated_files/*.
 */
const MCC = import.meta.glob('./mcc-tp1/*.{c,h}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const CR = import.meta.glob('./cr/**/*.c', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

/** Dossier des fichiers générés par MCC dans un projet MPLAB X */
export const MCC_DIR = 'mcc_generated_files'

/** Fichiers MCC du TP1, indexés par chemin dans le projet (mcc_generated_files/mcc.h…) */
export const MCC_TP1: Record<string, string> = Object.fromEntries(Object.entries(MCC).map(([k, v]) => [`${MCC_DIR}/${k.split('/').pop()}`, v.replace(/\r\n/g, '\n')]))

/** Code des CR, indexé par identifiant (tp1/q3_3…) */
export const CR_FIXTURES: Record<string, string> = Object.fromEntries(Object.entries(CR).map(([k, v]) => [k.replace('./cr/', '').replace(/\.c$/, ''), v]))

const SOL = import.meta.glob('./solutions/**/*.c', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

/** Solutions de référence écrites pour le professeur virtuel (questions sans code dans le CR), par identifiant */
export const SOLUTIONS: Record<string, string> = Object.fromEntries(Object.entries(SOL).map(([k, v]) => [k.replace('./solutions/', '').replace(/\.c$/, ''), v.replace(/\r\n/g, '\n')]))

/** Projet complet : main.c d'abord, puis les fichiers MCC (sources .c compilées dans cet ordre) */
export function project(main: string, mcc: Record<string, string> = MCC_TP1): Record<string, string> {
  return { 'main.c': main, ...mcc }
}

export function crProject(id: string, mcc: Record<string, string> = MCC_TP1): Record<string, string> {
  const src = CR_FIXTURES[id]
  if (src === undefined) throw new Error(`fixture inconnue : ${id}`)
  return project(src, mcc)
}
