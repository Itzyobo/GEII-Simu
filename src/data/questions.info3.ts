/**
 * Questions INFO3 et points de validation A1 à A10 (PRD §3.6). Réexporté par questions.ts.
 * Les intitulés ne sont jamais écrits ici : ils sont lus dans docs/info3/enonce.md par l'ancre (`id`).
 * `resume` reprend le résumé du PRD (§2), affiché seulement tant que l'énoncé n'est pas transcrit.
 */

export type Info3QuestionKind = 'qcm' | 'config-qcm' | 'challenge' | 'challenge-numeric' | 'static' | 'order'

export interface Info3Question {
  /** Ancre de l'énoncé (clé) */
  id: string
  tp: number
  /** Numéro de la question dans l'énoncé */
  numero: string
  kind: Info3QuestionKind
  /** Défi de code noté par le professeur virtuel */
  challenge: boolean
  bonus?: boolean
  /** Hypothèses dont dépend la réponse (badge « valeur non vérifiée ») */
  hyp: string[]
  /** Résumé PRD §2, de secours quand l'intitulé est absent de l'énoncé */
  resume: string
}

export const INFO3_QUESTIONS: Info3Question[] = [
  { id: 'tp1-3-1', tp: 1, numero: '3.1', kind: 'qcm', challenge: false, hyp: [], resume: 'broche de D2' },
  { id: 'tp1-3-2', tp: 1, numero: '3.2', kind: 'config-qcm', challenge: false, hyp: ['H18'], resume: 'configuration et analyse de pin_manager.h/.c' },
  { id: 'tp1-3-3', tp: 1, numero: '3.3', kind: 'challenge', challenge: true, hyp: ['H1', 'H2'], resume: 'clignotement 500 ms' },
  { id: 'tp1-3-4', tp: 1, numero: '3.4', kind: 'challenge-numeric', challenge: true, hyp: ['H23'], resume: 'D2 suit S1, justification ANSELx et TRISx' },
  { id: 'tp1-3-5', tp: 1, numero: '3.5', kind: 'challenge', challenge: true, hyp: ['H2'], resume: 'chenillard 4 bits (« Faire valider »)' },
  { id: 'tp1-3-6', tp: 1, numero: '3.6', kind: 'static', challenge: true, hyp: ['H2'], resume: 'chenillard bidirectionnel' },
  { id: 'tp1-3-7', tp: 1, numero: '3.7', kind: 'static', challenge: true, hyp: [], resume: 'pointeurs, variable locale Motif' },
  { id: 'tp1-4-1', tp: 1, numero: '4.1', kind: 'order', challenge: false, hyp: [], resume: 'architecture du programme' },
  { id: 'tp1-4-2', tp: 1, numero: '4.2', kind: 'challenge', challenge: true, hyp: ['H2'], resume: 'code du cahier des charges' },
  { id: 'tp1-4-3', tp: 1, numero: '4.3', kind: 'challenge', challenge: true, bonus: true, hyp: ['H2'], resume: 'clignotements bonus (« Faire valider »)' },
]

export interface ValidationPoint {
  id: string
  point: string
  /** Questions qui le couvrent (ancres), y compris celles des TP pas encore livrés */
  questions: string[]
  /** A4 : couvert par tous les défis de code disponibles */
  allChallenges?: boolean
}

/** Points de validation (PRD §3.6), à la place des attendus officiels */
export const INFO3_VALIDATION: ValidationPoint[] = [
  { id: 'A1', point: 'TP1 3.5 « Faire valider par l’enseignant »', questions: ['tp1-3-5'] },
  { id: 'A2', point: 'TP1 §4.3 « Faire valider par l’enseignant »', questions: ['tp1-4-1', 'tp1-4-2', 'tp1-4-3'] },
  { id: 'A3', point: 'TP5 §4 « Faire vérifier le bon fonctionnement de l’ensemble »', questions: ['tp5-4'] },
  { id: 'A4', point: 'CR : code archivé et commenté', questions: [], allChallenges: true },
  { id: 'A5', point: 'CR : captures MCC commentées', questions: ['tp3-1', 'tp3-2', 'tp4-1', 'tp5-1', 'tp6-1'] },
  { id: 'A6', point: 'CR : registres de configuration générés', questions: ['tp1-3-2', 'tp1-3-4', 'tp3-1', 'tp4-1'] },
  { id: 'A7', point: 'CR : fonctions générées', questions: ['tp2-1-2', 'tp4-2', 'tp6-2'] },
  { id: 'A8', point: 'CR : tests effectués et leur issue', questions: ['tp2-1-1', 'tp3-2', 'tp4-1', 'tp6-1-1'] },
  { id: 'A9', point: 'Séance : structure du programme', questions: ['tp1-4-1', 'tp5-3'] },
  { id: 'A10', point: 'Séance : chronogrammes archivés', questions: ['tp2-2-2', 'tp2-2-3', 'tp3-2', 'tp4-1'] },
]

export type CoverageState = 'covered' | 'partial' | 'none'

/**
 * Couverture d'un point : questions disponibles parmi celles qui le couvrent.
 * covered = toutes disponibles ; partial = certaines (TP suivants à venir) ; none = aucune (ligne en rouge).
 */
export function coverage(v: ValidationPoint, available: Info3Question[] = INFO3_QUESTIONS): { linked: string[]; available: string[]; state: CoverageState } {
  const ids = new Set(available.map((q) => q.id))
  const linked = v.allChallenges ? available.filter((q) => q.challenge).map((q) => q.id) : v.questions
  const avail = linked.filter((id) => ids.has(id))
  const state: CoverageState = avail.length === 0 ? 'none' : avail.length === linked.length ? 'covered' : 'partial'
  return { linked, available: avail, state }
}