/**
 * Machine virtuelle INFO3 : exécute le bytecode du compilateur sur un PIC16F18875 simulé.
 * - temps simulé entier en Tcy (Tcy = foscPerTcy / Fosc), chaque instruction avance de son coût (H2) ;
 * - SFR via le bus (modèles gpio…) ; interruptions testées entre deux instructions ;
 * - pile matérielle de 16 niveaux (ISR comprise) : le 17e niveau → STKOVF = 1 et reset ;
 * - file d'événements datés (fronts externes, rebonds) ; boutons S1/S2 de la carte.
 */
import { INFO3 } from '../../data/reference'
import { binop, convert, Kind, kindSize, MASK8, norm, readKind, BITS8 } from '../compiler/arith'
import { Op, type FuncMeta, type Program } from '../compiler/bytecode'
import type { CType } from '../compiler/types'
import { kindOf, sizeOf } from '../compiler/types'
import { Button, type Edge } from '../models/button'
import { ALL_PINS, Gpio, parsePin, pinName, PORT_NAMES, type Level, type PinChange } from '../models/gpio'
import { MsspSpi } from '../models/msspSpi'
import { PwmChannel } from '../models/pwm'
import { baudOf, EusartTx, FORMAT_8N1, UartDecoder } from '../models/eusart'
import { channelOf, conversionS, joystickRaw, noisyCode, resultRegisters, tadOf, voltsOf } from '../models/adcc'
import { Hc595x2 } from '../models/hc595x2'
import { iocEdges } from '../models/ioc'
import { mulberry32 } from '../models/prng'
import { foscFromRegisters, hfintoscFromRegister } from '../models/clock'
import { Timer246, timerClockHz, type TimerReg } from '../models/timer246'
import { Ec12d } from '../models/ec12d'

export type RotarySlot = 'mikrobus1' | 'mikrobus2'
/** Changement d'une pseudo-voie de l'analyseur logique (ISR, TMRxIF) */
export interface ProbeChange {
  name: string
  t: number
  level: Level
}
import { SfrBus } from './bus'
import { EventQueue } from './events'
import { formatPrintf } from './printf'

const MEM = INFO3.vm.memory
const CPU = INFO3.cpu
const IRQ = INFO3.interrupts

/** Modes de pas à pas de exec() */
const STEP_NONE = 0
const STEP_INTO = 1
const STEP_OVER = 2
const STEP_OUT = 3

/** Adresse de retour d'un appel unitaire (invoke) : exec() s'arrête dès qu'il y revient */
const RETURN_SENTINEL = -1

export type StopReason = 'time' | 'ops' | 'breakpoint' | 'paused' | 'halted' | 'step' | 'returned'

export interface OutputLine {
  level: 'info' | 'warning' | 'error'
  text: string
  file?: string
  line?: number
  col?: number
}

interface Frame {
  retPc: number
  fp: number
  dsp: number
  isr: boolean
  delay: number
}

/** Durée : en cycles instruction (Tcy à l'horloge courante) ou en millisecondes */
export type RunSpan = { tcy: number } | { ms: number }

export interface VmOptions {
  seed?: number
}

const CLK = INFO3.clock
export class Vm {
  program: Program | null = null
  readonly mem = new Uint8Array(MEM.size)
  readonly gpio = new Gpio()
  readonly bus: SfrBus
  readonly events = new EventQueue()
  readonly output: OutputLine[] = []
  /** Temps simulé — ticks de INFO3.clock.timeBaseHz (entier) */
  t = 0
  /** Fosc courant, calculé depuis OSCCON1 et OSCFRQ — Hz */
  fosc: number = CLK.foscDefault
  /** Ticks par cycle instruction à l'horloge courante */
  ticksPerTcy = 0
  /** Diagnostic : broches lues bit à bit (GetValue, PORTxbits) alors qu'elles sont en analogique */
  readonly analogReads = new Set<string>()
  /** Diagnostic : broches en entrée dont le LAT a été modifié */
  readonly inputWrites = new Set<string>()
  pc = 0
  halted: string | null = null
  /** Profondeur de la pile matérielle utilisée (0 dans main) */
  get stackDepth() {
    return this.frames.length
  }

  private st = new Float64Array(INFO3.vm.operandStackSize)
  private sp = 0
  private fp = 0
  private dsp = 0
  private frames: Frame[] = []
  private delayLeft = 0
  private irqDirty = true
  private irqPending = false
  private pauseRequested = false
  private breakMap = new Uint8Array(0)
  private skipBreak = -1
  private breakpoint: { file: string; line: number } | null = null
  private outputListeners: ((l: OutputLine) => void)[] = []
  private warnedNoIsr = false
  private rng: () => number
  readonly buttons: Record<string, { button: Button; pin: string }> = {}

  constructor(opts: VmOptions = {}) {
    this.rng = mulberry32(opts.seed ?? INFO3.vm.defaultSeed)
    this.bus = new SfrBus(this.mem, this.gpio, () => this.t, () => (this.irqDirty = true))
    const clockRegs = new Set([this.bus.addrOf.OSCCON1, this.bus.addrOf.OSCFRQ])
    const pir4 = this.bus.addrOf[INFO3.timers.irq.flag]
    this.bus.onPlainWrite = (addr) => {
      if (clockRegs.has(addr)) this.updateClock()
      else if (addr === pir4) this.probePir4()
    }
    this.bus.onInputWrite = (port, mask) => {
      for (let b = 0; b < INFO3.c.bitsPerByte; b++) if (mask & (1 << b)) this.inputWrites.add(`R${port}${b}`)
    }
    this.updateClock()
    // IOC : un front sur une broche dont IOCxP / IOCxN est à 1 lève IOCxF (IOCIF en découle)
    for (const p of IRQ.iocPorts) this.iocRegs[p] = { P: this.bus.addrOf[`IOC${p}P`], N: this.bus.addrOf[`IOC${p}N`], F: this.bus.addrOf[`IOC${p}F`] }
    this.gpio.onChange((c) => this.iocPin(c))
    this.createTimers()
    this.createMssp()
    this.createPwm()
    this.createEusart()
    this.createAdcc()
    this.gpio.onChange((c) => this.ringPin(c))
    for (const b of INFO3.pins.buttons) {
      this.buttons[b.name] = { button: new Button({ activeLevel: b.activeLevel as Level, rng: () => this.rng() }), pin: b.pin }
    }
    this.powerOn()
  }

  /* ═════════════ Temps ═════════════ */

  /** Recalcule Fosc et la durée d'un Tcy après une écriture dans OSCCON1 / OSCFRQ (ou un reset) */
  private updateClock() {
    this.fosc = foscFromRegisters(this.mem[this.bus.addrOf.OSCCON1], this.mem[this.bus.addrOf.OSCFRQ])
    this.ticksPerTcy = Math.round((CLK.timeBaseHz * CLK.foscPerTcy) / this.fosc)
    for (const tm of Object.values(this.timers)) tm.updateClock()
    if (this.eusart) this.configureEusart()
  }

  /* ═════════════ Timers 2, 4, 6 ═════════════ */

  /** Timers par numéro (2, 4, 6) */
  readonly timers: Record<number, Timer246> = {}

  private createTimers() {
    const regs: TimerReg[] = ['TMR', 'PR', 'CON', 'HLT', 'CLKCON', 'RST']
    const sfrName = (n: number, r: TimerReg) => `T${n}${r}`
    for (const n of INFO3.timers.ids) {
      const tm = new Timer246({
        now: () => this.tNow,
        clockHz: (cs) => timerClockHz(cs, this.fosc, hfintoscFromRegister(this.mem[this.bus.addrOf.OSCFRQ])),
        schedule: (t, fn) => this.events.pushFn(t, fn),
        raiseFlag: () => this.bus.writeBit(INFO3.timers.irq.flag, `TMR${n}IF`, 1),
        clearOn: () => {
          const b = this.bus.bit(sfrName(n, 'CON'), `TMR${n}ON`)
          this.mem[b.addr] &= ~b.mask
        },
        onChange: () => this.timerChanged(n),
      })
      this.timers[n] = tm
      for (const r of regs) {
        const addr = this.bus.addrOf[sfrName(n, r)]
        this.bus.writeHooks.set(addr, (v) => tm.write(r, v))
      }
      this.bus.readHooks.set(this.bus.addrOf[sfrName(n, 'TMR')], () => tm.read('TMR') ?? 0)
      this.ersPps[n] = this.bus.addrOf[`T${n}INPPS`]
    }
    // Entrée TMRx_ers : broche choisie par TxINPPS (port << 3 | bit), lue par le buffer numérique (ANSEL = 0)
    this.gpio.onChange((c) => {
      const { port, bit } = parsePin(c.pin)
      const code = (PORT_NAMES.indexOf(port) << INFO3.timers.ppsPortShift) | bit
      if ((this.gpio.readReg('ANSEL', port) >> bit) & 1) return
      for (const n of INFO3.timers.ids) if (this.mem[this.ersPps[n]] === code) this.timers[n].ersEdge(c.level === 1)
    })
  }

