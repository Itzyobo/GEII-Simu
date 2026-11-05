/**
 * Bus des registres spéciaux : chaque lecture ou écriture d'un SFR appelle le modèle concerné.
 * PORTx (lecture) = niveaux des broches avec ANSEL ; PORTx (écriture) = LATx ;
 * TRIS/LAT/ANSEL/WPU/ODCON → modèle gpio ; les autres SFR sont mémorisés (bits non implémentés à 0).
 */
import { INFO3, type SfrDef } from '../../data/reference'
import { GPIO_REGS, implementedMask, PORT_NAMES, type Gpio, type GpioReg, type PortName } from '../models/gpio'

const MEM = INFO3.vm.memory
const SFRS = INFO3.sfr as Record<string, SfrDef>

/** Rôle d'une adresse SFR */
const ROLE_PLAIN = 1
const ROLE_PORT = 2
const ROLE_GPIO = 3

const IRQ_REGS = new Set<string>([INFO3.interrupts.gie.sfr, ...INFO3.interrupts.firstLevel.flat(), ...INFO3.interrupts.peripheral.flat()])

export class SfrBus {
  readonly role = new Uint8Array(MEM.sfrLimit)
  readonly nameAt: (string | undefined)[] = new Array(MEM.sfrLimit)
  private readonly port: (PortName | undefined)[] = new Array(MEM.sfrLimit)
  private readonly reg: (GpioReg | undefined)[] = new Array(MEM.sfrLimit)
  private readonly mask = new Uint8Array(MEM.sfrLimit)
  private readonly irqAt = new Uint8Array(MEM.sfrLimit)
  readonly addrOf: Record<string, number> = {}
  private readonly mem: Uint8Array
  private readonly gpio: Gpio
  private readonly now: () => number
  private readonly onIrq: () => void
  /** Écriture d'un SFR mémorisé (horloge…) */
  onPlainWrite: ((addr: number) => void) | null = null
  /** Écriture qui modifie le LAT d'une broche en entrée (Diagnostic R2) : port, masque des bits */
  onInputWrite: ((port: PortName, mask: number) => void) | null = null

  constructor(mem: Uint8Array, gpio: Gpio, now: () => number, onIrq: () => void) {
    this.mem = mem
    this.gpio = gpio
    this.now = now
    this.onIrq = onIrq
    const allBits = (1 << INFO3.c.bitsPerByte) - 1
    for (const [name, def] of Object.entries(SFRS)) {
      const a = def.addr
      this.addrOf[name] = a
      this.nameAt[a] = name
      const m = implementedMask(name)
      this.mask[a] = m === 0 ? allBits : m
      if (IRQ_REGS.has(name)) this.irqAt[a] = 1
      const pm = /^(PORT|TRIS|LAT|ANSEL|WPU|ODCON)([A-E])$/.exec(name)
      if (pm && PORT_NAMES.includes(pm[2] as PortName)) {
        this.port[a] = pm[2] as PortName
        if (pm[1] === 'PORT') this.role[a] = ROLE_PORT
        else {
          this.role[a] = ROLE_GPIO
          this.reg[a] = pm[1] as GpioReg
        }
      } else this.role[a] = ROLE_PLAIN
    }
  }

  /** Valeurs au reset (PCON0 : bits conservés selon `keep`) */
  reset(keep: Record<string, number> = {}) {
    for (const [name, def] of Object.entries(SFRS)) {
      if (this.role[def.addr] === ROLE_PLAIN) this.mem[def.addr] = (def.reset & this.mask[def.addr]) | (keep[name] ?? 0)
    }
    this.onIrq()
  }

  isSfr(addr: number) {
    return addr < MEM.sfrLimit && this.role[addr] !== 0
  }

  /** Port d'un registre PORTx (lecture des broches), sinon undefined */
  portOf(addr: number): PortName | undefined {
    return addr < MEM.sfrLimit && this.role[addr] === ROLE_PORT ? this.port[addr] : undefined
  }

  private latWrite(port: PortName, value: number) {
    const old = this.gpio.readReg('LAT', port)
    const inputs = this.gpio.readReg('TRIS', port) & implementedMask(`TRIS${port}`)
    const changed = (old ^ value) & inputs
    if (changed && this.onInputWrite) this.onInputWrite(port, changed)
    this.gpio.writeReg('LAT', port, value, this.now())
  }

  read(addr: number): number {
    switch (this.role[addr]) {
      case ROLE_PORT:
        return this.gpio.readPort(this.port[addr]!)
      case ROLE_GPIO:
        return this.gpio.readReg(this.reg[addr]!, this.port[addr]!)
      default:
        return this.mem[addr]
    }
  }

  write(addr: number, value: number) {
    switch (this.role[addr]) {
      case ROLE_PORT:
        this.latWrite(this.port[addr]!, value)
        return
      case ROLE_GPIO:
        if (this.reg[addr] === 'LAT') this.latWrite(this.port[addr]!, value)
        else this.gpio.writeReg(this.reg[addr]!, this.port[addr]!, value, this.now())
        return
      case ROLE_PLAIN:
        this.mem[addr] = value & this.mask[addr]
        if (this.irqAt[addr]) this.onIrq()
        if (this.onPlainWrite) this.onPlainWrite(addr)
        return
      default:
        this.mem[addr] = value
    }
  }

  /** Bit nommé d'un SFR : adresse et masque */
  bit(sfr: string, bit: string): { addr: number; mask: number } {
    const def = SFRS[sfr]
    if (!def) throw new Error(`SFR inconnu : ${sfr}`)
    const i = def.bits.indexOf(bit)
    if (i < 0) throw new Error(`bit inconnu : ${sfr}.${bit}`)
    return { addr: def.addr, mask: 1 << i }
  }

  readBit(sfr: string, bit: string): 0 | 1 {
    const b = this.bit(sfr, bit)
    return this.read(b.addr) & b.mask ? 1 : 0
  }

  writeBit(sfr: string, bit: string, v: 0 | 1) {
    const b = this.bit(sfr, bit)
    const cur = this.read(b.addr)
    this.write(b.addr, v ? cur | b.mask : cur & ~b.mask)
  }
}

export { GPIO_REGS }
