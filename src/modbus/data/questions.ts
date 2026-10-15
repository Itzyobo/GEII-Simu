/**
 * Questions de l'énoncé TP2 (TP-11 à TP-15) : une question par puce, intitulé recopié mot pour mot de
 * docs/modbus/enonce.md (mise en gras retirée). Les puces de pure manipulation (« Exécuter le programme… »,
 * « Relier… ») ne sont pas des questions. Une puce à plusieurs questions reste une seule question.
 */
import { HYPOTHESES, REF, type Hyp, type RefKey } from './reference'
import type { AttenduId } from './attendus'

export type Section = '2.1' | '2.2' | '2.3' | '2.4' | '3.1' | '3.2 a' | '3.2 b' | '3.2 c' | '3.2 d'

export interface Question {
  id: string
  section: Section
  intitule: string
  attendus: AttenduId[]
  /** Entrées de reference.ts dont dépend la réponse attendue */
  deps: RefKey[]
  statut: 'implémentée' | 'à venir'
}

type Def = [id: string, section: Section, intitule: string, attendus: AttenduId[], deps: RefKey[]]

const S1: RefKey[] = ['serie1DataBits', 'serie1Parity', 'serie1StopBits', 'serie1Baud', 'ttlLow', 'ttlHigh']
const S3: RefKey[] = ['serie3Baud', 'serie3DataBits', 'serie3Parity', 'serie3StopBits']
const RS485: RefKey[] = ['rs485Low', 'rs485High', 'rs485Idle']
const CAPTURE: RefKey[] = ['captureVoltDiv', 'captureProbe', 'captureTriggerLevel', 'captureTimeDiv']
const TRAME_OTB =
  'Préparer la trame Modbus à envoyer. Utiliser le poste Maître pour émettre la trame préparée. Relever et interpréter les différents octets contenus dans une trame de requête et une trame de réponse.'

