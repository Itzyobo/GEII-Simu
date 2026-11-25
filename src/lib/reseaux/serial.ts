/**
 * Trame série asynchrone du partiel RES3 : message court émis en boucle, en TTL ou en RS-232 (V28).
 * Le format des caractères réutilise le moteur du TP2 (uartFrame / formatFrame de src/modbus/models/uart.ts) ;
 * ce fichier n'ajoute que le tirage du sujet, la source d'oscilloscope à fronts réalistes et la correction.
 */
import { RES3_SERIE } from '../../data/reference'
import { mulberry32 } from '../../au3/sim/prng'
import { tieredScore } from '../grading'
import { formatFrame, levelOf, uartFrame, type Level, type UartFormat } from '../../modbus/models/uart'
import type { Parity } from '../../modbus/data/reference'
import type { SignalSource } from '../scope/types'

export type { Level, Parity }

export interface SerialLine {
  bytes: number[]
  format: UartFormat
  baud: number
  level: Level
  /** Bits de repos avant chaque caractère */
  gaps: number[]
  /** Période de réémission — s */
  period: number
}

/** Tension d'un état logique : niveaux mesurés au TP2 (TTL 0/5 V ; RS-232 inversé ≈ +11,5 / −11,8 V), seule source */
export const voltOf = (bit: number, l: Pick<SerialLine, 'level'>) => levelOf(bit, l.level)

/** Bits émis dans une période (repos compris), à partir du 1er repos */
export function lineBits(l: SerialLine): number[] {
  return l.bytes.flatMap((b, i) => [...Array<number>(l.gaps[i] ?? 0).fill(1), ...uartFrame(b, l.format)])
}

/** Durée d'un front : TTL fixe, RS-232 = excursion / vitesse de balayage — s */
const edgeTime = (l: SerialLine) => (l.level === 'TTL' ? RES3_SERIE.frontTtl : Math.abs(voltOf(0, l) - voltOf(1, l)) / RES3_SERIE.slewRs232)

/**
 * Source d'oscilloscope : la ligne au repos, puis le message, réémis toutes les `period` secondes.
 * Fronts en rampe (contrat SignalSource : linéaire entre deux coins).
 */
export function serialSource(l: SerialLine): SignalSource {
  const tb = 1 / l.baud
  const tr = edgeTime(l)
  const bits = lineBits(l)
  // Changements d'état dans la période : instant, état avant, état après
  const changes: { t: number; from: number; to: number }[] = []
  let prev = 1
  bits.forEach((b, k) => {
    if (b !== prev) changes.push({ t: k * tb, from: prev, to: b })
    prev = b
  })
  if (prev !== 1) changes.push({ t: bits.length * tb, from: prev, to: 1 })
  const P = l.period
  const valueIn = (u: number) => {
    let lo = 0
    let hi = changes.length - 1
    let i = -1
    while (lo <= hi) {
      const m = (lo + hi) >> 1
      if ((changes[m]?.t ?? Infinity) <= u) {
        i = m
        lo = m + 1
      } else hi = m - 1
    }
    const c = changes[i]
    if (!c) return voltOf(1, l)
    const du = u - c.t
    const [va, vb] = [voltOf(c.from, l), voltOf(c.to, l)]
    return du < tr ? va + ((vb - va) * du) / tr : vb
  }
  return {
    value: (t) => valueIn(((t % P) + P) % P),
    edges: (a, b) => {
      const out: number[] = []
      for (let n = Math.floor(a / P); n * P <= b; n++)
        for (const c of changes)
          for (const t of [n * P + c.t, n * P + c.t + tr]) if (t >= a && t <= b) out.push(t)
      return out
    },
    period: P,
  }
}

/* ─────────────── Sujet tiré par graine ─────────────── */

export interface SerialExpected {
  baud: number
  parity: Parity
  level: Level
  message: string
}

export interface SerialExercise {
  seed: number
  line: SerialLine
  source: SignalSource
  /** Donné dans l'énoncé (sinon 8N1 et 7E1 sont indiscernables) */
  enonce: { dataBits: 7 | 8; stopBits: 1 | 2 }
  expected: SerialExpected
}

const PARITIES: readonly Parity[] = ['none', 'even', 'odd']
const LENTS = RES3_SERIE.debits.filter((d) => d <= RES3_SERIE.debitLentMax)
const RAPIDES = RES3_SERIE.debits.filter((d) => d > RES3_SERIE.debitLentMax)

/**
 * La parité se déduit-elle du signal ? Avec parité : il faut un caractère où P = 0 (un stop vaudrait 1).
 * Sans parité : il faut un caractère collé au précédent (le bit qui suit le stop est un start) ou des
 * caractères dont le nombre de 1 n'a pas la même parité (aucune parité constante ne colle).
 */
export function parityDecidable(l: SerialLine): boolean {
  const n = l.format.dataBits
  const ones = l.bytes.map((b) => Array.from({ length: n }, (_, k) => (b >> k) & 1).reduce((a, x) => a + x, 0) % 2)
  if (l.format.parity !== 'none') return l.bytes.some((b) => uartFrame(b, l.format)[1 + n] === 0)
  return l.gaps.slice(1).some((g) => g === 0) || new Set(ones).size > 1
}

/** Tirages au plus pour obtenir un sujet dont la parité se déduit du signal */
const MAX_TIRAGES = 40

