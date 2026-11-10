/**
 * Logique du Worker, testable sans Worker : `handleMessage(state, msg)` renvoie les messages à envoyer.
 * Les images (frames) sont limitées à INFO3.vm.frameRateHz par seconde de temps réel
 * (donc par seconde simulée à ×1) et ne contiennent que les différences.
 */
import { INFO3 } from '../../data/reference'
import { compile } from '../compiler'
import type { Program } from '../compiler/bytecode'
import { formatDiagnostic } from '../compiler/diagnostics'
import { ALL_PINS, type Level } from '../models/gpio'
import { gradeTp1, TP1_CHALLENGES, type Tp1Challenge } from '../prof/tp1'
import { gradeTp23, TP23_CHALLENGES, type Tp23Challenge } from '../prof/tp23'
import { gradeTp4, TP4_CHALLENGES, type Tp4Challenge } from '../prof/tp4'
import { Vm, type RotarySlot } from '../vm/vm'
import type { InMsg, OutMsg, TraceChange, WatchRow } from './protocol'

const RGB = INFO3.pins.rgb
/** LED dont le Worker mesure le rapport cyclique par image : D2 à D5, puis les trois puces de la LED RGB (RGB_R…) */
const LEDS = [...INFO3.pins.leds.map((l) => ({ name: l.name, pin: l.pin })), ...(['r', 'g', 'b'] as const).map((k) => ({ name: INFO3.rgb.signals[k], pin: RGB[k] }))]
const FRAME_MS = INFO3.units.msPerS / INFO3.vm.frameRateHz
const HEX = 16
/** SFR affichés dans la fenêtre SFR */
const WATCHED_SFRS = ['PORTA', 'LATA', 'TRISA', 'ANSELA', 'PORTB', 'LATB', 'TRISB', 'ANSELB', 'PORTC', 'LATC', 'TRISC', 'ANSELC', 'PORTD', 'TRISD', 'ANSELD', 'PORTE', 'TRISE', 'ANSELE', 'INTCON', 'OSCCON1', 'OSCFRQ', 'PCON0', 'STATUS']

export interface SimState {
  vm: Vm | null
  running: boolean
  speed: number
  /** Temps réel accumulé depuis la dernière image — ms */
  frameAccumMs: number
  lastPins: Record<string, Level>
  lastDuty: Record<string, number>
  /** Mesure du rapport cyclique des LED sur l'image en cours (ticks) */
  frameStartT: number
  ledHigh: Record<string, number>
  ledLevel: Record<string, Level>
  ledLastT: Record<string, number>
  /** Messages produits par la VM entre deux appels */
  queue: OutMsg[]
  /** Horloge réelle (injectable pour les tests) — ms */
  now: () => number
  /** Retard de simulation à rattraper — ms simulées */
  debtMs: number
  /** Dernier Diagnostic envoyé (clé de comparaison) */
  lastDiag: string
  /** Dernier état de l'inspecteur d'interruptions envoyé */
  lastIrq: string
  /** Carte Rotary : mikroBUS choisi sur le banc */
  rotary: RotarySlot | null
  /** Analyseur logique : voies observées et changements en attente d'envoi */
  channels: Set<string>
  trace: TraceChange[]
  traceReset: boolean
  /** Anneau : sorties actuelles, temps allumé par LED sur l'image, dernier changement, dernière image envoyée */
  ring: { outputs: number; high: number[]; lastT: number; sent: string }
}

const RING_N = INFO3.ring.leds
const blankRing = () => ({ outputs: 0, high: new Array<number>(RING_N).fill(0), lastT: 0, sent: '' })

function ringAccumulate(state: SimState, t: number) {
  const r = state.ring
  const from = Math.max(r.lastT, state.frameStartT)
  if (t > from) for (let k = 0; k < RING_N; k++) if ((r.outputs >> k) & 1) r.high[k] += t - from
  r.lastT = t
}

export function createSimState(now: () => number = () => performance.now()): SimState {
  return { vm: null, running: false, speed: 1, frameAccumMs: 0, lastPins: {}, lastDuty: {}, frameStartT: 0, ledHigh: {}, ledLevel: {}, ledLastT: {}, queue: [], now, debtMs: 0, lastDiag: '', lastIrq: '', rotary: null, channels: new Set(), trace: [], traceReset: false, ring: blankRing() }
}

const PROBES = new Set<string>(INFO3.analyzer.probes)

function pushTrace(state: SimState, ch: string, t: number, level: Level) {
  if (!state.channels.has(ch)) return
  state.trace.push({ ch, t, level })
  // Retard d'affichage : seules les dernières modifications sont gardées
  const max = INFO3.analyzer.maxChanges * INFO3.analyzer.channels
  if (state.trace.length > max) state.trace.splice(0, state.trace.length - max)
}

