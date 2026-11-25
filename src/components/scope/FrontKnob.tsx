/**
 * Molette de face avant (codeur sans butée, comme sur un oscilloscope numérique) : couronne moletée, repère.
 *
 * Réglage doux :
 * - glisser vers le haut ou vers la droite = sens horaire ; le repère suit le doigt en continu, un cran tous les
 *   PX_PER_STEP pixels (Maj : réglage fin, deux fois plus de pixels par cran) ;
 * - molette de souris / pavé tactile : les petits défilements s'accumulent (un cran par WHEEL_PX_PER_STEP),
 *   un cran au plus par image d'animation pour ne jamais « emballer » la valeur ;
 * - flèches ±1 cran, Page ±10 ; appui (clic sans rotation, Entrée, Espace) = action de la molette (50 %, 0…) ;
 * - clic sur la valeur affichée : saisie directe (« 2 ms », « 0,5 », « 40n », « 1,2 kHz »).
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

const DEG_PER_STEP = 15
/** Glisser : pixels par cran */
const PX_PER_STEP = 12
/** Molette : pixels de défilement par cran (une encoche de souris ≈ 100 px, un pavé tactile envoie de petits pas) */
const WHEEL_PX_PER_STEP = 70
/** Au-delà, le geste est un glisser et non un appui — px */
const PRESS_SLOP = 4

const SI: Record<string, number> = { p: 1e-12, n: 1e-9, u: 1e-6, µ: 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, G: 1e9 }

/** « 2 ms » → 0,002 ; « 0,5 » → 0,5 ; « 40n » → 4e-8 ; « 1,2 kHz » → 1200. NaN si illisible. */
export function parseSI(text: string): number {
  const m = text.trim().replace(',', '.').match(/^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*([pnuµmkKMG])?/i)
  if (!m) return NaN
  const v = Number(m[1])
  const p = m[2]
  // « m » minuscule = milli, « M » majuscule = méga (on ne met pas le préfixe en minuscule)
  return p ? v * (SI[p] ?? 1) : v
}

interface Props {
  label: string
  /** Valeur affichée sous la molette et annoncée aux lecteurs d'écran */
  valueText?: string
  /** n crans (positifs : sens horaire) */
  onStep: (n: number) => void
  onPress?: () => void
  /** Texte de l'action d'appui, sérigraphié sous la molette */
  pressLabel?: string
  /** Saisie directe d'une valeur (unité de base, préfixes SI acceptés) ; absent = pas de saisie */
  onEnter?: (v: number) => void
  size?: number
  tint?: string
  disabled?: boolean
  /** Repère pour le mode démonstration */
  demoId?: string
}

/** Style de la molette, injecté une fois dans la page (la molette sert aussi hors de la face avant) */
const FK_CSS = `
.fk { filter: drop-shadow(0 4px 5px rgba(0,0,0,0.45)); }
.fk .fk-rot { transition: transform 120ms cubic-bezier(.2,.8,.2,1); transform-box: view-box; transform-origin: 0 0; }
.fk.is-dragging .fk-rot { transition: none; }
.fk:focus-visible { outline: 2px solid #93c5fd; outline-offset: 3px; }
.fk-value { color: #eceff2; background: rgba(255,255,255,0.06); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.12); transition: background 150ms ease; }
.fk-value:hover { background: rgba(255,255,255,0.14); }
.fk-value:focus-visible { outline: 2px solid #93c5fd; outline-offset: 2px; }
.fk-input { color: #101214; background: #f4f6f8; box-shadow: 0 0 0 2px #93c5fd; outline: none; }
@media (prefers-reduced-motion: reduce) { .fk .fk-rot, .fk-value { transition: none; } }
`
let fkCssInjected = false
function useFkCss() {
  useEffect(() => {
    if (fkCssInjected || typeof document === 'undefined') return
    fkCssInjected = true
    const s = document.createElement('style')
    s.dataset.fk = ''
    s.textContent = FK_CSS
    document.head.appendChild(s)
  }, [])
}

