import { useEffect, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import { useExam, wiringAnswer } from '../lib/exam'
import { recordAttempt } from '../lib/progress'
import PowerSwitch from './PowerSwitch'
import { nextTick } from '../lib/scope'
import { checkWiring, type Pair, type WiringResult } from '../lib/wiring'

export type TerminalColor = 'red' | 'black' | 'blue' | 'yellow' | 'brown' | 'green'

export interface Terminal {
  id: string
  label: string
  color: TerminalColor
  x: number
  y: number
}

const HEX: Record<TerminalColor, string> = {
  red: '#e5484d',
  black: '#16181b',
  blue: '#3b82f6',
  yellow: '#facc15',
  brown: '#9a6b3f',
  green: '#22a05a',
}

interface Wire {
  a: string
  b: string
  color: TerminalColor
}

interface WiringBoardProps {
  terminals: Terminal[]
  /** Connexions attendues (paires non orientées) ; ignorées si `assess` est fourni */
  expected?: Pair[]
  width: number
  height: number
  /** Dessin SVG du schéma de platine, placé sous les bornes */
  children?: ReactNode
  /** Notifie la mise sous tension / la coupure */
  onPowerChange?: (on: boolean) => void
  /** Fils autorisés mais non exigés (ex. masses de sondes) */
  optional?: Pair[]
  /** Notifie chaque modification du câblage */
  onWiresChange?: (wires: Pair[]) => void
  /** Contrôles supplémentaires à la vérification (ex. couplage) : messages d'erreur, vide si correct */
  validate?: () => string[]
  /**
   * Vérification sur mesure, à la place de la comparaison à `expected` :
   * `errors` refusent le montage ; `faults` l'acceptent (mise sous tension possible) mais l'essai compte faux.
   */
  assess?: (wires: Pair[]) => { errors: string[]; faults: string[] }
  /** Toute valeur différente invalide la vérification (ex. couplage modifié hors câblage) */
  revision?: string
  /** Identifiant de progression (« Savoir câbler… ») : enregistré à chaque vérification */
  progressId?: string
}

/** Appareil du schéma : boîte blanche ombrée, bandeau de titre, pastille de symbole facultative (V, A…). */
export function Device({ x, y, w, h, title, icon }: { x: number; y: number; w: number; h: number; title: string; icon?: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="10" fill="var(--color-card)" stroke="var(--color-line)" strokeWidth="1.5" filter="url(#wb-shadow)" />
      <path d={`M${x + 10},${y} H${x + w - 10} a10,10 0 0 1 10,10 V${y + 24} H${x} V${y + 10} a10,10 0 0 1 10,-10 z`} fill="var(--color-card-2)" stroke="none" />
      <line x1={x} y1={y + 24} x2={x + w} y2={y + 24} stroke="var(--color-line)" />
      <text x={x + 10} y={y + 16} fontSize="11" fontWeight="600" fill="var(--color-ink)" stroke="none" className="select-none">
        {title}
      </text>
      {icon && (
        <g stroke="none">
          <circle cx={x + w - 14} cy={y + 12} r="8" fill="var(--color-accent)" />
          <text x={x + w - 14} y={y + 15.5} fontSize="10" fontWeight="700" textAnchor="middle" fill="var(--color-on-accent)" className="select-none">
            {icon}
          </text>
        </g>
      )}
    </g>
  )
}

/** Fil pendant : courbe de Bézier qui « tombe » sous les deux bornes. */
function wirePath(p: Terminal, q: Terminal): string {
  const sag = 30 + 0.25 * Math.hypot(q.x - p.x, q.y - p.y)
  return `M${p.x},${p.y} C${p.x},${p.y + sag} ${q.x},${q.y + sag} ${q.x},${q.y}`
}

/** Platine de câblage par clic + « Faire vérifier » + interrupteur de mise sous tension. */
export default function WiringBoard({ terminals, expected = [], assess, width, height, children, onPowerChange, optional, onWiresChange, validate, revision, progressId }: WiringBoardProps) {
  const [wires, setWires] = useState<Wire[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)
  const [verdict, setVerdict] = useState<(WiringResult & { faulty?: boolean }) | null>(null)
  const [powered, setPowered] = useState(false)
  // Courant dans les fils : décalage des tirets piloté à 30 images/s (une animation CSS ferait tourner
  // tout le rendu du navigateur à la fréquence de l'écran). Même vitesse : 24 px en 0,9 s.
  const svgRef = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (!powered || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const svg = svgRef.current!
    let id = 0
    const tick = () => {
      svg.style.setProperty('--flow', `${(-24 * (performance.now() % 900)) / 900}`)
      id = window.setTimeout(tick, nextTick())
    }
    tick()
    return () => clearTimeout(id)
  }, [powered])
  const [alert, setAlert] = useState<string | null>(null)

  const exam = useExam()
  const [prevRevision, setPrevRevision] = useState(revision)
  if (revision !== prevRevision) {
    setPrevRevision(revision)
    setVerdict(null)
  }

  useEffect(() => {
    if (selected === null) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSelected(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected])

  const byId = new Map(terminals.map((t) => [t.id, t]))
  const validated = verdict?.ok === true

  const setPower = (on: boolean) => {
    setPowered(on)
    onPowerChange?.(on)
  }

  /** Toute modification invalide la vérification et coupe l'alimentation si elle était présente. */
  const modify = (next: Wire[]) => {
    setWires(next)
    onWiresChange?.(next.map((w) => [w.a, w.b] as const))
    setVerdict(null)
    if (powered) {
      exam.penalize('live', 'Câblage modifié sous tension')
      setPower(false)
      setAlert('Câblage modifié sous tension : alimentation coupée. Faites vérifier le montage avant de remettre sous tension.')
    }
  }

  const clickTerminal = (id: string) => {
    if (selected === null) return setSelected(id)
    setSelected(null)
    if (selected === id) return
    const exists = wires.some((w) => (w.a === selected && w.b === id) || (w.a === id && w.b === selected))
    if (!exists) modify([...wires, { a: selected, b: id, color: byId.get(selected)!.color }])
  }

  const toSvg = (e: MouseEvent<SVGSVGElement> | PointerEvent<SVGSVGElement>) => {
    const m = e.currentTarget.getScreenCTM()
    return m ? new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()) : null
  }

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    if (selected === null) return
    const p = toSvg(e)
    if (p) setCursor({ x: p.x, y: p.y })
  }

  /**
   * Tap/clic : la borne la plus proche dans un rayon d'au moins 22 px écran (zone tactile ≥ 44 px),
   * sinon le fil touché. Un seul gestionnaire évite que des zones voisines se recouvrent.
   */
  const onTap = (e: MouseEvent<SVGSVGElement>) => {
    const p = toSvg(e)
    if (!p) return
    const scale = e.currentTarget.getBoundingClientRect().width / width
    const hit = Math.max(14, 22 / scale)
    let best: Terminal | null = null
    let bestD = hit
    for (const t of terminals) {
      const d = Math.hypot(t.x - p.x, t.y - p.y)
      if (d <= bestD) [best, bestD] = [t, d]
    }
    if (best) return clickTerminal(best.id)
    const w = (e.target as Element).closest('[data-wire]')?.getAttribute('data-wire')
    if (w !== null && w !== undefined) modify(wires.filter((_, k) => k !== Number(w)))
  }

  const check = () => {
    const labels = Object.fromEntries(terminals.map((t) => [t.id, t.label]))
    const pairs = wires.map((w) => [w.a, w.b] as const)
    const r = assess ? assess(pairs) : { ...checkWiring(pairs, expected, labels, optional), faults: [] }
    const errors = [...r.errors, ...(validate?.() ?? [])]
    const faulty = errors.length === 0 && r.faults.length > 0
    const correct = errors.length === 0 && !faulty
    if (!correct) exam.penalize('check', faulty ? 'Câblage accepté mais non conforme' : 'Vérification de câblage refusée')
    if (progressId) {
      recordAttempt(progressId, correct)
      // Examen : la ligne « Câblage » est notée selon l'essai qui valide le montage (un montage non conforme compte faux)
      const answer = exam.active ? wiringAnswer(progressId, exam.answerOf(progressId), correct) : null
      if (answer) exam.record(answer)
    }
    setVerdict({ ok: errors.length === 0, errors, faulty })
  }

  const from = selected === null ? undefined : byId.get(selected)
  const plugged = new Set(wires.flatMap((w) => [w.a, w.b]))

  return (
    <div className={`rounded-card bg-card shadow-sm shadow-black/[0.03] p-3 ring-1 transition ${powered ? 'ring-2 ring-err/40' : 'ring-line'}`}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full touch-manipulation rounded-lg bg-card-2"
        onPointerMove={onMove}
        onPointerLeave={() => setCursor(null)}
        onClick={onTap}
      >
        <defs>
          <pattern id="wb-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="10" cy="10" r="0.9" fill="var(--color-muted)" opacity="0.25" />
          </pattern>
          <filter id="wb-shadow" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#1e2a22" floodOpacity="0.12" />
          </filter>
          <radialGradient id="wb-metal" cx="35%" cy="35%" r="70%">
            <stop offset="0" stopColor="#f4f6f3" />
            <stop offset="1" stopColor="#9aa59c" />
          </radialGradient>
        </defs>
        <rect width={width} height={height} fill="url(#wb-grid)" />
        <g stroke="var(--color-muted)" strokeWidth="1" fill="none">
          {children}
        </g>
        {wires.map((w, k) => {
          const p = byId.get(w.a)!
          const q = byId.get(w.b)!
          const d = wirePath(p, q)
          return (
            <g key={`${w.a}|${w.b}`} className="group cursor-pointer" data-wire={k}>
              <title>{`${p.label} — ${q.label} (clic pour retirer)`}</title>
              <path d={d} stroke="transparent" strokeWidth="20" fill="none" />
              <path d={d} stroke="rgba(0,0,0,0.15)" strokeWidth="6" fill="none" transform="translate(0 2)" />
              <path d={d} stroke={HEX[w.color]} strokeWidth="4" fill="none" strokeLinecap="round" className="transition-[stroke-width] group-hover:[stroke-width:6]" />
              {powered && <path d={d} stroke="white" strokeOpacity="0.6" strokeWidth="1.5" strokeDasharray="2 10" fill="none" className="wire-flow" />}
            </g>
          )
        })}
        {from && cursor && (
          <line x1={from.x} y1={from.y} x2={cursor.x} y2={cursor.y} stroke={HEX[from.color]} strokeWidth="2.5" strokeDasharray="6 4" strokeLinecap="round" pointerEvents="none" />
        )}
        {terminals.map((t) => {
          const w = t.label.length * 6.2 + 10
          return (
            <g key={t.id} className="group cursor-pointer" data-terminal={t.id}>
              <title>{t.label}</title>
              <rect x={t.x - w / 2} y={t.y - 29} width={w} height="15" rx="7.5" fill="var(--color-card)" stroke="var(--color-line)" opacity="0.92" />
              <text x={t.x} y={t.y - 18} textAnchor="middle" fontSize="11" fontWeight="500" fill="var(--color-ink)" className="font-sans select-none">
                {t.label}
              </text>
              <circle cx={t.x} cy={t.y} r="16" fill="var(--color-accent)" opacity="0" className="transition-opacity group-hover:opacity-15" />
              {selected === t.id && <circle cx={t.x} cy={t.y} r="15" fill="none" stroke="var(--color-accent)" strokeWidth="2.5" className="animate-pulse" />}
              <circle cx={t.x} cy={t.y} r="11.5" fill="url(#wb-metal)" stroke="#7d887f" strokeWidth="1" />
              <circle cx={t.x} cy={t.y} r="8" fill={HEX[t.color]} stroke="rgba(0,0,0,0.35)" strokeWidth="1" />
              <circle cx={t.x} cy={t.y} r={plugged.has(t.id) ? 4.5 : 3} fill={plugged.has(t.id) ? '#d4d8d2' : '#0c0d0e'} stroke={plugged.has(t.id) ? '#555' : 'none'} />
            </g>
          )
        })}
      </svg>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-card-2 px-3 py-1.5 text-xs text-muted" aria-live="polite">
        {from ? (
          <span className="text-ink">
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: HEX[from.color] }} />
            <b>{from.label}</b> sélectionnée : cliquez la borne d’arrivée (Échap pour annuler).
          </span>
        ) : (
          <span>① Cliquez une borne, ② puis une autre pour poser un fil. Cliquez un fil pour le retirer.</span>
        )}
        <span className="ml-auto font-medium">
          {wires.length} fil{wires.length > 1 ? 's' : ''} posé{wires.length > 1 ? 's' : ''}
        </span>
        <button type="button" onClick={() => modify([])} disabled={wires.length === 0} className="underline disabled:no-underline disabled:opacity-40">
          Tout retirer
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={check}
          className="min-h-11 rounded-card bg-accent px-4 py-2 text-sm font-semibold text-on-accent hover:brightness-110"
        >
          Faire vérifier
        </button>
        <PowerSwitch
          on={powered}
          onToggle={setPower}
          disabled={!validated}
          disabledReason="Faites vérifier le câblage avant la mise sous tension"
        />
      </div>

      {verdict && (
        <div
          className={`mt-3 rounded-lg px-3 py-2 text-sm ring-1 ${verdict.faulty ? 'bg-warn/10 text-warn ring-warn/30' : verdict.ok ? 'bg-ok/10 text-ok ring-ok/30' : 'bg-err/10 text-err ring-err/30'}`}
          role="status"
        >
          {verdict.faulty
            ? 'Montage accepté mais non conforme : cet essai compte faux. Mettez sous tension pour observer le moteur, puis corrigez hors tension et refaites vérifier.'
            : verdict.ok
              ? 'Câblage correct : vous pouvez mettre sous tension.'
              : 'Câblage refusé :'}
          {!verdict.ok && (
            <ul className="mt-1 list-disc pl-5">
              {verdict.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {alert && (
        <div className="mt-3 flex items-start gap-3 rounded-lg bg-warn/10 px-3 py-2 text-sm text-warn ring-1 ring-warn/30" role="alert">
          <span className="flex-1">⚠ {alert}</span>
          <button type="button" onClick={() => setAlert(null)} className="text-xs underline">
            OK
          </button>
        </div>
      )}
    </div>
  )
}
