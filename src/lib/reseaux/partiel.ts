/**
 * Partiel pratique RES3 (1 h 30, fascicule seul, sans Modbus) : sujet tiré par graine (câble, trame série, ping),
 * correction au barème RES3_PARTIEL, session en sessionStorage (reprise après rechargement, chrono qui continue)
 * et historique des tentatives en localStorage. Logique pure, testée sans React.
 */
import { RES3, RES3_PARTIEL } from '../../data/reference'
import { parseAnswer } from '../grading'
import { createCoaxExercise, gamma, gradeCoax } from './coax'
import { createSerialExercise, gradeSerial, parityFr, type Level, type Parity, type SerialExercise } from './serial'
import { createPingExercise, gradePing } from './traffic'
import type { Topology } from './benchTopology'

export const PARTIES = ['Câble coaxial', 'Trame série', 'Ping Ethernet'] as const
export type PartIndex = 0 | 1 | 2

export interface PartielSubject {
  seed: number
  coax: ReturnType<typeof createCoaxExercise>
  serie: SerialExercise
  ping: ReturnType<typeof createPingExercise>
}

/** Sujet complet : même graine ⇒ même sujet */
export const subjectOf = (seed: number): PartielSubject => ({ seed, coax: createCoaxExercise(seed), serie: createSerialExercise(seed), ping: createPingExercise(seed) })

export type Methode = '' | 'amplitude' | 'adaptation' | 'les-deux' | 'ohmmetre'
export const METHODES: [Exclude<Methode, ''>, string][] = [
  ['amplitude', 'Amplitude incidente : Zc = Zg·Ei/(Eg − Ei)'],
  ['adaptation', 'Adaptation : potentiomètre réglé jusqu’à disparition de l’écho, lu à l’ohmmètre'],
  ['les-deux', 'Les deux méthodes, concordantes'],
  ['ohmmetre', 'Ohmmètre branché directement sur le câble'],
]

export interface PartielAnswers {
  cable: { zc: string; l: string; gammaOpen: string; gammaShort: string; methode: Methode }
  serie: { baud: string; parity: Parity | ''; level: Level | ''; message: string }
  ping: { L: string; padding: string; durationUs: string; macByte: string }
}

export const emptyAnswers = (): PartielAnswers => ({
  cable: { zc: '', l: '', gammaOpen: '', gammaShort: '', methode: '' },
  serie: { baud: '', parity: '', level: '', message: '' },
  ping: { L: '', padding: '', durationUs: '', macByte: '' },
})

/** « A4 », « a4h », « 0xA4 » → 164 ; NaN si illisible */
export function parseHexByte(s: string): number {
  const t = s.trim().replace(/^0x/i, '').replace(/h$/i, '')
  return /^[0-9a-f]{1,2}$/i.test(t) ? parseInt(t, 16) : NaN
}

export interface Line {
  part: PartIndex
  label: string
  given: string
  expected: string
  /** 1, ½, prorata (message) ou 0 */
  score: number
  ok: boolean
  pts: number
  max: number
  /** Calcul pas à pas */
  calcul: string
}

export interface PartielResult {
  note: number
  parts: { name: string; pts: number; max: number; conseil: string }[]
  lines: Line[]
}

const fr = (v: number, d = 4) => String(Number(v.toPrecision(d))).replace('.', ',')
const hex2 = (b: number) => b.toString(16).toUpperCase().padStart(2, '0')
const LEVEL_FR: Record<Level, string> = { TTL: 'TTL (0/5 V, repos à 5 V)', RS232: 'RS-232 / V28 (logique inversée, ±10 V, repos à −10 V)' }
export const levelFr = (l: Level) => LEVEL_FR[l]

const CONSEILS = [
  'CH1 2 V/div (puis 1 V/div), 0 V centré, DC · 100 ns/div, réf. gauche · Normal, front montant CH1 à Ei/2 · Single, curseurs sur l’incident et l’écho ; extrémité ouverte, puis court-circuit, puis potentiomètre.',
  'Auto Scale pour trouver la ligne, puis : CH1 2 V/div (TTL) ou 5 V/div (RS-232) · Normal, déclenchement sur le front qui quitte le repos (descendant en TTL, montant en RS-232) · s/div pour voir tout le message · Single, curseurs sur un bit isolé (durée d’un bit).',
  'CH1 0,5 V/div, 0 V centré, DC · 10 µs/div, réf. gauche · Normal, front descendant CH1 à −0,1 V · Single (ignorer ARP et broadcasts), curseurs X du début du préambule à la fin de la trame ; zoom pour compter le bourrage et lire la MAC après le « 11 » du SFD.',
]

