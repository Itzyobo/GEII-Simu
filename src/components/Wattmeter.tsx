import Display7Seg from './Display7Seg'
import { toDisplay } from '../lib/format'

interface WattmeterProps {
  label?: string
  /** Puissances active (W), réactive (var), apparente (VA) ; null = éteint */
  p: number | null
  q: number | null
  s: number | null
  decimals?: number
}

/** Wattmètre : trois afficheurs P, Q, S. */
export default function Wattmeter({ label = 'WATTMÈTRE', p, q, s, decimals = 0 }: WattmeterProps) {
  const rows: [string, number | null, string][] = [
    ['P', p, 'W'],
    ['Q', q, 'var'],
    ['S', s, 'VA'],
  ]
  return (
    <div className="rounded-card bg-card p-3 ring-1 ring-line">
      <div className="mb-2 text-xs font-semibold tracking-wide text-muted">{label}</div>
      <div className="grid gap-1 rounded-lg bg-[#0b120d] px-3 py-2 ring-1 ring-black">
        {rows.map(([name, v, unit]) => (
          <div key={name} className="flex items-end gap-2">
            <span className="w-4 pb-0.5 font-mono text-sm text-seg/70">{name}</span>
            <Display7Seg value={toDisplay(v, decimals, 5)} digits={5} height={28} />
            <span className="pb-0.5 font-mono text-sm text-seg">{unit}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
