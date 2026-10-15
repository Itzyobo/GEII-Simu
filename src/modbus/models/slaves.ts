/**
 * Esclaves du pupitre (OTB, TDS, TQS, THT) et décodage de l'analyseur, en fonctions pures.
 * L'état du pupitre (interrupteurs, sorties, afficheurs, configuration) est une donnée : chaque requête renvoie
 * la réponse et le nouvel état. Fonctions 03, 04, 06, 16 ; 07 → exceptions relevées au CR.
 */
import { REF } from '../data/reference'
import { crc16Modbus, toHex } from './crc'
import { FONCTIONS } from './modbus'

export type ModuleId = keyof typeof REF.esclaves.value
export const MODULES = Object.keys(REF.esclaves.value) as ModuleId[]

/** Adresse → module, à la mise sous tension du pupitre */
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

/* ───────────── Conversions ───────────── */

/** Mot de 16 bits lu comme entier signé (complément à 2) : FFCEH → −50 */
const MOT = REF.modbusMotMax.value
export const signed16 = (w: number) => (w & 0x8000 ? (w & MOT) - (MOT + 1) : w & MOT)
/** Entier signé → mot de 16 bits (complément à 2) */
export const word16 = (v: number) => v & MOT

/** Flottant IEEE 754 simple précision → deux mots, poids fort d'abord : 24,0 → [41C0H, 0000H] */
export function floatWords(x: number): [number, number] {
  const dv = new DataView(new ArrayBuffer(4))
  dv.setFloat32(0, x)
  return [dv.getUint16(0), dv.getUint16(2)]
}
export function wordsToFloat(hi: number, lo: number): number {
  const dv = new DataView(new ArrayBuffer(4))
  dv.setUint16(0, hi)
  dv.setUint16(2, lo)
  return dv.getFloat32(0)
}

/** Point de rosée par la formule de Magnus (H13) — °C */
export function pointDeRosee(temperature: number, humidite: number): number {
  const { b, c } = REF.thtMagnus.value
  const g = Math.log(humidite / 100) + (b * temperature) / (c + temperature)
  return (c * g) / (b - g)
}

/* ───────────── État du pupitre ───────────── */

type AvecConfig = Exclude<ModuleId, 'OTB'>

export interface PupitreState {
  /** Adresse Modbus actuelle de chaque module (registre 1 des TDS, TQS, THT) */
  adresses: Record<ModuleId, number>
  /** Vitesse et parité (registres 2 et 3) : différentes du bus → le module ne comprend plus rien (H43) */
  config: Record<AvecConfig, { vitesse: number; parite: number }>
  otb: {
    /** Interrupteurs I0 à I11, bit k = Ik */
    entrees: number
    /** Potentiomètres IN0 et IN1, de 0 à 1 */
    pots: [number, number]
    /** Sorties Q0 à Q7 (octet faible du registre 100) */
    sorties: number
    /** Sorties analogiques OUT1 et OUT2 (registres 101, 102) */
    aout: [number, number]
  }
  tds: {
    /** Codes ASCII des registres 100 à 103 */
    texte: [number, number, number, number]
    entier: number
    mode: 'texte' | 'entier'
    luminosite: number
    /** Durée d'affichage (s, 0 = permanent) et instant de l'écriture qui l'a lancée */
    duree: number
    ecritA: number
  }
}

export function pupitreInitial(): PupitreState {
  const cfg = () => ({ vitesse: REF.regVitesseCode38400.value, parite: 1 })
  const txt = [...REF.tdsEtatInitial.value.texte].map((c) => c.charCodeAt(0)) as PupitreState['tds']['texte']
  return {
    adresses: { ...REF.esclaves.value },
    config: { TDS: cfg(), TQS: cfg(), THT: cfg() },
    otb: { entrees: 0, pots: [...REF.otbPotentiometres.value], sorties: 0, aout: [0, 0] },
    tds: { texte: txt, entier: 0, mode: 'texte', luminosite: REF.tdsEtatInitial.value.luminosite, duree: 0, ecritA: 0 },
  }
}

/** Le module comprend-il encore le bus (38 400 bauds, parité paire) ? */
export const joignable = (e: PupitreState, m: ModuleId) =>
  m === 'OTB' || !REF.configMuet.value || (e.config[m].vitesse === REF.regVitesseCode38400.value && e.config[m].parite === 1)