/** Correction complète au barème RES3_PARTIEL ; les points dégressifs viennent de gradeCoax / gradeSerial / gradePing. */
export function gradePartiel(s: PartielSubject, a: PartielAnswers): PartielResult {
  const B = RES3_PARTIEL.PARTIEL_BAREME
  const lines: Line[] = []
  const add = (part: PartIndex, label: string, given: string, expected: string, score: number, max: number, calcul: string) =>
    lines.push({ part, label, given: given.trim() || '—', expected, score, ok: score === 1, pts: score * max, max, calcul })
  const half = (score: number) => (score === 0.5 ? ' Écart entre les deux seuils : moitié des points.' : '')

  // 1. Câble
  const { cable, expected: ce } = s.coax
  const gc = gradeCoax(ce, { Zc: parseAnswer(a.cable.zc), l: parseAnswer(a.cable.l), gammaOpen: parseAnswer(a.cable.gammaOpen), gammaShort: parseAnswer(a.cable.gammaShort) })
  const sc = (k: keyof typeof ce) => gc.details.find((d) => d.key === k)?.score ?? 0
  const Ei = (RES3.eg * cable.Zc) / (RES3.zg + cable.Zc)
  const dt = (2 * cable.l) / RES3.v
  add(0, 'Impédance caractéristique Zc (Ω)', a.cable.zc, `${ce.Zc} Ω`, sc('Zc'), B.cable.zc, `Ei = Eg·Zc/(Zg + Zc) = 8 × ${ce.Zc}/(50 + ${ce.Zc}) = ${fr(Ei)} V ⇒ Zc = Zg·Ei/(Eg − Ei) = 50 × ${fr(Ei)}/(8 − ${fr(Ei)}) = ${ce.Zc} Ω. Plein à ±5 %, moitié à ±10 %.${half(sc('Zc'))}`)
  add(0, 'Longueur l (m)', a.cable.l, `${ce.l} m`, sc('l'), B.cable.l, `Retard de l’écho Δt = 2l/v = ${fr(dt * 1e6)} µs ⇒ l = v·Δt/2 = 2·10⁸ × ${fr(dt * 1e6)}·10⁻⁶ / 2 = ${ce.l} m. Contrôle : N·π·D = ${cable.N}·π·${fr(cable.D)} = ${fr(cable.N * Math.PI * cable.D)} m. Plein à ±5 %, moitié à ±10 %.${half(sc('l'))}`)
  add(0, 'Γ en circuit ouvert', a.cable.gammaOpen, '+1', sc('gammaOpen'), B.cable.gammaOpen, `Γ = (ZL − Zc)/(ZL + Zc) → ${gamma(Infinity, ce.Zc)} quand ZL → ∞ : écho de même signe (atténué par les pertes).`)
  add(0, 'Γ en court-circuit', a.cable.gammaShort, '−1', sc('gammaShort'), B.cable.gammaShort, 'Γ = (0 − Zc)/(0 + Zc) = −1 : écho inversé.')
  const methodeOk = a.cable.methode === 'amplitude' || a.cable.methode === 'adaptation' || a.cable.methode === 'les-deux'
  add(0, 'Méthode utilisée pour Zc', METHODES.find(([k]) => k === a.cable.methode)?.[1] ?? '', 'amplitude incidente ou adaptation', methodeOk ? 1 : 0, B.cable.methode, 'Deux méthodes valables : amplitude incidente (pont diviseur Zg/Zc à t = 0⁺) ou adaptation au potentiomètre. L’ohmmètre sur le câble mesure une résistance de fils, pas Zc.')

  // 2. Trame série
  const se = s.serie.expected
  const g = gradeSerial(s.serie, { baud: parseAnswer(a.serie.baud), parity: a.serie.parity || undefined, level: a.serie.level || undefined, message: a.serie.message })
  const fmt = s.serie.line.format
  add(1, 'Débit (bauds)', a.serie.baud, `${se.baud} bauds`, g.baud.score, B.serie.baud, `Durée d’un bit isolé Tb = ${fr(1e6 / se.baud)} µs ⇒ D = 1/Tb = ${se.baud} bauds. Plein : valeur normalisée ou ±3 % ; moitié : ±10 %. ${g.baud.note}.`)
  add(1, 'Parité', a.serie.parity ? parityFr(a.serie.parity) : '', parityFr(se.parity), g.parity ? 1 : 0, B.serie.parity, `Format donné : ${fmt.dataBits} bits de données, ${fmt.stopBits} stop(s). ${g.chars.filter((c) => c.parityNote).map((c) => c.parityNote).join(' ; ')}.`)
  add(1, 'Norme', a.serie.level ? levelFr(a.serie.level) : '', levelFr(se.level), g.level ? 1 : 0, B.serie.level, se.level === 'TTL' ? 'Niveaux 0 / 5 V, repos au niveau haut, start = front descendant.' : 'Niveaux ≈ +11,5 / −11,8 V, repos négatif (1 logique), start = front montant : logique inversée.')
  add(
    1,
    'Message (casse comprise)',
    a.serie.message,
    `« ${se.message} »`,
    g.message.score,
    B.serie.message,
    `Points au prorata des caractères justes (${g.chars.filter((c) => c.ok).length}/${g.chars.length}). ` +
      g.chars.map((c) => (c.ok ? `« ${c.expected} » ${c.bitsExpected} ✓` : `« ${c.expected || '∅'} » ${c.bitsExpected}, vous « ${c.given || '∅'} » ${c.bitsGiven} : ${c.wrongBits}`)).join(' ; ') +
      ' — start·données (D0 = poids faible, émis en premier)·parité·stop.',
  )

  // 3. Ping
  const pe = s.ping.expected
  const gp = gradePing(pe, { L: parseAnswer(a.ping.L), paddingBytes: parseAnswer(a.ping.padding), durationUs: parseAnswer(a.ping.durationUs), firstMacDstByte: parseHexByte(a.ping.macByte) })
  const sp = (k: keyof typeof pe) => gp.details.find((d) => d.key === k)?.score ?? 0
  add(2, 'L (ping -l L)', a.ping.L, `ping -l ${pe.L} ${s.ping.to.ip.join('.')}`, sp('L'), B.ping.L, pe.L < 18 ? `Trame minimale (72 octets, 57,6 µs) : L = 18 − bourrage = 18 − ${pe.paddingBytes} = ${pe.L}.` : `T = ${fr(pe.durationUs)} µs ⇒ L = T/0,8 µs − 54 = ${pe.L} (54 = 8 préambule/SFD + 14 Ethernet + 20 IP + 8 ICMP + 4 FCS).`)
  add(2, 'Octets de bourrage', a.ping.padding, String(pe.paddingBytes), sp('paddingBytes'), B.ping.padding, `Charge = 20 + 8 + L = ${28 + pe.L} octets ; bourrage = max(0, 46 − ${28 + pe.L}) = ${pe.paddingBytes}.`)
  add(2, 'Durée de la trame sur le câble (µs)', a.ping.durationUs, `${fr(pe.durationUs)} µs`, sp('durationUs'), B.ping.durationUs, `${pe.frameBytesOnWire} octets (préambule et FCS compris) × 0,8 µs = ${fr(pe.durationUs)} µs. Plein à ±2 %, moitié à ±5 %.${half(sp('durationUs'))}`)
  add(2, '1er octet de la MAC destination (hexa)', a.ping.macByte, `${hex2(pe.firstMacDstByte)}h`, sp('firstMacDstByte'), B.ping.macByte, `Après le « 11 » final du SFD, 8 bits émis poids faible en premier : ${pe.firstMacDstByte.toString(2).padStart(8, '0').split('').reverse().join('')} ⇒ ${hex2(pe.firstMacDstByte)}h (MAC ${s.ping.to.mac.map(hex2).join(':')}).`)

  const parts = PARTIES.map((name, i) => {
    const ls = lines.filter((l) => l.part === i)
    return { name, pts: ls.reduce((x, l) => x + l.pts, 0), max: ls.reduce((x, l) => x + l.max, 0), conseil: CONSEILS[i] ?? '' }
  })
  return { note: parts.reduce((x, p) => x + p.pts, 0), parts, lines }
}

