import { REF, type Parity } from '../data/reference'

export interface UartFormat {
  dataBits: 7 | 8
  parity: Parity
  stopBits: 1 | 2
}

/** Bits d'un caractère : start (0), données LSB d'abord, parité éventuelle, stop (1). */
export function uartFrame(byte: number, { dataBits, parity, stopBits }: UartFormat): number[] {
  const data = Array.from({ length: dataBits }, (_, k) => (byte >> k) & 1)
  const ones = data.reduce((s, b) => s + b, 0)
  // Parité : rend le nombre total de 1 pair (paire) ou impair (impaire)
  const par = parity === 'none' ? [] : [parity === 'even' ? ones % 2 : 1 - (ones % 2)]
  return [0, ...data, ...par, ...Array<number>(stopBits).fill(1)]
}

/** « 0·10101010·1·1 » : start · données · parité · stop (le groupe parité est omis sans parité). */
export function formatFrame(bits: readonly number[], { dataBits, parity }: UartFormat): string {
  const s = bits.join('')
  const groups = [s.slice(0, 1), s.slice(1, 1 + dataBits)]
  const p = parity === 'none' ? 0 : 1
  if (p) groups.push(s.slice(1 + dataBits, 2 + dataBits))
  groups.push(s.slice(1 + dataBits + p))
  return groups.join('·')
}

/** Échantillon d'un signal en escalier : la tension `v` tient de `t` jusqu'au t de l'échantillon suivant. */
export interface Sample {
  t: number
  v: number
}

/** Signal périodique en escalier ; `samples[0].t` = 0, tous les t < `period`. */
export interface Waveform {
  samples: Sample[]
  period: number
}

export type Level = 'TTL' | 'RS232'

/** Tension d'un bit logique : TTL 0/5 V repos haut ; RS232 inversé, repos bas. */
export function levelOf(bit: number, level: Level): number {
  if (level === 'TTL') return bit ? REF.ttlHigh.value : REF.ttlLow.value
  return bit ? REF.rs232Low.value : REF.rs232High.value
}

/**
 * Forme d'onde d'une suite de bits, précédée et suivie de repos (en secondes).
 * Une période = idleBefore + bits + idleAfter : le signal se répète à l'identique (caractère répété).
 */
export function uartWaveform(bits: readonly number[], { baud, level }: { baud: number; level: Level }, idleBefore = 0, idleAfter = 0): Waveform {
  const tb = 1 / baud
  const samples: Sample[] = []
  const push = (t: number, v: number) => {
    if (samples.at(-1)?.v !== v) samples.push({ t, v })
  }
  if (idleBefore > 0) push(0, levelOf(1, level))
  bits.forEach((b, k) => push(idleBefore + k * tb, levelOf(b, level)))
  if (idleAfter > 0) push(idleBefore + bits.length * tb, levelOf(1, level))
  return { samples, period: idleBefore + bits.length * tb + idleAfter }
}

/** Tension constante (ligne au repos, voie sans signal). */
export const constant = (v: number): Waveform => ({ samples: [{ t: 0, v }], period: 1 })