/** Module qui répond à l'adresse `adr`, ou null */
export const moduleAt = (e: PupitreState, adr: number): ModuleId | null => MODULES.find((m) => e.adresses[m] === adr && joignable(e, m)) ?? null

/* ───────────── Registres ───────────── */

const N_ANALOG = REF.otbAnalogMax.value
const thtMesures = () => {
  const t = REF.thtTemperature.value / 10
  const h = REF.thtHumidite.value / 10
  const td = pointDeRosee(t, h)
  return { t, h, td }
}

/** Lecture d'un registre ; null = registre absent (exception 02) */
function lire(e: PupitreState, m: ModuleId, fn: number, r: number, t: number): number | null {
  const config = (c: AvecConfig) => ({ 1: e.adresses[c], 2: e.config[c].vitesse, 3: e.config[c].parite })[r] ?? null
  switch (m) {
    case 'OTB': {
      const o = e.otb
      if (r === 0) return o.entrees & 0x0fff
      if (r >= 1 && r <= 4) return r <= 2 ? Math.round(o.pots[r - 1]! * N_ANALOG) : 0
      if (r === 100) return o.sorties & 0xff
      if (r === 101 || r === 102) return o.aout[r - 101]!
      return (REF.otbCodesIdent.value as Record<number, number>)[r] ?? null
    }
    case 'TDS': {
      const d = e.tds
      if (r >= 100 && r <= 103) return d.texte[r - 100]!
      if (r === 110) return d.luminosite
      if (r === 111) return d.duree
      if (r === 112) return d.duree === 0 ? 0 : Math.max(0, Math.ceil(d.duree - (t - d.ecritA)))
      if (r === 113) return d.entier
      return config('TDS')
    }
    case 'TQS':
      if (fn === 4) return ({ 0: 0, 1: REF.tqsTemperature.value } as Record<number, number>)[r] ?? null
      return config('TQS')
    case 'THT': {
      if (fn === 3) return config('THT')
      const { t: temp, h, td } = thtMesures()
      const [t2, t3] = floatWords(temp)
      const [h6, h7] = floatWords(h * 10)
      const [d10, d11] = floatWords(td)
      const regs = [0, word16(Math.round(temp * 10)), t2, t3, 0, word16(Math.round(h * 10)), h6, h7, 0, word16(Math.round(td * 10)), d10, d11]
      return regs[r] ?? null
    }
  }
}

type Ecriture = { ok: PupitreState } | { exception: number }
const absent = { exception: REF.exceptionRegistre.value }
const horsPlage = { exception: REF.exceptionValeur.value }

/** Écriture d'un registre en 06 ou 16 */
function ecrire(e: PupitreState, m: ModuleId, r: number, v: number, t: number): Ecriture {
  if (m === 'OTB') {
    // Seuls les registres 100 à 102 s'écrivent (H47) ; entrées et codes d'identification en lecture seule (H41)
    if (!REF.otbRegistresEcrits.value.includes(r)) return absent
    if (r === 100) return { ok: { ...e, otb: { ...e.otb, sorties: v & 0xff } } }
    if (r === 101 || r === 102) {
      if (v > N_ANALOG) return horsPlage
      const aout = [...e.otb.aout] as [number, number]
      aout[r - 101] = v
      return { ok: { ...e, otb: { ...e.otb, aout } } }
    }
    return absent
  }
  if (r >= 1 && r <= 3) {
    if (r === 1) return v >= 1 && v <= REF.modbusEsclaveMax.value ? { ok: { ...e, adresses: { ...e.adresses, [m]: v } } } : horsPlage
    if (r === 3 && !(v in REF.regPariteCode.value)) return horsPlage
    const key = r === 2 ? 'vitesse' : 'parite'
    return { ok: { ...e, config: { ...e.config, [m]: { ...e.config[m], [key]: v } } } }
  }
  if (m !== 'TDS') return absent
  const d = e.tds
  if (r >= 100 && r <= 103) {
    if (v > 0xff || !REF.tdsCaracteres.value.includes(String.fromCharCode(v))) return horsPlage
    const texte = [...d.texte] as PupitreState['tds']['texte']
    texte[r - 100] = v
    return { ok: { ...e, tds: { ...d, texte, mode: 'texte', ecritA: t } } }
  }
  if (r === 110) return v <= REF.tdsLuminositeMax.value ? { ok: { ...e, tds: { ...d, luminosite: v } } } : horsPlage
  if (r === 111 || r === 112) return { ok: { ...e, tds: { ...d, duree: v, ecritA: t } } }
  if (r === 113) return v <= REF.tdsEntierMax.value ? { ok: { ...e, tds: { ...d, entier: v, mode: 'entier', ecritA: t } } } : horsPlage
  return absent
}