/* ─────────────── Session (sessionStorage) et historique (localStorage) ─────────────── */

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
const SESSION_KEY = 'tpsim.res3.partiel.v1'
const HISTORY_KEY = 'tpsim.res3.partiel.historique'
const safe = (get: () => StorageLike | undefined): StorageLike | null => {
  try {
    return get() ?? null
  } catch {
    return null
  }
}
const sess = () => safe(() => globalThis.sessionStorage)
const local = () => safe(() => globalThis.localStorage)

export interface PartielSession {
  v: 1
  seed: number
  mode: 'exam' | 'train'
  /** ms (Date.now) */
  startAt: number
  answers: PartielAnswers
  tab: PartIndex
  /** Temps passé par partie — ms */
  partMs: [number, number, number]
  /** Arrivée sur l'onglet courant — ms */
  tabSince: number
  submittedAt?: number
  /** Erreurs de montage relevées sur le banc de la partie 1 (montrées à la correction, sans pénalité) */
  montage?: string[]
}

export const newSession = (seed: number, mode: PartielSession['mode'], now: number): PartielSession => ({ v: 1, seed, mode, startAt: now, answers: emptyAnswers(), tab: 0, partMs: [0, 0, 0], tabSince: now })

/** Change d'onglet en comptant le temps passé sur le précédent */
export function switchTab(s: PartielSession, tab: PartIndex, now: number): PartielSession {
  const partMs = [...s.partMs] as PartielSession['partMs']
  partMs[s.tab] += Math.max(0, now - s.tabSince)
  return { ...s, tab, partMs, tabSince: now }
}

