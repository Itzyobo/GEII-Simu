/**
 * Oscilloscope 2 voies 100 MHz (type DSOX1102A, sans logo) : écran SVG 10 × 8 div, bandeau du haut,
 * touches de fonction à droite et molette, façade (vertical, horizontal, déclenchement) dessous.
 * Toute la physique est dans models/scope.ts ; ce composant ne fait que régler et dessiner.
 */
import { useEffect, useState, type PointerEvent, type ReactNode } from 'react'
import { formatSI } from '../../lib/format'
import { REF } from '../data/reference'
import { DIV_X, DIV_Y, scopeView, type Ch, type ProbeInput, type ScopeSettings } from '../models/scope'
import UnverifiedBadge from './UnverifiedBadge'

const COLORS = ['#f5d90a', '#3ee07a', '#c084fc'] as const
const NAMES = ['1', '2', 'M'] as const
const PX = 50
const W = DIV_X * PX
const H = DIV_Y * PX

/** Suite 1-2-5 entre deux valeurs, comme les calibres d'un vrai oscilloscope. */
function seq125(from: number, to: number): number[] {
  const out: number[] = []
  for (let d = Math.floor(Math.log10(from)); d <= Math.ceil(Math.log10(to)); d++)
    for (const m of [1, 2, 5]) {
      const v = Number((m * 10 ** d).toPrecision(3))
      if (v >= from * 0.999 && v <= to * 1.001) out.push(v)
    }
  return out
}
const VOLTS = seq125(5e-3, 50)
const TIMES = seq125(1e-6, 50e-3)
const stepIn = (list: number[], v: number, dir: 1 | -1) => {
  const i = list.findIndex((x) => x >= v * 0.999)
  return list[Math.min(list.length - 1, Math.max(0, (i < 0 ? list.length - 1 : i) + dir))] ?? v
}
const fr = (v: number, unit: string) => formatSI(v, unit, 4)

type Softkey = 'Math' | 'Function' | 'Operator' | 'Source 1' | 'Source 2' | 'Scale' | 'Offset' | 'Measure' | 'Cursors'
const SOFTKEYS: Softkey[] = ['Math', 'Function', 'Operator', 'Source 1', 'Source 2', 'Scale', 'Offset', 'Measure', 'Cursors']
type CursorKey = 'x1' | 'x2' | 'y1' | 'y2'

interface Props {
  inputs: [ProbeInput, ProbeInput]
  initial: ScopeSettings
}

