/** Champs de réponse des questions 3.2 a à d ; requêtes, réponses et valeurs attendues calculées par les modèles. */
import { REF } from '../data/reference'
import { checkExact, checkValeur, type Verdict } from '../models/answers'
import { toHex } from '../models/crc'
import { buildRequest, type Base } from '../models/modbus'
import { affichageTDS, ledsOTB, moduleAt, pupitreInitial, signed16, slaveRespond, type PupitreState } from '../models/slaves'
import type { Champ } from './partieA'

const ADR = REF.esclaves.value

/** Requête construite comme dans la fenêtre Configuration Maître (tout en décimal) */
function requete(esclave: number, fonction: number, adresse: number, x?: number): number[] {
  const f = (n: number, base: Base = 'dec') => ({ text: String(n), base })
  const champs = fonction === 6 ? { adresse: f(adresse), valeur: f(x ?? 0) } : { adresse: f(adresse), nombre: f(x ?? 1) }
  const r = buildRequest({ esclave: f(esclave), fonction, champs })
  if (!r.ok) throw new Error(r.errors.join(' ; '))
  return r.bytes
}

/** Envoie les requêtes au pupitre ; renvoie la dernière réponse et l'état final */
function envoyer(reqs: number[][], e: PupitreState = pupitreInitial()) {
  let reponse: number[] = []
  for (const req of reqs) {
    const r = slaveRespond(e, moduleAt(e, req[0]!)!, req)
    e = r.etat
    reponse = r.reponse ?? []
  }
  return { reponse, etat: e }
}

const hexNorm = (s: string) => s.replace(/0x/gi, '').replace(/[^0-9a-f]/gi, '').toUpperCase()
/** Trame en octets hexa : un CRC faux est signalé à part */
function checkTrame(v: string, attendu: number[]): Verdict {
  const a = toHex(attendu)
  const got = hexNorm(v)
  if (got === hexNorm(a)) return { ok: true, message: 'Juste.' }
  if (got.length === hexNorm(a).length && got.slice(0, -4) === hexNorm(a).slice(0, -4)) return { ok: false, message: `CRC faux : les deux derniers octets valent ${toHex(attendu.slice(-2))} (poids faible d’abord).` }
  return { ok: false, message: `Faux : ${a}.` }
}
/** Numéro de fonction ou d'octet, accepté en « 6 », « 06 », « 06H », « 0x06 » */
const checkCode = (v: string, attendu: number) => checkExact(String(parseInt(v.trim().replace(/^0x/i, '').replace(/h$/i, ''), 16)), String(attendu))
const checkNombre = (v: string, attendu: number) => checkExact(v.trim(), String(attendu))
const checkListe = (v: string, attendu: number[]) => checkExact([...new Set(v.split(/[\s,;]+/).filter(Boolean).map(Number))].sort((a, b) => a - b).join(' '), attendu.join(' '))

