/**
 * Ports parallèles du PIC16F18875 (cours p. 9 à 22).
 * - niveau de broche = LATx si TRISx = 0 (sortie), sinon le niveau imposé de l'extérieur ;
 * - ODCONx = 1 : une sortie à 1 relâche la broche (drain ouvert) ;
 * - entrée non pilotée : 1 si WPUx = 1, sinon INFO3.floatingInputLevel (H20) ;
 * - lecture de PORTx : 0 pour chaque bit en analogique (ANSELx = 1).
 * Fonctions pures sur GpioState, plus une enveloppe `Gpio` qui horodate chaque changement de broche.
 */
import { INFO3 } from '../../data/reference'

export type Level = 0 | 1
export const PORT_NAMES = ['A', 'B', 'C', 'D', 'E'] as const
export type PortName = (typeof PORT_NAMES)[number]
export type GpioReg = 'TRIS' | 'LAT' | 'ANSEL' | 'WPU' | 'ODCON'
export const GPIO_REGS: readonly GpioReg[] = ['TRIS', 'LAT', 'ANSEL', 'WPU', 'ODCON']

export interface PortState {
  TRIS: number
  LAT: number
  ANSEL: number
  WPU: number
  ODCON: number
  /** Niveau imposé de l'extérieur, par bit (null = broche non pilotée) */
  ext: (Level | null)[]
  /** Niveaux actuels des broches (masque) */
  levels: number
  /** Broches dont la sortie est confiée à un périphérique par PPS (masque) et niveaux qu'il impose */
  PPS: number
  PER: number
}

export type GpioState = Record<PortName, PortState>

const BITS = INFO3.c.bitsPerByte
const sfrOf = (name: string) => (INFO3.sfr as Record<string, (typeof INFO3.sfr)[string]>)[name]
/** Masque des bits implémentés d'un registre */
export const implementedMask = (name: string) => sfrOf(name).bits.reduce((m, b, i) => (b ? m | (1 << i) : m), 0)

/** Bits de broche existants (PORTx) et bits pouvant être en sortie (TRISx) */
const PIN_MASK = Object.fromEntries(PORT_NAMES.map((p) => [p, implementedMask(`PORT${p}`)])) as Record<PortName, number>
const OUT_MASK = Object.fromEntries(PORT_NAMES.map((p) => [p, implementedMask(`TRIS${p}`)])) as Record<PortName, number>

export function parsePin(pin: string): { port: PortName; bit: number } {
  const m = /^R([A-E])([0-7])$/.exec(pin)
  if (!m) throw new Error(`broche inconnue : ${pin}`)
  const port = m[1] as PortName
  const bit = Number(m[2])
  if (!(PIN_MASK[port] & (1 << bit))) throw new Error(`broche inexistante sur le PIC16F18875 : ${pin}`)
  return { port, bit }
}

export const pinName = (port: PortName, bit: number) => `R${port}${bit}`

/** Toutes les broches existantes */
export const ALL_PINS: string[] = PORT_NAMES.flatMap((p) => Array.from({ length: BITS }, (_, b) => b).filter((b) => PIN_MASK[p] & (1 << b)).map((b) => pinName(p, b)))

export function createGpioState(): GpioState {
  const st = {} as GpioState
  for (const p of PORT_NAMES) {
    st[p] = {
      TRIS: sfrOf(`TRIS${p}`).reset,
      LAT: sfrOf(`LAT${p}`).reset,
      ANSEL: sfrOf(`ANSEL${p}`).reset,
      WPU: sfrOf(`WPU${p}`).reset,
      ODCON: sfrOf(`ODCON${p}`).reset,
      ext: Array.from({ length: BITS }, () => null),
      levels: 0,
      PPS: 0,
      PER: 0,
    }
    st[p].levels = computeLevels(st[p], p)
  }
  return st
}

