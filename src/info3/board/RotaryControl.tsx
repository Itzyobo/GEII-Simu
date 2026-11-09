/**
 * Commandes de la carte ROTARY O click : molette (1 cran par cran de molette), flèches ← / →,
 * glisser circulaire (12° par cran), rotation continue de 1 à 10 crans/s, bouton SW (non utilisé aux TP2 et TP3).
 * Anneau de 16 LED (74HC595) : lueur de chaque LED = fraction du temps allumée sur l'image.
 */
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { INFO3 } from '../../data/reference'

const R = INFO3.rotary
const DEG_PER_DETENT = 360 / R.detentsPerTurn
const RING_LEDS = 16
const FULL_TURN_DEG = 360

export interface RotaryControlProps {
  slotLabel: string
  onTurn(detents: number): void
  onSpin(rate: number): void
  onSw(pressed: boolean): void
  /** Anneau : fraction du temps allumée, LED 1 à 16 */
  ring?: number[]
}

export default function RotaryControl({ slotLabel, onTurn, onSpin, onSw, ring }: RotaryControlProps) {
  const [position, setPosition] = useState(0)
  const [rate, setRate] = useState<number>(R.spinRate.min)
  const [spinning, setSpinning] = useState(0)
  const knob = useRef<SVGSVGElement | null>(null)
  const drag = useRef<{ angle: number; acc: number } | null>(null)
  const turnRef = useRef<(n: number) => void>(() => {})

  const turn = (n: number) => {
    if (!n) return
    setPosition((p) => p + n)
    onTurn(n)
  }
  useEffect(() => {
    turnRef.current = turn
  })

  // Molette : écouteur non passif pour ne pas faire défiler la page
  useEffect(() => {
    const el = knob.current
    if (!el) return
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      turnRef.current(e.deltaY > 0 ? 1 : -1)
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  }, [])

  // Rotation continue : la position affichée suit le Worker au même rythme
  useEffect(() => {
    if (!spinning) return
    const id = window.setInterval(() => setPosition((p) => p + Math.sign(spinning)), INFO3.units.msPerS / Math.abs(spinning))
    return () => window.clearInterval(id)
  }, [spinning])

  const angleOf = (e: RPointerEvent) => {
    const r = knob.current!.getBoundingClientRect()
    return (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * FULL_TURN_DEG) / (2 * Math.PI)
  }
  const down = (e: RPointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { angle: angleOf(e), acc: 0 }
  }
  const move = (e: RPointerEvent<SVGSVGElement>) => {
    const d = drag.current
    if (!d) return
    const a = angleOf(e)
    let delta = a - d.angle
    if (delta > FULL_TURN_DEG / 2) delta -= FULL_TURN_DEG
    if (delta < -FULL_TURN_DEG / 2) delta += FULL_TURN_DEG
    d.angle = a
    d.acc += delta
    const n = Math.trunc(d.acc / DEG_PER_DETENT)
    if (n) {
      d.acc -= n * DEG_PER_DETENT
      turn(n)
    }
  }
  const spin = (dir: number) => {
    const r = dir * rate
    setSpinning(r)
    onSpin(r)
  }

  const angle = position * DEG_PER_DETENT
  const btn = 'rounded-md bg-card px-2 py-1 text-xs font-medium ring-1 ring-line hover:bg-card-2'
  return (
    <div className="rounded-card bg-card p-3 ring-1 ring-line" aria-label="Carte ROTARY O click">
      <p className="text-sm font-semibold">
        ROTARY O click <span className="font-normal text-muted">— {slotLabel}</span>
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <svg
          ref={knob}
          viewBox="-50 -50 100 100"
          className="h-28 w-28 shrink-0 cursor-grab touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-accent"
          role="slider"
          tabIndex={0}
          aria-label="Bouton du codeur (molette, flèches gauche et droite, ou glisser en cercle)"
          aria-valuenow={position}
          aria-valuetext={`${position} crans`}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
              e.preventDefault()
              turn(1)
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
              e.preventDefault()
              turn(-1)
            }
          }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
        >
          {Array.from({ length: RING_LEDS }, (_, i) => {
            // LED 1 en haut, numérotation dans le sens horaire (H10) ; lueur = fraction du temps allumée
            const a = (2 * Math.PI * i) / RING_LEDS
            const d = Math.min(1, Math.max(0, ring?.[i] ?? 0))
            const x = 44 * Math.sin(a)
            const y = -44 * Math.cos(a)
            return (
              <g key={i} className="info3-ring-led" data-on={d > 0.5 ? '1' : '0'} aria-label={`LED ${i + 1} de l’anneau`}>
                {d > 0 && <circle cx={x} cy={y} r={6} fill="#ffb020" opacity={0.45 * d} />}
                <circle cx={x} cy={y} r={3} fill={d > 0 ? '#ffd27a' : '#3a2a10'} fillOpacity={d > 0 ? 0.35 + 0.65 * d : 1} stroke="#111" strokeWidth={0.5} />
              </g>
            )
          })}
          <circle r={34} fill="#2b2f33" stroke="#111" strokeWidth={2} />
          <g transform={`rotate(${angle})`}>
            <circle r={26} fill="#3b4148" />
            <rect x={-2} y={-30} width={4} height={14} rx={2} fill="#e8e8e8" />
          </g>
        </svg>
        <div className="min-w-0 space-y-2 text-xs">
          <p className="tabular-nums">
            Position : <span className="font-mono font-semibold">{position}</span> crans
          </p>
          <div className="flex flex-wrap gap-1">
            <button type="button" className={btn} onClick={() => turn(-1)} aria-label="Un cran antihoraire">
              ⟲ −1
            </button>
            <button type="button" className={btn} onClick={() => turn(1)} aria-label="Un cran horaire">
              +1 ⟳
            </button>
            <button type="button" className={btn} onPointerDown={() => onSw(true)} onPointerUp={() => onSw(false)} onPointerLeave={() => onSw(false)}>
              SW
            </button>
          </div>
          <label className="flex items-center gap-2">
            Continu
            <input type="range" min={R.spinRate.min} max={R.spinRate.max} value={rate} onChange={(e) => setRate(Number(e.target.value))} aria-label="Vitesse de rotation continue (crans par seconde)" />
            <span className="tabular-nums">{rate}/s</span>
          </label>
          <div className="flex flex-wrap gap-1">
            <button type="button" className={btn} onClick={() => spin(-1)}>
              ⟲ continu
            </button>
            <button type="button" className={btn} onClick={() => spin(1)}>
              ⟳ continu
            </button>
            <button type="button" className={btn} disabled={!spinning} onClick={() => spin(0)}>
              Arrêt
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
