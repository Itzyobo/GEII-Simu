import { useEffect, useRef, useState, type PointerEvent } from 'react'
import Knob from './Knob'
import { PINCE_SENSIBILITE } from '../data/reference'
import { formatSI } from '../lib/format'
import { acquire, frameStart, measure, SCOPE_POINTS, type Measures, type Signal } from '../lib/scope'

interface OscilloscopeProps {
  /** Signal de la voie 1 (V en fonction de t en s) ; absent = voie indisponible */
  ch1?: Signal
  ch2?: Signal
  /** Voie branchée sur une pince ampèremétrique : le signal est un courant (A), la pince sort 100 mV/A */
  clamp?: [boolean, boolean]
  /** Calibres initiaux (dans l'unité de la sonde réglée) */
  voltsPerDiv?: [number, number]
  secPerDiv?: number
  /** Niveau de trigger initial (unité de CH1) */
  triggerLevel?: number
}

/** Curseurs en divisions : x de 0 à 10 (gauche → droite), y de −4 à +4 (bas → haut). */
interface Cursors {
  x1: number
  x2: number
  y1: number
  y2: number
}
type CursorKey = keyof Cursors

/** Suite 1-2-5 entre deux valeurs, comme les calibres d'un vrai oscillo. */
function seq125(from: number, to: number): number[] {
  const out: number[] = []
  for (let d = Math.floor(Math.log10(from)); d <= Math.ceil(Math.log10(to)); d++)
    for (const m of [1, 2, 5]) {
      const v = Number((m * 10 ** d).toPrecision(3))
      if (v >= from * 0.999 && v <= to * 1.001) out.push(v)
    }
  return out
}
const VOLT_STEPS = seq125(5e-3, 100)
const TIME_STEPS = seq125(0.2e-6, 0.5)

const DIV = 60
const W = 10 * DIV
const H = 8 * DIV
const CH = ['ch1', 'ch2'] as const
const NO_CLAMP: [boolean, boolean] = [false, false]

