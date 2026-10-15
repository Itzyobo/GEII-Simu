/**
 * Mode partiel (PRD §2, partie D) : sujet tiré au sort depuis une graine (rejouable), notation par attendu.
 * Fonctions pures : le store ne garde que la graine, les réponses et le compte des essais et des pénalités.
 */
import { REF } from '../data/reference'
import type { AttenduId } from '../data/attendus'
import { COURS, bonneReponse, corrigerCours, type QuestionCours, type Theme } from '../data/cours'
import { PARITE_LABEL, checkDebit, checkExact, parseParite, points, type Verdict } from '../models/answers'
import { toHex } from '../models/crc'
import { exerciseGenerate, type Exercice } from '../models/exercise'
import { buildRequest } from '../models/modbus'
import { mulberry32 } from '../models/scope'
import { moduleAt, pupitreInitial, slaveRespond, withCrc } from '../models/slaves'

/** Ligne de la note : les attendus du partiel, plus la manipulation au banc */
export type LigneNote = Extract<AttenduId, 'message-code' | 'debit' | 'parite' | 'impedance' | 'longueur' | 'autre'> | 'manip'
export const LIGNES: { id: LigneNote; label: string }[] = [
  { id: 'message-code', label: 'Message codé' },
  { id: 'debit', label: 'Débit' },
  { id: 'parite', label: 'Bit de parité' },
  { id: 'impedance', label: 'Impédance' },
  { id: 'longueur', label: 'Longueur de câble' },
  { id: 'autre', label: 'Modbus' },
  { id: 'manip', label: 'Manipulation au banc' },
]

export interface ItemPartiel {
  id: string
  ligne: LigneNote
  bloc: 'message' | 'trame' | 'reponse' | 'cours'
  label: string
  options?: string[]
  check: (v: string) => Verdict
  /** Bonne réponse et explication, affichées à la correction */
  correction: string
}

export interface Sujet {
  graine: number
  manip: boolean
  exercice: Exercice
  /** Trame Modbus à écrire */
  trame: { consigne: string; bytes: number[] }
  /** Échange à interpréter : requête et réponse de l'esclave */
  echange: { requete: number[]; reponse: number[] }
  cours: QuestionCours[]
  items: ItemPartiel[]
}

const h2 = (b: number) => `${b.toString(16).toUpperCase().padStart(2, '0')}H`
const hexNorm = (s: string) => s.replace(/0x/gi, '').replace(/[^0-9a-f]/gi, '').toUpperCase()
const checkHexOctet = (v: string, attendu: number) => checkExact(String(parseInt(hexNorm(v) || 'x', 16)), String(attendu))
/** Trame hexa : CRC faux → moitié des points */
function checkTrame(v: string, attendu: number[]): Verdict {
  const got = hexNorm(v)
  const ok = hexNorm(toHex(attendu))
  if (got === ok) return { ok: true, message: 'Juste.' }
  if (got.length === ok.length && got.slice(0, -4) === ok.slice(0, -4)) return { ok: false, partiel: true, message: 'Octets justes, CRC faux.' }
  return { ok: false, message: 'Faux.' }
}

/** Trames à écrire : module, fonction, registre, valeur ou nombre (jamais les registres de configuration) */
const CONSIGNES = [
  { module: 'OTB', fonction: 6, registre: REF.otbRegSorties.value, valeur: (r: () => number) => Math.floor(r() * 256), quoi: 'les sorties TOR de l’OTB' },
  { module: 'TDS', fonction: 6, registre: REF.tdsRegEntier.value, valeur: (r: () => number) => Math.floor(r() * (REF.tdsEntierMax.value + 1)), quoi: 'l’entier affiché par le TDS' },
  { module: 'OTB', fonction: 3, registre: REF.otbRegEntrees.value, valeur: () => 1, quoi: 'le mot des entrées TOR de l’OTB' },
  { module: 'TQS', fonction: 4, registre: 1, valeur: () => 1, quoi: 'la température du TQS' },
  { module: 'THT', fonction: 4, registre: 5, valeur: () => 1, quoi: 'l’humidité du THT' },
] as const

