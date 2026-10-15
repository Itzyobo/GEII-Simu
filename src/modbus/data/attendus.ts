/** PRD §1 : attendus du partiel sur le TP2 (notes de cours + questions de l'énoncé). */
export const ATTENDUS = [
  { id: 'message-code', text: 'Message codé', origine: 'notes partiel', couvertPar: '2.3 SERIE_3, générateur' },
  { id: 'debit', text: 'Débit', origine: 'notes partiel', couvertPar: '2.1, 2.2, générateur' },
  { id: 'parite', text: 'Bit de parité', origine: 'notes partiel', couvertPar: '2.1, 2.2, générateur' },
  { id: 'impedance', text: 'Impédance', origine: 'notes partiel', couvertPar: '3.1 haute impédance, quiz de cours (terminaison, polarisation)' },
  { id: 'longueur', text: 'Longueur de câble', origine: 'notes partiel', couvertPar: 'quiz de cours RS232 / RS485' },
  { id: 'autre', text: 'Autre chose', origine: 'notes partiel (non précisé)', couvertPar: 'Modbus : trame, CRC, exception' },
  { id: 'q2', text: 'Questions 2.1 à 2.4', origine: 'énoncé TP-10, TP-11', couvertPar: 'partie A' },
  { id: 'q31', text: 'Questions 3.1', origine: 'énoncé TP-13', couvertPar: 'partie B' },
  { id: 'q32', text: 'Questions 3.2 a à d', origine: 'énoncé TP-14, TP-15', couvertPar: 'partie C' },
] as const

export type AttenduId = (typeof ATTENDUS)[number]['id']
