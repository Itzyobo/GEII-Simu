/**
 * Analyseur logique du banc : 4 voies prises sur les broches (ou les pseudo-voies ISR, TMRxIF),
 * base de temps de 1 µs à 1 s par division, 10 divisions, deux curseurs et leur écart.
 * Les changements viennent du Worker (message « trace »), datés en secondes simulées.
 */
import { useEffect, useState } from 'react'
import { INFO3 } from '../../data/reference'
import { ALL_PINS } from '../models/gpio'
import { fmtTime, tracePoints, TRACE_W as W } from './analyzer'
import type { SimControls } from './useSim'

const A = INFO3.analyzer
const LANE = 36
const CHANNEL_OPTIONS = [...ALL_PINS, ...A.probes]
const CURSOR_STEPS = 1000

export default function LogicAnalyzer({ sim, defaults }: { sim: SimControls; defaults: string[] }) {
  const [channels, setChannels] = useState<string[]>(() => Array.from({ length: A.channels }, (_, i) => defaults[i] ?? ALL_PINS[i]))
  const [tbIndex, setTbIndex] = useState<number>(A.timebases.indexOf(1e-3))
  const [held, setHeld] = useState<number | null>(null)
  const [cursors, setCursors] = useState<[number, number]>([CURSOR_STEPS * 0.2, CURSOR_STEPS * 0.6])
  const { setAnalyzer } = sim

  useEffect(() => {
    setAnalyzer('analyzer', channels)
  }, [channels, setAnalyzer])

  const tb = A.timebases[tbIndex]
  const span = tb * A.divisions
  const t1 = held ?? sim.view.tSim
  const t0 = t1 - span
  const ct = cursors.map((c) => t0 + (c / CURSOR_STEPS) * span)
  const dt = Math.abs(ct[1] - ct[0])
  const H = LANE * A.channels

  return (
    <details className="rounded-card bg-card p-3 ring-1 ring-line" open>
      <summary className="cursor-pointer text-sm font-semibold">Analyseur logique</summary>
      <div className="mt-2 space-y-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {channels.map((ch, i) => (
            <select
              key={i}
              aria-label={`Voie ${i + 1}`}
              className="rounded border border-line bg-card px-1 py-0.5 font-mono"
              value={ch}
              onChange={(e) => setChannels((cs) => cs.map((c, j) => (j === i ? e.target.value : c)))}
            >
              {CHANNEL_OPTIONS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1">
            Base de temps
            <select aria-label="Base de temps" className="rounded border border-line bg-card px-1 py-0.5" value={tbIndex} onChange={(e) => setTbIndex(Number(e.target.value))}>
              {A.timebases.map((t, i) => (
                <option key={t} value={i}>
                  {fmtTime(t)}/div
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="rounded-md px-2 py-0.5 ring-1 ring-line hover:bg-card-2" onClick={() => setHeld(held === null ? sim.view.tSim : null)} aria-pressed={held !== null}>
            {held === null ? 'Figer' : 'Reprendre'}
          </button>
          <span className="text-muted tabular-nums">t = {fmtTime(t1)}</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-40 w-full rounded bg-[#0b100d]" role="img" aria-label={`Chronogramme : ${channels.join(', ')}`}>
          {Array.from({ length: A.divisions + 1 }, (_, i) => (
            <line key={i} x1={(i * W) / A.divisions} x2={(i * W) / A.divisions} y1={0} y2={H} stroke="#24302a" strokeWidth={1} />
          ))}
          {channels.map((ch, i) => (
            <g key={i} transform={`translate(0 ${i * LANE})`}>
              <text x={4} y={LANE / 2 + 4} fill="#7c8a82" fontSize={11}>
                {ch}
              </text>
              <polyline points={tracePoints(sim.trace.get(ch), t0, t1)} fill="none" stroke={['#4ade80', '#facc15', '#60a5fa', '#f472b6'][i % 4]} strokeWidth={2} vectorEffect="non-scaling-stroke" />
            </g>
          ))}
          {cursors.map((c, i) => (
            <line key={i} x1={(c / CURSOR_STEPS) * W} x2={(c / CURSOR_STEPS) * W} y1={0} y2={H} stroke={i ? '#f97316' : '#e5e7eb'} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        <div className="grid gap-1 sm:grid-cols-2">
          {cursors.map((c, i) => (
            <label key={i} className="flex min-w-0 items-center gap-2">
              <span className="shrink-0">Curseur {i ? 'B' : 'A'}</span>
              <input type="range" min={0} max={CURSOR_STEPS} value={c} className="min-w-0 flex-1" onChange={(e) => setCursors((cs) => (i ? [cs[0], Number(e.target.value)] : [Number(e.target.value), cs[1]]))} />
            </label>
          ))}
        </div>
        <p className="tabular-nums">
          Δt = <span className="font-mono font-semibold">{fmtTime(dt)}</span>
          {dt > 0 && <span className="text-muted"> ({Number((1 / dt).toPrecision(4)).toLocaleString('fr-FR')} Hz)</span>}
        </p>
      </div>
    </details>
  )
}
