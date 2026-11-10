/**
 * Professeurs virtuels chargés à la demande dans le Worker (un chunk par TP) : le Worker de base ne contient
 * que le compilateur et la VM, chaque page TP + Worker reste dans le budget (PRD §5.1).
 */
import type { Verdict } from '../prof/tp1'
import type { RotarySlot } from '../vm/vm'
import type { OutMsg } from './protocol'

/** Banc : mikroBUS de la carte Rotary et de la carte 8x8 R click */
export interface GradeBench {
  rotary: RotarySlot | null
  matrix: RotarySlot | null
}

type Grader = (question: string, files: Record<string, string>, bench: GradeBench) => Verdict | null

/** Par TP : charge le module, renvoie null si la question n'est pas un défi de ce TP */
const LOADERS: Record<string, () => Promise<Grader>> = {
  '1': () => import('../prof/tp1').then((m) => (q, f) => ((m.TP1_CHALLENGES as readonly string[]).includes(q) ? m.gradeTp1(q as never, f) : null)),
  '2': () => import('../prof/tp23').then((m) => (q, f, b) => ((m.TP23_CHALLENGES as readonly string[]).includes(q) ? m.gradeTp23(q as never, f, b.rotary) : null)),
  '4': () => import('../prof/tp4').then((m) => (q, f, b) => ((m.TP4_CHALLENGES as readonly string[]).includes(q) ? m.gradeTp4(q as never, f, b.rotary) : null)),
  '5': () => import('../prof/tp5').then((m) => (q, f, b) => ((m.TP5_CHALLENGES as readonly string[]).includes(q) ? m.gradeTp5(q as never, f, b.rotary) : null)),
  '6': () => import('../prof/tp6').then((m) => (q, f, b) => ((m.TP6_CHALLENGES as readonly string[]).includes(q) ? m.gradeTp6(q as never, f, b.matrix) : null)),
}
LOADERS['3'] = LOADERS['2']

export async function gradeQuestion(question: string, files: Record<string, string>, bench: GradeBench): Promise<Extract<OutMsg, { type: 'graded' }>> {
  const load = LOADERS[/^tp(\d)-/.exec(question)?.[1] ?? '']
  const v = load ? (await load())(question, files, bench) : null
  return v ? { type: 'graded', question, ok: v.ok, messages: v.messages } : { type: 'graded', question, ok: false, messages: ['Question inconnue du professeur virtuel'] }
}
