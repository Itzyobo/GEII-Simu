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

/** Format complet d'une liaison : débit + format de caractère. */
export type Liaison = UartFormat & { baud: number }

/** Nombre de bits d'un caractère : start + données + parité + stops. */
export const frameBits = ({ dataBits, parity, stopBits }: UartFormat) => 1 + dataBits + (parity === 'none' ? 0 : 1) + stopBits

/** Durée d'un caractère — s. */
export const charDuration = (l: Liaison) => frameBits(l) / l.baud

/**
 * Caractères consécutifs, puis repos jusqu'à `period` (s) : le message se répète à l'identique.
 * `idleBefore` (s) de repos avant le premier start.
 */
export function messageWave(bytes: readonly number[], l: Liaison, level: Level, period: number, idleBefore = 0): Waveform {
  const bits = bytes.flatMap((b) => uartFrame(b, l))
  return uartWaveform(bits, { baud: l.baud, level }, idleBefore, period - idleBefore - bits.length / l.baud)
}

export interface Received {
  /** Octet lu (données seules, LSB d'abord) */
  byte: number
  framingError: boolean
  parityError: boolean
  /** Instant du front de start — s */
  t: number
}

/**
 * Récepteur UART : cherche le front descendant du start, vérifie le start au milieu du bit, échantillonne
 * chaque bit en son milieu, contrôle la parité et le(s) stop(s), puis reprend la recherche après le milieu
 * du dernier stop. Le signal est périodique : on décode `repeats` périodes, un caractère inachevé à la fin
 * est ignoré. Seuil logique : mi-chemin entre les deux niveaux ; RS232 inversé.
 */
export function uartDecode(w: Waveform, { baud, dataBits, parity, stopBits }: Liaison, { level = 'TTL', repeats = 1 }: { level?: Level; repeats?: number } = {}): Received[] {
  const seuil = (levelOf(0, level) + levelOf(1, level)) / 2
  const one = level === 'TTL' ? (v: number) => v > seuil : (v: number) => v < seuil
  const end = repeats * w.period
  const at = (t: number) => {
    const u = t - Math.floor(t / w.period) * w.period
    let v = w.samples[0]?.v ?? 0
    for (const s of w.samples) {
      if (s.t > u) break
      v = s.v
    }
    return one(v) ? 1 : 0
  }
  const falling: number[] = []
  for (let k = 0; k < repeats; k++)
    w.samples.forEach((s, i) => {
      const prev = (i === 0 ? w.samples.at(-1) : w.samples[i - 1])?.v ?? 0
      if (one(prev) && !one(s.v)) falling.push(k * w.period + s.t)
    })

  const tb = 1 / baud
  const n = frameBits({ dataBits, parity, stopBits })
  const out: Received[] = []
  let ready = 0
  for (const t of falling) {
    if (t < ready) continue
    if (t + (n - 0.5) * tb > end) break
    if (at(t + tb / 2) !== 0) continue // faux start
    const mid = (k: number) => at(t + (k + 0.5) * tb)
    let byte = 0
    let ones = 0
    for (let k = 0; k < dataBits; k++) {
      const b = mid(1 + k)
      byte |= b << k
      ones += b
    }
    let parityError = false
    if (parity !== 'none') {
      ones += mid(1 + dataBits)
      parityError = parity === 'even' ? ones % 2 !== 0 : ones % 2 !== 1
    }
    let framingError = false
    for (let k = n - stopBits; k < n; k++) if (mid(k) !== 1) framingError = true
    out.push({ byte, framingError, parityError, t })
    ready = t + (n - 0.5) * tb
  }
  return out
}