/** Niveaux actuels des voies observées (point de départ des tracés) */
function traceLevels(state: SimState) {
  const vm = state.vm
  if (!vm) return
  for (const ch of state.channels) {
    if (PROBES.has(ch)) {
      const level: Level = ch === 'ISR' ? 0 : vm.bus.readBit(INFO3.timers.irq.flag, ch)
      pushTrace(state, ch, vm.timeS, level)
    } else pushTrace(state, ch, vm.timeS, vm.getPin(ch))
  }
}

function attach(state: SimState, vm: Vm) {
  vm.setRotarySlot(state.rotary)
  vm.onPinChange((c) => pushTrace(state, c.pin, vm.toS(c.t), c.level))
  vm.onProbe((p) => pushTrace(state, p.name, vm.toS(p.t), p.level))
  state.ring = blankRing()
  vm.onRing((t, outputs) => {
    ringAccumulate(state, t)
    state.ring.outputs = outputs
  })
  state.trace = []
  state.traceReset = true
  traceLevels(state)
  vm.onOutput((l) => state.queue.push({ type: 'output', level: l.level, text: l.text, file: l.file, line: l.line, col: l.col }))
  vm.onPinChange((c) => {
    if (!(c.pin in state.ledLevel)) return
    if (state.ledLevel[c.pin]) state.ledHigh[c.pin] += c.t - Math.max(state.ledLastT[c.pin], state.frameStartT)
    state.ledLevel[c.pin] = c.level
    state.ledLastT[c.pin] = c.t
  })
  resetMeasures(state, vm)
}

function resetMeasures(state: SimState, vm: Vm) {
  state.frameStartT = vm.t
  state.ring.lastT = vm.t
  state.ring.outputs = vm.ring.outputs
  state.ring.sent = ''
  state.lastPins = {}
  state.lastDuty = {}
  state.lastDiag = ''
  state.lastIrq = ''
  for (const l of LEDS) {
    state.ledHigh[l.pin] = 0
    state.ledLevel[l.pin] = vm.getPin(l.pin)
    state.ledLastT[l.pin] = vm.t
  }
}

/** Image : seulement les broches et rapports cycliques qui ont changé (+ Diagnostic s'il a changé) */
export function makeFrame(state: SimState, out: OutMsg[]): void {
  const vm = state.vm
  if (!vm) return
  const pinsDiff: Record<string, 0 | 1> = {}
  for (const pin of ALL_PINS) {
    const v = vm.getPin(pin)
    if (state.lastPins[pin] !== v) pinsDiff[pin] = v
    state.lastPins[pin] = v
  }
  const span = vm.t - state.frameStartT
  const ledDuty: Record<string, number> = {}
  for (const l of LEDS) {
    let high = state.ledHigh[l.pin]
    if (state.ledLevel[l.pin]) high += vm.t - Math.max(state.ledLastT[l.pin], state.frameStartT)
    const duty = span > 0 ? high / span : state.ledLevel[l.pin]
    if (state.lastDuty[l.name] !== duty) ledDuty[l.name] = duty
    state.lastDuty[l.name] = duty
    state.ledHigh[l.pin] = 0
    state.ledLastT[l.pin] = vm.t
  }
  ringAccumulate(state, vm.t)
  const ringDuty = state.ring.high.map((h, k) => (span > 0 ? h / span : (state.ring.outputs >> k) & 1))
  state.ring.high.fill(0)
  const ringKey = ringDuty.map((d) => d.toFixed(2)).join(',')
  const ringChanged = ringKey !== state.ring.sent
  state.ring.sent = ringKey
  state.frameStartT = vm.t
  out.push({ type: 'frame', tSim: vm.timeS, pinsDiff, ledDuty, ...(ringChanged ? { ringDuty } : {}) })
  if (state.trace.length || state.traceReset) {
    out.push({ type: 'trace', changes: state.trace, reset: state.traceReset })
    state.trace = []
    state.traceReset = false
  }
  const diag = { type: 'diag' as const, analogReads: [...vm.analogReads].sort(), inputWrites: [...vm.inputWrites].sort(), fosc: vm.fosc }
  const key = JSON.stringify(diag)
  if (key !== state.lastDiag) {
    state.lastDiag = key
    out.push(diag)
  }
  const irq = { type: 'irq' as const, ...vm.irqStatus() }
  const irqKey = JSON.stringify(irq)
  if (irqKey !== state.lastIrq) {
    state.lastIrq = irqKey
    out.push(irq)
  }
}

function drain(state: SimState, out: OutMsg[]): OutMsg[] {
  if (state.queue.length) {
    out.unshift(...state.queue)
    state.queue = []
  }
  return out
}