  private readonly ersPps: Record<number, number> = {}

  /* ═════════════ MSSP1 en SPI maître ═════════════ */

  readonly mssp: MsspSpi = new MsspSpi({
    now: () => this.tNow,
    schedule: (t, fn) => this.events.pushFn(t, fn),
    sckPeriodTicks: (sspm, add) => {
      const src = INFO3.spi.clockSources.find((s) => s.sspm === sspm)
      if (!src) return Infinity
      if (src.tcy) return src.tcy * this.ticksPerTcy
      if (src.label === 'FOSC/4_SSPxADD') return (add + 1) * this.ticksPerTcy
      // T2_match_PR2/2 : SCK bascule à chaque égalité TMR2 = PR2
      return 2 * this.timers[INFO3.timers.ids[0]].periodTicks()
    },
    setSck: (l) => this.drivePps(INFO3.spi.ppsOut.SCK1, l),
    setSdo: (l) => this.drivePps(INFO3.spi.ppsOut.SDO1, l),
    readSdi: () => (this.spiPins.SDI1 ? this.gpio.level(this.spiPins.SDI1) : (INFO3.floatingInputLevel as Level)),
    raiseFlag: () => this.bus.writeBit(INFO3.spi.irq.flag, INFO3.spi.irq.bit, 1),
  })
  /** Broches attribuées par PPS (SCK1, SDO1 en sortie ; SDI1 en entrée) */
  readonly spiPins: { SCK1: string | null; SDO1: string | null; SDI1: string | null } = { SCK1: null, SDO1: null, SDI1: null }

  private createMssp() {
    const a = this.bus.addrOf
    const m = this.mssp
    this.bus.readHooks.set(a.SSP1STAT, () => m.stat)
    this.bus.readHooks.set(a.SSP1CON1, () => m.con1)
    this.bus.readHooks.set(a.SSP1BUF, () => m.readBuf())
    this.bus.readHooks.set(a.SSP1ADD, () => m.add)
    this.bus.writeHooks.set(a.SSP1STAT, (v) => m.writeStat(v))
    this.bus.writeHooks.set(a.SSP1CON1, (v) => m.writeCon1(v))
    this.bus.writeHooks.set(a.SSP1BUF, (v) => m.writeBuf(v))
    this.bus.writeHooks.set(a.SSP1ADD, (v) => m.writeAdd(v))
    const remap = () => this.mapPps()
    for (const pin of ALL_PINS) {
      const addr = a[`${pin}PPS`]
      if (addr !== undefined) this.bus.writeHooks.set(addr, remap)
    }
    this.bus.writeHooks.set(a.SSP1DATPPS, remap)
    this.bus.writeHooks.set(a.RXPPS, remap)
  }

  /* ═════════════ PPS de sortie (SCK1, SDO1, CCP1, PWM6, PWM7…) ═════════════ */

  /** Code PPS de sortie de chaque broche qui en a un connu (0 = LATx) */
  private ppsOwner: Record<string, number> = {}
  /** Broches de chaque code de sortie */
  private ppsPins = new Map<number, string[]>()

  /** Niveau imposé par la source d'un code de sortie PPS ; null = code non simulé (la broche reste sur LATx) */
  private ppsLevel(code: number): Level | null {
    if (code === INFO3.spi.ppsOut.SCK1) return this.mssp.sck
    if (code === INFO3.spi.ppsOut.SDO1) return this.mssp.sdo
    const m = INFO3.pwm.modules.find((x) => x.ppsOut === code)
    if (m) return this.pwm[m.id].level
    if (code === INFO3.eusart.ppsOutTx) return this.eusart.level
    return null
  }

  /** Niveau d'une source sur toutes les broches qui lui sont confiées */
  private drivePps(code: number, level: Level) {
    const pins = this.ppsPins.get(code)
    if (pins) for (const pin of pins) this.gpio.setPeripheralLevel(pin, level, this.tNow)
  }

  /** Relit les registres PPS : sorties confiées aux périphériques, puis SDI1 (entrée) */
  private mapPps() {
    for (const pin of ALL_PINS) {
      const addr = this.bus.addrOf[`${pin}PPS`]
      if (addr === undefined) continue
      const raw = this.mem[addr]
      const level = raw ? this.ppsLevel(raw) : null
      const code = level === null ? 0 : raw
      if ((this.ppsOwner[pin] ?? 0) === code) continue
      if (code) {
        this.ppsOwner[pin] = code
        this.gpio.setPeripheralLevel(pin, level!, this.t)
        this.gpio.setPeripheral(pin, true, this.t)
      } else {
        delete this.ppsOwner[pin]
        this.gpio.setPeripheral(pin, false, this.t)
      }
    }
    this.ppsPins = new Map()
    for (const [pin, code] of Object.entries(this.ppsOwner)) this.ppsPins.set(code, [...(this.ppsPins.get(code) ?? []), pin])
    this.spiPins.SCK1 = this.ppsPins.get(INFO3.spi.ppsOut.SCK1)?.[0] ?? null
    this.spiPins.SDO1 = this.ppsPins.get(INFO3.spi.ppsOut.SDO1)?.[0] ?? null
    this.spiPins.SDI1 = this.ppsInput(this.mem[this.bus.addrOf.SSP1DATPPS])
    this.rxPin = this.ppsInput(this.mem[this.bus.addrOf.RXPPS])
  }

  /** Broche désignée par un registre PPS d'entrée (port << 3 | bit), null si inexistante */
  private ppsInput(v: number): string | null {
    const port = PORT_NAMES[v >> INFO3.timers.ppsPortShift]
    const pin = port ? pinName(port, v & ((1 << INFO3.timers.ppsPortShift) - 1)) : null
    return pin && ALL_PINS.includes(pin) ? pin : null
  }

  /** Broches confiées à un module PPS (inspecteur, tests) */
  ppsPinsOf(code: number): string[] {
    return this.ppsPins.get(code) ?? []
  }

  /* ═════════════ PWM : CCP1, PWM6, PWM7 (cours p. 85 à 90) ═════════════ */

  readonly pwm = {} as Record<string, PwmChannel>

  private createPwm() {
    const a = this.bus.addrOf
    for (const m of INFO3.pwm.modules) {
      const ch = new PwmChannel({
        now: () => this.tNow,
        schedule: (t, fn) => this.events.pushFn(t, fn),
        timebase: () => this.timers[this.pwmTimer(m.id)]?.timebase() ?? null,
        tickS: 1 / CLK.timeBaseHz,
        setLevel: (l) => this.drivePps(m.ppsOut, l),
      })
      this.pwm[m.id] = ch
      const regs = m.kind === 'ccp' ? ['CCPR1L', 'CCPR1H', 'CCP1CON'] : [`${m.id}DCL`, `${m.id}DCH`, `${m.id}CON`]
      for (const r of [...regs, m.tsel.sfr]) {
        const prev = this.bus.writeHooks.get(a[r])
        this.bus.writeHooks.set(a[r], (v) => {
          prev?.(v)
          this.configurePwm(m.id)
        })
      }
    }
  }

  /** Numéro du timer choisi par CCPTMRSx pour un module (0 = aucun) */
  pwmTimer(id: string): number {
    const m = INFO3.pwm.modules.find((x) => x.id === id)!
    const code = (this.mem[this.bus.addrOf[m.tsel.sfr]] >> m.tsel.shift) & INFO3.pwm.tselMask
    return INFO3.pwm.timerSelect[code] ?? 0
  }

