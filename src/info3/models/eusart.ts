/**
 * EUSART asynchrone du PIC16F18875 (cours p. 104 à 110) et décodeur de trames série (terminal, réception).
 * - baud = Fosc / (diviseur × (SPBRG + 1)), diviseur 4 (BRG16 = BRGH = 1), 16 (un seul des deux) ou 64 ;
 * - trame 8N1 : start à 0, 8 bits de données LSB en premier, stop à 1, soit 10 bits au baud réel ;
 * - émission à double tampon : TXREG puis registre à décalage (TSR). TXIF = TXREG vide, TRMT = TSR vide ;
 * - réception : FIFO de 2 octets, RCIF = FIFO non vide, OERR au 3e octet (réception figée jusqu'à CREN = 0).
 * Le décodeur rééchantillonne un signal (fronts datés) au milieu des bits de SON baud : un terminal réglé à
 * un autre baud que l'émetteur lit donc des caractères corrompus (H47).
 */
import { INFO3 } from '../../data/reference'
import type { Level } from './gpio'

const E = INFO3.eusart
const BYTE = (1 << INFO3.c.bitsPerByte) - 1

/* ───────────── Baud ───────────── */

export const brgDivider = (brg16: boolean, brgh: boolean) => (brg16 && brgh ? E.divider.brg16brgh : brg16 || brgh ? E.divider.one : E.divider.none)

/** Baud réel — bauds */
export const baudOf = (fosc: number, brg16: boolean, brgh: boolean, spbrg: number) => fosc / (brgDivider(brg16, brgh) * (spbrg + 1))

/** SPBRG calculé par MCC pour un baud demandé (arrondi), BRG16 = BRGH = 1 par défaut */
export function spbrgFor(fosc: number, baud: number, brg16 = true, brgh = true): number {
  return Math.max(0, Math.round(fosc / (brgDivider(brg16, brgh) * baud)) - 1)
}

/** Erreur relative (réel − demandé) / demandé */
export const baudError = (actual: number, wanted: number) => (actual - wanted) / wanted

/* ───────────── Trames ───────────── */

export interface UartFormat {
  dataBits: number
  parity: 'none' | 'even' | 'odd'
  stopBits: number
}

export const FORMAT_8N1: UartFormat = { dataBits: E.dataBits, parity: 'none', stopBits: E.stopBits }

const ones = (v: number, n: number) => {
  let c = 0
  for (let i = 0; i < n; i++) c += (v >> i) & 1
  return c
}
const parityBit = (v: number, f: UartFormat): Level => {
  const odd = ones(v, f.dataBits) & 1
  return (f.parity === 'even' ? odd : 1 - odd) as Level
}

/** Nombre de bits d'une trame : start + données + parité + stop */
export const frameLength = (f: UartFormat) => 1 + f.dataBits + (f.parity === 'none' ? 0 : 1) + f.stopBits

/** Niveaux successifs d'une trame : start (0), données LSB en premier, parité, stop (1) */
export function frameBits(byte: number, f: UartFormat = FORMAT_8N1): Level[] {
  const out: Level[] = [0]
  for (let i = 0; i < f.dataBits; i++) out.push(((byte >> i) & 1) as Level)
  if (f.parity !== 'none') out.push(parityBit(byte, f))
  for (let i = 0; i < f.stopBits; i++) out.push(1)
  return out
}

export interface DecodedByte {
  byte: number
  /** Instant du front de start — ticks */
  t: number
  /** Stop lu à 0 */
  framingError: boolean
  parityError: boolean
}

/**
 * Récepteur série : fronts datés d'une ligne au repos à 1 ; décode au milieu de chaque bit de son baud,
 * à partir du front descendant du start. `flush(now)` rend les octets dont le dernier échantillon est passé.
 */
export class UartDecoder {
  private edges: { t: number; level: Level }[] = []
  /** Niveau de la ligne avant le premier front gardé */
  private base: Level
  bitTicks: number
  format: UartFormat

  constructor(bitTicks: number, format: UartFormat = FORMAT_8N1, idle: Level = 1) {
    this.bitTicks = bitTicks
    this.format = format
    this.base = idle
  }

  /** Change de baud ou de format : les fronts pas encore décodés sont relus avec les nouveaux réglages */
  configure(bitTicks: number, format: UartFormat) {
    this.bitTicks = bitTicks
    this.format = format
  }

  edge(t: number, level: Level) {
    const last = this.edges.length ? this.edges[this.edges.length - 1].level : this.base
    if (last !== level) this.edges.push({ t, level })
  }

  private levelAt(t: number): Level {
    let l = this.base
    for (const e of this.edges) {
      if (e.t > t) break
      l = e.level
    }
    return l
  }

