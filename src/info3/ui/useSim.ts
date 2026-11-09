/**
 * Session de simulation côté fil principal. Le Worker n'est créé qu'au premier Build ou à la première
 * programmation (jamais au chargement de la page) : la page reste « réseau inactif » tant qu'on n'agit pas.
 */
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { createSimClient, type SimClient } from '../worker/client'
import { INFO3 } from '../../data/reference'
import type { InMsg, OutMsg, Speed, TraceChange } from '../worker/protocol'

export type Output = Extract<OutMsg, { type: 'output' }>
export type Snapshot = Extract<OutMsg, { type: 'snapshot' }>
export type Diag = Extract<OutMsg, { type: 'diag' }>
export type IrqView = Extract<OutMsg, { type: 'irq' }>
export type RunMode = 'off' | 'running' | 'debug-running' | 'debug-stopped' | 'halted'

export interface SimView {
  output: Output[]
  duty: Record<string, number>
  pins: Record<string, 0 | 1>
  tSim: number
  mode: RunMode
  /** Ligne courante quand le débogueur est arrêté */
  stoppedAt: { file?: string; line?: number } | null
  snapshot: Snapshot | null
  diag: Diag | null
  /** Inspecteur d'interruptions */
  irq: IrqView | null
  /** Le programme chargé dans le PIC correspond au dernier Build réussi */
  programmed: boolean
  /** Anneau de 16 LED de la carte Rotary : fraction du temps allumée (LED 1 à 16) */
  ring: number[]
}

const initial: SimView = { output: [], duty: {}, pins: {}, tSim: 0, mode: 'off', stoppedAt: null, snapshot: null, diag: null, irq: null, programmed: false, ring: [] }

type Action = { kind: 'msg'; m: OutMsg } | { kind: 'clear' } | { kind: 'mode'; mode: RunMode } | { kind: 'log'; line: Output } | { kind: 'off' }

function reducer(s: SimView, a: Action): SimView {
  switch (a.kind) {
    case 'clear':
      return { ...s, output: [] }
    case 'log':
      return { ...s, output: [...s.output, a.line] }
    case 'mode':
      return { ...s, mode: a.mode, stoppedAt: a.mode === 'debug-stopped' ? s.stoppedAt : null }
    case 'off':
      return { ...initial, output: s.output }
    case 'msg': {
      const m = a.m
      switch (m.type) {
        case 'frame':
          return {
            ...s,
            tSim: m.tSim,
            duty: Object.keys(m.ledDuty).length ? { ...s.duty, ...m.ledDuty } : s.duty,
            pins: Object.keys(m.pinsDiff).length ? { ...s.pins, ...m.pinsDiff } : s.pins,
            ring: m.ringDuty ?? s.ring,
          }
        case 'output':
          return { ...s, output: [...s.output, m] }
        case 'halted':
          return { ...s, mode: m.reason === 'breakpoint' || m.reason === 'pause' || m.reason === 'step' ? 'debug-stopped' : 'halted' }
        case 'stopped':
          return { ...s, stoppedAt: { file: m.file, line: m.line }, mode: s.mode === 'off' ? s.mode : 'debug-stopped' }
        case 'snapshot':
          return { ...s, snapshot: m }
        case 'diag':
          return { ...s, diag: m }
        case 'irq':
          return { ...s, irq: m }
        case 'built':
          return { ...s, programmed: m.loaded ? m.ok : s.programmed }
        default:
          return s
      }
    }
  }
}

export interface SimControls {
  view: SimView
  /** Build (F11) */
  build(files: Record<string, string>): Promise<boolean>
  /** Make and Program Device : charge et lance à ×1 (sans point d'arrêt) */
  program(files: Record<string, string>): Promise<boolean>
  /** Debug Main Project : charge, pose le point d'arrêt et lance */
  debug(files: Record<string, string>, breakpoint: { file: string; line: number } | null): Promise<boolean>
  send(msg: Exclude<InMsg, { type: 'tick' }>): void
  run(speed: Speed): void
  pause(): void
  step(kind: 'step' | 'stepOver' | 'stepOut'): void
  powerOff(): void
  grade(question: string, files: Record<string, string>): Promise<{ ok: boolean; messages: string[] }>
  log(line: Output): void
  clearOutput(): void
  /** Banc : mikroBUS de la carte Rotary (envoyé au Worker dès qu'il existe) */
  setBench(rotary: 'mikrobus1' | 'mikrobus2' | null): void
  /** Codeur : crans, rotation continue, bouton SW */
  rotary(msg: { action: 'turn'; detents: number } | { action: 'spin'; rate: number } | { action: 'sw'; pressed: boolean }): void
  /** Analyseur logique : voies observées, changements reçus (tSim en s) */
  setAnalyzer(owner: string, channels: string[]): void
  trace: TraceStore
}

/** Changements reçus par voie (plafonnés à INFO3.analyzer.maxChanges) */
export class TraceStore {
  private readonly data = new Map<string, TraceChange[]>()
  version = 0
  add(changes: TraceChange[], reset: boolean) {
    if (reset) this.data.clear()
    for (const c of changes) {
      let a = this.data.get(c.ch)
      if (!a) this.data.set(c.ch, (a = []))
      a.push(c)
      if (a.length > INFO3.analyzer.maxChanges) a.splice(0, a.length - INFO3.analyzer.maxChanges)
    }
    this.version++
  }
  get(ch: string): readonly TraceChange[] {
    return this.data.get(ch) ?? []
  }
  clear() {
    this.data.clear()
    this.version++
  }
}