  /** Relit les registres d'un module PWM : marche, rapport cyclique 10 bits, polarité */
  private configurePwm(id: string) {
    const ch = this.pwm[id]
    if (!ch) return
    const r = (n: string) => this.mem[this.bus.addrOf[n]]
    const B = INFO3.c.bitsPerByte
    const two = INFO3.pwm.dutyBits - B
    if (id === 'CCP1') {
      const con = r('CCP1CON')
      const en = (con >> (B - 1)) & 1
      const mode = con & INFO3.pwm.ccpPwmMode
      const fmt = this.bus.readBit('CCP1CON', 'CCP1FMT')
      const h = r('CCPR1H')
      const l = r('CCPR1L')
      const duty = fmt ? (h << two) | (l >> (B - two)) : ((h & ((1 << two) - 1)) << B) | l
      ch.configure(en === 1 && mode === INFO3.pwm.ccpPwmMode, duty, false)
    } else {
      const duty = (r(`${id}DCH`) << two) | (r(`${id}DCL`) >> (B - two))
      ch.configure(this.bus.readBit(`${id}CON`, `${id}EN`) === 1, duty, this.bus.readBit(`${id}CON`, `${id}POL`) === 1)
    }
    ch.resync()
  }

/* ═════════════ EUSART (cours p. 104 à 110) ═════════════ */

  readonly eusart: EusartTx = new EusartTx({
    now: () => this.tNow,
    schedule: (t, fn) => this.events.pushFn(t, fn),
    setTx: (l) => this.drivePps(INFO3.eusart.ppsOutTx, l),
    flags: () => (this.irqDirty = true),
  })
  /** Réception : broche RX (RXPPS), décodeur au baud du PIC, FIFO de 2 octets, OERR et FERR */
  private rxPin: string | null = null
  private readonly rx = new UartDecoder(Infinity, FORMAT_8N1)
  private rxFifo: { byte: number; ferr: boolean }[] = []
  private oerr = false
  private rxWaiting = false
  /** Baud réel de l'EUSART (0 = arrêté) */
  baud = 0

  private createEusart() {
    const a = this.bus.addrOf
    const E = INFO3.eusart.irq
    const txif = this.bus.bit(E.flag, E.tx)
    const rcif = this.bus.bit(E.flag, E.rx)
    const trmt = this.bus.bit('TX1STA', 'TRMT')
    const oerr = this.bus.bit('RC1STA', 'OERR')
    const ferr = this.bus.bit('RC1STA', 'FERR')
    this.bus.readHooks.set(txif.addr, () => (this.mem[txif.addr] & ~(txif.mask | rcif.mask)) | (this.eusart.txif ? txif.mask : 0) | (this.rxFifo.length ? rcif.mask : 0))
    this.bus.readHooks.set(trmt.addr, () => (this.mem[trmt.addr] & ~trmt.mask) | (this.eusart.trmt ? trmt.mask : 0))
    this.bus.readHooks.set(oerr.addr, () => (this.mem[oerr.addr] & ~(oerr.mask | ferr.mask)) | (this.oerr ? oerr.mask : 0) | (this.rxFifo[0]?.ferr ? ferr.mask : 0))
    this.bus.readHooks.set(a.RC1REG, () => {
      const x = this.rxFifo.shift()
      this.irqDirty = true
      return x?.byte ?? 0
    })
    this.bus.writeHooks.set(a.TX1REG, (v) => this.eusart.write(v))
    for (const r of ['TX1STA', 'RC1STA', 'BAUD1CON', 'SP1BRGL', 'SP1BRGH']) this.bus.writeHooks.set(a[r], () => this.configureEusart())
    this.gpio.onChange((c) => {
      if (c.pin !== this.rxPin) return
      this.rx.edge(c.t, c.level)
      this.scheduleRx()
    })
  }

  /** Baud et validation depuis SPBRG, BRG16, BRGH, SPEN, TXEN, CREN */
  private configureEusart() {
    const bit = (sfr: string, b: string) => this.bus.readBit(sfr, b) === 1
    const spbrg = this.mem[this.bus.addrOf.SP1BRGL] | (this.mem[this.bus.addrOf.SP1BRGH] << INFO3.c.bitsPerByte)
    const spen = bit('RC1STA', 'SPEN')
    this.baud = spen ? baudOf(this.fosc, bit('BAUD1CON', 'BRG16'), bit('TX1STA', 'BRGH'), spbrg) : 0
    const bitTicks = this.baud ? CLK.timeBaseHz / this.baud : Infinity
    this.eusart.configure(spen && bit('TX1STA', 'TXEN') && !bit('TX1STA', 'SYNC'), bitTicks)
    this.rx.configure(bitTicks, FORMAT_8N1)
    // CREN = 0 : réception arrêtée, OERR effacé (cours p. 105)
    if (!bit('RC1STA', 'CREN')) this.oerr = false
    this.irqDirty = true
  }

  /** Une trame commence sur RX : décodage programmé à son dernier échantillon */
  private scheduleRx() {
    if (this.rxWaiting) return
    const t0 = this.rx.nextStart()
    if (t0 === null || !Number.isFinite(this.rx.bitTicks)) return
    this.rxWaiting = true
    this.events.pushFn(Math.ceil(this.rx.frameEnd(t0)), () => {
      this.rxWaiting = false
      const receiving = this.baud > 0 && this.bus.readBit('RC1STA', 'CREN') === 1
      for (const d of this.rx.flush(this.tNow)) {
        if (!receiving || this.oerr) continue
        if (this.rxFifo.length >= INFO3.eusart.rxFifo) this.oerr = true
        else this.rxFifo.push({ byte: d.byte, ferr: d.framingError })
      }
      this.irqDirty = true
      this.scheduleRx()
    })
  }

  /** Broche RX de l'EUSART (RXPPS), null si aucune */
  get eusartRxPin() {
    return this.rxPin
  }

/* ═════════════ ADCC et entrées analogiques (cours p. 92 à 100) ═════════════ */

  /** Tension de chaque broche analogique pilotée par le banc (potentiomètre, joystick) — V */
  readonly analogIn: Record<string, number> = {}
  /** Conversions effectuées (instants en ticks, voie ADPCH, code) : professeur virtuel */
  readonly adcLog: { t0: number; t1: number; ch: number; code: number }[] = []
  private adcGen = 0
  private adcRng = mulberry32(INFO3.adcc.seed)
  private adcBusy = false

  private createAdcc() {
    this.setPot(INFO3.analog.potStart)
    this.setJoystick(0, 0)
    this.bus.writeHooks.set(this.bus.addrOf.ADCON0, () => this.adcControl())
  }

  /** Potentiomètre R1 (RA0) : fraction de la course, 0 à 1 */
  setPot(frac: number) {
    this.analogIn[INFO3.pins.pot.pin] = Math.min(1, Math.max(0, frac)) * INFO3.adcc.vref
  }

  /** Joystick : x vers la droite, y vers le haut (-1 à 1) ; tensions de JOY_HORZ et JOY_VERT (H4, H48) */
  setJoystick(x: number, y: number) {
    const raw = joystickRaw(x, y)
    const j = INFO3.pins.joystick
    this.analogIn[j.horz] = voltsOf(raw.x)
    this.analogIn[j.vert] = voltsOf(raw.y)
  }

  /** Bouton du joystick (JOY_SW, RA1) */
  joySw(pressed: boolean) {
    const j = INFO3.pins.joystick
    this.gpio.setExternal(j.sw, (pressed ? j.swActiveLevel : 1 - j.swActiveLevel) as Level, this.t)
  }

  /** Écriture d'ADCON0 : ADGO = 1 lance une conversion, ADGO = 0 ou ADON = 0 l'interrompt */
  private adcControl() {
    const go = this.bus.readBit('ADCON0', 'ADGO') === 1
    const on = this.bus.readBit('ADCON0', 'ADON') === 1
    if (!go || !on) {
      if (this.adcBusy) this.adcGen++
      this.adcBusy = false
      return
    }
    if (this.adcBusy) return
    this.adcBusy = true
    const g = ++this.adcGen
    const ch = this.mem[this.bus.addrOf.ADPCH]
    const pin = ALL_PINS.find((p) => channelOf(p) === ch)
    const vin = pin ? (this.analogIn[pin] ?? 0) : 0
    const code = noisyCode(vin, this.adcRng())
    const tad = tadOf(this.fosc, this.bus.readBit('ADCON0', 'ADCS') === 1, this.mem[this.bus.addrOf.ADCLK])
    const t0 = this.tNow
    const t1 = Math.round(t0 + conversionS(tad, this.mem[this.bus.addrOf.ADACQ]) * CLK.timeBaseHz)
    this.events.pushFn(t1, () => {
      if (g !== this.adcGen) return
      this.adcBusy = false
      const r = resultRegisters(code, this.bus.readBit('ADCON0', 'ADFM') === 1)
      this.mem[this.bus.addrOf.ADRESH] = r.ADRESH
      this.mem[this.bus.addrOf.ADRESL] = r.ADRESL
      const goBit = this.bus.bit('ADCON0', 'ADGO')
      this.mem[goBit.addr] &= ~goBit.mask
      if (this.adcLog.length < INFO3.analyzer.maxChanges) this.adcLog.push({ t0, t1, ch, code })
      this.bus.writeBit(INFO3.adcc.irq.flag, INFO3.adcc.irq.bit, 1)
    })
  }