/** Échanges à interpréter, exceptions comprises (requête, état du pupitre éventuel) */
const ECHANGES: { requete: (r: () => number) => number[]; entrees?: (r: () => number) => number }[] = [
  { requete: () => withCrc([REF.esclaves.value.OTB, 3, 0, REF.otbRegEntrees.value, 0, 1]), entrees: (r) => Math.floor(r() * 4096) },
  { requete: () => withCrc([REF.esclaves.value.TQS, 4, 0, 1, 0, 1]) },
  { requete: () => withCrc([REF.esclaves.value.OTB, 6, 1, 0, 0, 0x5a]) },
  { requete: () => withCrc([REF.esclaves.value.TDS, 6, 0, REF.tdsRegEntier.value, 0x27, 0x10]) },
  { requete: () => withCrc([REF.esclaves.value.TDS, 16, 0, 100, 0, 1, 2, 0, 0x61]) },
  { requete: () => withCrc([REF.esclaves.value.THT, 7]) },
]

/** Sujet du partiel, entièrement déterminé par la graine. */
export function genererSujet(graine: number, manip = false): Sujet {
  const rnd = mulberry32(graine)
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]!

  // 1. Chronogramme « message codé »
  const exercice = exerciseGenerate(graine, 2)
  const l = exercice.liaison
  const items: ItemPartiel[] = [
    { id: 'm-debit', ligne: 'debit', bloc: 'message', label: 'Débit (bauds) ou durée d’un bit', check: (v) => checkDebit(v, l.baud, exercice.tdiv), correction: `${l.baud} bauds : un bit dure ${(1e6 / l.baud).toFixed(1).replace('.', ',')} µs.` },
    { id: 'm-bits', ligne: 'message-code', bloc: 'message', label: 'Bits de données', options: ['7', '8'], check: (v) => checkExact(v, String(l.dataBits)), correction: `${l.dataBits} bits de données.` },
    {
      id: 'm-parite',
      ligne: 'parite',
      bloc: 'message',
      label: 'Parité',
      options: Object.values(PARITE_LABEL),
      check: (v) => (parseParite(v) === l.parity ? { ok: true, message: 'Juste.' } : { ok: false, message: 'Faux.' }),
      correction: `Parité ${PARITE_LABEL[l.parity]}.`,
    },
    {
      id: 'm-message',
      ligne: 'message-code',
      bloc: 'message',
      label: 'Message ASCII',
      check: (v) => checkExact(v, exercice.corrige.message, (x) => x),
      correction: `« ${exercice.corrige.message} » : ${exercice.corrige.chars.map((c) => `${c.bits} = ${h2(c.byte)}`).join(' ; ')}.`,
    },
  ]

  // 2. Trame Modbus à écrire
  const c = pick(CONSIGNES)
  const x = c.valeur(rnd)
  const adr = REF.esclaves.value[c.module]
  const dec = (n: number) => ({ text: String(n), base: 'dec' as const })
  const req = buildRequest({ esclave: dec(adr), fonction: c.fonction, champs: c.fonction === 6 ? { adresse: dec(c.registre), valeur: dec(x) } : { adresse: dec(c.registre), nombre: dec(x) } })
  if (!req.ok) throw new Error(req.errors.join(' ; '))
  const consigne =
    c.fonction === 6
      ? `Écrire ${x} (décimal) dans ${c.quoi} : esclave ${adr}, registre ${c.registre}, fonction 06.`
      : `Lire ${c.quoi} : esclave ${adr}, registre ${c.registre}, 1 mot, fonction 0${c.fonction}.`
  items.push({ id: 't-trame', ligne: 'autre', bloc: 'trame', label: 'Trame complète en hexadécimal, CRC compris', check: (v) => checkTrame(v, req.bytes), correction: `${toHex(req.bytes)} (CRC poids faible d’abord).` })

  // 3. Réponse à interpréter
  const e = pick(ECHANGES)
  const etat = pupitreInitial()
  if (e.entrees) etat.otb.entrees = e.entrees(rnd)
  const requete = e.requete(rnd)
  const reponse = slaveRespond(etat, moduleAt(etat, requete[0]!)!, requete).reponse!
  const exception = reponse[1]! >= 0x80
  items.push(
    { id: 'r-adresse', ligne: 'autre', bloc: 'reponse', label: 'Adresse de l’esclave qui répond (hexa)', check: (v) => checkHexOctet(v, reponse[0]!), correction: `${h2(reponse[0]!)}, le premier octet.` },
    {
      id: 'r-type',
      ligne: 'autre',
      bloc: 'reponse',
      label: 'La réponse est…',
      options: ['normale', 'une exception'],
      check: (v) => checkExact(v, exception ? 'une exception' : 'normale'),
      correction: exception ? `Une exception : le 2e octet ${h2(reponse[1]!)} = fonction ${h2(reponse[1]! & 0x7f)} + 80H.` : `Normale : le 2e octet ${h2(reponse[1]!)} reprend la fonction demandée.`,
    },
    exception
      ? {
          id: 'r-valeur',
          ligne: 'autre',
          bloc: 'reponse',
          label: 'Code d’exception (hexa)',
          check: (v) => checkHexOctet(v, reponse[2]!),
          correction: `${h2(reponse[2]!)} : ${REF.exceptionLibelles.value[reponse[2]!] ?? 'code'}.`,
        }
      : {
          id: 'r-valeur',
          ligne: 'autre',
          bloc: 'reponse',
          label: reponse[1] === 6 ? 'Valeur écrite (hexa, 4 chiffres)' : 'Valeur du mot lu (hexa, 4 chiffres)',
          check: (v) => checkExact(hexNorm(v).padStart(4, '0'), toHex(reponse.slice(reponse[1] === 6 ? 4 : 3, reponse[1] === 6 ? 6 : 5)).replace(' ', '')),
          correction: `${toHex(reponse.slice(reponse[1] === 6 ? 4 : 3, reponse[1] === 6 ? 6 : 5)).replace(' ', '')}H.`,
        },
  )

  // 4. Trois questions de cours : impédance, longueur de câble, RS232 / RS485
  const cours = (['impedance', 'longueur', 'rs'] as Theme[]).map((t) => pick(COURS.filter((q) => q.theme === t)))
  for (const q of cours)
    items.push({ id: `q-${q.id}`, ligne: q.attendu as LigneNote, bloc: 'cours', label: `${q.enonce}${q.unite ? ` (${q.unite})` : ''}`, options: q.options, check: (v) => corrigerCours(q, v), correction: `${bonneReponse(q)}. ${q.justification}` })

  return { graine, manip, exercice, trame: { consigne, bytes: req.bytes }, echange: { requete, reponse }, cours, items }
}