export function champsPartieC(): Record<string, Champ[]> {
  // OTB : écrire 5AH, relire, lire les entrées avec I0–I3 et I8–I11 levés
  const ecrireSorties = requete(ADR.OTB, 6, REF.otbRegSorties.value, REF.otbValeurTest.value)
  const ecriture = envoyer([ecrireSorties])
  const ledsAllumees = ledsOTB(ecriture.etat).flatMap((on, k) => (on ? [k] : []))
  const relire = requete(ADR.OTB, 3, REF.otbRegSorties.value)
  const relecture = envoyer([relire], ecriture.etat).reponse
  const lireEntrees = requete(ADR.OTB, 3, REF.otbRegEntrees.value)
  const interrupteurs = pupitreInitial()
  interrupteurs.otb.entrees = 0x0f0f
  const entrees = envoyer([lireEntrees], interrupteurs).reponse
  // TDS
  const entier = requete(ADR.TDS, 6, REF.tdsRegEntier.value, REF.tdsEntierTeste.value)
  const bcd = requete(ADR.TDS, 6, REF.tdsRegEntier.value, parseInt(String(REF.tdsEntierTeste.value), 16))
  const affBcd = affichageTDS(envoyer([bcd]).etat).glyphes.trim()
  const lettres = REF.tdsRegTexte.value.map((r, k) => requete(ADR.TDS, 6, r, 'abcd'.charCodeAt(k)))
  const affAbcd = affichageTDS(envoyer(lettres).etat).glyphes
  // TQS et THT
  const regTemp = 1
  const tqsReq = requete(ADR.TQS, 4, regTemp)
  const tqsRep = envoyer([tqsReq]).reponse
  const tqsTemp = signed16((tqsRep[3]! << 8) | tqsRep[4]!) / 10
  const tqs03 = envoyer([requete(ADR.TQS, 3, regTemp)]).reponse
  const regHum = 5
  const thtReq = requete(ADR.THT, 4, regTemp)
  const thtRep = envoyer([thtReq]).reponse
  const thtTemp = signed16((thtRep[3]! << 8) | thtRep[4]!) / 10
  const humRep = envoyer([requete(ADR.THT, 4, regHum)]).reponse
  const thtHum = signed16((humRep[3]! << 8) | humRep[4]!) / 10

  const sel = (key: string, label: string, options: string[], juste: string): Champ => ({ key, label, options, check: (v) => checkExact(v, juste) })
  return {
    's32a-registres': [
      { key: 'entrees', label: 'Registre des entrées TOR (décimal)', check: (v) => checkNombre(v, REF.otbRegEntrees.value) },
      { key: 'sorties', label: 'Registre des sorties TOR (décimal)', check: (v) => checkNombre(v, REF.otbRegSorties.value) },
    ],
    's32a-fonction-sorties': [{ key: 'fonction', label: 'Fonction Modbus (hexa)', check: (v) => checkCode(v, ecrireSorties[1]!) }],
    's32a-trame-sorties': [
      { key: 'requete', label: 'Requête complète (octets hexa, CRC compris)', check: (v) => checkTrame(v, ecrireSorties) },
      { key: 'reponse', label: 'Réponse de l’OTB', check: (v) => checkTrame(v, ecriture.reponse) },
      sel('adresse', `Dans la requête, ${toHex(ecrireSorties.slice(2, 4))} est…`, ['l’adresse du registre (100)', 'la valeur écrite', 'le nombre de registres'], 'l’adresse du registre (100)'),
      sel('valeur', `${toHex(ecrireSorties.slice(4, 6))} est…`, ['l’adresse du registre (100)', 'la valeur écrite', 'le nombre de registres'], 'la valeur écrite'),
      sel('crc', `${toHex(ecrireSorties.slice(6))} est…`, ['le CRC, poids faible d’abord', 'le CRC, poids fort d’abord', 'des données'], 'le CRC, poids faible d’abord'),
      sel('echo', 'La réponse est…', ['l’écho exact de la requête', 'une exception', 'le mot lu'], 'l’écho exact de la requête'),
    ],
    's32a-leds': [{ key: 'leds', label: 'LED de sortie allumées (numéros, ex. 0 2 5)', check: (v) => checkListe(v.replace(/q/gi, ' '), ledsAllumees) }],
    's32a-relire': [
      { key: 'fonction', label: 'Fonction Modbus (hexa)', check: (v) => checkCode(v, relire[1]!) },
      { key: 'requete', label: 'Requête (octets hexa)', check: (v) => checkTrame(v, relire) },
      { key: 'reponse', label: 'Réponse attendue après l’écriture de 5AH', check: (v) => checkTrame(v, relecture) },
    ],
    's32a-fonction-entrees': [{ key: 'fonction', label: 'Fonction Modbus (hexa)', check: (v) => checkCode(v, lireEntrees[1]!) }],
    's32a-trame-entrees': [
      { key: 'requete', label: 'Requête (octets hexa)', check: (v) => checkTrame(v, lireEntrees) },
      sel('nb', `Dans la réponse ${toHex(entrees)}, l’octet ${toHex(entrees.slice(2, 3))} est…`, ['le nombre d’octets lus', 'le nombre de mots', 'l’adresse du registre'], 'le nombre d’octets lus'),
      sel('mot', `${toHex(entrees.slice(3, 5))} est…`, ['le mot des entrées I11…I0', 'le CRC', 'l’adresse du registre'], 'le mot des entrées I11…I0'),
    ],
    's32a-comparer': [
      { key: 'mot', label: 'Inverseurs I0–I3 et I8–I11 levés : mot lu (hexa, 4 chiffres)', check: (v) => checkExact(hexNorm(v).padStart(4, '0'), toHex(entrees.slice(3, 5)).replace(' ', '')) },
      sel('bit0', 'Le bit de poids faible du mot correspond à…', ['I0', 'I11', 'Q0'], 'I0'),
    ],
    's32b-entier': [
      { key: 'registre', label: 'Registre de l’entier décimal (décimal)', check: (v) => checkNombre(v, REF.tdsRegEntier.value) },
      { key: 'requete', label: `Requête pour afficher ${REF.tdsEntierTeste.value} (octets hexa)`, check: (v) => checkTrame(v, entier) },
      { key: 'bcd', label: `Si l’on écrit ${REF.tdsEntierTeste.value}H (en BCD), l’afficheur montre…`, check: (v) => checkExact(v.trim(), affBcd) },
    ],
    's32b-texte': [
      { key: 'registres', label: 'Registres des 4 caractères (décimal)', check: (v) => checkListe(v, REF.tdsRegTexte.value) },
      { key: 'requete', label: 'Requête du 1er caractère « a » (octets hexa)', check: (v) => checkTrame(v, lettres[0]!) },
      { key: 'affichage', label: 'Affichage obtenu (respectez majuscules et minuscules)', check: (v) => checkExact(v.trim(), affAbcd, (x) => x) },
      sel('f16', 'Envoyer les 4 caractères en une trame de fonction 16 donne…', ['une exception 01 : fonction non supportée par le TDS', 'l’affichage « abcd »', 'une exception 02'], 'une exception 01 : fonction non supportée par le TDS'),
    ],
    's32c-adresse': [
      { key: 'registre', label: 'Registre de la température (décimal)', check: (v) => checkNombre(v, regTemp) },
      { key: 'fonction', label: 'Fonction Modbus (hexa)', check: (v) => checkCode(v, tqsReq[1]!) },
    ],
    's32c-trame': [
      { key: 'requete', label: 'Requête (octets hexa)', check: (v) => checkTrame(v, tqsReq) },
      { key: 'reponse', label: 'Réponse du TQS', check: (v) => checkTrame(v, tqsRep) },
      { key: 'temperature', label: 'Température lue (°C)', check: (v) => checkValeur(v, tqsTemp) },
      sel('f03', `En fonction 03 sur le même registre, on lit ${toHex(tqs03.slice(3, 5))}, c’est…`, ['l’adresse Modbus du module', 'la température', 'une exception'], 'l’adresse Modbus du module'),
    ],
    's32d-adresses': [
      { key: 'temperature', label: 'Registre de la température, valeur entière (décimal)', check: (v) => checkNombre(v, regTemp) },
      { key: 'humidite', label: 'Registre de l’humidité, valeur entière (décimal)', check: (v) => checkNombre(v, regHum) },
      { key: 'fonction', label: 'Fonction Modbus (hexa)', check: (v) => checkCode(v, thtReq[1]!) },
    ],
    's32d-trame': [
      { key: 'requete', label: 'Requête de la température (octets hexa)', check: (v) => checkTrame(v, thtReq) },
      { key: 'temperature', label: 'Température lue (°C)', check: (v) => checkValeur(v, thtTemp) },
      { key: 'humidite', label: 'Humidité lue (%HR)', check: (v) => checkValeur(v, thtHum) },
      { key: 'ecart', label: 'Écart avec la température du TQS (°C, valeur absolue)', check: (v) => checkValeur(v, Math.abs(tqsTemp - thtTemp)) },
    ],
  }
}