  /** Instant du prochain front de start (descendant) à traiter, null s'il n'y en a pas */
  nextStart(): number | null {
    let prev = this.base
    for (const e of this.edges) {
      if (prev === 1 && e.level === 0) return e.t
      prev = e.level
    }
    return null
  }

  /** Instant du dernier échantillon d'une trame commencée à t0 */
  frameEnd(t0: number) {
    return t0 + (frameLength(this.format) - 1 + INFO3.terminal.samplePoint) * this.bitTicks
  }

  flush(now: number): DecodedByte[] {
    const out: DecodedByte[] = []
    const f = this.format
    for (;;) {
      const t0 = this.nextStart()
      if (t0 === null) {
        // Rien en cours : les fronts anciens ne servent plus
        if (this.edges.length) {
          this.base = this.edges[this.edges.length - 1].level
          this.edges = []
        }
        return out
      }
      const end = this.frameEnd(t0)
      if (end > now) {
        // Trame en cours : on oublie seulement ce qui précède son start
        const i = this.edges.findIndex((e) => e.t === t0)
        if (i > 0) {
          this.base = this.edges[i - 1].level
          this.edges = this.edges.slice(i)
        }
        return out
      }
      const at = (k: number) => this.levelAt(t0 + (k + INFO3.terminal.samplePoint) * this.bitTicks)
      let byte = 0
      for (let i = 0; i < f.dataBits; i++) byte |= at(1 + i) << i
      const pIdx = 1 + f.dataBits
      const parityError = f.parity !== 'none' && at(pIdx) !== parityBit(byte, f)
      const stopIdx = pIdx + (f.parity === 'none' ? 0 : 1)
      let framingError = false
      for (let s = 0; s < f.stopBits; s++) if (at(stopIdx + s) !== 1) framingError = true
      out.push({ byte: byte & BYTE, t: t0, framingError, parityError })
      // Les fronts jusqu'au dernier échantillon sont consommés
      const keep = this.edges.findIndex((e) => e.t > end)
      const lvl = this.levelAt(end)
      this.edges = keep < 0 ? [] : this.edges.slice(keep)
      this.base = lvl
    }
  }

  reset(idle: Level = 1) {
    this.edges = []
    this.base = idle
  }
}

/* ───────────── Émetteur de l'EUSART ───────────── */

export interface EusartHost {
  now(): number
  schedule(t: number, fn: () => void): void
  /** Niveau de la sortie TX (avant PPS) */
  setTx(level: Level, t: number): void
  /** TXIF, TRMT ou RCIF ont changé */
  flags(): void
}

export class EusartTx {
  private txreg: number | null = null
  private busy = false
  private gen = 0
  /** Durée d'un bit — ticks */
  bitTicks = Infinity
  enabled = false
  level: Level = 1
  /** Octets émis (instant du start en ticks) : professeur virtuel et tests */
  readonly sent: { t: number; byte: number }[] = []
  private readonly host: EusartHost

  constructor(host: EusartHost) {
    this.host = host
  }

  reset() {
    this.txreg = null
    this.busy = false
    this.gen++
    this.enabled = false
    this.sent.length = 0
    this.setLevel(1)
  }

  /** TXIF : TXREG vide (et émetteur validé) */
  get txif(): boolean {
    return this.enabled && this.txreg === null
  }
  /** TRMT : registre à décalage vide */
  get trmt(): boolean {
    return !this.busy
  }

  configure(enabled: boolean, bitTicks: number) {
    const was = this.enabled
    this.enabled = enabled
    this.bitTicks = bitTicks
    if (!enabled && was) {
      // TXEN = 0 : émission interrompue, TX au repos
      this.gen++
      this.busy = false
      this.txreg = null
      this.setLevel(1)
    }
    this.host.flags()
  }

  write(v: number) {
    if (!this.enabled || !Number.isFinite(this.bitTicks)) return
    if (!this.busy) this.start(v & BYTE)
    else this.txreg = v & BYTE
    this.host.flags()
  }

  private setLevel(l: Level) {
    if (l === this.level) return
    this.level = l
    this.host.setTx(l, this.host.now())
  }

  private start(v: number) {
    const g = this.gen
    const t0 = this.host.now()
    this.busy = true
    this.sent.push({ t: t0, byte: v })
    const bits = frameBits(v)
    let prev: Level = this.level
    bits.forEach((b, i) => {
      if (b === prev) return
      prev = b
      if (i === 0) this.setLevel(b)
      else
        this.host.schedule(Math.round(t0 + i * this.bitTicks), () => {
          if (g === this.gen) this.setLevel(b)
        })
    })
    this.host.schedule(Math.round(t0 + bits.length * this.bitTicks), () => {
      if (g !== this.gen) return
      this.busy = false
      const next = this.txreg
      this.txreg = null
      if (next !== null) this.start(next)
      this.host.flags()
    })
  }
}
