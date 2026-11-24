/**
 * Automate d'acquisition (pur) : Run / Stop / Single, déclenchement Auto ou Normal, holdoff et temps mort.
 * Le temps est celui du banc (s) ; l'appelant fait avancer tNow à chaque image.
 */
import { OSCILLO } from '../../data/reference'
import { findTrigger, refDiv, sampleRate, screenWindow } from './engine'
import type { Horizontal, ScopeSettings, SignalSource } from './types'

export type RunMode = 'run' | 'stop' | 'single'
export type Status = 'Stop' | "Trig'd" | 'Auto' | 'Armé'

export interface Capture {
  /** Instant du déclenchement (ou de l'acquisition forcée en Auto) — s */
  tTrig: number
  triggered: boolean
  /** Sources figées au moment de l'acquisition : l'écran arrêté ne suit plus le banc */
  sources: readonly (SignalSource | null)[]
  /** Sa/s de l'acquisition */
  fs: number
  /** Étendue de l'enregistrement — s */
  rec: [number, number]
  /** Réglage horizontal à l'acquisition */
  hz: Horizontal
}

export interface RunState {
  mode: RunMode
  status: Status
  /** Le déclenchement est réarmé à partir de cet instant — s */
  armedAt: number
  /** Dernier déclenchement réel (pour le délai du mode Auto) — s */
  lastTrig: number
  capture: Capture | null
}

/** On ne remonte pas plus loin que ça dans le passé (onglet resté en arrière-plan) — s */
const SEARCH_MAX = 0.2
/** Déclenchements enchaînés au plus par image ; au-delà on saute vers le présent */
const CHAIN_MAX = 256

export const initRun = (tNow: number): RunState => ({ mode: 'run', status: 'Armé', armedAt: tNow, lastTrig: tNow, capture: null })

/** Avance l'automate jusqu'à tNow : dernière acquisition complète, statut affiché. */
export function stepRun(st: RunState, s: ScopeSettings, sources: readonly (SignalSource | null)[], tNow: number): RunState {
  if (st.mode === 'stop') return st.status === 'Stop' ? st : { ...st, status: 'Stop' }
  const span = OSCILLO.divX * s.sdiv
  const pre = refDiv(s) * s.sdiv - s.delay
  const post = span - pre
  const tEnd = tNow - Math.max(0, post) // l'acquisition doit être terminée
  const hz: Horizontal = { sdiv: s.sdiv, delay: s.delay, ref: s.ref }
  const capture = (tTrig: number, triggered: boolean): Capture => ({ tTrig, triggered, sources, fs: sampleRate(s.sdiv), rec: screenWindow(hz, tTrig), hz })
  const src = sources[s.trig.source]
  const ch = s.ch[s.trig.source]
  const level = s.trig.level / ch.probe
  const rearm = Math.max(s.trig.holdoff, span + OSCILLO.tempsMort)
  let from = Math.max(st.armedAt, tNow - SEARCH_MAX)
  let last: number | null = null
  for (let i = 0; src && from < tEnd; i++) {
    if (i === CHAIN_MAX) from = Math.max(from, tEnd - rearm)
    const t = findTrigger(src, level, s.trig.slope, from, tEnd, Math.max(span, 1e-6))
    if (t === null) break
    last = t
    from = t + rearm
  }
  if (last !== null) return { mode: st.mode === 'single' ? 'stop' : 'run', status: st.mode === 'single' ? 'Stop' : "Trig'd", armedAt: from, lastTrig: tNow, capture: capture(last, true) }
  const armedAt = Math.max(st.armedAt, tEnd)
  if (st.mode === 'run' && s.trig.mode === 'auto' && tNow - st.lastTrig > OSCILLO.autoTimeout) return { ...st, status: 'Auto', armedAt, capture: capture(tEnd, false) }
  return { ...st, status: 'Armé', armedAt }
}
