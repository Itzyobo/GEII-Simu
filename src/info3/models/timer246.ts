/**
 * Timers 2, 4 et 6 du PIC16F18875 (compteur 8 bits TMRx, période PRx, prescaler, postscaler, HLT).
 * Modèle événementiel : le compteur n'est avancé qu'à la demande (lecture de TMRx, écriture d'un registre,
 * front sur TMRx_ers) et un seul événement daté est programmé, à la prochaine levée de TMRxIF.
 * Modes simulés : Roll over (MODE 0, comptage tant que TMRxON = 1), one-shot et monostable (H33).
 * Une période = (PRx + 1) × prescaler / Fclk ; TMRxIF tous les « postscaler » périodes.
 */
import { INFO3 } from '../../data/reference'

const T = INFO3.timers
const EPS = INFO3.vm.tickEpsilon
const RANGE = T.counterRange
const BITS = INFO3.c.bitsPerByte
/** TxCON : ON<7>, CKPS<6:4>, OUTPS<3:0> ; TxHLT : MODE<4:0> */
const CON_ON = 1 << (BITS - 1)
const CKPS_SHIFT = 4
const CKPS_MASK = 0b111
const OUTPS_MASK = 0b1111
const MODE_MASK = 0b11111
const EDGE_MASK = T.edgeBits.rising | T.edgeBits.falling

/** Fréquence de la source d'horloge d'un timer (code CS de TxCLKCON) — Hz ; 0 = source non simulée */
export function timerClockHz(cs: number, fosc: number, hfintoscHz: number): number {
  const label = T.clockSources.find((s) => s.cs === cs)?.label
  switch (label) {
    case 'FOSC/4':
      return fosc / INFO3.clock.foscPerTcy
    case 'FOSC':
      return fosc
    case 'HFINTOSC':
      return hfintoscHz
    case 'LFINTOSC':
      return INFO3.clock.lfintosc
    case 'MFINTOSC':
      return T.mfintosc
    default:
      return 0
  }
}

/** Période de TMRxIF (s) : (PR + 1) × prescaler × postscaler / Fclk */
export const timerPeriodS = (clockHz: number, prescaler: number, pr: number, postscaler = 1) => ((pr + 1) * prescaler * postscaler) / clockHz

export interface TimerHost {
  /** Temps courant — ticks */
  now(): number
  /** Fréquence de la source CS — Hz */
  clockHz(cs: number): number
  /** Programme fn à l'instant t (ticks) */
  schedule(t: number, fn: () => void): void
  /** Lève TMRxIF */
  raiseFlag(): void
  /** One-shot terminé : TMRxON repasse à 0 dans TxCON */
  clearOn(): void
  /** Après tout changement qui déplace la base de temps (PWM) */
  onChange?(): void
}

export type TimerReg = 'TMR' | 'PR' | 'CON' | 'HLT' | 'CLKCON' | 'RST'

export class Timer246 {
  private con = 0
  private hlt = 0
  private clk = 0
  private pr = RANGE - 1
  private tmr = 0
  private counting = false
  private lastT = 0
  /** Ticks accumulés vers le prochain incrément */
  private phase = 0
  /** Compteur du postscaler */
  private post = 0
  /** Génération : invalide les événements programmés avant un changement */
  private gen = 0
  private countTicks = Infinity
  /** Nombre de levées de TMRxIF depuis le reset (inspecteur, tests) */
  periods = 0
  /** Instant (ticks) de la dernière levée de TMRxIF ; -1 = jamais */
  lastFlagT = -1
  private readonly host: TimerHost

  constructor(host: TimerHost) {
    this.host = host
  }

  reset() {
    this.con = 0
    this.hlt = 0
    this.clk = 0
    this.pr = RANGE - 1
    this.tmr = 0
    this.counting = false
    this.phase = 0
    this.post = 0
    this.periods = 0
    this.lastFlagT = -1
    this.lastT = this.host.now()
    this.gen++
    this.updateClock()
  }

  /**
   * Base de temps de la PWM : début de la période en cours, durée d'une période et d'un incrément (ticks).
   * null si le timer ne compte pas en continu (arrêté, source non simulée, one-shot ou monostable).
   */
  timebase(): { periodStart: number; periodTicks: number; countTicks: number; counts: number } | null {
    this.sync()
    if (!this.counting || !this.on || this.stopsAtMatch || !Number.isFinite(this.countTicks)) return null
    const counts = this.pr + 1
    return { periodStart: this.lastT - this.phase - this.tmr * this.countTicks, periodTicks: counts * this.countTicks, countTicks: this.countTicks, counts }
  }