const fmtDiv = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1).replace('.', ',')} div`
const fmtPct = (d: number) => (Number.isFinite(d) ? `${(d * 100).toFixed(1).replace('.', ',')} %` : '—')
const fmtHz = (f: number) => (Number.isFinite(f) ? formatSI(f, 'Hz') : '—')

interface Readout {
  triggered: boolean
  m: (Measures | null)[]
}

/** Oscilloscope 2 voies : grille 10×8, trigger front montant CH1 au centre, mesures auto. */
export default function Oscilloscope({
  ch1,
  ch2,
  clamp = NO_CLAMP,
  voltsPerDiv = [1, 1],
  secPerDiv = 0.2e-3,
  triggerLevel = 0,
}: OscilloscopeProps) {
  const [on, setOn] = useState<[boolean, boolean]>([!!ch1, !!ch2])
  /** Réglage sonde de la voie : true = pince (A/div), false = sonde ×1 (V/div) */
  const [probeA, setProbeA] = useState<[boolean, boolean]>(clamp)
  // Détection de sonde (comme TekProbe) : le réglage suit la sonde branchée, puis reste modifiable.
  const [prevClamp, setPrevClamp] = useState(clamp)
  if (prevClamp[0] !== clamp[0] || prevClamp[1] !== clamp[1]) {
    setPrevClamp(clamp)
    setProbeA(clamp)
  }
  const [cursorsOn, setCursorsOn] = useState(false)
  const [cur, setCur] = useState<Cursors>({ x1: 3, x2: 7, y1: -2, y2: 2 })
  const [curCh, setCurCh] = useState<0 | 1>(0)
  const [vdiv, setVdiv] = useState<[number, number]>(voltsPerDiv)
  const [pos, setPos] = useState<[number, number]>([0, 0])
  const [sdiv, setSdiv] = useState(secPerDiv)
  const [level, setLevel] = useState(triggerLevel)
  const [readout, setReadout] = useState<Readout>({ triggered: false, m: [null, null] })

  const fns = [ch1, ch2]
  const units = probeA.map((a) => (a ? 'A' : 'V'))
  // Entrée de l'oscillo = tension (la pince convertit A → V), affichage selon le réglage sonde.
  const gains = [0, 1].map((c) => (clamp[c] ? PINCE_SENSIBILITE : 1) / (probeA[c] ? PINCE_SENSIBILITE : 1))
  const live = useRef({ fns, gains, on, vdiv, pos, sdiv, level, cursorsOn, cur, curCh })
  live.current = { fns, gains, on, vdiv, pos, sdiv, level, cursorsOn, cur, curCh }

  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current!
    const dpr = window.devicePixelRatio || 1
    canvas.width = W * dpr
    canvas.height = H * dpr
    const ctx = canvas.getContext('2d')!
    const css = getComputedStyle(document.documentElement)
    const colors = [css.getPropertyValue('--color-ch1').trim(), css.getPropertyValue('--color-ch2').trim()]
    let raf = 0
    const line = (x1: number, y1: number, x2: number, y2: number) => {
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
    }
    /** Triangle de repère collé au bord x, pointe à x + dx */
    const marker = (x: number, y: number, dx: number) => {
      ctx.beginPath()
      ctx.moveTo(x, y - 7)
      ctx.lineTo(x + dx, y)
      ctx.lineTo(x, y + 7)
      ctx.fill()
    }
    let lastReadout = 0

    const draw = (now: number) => {
      const s = live.current
      const span = 10 * s.sdiv
      const dt = span / SCOPE_POINTS
      const tNow = now / 1000
      const shown = s.fns.map((fn, c) => fn && ((t: number) => fn(t) * s.gains[c]))
      const { t0, triggered } = shown[0] ? frameStart(shown[0], s.level, tNow, span, SCOPE_POINTS) : { t0: tNow, triggered: false }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = '#050607'
      ctx.fillRect(0, 0, W, H)
      // Grille 10×8 + axes gradués
      ctx.strokeStyle = 'rgba(160,170,180,0.18)'
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let i = 0; i <= 10; i++) line(i * DIV + 0.5, 0, i * DIV + 0.5, H)
      for (let j = 0; j <= 8; j++) line(0, j * DIV + 0.5, W, j * DIV + 0.5)
      ctx.stroke()
      ctx.strokeStyle = 'rgba(160,170,180,0.4)'
      ctx.beginPath()
      for (let k = 0; k <= 50; k++) line(k * (DIV / 5) + 0.5, H / 2 - 3, k * (DIV / 5) + 0.5, H / 2 + 4)
      for (let k = 0; k <= 40; k++) line(W / 2 - 3, k * (DIV / 5) + 0.5, W / 2 + 4, k * (DIV / 5) + 0.5)
      ctx.stroke()

      const ms: (Measures | null)[] = [null, null]
      ctx.font = '600 12px "JetBrains Mono", monospace'
      for (let c = 0; c < 2; c++) {
        const fn = shown[c]
        if (!fn || !s.on[c]) continue
        const toY = (v: number) => H / 2 - (v / s.vdiv[c] + s.pos[c]) * DIV
        const samples = acquire(fn, t0, span, SCOPE_POINTS)
        ms[c] = measure(samples, dt)
        ctx.strokeStyle = colors[c]
        ctx.lineWidth = 1.6
        ctx.beginPath()
        for (let i = 0; i < SCOPE_POINTS; i++) {
          const y = Math.min(H + 2, Math.max(-2, toY(samples[i])))
          if (i === 0) ctx.moveTo(0, y)
          else ctx.lineTo((i * W) / SCOPE_POINTS, y)
        }
        ctx.stroke()
        // Repère de masse à gauche
        ctx.fillStyle = colors[c]
        const yg = Math.min(H - 8, Math.max(8, toY(0)))
        marker(0, yg, 12)
        ctx.fillText(String(c + 1), 14, yg + 4)
        // Repère de niveau de trigger à droite (CH1)
        if (c === 0) {
          const yt = Math.min(H - 8, Math.max(8, toY(s.level)))
          marker(W, yt, -12)
          ctx.fillText('T', W - 24, yt + 4)
        }
      }
      if (s.cursorsOn) {
        ctx.setLineDash([6, 4])
        ctx.lineWidth = 1
        ctx.strokeStyle = 'rgba(231,232,234,0.85)'
        ctx.beginPath()
        line(s.cur.x1 * DIV, 0, s.cur.x1 * DIV, H)
        line(s.cur.x2 * DIV, 0, s.cur.x2 * DIV, H)
        ctx.stroke()
        ctx.strokeStyle = colors[s.curCh]
        ctx.beginPath()
        line(0, H / 2 - s.cur.y1 * DIV, W, H / 2 - s.cur.y1 * DIV)
        line(0, H / 2 - s.cur.y2 * DIV, W, H / 2 - s.cur.y2 * DIV)
        ctx.stroke()
        ctx.setLineDash([])
      }
      if (now - lastReadout > 250) {
        lastReadout = now
        setReadout({ triggered, m: ms })
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  const set2 = <T,>(arr: [T, T], c: number, v: T): [T, T] => (c === 0 ? [v, arr[1]] : [arr[0], v])

  // Glisser des curseurs : on attrape la barre la plus proche à moins de 22 px écran (zone tactile ≥ 44 px).
  const drag = useRef<CursorKey | null>(null)
  const toDiv = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * 10, y: 4 - ((e.clientY - r.top) / r.height) * 8, pxPerDivX: r.width / 10, pxPerDivY: r.height / 8 }
  }
  const nearest = (p: ReturnType<typeof toDiv>): CursorKey | null => {
    const d: [CursorKey, number][] = [
      ['x1', Math.abs(p.x - cur.x1) * p.pxPerDivX],
      ['x2', Math.abs(p.x - cur.x2) * p.pxPerDivX],
      ['y1', Math.abs(p.y - cur.y1) * p.pxPerDivY],
      ['y2', Math.abs(p.y - cur.y2) * p.pxPerDivY],
    ]
    d.sort((a, b) => a[1] - b[1])
    return d[0][1] <= 22 ? d[0][0] : null
  }
  const onCanvasDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!cursorsOn) return
    drag.current = nearest(toDiv(e))
    if (drag.current)
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* pointeur déjà relâché : glisser sans capture */
      }
  }
  const onCanvasMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!cursorsOn) return
    const p = toDiv(e)
    const k = drag.current ?? nearest(p)
    e.currentTarget.style.cursor = k ? (k[0] === 'x' ? 'ew-resize' : 'ns-resize') : ''
    if (drag.current) {
      const v = drag.current[0] === 'x' ? Math.min(10, Math.max(0, p.x)) : Math.min(4, Math.max(-4, p.y))
      setCur({ ...cur, [drag.current]: v })
    }
  }
  const dT = Math.abs(cur.x2 - cur.x1) * sdiv
  const dV = Math.abs(cur.y2 - cur.y1) * vdiv[curCh]

  return (
    <div className="rounded-card bg-card shadow-sm shadow-black/[0.03] p-3 shadow-lg ring-1 ring-line">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-semibold tracking-wide text-muted">OSCILLOSCOPE · 2 VOIES</span>
        <span className={`font-mono ${readout.triggered ? 'text-ok' : 'text-warn'}`}>{readout.triggered ? "Trig'd" : 'Auto'}</span>
      </div>
      <div className="rounded-lg bg-screen p-2 ring-1 ring-black">
        <canvas
          ref={canvasRef}
          className="block aspect-[5/4] w-full touch-none"
          onPointerDown={onCanvasDown}
          onPointerMove={onCanvasMove}
          onPointerUp={() => (drag.current = null)}
        />
        <div className="mt-1 flex flex-wrap gap-x-4 font-mono text-[11px] text-muted">
          {CH.map((name, c) =>
            fns[c] && on[c] ? (
              <span key={name} style={{ color: `var(--color-${name})` }}>
                CH{c + 1} {formatSI(vdiv[c], units[c])}/div
              </span>
            ) : null,
          )}
          <span>M {formatSI(sdiv, 's')}/div</span>
          <span>T CH1 ↑ {formatSI(level, units[0])}</span>
        </div>
        <div className="mt-1 grid gap-0.5 font-mono text-[11px]">
          {CH.map((name, c) => {
            const m = readout.m[c]
            return m ? (
              <div key={name} className="flex flex-wrap gap-x-4" style={{ color: `var(--color-${name})` }}>
                <span>CH{c + 1}</span>
                <span>Fréq {fmtHz(m.freq)}</span>
                <span>Max {formatSI(m.max, units[c])}</span>
                <span>Min {formatSI(m.min, units[c])}</span>
                <span>Rapp. cycl. {fmtPct(m.duty)}</span>
              </div>
            ) : null
          })}
          {cursorsOn && (
            <div className="flex flex-wrap gap-x-4 text-ink">
              <span>Curseurs</span>
              <span>Δt {formatSI(dT, 's')}</span>
              <span>1/Δt {fmtHz(1 / dT)}</span>
              <span style={{ color: `var(--color-${CH[curCh]})` }}>
                ΔV(CH{curCh + 1}) {formatSI(dV, units[curCh])}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap justify-between gap-3">
        {CH.map((name, c) => (
          <div key={name} className="flex items-end gap-2 rounded-lg bg-card-2 px-2 py-2">
            <div className="flex flex-col gap-1">
              <button
                type="button"
                disabled={!fns[c]}
                onClick={() => setOn(set2(on, c, !on[c]))}
                className="min-h-11 min-w-11 rounded-md px-2 py-1 font-mono text-xs font-semibold ring-1 ring-line disabled:opacity-30"
                style={fns[c] && on[c] ? { background: `var(--color-${name})`, color: '#111' } : undefined}
                aria-pressed={on[c]}
              >
                CH{c + 1}
              </button>
              <button
                type="button"
                onClick={() => setProbeA(set2(probeA, c, !probeA[c]))}
                className="min-h-11 rounded-md px-1 py-0.5 font-mono text-[10px] text-muted ring-1 ring-line hover:text-ink"
                title="Réglage sonde : ×1 (V/div) ou pince ampèremétrique 100 mV/A (A/div)"
              >
                {probeA[c] ? 'Pince A' : 'Sonde ×1'}
              </button>
            </div>
            <Knob label={`${units[c]}/div`} value={vdiv[c]} onChange={(v) => setVdiv(set2(vdiv, c, v))} unit={units[c]} steps={VOLT_STEPS} color={`var(--color-${name})`} />
            <Knob label="Position" value={pos[c]} onChange={(v) => setPos(set2(pos, c, v))} min={-4} max={4} step={0.1} unit="div" format={fmtDiv} color={`var(--color-${name})`} />
          </div>
        ))}
        <div className="flex items-end gap-2 rounded-lg bg-card-2 px-2 py-2">
          <Knob label="s/div" value={sdiv} onChange={setSdiv} unit="s" steps={TIME_STEPS} />
          <Knob label="Niveau trig." value={level} onChange={setLevel} min={-4 * vdiv[0]} max={4 * vdiv[0]} step={vdiv[0] / 10} unit={units[0]} />
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-card-2 px-2 py-2 text-xs">
          <button
            type="button"
            onClick={() => setCursorsOn(!cursorsOn)}
            aria-pressed={cursorsOn}
            className={`min-h-11 rounded-md px-3 py-1 font-semibold ring-1 ring-line ${cursorsOn ? 'bg-accent text-on-accent' : ''}`}
          >
            Curseurs
          </button>
          {CH.map((name, c) => (
            <button
              key={name}
              type="button"
              disabled={!cursorsOn}
              onClick={() => setCurCh(c as 0 | 1)}
              aria-pressed={curCh === c}
              className="min-h-11 rounded-md px-3 py-1 font-mono ring-1 ring-line disabled:opacity-30"
              style={cursorsOn && curCh === c ? { background: `var(--color-${name})`, color: '#111' } : undefined}
            >
              ΔV CH{c + 1}
            </button>
          ))}
          <span className="text-muted">Glisser les barres sur l’écran</span>
        </div>
      </div>
    </div>
  )
}
