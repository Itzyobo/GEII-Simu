/** Mode examen : réponses enregistrées sans verdict, pénalités, barème sur 20. */
import { createContext, useContext } from 'react'

export interface ExamAnswer {
  id: string
  /** Réponse donnée (texte affiché) */
  given: string
  /** Réponse attendue (texte affiché) */
  expected: string
  /** Écart relatif lisible, s'il a un sens */
  gap?: string
  /** 0…1 (1 = juste ; fraction pour un tableau) */
  score: number
  explanation: string
  /** Lignes « Câblage » : nombre de vérifications effectuées */
  attempts?: number
}

export type PenaltyKind = 'check' | 'live'
export interface Penalty {
  kind: PenaltyKind
  what: string
}

/** Réponse attendue et explication, connues dès que la question est affichée (pour les non-répondues). */
export interface QuestionMeta {
  expected: string
  explanation: string
}

/** Réponse attendue d'une question (mêmes champs que les props de QuestionCard). */
export type AnswerSpec =
  | { kind?: 'numerique'; expected: number; unit: string; tolerance?: number; explanation: string }
  | { kind: 'choix'; choices: readonly string[]; correct: number; explanation: string }

const fr4 = (x: number) => String(Number(x.toPrecision(4))).replace('.', ',')

/** Texte de la réponse attendue (affiché au corrigé et dans les résultats d'examen). */
export const expectedTextOf = (s: AnswerSpec) => (s.kind === 'choix' ? s.choices[s.correct] : `${fr4(s.expected)} ${s.unit}`.trim())

export const metaOf = (s: AnswerSpec): QuestionMeta => ({ expected: expectedTextOf(s), explanation: s.explanation })

/** Clé de correction d'une feuille de calcul notée (tableau). */
export const tableMeta = (explanation: string): QuestionMeta => ({ expected: 'toutes les cases justes', explanation })

export interface ExamApi {
  active: boolean
  record: (a: ExamAnswer) => void
  answerOf: (id: string) => ExamAnswer | undefined
  register: (id: string, meta: QuestionMeta) => void
  penalize: (kind: PenaltyKind, what: string) => void
}

export const ExamContext = createContext<ExamApi>({
  active: false,
  record: () => {},
  answerOf: () => undefined,
  register: () => {},
  penalize: () => {},
})

export const useExam = () => useContext(ExamContext)

/** Pénalités : −0,5 par vérification de câblage échouée (au plus −3), −1 par modification tentée sous tension. */
export function penaltyPoints(penalties: Penalty[]): number {
  const checks = penalties.filter((p) => p.kind === 'check').length
  const live = penalties.filter((p) => p.kind === 'live').length
  return Math.min(3, 0.5 * checks) + live
}

/** Note sur 20 : répartition égale entre les questions du TP, pénalités déduites, plancher à 0. */
export function examNote(questionIds: string[], answers: Record<string, ExamAnswer>, penalties: Penalty[]) {
  const per = 20 / questionIds.length
  const raw = questionIds.reduce((s, id) => s + per * Math.min(1, Math.max(0, answers[id]?.score ?? 0)), 0)
  const minus = penaltyPoints(penalties)
  return { raw, minus, note: Math.max(0, raw - minus), per }
}

/** Ligne « Câblage » : 1 si « Faire vérifier » valide au premier essai, ½ au deuxième, 0 ensuite. */
export const wiringScore = (attempt: number) => (attempt <= 1 ? 1 : attempt === 2 ? 0.5 : 0)

export const WIRING_EXPLANATION = 'Câblage noté sur la vérification : la question entière si « Faire vérifier » valide au premier essai, la moitié au deuxième, 0 ensuite (les pénalités de câblage s’ajoutent).'

/**
 * Réponse enregistrée pour une ligne « Câblage » après une vérification.
 * Une fois validé, le score est figé : une vérification ultérieure (après modification) ne le change plus.
 */
export function wiringAnswer(id: string, previous: ExamAnswer | undefined, ok: boolean): ExamAnswer | null {
  if (previous && previous.score > 0) return null
  const attempt = (previous?.attempts ?? 0) + 1
  return {
    id,
    attempts: attempt,
    given: ok ? `validé au ${attempt === 1 ? '1er' : `${attempt}e`} essai` : `${attempt} essai${attempt > 1 ? 's' : ''} refusé${attempt > 1 ? 's' : ''}`,
    expected: 'validé au 1er essai',
    score: ok ? wiringScore(attempt) : 0,
    explanation: WIRING_EXPLANATION,
  }
}
