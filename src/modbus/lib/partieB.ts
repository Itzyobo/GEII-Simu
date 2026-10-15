/** Champs de réponse des questions 3.1 ; chaque réponse attendue est calculée par les modèles du bus. */
import { REF } from '../data/reference'
import { checkExact, checkValeur, type Verdict } from '../models/answers'
import { busSimulate, busZones, frameDuration, parcoursComplet, parcoursRequest, rs485Lines, type BusFrame } from '../models/bus'
import { toHex } from '../models/crc'
import { PUPITRE } from '../models/slaves'
import type { Waveform } from '../models/uart'
import type { Champ } from './partieA'

const I = REF.parcoursIntervalle.value
const N = REF.parcoursAdresses.value

/** Parcours complet d'un seul maître branché, sans trame mémorisée : la référence de la correction. */
const PARCOURS: BusFrame[] = busSimulate([{ card: 'c1', connected: true, parcours: parcoursComplet(0), memorized: [], memStart: 0 }], 0, N * I)
const REPONSES = PARCOURS.filter((f) => f.type === 'ESCLAVE' && f.crcOk)
const DETECTES = REPONSES.map((f) => f.bytes[0]!)
const EXCEPTION = REPONSES[0]!.bytes

const hexNorm = (s: string) => s.replace(/0x/gi, '').replace(/h\b/gi, '').replace(/[^0-9a-f]/gi, '').toUpperCase().replace(/^0+(?=.)/, '')
const checkHex = (v: string, attendu: number) => checkExact(v, `${h2(attendu)}H`, hexNorm)
const h2 = (b: number) => b.toString(16).toUpperCase().padStart(2, '0')

/** Affirmations à cocher : la réponse est la suite des cases cochées, « 1 » ou « 0 » par affirmation. */
export interface Affirmation {
  texte: string
  vrai: boolean
}
const checkAffirmations = (items: Affirmation[]) => (v: string): Verdict => {
  const fausses = items.map((a, k) => ((v[k] === '1') === a.vrai ? null : k + 1)).filter((k) => k !== null)
  if (fausses.length === 0) return { ok: true, message: 'Juste.' }
  return { ok: false, message: `À revoir : affirmation${fausses.length > 1 ? 's' : ''} ${fausses.join(', ')}. Vraies : ${items.flatMap((a, k) => (a.vrai ? [k + 1] : [])).join(', ')}.` }
}

const CONSTATS: Affirmation[] = [
  { texte: 'TX+ et TX− varient en opposition : quand l’un monte, l’autre descend.', vrai: true },
  { texte: 'L’amplitude de la tension différentielle est le double de celle d’une voie.', vrai: true },
  { texte: 'La tension différentielle est nulle pendant l’émission d’une trame.', vrai: false },
  { texte: 'En haute impédance, les deux fils sont au même potentiel : la tension différentielle est nulle.', vrai: true },
  { texte: 'Le signal Math reproduit TX_EN.', vrai: false },
]
const INTERETS: Affirmation[] = [
  { texte: 'Un parasite qui touche les deux fils de la même façon (mode commun) disparaît dans la différence.', vrai: true },
  { texte: 'Le récepteur ne dépend pas du potentiel de masse de l’émetteur : on peut aller plus loin qu’en RS232.', vrai: true },
  { texte: 'La liaison différentielle dispense d’adresser les esclaves.', vrai: false },
  { texte: 'Elle permet un débit plus élevé sur une grande longueur qu’une liaison référencée à la masse.', vrai: true },
  { texte: 'Elle supprime le besoin de gérer le retournement du bus (TX_EN).', vrai: false },
]

/** Trace à cliquer : TX+ et TX_EN autour d'une requête et de la réponse d'un esclave. */
export interface TraceCliquable {
  txp: Waveform
  txen: Waveform
  /** Fenêtre affichée, en temps du signal */
  from: number
  to: number
}
const SLOT = DETECTES[0]!
const w0 = SLOT * I
const LINES = rs485Lines(PARCOURS, 'c1', w0, w0 + I)
const ZONES = busZones(PARCOURS, 'c1', w0, w0 + I)
const req = PARCOURS.find((f) => f.type === 'MAITRE' && f.bytes[0] === SLOT)!
const rep = REPONSES[0]!
export const TRACE_HZ: TraceCliquable = { txp: LINES.txp, txen: LINES.txen, from: req.t0 - w0 - 1e-3, to: rep.t1 - w0 + 1e-3 }
const checkClic = (v: string): Verdict => {
  const t = Number(v)
  if (v === '' || !Number.isFinite(t)) return { ok: false, message: 'Cliquez sur la trace.' }
  // Le signal est périodique (un créneau) : avant la requête = fin du créneau précédent
  const u = ((t % I) + I) % I
  const z = ZONES.find((x) => u >= x.from && u < x.to)
  if (z?.label === 'haute impédance') return { ok: true, message: 'Juste : personne ne pilote la ligne (TX_EN bas, pas de réponse en cours), les deux fils sont au niveau de repos.' }
  return { ok: false, message: `Faux : ici la ligne est pilotée (${z?.label ?? 'émission'}).` }
}