/** Temps restant (mode examen) — s */
export const remainingS = (s: PartielSession, now: number) => RES3_PARTIEL.dureeS - (now - s.startAt) / 1000

export function submit(s: PartielSession, now: number): PartielSession {
  // L'épreuve s'arrête au plus tard à la fin du chrono
  const end = s.mode === 'exam' ? Math.min(now, s.startAt + RES3_PARTIEL.dureeS * 1000) : now
  return { ...switchTab(s, s.tab, end), submittedAt: end }
}

export function saveSession(s: PartielSession | null, storage = sess()) {
  try {
    if (s) storage?.setItem(SESSION_KEY, JSON.stringify(s))
    else storage?.removeItem(SESSION_KEY)
  } catch {
    /* stockage indisponible : pas de reprise après rechargement */
  }
}

export function loadSession(storage = sess()): PartielSession | null {
  try {
    const raw = storage?.getItem(SESSION_KEY)
    const s = raw ? (JSON.parse(raw) as PartielSession) : null
    return s && s.v === 1 && Number.isInteger(s.seed) ? s : null
  } catch {
    return null
  }
}

export interface HistoryEntry {
  /** ISO 8601 */
  date: string
  seed: number
  mode: PartielSession['mode']
  note: number
  parts: number[]
}

export function loadHistory(storage = local()): HistoryEntry[] {
  try {
    const h = JSON.parse(storage?.getItem(HISTORY_KEY) ?? '[]') as HistoryEntry[]
    return Array.isArray(h) ? h : []
  } catch {
    return []
  }
}

export function addHistory(e: HistoryEntry, storage = local()) {
  try {
    storage?.setItem(HISTORY_KEY, JSON.stringify([...loadHistory(storage), e]))
  } catch {
    /* historique non conservé */
  }
}

/** Erreur de montage à relever pour une topologie du banc (null si rien à signaler) */
export function montageIssue(t: Topology): string | null {
  if (!t.ok) return t.error ?? 'montage non pris en charge'
  if (t.line === 'coax' && t.observe[0] === 'B') return 'câble long branché directement sur CH1, sans Té : CH1 ne voyait que le bout du câble, pas la sortie du générateur'
  if (t.genConnected && t.observe[0] === 'flat') return 'CH1 branchée sur une partie du montage non reliée au générateur : trace plate'
  return null
}

/** Ajoute une erreur de montage à la session (sans doublon, 8 au plus) */
export const withMontageIssue = (s: PartielSession, issue: string | null): PartielSession =>
  !issue || (s.montage ?? []).includes(issue) ? s : { ...s, montage: [...(s.montage ?? []), issue].slice(-8) }

/** Réponses justes d'un sujet (tests, contrôle Playwright) */
export function correctAnswers(s: PartielSubject): PartielAnswers {
  return {
    cable: { zc: String(s.coax.expected.Zc), l: String(s.coax.expected.l), gammaOpen: '1', gammaShort: '-1', methode: 'les-deux' },
    serie: { baud: String(s.serie.expected.baud), parity: s.serie.expected.parity, level: s.serie.expected.level, message: s.serie.expected.message },
    ping: { L: String(s.ping.expected.L), padding: String(s.ping.expected.paddingBytes), durationUs: String(s.ping.expected.durationUs), macByte: hex2(s.ping.expected.firstMacDstByte) },
  }
}