const mot = (b: readonly number[], i: number) => ((b[i] ?? 0) << 8) | (b[i + 1] ?? 0)

/**
 * Réponse du module `module` à une requête qui lui est adressée (CRC bon), à l'instant t, et nouvel état.
 * reponse null : pas de réponse (cas de la diffusion, traité par `broadcast`).
 */
export function slaveRespond(e: PupitreState, module: ModuleId, req: readonly number[], t = 0): { reponse: number[] | null; etat: PupitreState } {
  const [adr, fn] = req
  if (adr === undefined || fn === undefined) return { reponse: null, etat: e }
  const exception = (code: number) => ({ reponse: withCrc([adr, fn | 0x80, code]), etat: e })
  if (fn === 7) return { reponse: [...EXCEPTION_07[module]], etat: e }
  if (!FONCTIONS_MODULE[module].includes(fn)) return exception(REF.exceptionFonction.value)
  const r0 = mot(req, 2)
  switch (fn) {
    case 3:
    case 4: {
      const n = mot(req, 4)
      if (n < 1 || n > REF.modbusMotsParRequete.value) return exception(REF.exceptionValeur.value)
      const valeurs: number[] = []
      for (let k = 0; k < n; k++) {
        const v = lire(e, module, fn, r0 + k, t)
        if (v === null) return exception(REF.exceptionRegistre.value)
        valeurs.push(v >> 8, v & 0xff)
      }
      return { reponse: withCrc([adr, fn, 2 * n, ...valeurs]), etat: e }
    }
    case 6: {
      const w = ecrire(e, module, r0, mot(req, 4), t)
      return 'exception' in w ? exception(w.exception) : { reponse: [...req], etat: w.ok }
    }
    case 16: {
      const n = mot(req, 4)
      if (n < 1 || n > REF.modbusMotsParRequete.value || req[6] !== 2 * n || req.length !== 9 + 2 * n) return exception(REF.exceptionValeur.value)
      let etat = e
      for (let k = 0; k < n; k++) {
        const w = ecrire(etat, module, r0 + k, mot(req, 7 + 2 * k), t)
        if ('exception' in w) return exception(w.exception)
        etat = w.ok
      }
      return { reponse: withCrc([adr, 16, r0 >> 8, r0 & 0xff, n >> 8, n & 0xff]), etat }
    }
  }
  return exception(REF.exceptionFonction.value)
}

/** Diffusion (adresse 0) : chaque module exécute l'écriture, aucun ne répond. */
export function broadcast(e: PupitreState, req: readonly number[], t = 0): PupitreState {
  return MODULES.reduce((etat, m) => (joignable(etat, m) ? slaveRespond(etat, m, req, t).etat : etat), e)
}

/* ───────────── Ce que montre le pupitre ───────────── */

/** LED Q0 à Q7 de l'OTB : true = allumée */
export const ledsOTB = (e: PupitreState) => Array.from({ length: 8 }, (_, k) => ((e.otb.sorties >> k) & 1) === 1)

/** Glyphe 7 segments de chaque caractère (photo : « abcd » s'affiche « AbCd ») */
const GLYPHE: Record<string, string> = { a: 'A', c: 'C', e: 'E', f: 'F', g: 'G', j: 'J', k: 'K', l: 'L', m: 'M', p: 'P', s: 'S', u: 'U', w: 'W', x: 'X', z: 'Z' }

/** Les 4 afficheurs du TDS à l'instant t : glyphes (gauche → droite) et luminosité, 0 = éteint. */
export function affichageTDS(e: PupitreState, t = 0): { glyphes: string; luminosite: number } {
  const d = e.tds
  const expire = d.duree > 0 && t - d.ecritA >= d.duree
  const brut = d.mode === 'entier' ? String(d.entier).padStart(4, ' ') : String.fromCharCode(...d.texte)
  return { glyphes: [...brut].map((c) => GLYPHE[c] ?? c).join(''), luminosite: expire ? 0 : d.luminosite }
}

