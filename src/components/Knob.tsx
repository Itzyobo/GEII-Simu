import { useEffect, useRef, type PointerEvent } from 'react'
import { formatSI } from '../lib/format'

type KnobProps = {
  label: string
  value: number
  onChange: (v: number) => void
  unit: string
  format?: (v: number) => string
  color?: string
} & (
  | {
      min: number
      max: number
      /** Pas de réglage (arrondi de la valeur) */
      step: number
      /** Échelle logarithmique : angle ∝ log(valeur), 100 crans sur la course */
      log?: boolean
      steps?: undefined
    }
  | {
      /** Crans imposés (ex. 1-2-5 d'un calibre d'oscillo) à la place de min/max/pas */
      steps: readonly number[]
      min?: undefined
      max?: undefined
      step?: undefined
      log?: undefined
    }
)

const LOG_NOTCHES = 100
const PX_PER_NOTCH = 6

/** Bouton rotatif : molette, glisser vertical ou flèches clavier. */
export default function Knob(props: KnobProps) {
  const { label, value, onChange, unit, format, color, steps, log } = props
  const min = props.steps ? props.steps[0] : props.min
  const max = props.steps ? props.steps[props.steps.length - 1] : props.max
  const step = props.step ?? 0
  const valueRef = useRef(value)
  valueRef.current = value
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const nudge = (n: number) => {
    const v = valueRef.current
    let next: number
    if (steps) {
      let i = 0
      for (let k = 1; k < steps.length; k++) if (Math.abs(steps[k] - v) < Math.abs(steps[i] - v)) i = k
      next = steps[Math.min(steps.length - 1, Math.max(0, i + n))]
    } else {
      const snap = (x: number) => Number((Math.round(x / step) * step).toPrecision(12))
      if (log) {
        const u = Math.log(v / min) / Math.log(max / min) + n / LOG_NOTCHES
        next = snap(min * (max / min) ** u)
        if (next === v) next = snap(v + Math.sign(n) * step) // pas plus grand que le cran log
      } else next = snap(v + n * step)
      next = Math.min(max, Math.max(min, next))
    }
    if (next !== v) {
      valueRef.current = next
      onChangeRef.current(next)
    }
  }
  const nudgeRef = useRef(nudge)
  nudgeRef.current = nudge

  // La molette doit être non passive pour bloquer le défilement de la page.
  const knobRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = knobRef.current!
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      nudgeRef.current(e.deltaY < 0 ? 1 : -1)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const drag = useRef<number | null>(null)
  const onPointerDown = (e: PointerEvent) => {
    drag.current = e.clientY
    try {
      e.currentTarget.setPointerCapture(e.pointerId) // le glisser continue hors du bouton (doigt ou souris)
    } catch {
      /* pointeur déjà relâché : on garde le glisser sans capture */
    }
  }
  const onPointerMove = (e: PointerEvent) => {
    if (drag.current === null) return
    const n = Math.trunc((drag.current - e.clientY) / PX_PER_NOTCH)
    if (n !== 0) {
      drag.current -= n * PX_PER_NOTCH
      nudge(n)
    }
  }

  const u = steps
    ? steps.indexOf(value) / (steps.length - 1)
    : log
      ? Math.log(value / min) / Math.log(max / min)
      : (value - min) / (max - min)
  const angle = -135 + 270 * Math.min(1, Math.max(0, u))
  const text = format ? format(value) : formatSI(value, unit)

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <span className="text-[11px] uppercase tracking-wide text-muted">{label}</span>
      <div
        ref={knobRef}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={text}
        className="cursor-ns-resize touch-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => (drag.current = null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowRight') nudge(1)
          else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') nudge(-1)
          else return
          e.preventDefault()
        }}
      >
        <svg width="56" height="56" viewBox="-28 -28 56 56">
          {Array.from({ length: 11 }, (_, i) => {
            const a = ((-135 + 27 * i - 90) * Math.PI) / 180
            return (
              <line key={i} x1={25 * Math.cos(a)} y1={25 * Math.sin(a)} x2={22 * Math.cos(a)} y2={22 * Math.sin(a)} stroke="var(--color-line)" strokeWidth="1.5" />
            )
          })}
          <circle r="19" fill="var(--color-card)" stroke="var(--color-line)" strokeWidth="1.5" />
          <circle r="15" fill="var(--color-card-2)" />
          <g transform={`rotate(${angle})`}>
            <line y1="-6" y2="-16" stroke={color ?? 'var(--color-accent)'} strokeWidth="3" strokeLinecap="round" />
          </g>
        </svg>
      </div>
      <span className="font-mono text-xs text-ink">{text}</span>
    </div>
  )
}
