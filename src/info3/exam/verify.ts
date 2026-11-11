/**
 * « Faire vérifier » en examen. Avec MCC : la vérification de la page du TP (cartes, câbles, MCC).
 * Registres seuls : MCC n'existe pas, seuls les cartes et les câbles sont vérifiés (le reste est noté au comportement).
 */
import { INFO3 } from '../../data/reference'
import type { Project, SlotId } from '../project/project'
import { verifyTp1, type Tp1QuestionId } from '../project/verify'
import { rotaryErrors, verifyTp23, type Tp23QuestionId } from '../project/verify23'
import type { ExamVariant } from './exam'

const needsRotary = (id: string) => /^tp2-2-|^tp4-|^tp5-4$/.test(id)
const needsMatrix = (id: string) => id === 'tp6-3' || id === 'tp6-4'
const needsUsbWhite = (id: string) => /^tp5-|^tp6-(1|2|4)/.test(id)

/** Cartes et câbles seulement */
export function benchErrors(p: Project, id: string): string[] {
  const errors = needsRotary(id) ? rotaryErrors(p) : []
  if (needsMatrix(id)) {
    const card = INFO3.clickBoards.matrix8x8
    const slot = (Object.keys(p.bench.slots) as SlotId[]).find((s) => p.bench.slots[s] === 'matrix8x8')
    if (slot !== card.expectedSlot) errors.push(`Carte ${card.name} : à enficher sur le mikroBUS 1`)
  }
  if (needsUsbWhite(id) && !p.bench.usbWhite) errors.push('USB blanc débranché')
  return errors
}

export function examVerify(p: Project, id: string, variant: ExamVariant): string[] {
  if (variant === 'registres') return benchErrors(p, id)
  return id.startsWith('tp1-') ? verifyTp1(p, id as Tp1QuestionId) : verifyTp23(p, id as Tp23QuestionId)
}