/** Points du câblage : 1er « Faire vérifier » réussi = tout, 2e = la moitié, ensuite 0 (H52). */
export const pointsCablage = (essai: number | null) => REF.partielBareme.value.cablage * (essai === 1 ? 1 : essai === 2 ? 0.5 : 0)

export interface Note {
  lignes: { id: LigneNote; label: string; points: number; max: number }[]
  total: number
  max: number
  details: { item: ItemPartiel; reponse: string; traite: boolean; verdict: Verdict; points: number }[]
}

/** Note globale et par attendu ; une question sans réponse est « non traitée » et vaut 0. */
export function noter(sujet: Sujet, reponses: Record<string, string>, { cablageEssai, penalites }: { cablageEssai: number | null; penalites: number }): Note {
  const q = REF.partielBareme.value.question
  const details = sujet.items.map((item) => {
    const reponse = reponses[item.id] ?? ''
    const traite = reponse.trim() !== ''
    const verdict = traite ? item.check(reponse) : { ok: false, message: 'Non traitée.' }
    return { item, reponse, traite, verdict, points: traite ? q * points(verdict) : 0 }
  })
  const manip = (sujet.manip ? pointsCablage(cablageEssai) : 0) - penalites * REF.partielBareme.value.penalite
  const lignes = LIGNES.map(({ id, label }) => {
    const ds = details.filter((d) => d.item.ligne === id)
    const pts = ds.reduce((s, d) => s + d.points, 0) + (id === 'manip' ? manip : 0)
    const max = ds.length * q + (id === 'manip' && sujet.manip ? REF.partielBareme.value.cablage : 0)
    return { id, label, points: pts, max }
  }).filter((li) => li.max > 0 || li.points !== 0)
  return { lignes, total: lignes.reduce((s, li) => s + li.points, 0), max: lignes.reduce((s, li) => s + li.max, 0), details }
}

/** Temps restant (s), calculé depuis l'heure de début enregistrée : ni pause ni remise à zéro. */
export const tempsRestant = (p: { debut: number; duree: number }, maintenant: number) => p.duree - (maintenant - p.debut) / 1000
