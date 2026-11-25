/**
 * Lab des pages : relie le mode démonstration aux composants montés (oscilloscope, banc, copie du partiel).
 * Chaque méthode appelle le setter que l'interface utilise pour le même geste.
 */
import type { BenchGen, CaptureInfo, Lab, LabSnapshot, Zone } from '../../../lib/demo/lab'
import type { PartielAnswers } from '../../../lib/reseaux/partiel'
import type { ScopeHandle } from '../../../components/scope/useScope'
import type { BenchHandle } from '../CoaxBench'

export interface LiveDeps {
  scope: () => (ScopeHandle & { setView(v: 'face' | 'compact'): void }) | null
  bench: () => BenchHandle | null
  answers: () => PartielAnswers
  setAnswer: Lab['setAnswer']
  setAllAnswers: (a: PartielAnswers) => void
  setTab: (i: 0 | 1 | 2) => void
  tab: () => 0 | 1 | 2
  zones: () => Zone[]
  setZones: (z: Zone[]) => void
  /** Amène l'écran de l'oscilloscope à la vue : sa boucle d'acquisition ne tourne que s'il est visible */
  reveal?: () => Promise<void>
}

const DEFAULT_GEN: BenchGen = { on: true, mode: 'pulse', eg: 1, width: 1e-6, period: 10e-3, f: 1e6 }
const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms))
/** Attente maximale d'un déclenchement en temps réel — ms (le ping n'arrive qu'une fois par seconde) */
const SINGLE_TIMEOUT_MS = 8000
const POLL_MS = 40

export function createLiveLab(d: LiveDeps): Lab {
  const scope = () => {
    const s = d.scope()
    if (!s) throw new Error('oscilloscope non monté')
    return s
  }
  /** Attend une acquisition arrêtée plus récente que `after` */
  const awaitCapture = async (after: number): Promise<CaptureInfo | null> => {
    for (let waited = 0; waited < SINGLE_TIMEOUT_MS; waited += POLL_MS) {
      const s = scope()
      const c = s.mode() === 'stop' ? s.capture() : null
      if (c && c.tTrig > after) return c
      await sleep(POLL_MS)
    }
    return null
  }
  const lastT = () => scope().capture()?.tTrig ?? -Infinity
  return {
    scope: () => scope().settings(),
    setSettings: (s) => scope().setSettings(s),
    set: (p) => scope().set(p),
    setCh: (c, p) => scope().setCh(c, p),
    setTrig: (p) => scope().setTrig(p),
    setCur: (p) => scope().setCur(p),
    setMode: (m) => scope().setMode(m),
    async single() {
      await d.reveal?.()
      const before = lastT()
      scope().setMode('single')
      return awaitCapture(before)
    },
    async runThenStop(seconds) {
      await d.reveal?.()
      const before = lastT()
      scope().setMode('run')
      await sleep(seconds * 1000)
      scope().setMode('stop')
      return awaitCapture(before)
    },
    cursorReadout: () => scope().cursorReadout(),
    conn: () => d.bench()?.conn() ?? {},
    plug: (m, f) => d.bench()?.plug(m, f),
    unplug: (m) => d.bench()?.unplug(m),
    range: () => d.bench()?.range(),
    gen: () => d.bench()?.gen() ?? DEFAULT_GEN,
    setGen: (p) => d.bench()?.setGen(p),
    potR: () => d.bench()?.potR() ?? 0,
    setPotR: (r) => d.bench()?.setPotR(r),
    ohmmeter: () => d.bench()?.ohmmeter() ?? null,
    answers: d.answers,
    setAnswer: d.setAnswer,
    setTab: d.setTab,
    setZones: d.setZones,
    zones: d.zones,
    snapshot: (): LabSnapshot => ({
      scope: scope().settings(),
      conn: d.bench()?.conn() ?? {},
      gen: d.bench()?.gen() ?? DEFAULT_GEN,
      potR: d.bench()?.potR() ?? 0,
      answers: d.answers(),
      tab: d.tab(),
      zones: d.zones(),
    }),
    restore: (s) => {
      d.setTab(s.tab)
      const sc = d.scope()
      sc?.setSettings(s.scope)
      sc?.setMode('stop')
      const b = d.bench()
      b?.setConn(s.conn)
      b?.setGen(s.gen)
      b?.setPotR(s.potR)
      d.setAllAnswers(s.answers)
      d.setZones(s.zones)
    },
  }
}
