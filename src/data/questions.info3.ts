/**
 * Questions INFO3 et points de validation A1 à A10 (PRD §3.6). Réexporté par questions.ts.
 * Les intitulés ne sont jamais écrits ici : ils sont lus dans docs/info3/enonce.md par l'ancre (`id`).
 * `resume` reprend le résumé du PRD (§2), affiché seulement tant que l'énoncé n'est pas transcrit.
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
  { id: 'tp2-1-1', tp: 2, numero: '1.1', kind: 'challenge', challenge: true, hyp: ['H3', 'H34'], resume: 'compteur 4 bits sur IOC (S1 +1, S2 −1), ligne à décommenter, rebonds' },
  { id: 'tp2-1-2', tp: 2, numero: '1.2', kind: 'order', challenge: false, hyp: ['H34'], resume: 'fonctions générées : PEIE inutile, chaîne d’appel jusqu’au handler' },
  { id: 'tp2-2-1', tp: 2, numero: '2.1', kind: 'numeric', challenge: false, hyp: [], resume: 'codeur EC12D : crans et impulsions par tour' },
  { id: 'tp2-2-2', tp: 2, numero: '2.2', kind: 'challenge', challenge: true, hyp: ['H35'], resume: 'ENCA et ENCB sur D3 et D2, positions stables (chronogramme)' },
  { id: 'tp2-2-3', tp: 2, numero: '2.3', kind: 'challenge', challenge: true, hyp: ['H9', 'H35'], resume: 'sens de rotation sur D3 (IOC sur ENCB, chronogramme)' },
  { id: 'tp2-2-4', tp: 2, numero: '2.4', kind: 'challenge', challenge: true, hyp: ['H9', 'H35'], resume: 'compteur 4 bits piloté par le codeur' },
  { id: 'tp3-1', tp: 3, numero: '1', kind: 'challenge', challenge: true, hyp: ['H28', 'H34'], resume: 'Timer2 : clignotement de période 1 s, registres de tmr2.c' },
  { id: 'tp3-2', tp: 3, numero: '2', kind: 'challenge', challenge: true, hyp: ['H31', 'H33'], resume: 'anti-rebond de S2 par Timer2 monostable (10 ms), chronogramme' },
  { id: 'tp3-3', tp: 3, numero: '3', kind: 'checklist', challenge: false, hyp: [], resume: 'débogage : points d’arrêt dans les ISR IOC et Timer2' },
  { id: 'tp4-1', tp: 4, numero: '1', kind: 'challenge', challenge: true, hyp: ['H37', 'H39', 'H40'], resume: 'MSSP1 en SPI : octet 0b00110001 toutes les 100 ms en mode 3, SCK et MOSI à l’oscilloscope' },
  { id: 'tp4-2', tp: 4, numero: '2', kind: 'challenge', challenge: true, hyp: ['H14', 'H36'], resume: 'motif 00110001 sur les LED 1 à 8 de l’anneau ; quel mode SPI ; WriteByte ou ExchangeByte' },
  { id: 'tp4-3', tp: 4, numero: '3', kind: 'challenge', challenge: true, hyp: [], resume: 'fonctions led_ring_clear et led_ring_display16' },
  { id: 'tp4-4', tp: 4, numero: '4', kind: 'challenge', challenge: true, hyp: ['H10'], resume: 'chenillard d’une LED sur l’anneau, 1 s par pas' },
  { id: 'tp4-5', tp: 4, numero: '5', kind: 'challenge', challenge: true, hyp: ['H9', 'H35'], resume: 'l’anneau suit le codeur, compteur 4 bits sur D5 à D2' },
  { id: 'tp4-6', tp: 4, numero: '6', kind: 'challenge', challenge: true, hyp: [], resume: 'animations : 0xF0F0 qui tourne, puis une animation libre après un appui sur S1' },
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