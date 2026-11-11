/** Corrections de la feuille de fin d'examen (chargées à la remise seulement) : code de référence et explications. */
import { CR_FIXTURES } from '../fixtures'
import type { Project } from '../project/project'
import type { Tp23QuestionId } from '../project/verify23'
import { SOLUTIONS } from '../solutions'
import { partsOf } from '../tp/content23'
import { qcm34 } from '../tp1/content'
import { REFERENCE } from './exam'

/** Code de référence d'un défi (solution du simulateur ou code du CR validé) */
export function referenceCode(id: string): string {
  const r = REFERENCE[id]
  if (!r) return ''
  return (r.from === 'cr' ? CR_FIXTURES[r.key] : SOLUTIONS[r.key])?.replace(/\r\n/g, '\n') ?? ''
}

/** Explications des QCM associés au défi */
export function explanations(id: string, p: Project): string[] {
  if (id === 'tp1-3-4') return [qcm34().explanation]
  if (id.startsWith('tp1-')) return []
  return partsOf(id as Tp23QuestionId, p).flatMap((part) => (part.kind === 'qcm' ? [part.qcm.explanation] : []))
}
