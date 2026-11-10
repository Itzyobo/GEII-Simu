/**
 * Questions INFO3 et points de validation A1 à A10 (PRD §3.6). Réexporté par questions.ts.
 * Les intitulés ne sont jamais écrits ici : ils sont lus dans docs/info3/enonce.md par l'ancre (`id`).
 */

export type Info3QuestionKind = 'qcm' | 'config-qcm' | 'challenge' | 'challenge-numeric' | 'static' | 'order' | 'numeric' | 'checklist'

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
  /** Ancre d'un texte commun affiché au-dessus de l'intitulé (cahier des charges du TP1 §4) */
  contexte?: string
}

export const INFO3_QUESTIONS: Info3Question[] = [
  { id: 'tp1-3-1', tp: 1, numero: '3.1', kind: 'qcm', challenge: false, hyp: [] },
  { id: 'tp1-3-2', tp: 1, numero: '3.2', kind: 'config-qcm', challenge: false, hyp: ['H18'] },
  { id: 'tp1-3-3', tp: 1, numero: '3.3', kind: 'challenge', challenge: true, hyp: ['H1', 'H2'] },
  { id: 'tp1-3-4', tp: 1, numero: '3.4', kind: 'challenge-numeric', challenge: true, hyp: ['H23'] },
  { id: 'tp1-3-5', tp: 1, numero: '3.5', kind: 'challenge', challenge: true, hyp: ['H2'] },
  { id: 'tp1-3-6', tp: 1, numero: '3.6', kind: 'static', challenge: true, hyp: ['H2'] },
  { id: 'tp1-3-7', tp: 1, numero: '3.7', kind: 'static', challenge: true, hyp: [] },
  { id: 'tp1-4-1', contexte: 'tp1-4', tp: 1, numero: '4.1', kind: 'order', challenge: false, hyp: [] },
  { id: 'tp1-4-2', contexte: 'tp1-4', tp: 1, numero: '4.2', kind: 'challenge', challenge: true, hyp: ['H2'] },
  { id: 'tp1-4-3', contexte: 'tp1-4', tp: 1, numero: '4.3', kind: 'challenge', challenge: true, bonus: true, hyp: ['H2'] },
  { id: 'tp2-1-1', tp: 2, numero: '1.1', kind: 'challenge', challenge: true, hyp: ['H3', 'H34'] },
  { id: 'tp2-1-2', tp: 2, numero: '1.2', kind: 'order', challenge: false, hyp: ['H34'] },
  { id: 'tp2-2-1', tp: 2, numero: '2.1', kind: 'numeric', challenge: false, hyp: [] },
  { id: 'tp2-2-2', tp: 2, numero: '2.2', kind: 'challenge', challenge: true, hyp: ['H35'] },
  { id: 'tp2-2-3', tp: 2, numero: '2.3', kind: 'challenge', challenge: true, hyp: ['H9', 'H35'] },
  { id: 'tp2-2-4', tp: 2, numero: '2.4', kind: 'challenge', challenge: true, hyp: ['H9', 'H35'] },
  { id: 'tp3-1', tp: 3, numero: '1', kind: 'challenge', challenge: true, hyp: ['H28', 'H34'] },
  { id: 'tp3-2', tp: 3, numero: '2', kind: 'challenge', challenge: true, hyp: ['H31', 'H33'] },
  { id: 'tp3-3', tp: 3, numero: '3', kind: 'checklist', challenge: false, hyp: [] },
  { id: 'tp4-1', tp: 4, numero: '1', kind: 'challenge', challenge: true, hyp: ['H37', 'H39', 'H40'] },
  { id: 'tp4-2', tp: 4, numero: '2', kind: 'challenge', challenge: true, hyp: ['H14', 'H36'] },
  { id: 'tp4-3', tp: 4, numero: '3', kind: 'challenge', challenge: true, hyp: [] },
  { id: 'tp4-4', tp: 4, numero: '4', kind: 'challenge', challenge: true, hyp: ['H10'] },
  { id: 'tp4-5', tp: 4, numero: '5', kind: 'challenge', challenge: true, hyp: ['H9', 'H35'] },
  { id: 'tp4-6', tp: 4, numero: '6', kind: 'challenge', challenge: true, hyp: [] },
]

/**
 * Ancres de l'énoncé (TP livrés) qui ne sont pas des questions du simulateur, avec la raison.
 * Toute autre ancre « tpN-… » d'un TP livré doit être la clé d'une question (test de couverture).
 */
export const INFO3_ANCHORS_HORS_QUESTION: Record<string, string> = {
  'tp1-1': 'préparation du répertoire de travail du poste de TP : hors simulateur',
  'tp1-2': 'visionnage de la vidéo MPLAB X / MCC : hors simulateur',
  'tp1-4': 'cahier des charges commun aux questions 4.1 à 4.3 : affiché au-dessus de chacune (champ contexte)',
}

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