const MODULES = ['OTB', 'TDS', 'TQS', 'THT']

export function champsPartieB(): Record<string, Champ[]> {
  const amplitude = REF.rs485High.value - REF.rs485Low.value
  return {
    's31-txen': [
      { key: 'txen', label: 'État de TX_EN pendant une requête', options: ['haut', 'bas'], check: (v) => checkExact(v, 'haut') },
      { key: 'duree', label: 'Durée d’une requête du parcours (ms)', check: (v) => checkValeur(v, frameDuration(req.bytes.length) * 1e3) },
    ],
    's31-haute-impedance': [{ key: 'clic', label: 'Cliquez sur une zone de haute impédance', trace: TRACE_HZ, check: checkClic }],
    's31-capture': [{ key: 'fonction', label: 'Numéro de fonction (hexa)', check: (v) => checkHex(v, req.bytes[1]!) }],
    's31-differentiel': [
      { key: 'amplitude', label: 'Amplitude crête à crête de Math pendant une trame (V)', check: (v) => checkValeur(v, 2 * amplitude) },
      { key: 'constat', label: 'Que constate-t-on ? Cochez les affirmations vraies.', affirmations: CONSTATS, check: checkAffirmations(CONSTATS) },
      { key: 'interet', label: 'Intérêt d’une liaison différentielle en milieu industriel : cochez les affirmations vraies.', affirmations: INTERETS, check: checkAffirmations(INTERETS) },
    ],
    's31-adresses': [
      {
        key: 'adresses',
        label: 'Adresses détectées (décimal, séparées par des espaces)',
        check: (v) => {
          const got = [...new Set(v.split(/[\s,;]+/).filter(Boolean).map(Number))].sort((a, b) => a - b)
          return checkExact(got.join(' '), DETECTES.join(' '))
        },
      },
      ...DETECTES.map((adr) => ({ key: `module-${adr}`, label: `Module à l’adresse ${adr}`, options: MODULES, check: (v: string) => checkExact(v, PUPITRE.get(adr)!) })),
    ],
    's31-trames': [
      { key: 'trame01', label: 'Trame émise vers l’esclave 01 (octets en hexa)', check: (v) => checkExact(v, toHex(parcoursRequest(1)), (x) => x.replace(/[^0-9a-f]/gi, '').toUpperCase()) },
      { key: 'fonction', label: 'Fonction Modbus utilisée (hexa)', check: (v) => checkHex(v, parcoursRequest(1)[1]!) },
    ],
    's31-exception': [
      { key: 'adresse', label: `Réponse ${toHex(EXCEPTION)} : adresse de l’esclave (hexa)`, check: (v) => checkHex(v, EXCEPTION[0]!) },
      { key: 'fonction', label: 'Fonction en erreur (hexa)', check: (v) => checkHex(v, EXCEPTION[1]! & 0x7f) },
      { key: 'code', label: 'Code d’exception (hexa)', check: (v) => checkHex(v, EXCEPTION[2]!) },
      {
        key: 'pourquoi',
        label: `Pourquoi le 2e octet vaut-il ${h2(EXCEPTION[1]!)}H ?`,
        options: ['fonction demandée + 80H : réponse d’exception', 'c’est le CRC de la trame', 'c’est l’adresse de l’esclave'],
        check: (v) => checkExact(v, 'fonction demandée + 80H : réponse d’exception'),
      },
      { key: 'crc', label: 'Les deux derniers octets sont…', options: ['le CRC, poids faible d’abord', 'le CRC, poids fort d’abord', 'des données'], check: (v) => checkExact(v, 'le CRC, poids faible d’abord') },
    ],
  }
}
