import Display7Seg from './Display7Seg'
import { toDisplay } from '../lib/format'

interface MultimeterProps {
  label: string
  /** null = appareil éteint / hors tension */
  value: number | null
  unit: string
  decimals?: number
  digits?: number
}

/** Multimètre : boîtier + afficheur 7 segments. */
export default function Multimeter({ label, value, unit, decimals = 2, digits = 4 }: MultimeterProps) {
  return (
    <div className="rounded-card bg-card p-3 ring-1 ring-line">
      <div className="mb-2 text-xs font-semibold tracking-wide text-muted">{label}</div>
      <div className="flex items-end gap-2 rounded-lg bg-[#0b120d] px-3 py-2 ring-1 ring-black">
        <Display7Seg value={toDisplay(value, decimals, digits)} digits={digits} />
        <span className="pb-0.5 font-mono text-sm text-seg">{unit}</span>
      </div>
    </div>
  )
}
