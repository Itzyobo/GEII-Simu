/**
 * Esclaves du pupitre et décodage de l'analyseur. Étape 3 : fonction 07 (exceptions relevées au CR) et
 * exception 01 pour toute fonction non supportée (H15) ; les fonctions supportées arrivent à l'étape 4.
 */
import { REF } from '../data/reference'
import { crc16Modbus, toHex } from './crc'
import { FONCTIONS } from './modbus'

export type ModuleId = keyof typeof REF.esclaves.value

/** Adresse → module présent sur le pupitre */
export const PUPITRE: ReadonlyMap<number, ModuleId> = new Map(Object.entries(REF.esclaves.value).map(([m, a]) => [a, m as ModuleId]))

const FONCTIONS_MODULE: Record<ModuleId, readonly number[]> = {
  OTB: REF.otbFonctions.value,
  TDS: REF.tdsFonctions.value,
  TQS: REF.tqsFonctions.value,
  THT: REF.thtFonctions.value,
}
const EXCEPTION_07: Record<ModuleId, readonly number[]> = {
  OTB: REF.exceptionOTB.value,
  TDS: REF.exceptionTDS.value,
  TQS: REF.exceptionTQS.value,
  THT: REF.exceptionTHT.value,
}

export const crcOk = (bytes: readonly number[]) => {
  if (bytes.length < 4) return false
  const [lo, hi] = crc16Modbus(bytes.slice(0, -2))
  return bytes.at(-2) === lo && bytes.at(-1) === hi
}

export const withCrc = (pdu: number[]) => [...pdu, ...crc16Modbus(pdu)]

/** Réponse du module à une requête qui lui est adressée et dont le CRC est bon ; null = pas de réponse. */
export function slaveRespond(module: ModuleId, req: readonly number[]): number[] | null {
  const [adr, fn] = req
  if (adr === undefined || fn === undefined) return null
  if (fn === 7) return [...EXCEPTION_07[module]]
  if (!FONCTIONS_MODULE[module].includes(fn)) return withCrc([adr, fn | 0x80, REF.exceptionFonction.value])
  // ponytail: fonctions supportées (03, 04, 06, 16) modélisées à l'étape 4 ; d'ici là, pas de réponse
  return null
}

const h2 = (b: number) => `${b.toString(16).toUpperCase().padStart(2, '0')}H`
const h4 = (hi: number, lo: number) => `${((hi << 8) | lo).toString(16).toUpperCase().padStart(4, '0')}H`

/**
 * Zone « Détail Trame » de l'analyseur, au format de la photo. Le type (MAITRE / ESCLAVE) vient du sens de la
 * trame sur le bus ; à défaut, une fonction ≥ 80H est une réponse d'exception d'esclave.
 */
export function analyzerDecode(bytes: readonly number[], type?: 'MAITRE' | 'ESCLAVE'): string[] {
  const [adr, fn] = bytes
  const t = type ?? (fn !== undefined && fn >= 0x80 ? 'ESCLAVE' : 'MAITRE')
  const lines = [`Trame type ${t} : ${toHex(bytes)}`]
  if (adr === undefined || fn === undefined || bytes.length < 4) return [...lines, 'Trame trop courte']
  if (!crcOk(bytes)) {
    const [lo, hi] = crc16Modbus(bytes.slice(0, -2))
    return [...lines, `CRC faux : reçu ${toHex(bytes.slice(-2))}, calculé ${toHex([lo, hi])}`]
  }
  if (fn >= 0x80) {
    const code = bytes[2] ?? 0
    const libelle = REF.exceptionLibelles.value[code]
    return [...lines, 'Réponse d’exception', `adresse esclave : ${h2(adr)}`, `fonction en erreur : ${h2(fn & 0x7f)}`, `code exception : ${h2(code)}${libelle ? ` -> ${libelle}` : ''}`]
  }
  const nom = FONCTIONS.find((f) => f.code === fn)?.label.replace(/^Fonction \d+ : /, '')
  lines.push(adr === 0 ? 'adresse esclave : 00H (diffusion)' : `adresse esclave : ${h2(adr)}`, `fonction : ${h2(fn)}${nom ? ` -> ${nom}` : ''}`)
  const data = bytes.slice(2, -2)
  if (t === 'MAITRE' && data.length >= 4) lines.push(`adresse : ${h4(data[0]!, data[1]!)}`, `${fn === 6 ? 'valeur' : 'nombre'} : ${h4(data[2]!, data[3]!)}`)
  else if (data.length) lines.push(`données : ${toHex(data)}`)
  return lines
}