function stopped(vm: Vm, out: OutMsg[]) {
  out.push({ type: 'stopped', ...vm.sourcePos(vm.pc) })
}

function stopIfHalted(state: SimState, reason: string, out: OutMsg[]) {
  const vm = state.vm!
  if (reason === 'halted') {
    state.running = false
    out.push({ type: 'halted', reason: vm.halted ?? 'arrêt' })
  } else if (reason === 'breakpoint') {
    state.running = false
    const pos = vm.sourcePos(vm.pc)
    out.push({ type: 'output', level: 'info', text: `Point d'arrêt atteint : ${pos.file}:${pos.line}`, file: pos.file, line: pos.line })
    out.push({ type: 'halted', reason: 'breakpoint' })
    stopped(vm, out)
  } else if (reason === 'paused') {
    state.running = false
    out.push({ type: 'halted', reason: 'pause' })
    stopped(vm, out)
  }
}

/** Compilation avec messages Output au format MPLAB X */
function buildProgram(state: SimState, files: Record<string, string>, out: OutMsg[]): { program: Program | null; ms: number } {
  const t0 = state.now()
  const r = compile(files)
  const ms = Math.max(0, Math.round(state.now() - t0))
  for (const d of r.diagnostics) out.push({ type: 'output', level: d.severity, text: formatDiagnostic(d), file: d.file, line: d.line, col: d.col })
  if (!r.ok || !r.program) {
    out.push({ type: 'output', level: 'error', text: 'BUILD FAILED' })
    return { program: null, ms }
  }
  out.push({ type: 'output', level: 'info', text: `BUILD SUCCESSFUL (total time: ${ms} ms)` })
  return { program: r.program, ms }
}

const fmtValue = (v: unknown): string => {
  if (typeof v === 'number') return Number.isInteger(v) ? `${v} (0x${(v >>> 0).toString(HEX).toUpperCase()})` : String(v)
  if (Array.isArray(v)) return `{${v.join(', ')}}`
  if (v && typeof v === 'object') return `{${Object.entries(v).map(([k, x]) => `${k}: ${String(x)}`).join(', ')}}`
  return String(v)
}

function snapshot(vm: Vm): OutMsg {
  const p = vm.program!
  const fn = vm.functionAt()
  const locals: WatchRow[] = fn ? fn.locals.map((l) => ({ name: l.name, value: fmtValue(vm.peekVar(`${fn.name}:${l.name}`)) })) : []
  // Variables globales des fichiers de l'étudiant (pas celles de MCC ni du runtime)
  const globals: WatchRow[] = p.globals.filter((g) => !g.file.startsWith(INFO3.mcc.dir) && !g.file.startsWith('<')).map((g) => ({ name: g.name, value: fmtValue(vm.peekVar(g.name)) }))
  const sfrs: WatchRow[] = WATCHED_SFRS.map((name) => {
    const v = vm.readSfr(name)
    return { name, value: `0x${v.toString(HEX).toUpperCase().padStart(2, '0')}` }
  })
  return { type: 'snapshot', func: fn?.name ?? null, locals, globals, sfrs }
}

