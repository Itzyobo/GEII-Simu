import type { Barrettes } from '../models/asyncMotor'

interface TerminalBoxProps {
  value: Barrettes
  onChange: (b: Barrettes) => void
  /** Verrouillée sous tension */
  disabled?: boolean
}

const ORDER: Barrettes[] = ['triangle', 'etoile', 'aucune']
const LABEL: Record<Barrettes, string> = { triangle: 'Triangle', etoile: 'Étoile', aucune: 'Retirées' }
// Bornes : U1 V1 W1 en haut, W2 U2 V2 en bas (disposition normalisée)
const X = [40, 100, 160]
const TOP = 40
const BOTTOM = 110

/** Boîte à bornes : clic pour faire tourner les barrettes (triangle → étoile → retirées), ou boutons. */
export default function TerminalBox({ value, onChange, disabled }: TerminalBoxProps) {
  const next = () => onChange(ORDER[(ORDER.indexOf(value) + 1) % ORDER.length])
  const bar = (x1: number, y1: number, x2: number, y2: number, key: string) => (
    <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#c9a227" strokeWidth="9" strokeLinecap="round" opacity="0.9" />
  )
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={next}
        disabled={disabled}
        aria-label={`Boîte à bornes, barrettes : ${LABEL[value]}. Cliquer pour changer.`}
        className="block w-full rounded-lg disabled:cursor-not-allowed"
      >
        <svg viewBox="0 0 200 150" className="w-full max-w-[260px]">
          <rect x="5" y="5" width="190" height="140" rx="10" fill="#1a1c1f" stroke="var(--color-line)" />
          {value === 'triangle' && X.map((x, k) => bar(x, TOP, x, BOTTOM, `t${k}`))}
          {value === 'etoile' && [bar(X[0], BOTTOM, X[1], BOTTOM, 's1'), bar(X[1], BOTTOM, X[2], BOTTOM, 's2')]}
          {['U1', 'V1', 'W1'].map((n, k) => (
            <g key={n}>
              <circle cx={X[k]} cy={TOP} r="11" fill="#8a9099" stroke="#2b2f35" strokeWidth="3" />
              <text x={X[k]} y={TOP - 18} textAnchor="middle" fontSize="11" fill="var(--color-ink)">
                {n}
              </text>
            </g>
          ))}
          {['W2', 'U2', 'V2'].map((n, k) => (
            <g key={n}>
              <circle cx={X[k]} cy={BOTTOM} r="11" fill="#8a9099" stroke="#2b2f35" strokeWidth="3" />
              <text x={X[k]} y={BOTTOM + 28} textAnchor="middle" fontSize="11" fill="var(--color-ink)">
                {n}
              </text>
            </g>
          ))}
        </svg>
      </button>
      <div className="flex gap-1">
        {ORDER.map((b) => (
          <button
            key={b}
            type="button"
            disabled={disabled}
            onClick={() => onChange(b)}
            aria-pressed={value === b}
            className={`min-h-11 rounded-md px-3 py-1 text-xs ring-1 ring-line disabled:opacity-40 ${value === b ? 'bg-accent font-semibold text-[#1a1306]' : ''}`}
          >
            {LABEL[b]}
          </button>
        ))}
      </div>
    </div>
  )
}