  /** Base de temps d'un timer modifiée : les PWM qui l'utilisent recalculent leurs fronts */
  private timerChanged(n: number) {
    if (!this.pwm) return
    for (const m of INFO3.pwm.modules) if (this.pwm[m.id] && this.pwmTimer(m.id) === n) this.pwm[m.id].resync()
  }

  /* ═════════════ Carte ROTARY O click (codeur EC12D) ═════════════ */

  readonly encoder = new Ec12d()
  rotarySlot: RotarySlot | null = null
  private rotaryPins: { A: string; B: string; SW: string } | null = null
  /** Fin du dernier pas programmé (ticks) : les pas demandés s'enchaînent */
  private rotaryBusyUntil = 0
  private spinRate = 0
  private spinGen = 0

  /** Broches du codeur selon le mikroBUS (ENCA → PWM, ENCB → AN, SW → INT : H35) */
  static rotaryPinsOf(slot: RotarySlot): { A: string; B: string; SW: string } {
    const bus = INFO3.pins[slot] as Record<string, string>
    const w = INFO3.rotary.wiring
    return { A: bus[w.ENCA], B: bus[w.ENCB], SW: bus[w.SW] }
  }

  /** Enfiche (ou retire) la carte Rotary : ses sorties pilotent les broches du mikroBUS choisi */
  setRotarySlot(slot: RotarySlot | null) {
    if (this.rotaryPins) for (const p of Object.values(this.rotaryPins)) this.gpio.setExternal(p, null, this.t)
    if (this.ringPins) this.gpio.setExternal(this.ringPins.Q7S, null, this.t)
    this.rotarySlot = slot
    this.rotaryPins = slot ? Vm.rotaryPinsOf(slot) : null
    this.ringPins = slot ? Vm.ringPinsOf(slot) : null
    this.driveRotary()
    this.resetRing()
  }

  /* ═════════════ Anneau de 16 LED (deux 74HC595) ═════════════ */

  readonly ring = new Hc595x2()
  private ringPins: Record<keyof typeof INFO3.ring.wiring, string> | null = null
  private ringListeners: ((t: number, outputs: number) => void)[] = []

  /** Broches de la chaîne de 74HC595 selon le mikroBUS (RST → MR, CS → LATCH, bus SPI) */
  static ringPinsOf(slot: RotarySlot): Record<keyof typeof INFO3.ring.wiring, string> {
    const bus = INFO3.pins[slot] as Record<string, string>
    const w = INFO3.ring.wiring
    return { MR: bus[w.MR], LATCH: bus[w.LATCH], SER: bus[w.SER], SRCLK: bus[w.SRCLK], Q7S: bus[w.Q7S] }
  }

  onRing(cb: (t: number, outputs: number) => void): () => void {
    this.ringListeners.push(cb)
    return () => {
      this.ringListeners = this.ringListeners.filter((l) => l !== cb)
    }
  }

  /** Mise sous tension de la carte : registre et sorties à 0, MR et LATCH lus sur les broches (H36) */
  private resetRing() {
    const p = this.ringPins
    const before = this.ring.outputs
    this.ring.reset(p ? this.gpio.level(p.MR) : 0, p ? this.gpio.level(p.LATCH) : 0)
    if (p) this.gpio.setExternal(p.Q7S, this.ring.q7s, this.tNow)
    if (before !== this.ring.outputs) for (const cb of this.ringListeners) cb(this.tNow, this.ring.outputs)
  }

  private ringPin(c: PinChange) {
    const p = this.ringPins
    if (!p) return
    if (c.pin === p.SRCLK && c.level === 1) this.ring.clock(this.gpio.level(p.SER))
    else if (c.pin === p.MR) this.ring.setMr(c.level)
    else if (c.pin === p.LATCH) {
      if (this.ring.setLatch(c.level)) for (const cb of this.ringListeners) cb(c.t, this.ring.outputs)
      return
    } else return
    if (this.gpio.level(p.Q7S) !== this.ring.q7s) this.gpio.setExternal(p.Q7S, this.ring.q7s, c.t)
  }

  private driveRotary() {
    const p = this.rotaryPins
    if (!p) return
    this.gpio.setExternal(p.A, this.encoder.a, this.t)
    this.gpio.setExternal(p.B, this.encoder.b, this.t)
    this.gpio.setExternal(p.SW, (1 - INFO3.rotary.swActiveLevel) as Level, this.t)
  }

  /** Tourne de `detents` crans (signe = sens), un cran toutes les `stepS` secondes au plus vite */
  turn(detents: number, stepS = 2 * INFO3.rotary.phaseDelayS, at = this.t) {
    const dir = detents < 0 ? -1 : 1
    const stepTicks = Math.max(stepS, 2 * INFO3.rotary.phaseDelayS) * CLK.timeBaseHz
    let start = Math.max(at, this.rotaryBusyUntil)
    for (let i = 0; i < Math.abs(detents); i++) {
      for (const e of this.encoder.step(dir)) {
        const pin = this.rotaryPins?.[e.channel]
        if (pin) this.setExternal(pin, e.level, Math.round(start + e.dt * CLK.timeBaseHz))
      }
      start += stepTicks
    }
    this.rotaryBusyUntil = start
  }

  /** Rotation continue : `rate` crans/s (signe = sens), 0 = arrêt */
  spin(rate: number) {
    this.spinRate = rate
    const g = ++this.spinGen
    if (!rate) return
    const next = () => {
      if (g !== this.spinGen) return
      this.turn(Math.sign(rate), 1 / Math.abs(rate))
      this.events.pushFn(this.rotaryBusyUntil, next)
    }
    this.events.pushFn(Math.max(this.t, this.rotaryBusyUntil), next)
  }

  /** Bouton SW du codeur (non utilisé aux TP2 et TP3) */
  rotarySw(pressed: boolean) {
    const lvl = INFO3.rotary.swActiveLevel
    if (this.rotaryPins) this.gpio.setExternal(this.rotaryPins.SW, (pressed ? lvl : 1 - lvl) as Level, this.t)
  }

  /* ═════════════ Sondes de l'analyseur logique (ISR, TMRxIF) ═════════════ */

  private probeListeners: ((p: ProbeChange) => void)[] = []
  private lastPir4 = 0

  onProbe(cb: (p: ProbeChange) => void): () => void {
    this.probeListeners.push(cb)
    return () => {
      this.probeListeners = this.probeListeners.filter((l) => l !== cb)
    }
  }

  private probe(name: string, level: Level) {
    for (const cb of this.probeListeners) cb({ name, t: this.tNow, level })
  }

  private probePir4() {
    const v = this.mem[this.bus.addrOf[INFO3.timers.irq.flag]]
    const changed = v ^ this.lastPir4
    this.lastPir4 = v
    if (!changed || !this.probeListeners.length) return
    for (const n of INFO3.timers.ids) {
      const b = this.bus.bit(INFO3.timers.irq.flag, `TMR${n}IF`)
      if (changed & b.mask) this.probe(`TMR${n}IF`, v & b.mask ? 1 : 0)
    }
  }

  /** Tcy par seconde à l'horloge courante */
  get fcy() {
    return this.fosc / CLK.foscPerTcy
  }
  msToTicks(ms: number) {
    return Math.round((ms * CLK.timeBaseHz) / INFO3.units.msPerS)
  }
  /** Ticks → secondes */
  toS(ticks: number) {
    return ticks / CLK.timeBaseHz
  }
  get timeS() {
    return this.toS(this.t)
  }

  /* ═════════════ Chargement et reset ═════════════ */

