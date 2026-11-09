/**
 * Deux 74HC595 en chaîne de la carte Rotary (annexe 3, cours p. 81 et 82) : SER de U2 ← MOSI,
 * Q7S de U2 → SER de U3, Q7S de U3 → MISO. Étage 0 = Q0 de U2 (LED 1) … étage 7 = Q7 de U2 (LED 8),
 * étage 8 = Q0 de U3 (LED 9) … étage 15 = Q7 de U3 (LED 16). OE à la masse : sorties toujours actives.
 * Décalage au front montant de SRCLK (SCK) ; MR (RST) à 0 vide le registre ; front montant de RCLK (LATCH)
 * → copie vers les sorties. Le niveau de MOSI lu est celui d'avant le front (H14 : voir mssp-spi).
 */
import { INFO3 } from '../../data/reference'
import type { Level } from './gpio'

const N = INFO3.ring.leds
const MASK = (1 << N) - 1
const LAST = N - 1

export class Hc595x2 {
  /** Registre à décalage (16 étages) */
  shift = 0
  /** Sorties verrouillées : bit k = LED k + 1 */
  outputs = 0
  private mr: Level = 0
  private rclk: Level = 0

  reset(mr: Level, rclk: Level) {
    this.shift = 0
    this.outputs = 0
    this.mr = mr
    this.rclk = rclk
  }

  /** Q7S de U3 (vers MISO) */
  get q7s(): Level {
    return ((this.shift >> LAST) & 1) as Level
  }

  /** Front montant de SCK : décalage d'un étage, SER = niveau de MOSI avant le front */
  clock(ser: Level) {
    if (!this.mr) return
    this.shift = ((this.shift << 1) | ser) & MASK
  }

  /** MR (actif à 0) : vide le registre à décalage, pas les sorties */
  setMr(level: Level) {
    this.mr = level
    if (!level) this.shift = 0
  }

  /** RCLK : au front montant, les sorties prennent la valeur du registre. Renvoie true si elles changent */
  setLatch(level: Level): boolean {
    const rising = level === 1 && this.rclk === 0
    this.rclk = level
    if (!rising || this.outputs === this.shift) return false
    this.outputs = this.shift
    return true
  }

  /** LED k (1 à 16) allumée */
  led(k: number): boolean {
    return ((this.outputs >> (k - 1)) & 1) === 1
  }
}
