/** Programmes SERIE_1, SERIE_2, SERIE_3 du TP (2.1 à 2.3) et réception RealTerm (2.4), en fonctions pures. */
import { REF, type Parity } from '../data/reference'
import { mulberry32 } from './scope'
import { messageWave, uartDecode, type Level, type Liaison, type Received, type Waveform } from './uart'

/** Ce qu'émet un programme : caractères consécutifs puis repos, répétés avec la période `period` (s). */
export interface Programme {
  liaison: Liaison
  bytes: number[]
  period: number
}

export const programmeWave = (p: Programme, level: Level): Waveform => messageWave(p.bytes, p.liaison, level, p.period)

/** SERIE_1 : 8 bits, parité impaire, 1 stop (H1), 2 400 bauds ; l'octet saisi, répété (H22). */
export const serie1 = (octet: number): Programme => ({
  liaison: { baud: REF.serie1Baud.value, dataBits: REF.serie1DataBits.value, parity: REF.serie1Parity.value, stopBits: REF.serie1StopBits.value },
  bytes: [octet],
  period: REF.serie1Repetition.value,
})

/** Format de SERIE_2 tiré au sort parmi les candidats (H3), fixé par la graine de la session. */
export function serie2Format(graine: number): Liaison {
  const rnd = mulberry32(graine)
  const { bauds, dataBits, parities, stopBits } = REF.serie2Candidats.value
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]!
  return { baud: pick(bauds), dataBits: pick(dataBits), parity: pick(parities), stopBits }
}

/** SERIE_2 : octet saisi (H28) dans le format de la session, ou le vrai format s'il a été saisi dans Réglages. */
export function serie2(graine: number, octet: number, reel: Liaison | null = null): Programme {
  const liaison = reel ?? serie2Format(graine)
  // En 7 bits, le 8e bit de l'octet saisi n'est pas émis
  return { liaison, bytes: [octet & ((1 << liaison.dataBits) - 1)], period: REF.serie1Repetition.value }
}

/** SERIE_3 : « lyon 1 » en 7O1 (stop H4) à 4 800 bauds, caractères consécutifs, période 111 ms (CR). */
export const serie3 = (): Programme => ({
  liaison: { baud: REF.serie3Baud.value, dataBits: REF.serie3DataBits.value, parity: REF.serie3Parity.value, stopBits: REF.serie3StopBits.value },
  bytes: [...REF.serie3Message.value].map((c) => c.charCodeAt(0)),
  period: REF.serie3Repetition.value,
})

/* ───────────── RealTerm (2.4) ───────────── */

export type CableSerie = 'droit' | 'croisé'

export interface RealtermSettings {
  port: string
  baud: number
  dataBits: 7 | 8
  parity: Parity
  stopBits: 1 | 2
}

export const realtermDefaut = (): RealtermSettings => ({ port: REF.realtermPort.value, ...REF.realtermReglagesDefaut.value })

/**
 * Caractères reçus par RealTerm sur le PC n°2 pendant `repeats` périodes du programme du PC n°1.
 * Rien sans émission, sans câble, avec un câble droit (TXD relié à TXD, RXD reste au repos) ou sur un autre port.
 */
export function realtermReceive(p: Programme | null, cable: CableSerie | null, rt: RealtermSettings, repeats = 1): Received[] {
  if (!p || cable !== 'croisé' || rt.port !== REF.realtermPort.value) return []
  return uartDecode(programmeWave(p, 'TTL'), rt, { repeats })
}

/** Texte affiché par RealTerm : ASCII imprimable tel quel, le reste en [HH]. */
export const realtermText = (rx: readonly Received[]) =>
  rx.map(({ byte }) => (byte >= 0x20 && byte < 0x7f ? String.fromCharCode(byte) : `[${byte.toString(16).toUpperCase().padStart(2, '0')}]`)).join('')