  load(program: Program) {
    this.program = program
    this.breakMap = new Uint8Array(program.code.length)
    this.breakpoint = null
    this.reset()
  }

  /** Mise sous tension : temps à 0, trace et événements effacés, programme au début de main */
  reset() {
    this.t = 0
    this.events.clear()
    // Le codeur ne bouge pas : ses sorties reprennent le niveau du cran courant, la rotation continue repart
    this.rotaryBusyUntil = 0
    this.driveRotary()
    if (this.spinRate) this.spin(this.spinRate)
    // Mise sous tension : les 74HC595 repartent de zéro
    this.resetRing()
    this.gpio.trace = []
    this.halted = null
    this.analogReads.clear()
    for (const k of Object.keys(this.irqCalls)) delete this.irqCalls[k]
    this.inputWrites.clear()
    this.powerOn()
  }

  private powerOn() {
    this.bus.reset()
    this.gpio.reset()
    for (const { button, pin } of Object.values(this.buttons)) {
      button.pressed = false
      this.gpio.setExternal(pin, button.idleLevel, this.t)
    }
    this.joySw(false)
    this.gpio.settle(this.t)
    this.cpuReset()
  }

  /** Reset du cœur (POR ou débordement de pile) : SFR au reset, variables globales initialisées, pc = main */
  private cpuReset(keep: Record<string, number> = {}) {
    this.bus.reset(keep)
    this.lastPir4 = 0
    for (const tm of Object.values(this.timers)) tm.reset()
    this.updateClock()
    this.gpio.reset()
    // PPS au reset : aucune sortie confiée à un périphérique
    this.spiPins.SCK1 = this.spiPins.SDO1 = this.spiPins.SDI1 = null
    this.ppsOwner = {}
    this.ppsPins = new Map()
    this.mssp.reset()
    for (const ch of Object.values(this.pwm)) ch.reset()
    this.eusart.reset()
    this.rx.reset(1)
    this.rxPin = null
    this.rxFifo = []
    this.oerr = false
    this.rxWaiting = false
    this.baud = 0
    this.adcGen++
    this.adcBusy = false
    this.adcRng = mulberry32(INFO3.adcc.seed)
    this.adcLog.length = 0
    this.gpio.settle(this.t)
    this.sp = 0
    this.frames = []
    this.delayLeft = 0
    this.irqDirty = true
    this.skipBreak = -1
    const p = this.program
    if (!p) {
      this.halted = 'aucun programme'
      return
    }
    this.mem.fill(0, MEM.globalsBase)
    this.mem.set(p.image, p.globalsBase)
    const main = p.funcs[p.mainIndex]
    this.fp = MEM.stackBase
    this.dsp = MEM.stackBase + main.frameSize
    this.pc = main.entry
    this.halted = null
  }

  /* ═════════════ Sortie (fenêtre Output) ═════════════ */

  onOutput(cb: (l: OutputLine) => void): () => void {
    this.outputListeners.push(cb)
    return () => {
      this.outputListeners = this.outputListeners.filter((l) => l !== cb)
    }
  }

  private emitOutput(l: OutputLine) {
    this.output.push(l)
    for (const cb of this.outputListeners) cb(l)
  }

  private halt(reason: string) {
    this.halted = reason
    const pos = this.sourcePos(this.pc)
    this.emitOutput({ level: 'error', text: reason, ...pos })
  }

  /** Position source (fichier, ligne) de l'instruction pc */
  sourcePos(pc: number): { file?: string; line?: number } {
    const p = this.program
    if (!p || pc < 0 || pc >= p.code.length) return {}
    return { file: p.files[p.pcFile[pc]], line: p.pcLine[pc] }
  }

  /* ═════════════ Exécution ═════════════ */

  runFor(span: RunSpan): StopReason {
    const until = this.t + ('tcy' in span ? span.tcy * this.ticksPerTcy : this.msToTicks(span.ms))
    for (;;) {
      const r = this.exec(until, INFO3.vm.sliceOps, STEP_NONE)
      if (r !== 'ops') return r
    }
  }

  /** Une tranche d'exécution : au plus sliceMs simulées ou sliceOps opérations */
  runSlice(maxTicks = this.msToTicks(INFO3.vm.sliceMs)): StopReason {
    return this.exec(this.t + maxTicks, INFO3.vm.sliceOps, STEP_NONE)
  }

  /** Exécute jusqu'à ce que `pred` soit vrai (testé à chaque tranche), au plus maxMs simulées */
  runUntil(pred: (vm: Vm) => boolean, maxMs: number): boolean {
    const end = this.t + this.msToTicks(maxMs)
    const chunk = this.msToTicks(INFO3.vm.sliceMs)
    while (this.t < end) {
      if (pred(this)) return true
      const r = this.exec(Math.min(end, this.t + chunk), INFO3.vm.sliceOps, STEP_NONE)
      if (r === 'halted' || r === 'breakpoint' || r === 'paused') return pred(this)
    }
    return pred(this)
  }

  /** Step Into : avance d'une ligne source, en entrant dans les fonctions appelées */
  step(): StopReason {
    return this.exec(Infinity, INFO3.vm.stepMaxOps, STEP_INTO)
  }

  /** Step Over : avance d'une ligne source sans s'arrêter dans les fonctions appelées (ni dans l'ISR) */
  stepOver(): StopReason {
    return this.exec(Infinity, INFO3.vm.stepMaxOps, STEP_OVER)
  }

  /** Step Out : termine la fonction en cours et s'arrête au retour dans l'appelant (dans main : Step Over) */
  stepOut(): StopReason {
    return this.exec(Infinity, INFO3.vm.stepMaxOps, this.frames.length === 0 ? STEP_OVER : STEP_OUT)
  }

  pause() {
    this.pauseRequested = true
  }

  /* ═════════════ Point d'arrêt (un seul, annexe 7) ═════════════ */

  setBreakpoint(file: string, line: number): { ok: boolean; line: number; warning?: string } {
    const p = this.program
    if (!p) return { ok: false, line }
    const fi = p.files.indexOf(file)
    // Première ligne exécutable à partir de `line`
    let target = -1
    for (let pc = 0; pc < p.code.length; pc++) {
      if (p.stmtStart[pc] && p.pcFile[pc] === fi && p.pcLine[pc] >= line && (target < 0 || p.pcLine[pc] < target)) target = p.pcLine[pc]
    }
    if (target < 0) return { ok: false, line, warning: `Aucune instruction exécutable à ${file}:${line} ou après` }
    let warning: string | undefined
    if (this.breakpoint) warning = `Un seul point d'arrêt est disponible : ${file}:${target} remplace ${this.breakpoint.file}:${this.breakpoint.line}`
    this.breakMap.fill(0)
    for (let pc = 0; pc < p.code.length; pc++) if (p.stmtStart[pc] && p.pcFile[pc] === fi && p.pcLine[pc] === target) this.breakMap[pc] = 1
    this.breakpoint = { file, line: target }
    return { ok: true, line: target, warning }
  }

  clearBreakpoint() {
    this.breakMap.fill(0)
    this.breakpoint = null
  }

  getBreakpoint() {
    return this.breakpoint
  }

  /* ═════════════ Broches, SFR, variables ═════════════ */

  getPin(name: string): Level {
    return this.gpio.level(name)
  }

  onPinChange(cb: (c: PinChange) => void): () => void {
    return this.gpio.onChange(cb)
  }

  private sfrAddr(sfr: string | number): number {
    if (typeof sfr === 'number') return sfr
    const a = this.bus.addrOf[sfr]
    if (a === undefined) throw new Error(`SFR inconnu : ${sfr}`)
    return a
  }

  readSfr(sfr: string | number): number {
    return this.bus.read(this.sfrAddr(sfr))
  }

  writeSfr(sfr: string | number, value: number) {
    this.bus.write(this.sfrAddr(sfr), value & MASK8)
  }

  /** Hook de test : met un flag d'interruption à 1 */
  raiseFlag(sfr: string, bit: string) {
    this.bus.writeBit(sfr, bit, 1)
  }

  /** Pilotage externe d'une broche, immédiat ou daté (Tcy) */
  /** t : instant en ticks (défaut : maintenant) */
  setExternal(pin: string, level: Level | null, at = this.t) {
    if (at <= this.t) this.gpio.setExternal(pin, level, this.t)
    else this.events.push(at, pin, level)
  }