export function handleMessage(state: SimState, msg: InMsg): OutMsg[] {
  const out: OutMsg[] = []
  switch (msg.type) {
    case 'build': {
      const { program, ms } = buildProgram(state, msg.files, out)
      out.push({ type: 'built', ok: !!program, ms, loaded: false })
      return out
    }
    case 'load': {
      state.running = false
      const { program, ms } = buildProgram(state, msg.files, out)
      if (!program) {
        state.vm = null
        out.push({ type: 'built', ok: false, ms, loaded: false })
        return out
      }
      const vm = new Vm()
      vm.load(program)
      state.vm = vm
      attach(state, vm)
      out.push({ type: 'built', ok: true, ms, loaded: true })
      makeFrame(state, out)
      return drain(state, out)
    }
    case 'run':
      if (!state.vm) {
        out.push({ type: 'output', level: 'error', text: 'Aucun programme chargé' })
        return out
      }
      state.speed = msg.speed
      state.running = !state.vm.halted
      state.debtMs = 0
      return out
    case 'pause':
      if (state.running && state.vm) {
        state.running = false
        out.push({ type: 'halted', reason: 'pause' })
        stopped(state.vm, out)
      }
      return out
    case 'powerOff':
      state.running = false
      state.vm = null
      return out
    case 'reset': {
      const vm = state.vm
      if (!vm) return out
      state.running = false
      vm.reset()
      state.trace = []
      state.traceReset = true
      traceLevels(state)
      resetMeasures(state, vm)
      makeFrame(state, out)
      stopped(vm, out)
      return drain(state, out)
    }
    case 'step':
    case 'stepOver':
    case 'stepOut': {
      const vm = state.vm
      if (!vm) return out
      state.running = false
      const r = msg.type === 'step' ? vm.step() : msg.type === 'stepOver' ? vm.stepOver() : vm.stepOut()
      stopIfHalted(state, r === 'breakpoint' ? 'step' : r, out)
      if (r === 'step' || r === 'breakpoint' || r === 'ops') stopped(vm, out)
      makeFrame(state, out)
      return drain(state, out)
    }
    case 'inspect':
      if (state.vm?.program) out.push(snapshot(state.vm))
      return out
    case 'stimulus': {
      const vm = state.vm
      if (!vm || !(msg.button in vm.buttons)) return out
      if (msg.action === 'press') vm.press(msg.button, msg.bounce)
      else vm.release(msg.button, msg.bounce)
      return out
    }
    case 'bench':
      state.rotary = msg.rotary
      state.vm?.setRotarySlot(msg.rotary)
      return out
    case 'rotary': {
      const vm = state.vm
      if (!vm) return out
      if (msg.action === 'turn') vm.turn(msg.detents)
      else if (msg.action === 'spin') vm.spin(msg.rate)
      else vm.rotarySw(msg.pressed)
      return out
    }
    case 'analyzer': {
      const added = msg.channels.filter((c) => !state.channels.has(c))
      state.channels = new Set(msg.channels)
      if (added.length && state.vm) {
        const keep = state.channels
        state.channels = new Set(added)
        traceLevels(state)
        state.channels = keep
      }
      return out
    }
    case 'breakpoint': {
      const vm = state.vm
      if (!vm) return out
      if (msg.line === null) {
        vm.clearBreakpoint()
        return out
      }
      const r = vm.setBreakpoint(msg.file, msg.line)
      if (r.warning) out.push({ type: 'output', level: 'warning', text: r.warning, file: msg.file, line: r.line })
      else if (r.ok) out.push({ type: 'output', level: 'info', text: `Point d'arrêt : ${msg.file}:${r.line}`, file: msg.file, line: r.line })
      return out
    }
    case 'grade': {
      if ((TP4_CHALLENGES as readonly string[]).includes(msg.question)) {
        const v = gradeTp4(msg.question as Tp4Challenge, msg.files, state.rotary)
        out.push({ type: 'graded', question: msg.question, ok: v.ok, messages: v.messages })
        return out
      }
      if ((TP23_CHALLENGES as readonly string[]).includes(msg.question)) {
        const v = gradeTp23(msg.question as Tp23Challenge, msg.files, state.rotary)
        out.push({ type: 'graded', question: msg.question, ok: v.ok, messages: v.messages })
        return out
      }
      if (!(TP1_CHALLENGES as readonly string[]).includes(msg.question)) {
        out.push({ type: 'graded', question: msg.question, ok: false, messages: ['Question inconnue du professeur virtuel'] })
        return out
      }
      const v = gradeTp1(msg.question as Tp1Challenge, msg.files)
      out.push({ type: 'graded', question: msg.question, ok: v.ok, messages: v.messages })
      return out
    }
    case 'tick': {
      const vm = state.vm
      if (!vm || !state.running) return drain(state, out)
      const start = state.now()
      // Temps simulé à produire pendant ce tick (vitesse × temps réel), plus le retard éventuel
      const target = vm.t + vm.msToTicks(msg.wallMs * state.speed + state.debtMs)
      const sliceTicks = vm.msToTicks(INFO3.vm.sliceMs)
      while (state.running && vm.t < target) {
        // Tranche : au plus sliceMs simulées ou sliceOps opérations
        const r = vm.runSlice(Math.min(sliceTicks, target - vm.t))
        stopIfHalted(state, r, out)
        if (state.now() - start > INFO3.vm.tickBudgetMs) break
      }
      // Trace des broches : seules les plus récentes sont gardées (mémoire bornée en marche prolongée)
      const tr = vm.gpio.trace
      if (tr.length > INFO3.vm.maxPinTrace) tr.splice(0, tr.length - INFO3.vm.maxPinTrace / 2)
      // Retard plafonné à une tranche : si le calcul est trop lent, le temps simulé ralentit
      const lagMs = vm.toS(Math.max(0, target - vm.t)) * INFO3.units.msPerS
      state.debtMs = state.running ? Math.min(lagMs, INFO3.vm.sliceMs) : 0
      state.frameAccumMs += msg.wallMs
      if (state.frameAccumMs >= FRAME_MS || !state.running) {
        state.frameAccumMs = state.running ? Math.min(state.frameAccumMs - FRAME_MS, FRAME_MS) : 0
        makeFrame(state, out)
      }
      return drain(state, out)
    }
  }
}
