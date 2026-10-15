/** Requêtes Modbus RTU telles que les construit la fenêtre « Configuration Maître » du logiciel. */
import { REF } from '../data/reference'
import { crc16Modbus } from './crc'

export type Base = 'dec' | 'hex'
export type FieldKey = 'adresse' | 'nombre' | 'valeur'

/** Texte saisi dans un champ + base choisie sur sa boîte (H17). */
export interface Field {
  text: string
  base: Base
}

export interface FonctionDef {
  code: number
  label: string
  /** Champs propres à la fonction, dans l'ordre de la fenêtre */
  fields: { key: FieldKey; label: string }[]
  /** Valeur saisie comme liste séparée par des espaces (F15, F16 : H21) */
  list?: 'bits' | 'mots'
}

/** Liste déroulante « Fonction à réaliser », dans l'ordre du logiciel. Intitulés de F2, F5, F15 et F16 reconstitués (H21). */
export const FONCTIONS: FonctionDef[] = [
  { code: 1, label: 'Fonction 1 : Lecture de N bits de sorties ou internes', fields: [{ key: 'adresse', label: 'Adresse du premier bit à lire' }, { key: 'nombre', label: 'Nombre de bits à lire' }] },
  { code: 2, label: 'Fonction 2 : Lecture de N bits d’entrées', fields: [{ key: 'adresse', label: 'Adresse du premier bit à lire' }, { key: 'nombre', label: 'Nombre de bits à lire' }] },
  { code: 3, label: 'Fonction 3 : Lecture de N mots de sorties ou internes', fields: [{ key: 'adresse', label: 'Adresse du premier mot à lire' }, { key: 'nombre', label: 'Nombre de mots à lire' }] },
  { code: 4, label: 'Fonction 4 : Lecture de N mots d’entrées', fields: [{ key: 'adresse', label: 'Adresse du premier mot à lire' }, { key: 'nombre', label: 'Nombre de mots à lire' }] },
  { code: 5, label: 'Fonction 5 : Ecriture d’un bit', fields: [{ key: 'adresse', label: 'Adresse du bit à écrire' }, { key: 'valeur', label: 'Valeur du bit à écrire' }] },
  { code: 6, label: 'Fonction 6 : Ecriture d’un mot', fields: [{ key: 'adresse', label: 'Adresse du mot à écrire' }, { key: 'valeur', label: 'Valeur du mot à écrire' }] },
  { code: 7, label: 'Fonction 7 : Lecture rapide de 8 bits', fields: [] },
  {
    code: 15,
    label: 'Fonction 15 : Ecriture de N bits',
    fields: [{ key: 'adresse', label: 'Adresse du premier bit à écrire' }, { key: 'nombre', label: 'Nombre de bits à écrire' }, { key: 'valeur', label: 'Valeurs des bits à écrire' }],
    list: 'bits',
  },
  {
    code: 16,
    label: 'Fonction 16 : Ecriture de N mots',
    fields: [{ key: 'adresse', label: 'Adresse du premier mot à écrire' }, { key: 'nombre', label: 'Nombre de mots à écrire' }, { key: 'valeur', label: 'Valeurs des mots à écrire' }],
    list: 'mots',
  },
]

/** Texte → entier dans la base du champ ; null si la saisie n'est pas un nombre de cette base. */
export function parseField({ text, base }: Field): number | null {
  const s = text.trim()
  if (!(base === 'hex' ? /^[0-9a-f]+$/i : /^[0-9]+$/).test(s)) return null
  return parseInt(s, base === 'hex' ? 16 : 10)
}

export interface RequestInput {
  esclave: Field
  fonction: number
  champs: Partial<Record<FieldKey, Field>>
}

export type RequestResult = { ok: true; bytes: number[] } | { ok: false; errors: string[] }

const word = (v: number) => [v >> 8, v & 0xff]

/** Octets de la requête RTU, CRC compris (poids faible d'abord). */
export function buildRequest({ esclave, fonction, champs }: RequestInput): RequestResult {
  const def = FONCTIONS.find((f) => f.code === fonction)
  if (!def) return { ok: false, errors: [`Fonction ${fonction} inconnue`] }
  const errors: string[] = []
  const num = (label: string, f: Field | undefined, max: number, min = 0) => {
    const v = f ? parseField(f) : null
    if (v === null) errors.push(`${label} : saisie invalide en ${f?.base === 'hex' ? 'hexadécimal' : 'décimal'}`)
    else if (v < min || v > max) errors.push(`${label} : ${v} hors de [${min} ; ${max}]`)
    return v ?? 0
  }
  const labelOf = (k: FieldKey) => def.fields.find((f) => f.key === k)?.label ?? k

  const slave = num('Numéro d’Esclave', esclave, REF.modbusEsclaveMax.value)
  const pdu: number[] = [slave, fonction]
  const motMax = REF.modbusMotMax.value
  const isBits = fonction === 1 || fonction === 2 || fonction === 15

  if (fonction !== 7) pdu.push(...word(num(labelOf('adresse'), champs.adresse, motMax)))
  if ([1, 2, 3, 4, 15, 16].includes(fonction)) {
    const max = isBits ? REF.modbusBitsParRequete.value : REF.modbusMotsParRequete.value
    pdu.push(...word(num(labelOf('nombre'), champs.nombre, max, 1)))
  }
  if (fonction === 5) pdu.push(...(num(labelOf('valeur'), champs.valeur, 1) ? [0xff, 0x00] : [0x00, 0x00]))
  if (fonction === 6) pdu.push(...word(num(labelOf('valeur'), champs.valeur, motMax)))
  if (def.list) {
    const f = champs.valeur
    const items = (f?.text.trim() ?? '').split(/\s+/).filter(Boolean)
    const values = items.map((text, k) => num(`${labelOf('valeur')} n° ${k + 1}`, { text, base: f?.base ?? 'dec' }, def.list === 'bits' ? 1 : motMax))
    const n = champs.nombre ? parseField(champs.nombre) : null
    if (n !== null && n !== values.length) errors.push(`${values.length} valeur(s) saisie(s) pour ${n} annoncée(s)`)
    if (def.list === 'bits') {
      const packed = Array.from({ length: Math.ceil(values.length / 8) }, (_, k) => values.slice(8 * k, 8 * k + 8).reduce((acc, b, i) => acc | (b << i), 0))
      pdu.push(packed.length, ...packed)
    } else pdu.push(2 * values.length, ...values.flatMap(word))
  }
  if (errors.length) return { ok: false, errors }
  return { ok: true, bytes: [...pdu, ...crc16Modbus(pdu)] }
}