export default function Oscilloscope({ inputs, initial }: Props) {
  const [st, setSt] = useState<ScopeSettings>(initial)
  const [softkey, setSoftkey] = useState<Softkey>('Measure')
  const [measureSrc, setMeasureSrc] = useState<0 | 1 | 2>(0)
  const [cursorKey, setCursorKey] = useState<CursorKey>('x1')
  const [drag, setDrag] = useState<CursorKey | null>(null)
  const [tick, setTick] = useState(0)

  // Acquisitions successives : nouveau tirage du bruit, défilement en Auto sans déclenchement
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), REF.scopeRafraichissement.value * 1000)
    return () => window.clearInterval(id)
  }, [])

  const span = DIV_X * st.tdiv
  const view = scopeView(inputs, st, { seed: tick + 1, phase: tick * span * REF.scopeDefilement.value })
  const set = (patch: Partial<ScopeSettings>) => setSt((s) => ({ ...s, ...patch }))
  const setCh = (c: Ch, patch: Partial<ScopeSettings['ch'][number]>) =>
    setSt((s) => {
      const ch = [...s.ch] as ScopeSettings['ch']
      ch[c] = { ...ch[c], ...patch }
      return { ...s, ch }
    })

  /** Échelle verticale de la source des curseurs Y et des mesures */
  const ySrc = measureSrc === 2 ? st.math : st.ch[measureSrc]
  const toY = (v: number) => H / 2 - ((v - ySrc.offset) / ySrc.vdiv) * PX
  const fromY = (py: number) => ySrc.offset + ((H / 2 - py) / PX) * ySrc.vdiv

  /** Molette : agit sur le paramètre de la touche active */
  const turn = (dir: 1 | -1) => {
    if (softkey === 'Scale') set({ math: { ...st.math, vdiv: stepIn(VOLTS, st.math.vdiv, dir) } })
    else if (softkey === 'Offset') set({ math: { ...st.math, offset: st.math.offset + dir * st.math.vdiv * 0.1 } })
    else if (softkey === 'Cursors') {
      const c = { ...st.cursors }
      if (cursorKey === 'x1' || cursorKey === 'x2') c[cursorKey] = Math.min(span, Math.max(0, c[cursorKey] + (dir * span) / 250))
      else c[cursorKey] += dir * ySrc.vdiv * 0.05
      set({ cursors: c })
    }
  }
  const press = (k: Softkey) => {
    setSoftkey(k)
    if (k === 'Math') set({ math: { ...st.math, on: !st.math.on } })
    if (k === 'Source 1') set({ math: { ...st.math, src1: st.math.src1 === 0 ? 1 : 0 } })
    if (k === 'Source 2') set({ math: { ...st.math, src2: st.math.src2 === 0 ? 1 : 0 } })
    if (k === 'Measure' && softkey === 'Measure') setMeasureSrc((m) => ((m + 1) % 3) as 0 | 1 | 2)
    if (k === 'Cursors') {
      if (!st.cursors.on) set({ cursors: { ...st.cursors, on: true } })
      else if (softkey === 'Cursors') setCursorKey((c) => (({ x1: 'x2', x2: 'y1', y1: 'y2', y2: 'x1' }) as const)[c])
    }
  }
  const softkeyHint: Record<Softkey, string> = {
    Math: st.math.on ? 'Math affichée' : 'Math masquée',
    Function: 'f(t) = Source 1 − Source 2',
    Operator: 'Opérateur : − (seule opération du TP)',
    'Source 1': `Source 1 : Ch${st.math.src1 + 1}`,
    'Source 2': `Source 2 : Ch${st.math.src2 + 1}`,
    Scale: `Échelle Math : ${fr(st.math.vdiv, 'V')}/div (molette)`,
    Offset: `Décalage Math : ${fr(st.math.offset, 'V')} (molette)`,
    Measure: `Mesures sur ${NAMES[measureSrc] === 'M' ? 'Math' : `Ch${measureSrc + 1}`} (rappuyer pour changer)`,
    Cursors: st.cursors.on ? `Curseur ${cursorKey.toUpperCase()} (molette, glisser à l’écran ; rappuyer pour changer)` : 'Curseurs masqués',
  }

  /* ── Glisser les curseurs à l'écran ── */
  const svgPoint = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }
  }
  const onDown = (e: PointerEvent<SVGSVGElement>) => {
    if (!st.cursors.on) return
    const p = svgPoint(e)
    const c = st.cursors
    const d: [CursorKey, number][] = [
      ['x1', Math.abs(p.x - (c.x1 / span) * W)],
      ['x2', Math.abs(p.x - (c.x2 / span) * W)],
      ['y1', Math.abs(p.y - toY(c.y1))],
      ['y2', Math.abs(p.y - toY(c.y2))],
    ]
    const [key, dist] = d.reduce((a, b) => (b[1] < a[1] ? b : a))
    if (dist > 15) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag(key)
    setCursorKey(key)
    setSoftkey('Cursors')
  }
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!drag) return
    const p = svgPoint(e)
    const c = { ...st.cursors }
    if (drag === 'x1' || drag === 'x2') c[drag] = Math.min(span, Math.max(0, (p.x / W) * span))
    else c[drag] = fromY(Math.min(H, Math.max(0, p.y)))
    set({ cursors: c })
  }

  const trigCh = st.ch[st.trigger.source]
  const trigY = H / 2 - ((st.trigger.level - trigCh.offset) / trigCh.vdiv) * PX
  const trigX = W / 2 - (st.position / span) * W
  const m = view.measures[measureSrc]
  const statusColor = view.status === "Trig'd" ? 'text-green-400' : view.status === 'Auto' ? 'text-amber-300' : 'text-red-400'

  return (
    <div className="rounded-2xl bg-[#d9dcdf] p-3 shadow-lg ring-1 ring-black/20 select-none">
      <div className="mb-2 flex items-baseline justify-between text-[11px] font-semibold text-neutral-600">
        <span>OSCILLOSCOPE NUMÉRIQUE 2 VOIES · 100 MHz · 2 Géch/s</span>
        <span className="font-normal">type DSOX1102A, sans marque</span>
      </div>
      <div className="flex gap-2">
        <div className="min-w-0 flex-1 rounded-md bg-black p-1.5 font-mono text-[11px] text-neutral-200">
          {/* Bandeau du haut : calibres, base de temps, déclenchement */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-1 pb-1">
            {[0, 1].map((c) => (
              <span key={c} style={{ color: COLORS[c] }} className={st.ch[c as Ch].on ? '' : 'opacity-40'}>
                {c + 1} {fr(st.ch[c as Ch].vdiv, 'V')}/
              </span>
            ))}
            {st.math.on && <span style={{ color: COLORS[2] }}>M {fr(st.math.vdiv, 'V')}/</span>}
            <span className="ml-auto">{fr(st.tdiv, 's')}/</span>
            <span>
              {st.trigger.slope === 'rising' ? '↑' : '↓'} {st.trigger.source + 1} {fr(st.trigger.level, 'V')}
            </span>
            <span>{st.mode === 'normal' ? 'Normal' : 'Auto'}</span>
            <span className={statusColor}>{view.status === 'Attente' ? 'Attente' : view.status}</span>
          </div>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="block w-full touch-none"
            role="img"
            aria-label="Écran de l'oscilloscope"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={() => setDrag(null)}
          >
            <defs>
              <clipPath id="scr">
                <rect width={W} height={H} />
              </clipPath>
            </defs>
            <rect width={W} height={H} fill="#000" />
            {Array.from({ length: DIV_X + 1 }, (_, i) => (
              <line key={`v${i}`} x1={i * PX} x2={i * PX} y1={0} y2={H} stroke="#3a3f44" strokeDasharray={i % DIV_X ? '1 4' : undefined} />
            ))}
            {Array.from({ length: DIV_Y + 1 }, (_, j) => (
              <line key={`h${j}`} x1={0} x2={W} y1={j * PX} y2={j * PX} stroke="#3a3f44" strokeDasharray={j % DIV_Y ? '1 4' : undefined} />
            ))}
            {Array.from({ length: DIV_X * 5 + 1 }, (_, k) => (
              <line key={`tx${k}`} x1={k * 10} x2={k * 10} y1={H / 2 - 3} y2={H / 2 + 3} stroke="#5a6066" />
            ))}
            {Array.from({ length: DIV_Y * 5 + 1 }, (_, k) => (
              <line key={`ty${k}`} x1={W / 2 - 3} x2={W / 2 + 3} y1={k * 10} y2={k * 10} stroke="#5a6066" />
            ))}
            <g clipPath="url(#scr)">
              {view.traces.map(
                (tr, k) =>
                  tr && (
                    <polyline
                      key={k}
                      fill="none"
                      stroke={COLORS[k]}
                      strokeWidth={1.6}
                      strokeLinejoin="round"
                      points={tr.map(([x, y]) => `${(x * PX).toFixed(2)},${(H / 2 - y * PX).toFixed(2)}`).join(' ')}
                    />
                  ),
              )}
              {st.cursors.on && (
                <g stroke="#e5e7eb" strokeDasharray="6 4" strokeWidth={1}>
                  {(['x1', 'x2'] as const).map((k) => (
                    <line key={k} x1={(st.cursors[k] / span) * W} x2={(st.cursors[k] / span) * W} y1={0} y2={H} strokeWidth={cursorKey === k ? 2 : 1} />
                  ))}
                  {(['y1', 'y2'] as const).map((k) => (
                    <line key={k} x1={0} x2={W} y1={toY(st.cursors[k])} y2={toY(st.cursors[k])} strokeWidth={cursorKey === k ? 2 : 1} />
                  ))}
                </g>
              )}
            </g>
            {/* Repères : masse des voies (gauche), niveau de déclenchement (droite), instant de déclenchement (haut) */}
            {[0, 1].map((c) => {
              const ch = st.ch[c as Ch]
              if (!ch.on) return null
              const y = Math.min(H - 6, Math.max(6, H / 2 + (ch.offset / ch.vdiv) * PX))
              return <path key={c} d={`M0 ${y - 6} L9 ${y} L0 ${y + 6} Z`} fill={COLORS[c]} />
            })}
            <path d={`M${W} ${Math.min(H - 6, Math.max(6, trigY)) - 6} L${W - 9} ${Math.min(H - 6, Math.max(6, trigY))} L${W} ${Math.min(H - 6, Math.max(6, trigY)) + 6} Z`} fill="#fb923c" />
            {trigX >= 0 && trigX <= W && <path d={`M${trigX - 6} 0 L${trigX} 9 L${trigX + 6} 0 Z`} fill="#fb923c" />}
            {view.status === 'Attente' && (
              <text x={W / 2} y={H / 2 - 12} textAnchor="middle" fill="#f87171" fontSize={16}>
                En attente de déclenchement
              </text>
            )}
          </svg>
          {/* Mesures et curseurs */}
          <div className="grid grid-cols-1 gap-x-4 px-1 pt-1 sm:grid-cols-2">
            <div style={{ color: COLORS[measureSrc] }}>
              Freq({NAMES[measureSrc]}) : {m && Number.isFinite(m.freq) ? fr(m.freq, 'Hz') : '—'}
              <br />
              Max({NAMES[measureSrc]}) : {m ? fr(m.max, 'V') : '—'}
              <br />
              Crête à crête({NAMES[measureSrc]}) : {m ? fr(m.pkpk, 'V') : '—'}
            </div>
            {st.cursors.on && (
              <div>
                ΔX : {fr(view.cursors.dt, 's')}
                <br />
                1/ΔX : {Number.isFinite(view.cursors.invDt) ? fr(view.cursors.invDt, 'Hz') : '—'}
                <br />
                ΔY({NAMES[measureSrc]}) : {fr(view.cursors.dv, 'V')}
              </div>
            )}
          </div>
          <p className="px-1 pt-1 text-neutral-400">{softkeyHint[softkey]}</p>
        </div>

        {/* Colonne de touches de fonction + molette */}
        <div className="flex w-20 shrink-0 flex-col gap-1">
          {SOFTKEYS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => press(k)}
              className={`min-h-8 rounded-sm px-1 text-[11px] leading-tight font-semibold ring-1 ring-black/25 ${softkey === k ? 'bg-neutral-700 text-white' : 'bg-neutral-100 text-neutral-800 hover:bg-white'}`}
            >
              {k}
            </button>
          ))}
          <div className="mt-1 flex gap-1" aria-label="Molette">
            <button type="button" aria-label="Molette, tourner à gauche" onClick={() => turn(-1)} className="h-9 flex-1 rounded-full bg-neutral-800 text-white">
              ⟲
            </button>
            <button type="button" aria-label="Molette, tourner à droite" onClick={() => turn(1)} className="h-9 flex-1 rounded-full bg-neutral-800 text-white">
              ⟳
            </button>
          </div>
        </div>
      </div>

      {(view.floating[0] || view.floating[1]) && (
        <p className="mt-2 text-xs text-amber-800">
          Voie sans pince de masse : trace bruitée et flottante.
          <UnverifiedBadge deps={['sansMasseDerive', 'sansMasseBruit']} />
        </p>
      )}

      {/* Façade */}
      <div className="mt-3 grid gap-2 text-xs text-neutral-800 sm:grid-cols-2">
        {[0, 1].map((n) => {
          const c = n as Ch
          const ch = st.ch[c]
          return (
            <Panel key={c} title={`Voie ${c + 1}`} color={COLORS[c]}>
              <Row label="Affichée">
                <Btn on={ch.on} onClick={() => setCh(c, { on: !ch.on })}>
                  {ch.on ? 'oui' : 'non'}
                </Btn>
              </Row>
              <Row label="V/div">
                <Btn onClick={() => setCh(c, { vdiv: stepIn(VOLTS, ch.vdiv, -1) })}>−</Btn>
                <span className="w-16 text-center font-mono">{fr(ch.vdiv, 'V')}</span>
                <Btn onClick={() => setCh(c, { vdiv: stepIn(VOLTS, ch.vdiv, 1) })}>+</Btn>
              </Row>
              <Row label="Position">
                <Btn onClick={() => setCh(c, { offset: ch.offset + ch.vdiv / 2 })}>▼</Btn>
                <span className="w-16 text-center font-mono">{fr(ch.offset, 'V')}</span>
                <Btn onClick={() => setCh(c, { offset: ch.offset - ch.vdiv / 2 })}>▲</Btn>
              </Row>
              <Row label="Sonde">
                {([1, 10] as const).map((p) => (
                  <Btn key={p} on={ch.probe === p} onClick={() => setCh(c, { probe: p })}>
                    {p}:1
                  </Btn>
                ))}
              </Row>
            </Panel>
          )
        })}
        <Panel title="Horizontal">
          <Row label="s/div">
            <Btn onClick={() => set({ tdiv: stepIn(TIMES, st.tdiv, -1) })}>−</Btn>
            <span className="w-16 text-center font-mono">{fr(st.tdiv, 's')}</span>
            <Btn onClick={() => set({ tdiv: stepIn(TIMES, st.tdiv, 1) })}>+</Btn>
          </Row>
          <Row label="Position">
            <Btn onClick={() => set({ position: st.position + st.tdiv })}>◀</Btn>
            <span className="w-16 text-center font-mono">{fr(st.position, 's')}</span>
            <Btn onClick={() => set({ position: st.position - st.tdiv })}>▶</Btn>
          </Row>
        </Panel>
        <Panel title="Déclenchement">
          <Row label="Source">
            {([0, 1] as const).map((c) => (
              <Btn key={c} on={st.trigger.source === c} onClick={() => set({ trigger: { ...st.trigger, source: c } })}>
                Ch{c + 1}
              </Btn>
            ))}
          </Row>
          <Row label="Front">
            <Btn on={st.trigger.slope === 'rising'} onClick={() => set({ trigger: { ...st.trigger, slope: 'rising' } })}>
              ↑
            </Btn>
            <Btn on={st.trigger.slope === 'falling'} onClick={() => set({ trigger: { ...st.trigger, slope: 'falling' } })}>
              ↓
            </Btn>
          </Row>
          <Row label="Niveau">
            <Btn onClick={() => set({ trigger: { ...st.trigger, level: st.trigger.level - trigCh.vdiv / 5 } })}>−</Btn>
            <span className="w-16 text-center font-mono">{fr(st.trigger.level, 'V')}</span>
            <Btn onClick={() => set({ trigger: { ...st.trigger, level: st.trigger.level + trigCh.vdiv / 5 } })}>+</Btn>
          </Row>
          <Row label="Mode">
            <Btn on={st.mode === 'normal'} onClick={() => set({ mode: 'normal' })}>
              Normal
            </Btn>
            <Btn on={st.mode === 'auto'} onClick={() => set({ mode: 'auto' })}>
              Auto
            </Btn>
          </Row>
        </Panel>
      </div>
    </div>
  )
}

function Panel({ title, color, children }: { title: string; color?: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-md bg-[#c9cdd1] p-2 ring-1 ring-black/10">
      <legend className="flex items-center gap-1.5 px-1 text-[11px] font-bold tracking-wide uppercase">
        {color && <span className="inline-block size-2.5 rounded-full" style={{ background: color }} />}
        {title}
      </legend>
      <div className="space-y-1">{children}</div>
    </fieldset>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1">
      <span className="w-14 shrink-0 text-neutral-600">{label}</span>
      {children}
    </div>
  )
}

function Btn({ on, onClick, children }: { on?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`min-h-8 min-w-8 rounded px-1.5 font-semibold ring-1 ring-black/20 ${on ? 'bg-neutral-800 text-white' : 'bg-neutral-50 hover:bg-white'}`}>
      {children}
    </button>
  )
}