  get on() {
    return (this.con & CON_ON) !== 0
  }
  get mode() {
    return this.hlt & MODE_MASK
  }
  private get family() {
    return this.mode >> T.modeFamily.shift
  }
  private get prescaler() {
    return 2 ** ((this.con >> CKPS_SHIFT) & CKPS_MASK)
  }
  private get postscaler() {
    return (this.con & OUTPS_MASK) + 1
  }
  /** Le comptage s'arrête à la première égalité (one-shot, monostable) */
  private get stopsAtMatch() {
    return this.family === T.modeFamily.oneShot || this.family === T.modeFamily.monostable
  }
  /** Front de démarrage attendu sur TMRx_ers (0 = démarrage logiciel) */
  private get startEdges() {
    return this.stopsAtMatch ? this.mode & EDGE_MASK : 0
  }

  /** Recalcule la durée d'un incrément après un changement de source ou d'horloge système */
  updateClock() {
    this.sync()
    const hz = this.host.clockHz(this.clk)
    this.countTicks = hz > 0 ? (INFO3.clock.timeBaseHz / hz) * this.prescaler : Infinity
    this.reschedule()
    this.host.onChange?.()
  }

  /** Avance le compteur jusqu'à maintenant */
  private sync() {
    const now = this.host.now()
    if (!this.counting || !this.on || !Number.isFinite(this.countTicks)) {
      this.lastT = now
      return
    }
    const elapsed = now - this.lastT + this.phase
    const n = Math.floor((elapsed + EPS) / this.countTicks)
    this.phase = Math.max(0, elapsed - n * this.countTicks)
    this.lastT = now
    if (n > 0) this.advance(n)
  }

  /** Incréments jusqu'à la prochaine égalité TMRx = PRx suivie du retour à 0 */
  private toMatch() {
    return ((this.pr - this.tmr + RANGE) % RANGE) + 1
  }

  private advance(n: number) {
    const d = this.toMatch()
    if (n < d) {
      this.tmr = (this.tmr + n) % RANGE
      return
    }
    if (this.stopsAtMatch) {
      this.tmr = 0
      this.counting = false
      this.phase = 0
      this.match(1)
      if (this.family === T.modeFamily.oneShot) {
        this.con &= ~CON_ON
        this.host.clearOn()
      }
      return
    }
    const period = this.pr + 1
    this.tmr = (n - d) % period
    this.match(1 + Math.floor((n - d) / period))
  }

  private match(m: number) {
    const total = this.post + m
    const flags = Math.floor(total / this.postscaler)
    this.post = total % this.postscaler
    if (flags > 0) {
      this.periods += flags
      this.lastFlagT = this.host.now()
      this.host.raiseFlag()
    }
  }

  /** Programme l'événement de la prochaine levée de TMRxIF (ou de l'arrêt en one-shot / monostable) */
  private reschedule() {
    const g = ++this.gen
    if (!this.counting || !this.on || !Number.isFinite(this.countTicks)) return
    const counts = this.stopsAtMatch ? this.toMatch() : this.toMatch() + (this.postscaler - this.post - 1) * (this.pr + 1)
    const at = Math.ceil(this.lastT - this.phase + counts * this.countTicks - EPS)
    this.host.schedule(at, () => {
      if (g !== this.gen) return
      this.sync()
      this.reschedule()
    })
  }

  read(reg: TimerReg): number | undefined {
    if (reg !== 'TMR') return undefined
    this.sync()
    return this.tmr
  }

  /** Écriture d'un registre du timer (après mémorisation par le bus) */
  write(reg: TimerReg, v: number) {
    this.sync()
    switch (reg) {
      case 'TMR':
        this.tmr = v
        this.phase = 0
        this.post = 0
        break
      case 'PR':
        this.pr = v
        break
      case 'CON': {
        const wasOn = this.on
        this.con = v
        // Écrire TxCON remet à zéro prescaler et postscaler (datasheet)
        this.phase = 0
        this.post = 0
        if (!this.on) this.counting = false
        else if (!wasOn) this.counting = this.startEdges === 0
        break
      }
      case 'HLT':
        this.hlt = v
        if (this.on) this.counting = this.startEdges === 0 && (this.counting || !this.stopsAtMatch)
        break
      case 'CLKCON':
        this.clk = v
        this.updateClock()
        return
      case 'RST':
        break
    }
    if (reg === 'CON') this.updateClock()
    else {
      this.reschedule()
      this.host.onChange?.()
    }
  }

  /** Front sur l'entrée TMRx_ers (broche choisie par TxINPPS) ; ignoré pendant le comptage (H33) */
  ersEdge(rising: boolean) {
    const want = this.startEdges
    if (!this.on || want === 0 || this.counting) return
    if (!(want & (rising ? T.edgeBits.rising : T.edgeBits.falling))) return
    this.sync()
    this.counting = true
    this.phase = 0
    this.reschedule()
    this.host.onChange?.()
  }

  /** Durée d'une période (PRx + 1 incréments, sans postscaler) — ticks ; Infinity si le timer ne compte pas */
  periodTicks(): number {
    return this.on ? (this.pr + 1) * this.countTicks : Infinity
  }

  /** État lisible (inspecteur, tests) */
  get state() {
    return { tmr: this.tmr, counting: this.counting, on: this.on, mode: this.mode, prescaler: this.prescaler, postscaler: this.postscaler, pr: this.pr }
  }
}