  /** Appui sur un bouton de la carte (S1, S2) ; `bounce` : rebonds H3 */
  press(name: string, bounce = false, at = this.t) {
    const b = this.buttons[name]
    this.scheduleEdges(b.pin, b.button.press(this.toS(at), bounce))
  }

  release(name: string, bounce = false, at = this.t) {
    const b = this.buttons[name]
    this.scheduleEdges(b.pin, b.button.release(this.toS(at), bounce))
  }

  setSeed(seed: number) {
    this.rng = mulberry32(seed)
  }

  private scheduleEdges(pin: string, edges: Edge[]) {
    for (const e of edges) this.setExternal(pin, e.level, Math.round(e.t * CLK.timeBaseHz))
  }

  /**
   * Valeur d'une variable : `nom` (globale) ou `fonction:nom` (locale du cadre actif le plus récent).
   * Scalaire → nombre, tableau → liste, struct → objet par champ.
   */
  peekVar(name: string): number | number[] | Record<string, number> | null {
    const p = this.program
    if (!p) return null
    const colon = name.indexOf(':')
    if (colon >= 0) {
      const fname = name.slice(0, colon)
      const vname = name.slice(colon + 1)
      const fi = p.funcs.findIndex((f) => f.name === fname)
      if (fi < 0) return null
      const meta = p.funcs[fi]
      const loc = meta.locals.find((l) => l.name === vname)
      if (!loc) return null
      const fp = this.framePointerOf(meta)
      if (fp < 0) return null
      return this.decode(fp + loc.off, loc.type)
    }
    const g = p.globals.find((x) => x.name === name)
    if (!g) return null
    if (g.bitOff !== undefined) return (this.readByte(g.addr) >> g.bitOff) & 1
    return this.decode(g.addr, g.type)
  }

  /** Écrit une variable globale scalaire (professeur virtuel : préparer un appel unitaire) */
  pokeVar(name: string, value: number): boolean {
    const g = this.program?.globals.find((x) => x.name === name)
    if (!g || g.type.k === 'array' || g.type.k === 'struct') return false
    this.writeK(g.addr, kindOf(g.type), value)
    return true
  }

  /** Accès direct à un octet de l'espace de données */
  peekByte(addr: number) {
    return this.readByte(addr)
  }
  pokeByte(addr: number, v: number) {
    this.writeByte(addr, v & MASK8)
  }

  /**
   * Appel unitaire d'une fonction du programme, hors de main (professeur virtuel) :
   * empile les arguments, exécute jusqu'au retour et renvoie la valeur rendue (0 pour void).
   */
  invoke(name: string, args: number[] = [], maxOps: number = INFO3.vm.stepMaxOps): { ok: true; value: number } | { ok: false; error: string } {
    const p = this.program
    if (!p) return { ok: false, error: 'aucun programme' }
    const fi = p.funcs.findIndex((f, i) => i > 0 && f.name === name && f.entry >= 0)
    if (fi < 0) return { ok: false, error: `fonction ${name} introuvable` }
    this.sp = 0
    this.frames = []
    this.delayLeft = 0
    this.halted = null
    for (const a of args) this.st[this.sp++] = a
    this.call(fi, args.length, RETURN_SENTINEL)
    const r = this.exec(Infinity, maxOps, STEP_NONE)
    if (r !== 'returned') return { ok: false, error: r === 'ops' ? `${name}() ne se termine pas` : (this.halted ?? r) }
    return { ok: true, value: this.sp > 0 ? this.st[this.sp - 1] : 0 }
  }

  /** Fonction qui contient l'instruction pc (fenêtre Variables) */
  functionAt(pc: number = this.pc): FuncMeta | null {
    const p = this.program
    if (!p) return null
    let best: FuncMeta | null = null
    for (let i = 1; i < p.funcs.length; i++) {
      const f = p.funcs[i]
      if (f.entry >= 0 && f.entry <= pc && (!best || f.entry > best.entry)) best = f
    }
    return best
  }

  private framePointerOf(meta: FuncMeta): number {
    const p = this.program!
    // Cadre actif le plus récent : remonte la pile des appels (pc courant puis adresses de retour)
    const owner = (pc: number) => p.funcs.indexOf(this.functionAt(pc) as FuncMeta)
    const metaIdx = p.funcs.indexOf(meta)
    if (owner(this.pc) === metaIdx) return this.fp
    for (let i = this.frames.length - 1; i >= 0; i--) {
      // Le cadre i a été créé par l'appel depuis frames[i].retPc ; son fp est celui de l'appelant
      if (owner(this.frames[i].retPc) === metaIdx) return this.frames[i].fp
    }
    return -1
  }

  private decode(addr: number, t: CType): number | number[] | Record<string, number> {
    if (t.k === 'array') {
      const es = sizeOf(t.of)
      return Array.from({ length: t.len ?? 0 }, (_, i) => this.decode(addr + i * es, t.of) as number)
    }
    if (t.k === 'struct') {
      const o: Record<string, number> = {}
      for (const f of t.s.fields) {
        if (!f.name) continue
        if (f.bitWidth !== undefined) o[f.name] = (this.readByte(addr + f.offset) >> f.bitOff!) & ((1 << f.bitWidth) - 1)
        else o[f.name] = this.decode(addr + f.offset, f.type) as number
      }
      return o
    }
    return this.readK(addr, kindOf(t))
  }

  /* ═════════════ Mémoire ═════════════ */

  private readByte(addr: number): number {
    return addr < MEM.sfrLimit && this.bus.isSfr(addr) ? this.bus.read(addr) : this.mem[addr]
  }

  private writeByte(addr: number, v: number) {
    if (addr < MEM.sfrLimit && this.bus.isSfr(addr)) this.bus.write(addr, v & MASK8)
    else this.mem[addr] = v
  }

  private readK(addr: number, k: Kind): number {
    if (addr < MEM.sfrLimit) {
      const n = kindSize(k)
      let v = 0
      for (let i = n - 1; i >= 0; i--) v = v * (1 << BITS8) + this.readByte(addr + i)
      if (k === Kind.F32) {
        const tmp = new Uint8Array(n)
        for (let i = 0; i < n; i++) tmp[i] = this.readByte(addr + i)
        return readKind(tmp, 0, k)
      }
      return norm(k, v)
    }
    return readKind(this.mem, addr, k)
  }

  private writeK(addr: number, k: Kind, v: number) {
    if (k === Kind.U8 || k === Kind.S8 || k === Kind.BOOL) {
      this.writeByte(addr, v & MASK8)
      return
    }
    const n = kindSize(k)
    let bits = v
    if (k === Kind.F32) {
      const dv = new DataView(new ArrayBuffer(n))
      dv.setFloat32(0, v, true)
      bits = dv.getUint32(0, true)
    }
    for (let i = 0; i < n; i++) this.writeByte(addr + i, (bits >>> (i * BITS8)) & MASK8)
  }

  private readBits(addr: number, off: number, width: number, signed: boolean): number {
    const port = this.bus.portOf(addr)
    if (port) {
      // Diagnostic R1 : lecture bit à bit d'une broche en analogique (ANSEL = 1 → lue à 0)
      const analog = this.gpio.readReg('ANSEL', port)
      for (let b = off; b < off + width && b < BITS8; b++) if (analog & (1 << b)) this.analogReads.add(`R${port}${b}`)
    }
    let raw = this.readByte(addr)
    if (off + width > BITS8) raw |= this.readByte(addr + 1) << BITS8
    const mask = (1 << width) - 1
    const v = (raw >> off) & mask
    return signed && v & (1 << (width - 1)) ? v - (1 << width) : v
  }

  private writeBits(addr: number, off: number, width: number, v: number) {
    const mask = (1 << width) - 1
    const two = off + width > BITS8
    let raw = this.readByte(addr)
    if (two) raw |= this.readByte(addr + 1) << BITS8
    raw = (raw & ~(mask << off)) | ((v & mask) << off)
    this.writeByte(addr, raw & MASK8)
    if (two) this.writeByte(addr + 1, (raw >> BITS8) & MASK8)
  }

  /* ═════════════ Interruptions ═════════════ */

  /** Inspecteur d'interruptions : nombre d'entrées en ISR attribuées à chaque source (IE·IF au moment de l'entrée) */
  readonly irqCalls: Record<string, number> = {}

