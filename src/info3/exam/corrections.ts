/** Corrections de la feuille de fin d'examen (chargées à la remise seulement) : code de référence et explications. */
import type { Project } from '../project/project'
import type { Tp23QuestionId } from '../project/verify23'
import { partsOf } from '../tp/content23'
import { qcm34 } from '../tp1/content'
import { REFERENCE } from './exam'

// Un chunk par fichier : seul le code des questions du sujet est chargé (budget de la page à la remise)
const CR = import.meta.glob('../fixtures/cr/**/*.c', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>
const SOL = import.meta.glob('../solutions/**/*.c', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>

/** Code de référence d'un défi (solution du simulateur ou code du CR validé) */
export async function referenceCode(id: string): Promise<string> {
  const r = REFERENCE[id]
  const load = r && (r.from === 'cr' ? CR[`../fixtures/cr/${r.key}.c`] : SOL[`../solutions/${r.key}.c`])
  return load ? (await load()).replace(/\r\n/g, '\n') : ''
}

/** Explications des QCM associés au défi */
export function explanations(id: string, p: Project): string[] {
  if (id === 'tp1-3-4') return [qcm34().explanation]
  if (id.startsWith('tp1-')) return []
  return partsOf(id as Tp23QuestionId, p).flatMap((part) => (part.kind === 'qcm' ? [part.qcm.explanation] : []))
}
