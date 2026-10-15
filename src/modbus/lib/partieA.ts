/** Champs de réponse des questions 2.1 à 2.4 ; chaque réponse attendue est calculée par les modèles. */
import { REF, type Parity } from '../data/reference'
import { checkBits, checkDebit, checkExact, checkTension, PARITE_LABEL, parseParite, type Verdict } from '../models/answers'
import { realtermReceive, realtermText, serie1, serie2Format, serie3 } from '../models/serie'
import { formatFrame, uartFrame, type Liaison } from '../models/uart'
import type { State } from './store'

export interface Champ {
  key: string
  label: string
  /** Liste de choix ; sinon saisie libre */
  options?: string[]
  check: (v: string) => Verdict
}

const trame = (b: number) => formatFrame(uartFrame(b, serie1(b).liaison), serie1(b).liaison)
const bitAt = (b: number, i: number) => String(uartFrame(b, serie1(b).liaison)[i])
const S1 = serie1(0).liaison
const PARITES = Object.values(PARITE_LABEL)
const checkParite = (attendu: Parity) => (v: string) => {
  const ok = parseParite(v) === attendu
  return { ok, message: ok ? 'Juste.' : `Faux : ${PARITE_LABEL[attendu]}.` }
}
const checkBitsDonnees = (n: number) => (v: string) => checkExact(v, String(n))

/** Caractéristiques d'une liaison à retrouver (2.2, 2.3) */
const liaisonChamps = (l: Liaison): Champ[] => [
  { key: 'debit', label: 'Cadence de transfert (bauds)', check: (v) => checkDebit(v, l.baud, REF.scopeSerie1TimeDiv.value) },
  { key: 'bits', label: 'Bits de données', options: ['7', '8'], check: checkBitsDonnees(l.dataBits) },
  { key: 'parite', label: 'Parité', options: PARITES, check: checkParite(l.parity) },
]

/** Format de SERIE_2 de la session : le vrai s'il a été saisi, sinon le tirage (H3) ; null avant le premier tirage. */
export const serie2Liaison = (s: State): Liaison | null => s.serie2.reel ?? (s.serie2.graine === null ? null : serie2Format(s.serie2.graine))

export function champsPartieA(s: State): Record<string, Champ[] | null> {
  const s3 = serie3()
  const message = REF.serie3Message.value
  const l2 = serie2Liaison(s)
  const rt = { port: REF.realtermPort.value, ...s3.liaison }
  const erreursParitePaire = realtermReceive(s3, 'croisé', { ...rt, parity: 'even' }).filter((r) => r.parityError).length
  const rx9600 = realtermReceive(s3, 'croisé', { ...rt, baud: 9600 })
  const correct9600 = realtermText(rx9600) === message && !rx9600.some((r) => r.framingError || r.parityError)

  return {
    's21-ttl': [0x55, 0x00, 0x01].map((b) => ({
      key: b.toString(16),
      label: `Relevé de ${b.toString(16).toUpperCase().padStart(2, '0')}H (start · données · parité · stop)`,
      check: (v: string) => checkBits(v, trame(b)),
    })),
    's21-champs': [
      { key: 'start', label: 'Valeur du bit de start', options: ['0', '1'], check: (v) => checkExact(v, bitAt(0x55, 0)) },
      ...[0x55, 0x00, 0x01].map((b) => ({
        key: `parite-${b.toString(16)}`,
        label: `Bit de parité de ${b.toString(16).toUpperCase().padStart(2, '0')}H`,
        options: ['0', '1'],
        check: (v: string) => checkExact(v, bitAt(b, 1 + S1.dataBits)),
      })),
      { key: 'stop', label: 'Valeur du bit de stop', options: ['0', '1'], check: (v) => checkExact(v, bitAt(0x55, 2 + S1.dataBits)) },
    ],
    's21-debit': [{ key: 'debit', label: 'Débit (bauds) ou durée d’un bit', check: (v) => checkDebit(v, S1.baud, REF.scopeSerie1TimeDiv.value) }],
    's21-rs232': [
      { key: 'max', label: 'Niveau haut en RS232 (V)', check: (v) => checkTension(v, REF.rs232High.value) },
      { key: 'repos', label: 'Niveau au repos en RS232 (V)', check: (v) => checkTension(v, REF.rs232Low.value) },
      { key: 'polarite', label: 'Polarité par rapport au TTL', options: ['identique', 'inversée'], check: (v) => checkExact(v, 'inversée') },
    ],
    s22: l2 && liaisonChamps(l2),
    s23: [
      ...liaisonChamps(s3.liaison),
      {
        key: 'message',
        label: 'Message ASCII transmis',
        check: (v) => (v !== message && v.replace(/ /g, '') === message.replace(/ /g, '') ? { ok: false, message: 'Presque : il manque l’espace (20H).' } : checkExact(v, message, (x) => x)),
      },
    ],
    's24-transmission': [{ key: 'texte', label: 'Texte affiché par RealTerm (un message)', check: (v) => checkExact(v, message, (x) => x) }],
    's24-erreur': [
      { key: 'parite', label: 'RealTerm réglé en parité paire : erreurs de parité sur 6 caractères', check: (v) => checkExact(v, String(erreursParitePaire)) },
      { key: 'debit', label: 'RealTerm réglé à 9 600 bauds : la transmission est-elle correcte ?', options: ['oui', 'non'], check: (v) => checkExact(v, correct9600 ? 'oui' : 'non') },
    ],
  }
}
