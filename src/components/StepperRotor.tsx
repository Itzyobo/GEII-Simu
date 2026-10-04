import { useEffect, useRef, useState } from 'react'

interface StepperRotorProps {
  /** Fréquence des pas (horloge PUL) — Hz ; 0 = rotor immobile */
  stepRate: number
  /** Pas par tour (200 / 400 / 800) */
  stepsPerTurn: number
  /** Sens de rotation */
  dir: 1 | -1
}

const fmtTime = (s: number) => {
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${(s - 60 * m).toFixed(1).padStart(4, '0').replace('.', ',')}`
}

/**
 * Rotor animé à la vitesse réelle : avance pas par pas (angle = n·360°/Np),
 * avec chronomètre et compteur de tours pour mesurer N.
 */
export default function StepperRotor({ stepRate, stepsPerTurn, dir }: StepperRotorProps) {
  const live = useRef({ stepRate, stepsPerTurn, dir })
  live.current = { stepRate, stepsPerTurn, dir }
  const rotorRef = useRef<SVGGElement>(null)
  const steps = useRef(0) // pas effectués depuis le montage (signés)
  const chronoStart = useRef<{ t: number; steps: number } | null>(null)
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [turns, setTurns] = useState(0)

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let lastUi = 0
    const frame = (now: number) => {
      const s = live.current
      const dt = Math.min(0.1, (now - last) / 1000) // onglet en arrière-plan : pas de saut
      last = now
      steps.current += s.dir * s.stepRate * dt
      const angle = (Math.floor(steps.current) * 360) / s.stepsPerTurn
      rotorRef.current?.setAttribute('transform', `rotate(${angle % 360})`)
      const c = chronoStart.current
      if (c && now - lastUi > 100) {
        lastUi = now
        setElapsed((now - c.t) / 1000)
        setTurns(Math.abs(Math.floor(steps.current) - c.steps) / s.stepsPerTurn)
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  const toggle = () => {
    if (running) {
      const c = chronoStart.current!
      setElapsed((performance.now() - c.t) / 1000)
      setTurns(Math.abs(Math.floor(steps.current) - c.steps) / live.current.stepsPerTurn)
      chronoStart.current = null
    } else {
      chronoStart.current = { t: performance.now(), steps: Math.floor(steps.current) }
      setElapsed(0)
      setTurns(0)
    }
    setRunning(!running)
  }

  return (
    <div className="flex flex-wrap items-center gap-5 rounded-card bg-card p-3 ring-1 ring-line">
      <svg width="140" height="140" viewBox="-70 -70 140 140" role="img" aria-label="Rotor du moteur pas à pas">
        <circle r="66" fill="#16181b" stroke="var(--color-line)" strokeWidth="2" />
        {Array.from({ length: 8 }, (_, k) => (
          <rect key={k} x="-7" y="-64" width="14" height="14" rx="2" fill="#3a3f46" transform={`rotate(${k * 45})`} />
        ))}
        <g ref={rotorRef}>
          <circle r="44" fill="#2b2f35" stroke="#59606a" strokeWidth="1.5" />
          {Array.from({ length: 50 }, (_, k) => (
            <line key={k} y1="-44" y2="-39" stroke="#59606a" strokeWidth="2" transform={`rotate(${k * 7.2})`} />
          ))}
          <circle r="8" fill="#9aa0a8" />
          <line y1="-8" y2="-36" stroke="var(--color-accent)" strokeWidth="5" strokeLinecap="round" />
        </g>
      </svg>
      <div className="space-y-2">
        <div className="font-mono text-2xl text-ink">{fmtTime(elapsed)}</div>
        <div className="font-mono text-sm text-muted">
          Tours : <span className="text-ink">{turns.toFixed(2).replace('.', ',')}</span>
        </div>
        <button
          type="button"
          onClick={toggle}
          className={`min-h-11 rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 ring-line ${running ? 'bg-accent text-[#1a1306]' : 'bg-card-2'}`}
        >
          {running ? 'Stop' : 'Départ chrono'}
        </button>
      </div>
    </div>
  )
}
