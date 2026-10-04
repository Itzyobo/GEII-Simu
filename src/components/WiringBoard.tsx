import { useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import { useExam, wiringAnswer } from '../lib/exam'
import { recordAttempt } from '../lib/progress'
import PowerSwitch from './PowerSwitch'
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
  /** Connexions attendues (paires non orientées) */
  expected: Pair[]
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
  /** Toute valeur différente invalide la vérification (ex. couplage modifié hors câblage) */
  revision?: string
  /** Identifiant de progression (« Savoir câbler… ») : enregistré à chaque vérification */
  progressId?: string
}

/** Fil pendant : courbe de Bézier qui « tombe » sous les deux bornes. */
function wirePath(p: Terminal, q: Terminal): string {
  const sag = 30 + 0.25 * Math.hypot(q.x - p.x, q.y - p.y)
  return `M${p.x},${p.y} C${p.x},${p.y + sag} ${q.x},${q.y + sag} ${q.x},${q.y}`
}

/** Platine de câblage par clic + « Faire vérifier » + interrupteur de mise sous tension. */
export default function WiringBoard({ terminals, expected, width, height, children, onPowerChange, optional, onWiresChange, validate, revision, progressId }: WiringBoardProps) {
  const [wires, setWires] = useState<Wire[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)
  const [verdict, setVerdict] = useState<WiringResult | null>(null)
  const [powered, setPowered] = useState(false)
  const [alert, setAlert] = useState<string | null>(null)

  const exam = useExam()
  const [prevRevision, setPrevRevision] = useState(revision)
  if (revision !== prevRevision) {
    setPrevRevision(revision)
    setVerdict(null)
  }

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
    const r = checkWiring(wires.map((w) => [w.a, w.b] as const), expected, labels, optional)
    const errors = [...r.errors, ...(validate?.() ?? [])]
    if (errors.length) exam.penalize('check', 'Vérification de câblage refusée')
    if (progressId) {
      recordAttempt(progressId, errors.length === 0)
      // Examen : la ligne « Câblage » est notée selon l'essai qui valide le montage
      const answer = exam.active ? wiringAnswer(progressId, exam.answerOf(progressId), errors.length === 0) : null
      if (answer) exam.record(answer)
    }
    setVerdict({ ok: errors.length === 0, errors })
  }

  const from = selected === null ? undefined : byId.get(selected)

  return (
    <div className="rounded-card bg-card p-3 ring-1 ring-line">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full touch-manipulation rounded-lg bg-[#202327]"
        onPointerMove={onMove}
        onPointerLeave={() => setCursor(null)}
        onClick={onTap}
      >
        <g stroke="var(--color-muted)" strokeWidth="1" fill="none">
          {children}
        </g>
        {wires.map((w, k) => {
          const p = byId.get(w.a)!
          const q = byId.get(w.b)!
          const d = wirePath(p, q)
          return (
            <g key={`${w.a}|${w.b}`} className="cursor-pointer" data-wire={k}>
              <title>{`${p.label} — ${q.label} (clic pour retirer)`}</title>
              <path d={d} stroke="transparent" strokeWidth="20" fill="none" />
              <path d={d} stroke="rgba(255,255,255,0.25)" strokeWidth="5" fill="none" />
              <path d={d} stroke={HEX[w.color]} strokeWidth="3" fill="none" strokeLinecap="round" />
            </g>
          )
        })}
        {from && cursor && (
          <line x1={from.x} y1={from.y} x2={cursor.x} y2={cursor.y} stroke={HEX[from.color]} strokeWidth="2" strokeDasharray="5 4" pointerEvents="none" />
        )}
        {terminals.map((t) => (
          <g key={t.id} className="cursor-pointer" data-terminal={t.id}>
            <text x={t.x} y={t.y - 15} textAnchor="middle" fontSize="11" fill="var(--color-ink)" className="font-sans select-none">
              {t.label}
            </text>
            {selected === t.id && <circle cx={t.x} cy={t.y} r="13" fill="none" stroke="var(--color-accent)" strokeWidth="2" />}
            <circle cx={t.x} cy={t.y} r="9" fill={HEX[t.color]} stroke="#8a9099" strokeWidth="1.5" />
            <circle cx={t.x} cy={t.y} r="3" fill="#0c0d0e" />
          </g>
        ))}
      </svg>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={check}
          className="min-h-11 rounded-card bg-accent px-4 py-2 text-sm font-semibold text-[#1a1306] hover:brightness-110"
        >
          Faire vérifier
        </button>
        <PowerSwitch
          on={powered}
          onToggle={setPower}
          disabled={!validated}
          disabledReason="Faites vérifier le câblage avant la mise sous tension"
        />
        <span className="text-xs text-muted">Clic sur une borne puis une autre pour poser un fil, clic sur un fil pour le retirer.</span>
      </div>

      {verdict && (
        <div className={`mt-3 rounded-lg px-3 py-2 text-sm ring-1 ${verdict.ok ? 'bg-ok/10 text-ok ring-ok/30' : 'bg-err/10 text-err ring-err/30'}`} role="status">
          {verdict.ok ? 'Câblage correct : vous pouvez mettre sous tension.' : 'Câblage refusé :'}
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
        <div className="mt-3 flex items-start gap-3 rounded-lg bg-accent/15 px-3 py-2 text-sm text-accent ring-1 ring-accent/40" role="alert">
          <span className="flex-1">⚠ {alert}</span>
          <button type="button" onClick={() => setAlert(null)} className="text-xs underline">
            OK
          </button>
        </div>
      )}
    </div>
  )
}
