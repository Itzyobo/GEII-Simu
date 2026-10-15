/** Chronogramme d'exercice : écran gradué en divisions, base de temps et calibre affichés, sans légende des bits. */
import { formatSI } from '../../lib/format'
import type { Exercice } from '../models/exercise'

const PX = 36
const DIV_Y = 8

export default function Chronogramme({ ex }: { ex: Exercice }) {
  const { wave, tdiv, vdiv, offset } = ex
  const nx = Math.ceil(wave.period / tdiv)
  const W = nx * PX
  const H = DIV_Y * PX
  const y = (v: number) => H / 2 - ((v - offset) / vdiv) * PX
  const x = (t: number) => (t / tdiv) * PX
  const pts: string[] = []
  wave.samples.forEach((s, i) => {
    const prev = wave.samples[i - 1]
    if (prev) pts.push(`${x(s.t)},${y(prev.v)}`)
    pts.push(`${x(s.t)},${y(s.v)}`)
  })
  pts.push(`${x(wave.period)},${y(wave.samples.at(-1)?.v ?? 0)}`)

  return (
    <figure className="rounded-md bg-black p-2 font-mono text-[12px] text-neutral-200">
      <figcaption className="flex flex-wrap gap-x-4 px-1 pb-1">
        <span className="text-[#f5d90a]">1 : {formatSI(vdiv, 'V', 3)}/div</span>
        <span>{formatSI(tdiv, 's', 3)}/div</span>
        <span className="text-neutral-400">masse : ▸ à gauche</span>
      </figcaption>
      <div className="overflow-x-auto">
        <svg viewBox={`-12 0 ${W + 12} ${H}`} width={W + 12} height={H} className="block max-w-none" role="img" aria-label={`Chronogramme sur ${nx} divisions`}>
          <rect width={W} height={H} fill="#000" />
          {Array.from({ length: nx + 1 }, (_, i) => (
            <line key={`v${i}`} x1={i * PX} x2={i * PX} y1={0} y2={H} stroke="#3a3f44" strokeDasharray={i % nx ? '1 3' : undefined} />
          ))}
          {Array.from({ length: DIV_Y + 1 }, (_, j) => (
            <line key={`h${j}`} x1={0} x2={W} y1={j * PX} y2={j * PX} stroke="#3a3f44" strokeDasharray={j % DIV_Y ? '1 3' : undefined} />
          ))}
          {Array.from({ length: nx * 5 + 1 }, (_, k) => (
            <line key={`t${k}`} x1={(k * PX) / 5} x2={(k * PX) / 5} y1={H / 2 - 3} y2={H / 2 + 3} stroke="#5a6066" />
          ))}
          <path d={`M-12 ${y(0) - 6} L-3 ${y(0)} L-12 ${y(0) + 6} Z`} fill="#f5d90a" />
          <polyline points={pts.join(' ')} fill="none" stroke="#f5d90a" strokeWidth={1.8} strokeLinejoin="round" />
        </svg>
      </div>
    </figure>
  )
}