/** Niveau d'une broche à partir des registres et du pilotage externe */
export function pinLevel(ps: PortState, port: PortName, bit: number): Level {
  const m = 1 << bit
  const isOutput = (OUT_MASK[port] & m) !== 0 && (ps.TRIS & m) === 0
  if (isOutput) {
    // Sortie confiée à un périphérique (PPS) : son niveau remplace LATx
    const lat = ((ps.PPS & m ? ps.PER : ps.LAT) & m) !== 0
    // Push-pull : la sortie impose son niveau ; drain ouvert : seul le 0 est imposé
    if (!lat) return 0
    if ((ps.ODCON & m) === 0) return 1
  }
  const ext = ps.ext[bit]
  if (ext !== null) return ext
  if (ps.WPU & m) return 1
  return INFO3.floatingInputLevel as Level
}

export function computeLevels(ps: PortState, port: PortName): number {
  let v = 0
  for (let b = 0; b < BITS; b++) if (PIN_MASK[port] & (1 << b) && pinLevel(ps, port, b)) v |= 1 << b
  return v
}

/** Lecture de PORTx : niveau des broches, 0 pour les bits analogiques (ANSELx = 1) */
export function readPort(ps: PortState, port: PortName): number {
  return ps.levels & ~ps.ANSEL & PIN_MASK[port]
}

export interface PinChange {
  /** Temps — Tcy */
  t: number
  pin: string
  level: Level
}

/** Ports avec trace horodatée des changements de broche */
export class Gpio {
  state: GpioState = createGpioState()
  trace: PinChange[] = []
  private listeners: ((c: PinChange) => void)[] = []

  reset() {
    const prev = this.state
    this.state = createGpioState()
    // Le pilotage externe (boutons…) n'est pas affecté par un reset du PIC
    for (const p of PORT_NAMES) {
      this.state[p].ext = prev[p].ext
      this.state[p].levels = prev[p].levels
    }
  }

  /** Recalcule les niveaux après un reset, en traçant les changements */
  settle(t: number) {
    for (const p of PORT_NAMES) this.update(p, t)
  }

  onChange(cb: (c: PinChange) => void): () => void {
    this.listeners.push(cb)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb)
    }
  }

  writeReg(reg: GpioReg, port: PortName, value: number, t: number) {
    this.state[port][reg] = value & implementedMask(`${reg}${port}`)
    this.update(port, t)
  }

  readReg(reg: GpioReg, port: PortName): number {
    return this.state[port][reg]
  }

  readPort(port: PortName): number {
    return readPort(this.state[port], port)
  }

  setExternal(pin: string, level: Level | null, t: number) {
    const { port, bit } = parsePin(pin)
    this.state[port].ext[bit] = level
    this.update(port, t)
  }

  level(pin: string): Level {
    const { port, bit } = parsePin(pin)
    return ((this.state[port].levels >> bit) & 1) as Level
  }

  /** Confie (ou rend) la sortie d'une broche à un périphérique (PPS) */
  setPeripheral(pin: string, owned: boolean, t: number) {
    const { port, bit } = parsePin(pin)
    const ps = this.state[port]
    ps.PPS = owned ? ps.PPS | (1 << bit) : ps.PPS & ~(1 << bit)
    this.update(port, t)
  }

  /** Niveau imposé par le périphérique sur une broche qu'il possède */
  setPeripheralLevel(pin: string, level: Level, t: number) {
    const { port, bit } = parsePin(pin)
    const ps = this.state[port]
    ps.PER = level ? ps.PER | (1 << bit) : ps.PER & ~(1 << bit)
    this.update(port, t)
  }

  private update(port: PortName, t: number) {
    const ps = this.state[port]
    const next = computeLevels(ps, port)
    const diff = next ^ ps.levels
    ps.levels = next
    if (!diff) return
    for (let b = 0; b < BITS; b++) {
      if (!(diff & (1 << b))) continue
      const c: PinChange = { t, pin: pinName(port, b), level: ((next >> b) & 1) as Level }
      this.trace.push(c)
      for (const l of this.listeners) l(c)
    }
  }
}