  private countIrqSources() {
    const peie = this.bus.readBit(IRQ.peie.sfr, IRQ.peie.bit) === 1
    const pairs = [...IRQ.firstLevel, ...(peie ? IRQ.peripheral : [])]
    for (const [ie, iflag] of pairs) {
      const pending = this.bus.read(this.bus.addrOf[ie]) & this.bus.read(this.bus.addrOf[iflag])
      if (!pending) continue
      const bits = (INFO3.sfr as Record<string, { bits: readonly (string | null)[] }>)[iflag].bits
      bits.forEach((b, i) => {
        if (b && pending & (1 << i)) {
          const name = b.replace(/IF$/, '')
          this.irqCalls[name] = (this.irqCalls[name] ?? 0) + 1
        }
      })
    }
  }

  /** État des interruptions : GIE, PEIE et, par source dont IE, IF ou un appel est non nul, IE, IF, appels */
  irqStatus(): { gie: number; peie: number; sources: { name: string; ie: number; flag: number; calls: number }[] } {
    const sources: { name: string; ie: number; flag: number; calls: number }[] = []
    for (const [ie, iflag] of [...IRQ.firstLevel, ...IRQ.peripheral]) {
      const bits = (INFO3.sfr as Record<string, { bits: readonly (string | null)[] }>)[iflag].bits
      const ieV = this.bus.read(this.bus.addrOf[ie])
      const ifV = this.bus.read(this.bus.addrOf[iflag])
      bits.forEach((b, i) => {
        if (!b) return
        const name = b.replace(/IF$/, '')
        const e = (ieV >> i) & 1
        const f = (ifV >> i) & 1
        const calls = this.irqCalls[name] ?? 0
        if (e || f || calls) sources.push({ name, ie: e, flag: f, calls })
      })
    }
    return { gie: this.bus.readBit(IRQ.gie.sfr, IRQ.gie.bit), peie: this.bus.readBit(IRQ.peie.sfr, IRQ.peie.bit), sources }
  }

  /** Registres IOCxP, IOCxN, IOCxF par port (A, B, C, E) */
  private readonly iocRegs: Record<string, { P: number; N: number; F: number }> = {}

  private iocPin(c: PinChange) {
    const { port, bit } = parsePin(c.pin)
    const a = this.iocRegs[port]
    if (!a) return
    const m = 1 << bit
    const f = iocEdges(c.level ? 0 : m, c.level ? m : 0, this.mem[a.P], this.mem[a.N], this.gpio.readReg('ANSEL', port))
    if (f) {
      this.mem[a.F] |= f
      this.irqDirty = true
    }
  }

  private gie(): boolean {
    return this.bus.readBit(IRQ.gie.sfr, IRQ.gie.bit) === 1
  }

  private evalIrq(): boolean {
    for (const [ie, iflag] of IRQ.firstLevel) if (this.bus.read(this.bus.addrOf[ie]) & this.bus.read(this.bus.addrOf[iflag])) return true
    if (!this.bus.readBit(IRQ.peie.sfr, IRQ.peie.bit)) return false
    for (const [ie, iflag] of IRQ.peripheral) if (this.bus.read(this.bus.addrOf[ie]) & this.bus.read(this.bus.addrOf[iflag])) return true
    return false
  }

  private enterIsr() {
    const p = this.program!
    if (p.isrIndex < 0) {
      if (!this.warnedNoIsr) {
        this.warnedNoIsr = true
        this.emitOutput({ level: 'warning', text: "Interruption demandée mais aucune fonction __interrupt() n'est définie" })
      }
      this.irqPending = false
      return
    }
    if (this.frames.length >= CPU.hwStackDepth && this.stackOverflow()) return
    this.countIrqSources()
    const meta = p.funcs[p.isrIndex]
    this.frames.push({ retPc: this.pc, fp: this.fp, dsp: this.dsp, isr: true, delay: this.delayLeft })
    this.delayLeft = 0
    if (this.probeListeners.length) this.probe('ISR', 1)
    this.bus.writeBit(IRQ.gie.sfr, IRQ.gie.bit, 0)
    const lat = CPU.interruptLatencyTcy
    // Latence 3 à 5 Tcy selon la phase de l'instruction en cours (déterministe)
    this.t += (lat.min + (Math.floor(this.t / this.ticksPerTcy) % (lat.max - lat.min + 1))) * this.ticksPerTcy
    this.fp = this.dsp
    this.dsp = this.fp + meta.frameSize
    this.pc = meta.entry
  }

  /**
   * Débordement de la pile matérielle : STKOVF = 1. Avec STVREN = ON (#pragma config, défaut du composant),
   * reset du cœur ; avec STVREN = OFF, l'exécution continue (H29). Renvoie true si un reset a eu lieu.
   */
  private stackOverflow(): boolean {
    const ovf = this.bus.bit(IRQ.stackOverflow.sfr, IRQ.stackOverflow.bit)
    if (this.program?.config.STVREN === 'OFF') {
      this.bus.writeBit(IRQ.stackOverflow.sfr, IRQ.stackOverflow.bit, 1)
      return false
    }
    this.emitOutput({ level: 'error', text: 'Stack overflow reset', ...this.sourcePos(this.pc) })
    this.cpuReset({ [IRQ.stackOverflow.sfr]: ovf.mask })
    return true
  }

  /** Appel de fonction ; dropCallee : retire aussi l'index de fonction resté sous les arguments (CALLI) */
  private call(fi: number, nargs: number, retPc: number, dropCallee = false) {
    const p = this.program!
    const meta = p.funcs[fi]
    if (!meta || meta.entry < 0 || fi === 0) {
      this.halt("Appel d'un pointeur de fonction nul ou invalide : programme arrêté (H22)")
      return
    }
    if (this.frames.length >= CPU.hwStackDepth && this.stackOverflow()) return
    const st = this.st
    const newFp = this.dsp
    const params = meta.params
    for (let extra = nargs - params.length; extra > 0; extra--) this.sp--
    for (let i = Math.min(nargs, params.length) - 1; i >= 0; i--) {
      const prm = params[i]
      const v = st[--this.sp]
      if (prm.structSize !== undefined) for (let k = 0; k < prm.structSize; k++) this.mem[newFp + prm.off + k] = this.readByte(v + k)
      else this.writeK(newFp + prm.off, prm.kind, v)
    }
    if (dropCallee) this.sp--
    this.frames.push({ retPc, fp: this.fp, dsp: this.dsp, isr: false, delay: 0 })
    this.fp = newFp
    this.dsp = newFp + meta.frameSize
    if (this.dsp > MEM.size) {
      this.halt('Débordement de la mémoire des variables locales')
      return
    }
    this.pc = meta.entry
  }

  /** Instant d'un événement en cours de traitement (les périphériques datent leurs fronts à cet instant) */
  private evT: number | null = null
  /** Temps vu par les périphériques : instant de l'événement traité, sinon temps courant */
  get tNow(): number {
    return this.evT ?? this.t
  }

  private processEvents() {
    while (this.events.size && this.events.peekTime() <= this.t) {
      const e = this.events.pop()!
      this.evT = e.t
      if (e.fn) e.fn()
      else this.gpio.setExternal(e.pin, e.level, e.t)
      this.evT = null
    }
  }

  /* ═════════════ Boucle d'exécution ═════════════ */

