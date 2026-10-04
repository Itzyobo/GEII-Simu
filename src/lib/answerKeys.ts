/**
 * Clés de correction par TP, chargées à la demande à la remise d'un examen
 * (réponse attendue et explication de chaque question, même jamais affichée).
 */
import { isWiringLine, QUESTIONS, type TpSlug } from '../data/questions'
import { WIRING_EXPLANATION, type QuestionMeta } from './exam'

const LOADERS: Record<TpSlug, () => Promise<Record<string, QuestionMeta>>> = {
  'pas-a-pas': () => import('../pages/StepperQuestions').then((m) => m.answerKey()),
  'alim-decoupage': () => Promise.all([import('../pages/AlimPart1'), import('../pages/AlimPart2')]).then(([a, b]) => ({ ...a.answerKey(), ...b.answerKey() })),
  'machine-asynchrone': () => import('../pages/AsyncQuestions').then((m) => m.answerKey()),
}

/** Clé complète d'un TP : questions + lignes « Câblage ». */
export async function loadAnswerKey(slug: TpSlug): Promise<Record<string, QuestionMeta>> {
  const wiring = QUESTIONS[slug].filter((q) => isWiringLine(q.id)).map((q) => [q.id, { expected: 'validé au 1er essai', explanation: WIRING_EXPLANATION }])
  return { ...Object.fromEntries(wiring), ...(await LOADERS[slug]()) }
}
