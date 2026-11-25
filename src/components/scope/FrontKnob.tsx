/**
 * Molette de face avant (codeur sans butée, comme sur un oscilloscope numérique) : couronne moletée, repère.
 * Rotation au glisser circulaire ou vertical, à la molette de souris, aux flèches du clavier ; appui (clic sans
 * rotation, Entrée ou Espace) = action de la molette (50 %, remise à 0…). Légère vibration par cran sur mobile.
 */
import { useEffect, useRef, useState, type PointerEvent } from 'react'

const DEG_PER_STEP = 18
/** Glisser vertical : pixels par cran */
const PX_PER_STEP = 8

interface Props {
  label: string
  /** Valeur affichée sous la molette et annoncée aux lecteurs d'écran */
  valueText?: string
  /** n crans (positifs : sens horaire / vers le haut) */
  onStep: (n: number) => void
  onPress?: () => void
  /** Texte de l'action d'appui, sérigraphié sous la molette */
  pressLabel?: string
  size?: number
  tint?: string
  disabled?: boolean
}

export default function FrontKnob({ label, valueText, onStep, onPress, pressLabel, size = 56, tint, disabled }: Props) {
  const [angle, setAngle] = useState(0)
  const stepRef = useRef(onStep)
  stepRef.current = onStep
  const turn = (n: number) => {
    if (disabled || n === 0) return
    stepRef.current(n)
    setAngle((a) => a + n * DEG_PER_STEP)
    try {
      navigator.vibrate?.(4)
    } catch {
      /* vibration indisponible */
    }
  }
  const turnRef = useRef(turn)
  turnRef.current = turn

  // Molette de souris : écouteur non passif pour ne pas faire défiler la page
  const el = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const b = el.current!
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      turnRef.current(e.deltaY < 0 ? 1 : -1)
    }
    b.addEventListener('wheel', onWheel, { passive: false })
    return () => b.removeEventListener('wheel', onWheel)
  }, [])

  const drag = useRef<{ a: number; y: number; acc: number; moved: boolean } | null>(null)
  const polar = (e: PointerEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI
  }
  const onDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (disabled) return
    drag.current = { a: polar(e), y: e.clientY, acc: 0, moved: false }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* pointeur déjà relâché */
    }
  }
  const onMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current
    if (!d) return
    // Rotation circulaire autour du centre, complétée par le glisser vertical
    let da = polar(e) - d.a
    if (da > 180) da -= 360
    if (da < -180) da += 360
    d.a = polar(e)
    const dy = d.y - e.clientY
    d.y = e.clientY
    d.acc += da / DEG_PER_STEP + dy / PX_PER_STEP
    const n = Math.trunc(d.acc)
    if (n !== 0) {
      d.acc -= n
      d.moved = true
      turn(n)
    }
  }
  const onUp = () => {
    const d = drag.current
    drag.current = null
    if (d && !d.moved && Math.abs(d.acc) < 0.5) onPress?.()
  }

  const r = size / 2
  const teeth = Math.round(size * 0.9)
  const hit = Math.max(48, size)
  return (
    <div className="flex flex-col items-center gap-0.5">
      <button
        ref={el}
        type="button"
        disabled={disabled}
        className="fk relative flex touch-none items-center justify-center rounded-full disabled:opacity-40"
        style={{ width: hit, height: hit }}
        aria-label={`${label}${onPress && pressLabel ? ` (appui : ${pressLabel})` : ''}`}
        aria-valuetext={valueText}
        role="slider"
        aria-valuenow={0}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => (drag.current = null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowRight') turn(1)
          else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') turn(-1)
          else if (e.key === 'PageUp') turn(10)
          else if (e.key === 'PageDown') turn(-10)
          else if ((e.key === 'Enter' || e.key === ' ') && onPress) onPress()
          else return
          e.preventDefault()
        }}
      >
        <svg width={size} height={size} viewBox={`${-r} ${-r} ${size} ${size}`} aria-hidden="true">
          <circle r={r - 0.5} fill="#111316" />
          <g stroke="#4c5157" strokeWidth="1.2">
            {Array.from({ length: teeth }, (_, i) => {
              const a = (i / teeth) * 2 * Math.PI
              return <line key={i} x1={Math.cos(a) * (r - 1)} y1={Math.sin(a) * (r - 1)} x2={Math.cos(a) * (r - 4)} y2={Math.sin(a) * (r - 4)} />
            })}
          </g>
          <circle r={r - 5} fill="url(#fk-cap)" />
          {tint && <circle r={r - 5} fill="none" stroke={tint} strokeOpacity="0.7" strokeWidth="1.6" />}
          <g className="fk-rot" style={{ transform: `rotate(${angle}deg)` }}>
            <line x1="0" y1={-(r - 7)} x2="0" y2={-(r * 0.38)} stroke="#eceff2" strokeWidth="2" strokeLinecap="round" />
          </g>
        </svg>
      </button>
      <span className="fp-silk text-[11px] font-medium tracking-wide">{label}</span>
      {valueText !== undefined && <span className="fp-silk font-mono text-[10px] opacity-75">{valueText}</span>}
      {onPress && pressLabel && <span className="fp-silk text-[9px] opacity-55">appui : {pressLabel}</span>}
    </div>
  )
}
