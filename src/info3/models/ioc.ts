/**
 * Interruption sur changement d'état (IOC, PRD §4.3) : détection de front par broche selon IOCxP (montant)
 * et IOCxN (descendant), sur l'entrée numérique (rien si la broche est en analogique, ANSEL = 1).
 * Les drapeaux IOCxF levés sont ajoutés aux existants ; IOCIF = OU de tous les IOCxF.
 * Pas d'IOC sur le port D. Fonctions pures, testées sans VM.
 */
import { INFO3 } from '../../data/reference'

const BYTE_MASK = (1 << INFO3.c.bitsPerByte) - 1

/** Bits de IOCxF à lever pour le passage des niveaux `prev` → `next` d'un port */
export function iocEdges(prev: number, next: number, pos: number, neg: number, analog: number): number {
  const rising = ~prev & next
  const falling = prev & ~next
  return ((rising & pos) | (falling & neg)) & ~analog & BYTE_MASK
}

/** IOCIF : 1 si au moins un IOCxF est à 1 */
export const iocSummary = (flags: number[]) => (flags.some((f) => (f & BYTE_MASK) !== 0) ? 1 : 0)

/** Le port dispose-t-il de l'IOC ? */
export const hasIoc = (port: string) => (INFO3.interrupts.iocPorts as readonly string[]).includes(port)