const DEFS: Def[] = [
  [
    's21-ttl',
    '2.1',
    "Relever le signal obtenu sur TXD en niveau TTL avec différents octets : 55H, 00H et 01H (attention à la synchronisation de l'oscilloscope. Noter les réglages dans votre compte-rendu).",
    ['q2', 'parite'],
    S1,
  ],
  [
    's21-champs',
    '2.1',
    "Vérifier que ces relevés permettent bien de retrouver les caractéristiques de la transmission (8 bits, parité impaire). Repérer sur chacun d'eux les bits de start, parité et stop.",
    ['q2', 'parite'],
    ['serie1Parity', 'serie1StopBits'],
  ],
  ['s21-debit', '2.1', 'Mesurer la cadence de transfert (débit)', ['q2', 'debit'], ['serie1Baud', 'scopeSerie1TimeDiv']],
  ['s21-rs232', '2.1', 'Relever le signal obtenu sur TxD en niveau RS232. Comparer au niveau TTL (niveau de tension, polarité inverse)', ['q2'], ['rs232High', 'rs232Low']],
  [
    's22',
    '2.2',
    'Réaliser les mêmes opérations que précédemment (niveau TTL seulement). Quelles sont les caractéristiques de transmission : cadence de transfert, 7 ou 8 bits de données, parité ou non, si oui paire ou impaire ?',
    ['q2', 'debit', 'parite'],
    ['serie2Format'],
  ],
  [
    's23',
    '2.3',
    "Relever la trame complète et l'interpréter : caractéristiques de la liaison asynchrone (cadence de transfert, nombre de bits, parité, …), contenu de la trame asynchrone transmise (c'est le code ASCII qui est utilisé).",
    ['q2', 'message-code', 'debit', 'parite'],
    [...S3, 'serie3Message'],
  ],
  ['s24-transmission', '2.4', 'Sur le PC n°1, exécuter le programme précédent (SERIE 3). Vérifier la bonne transmission série entre les deux PC.', ['q2', 'message-code'], [...S3, 'serie3Message']],
  ['s24-erreur', '2.4', "Modifier les caractéristiques de réception de RealTerm (cadence, parité,…). Vérifier que la transmission n'est plus correcte.", ['q2', 'debit', 'parite'], S3],
  ['s31-txen', '3.1', "Relever à l'oscilloscope les signaux TX+ et TX_EN.", ['q31'], [...RS485, ...CAPTURE, 'modbusRequete07']],
  ['s31-haute-impedance', '3.1', "Repérer l'état haute impédance.", ['q31', 'impedance'], ['rs485Idle']],
  ['s31-capture', '3.1', 'Capturer une trame. Quel est le numéro de fonction ?', ['q31', 'autre'], [...CAPTURE, 'modbusOctet']],
  [
    's31-differentiel',
    '3.1',
    "Afficher la tension différentielle RS485, (TX+/RX+) – (TX-/RX-), en utilisant les fonctions mathématiques de l'oscilloscope. Que constate-t-on ? Rappeler l'intérêt d'une liaison différentielle dans un contexte industriel.",
    ['q31'],
    [...RS485, 'captureMathVoltDiv', 'captureMathOffset'],
  ],
  [
    's31-adresses',
    '3.1',
    "En analysant les trames détectées sur la carte d'interface en mode analyseur, déterminer les adresses des esclaves détectés sur le réseau. A quels esclaves du pupitre Modbus correspondent-elles ?",
    ['q31'],
    ['esclaves'],
  ],
  ['s31-trames', '3.1', 'Quelles trames Modbus sont émises par le logiciel lors de cette phase de détection des esclaves ? Quelle est la fonction Modbus utilisée ?', ['q31', 'autre'], ['esclaves']],
  ['s31-exception', '3.1', "Analyser le contenu d'une réponse d'exception.", ['q31', 'autre'], ['exceptionOTB', 'exceptionTDS', 'exceptionTQS', 'exceptionTHT']],
  [
    's32a-registres',
    '3.2 a',
    "Après avoir consulté la documentation du module OTB fournie en annexe, trouver l'adresse interne des registres d'entrées TOR, et de sorties TOR.",
    ['q32'],
    ['otbRegSorties', 'otbRegEntrees'],
  ],
  [
    's32a-fonction-sorties',
    '3.2 a',
    'Chercher la fonction Modbus permettant, depuis la carte réseau "Maître", d\'envoyer l\'octet 0x5A qui va configurer les sorties TOR du module OTB.',
    ['q32', 'autre'],
    ['otbRegSorties', 'otbValeurTest'],
  ],
  ['s32a-trame-sorties', '3.2 a', TRAME_OTB, ['q32', 'autre'], ['esclaves', 'otbRegSorties', 'otbValeurTest']],
  ['s32a-leds', '3.2 a', 'Vérifier que les sorties sont modifiées sur les Leds de sortie du module OTB.', ['q32'], ['otbLedsAllumees']],
  ['s32a-relire', '3.2 a', 'Choisir la fonction Modbus permettant de relire les états de ces sorties. Préparer la requête à envoyer. Tester le bon fonctionnement', ['q32', 'autre'], ['esclaves', 'otbRegSorties']],
  ['s32a-fonction-entrees', '3.2 a', 'Chercher la fonction Modbus permettant, depuis la carte réseau "Maître", de lire l\'état des entrées TOR du module OTB.', ['q32', 'autre'], ['otbRegEntrees']],
  ['s32a-trame-entrees', '3.2 a', TRAME_OTB, ['q32', 'autre'], ['esclaves', 'otbRegEntrees', 'otbReponseEntrees']],
  ['s32a-comparer', '3.2 a', "Vérifier que le mot d'entrée lu correspond bien au mot présent sur les interrupteurs reliés aux entrées TOR du module OTB.", ['q32'], ['otbReponseEntrees']],
  [
    's32b-entier',
    '3.2 b',
    "Après avoir consulté la documentation du module TDS fournie en annexe, trouver les adresses internes du module TDS permettant l'affichage d'un entier décimal sur les 4 afficheurs. Préparer la trame Modbus correspondante et tester le bon affichage sur le TDS.",
    ['q32', 'autre'],
    ['esclaves', 'tdsRegEntier', 'tdsEntierTeste'],
  ],
  [
    's32b-texte',
    '3.2 b',
    "Mêmes questions mais pour un affichage des 4 caractères « abcd » sur les afficheurs (attention, l'afficheur n'accepte que les codes ASCII des lettres en minuscules).",
    ['q32', 'autre'],
    ['esclaves', 'tdsRegTexte', 'tdsRenduAbcd'],
  ],
  [
    's32c-adresse',
    '3.2 c',
    "Le module TQS contient un capteur de température intégré, communiquant en protocole Modbus série. Après avoir consulté la documentation du module TQS fournie en annexe, trouver l'adresse interne du module TQS, permettant de connaitre la température ambiante.",
    ['q32'],
    ['tqsTemperature', 'registre1LuEn03'],
  ],
  ['s32c-trame', '3.2 c', 'Préparer la trame Modbus permettant de mesurer cette température. Tester et vérifier la valeur lue : comparer à la température ambiante.', ['q32', 'autre'], ['esclaves', 'tqsTemperature']],
  [
    's32d-adresses',
    '3.2 d',
    "Le module THT contient deux convertisseurs A/N reliés à un capteur industriel de mesure de température et d'hygrométrie. Ce module est accessible par protocole Modbus série. Après avoir consulté la documentation du module THT fournie en annexe, trouver les adresses internes du module THS, permettant de connaitre la température (valeur entière) et le degré d'humidité.",
    ['q32'],
    ['thtTemperature', 'thtHumidite', 'registre1LuEn03'],
  ],
  [
    's32d-trame',
    '3.2 d',
    "Préparer la trame Modbus permettant de mesurer ces valeurs. Tester et vérifier l'exactitude de la valeur retournée (température).",
    ['q32', 'autre'],
    ['esclaves', 'thtTemperature', 'thtHumidite', 'thtPointRosee'],
  ],
]

export const QUESTIONS: Question[] = DEFS.map(([id, section, intitule, attendus, deps]) => ({
  id,
  section,
  intitule,
  attendus,
  deps,
  // Étape 2 : partie A (2.1 à 2.4) implémentée
  statut: section.startsWith('2.') ? 'implémentée' : 'à venir',
}))

export const SECTIONS: Section[] = ['2.1', '2.2', '2.3', '2.4', '3.1', '3.2 a', '3.2 b', '3.2 c', '3.2 d']

/** Hypothèses dont dépend la réponse : non vide → badge « valeur non vérifiée ». */
export function unverifiedOf(deps: readonly RefKey[]): { hyp: Hyp; text: string }[] {
  const hyps = new Set<Hyp>()
  for (const k of deps) {
    const r = REF[k]
    if (r.source === 'hypothèse') hyps.add(r.hyp)
  }
  return [...hyps].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))).map((hyp) => ({ hyp, text: HYPOTHESES[hyp]?.text ?? '' }))
}

export const hasUnverified = (q: Pick<Question, 'deps'>) => unverifiedOf(q.deps).length > 0

/** Couverture d'un attendu : questions reliées, et s'il en existe au moins une implémentée. */
export function coverage(attendu: AttenduId, questions: readonly Question[] = QUESTIONS) {
  const linked = questions.filter((q) => q.attendus.includes(attendu))
  return { linked, covered: linked.some((q) => q.statut === 'implémentée') }
}
