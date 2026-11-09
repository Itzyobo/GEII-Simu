/**
 * MSSP1 en SPI maître (cours p. 71 à 74, PRD §4.3) : MSB en premier, 8 périodes de SCK par octet,
 * SCK au repos = CKP. La donnée change sur le front indiqué par CKE (1 : actif → repos, 0 : repos → actif)
 * et se lit sur l'autre front (SMP = 1 : à la fin du bit). SSP1IF et BF à la fin de l'octet ;
 * écriture de SSP1BUF pendant un transfert : WCOL = 1, octet ignoré.
 * Modes 1 et 2 (donnée qui change au front montant) : le premier bit n'est pas présenté avant le premier
 * front montant (H14), ce qui reproduit le décalage d'un rang vu par le 74HC595.
 * Ordre à chaque front : lecture de MISO, puis SCK, puis MOSI (le registre du 74HC595 voit l'ancien bit).
 */
import { INFO3 } from '../../data/reference'
import type { Level } from './gpio'

const BITS = INFO3.c.bitsPerByte
const BYTE = (1 << BITS) - 1
const MSB = BITS - 1
/** SSP1STAT : SMP<7>, CKE<6>, BF<0> ; SSP1CON1 : WCOL<7>, SSPOV<6>, SSPEN<5>, CKP<4>, SSPM<3:0> */
const STAT_SMP = 1 << 7
const STAT_CKE = 1 << 6
const STAT_BF = 1
const STAT_WRITABLE = STAT_SMP | STAT_CKE
const CON1_WCOL = 1 << 7
const CON1_SSPEN = 1 << 5
const CON1_CKP = 1 << 4
const SSPM_MASK = 0b1111
/** Fronts d'un octet (2 par bit) ; l'indice EDGES désigne la fin du dernier bit */
const EDGES = 2 * BITS

export interface SpiHost {
  now(): number
  schedule(t: number, fn: () => void): void
  /** Période de SCK (ticks) pour SSPM et SSP1ADD ; Infinity = pas d'horloge */
  sckPeriodTicks(sspm: number, add: number): number
  setSck(level: Level): void
  setSdo(level: Level): void
  readSdi(): Level
  raiseFlag(): void
}

export interface SpiByte {
  tx: number
  rx: number
  /** Début et fin du transfert — ticks */
  t0: number
  t1: number
  mode: number
}

export class MsspSpi {
  stat = 0
  con1 = 0
  add = 0
  /** Octet reçu (lu dans SSP1BUF) */
  buf = 0
  busy = false
  sck: Level = 0
  sdo: Level = 0
  /** Octets transférés (instruments, tests) */
  readonly bytes: SpiByte[] = []
  onByte: ((b: SpiByte) => void) | null = null
  private readonly host: SpiHost
  private gen = 0

  constructor(host: SpiHost) {
    this.host = host
  }

  reset() {
    this.stat = 0
    this.con1 = 0
    this.add = 0
    this.buf = 0
    this.busy = false
    this.gen++
    this.bytes.length = 0
    this.drive(0, 0)
  }

  get enabled() {
    return (this.con1 & CON1_SSPEN) !== 0
  }
  get ckp(): Level {
    return this.con1 & CON1_CKP ? 1 : 0
  }
  get cke() {
    return (this.stat & STAT_CKE) !== 0
  }
  get mode(): number {
    return INFO3.spi.modes.find((m) => m.ckp === this.ckp && m.cke === (this.cke ? 1 : 0))!.mode
  }

  private drive(sck: Level, sdo: Level) {
    if (sck !== this.sck) {
      this.sck = sck
      this.host.setSck(sck)
    }
    if (sdo !== this.sdo) {
      this.sdo = sdo
      this.host.setSdo(sdo)
    }
  }

  writeStat(v: number) {
    // BF et les bits I2C sont en lecture seule
    this.stat = (this.stat & ~STAT_WRITABLE) | (v & STAT_WRITABLE)
  }

  writeCon1(v: number) {
    const was = this.enabled
    this.con1 = v
    if (!this.enabled && was) {
      this.busy = false
      this.gen++
    }
    // Au repos, SCK vaut CKP (module en service) ou 0 (module arrêté)
    if (!this.busy) this.drive(this.enabled ? this.ckp : 0, this.sdo)
  }

  writeAdd(v: number) {
    this.add = v
  }

  readBuf(): number {
    this.stat &= ~STAT_BF
    return this.buf
  }

  writeBuf(v: number) {
    if (!this.enabled) return
    if (this.busy) {
      this.con1 |= CON1_WCOL
      return
    }
    this.start(v & BYTE)
  }

  private start(tx: number) {
    const period = this.host.sckPeriodTicks(this.con1 & SSPM_MASK, this.add)
    if (!Number.isFinite(period)) return
    this.busy = true
    const g = ++this.gen
    const half = period / 2
    const t0 = this.host.now()
    const cke = this.cke
    const smp = (this.stat & STAT_SMP) !== 0
    const mode = this.mode
    // Donnée qui change au front montant (modes 1 et 2) : pas de présentation anticipée (H14)
    const changeRising = (this.ckp === 0) !== cke
    const bit = (i: number): Level => ((tx >> (MSB - i)) & 1) as Level
    const change = new Array<number>(EDGES + 1).fill(-1)
    const sample = new Array<number>(EDGES + 1).fill(-1)
    for (let i = 0; i < BITS; i++) {
      if (cke) {
        if (changeRising) change[2 * i + 1] = i
        else if (i > 0) change[2 * i - 1] = i
        sample[smp ? 2 * i + 1 : 2 * i] = i
      } else {
        change[2 * i] = i
        sample[smp ? 2 * i + 2 : 2 * i + 1] = i
      }
    }
    if (cke && !changeRising) this.drive(this.sck, bit(0))
    let rx = 0
    const edge = (k: number) => {
      if (g !== this.gen) return
      if (sample[k] >= 0) rx = (rx << 1) | this.host.readSdi()
      if (k < EDGES) {
        // Fronts pairs : repos → actif ; impairs : actif → repos
        const sck = (k % 2 === 0 ? 1 - this.ckp : this.ckp) as Level
        this.drive(sck, change[k] >= 0 ? bit(change[k]) : this.sdo)
        // Le dernier front termine l'octet : 8 périodes de SCK après l'écriture de SSP1BUF
        if (k === EDGES - 1) edge(EDGES)
        else this.host.schedule(Math.round(t0 + (k + 2) * half), () => edge(k + 1))
        return
      }
      this.buf = rx & BYTE
      this.stat |= STAT_BF
      this.busy = false
      const b: SpiByte = { tx, rx: this.buf, t0, t1: this.host.now(), mode }
      this.bytes.push(b)
      this.onByte?.(b)
      this.host.raiseFlag()
    }
    this.host.schedule(Math.round(t0 + half), () => edge(0))
  }
}
