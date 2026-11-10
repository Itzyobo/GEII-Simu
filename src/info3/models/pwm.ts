/**
 * Sortie PWM d'un module CCP en mode PWM ou PWM6/PWM7 (cours p. 85 à 90), sur la base de temps d'un timer 2/4/6.
 * - période = (PR2 + 1) × incrément de TMR2 (4·Tosc·prescaler en FOSC/4) ;
 * - sortie à 1 au début de chaque période, à 0 quand la base 10 bits (TMR2 et 2 bits de plus) atteint le seuil :
 *   instant = rapport cyclique × incrément / 4 ;
 * - seuil 0 → toujours 0 ; seuil ≥ 4·(PR2 + 1) → toujours 1 ;
 * - le rapport cyclique écrit n'est pris en compte qu'au début de la période suivante (double tampon) ;
 * - polarité inversée : sortie complémentée ; module désactivé : sortie à 0.
 * Fronts datés : un événement au début de période et un à la retombée. Période plus courte que
 * INFO3.pwm.minEdgePeriodS : plus de fronts émis (limite du simulateur), niveau figé.
 */
import { INFO3 } from '../../data/reference'
import type { Level } from './gpio'

const P = INFO3.pwm

/** Base de temps fournie par le timer : début de la période courante, durée d'une période et d'un incrément (ticks) */
export interface PwmTimebase {
  periodStart: number
  periodTicks: number
  countTicks: number
  /** PR + 1 */
  counts: number
}

export interface PwmHost {
  now(): number
  schedule(t: number, fn: () => void): void
  /** Base de temps du timer choisi, null s'il ne compte pas en continu */
  timebase(): PwmTimebase | null
  /** Durée d'un tick — s (limite des fronts rapides) */
  tickS: number
  setLevel(level: Level, t: number): void
}

/** Rapport cyclique moyen (0 à 1) d'un seuil 10 bits pour une période de PR + 1 incréments */
export const dutyRatio = (duty: number, counts: number) => Math.min(1, Math.max(0, duty / (P.dutyPerCount * counts)))

/** Période PWM — s : (PR + 1) × 4 × prescaler / Fosc en FOSC/4 ; plus généralement (PR + 1) × prescaler / Fclk */
export const pwmPeriodS = (pr: number, prescaler: number, timerClockHz: number) => ((pr + 1) * prescaler) / timerClockHz

export class PwmChannel {
  private enabled = false
  private invert = false
  /** Seuil écrit (10 bits) et seuil de la période en cours */
  private duty = 0
  private active = 0
  /** Niveau interne avant polarité */
  private raw: Level = 0
  private gen = 0
  /** Niveau de la sortie (après polarité) */
  level: Level = 0
  private readonly host: PwmHost

  constructor(host: PwmHost) {
    this.host = host
  }

  reset() {
    this.enabled = false
    this.invert = false
    this.duty = this.active = 0
    this.raw = 0
    this.gen++
    this.output(this.host.now())
  }

  /** Réglages lus dans les registres du module */
  configure(enabled: boolean, duty: number, invert: boolean) {
    const changed = enabled !== this.enabled || invert !== this.invert
    this.duty = duty & ((1 << P.dutyBits) - 1)
    if (!changed) return
    this.enabled = enabled
    this.invert = invert
    if (!enabled) this.raw = 0
    this.resync()
  }

  /** Recalcule les événements après un changement du timer (PR, prescaler, source, marche / arrêt) */
  resync() {
    const g = ++this.gen
    const now = this.host.now()
    this.output(now)
    const tb = this.host.timebase()
    if (!this.enabled || !tb || tb.periodTicks * this.host.tickS < P.minEdgePeriodS) return
    // Prochain début de période (la période en cours garde le niveau actuel jusqu'à sa retombée)
    const k = Math.floor((now - tb.periodStart) / tb.periodTicks)
    const cur = tb.periodStart + k * tb.periodTicks
    const fall = cur + this.active * (tb.countTicks / P.dutyPerCount)
    if (this.raw && this.active < P.dutyPerCount * tb.counts) {
      if (fall > now) this.at(g, fall, () => this.setRaw(0))
      else this.setRaw(0)
    }
    this.at(g, cur + tb.periodTicks, () => this.periodStart(g, tb, cur + tb.periodTicks))
  }

  private at(g: number, t: number, fn: () => void) {
    this.host.schedule(Math.round(t), () => {
      if (g === this.gen) fn()
    })
  }

  private periodStart(g: number, tb: PwmTimebase, t: number) {
    this.active = this.duty
    const full = P.dutyPerCount * tb.counts
    this.setRaw(this.active > 0 ? 1 : 0)
    if (this.active > 0 && this.active < full) this.at(g, t + this.active * (tb.countTicks / P.dutyPerCount), () => this.setRaw(0))
    this.at(g, t + tb.periodTicks, () => this.periodStart(g, tb, t + tb.periodTicks))
  }

  private setRaw(l: Level) {
    this.raw = l
    this.output(this.host.now())
  }

  private output(t: number) {
    const l = (this.enabled ? this.raw ^ (this.invert ? 1 : 0) : 0) as Level
    if (l === this.level) return
    this.level = l
    this.host.setLevel(l, t)
  }

  /** Rapport cyclique de la période en cours (0 à 1, polarité comprise), pour les tests et l'inspecteur */
  ratio(): number {
    const tb = this.host.timebase()
    if (!this.enabled || !tb) return this.level
    const r = dutyRatio(this.active, tb.counts)
    return this.invert ? 1 - r : r
  }
}