/* ───────────── Analyseur ───────────── */

const h2 = (b: number) => `${b.toString(16).toUpperCase().padStart(2, '0')}H`
const h4 = (w: number) => `${w.toString(16).toUpperCase().padStart(4, '0')}H`
const hex4 = (w: number) => w.toString(16).toUpperCase().padStart(4, '0')

/**
 * Zone « Détail Trame » de l'analyseur. Réponse 03/04 et exception : libellés des photos ; le CRC y est écrit
 * poids fort en premier (B4 73 transmis → 73B4H). Autres trames : libellés reconstitués (H46).
 * Le type (MAITRE / ESCLAVE) vient du sens de la trame sur le bus ; à défaut, il est déduit des octets.
 */
export function analyzerDecode(bytes: readonly number[], type?: 'MAITRE' | 'ESCLAVE'): string[] {
  const [adr, fn] = bytes
  // Exception, réponse 03/04 (longueur impaire : 5 + nombre d'octets pair) ou réponse 16 (8 octets) → esclave ;
  // l'écho d'un 06 est indiscernable de la requête
  const deduit = fn !== undefined && (fn >= 0x80 || ((fn === 3 || fn === 4) && bytes.length % 2 === 1) || (fn === 16 && bytes.length === 8)) ? 'ESCLAVE' : 'MAITRE'
  const t = type ?? deduit
  const lines = [`Trame type ${t} : ${toHex(bytes)}`]
  if (adr === undefined || fn === undefined || bytes.length < 4) return [...lines, 'Trame trop courte']
  if (!crcOk(bytes)) {
    const [lo, hi] = crc16Modbus(bytes.slice(0, -2))
    return [...lines, `CRC faux : reçu ${toHex(bytes.slice(-2))}, calculé ${toHex([lo, hi])}`]
  }
  const crc = `valeur du CRC16 : ${h4(mot([bytes.at(-1)!, bytes.at(-2)!], 0))}`
  if (fn >= 0x80) {
    const code = bytes[2] ?? 0
    const libelle = REF.exceptionLibelles.value[code]
    return [...lines, 'Réponse d’exception', `adresse esclave : ${h2(adr)}`, `fonction en erreur : ${h2(fn & 0x7f)}`, `code exception : ${h2(code)}${libelle ? ` -> ${libelle}` : ''}`]
  }
  lines.push(adr === 0 ? 'adresse esclave : 00H (diffusion)' : `adresse esclave : ${h2(adr)}`)
  const nom = FONCTIONS.find((f) => f.code === fn)?.label.replace(/^Fonction \d+ : /, '')
  lines.push(`fonction demandée : ${h2(fn)}${nom && t === 'MAITRE' ? ` -> ${nom}` : ''}`)
  const data = bytes.slice(2, -2)
  const mots = (from: number, n: number) => Array.from({ length: n }, (_, k) => hex4(mot(data, from + 2 * k))).join(' ')
  if ((fn === 3 || fn === 4) && t === 'ESCLAVE') lines.push(`nombre d’octets lus : ${data[0] ?? 0}`, `valeur des mots (en hexadécimal) : ${mots(1, (data[0] ?? 0) / 2)}`)
  else if ((fn === 3 || fn === 4) && data.length === 4) lines.push(`adresse du premier mot : ${h4(mot(data, 0))}`, `nombre de mots : ${mot(data, 2)}`)
  else if (fn === 6 && data.length === 4) lines.push(`adresse du mot : ${h4(mot(data, 0))}`, `valeur du mot : ${h4(mot(data, 2))}`)
  else if (fn === 16 && t === 'ESCLAVE' && data.length === 4) lines.push(`adresse du premier mot : ${h4(mot(data, 0))}`, `nombre de mots écrits : ${mot(data, 2)}`)
  else if (fn === 16 && data.length >= 5)
    lines.push(`adresse du premier mot : ${h4(mot(data, 0))}`, `nombre de mots : ${mot(data, 2)}`, `nombre d’octets : ${data[4]}`, `valeur des mots (en hexadécimal) : ${mots(5, (data[4] ?? 0) / 2)}`)
  else if (data.length) lines.push(`données : ${toHex(data)}`)
  return [...lines, crc]
}