export default function FrontKnob({ label, valueText, onStep, onPress, pressLabel, onEnter, size = 56, tint, disabled, demoId }: Props) {
  // Angle affiché = crans entiers + fraction en cours de glisser (le repère suit le doigt)
  const [steps, setSteps] = useState(0)
  const [frac, setFrac] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const cap = `fk${useId().replace(/:/g, '')}`
  useFkCss()
  const stepRef = useRef(onStep)
  stepRef.current = onStep

  const turn = (n: number) => {
    if (disabled || n === 0) return
    stepRef.current(n)
    setSteps((s) => s + n)
    try {
      navigator.vibrate?.(3)
    } catch {
      /* vibration indisponible */
    }
  }
  const turnRef = useRef(turn)
  turnRef.current = turn

  // Molette : accumulation des défilements, au plus un cran par image (rAF) ; écouteur non passif
  const el = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const b = el.current!
    let acc = 0
    let raf = 0
    const flush = () => {
      raf = 0
      const n = Math.trunc(acc)
      if (n !== 0) {
        // Un cran par image au plus : le reste attend l'image suivante (défilement doux, sans emballement)
        const k = Math.sign(n)
        acc -= k
        turnRef.current(k)
        if (Math.abs(acc) >= 1) raf = requestAnimationFrame(flush)
      }
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const px = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY
      acc -= px / WHEEL_PX_PER_STEP
      // Encoche de souris franche : au moins un cran
      if (Math.abs(acc) < 1 && Math.abs(px) >= WHEEL_PX_PER_STEP * 0.9) acc = -Math.sign(px)
      // Pas plus de 3 crans en attente : un grand coup de pavé tactile ne saute pas d'un bout à l'autre
      acc = Math.max(-3, Math.min(3, acc))
      if (!raf) raf = requestAnimationFrame(flush)
    }
    b.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      b.removeEventListener('wheel', onWheel)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  const drag = useRef<{ x: number; y: number; acc: number; moved: boolean } | null>(null)
  const onDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (disabled) return
    drag.current = { x: e.clientX, y: e.clientY, acc: 0, moved: false }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* pointeur déjà relâché */
    }
  }
  const onMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.moved && Math.hypot(dx, dy) < PRESS_SLOP) return
    if (!d.moved) setDragging(true)
    d.moved = true
    d.x = e.clientX
    d.y = e.clientY
    // Haut ou droite = sens horaire ; Maj = réglage fin
    d.acc += (dx - dy) / (PX_PER_STEP * (e.shiftKey ? 2 : 1))
    const n = Math.trunc(d.acc)
    if (n !== 0) {
      d.acc -= n
      turn(n)
    }
    setFrac(d.acc)
  }
  const onUp = () => {
    const d = drag.current
    drag.current = null
    setDragging(false)
    setFrac(0)
    if (d && !d.moved) onPress?.()
  }

  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') turn(1)
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') turn(-1)
    else if (e.key === 'PageUp') turn(10)
    else if (e.key === 'PageDown') turn(-10)
    else if ((e.key === 'Enter' || e.key === ' ') && onPress) onPress()
    else return
    e.preventDefault()
  }

  const commitDraft = () => {
    const v = parseSI(draft)
    if (Number.isFinite(v)) onEnter?.(v)
    setEditing(false)
  }

  const r = size / 2
  const teeth = Math.round(size * 0.9)
  const hit = Math.max(48, size)
  const angle = (steps + frac) * DEG_PER_STEP
  return (
    <div className="flex flex-col items-center gap-0.5">
      <button
        ref={el}
        type="button"
        data-demo={demoId}
        disabled={disabled}
        className={`fk relative flex touch-none select-none items-center justify-center rounded-full disabled:opacity-40 ${dragging ? 'is-dragging' : ''}`}
        style={{ width: hit, height: hit, cursor: dragging ? 'grabbing' : 'grab' }}
        aria-label={`${label}${onPress && pressLabel ? ` (appui : ${pressLabel})` : ''}`}
        aria-valuetext={valueText}
        role="slider"
        aria-valuenow={0}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={onKey}
      >
        <svg width={size} height={size} viewBox={`${-r} ${-r} ${size} ${size}`} aria-hidden="true">
          <defs>
            <radialGradient id={cap} cx="35%" cy="30%" r="80%">
              <stop offset="0" stopColor="#5b6168" />
              <stop offset="0.55" stopColor="#30343a" />
              <stop offset="1" stopColor="#17191c" />
            </radialGradient>
          </defs>
          <circle r={r - 0.5} fill="#111316" />
          {/* La couronne moletée tourne avec le repère : on voit le codeur bouger */}
          <g className="fk-rot" style={{ transform: `rotate(${angle}deg)` }}>
            <g stroke="#4c5157" strokeWidth="1.2">
              {Array.from({ length: teeth }, (_, i) => {
                const a = (i / teeth) * 2 * Math.PI
                return <line key={i} x1={Math.cos(a) * (r - 1)} y1={Math.sin(a) * (r - 1)} x2={Math.cos(a) * (r - 4)} y2={Math.sin(a) * (r - 4)} />
              })}
            </g>
          </g>
          <circle r={r - 5} fill={`url(#${cap})`} />
          {tint && <circle r={r - 5} fill="none" stroke={tint} strokeOpacity="0.7" strokeWidth="1.6" />}
          <g className="fk-rot" style={{ transform: `rotate(${angle}deg)` }}>
            <line x1="0" y1={-(r - 7)} x2="0" y2={-(r * 0.38)} stroke="#eceff2" strokeWidth="2" strokeLinecap="round" />
          </g>
        </svg>
      </button>
      <span className="fp-silk text-[11px] font-medium tracking-wide">{label}</span>
      {valueText !== undefined &&
        (editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitDraft()
              else if (e.key === 'Escape') setEditing(false)
            }}
            inputMode="decimal"
            aria-label={`Saisir ${label}`}
            className="fk-input h-8 w-24 rounded-md px-1.5 text-center font-mono text-[12px]"
          />
        ) : onEnter ? (
          <button
            type="button"
            onClick={() => {
              setDraft(valueText.replace(/\/div$/, ''))
              setEditing(true)
            }}
            className="fk-value min-h-7 rounded-md px-1.5 font-mono text-[10px]"
            aria-label={`${label} : ${valueText}, cliquer pour saisir une valeur`}
            title="Cliquer pour saisir une valeur"
          >
            {valueText}
          </button>
        ) : (
          <span className="fp-silk font-mono text-[10px] opacity-75">{valueText}</span>
        ))}
      {onPress && pressLabel && <span className="fp-silk text-[9px] opacity-55">appui : {pressLabel}</span>}
    </div>
  )
}