/** Union des voies demandées par les instruments */
const unionOf = (r: Record<string, string[]>) => [...new Set(Object.values(r).flat())]

export function useSim(): SimControls {
  const [view, dispatch] = useReducer(reducer, initial)
  const client = useRef<SimClient | null>(null)
  const waiters = useRef<{ built: ((m: Extract<OutMsg, { type: 'built' }>) => void)[]; graded: Map<string, (m: Extract<OutMsg, { type: 'graded' }>) => void> }>({ built: [], graded: new Map() })
  const debugging = useRef(false)
  const bench = useRef<'mikrobus1' | 'mikrobus2' | null>(null)
  /** Voies demandées par instrument (analyseur, oscilloscope) : le Worker reçoit leur union */
  const channels = useRef<Record<string, string[]>>({})
  const [traceStore] = useState(() => new TraceStore())

  const ensure = useCallback((): SimClient => {
    if (client.current) return client.current
    const c = createSimClient()
    // Le Worker naît au premier Build ou Program : il reçoit l'état du banc et de l'analyseur
    c.send({ type: 'bench', rotary: bench.current })
    c.send({ type: 'analyzer', channels: unionOf(channels.current) })
    c.onMessage((m) => {
      if (m.type === 'trace') traceStore.add(m.changes, m.reset)
      dispatch({ kind: 'msg', m })
      if (m.type === 'built') waiters.current.built.shift()?.(m)
      if (m.type === 'graded') {
        waiters.current.graded.get(m.question)?.(m)
        waiters.current.graded.delete(m.question)
      }
      if ((m.type === 'halted' || m.type === 'stopped') && debugging.current) c.send({ type: 'inspect' })
    })
    client.current = c
    return c
  }, [traceStore])

  useEffect(
    () => () => {
      client.current?.terminate()
      client.current = null
    },
    [],
  )

  const send = useCallback((msg: Exclude<InMsg, { type: 'tick' }>) => ensure().send(msg), [ensure])

  const waitBuilt = () => new Promise<Extract<OutMsg, { type: 'built' }>>((resolve) => waiters.current.built.push(resolve))

  const build = useCallback(
    async (files: Record<string, string>) => {
      dispatch({ kind: 'clear' })
      const done = waitBuilt()
      send({ type: 'build', files })
      return (await done).ok
    },
    [send],
  )

  const program = useCallback(
    async (files: Record<string, string>) => {
      dispatch({ kind: 'clear' })
      debugging.current = false
      const done = waitBuilt()
      send({ type: 'load', files })
      const r = await done
      if (!r.ok) return false
      dispatch({ kind: 'log', line: { type: 'output', level: 'info', text: 'Programming/Verify complete' } })
      send({ type: 'breakpoint', file: '', line: null })
      send({ type: 'run', speed: 1 })
      dispatch({ kind: 'mode', mode: 'running' })
      return true
    },
    [send],
  )

  const debug = useCallback(
    async (files: Record<string, string>, bp: { file: string; line: number } | null) => {
      dispatch({ kind: 'clear' })
      debugging.current = true
      const done = waitBuilt()
      send({ type: 'load', files })
      const r = await done
      if (!r.ok) return false
      dispatch({ kind: 'log', line: { type: 'output', level: 'info', text: 'Programming/Verify complete — Debug' } })
      if (bp) send({ type: 'breakpoint', file: bp.file, line: bp.line })
      send({ type: 'run', speed: 1 })
      dispatch({ kind: 'mode', mode: 'debug-running' })
      return true
    },
    [send],
  )

  const setBench = useCallback((r: 'mikrobus1' | 'mikrobus2' | null) => {
    bench.current = r
    client.current?.send({ type: 'bench', rotary: r })
  }, [])
  const rotary = useCallback((msg: Parameters<SimControls['rotary']>[0]) => client.current?.send({ type: 'rotary', ...msg }), [])
  const setAnalyzer = useCallback((owner: string, chs: string[]) => {
    channels.current = { ...channels.current, [owner]: chs }
    client.current?.send({ type: 'analyzer', channels: unionOf(channels.current) })
  }, [])

  return {
    view,
    build,
    program,
    debug,
    send,
    run: (speed) => {
      send({ type: 'run', speed })
      dispatch({ kind: 'mode', mode: debugging.current ? 'debug-running' : 'running' })
    },
    pause: () => send({ type: 'pause' }),
    step: (kind) => send({ type: kind }),
    powerOff: () => {
      if (client.current) client.current.send({ type: 'powerOff' })
      debugging.current = false
      dispatch({ kind: 'off' })
    },
    grade: (question, files) =>
      new Promise((resolve) => {
        waiters.current.graded.set(question, (m) => resolve({ ok: m.ok, messages: m.messages }))
        send({ type: 'grade', question, files })
      }),
    log: (line) => dispatch({ kind: 'log', line }),
    clearOutput: () => dispatch({ kind: 'clear' }),
    setBench,
    rotary,
    setAnalyzer,
    trace: traceStore,
  }
}