  private exec(until: number, maxOps: number, stepMode: number): StopReason {
    const p = this.program
    if (!p) return 'halted'
    const code = p.code
    const st = this.st
    const startPc = this.pc
    const startLine = p.pcLine[startPc]
    const startFile = p.pcFile[startPc]
    const startDepth = this.frames.length
    let ops = 0
    for (;;) {
      if (this.halted) return 'halted'
      if (this.pc === RETURN_SENTINEL) return 'returned'
      if (this.pauseRequested) {
        this.pauseRequested = false
        return 'paused'
      }
      if (this.events.size && this.events.peekTime() <= this.t) this.processEvents()
      if (this.irqDirty) {
        this.irqPending = this.evalIrq()
        this.irqDirty = false
      }
      if (this.irqPending && this.gie()) {
        this.enterIsr()
        continue
      }
      if (this.delayLeft > 0) {
        let target = this.t + this.delayLeft
        if (target > until) target = until
        const ne = this.events.peekTime()
        if (ne < target) target = ne
        this.delayLeft -= target - this.t
        this.t = target
        if (this.delayLeft > 0 && this.t >= until) return 'time'
        continue
      }
      if (this.t >= until) return 'time'
      if (ops >= maxOps) return 'ops'
      const pc = this.pc
      if (stepMode !== STEP_NONE && ops > 0) {
        if (stepMode === STEP_OUT) {
          if (this.frames.length < startDepth) return 'step'
        } else if (p.stmtStart[pc] && (stepMode === STEP_INTO || this.frames.length <= startDepth) && (p.pcLine[pc] !== startLine || p.pcFile[pc] !== startFile || pc <= startPc)) return 'step'
      }
      if (this.breakMap[pc] && pc !== this.skipBreak) {
        this.skipBreak = pc
        return 'breakpoint'
      }
      this.skipBreak = -1
      ops++
      this.t += code[pc + 1] * this.ticksPerTcy
      switch (code[pc]) {
        case Op.PUSH:
          st[this.sp++] = code[pc + 2]
          this.pc = pc + 3
          break
        case Op.POP:
          this.sp--
          this.pc = pc + 2
          break
        case Op.DUP:
          st[this.sp] = st[this.sp - 1]
          this.sp++
          this.pc = pc + 2
          break
        case Op.SWAP: {
          const a = st[this.sp - 1]
          st[this.sp - 1] = st[this.sp - 2]
          st[this.sp - 2] = a
          this.pc = pc + 2
          break
        }
        case Op.LDA:
          st[this.sp++] = this.readK(code[pc + 2], code[pc + 3] as Kind)
          this.pc = pc + 4
          break
        case Op.LDL:
          st[this.sp++] = readKind(this.mem, this.fp + code[pc + 2], code[pc + 3] as Kind)
          this.pc = pc + 4
          break
        case Op.LD:
          st[this.sp - 1] = this.readK(st[this.sp - 1], code[pc + 2] as Kind)
          this.pc = pc + 3
          break
        case Op.STA: {
          const v = st[--this.sp]
          this.writeK(code[pc + 2], code[pc + 3] as Kind, v)
          if (code[pc + 4]) st[this.sp++] = v
          this.pc = pc + 5
          break
        }
        case Op.STL: {
          const v = st[--this.sp]
          this.writeK(this.fp + code[pc + 2], code[pc + 3] as Kind, v)
          if (code[pc + 4]) st[this.sp++] = v
          this.pc = pc + 5
          break
        }
        case Op.ST: {
          const v = st[--this.sp]
          const addr = st[--this.sp]
          this.writeK(addr, code[pc + 2] as Kind, v)
          if (code[pc + 3]) st[this.sp++] = v
          this.pc = pc + 4
          break
        }
        case Op.LEAL:
          st[this.sp++] = this.fp + code[pc + 2]
          this.pc = pc + 3
          break
        case Op.LDBF:
          st[this.sp - 1] = this.readBits(st[this.sp - 1], code[pc + 2], code[pc + 3], code[pc + 4] === 1)
          this.pc = pc + 5
          break
        case Op.STBF: {
          const v = st[--this.sp]
          const addr = st[--this.sp]
          const width = code[pc + 3]
          this.writeBits(addr, code[pc + 2], width, v)
          if (code[pc + 4]) st[this.sp++] = v & ((1 << width) - 1)
          this.pc = pc + 5
          break
        }
        case Op.BIN: {
          const b = st[--this.sp]
          st[this.sp - 1] = binop(code[pc + 2] as never, code[pc + 3] as Kind, st[this.sp - 1], b)
          this.pc = pc + 4
          break
        }
        case Op.NEG: {
          const k = code[pc + 2] as Kind
          st[this.sp - 1] = norm(k, -st[this.sp - 1])
          this.pc = pc + 3
          break
        }
        case Op.BNOT: {
          const k = code[pc + 2] as Kind
          st[this.sp - 1] = norm(k, ~st[this.sp - 1])
          this.pc = pc + 3
          break
        }
        case Op.LNOT:
          st[this.sp - 1] = st[this.sp - 1] === 0 ? 1 : 0
          this.pc = pc + 2
          break
        case Op.CONV:
          st[this.sp - 1] = convert(code[pc + 2] as Kind, code[pc + 3] as Kind, st[this.sp - 1])
          this.pc = pc + 4
          break
        case Op.JMP:
          this.pc = code[pc + 2]
          break
        case Op.JZ:
          this.pc = st[--this.sp] === 0 ? code[pc + 2] : pc + 3
          break
        case Op.JNZ:
          this.pc = st[--this.sp] !== 0 ? code[pc + 2] : pc + 3
          break
        case Op.CALL:
          this.call(code[pc + 2], code[pc + 3], pc + 4)
          break
        case Op.CALLI: {
          const nargs = code[pc + 2]
          const fi = st[this.sp - nargs - 1]
          this.call(fi, nargs, pc + 3, true)
          break
        }
        case Op.RET: {
          const has = code[pc + 2] === 1
          const v = has ? st[--this.sp] : 0
          const f = this.frames.pop()
          if (!f) {
            this.halt('main() a retourné : programme arrêté (H22)')
            return 'halted'
          }
          this.fp = f.fp
          this.dsp = f.dsp
          this.pc = f.retPc
          if (has) st[this.sp++] = v
          break
        }
        case Op.RETFIE: {
          const f = this.frames.pop()
          if (!f) {
            this.halt('RETFIE sans interruption en cours')
            return 'halted'
          }
          this.fp = f.fp
          this.dsp = f.dsp
          this.pc = f.retPc
          this.delayLeft = f.delay
          this.bus.writeBit(IRQ.gie.sfr, IRQ.gie.bit, 1)
          if (this.probeListeners.length) this.probe('ISR', 0)
          break
        }
        case Op.INCDEC: {
          const k = code[pc + 2] as Kind
          const addr = st[--this.sp]
          const old = this.readK(addr, k)
          const nv = norm(k, old + code[pc + 3])
          this.writeK(addr, k, nv)
          if (code[pc + 5]) st[this.sp++] = code[pc + 4] ? old : nv
          this.pc = pc + 6
          break
        }
        case Op.INCDECBF: {
          const off = code[pc + 2]
          const width = code[pc + 3]
          const signed = code[pc + 4] === 1
          const addr = st[--this.sp]
          const old = this.readBits(addr, off, width, signed)
          this.writeBits(addr, off, width, old + code[pc + 5])
          const nv = this.readBits(addr, off, width, signed)
          if (code[pc + 7]) st[this.sp++] = code[pc + 6] ? old : nv
          this.pc = pc + 8
          break
        }
        case Op.DELAY:
          this.delayLeft = code[pc + 2] * this.ticksPerTcy
          this.pc = pc + 3
          break
        case Op.NOP:
          this.pc = pc + 2
          break
        case Op.PRINTF: {
          const nargs = code[pc + 2]
          const args = Array.from(st.subarray(this.sp - nargs, this.sp))
          this.sp -= nargs
          const bytes = formatPrintf(this.readString(args[0]), args.slice(1), (a) => this.readString(a))
          const n = Math.min(bytes.length, INFO3.c.printfBufferSize)
          for (let i = 0; i < n; i++) this.mem[p.printfBuf + i] = bytes[i]
          st[this.sp++] = n
          this.pc = pc + 3
          break
        }
        case Op.MEMCPY: {
          const size = code[pc + 2]
          const src = st[--this.sp]
          const dst = st[this.sp - 1]
          for (let i = 0; i < size; i++) this.writeByte(dst + i, this.readByte(src + i))
          this.pc = pc + 3
          break
        }
        case Op.COMB: {
          const hi = st[--this.sp]
          const lo = st[this.sp - 1]
          st[this.sp - 1] = norm(code[pc + 3] as Kind, hi * (1 << code[pc + 2]) + lo)
          this.pc = pc + 4
          break
        }
        case Op.HALT:
          this.halt('programme terminé')
          return 'halted'
        default:
          this.halt(`instruction de bytecode inconnue (${code[pc]})`)
          return 'halted'
      }
      if (this.sp >= st.length) {
        this.halt("Débordement de la pile d'évaluation du simulateur")
        return 'halted'
      }
    }
  }

  private readString(addr: number): number[] {
    const out: number[] = []
    for (let a = addr; a < MEM.size; a++) {
      const b = this.readByte(a)
      if (b === 0) break
      out.push(b)
      if (out.length >= INFO3.c.printfBufferSize) break
    }
    return out
  }
}

