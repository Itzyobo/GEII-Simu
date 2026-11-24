/**
 * Trame série asynchrone du partiel RES3 : message court émis en boucle, en TTL ou en RS-232 (V28).
 * Le format des caractères réutilise le moteur du TP2 (uartFrame / formatFrame de src/modbus/models/uart.ts) ;
 * ce fichier n'ajoute que le tirage du sujet, la source d'oscilloscope à fronts réalistes et la correction.
 */
import { RES3_SERIE } from '../../data/reference'
import { mulberry32 } from '../../au3/sim/prng'
import { formatFrame, uartFrame, type Level, type UartFormat } from '../../modbus/models/uart'
import type { Parity } from '../../modbus/data/reference'
import type { SignalSource } from '../scope/types'

export type { Level, Parity }

export interface SerialLine {
  bytes: number[]
  format: UartFormat
  baud: number
  level: Level
  /** Niveau RS-232 de ce transmetteur, en valeur absolue — V */
  amplitude: number
  /** Bits de repos avant chaque caractère */
  gaps: number[]
  /** Période de réémission — s */
  period: number
}

/** Tension d'un état logique : TTL 0/5 V ; RS-232 inversé (1 = −A, 0 = +A) */
export const voltOf = (bit: number, l: Pick<SerialLine, 'level' | 'amplitude'>) =>
  l.level === 'TTL' ? (bit ? RES3_SERIE.ttlHaut : RES3_SERIE.ttlBas) : bit ? -l.amplitude : l.amplitude

/** Bits émis dans une période (repos compris), à partir du 1er repos */
export function lineBits(l: SerialLine): number[] {
  return l.bytes.flatMap((b, i) => [...Array<number>(l.gaps[i] ?? 0).fill(1), ...uartFrame(b, l.format)])
}

/** Durée d'un front : TTL fixe, RS-232 = excursion / vitesse de balayage — s */
const edgeTime = (l: SerialLine) => (l.level === 'TTL' ? RES3_SERIE.frontTtl : (2 * l.amplitude) / RES3_SERIE.slewRs232)

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

export function createSerialExercise(seed: number): SerialExercise {
  const rnd = mulberry32(seed ^ 0x27d4eb2f)
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]
  const message = pick(RES3_SERIE.mots)
  const format: UartFormat = { dataBits: rnd() < 0.5 ? 7 : 8, parity: pick(PARITIES), stopBits: rnd() < 0.5 ? 1 : 2 }
  const line: SerialLine = {
    bytes: Array.from(message, (c) => c.charCodeAt(0)),
    format,
    baud: pick(RES3_SERIE.debits),
    level: rnd() < 0.5 ? 'TTL' : 'RS232',
    amplitude: RES3_SERIE.rs232 + (2 * rnd() - 1) * RES3_SERIE.rs232Ecart,
    gaps: Array.from(message, () => Math.floor(rnd() * (RES3_SERIE.reposMax + 1))),
    period: RES3_SERIE.periode,
  }
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
  /** Bit de parité attendu et vérification du nombre de 1 */
  parityNote: string
  ok: boolean
}

export interface SerialGrade {
  baud: { ok: boolean; note: string }
  parity: boolean
  level: boolean
  message: boolean
  chars: CharDetail[]
}

const PARITY_FR: Record<Parity, string> = { none: 'aucune', even: 'paire', odd: 'impaire' }
export const parityFr = (p: Parity) => PARITY_FR[p]

/** Débit juste : valeur normalisée exacte, ou valeur mesurée à ±3 % (la correction rappelle la valeur normalisée). */
export function gradeSerial(ex: SerialExercise, a: SerialAnswers): SerialGrade {
  const e = ex.expected
  const f = ex.line.format
  const exact = a.baud === e.baud
  const close = a.baud !== undefined && Math.abs(a.baud - e.baud) <= RES3_SERIE.tolDebit * e.baud
  const baudNote = exact ? `${e.baud} bauds` : close ? `valeur mesurée acceptée (±3 %), valeur normalisée : ${e.baud} bauds` : `attendu ${e.baud} bauds (bit de ${(1e6 / e.baud).toFixed(2).replace('.', ',')} µs)`
  const given = a.message ?? ''
  const bitsOf = (c: string | undefined) => (c === undefined ? '—' : formatFrame(uartFrame(c.charCodeAt(0), f), f))
  const chars = Array.from(e.message, (c, i): CharDetail => {
    const g = given[i]
    const code = c.charCodeAt(0)
    const ones = Array.from({ length: f.dataBits }, (_, k) => (code >> k) & 1).reduce((s, b) => s + b, 0)
    const par = f.parity === 'none' ? 'pas de parité' : `${ones} bit(s) à 1 dans les données ⇒ P = ${uartFrame(code, f)[1 + f.dataBits]} (parité ${PARITY_FR[f.parity]})`
    return { expected: c, given: g ?? '', bitsExpected: bitsOf(c), bitsGiven: bitsOf(g), parityNote: `${code.toString(16).toUpperCase().padStart(2, '0')}h : ${par}`, ok: g === c }
  })
  return { baud: { ok: exact || close, note: baudNote }, parity: a.parity === e.parity, level: a.level === e.level, message: given === e.message, chars }
}
