interface TachometerProps {
  /** Vitesse — tr/min */
  rpm: number
  max?: number
  label?: string
}

/** Cadran tachymétrique : aiguille animée (transition CSS), graduations tous les 200 tr/min. */
export default function Tachometer({ rpm, max = 2000, label = 'tr/min' }: TachometerProps) {
  const angle = (v: number) => -120 + (240 * Math.min(max, Math.max(0, v))) / max
  const ticks = Array.from({ length: max / 100 + 1 }, (_, k) => k * 100)
  return (
    <svg viewBox="-80 -80 160 130" className="w-full max-w-[220px]" role="img" aria-label={`Tachymètre ${Math.round(rpm)} tr/min`}>
      <circle r="76" fill="#121416" stroke="var(--color-line)" strokeWidth="2" />
      {ticks.map((v) => {
        const a = ((angle(v) - 90) * Math.PI) / 180
        const major = v % 500 === 0
        return (
          <g key={v}>
            <line x1={66 * Math.cos(a)} y1={66 * Math.sin(a)} x2={(major ? 56 : 61) * Math.cos(a)} y2={(major ? 56 : 61) * Math.sin(a)} stroke={major ? 'var(--color-ink)' : 'var(--color-muted)'} strokeWidth={major ? 2 : 1} />
            {major && (
              <text x={45 * Math.cos(a)} y={45 * Math.sin(a) + 3} textAnchor="middle" fontSize="9" fill="var(--color-muted)" className="font-mono">
                {v}
              </text>
            )}
          </g>
        )
      })}
      <g style={{ transform: `rotate(${angle(rpm)}deg)`, transition: 'transform 0.8s cubic-bezier(.3,1.4,.6,1)' }}>
        <line y1="8" y2="-62" stroke="var(--color-accent)" strokeWidth="3" strokeLinecap="round" />
      </g>
      <circle r="6" fill="#9aa0a8" />
      <text y="30" textAnchor="middle" fontSize="14" fill="var(--color-ink)" className="font-mono">
        {Math.round(rpm)}
      </text>
      <text y="42" textAnchor="middle" fontSize="8" fill="var(--color-muted)">
        {label}
      </text>
    </svg>
  )
}