export function createSerialExercise(seed: number): SerialExercise {
  const rnd = mulberry32(seed ^ 0x27d4eb2f)
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]
  const draw = (): SerialLine => {
    const message = pick(RES3_SERIE.mots)
    const format: UartFormat = { dataBits: rnd() < 0.5 ? 7 : 8, parity: pick(PARITIES), stopBits: rnd() < 0.5 ? 1 : 2 }
    return {
      bytes: Array.from(message, (c) => c.charCodeAt(0)),
      format,
      // Débits lents bien plus fréquents en salle (pondération : hypothèse)
      baud: pick(rnd() < RES3_SERIE.partDebitsLents ? LENTS : RAPIDES),
      level: rnd() < 0.5 ? 'TTL' : 'RS232',
      gaps: Array.from(message, () => Math.floor(rnd() * (RES3_SERIE.reposMax + 1))),
      period: RES3_SERIE.periode,
    }
  }
  // Un sujet dont la parité serait indécidable (même pour un étudiant parfait) est retiré
  let line = draw()
  for (let k = 1; k < MAX_TIRAGES && !parityDecidable(line); k++) line = draw()
  const format = line.format
  const message = String.fromCharCode(...line.bytes)
  return {
    seed,
    line,
    source: serialSource(line),
    enonce: { dataBits: format.dataBits, stopBits: format.stopBits },
    expected: { baud: line.baud, parity: format.parity, level: line.level, message },
  }
}

/* ─────────────── Correction ─────────────── */

export interface SerialAnswers {
  baud?: number
  parity?: Parity
  level?: Level
  message?: string
}

export interface CharDetail {
  expected: string
  given: string
  /** start·données·parité·stop, attendus puis tels qu'ils seraient pour le caractère donné */
  bitsExpected: string
  bitsGiven: string
  /** Bits fautifs (« D3 : attendu 1, lu 0 »), ou « caractère absent / en trop » */
  wrongBits: string
  /** Bit de parité attendu et vérification du nombre de 1 */
  parityNote: string
  ok: boolean
}

export interface SerialGrade {
  /** 1 : valeur normalisée exacte ou ±3 % ; ½ : ±10 % ; 0 sinon */
  baud: { score: number; note: string }
  parity: boolean
  level: boolean
  /** Part des caractères justes, rapportée au plus long des deux messages */
  message: { score: number }
  chars: CharDetail[]
}

const PARITY_FR: Record<Parity, string> = { none: 'aucune', even: 'paire', odd: 'impaire' }
export const parityFr = (p: Parity) => PARITY_FR[p]

/** Nom du bit k d'une trame : start, D0 (poids faible)…, P, stop */
function bitName(k: number, f: UartFormat): string {
  if (k === 0) return 'start'
  if (k <= f.dataBits) return `D${k - 1}`
  if (f.parity !== 'none' && k === f.dataBits + 1) return 'P'
  return 'stop'
}

export function gradeSerial(ex: SerialExercise, a: SerialAnswers): SerialGrade {
  const e = ex.expected
  const f = ex.line.format
  const baudScore = a.baud === e.baud ? 1 : tieredScore(a.baud ?? NaN, e.baud, RES3_SERIE.tolDebit, RES3_SERIE.tolDebitMoitie)
  const baudNote =
    a.baud === e.baud
      ? `${e.baud} bauds`
      : baudScore === 1
        ? `valeur mesurée acceptée (±3 %), valeur normalisée : ${e.baud} bauds`
        : baudScore === 0.5
          ? `à moins de 10 % : moitié des points ; valeur normalisée ${e.baud} bauds`
          : `attendu ${e.baud} bauds (bit de ${(1e6 / e.baud).toFixed(2).replace('.', ',')} µs)`
  const given = a.message ?? ''
  const frameOf = (c: string) => uartFrame(c.charCodeAt(0), f)
  const n = Math.max(e.message.length, given.length)
  const chars = Array.from({ length: n }, (_, i): CharDetail => {
    const c = e.message[i]
    const g = given[i]
    const parityNote = (() => {
      if (c === undefined) return ''
      const code = c.charCodeAt(0)
      const ones = Array.from({ length: f.dataBits }, (_, k) => (code >> k) & 1).reduce((x, b) => x + b, 0)
      const par = f.parity === 'none' ? 'pas de parité' : `${ones} bit(s) à 1 dans les données ⇒ P = ${frameOf(c)[1 + f.dataBits]} (parité ${PARITY_FR[f.parity]})`
      return `${code.toString(16).toUpperCase().padStart(2, '0')}h : ${par}`
    })()
    const fe = c === undefined ? null : frameOf(c)
    const fg = g === undefined ? null : frameOf(g)
    const wrongBits = !fe ? 'caractère en trop' : !fg ? 'caractère absent' : fe.flatMap((b, k) => (b === fg[k] ? [] : [`${bitName(k, f)} : attendu ${b}, lu ${fg[k]}`])).join(', ')
    return {
      expected: c ?? '',
      given: g ?? '',
      bitsExpected: fe ? formatFrame(fe, f) : '—',
      bitsGiven: fg ? formatFrame(fg, f) : '—',
      wrongBits,
      parityNote,
      ok: c !== undefined && g === c,
    }
  })
  return {
    baud: { score: baudScore, note: baudNote },
    parity: a.parity === e.parity,
    level: a.level === e.level,
    message: { score: n === 0 ? 0 : chars.filter((c) => c.ok).length / n },
    chars,
  }
}
