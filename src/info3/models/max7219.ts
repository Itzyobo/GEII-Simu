/**
 * MAX7219 de la carte 8x8 R click (annexes 5 et 6).
 * - registre à décalage de 16 bits chargé au front montant de CLK, MSB (D15) en premier ;
 * - au front montant de LOAD, les 16 derniers bits sont verrouillés : D11–D8 = adresse, D7–D0 = donnée ;
 * - registres : 0x00 No-Op, 0x01–0x08 Digit 0–7, 0x09 Decode Mode (un bit par digit, Code B),
 *   0x0A Intensity (rapport (2n+1)/32), 0x0B Scan Limit, 0x0C Shutdown (0 = arrêt), 0x0F Display Test ;
 * - mise sous tension : shutdown, scan limit 0, pas de décodage, intensité minimale, afficheur éteint ;
 * - Display Test = 1 : les 64 LED, 8 digits balayés à 31/32, même en shutdown (annexe 6).
 * Matrice (annexe 5, H11 confirmée) : Digit 0 = colonne de droite, bit 7 (DP) = ligne du haut, bit 0 (G) = ligne du bas.
 * DOUT n'est pas relié au PIC dans le simulateur (H53).
 */
import { INFO3 } from '../../data/reference'
import type { Level } from './gpio'

const M = INFO3.max7219
const N = M.digits
const BYTE_BITS = INFO3.c.bitsPerByte
const WORD_MASK = (1 << M.frameBits) - 1
const ADDR_MASK = (1 << M.addressBits) - 1
const BYTE = (1 << BYTE_BITS) - 1
const NIBBLE = 0xf
const DP = 1 << (BYTE_BITS - 1)

export class Max7219 {
  private sr = 0
  readonly digits = new Array<number>(N).fill(0)
  decode = 0
  intensity = 0
  scanLimit = 0
  shutdown = true
  test = false
  /** Trames verrouillées (adresse, donnée) : professeur virtuel et tests */
  readonly frames: { addr: number; data: number }[] = []

  /** Mise sous tension (annexe 6, « Initial Power-Up ») ; contenu des digits non précisé : 0 (H53) */
  reset() {
    this.sr = 0
    this.digits.fill(0)
    this.decode = 0
    this.intensity = 0
    this.scanLimit = 0
    this.shutdown = true
    this.test = false
    this.frames.length = 0
  }

  /** Front montant de CLK : DIN entre par la droite */
  clock(din: Level) {
    this.sr = ((this.sr << 1) | din) & WORD_MASK
  }

  /** Front montant de LOAD : verrouille les 16 derniers bits ; renvoie true si l'affichage peut avoir changé */
  load(): boolean {
    const addr = (this.sr >> BYTE_BITS) & ADDR_MASK
    const data = this.sr & BYTE
    this.frames.push({ addr, data })
    if (this.frames.length > INFO3.analyzer.maxChanges) this.frames.splice(0, this.frames.length - INFO3.analyzer.maxChanges)
    const R = M.reg
    if (addr >= R.digit0 && addr < R.digit0 + N) this.digits[addr - R.digit0] = data
    else if (addr === R.decode) this.decode = data
    else if (addr === R.intensity) this.intensity = data & NIBBLE
    else if (addr === R.scanLimit) this.scanLimit = data & (N - 1)
    else if (addr === R.shutdown) this.shutdown = (data & 1) === 0
    else if (addr === R.test) this.test = (data & 1) === 1
    else return false
    return true
  }

  /** Segments allumés d'un digit (bit 7 = DP … bit 0 = G) */
  segments(d: number): number {
    if (this.test) return BYTE
    if (this.shutdown || d > this.scanLimit) return 0
    const v = this.digits[d]
    return (this.decode >> d) & 1 ? (M.codeB[v & NIBBLE] | (v & DP)) : v
  }

  /** Rapport cyclique d'une LED allumée : intensité (2n+1)/32 divisée par le nombre de digits balayés */
  get ledDuty(): number {
    const scanned = this.test ? N : this.scanLimit + 1
    const intensity = this.test ? M.testIntensity : (2 * this.intensity + 1) / M.intensitySteps
    return intensity / scanned
  }

  /** Matrice 8x8, ligne 0 en haut, colonne 0 à gauche : true = LED allumée (Digit 0 = colonne de droite) */
  matrix(): boolean[][] {
    return Array.from({ length: N }, (_, row) => Array.from({ length: N }, (_, col) => ((this.segments(N - 1 - col) >> (N - 1 - row)) & 1) === 1))
  }

  /** Nombre de LED allumées */
  get litCount(): number {
    let n = 0
    for (let d = 0; d < N; d++) for (let b = 0; b < BYTE_BITS; b++) n += (this.segments(d) >> b) & 1
    return n
  }
}
