/**
 * Terminal série du PC, branché sur le port COM virtuel de l'USB blanc (H12) : reçoit la ligne TX du PIC
 * (RC6) et la décode à SON baud et SON format. Bauds différents de plus de 5 % : caractères corrompus,
 * obtenus en rééchantillonnant la trame réelle (H47). Sans USB blanc : rien n'est reçu.
 * L'envoi (clavier du terminal) produit les fronts de la ligne RX du PIC.
 */
import { INFO3 } from '../../data/reference'
import { frameBits, UartDecoder, type DecodedByte, type UartFormat } from './eusart'
import type { Level } from './gpio'

const T = INFO3.terminal

export const formatOf = (id: string): UartFormat => {
  const f = T.formats.find((x) => x.id === id) ?? T.formats[0]
  return { dataBits: f.dataBits, parity: f.parity as UartFormat['parity'], stopBits: f.stopBits }
}

export class SerialTerminal {
  baud: number
  formatId: string
  connected = false
  private readonly decoder: UartDecoder
  private readonly ticksPerS: number
  /** Octets reçus depuis l'effacement (avec instant du start, ticks) */
  readonly received: DecodedByte[] = []

  constructor(ticksPerS: number, baud: number = T.defaultBaud, formatId: string = T.defaultFormat) {
    this.ticksPerS = ticksPerS
    this.baud = baud
    this.formatId = formatId
    this.decoder = new UartDecoder(ticksPerS / baud, formatOf(formatId))
  }

  configure(baud: number, formatId: string) {
    this.baud = baud
    this.formatId = formatId
    this.decoder.configure(this.ticksPerS / baud, formatOf(formatId))
  }

  /** Branchement de l'USB blanc : ligne au repos à 1 au moment du branchement */
  connect(on: boolean, level: Level = 1) {
    this.connected = on
    this.decoder.reset(level)
  }

  /** Front sur la ligne TX du PIC */
  edge(t: number, level: Level) {
    if (this.connected) this.decoder.edge(t, level)
  }

  /** Octets complets reçus jusqu'à `now` (ticks) */
  poll(now: number): DecodedByte[] {
    if (!this.connected) return []
    const out = this.decoder.flush(now)
    this.received.push(...out)
    if (this.received.length > T.maxChars) this.received.splice(0, this.received.length - T.maxChars)
    return out
  }

  clear() {
    this.received.length = 0
  }

  /** Fronts (instant en ticks, niveau) d'octets envoyés par le clavier du terminal, à partir de t0 */
  sendEdges(bytes: number[], t0: number): { t: number; level: Level }[] {
    const bit = this.ticksPerS / this.baud
    const f = formatOf(this.formatId)
    const out: { t: number; level: Level }[] = []
    let t = t0
    let prev: Level = 1
    for (const b of bytes) {
      frameBits(b, f).forEach((l, i) => {
        if (l !== prev) out.push({ t: Math.round(t + i * bit), level: l })
        prev = l
      })
      t += frameBits(b, f).length * bit
    }
    return out
  }
}

/** Texte affiché : \r et \n visibles en option, sinon retour à la ligne sur \n (et \r seul ignoré) */
export function terminalText(bytes: number[], showControl: boolean): string {
  const CR = 0x0d
  const LF = 0x0a
  let s = ''
  for (const b of bytes) {
    if (b === CR) s += showControl ? '\\r' : ''
    else if (b === LF) s += showControl ? '\\n\n' : '\n'
    else s += String.fromCharCode(b)
  }
  return s
}
