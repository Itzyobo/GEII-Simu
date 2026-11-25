/**
 * Labo sans React pour les tests du mode démonstration : mêmes setters purs que l'interface, même automate
 * d'acquisition (stepRun) et même numérisation (recordChannel) que l'oscilloscope affiché.
 */
import { gaussien, mulberry32 } from '../../au3/sim/prng'
import { benchSources, ohmmeterReading, plugInto, topology, unplugDeep, type Connections } from '../reseaux/benchTopology'
import type { Waveform } from '../reseaux/coax'
import { emptyAnswers, type PartielAnswers, type PartielSubject } from '../reseaux/partiel'
import { salleTraffic } from '../reseaux/traffic'
import { channelFn, defaultSetup, recordChannel } from '../scope/engine'
import { initRun, stepRun, type RunState } from '../scope/runtime'
import { patchChannel, patchCursors, patchSettings, patchTrig } from '../scope/settings'
import type { ScopeSettings, SignalSource } from '../scope/types'
import type { BenchGen, CaptureInfo, Lab, LabSnapshot, Zone } from './lab'

export type Part = 'cable' | 'serie' | 'ping'

/** Pas de l'horloge simulée entre deux tentatives de déclenchement — s */
const TICK = 0.02
/** Attente maximale d'un déclenchement — s */
const SINGLE_TIMEOUT = 4

export const genWave = (g: BenchGen): Waveform => (g.mode === 'pulse' ? { kind: 'pulse', width: Math.min(g.width, g.period / 2), period: g.period } : { kind: 'sine', f: g.f })

export function createHeadlessLab(subject: PartielSubject, part: Part, t0 = 10.3): Lab & { clock(): number } {
  let st: ScopeSettings = defaultSetup()
  let run: RunState = initRun(t0)
  let t = t0
  let conn: Connections = {}
  let gen: BenchGen = { on: true, mode: 'pulse', eg: 1, width: 1e-6, period: 10e-3, f: 1e6 }
  let potR = 120
  let answers: PartielAnswers = emptyAnswers()
  let tab: 0 | 1 | 2 = 0
  let zones: Zone[] = []
  const ping = subject.ping
  const traffic = part === 'ping' ? salleTraffic(subject.seed, { kind: 'ping', L: ping.L, from: ping.from, to: ping.to }, true) : null

  const sources = (): readonly (SignalSource | null)[] => {
    if (part === 'serie') return [subject.serie.source, null]
    if (part === 'ping') return [traffic!.source, null]
    return benchSources(topology(conn), { on: gen.on, eg: gen.eg, wave: genWave(gen) }, subject.coax.cable, potR)
  }

  /** Numérise l'acquisition arrêtée, comme la boucle de dessin de l'oscilloscope */
  const freeze = (): CaptureInfo => {
    const cap = run.capture!
    const gauss = gaussien(mulberry32(Math.floor(cap.tTrig * 1e6)))
    const records = [0, 1].map((c) => {
      const src = cap.sources[c]
      const ch = st.ch[c as 0 | 1]
      return src && ch.on ? recordChannel(channelFn(src, ch, cap.rec), src, cap.tTrig, cap.fs, cap.rec, ch, st.acq.mode === 'peak', gauss) : null
    })
    return { tTrig: cap.tTrig, fs: cap.fs, rec: cap.rec, records, settings: st }
  }

  const lab: Lab & { clock(): number } = {
    clock: () => t,
    scope: () => st,
    setSettings: (s) => (st = s),
    set: (p) => (st = patchSettings(st, p)),
    setCh: (c, p) => (st = patchChannel(st, c, p)),
    setTrig: (p) => (st = patchTrig(st, p)),
    setCur: (p) => (st = patchCursors(st, p)),
    setMode: (m) => (run = { ...run, mode: m, armedAt: t, lastTrig: t }),
    async single() {
      const srcs = sources()
      run = { ...run, mode: 'single', armedAt: t, lastTrig: t }
      for (const end = t + SINGLE_TIMEOUT; t < end; ) {
        t += TICK
        run = stepRun(run, st, srcs, t)
        if (run.mode === 'stop' && run.capture) return freeze()
      }
      run = { ...run, mode: 'stop', status: 'Stop' }
      return null
    },
    async runThenStop(seconds) {
      const srcs = sources()
      run = { ...run, mode: 'run', armedAt: t, lastTrig: t }
      for (const end = t + seconds; t < end; ) {
        t += TICK
        run = stepRun(run, st, srcs, t)
      }
      run = { ...run, mode: 'stop', status: 'Stop' }
      return run.capture ? freeze() : null
    },
    cursorReadout: () => ({ dx: st.cursors.x2 - st.cursors.x1, dy: st.cursors.y2 - st.cursors.y1 }),
    conn: () => conn,
    plug: (m, f) => (conn = plugInto(conn, m, f)),
    unplug: (m) => (conn = unplugDeep(conn, m)),
    range: () => (conn = {}),
    gen: () => gen,
    setGen: (p) => (gen = { ...gen, ...p }),
    potR: () => potR,
    setPotR: (r) => (potR = r),
    ohmmeter: () => ohmmeterReading(subject.seed, potR, topology(conn).potConnected),
    answers: () => answers,
    setAnswer: (k, p) => (answers = { ...answers, [k]: { ...answers[k], ...p } }),
    setTab: (i) => (tab = i),
    setZones: (z) => (zones = z),
    zones: () => zones,
    snapshot: (): LabSnapshot => ({ scope: st, conn, gen, potR, answers, tab, zones }),
    restore: (s) => {
      st = s.scope
      conn = s.conn
      gen = s.gen
      potR = s.potR
      answers = s.answers
      tab = s.tab
      zones = s.zones
      run = { ...run, mode: 'stop', status: 'Stop' }
    },
  }
  return lab
}
