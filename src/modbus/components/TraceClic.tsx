/** Relevé TX+ / TX_EN figé, sur lequel l'étudiant clique pour désigner un instant (question « Repérer l'état haute impédance »). */
import type { PointerEvent } from 'react'
import { formatSI } from '../../lib/format'
import type { TraceCliquable } from '../lib/partieB'
import { valueAt } from '../models/scope'
import type { Waveform } from '../models/uart'

const W = 600
const H = 220
const DIV_X = 10
const PTS = 1200

export default function TraceClic({ trace, value, onPick }: { trace: TraceCliquable; value: string; onPick: (v: string) => void }) {
  const { from, to } = trace
  const x = (t: number) => ((t - from) / (to - from)) * W
  // TX+ dans la moitié haute (0 à 5 V), TX_EN dans la moitié basse
  const path = (w: Waveform, y0: number) =>
    Array.from({ length: PTS + 1 }, (_, i) => {
      const t = from + ((to - from) * i) / PTS
      return `${x(t).toFixed(1)},${(y0 - valueAt(w, t) * 16).toFixed(1)}`
    }).join(' ')
  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    onPick(String(from + ((e.clientX - r.left) / r.width) * (to - from)))
  }
  const t = Number(value)
  return (
    <figure className="rounded-md bg-black p-2 font-mono text-[11px] text-neutral-200">
      <figcaption className="flex flex-wrap gap-x-4 pb-1">
        <span className="text-[#f5d90a]">TX+</span>
        <span className="text-[#3ee07a]">TX_EN</span>
        <span>{formatSI((to - from) / DIV_X, 's', 3)}/div</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full cursor-crosshair touch-none" role="img" aria-label="Relevé TX+ et TX_EN : cliquez sur un instant" onPointerDown={pick}>
        <rect width={W} height={H} fill="#000" />
        {Array.from({ length: DIV_X + 1 }, (_, i) => (
          <line key={i} x1={(i * W) / DIV_X} x2={(i * W) / DIV_X} y1={0} y2={H} stroke="#3a3f44" strokeDasharray="1 4" />
        ))}
        <polyline points={path(trace.txp, 95)} fill="none" stroke="#f5d90a" strokeWidth={1.5} />
        <polyline points={path(trace.txen, 205)} fill="none" stroke="#3ee07a" strokeWidth={1.5} />
        {value !== '' && Number.isFinite(t) && <line x1={x(t)} x2={x(t)} y1={0} y2={H} stroke="#f87171" strokeWidth={2} />}
      </svg>
    </figure>
  )
}
