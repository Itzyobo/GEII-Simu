/**
 * Banc TP1 branchable (réutilisé par le partiel) : paillasse avec le générateur d'impulsions GEII PG-50, l'oscilloscope
 * à face avant, le touret de câble coaxial, le plateau d'accessoires (cordon 1 m, 2 Té, bouchons 50 Ω / 75 Ω /
 * court-circuit), le potentiomètre 0–200 Ω avec sa BNC et le multimètre.
 *
 * On branche soi-même : glisser une fiche vers une BNC (aimantation, quart de tour baïonnette), ou toucher la fiche
 * puis toucher la BNC (doigt, clavier). Débrancher : glisser hors de la BNC, appui long, ou « Débrancher ».
 * Le montage est traduit en modèle physique par src/lib/reseaux/benchTopology.ts ; aucune topologie ne fait planter.
 */
import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type Ref, type CSSProperties, type PointerEvent as RPointerEvent, type ReactNode } from 'react'
import ScopeInstrument from '../../components/ScopeInstrument'
import type { ScopeHandle, ScopeProps } from '../../components/scope/useScope'
import FrontKnob from '../../components/scope/FrontKnob'
import { RES3 } from '../../data/reference'
import { formatSI } from '../../lib/format'
import {
  ALL_FEMALES,
  benchSources,
  canPlug,
  describe,
  ohmmeterReading,
  plugInto,
  unplugDeep,
  NAMES,
  TEES,
  topology,
  type CableEnd,
  type Connections,
  type Female,
  type Male,
  type Plug,
  type TeeId,
  type Topology,
} from '../../lib/reseaux/benchTopology'
import type { Cable, Waveform } from '../../lib/reseaux/coax'

/** Décalage des bras d'un Té par rapport à son pied — px */
const ARM = 26
const RISE = 34
/** Rayon d'aimantation d'une BNC — px */
const SNAP = 48
/** Appui long pour débrancher — ms */
const LONG_PRESS = 550
/** Seuil de glisser (en deçà : simple toucher) — px */
const DRAG_MIN = 6
const PLUGS: Plug[] = ['b50', 'b75', 'cc']
const CABLE_ENDS: CableEnd[] = ['cordon.A', 'cordon.B', 'coax.A', 'coax.B']
const GREEN = '#7dffa8'
const CH1_Y = '#f5d90a'

type Pt = { x: number; y: number }
interface GenState {
  on: boolean
  mode: 'pulse' | 'sine'
  eg: number
  width: number
  period: number
  f: number
}

const n3 = (v: number) => String(Number(v.toPrecision(3))).replace('.', ',')
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Ce que le mode démonstration (LiveLab) peut faire sur le banc : les mêmes gestes que l'utilisateur */
export interface BenchHandle {
  conn(): Connections
  plug(m: Male, f: Female): void
  unplug(m: Male): void
  range(): void
  setConn(c: Connections): void
  gen(): GenState
  setGen(p: Partial<GenState>): void
  potR(): number
  setPotR(r: number): void
  ohmmeter(): number | null
}

export default function CoaxBench({
  cable,
  seed,
  top,
  onTopology,
  apiRef,
  scopeRef,
  annotate,
  annotateVersion,
}: {
  cable: Cable
  seed: number
  top?: ReactNode
  onTopology?: (t: Topology) => void
  apiRef?: Ref<BenchHandle | null>
  scopeRef?: Ref<(ScopeHandle & { setView(v: 'face' | 'compact'): void }) | null>
  annotate?: ScopeProps['annotate']
  annotateVersion?: number
}) {
  const [gen, setGenRaw] = useState<GenState>({ on: true, mode: 'pulse', eg: RES3.genInitial.eg, width: RES3.genInitial.largeur, period: RES3.genInitial.periode, f: RES3.genInitial.f })
  // États à jour sans attendre le rendu : plusieurs gestes enchaînés (démo) ne s'écrasent pas
  const genRef = useRef(gen)
  const setGen = (g: GenState) => {
    genRef.current = g
    setGenRaw(g)
  }
  const [conn, setConnRaw] = useState<Connections>({})
  const connRef = useRef(conn)
  const setConn = (c: Connections) => {
    connRef.current = c
    setConnRaw(c)
  }
  const [history, setHistory] = useState<Connections[]>([])
  const [potR, setPotRRaw] = useState(120)
  const potRef = useRef(potR)
  const setPotR = (r: number) => {
    potRef.current = r
    setPotRRaw(r)
  }
  const [selected, setSelected] = useState<Male | null>(null)
  const [drag, setDrag] = useState<{ male: Male; p: Pt } | null>(null)
  const [snapped, setSnapped] = useState<Male | null>(null)

  const topo = useMemo(() => topology(conn), [conn])
  const onTopo = useRef(onTopology)
  onTopo.current = onTopology
  useEffect(() => onTopo.current?.(topo), [topo])

  const wave = useMemo((): Waveform => (gen.mode === 'pulse' ? { kind: 'pulse', width: Math.min(gen.width, gen.period / 2), period: gen.period } : { kind: 'sine', f: gen.f }), [gen.mode, gen.width, gen.period, gen.f])
  const sources = useMemo(() => benchSources(topo, { on: gen.on, eg: gen.eg, wave }, cable, potR), [topo, gen.on, gen.eg, wave, cable, potR])

  // Ohmmètre : lisible seulement potentiomètre relié à rien, ±0,5 % propre à la valeur réglée
  const ohm = ohmmeterReading(seed, potR, topo.potConnected)

  /* ─────────── Positions des BNC et des points de repos, mesurées dans la paillasse ─────────── */
  const board = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<Record<string, Pt>>({})
  const measure = useCallback(() => {
    const b = board.current
    if (!b) return
    const r0 = b.getBoundingClientRect()
    const out: Record<string, Pt> = {}
    const at = (sel: string, key: string) => {
      const el = b.querySelector(sel)
      const r = el?.getBoundingClientRect()
      if (r && r.width > 0) out[key] = { x: Math.round(r.left + r.width / 2 - r0.left), y: Math.round(r.top + r.height / 2 - r0.top) }
    }
    at('[data-port="gen"]', 'gen')
    at('[data-port="scope-ch1"]', 'ch1')
    at('[data-port="scope-ch2"]', 'ch2')
    at('[data-port="pot"]', 'pot')
    at('[data-port="park1"]', 'park1')
    at('[data-port="park2"]', 'park2')
    for (const k of [...CABLE_ENDS, 'coax-lead-A', 'coax-lead-B']) at(`[data-home="${k}"]`, `home:${k}`)
    setPos((prev) => (JSON.stringify(prev) === JSON.stringify(out) ? prev : out))
  }, [])
  useLayoutEffect(() => {
    measure()
    const ro = new ResizeObserver(measure)
    if (board.current) ro.observe(board.current)
    // La face avant de l'oscilloscope peut changer de mise en page (bascule compacte, panneaux)
    const id = window.setInterval(measure, 400)
    return () => {
      ro.disconnect()
      window.clearInterval(id)
    }
  }, [measure])

  /** Position d'une embase femelle (bras de Té : déduits du point où le Té est monté) */
  const femalePos = (f: Female, depth = 0): Pt | null => {
    if (depth > 3) return null
    if (f === 'gen' || f === 'ch1' || f === 'ch2' || f === 'pot' || f === 'park1' || f === 'park2') return pos[f] ?? null
    const tee = f.slice(0, 4) as TeeId
    const base = conn[tee] ? femalePos(conn[tee]!, depth + 1) : null
    if (!base) return null
    return { x: base.x + (f.endsWith('.a') ? -ARM : ARM), y: base.y - RISE }
  }
  /** Position d'une fiche mâle : sur sa BNC si branchée, sinon à son point de repos (câbles) */
  const malePos = (m: Male): Pt | null => {
    if (drag?.male === m) return drag.p
    const f = conn[m]
    if (f) return femalePos(f)
    return pos[`home:${m}`] ?? null
  }

  /* ─────────── Brancher / débrancher ─────────── */
  const commit = (next: Connections) => {
    const prev = connRef.current
    setHistory((h) => [...h.slice(-19), prev])
    setConn(next)
  }
  // Mêmes fonctions pures que le mode démonstration (plugInto, unplugDeep)
  const plug = (m: Male, f: Female) => {
    const c = connRef.current
    if (!canPlug(c, m, f)) return
    commit(plugInto(c, m, f))
    setSnapped(m)
    window.setTimeout(() => setSnapped(null), 320)
    try {
      navigator.vibrate?.(8)
    } catch {
      /* vibration indisponible */
    }
    setSelected(null)
  }
  const unplug = (m: Male) => {
    const c = connRef.current
    if (c[m]) commit(unplugDeep(c, m))
    setSelected(null)
  }
  useImperativeHandle(apiRef, () => ({
    conn: () => connRef.current,
    plug,
    unplug,
    range: () => commit({}),
    setConn: (c) => commit(c),
    gen: () => genRef.current,
    setGen: (p) => setGen({ ...genRef.current, ...p }),
    potR: () => potRef.current,
    setPotR,
    ohmmeter: () => ohmmeterReading(seed, potRef.current, topology(connRef.current).potConnected),
  }))
  const isOwnArm = (m: Male, f: Female) => (m === 'tee1' || m === 'tee2') && f.startsWith(m)
  const targets = (m: Male): Female[] => ALL_FEMALES.filter((f) => conn[m] !== f && !isOwnArm(m, f) && canPlug(conn, m, f) && femalePos(f) !== null)

  // Glisser au pointeur (souris ou doigt) ; appui long = débrancher ; toucher = sélectionner
  const press = useRef<{ m: Male; start: Pt; moved: boolean; timer: number } | null>(null)
  const boardPt = (e: { clientX: number; clientY: number }): Pt => {
    const r = board.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const onItemDown = (m: Male) => (e: RPointerEvent<HTMLElement>) => {
    const start = boardPt(e)
    const timer = window.setTimeout(() => {
      if (press.current && !press.current.moved && conn[m]) {
        press.current = null
        setDrag(null)
        unplug(m)
      }
    }, LONG_PRESS)
    press.current = { m, start, moved: false, timer }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* pointeur déjà relâché */
    }
  }
  const onItemMove = (e: RPointerEvent<HTMLElement>) => {
    const p = press.current
    if (!p) return
    const q = boardPt(e)
    if (!p.moved && Math.hypot(q.x - p.start.x, q.y - p.start.y) < DRAG_MIN) return
    p.moved = true
    window.clearTimeout(p.timer)
    setDrag({ male: p.m, p: q })
  }
  const onItemUp = (e: RPointerEvent<HTMLElement>) => {
    const p = press.current
    press.current = null
    if (!p) return
    window.clearTimeout(p.timer)
    if (!p.moved) {
      setSelected((s) => (s === p.m ? null : p.m))
      setDrag(null)
      return
    }
    const q = boardPt(e)
    setDrag(null)
    let best: Female | null = null
    let bestD = SNAP
    for (const f of targets(p.m)) {
      const fp = femalePos(f)!
      const d = Math.hypot(fp.x - q.x, fp.y - q.y)
      if (d < bestD) [best, bestD] = [f, d]
    }
    if (best) plug(p.m, best)
    else unplug(p.m)
  }
  const itemHandlers = (m: Male) => ({
    onPointerDown: onItemDown(m),
    onPointerMove: onItemMove,
    onPointerUp: onItemUp,
    onPointerCancel: () => {
      press.current = null
      setDrag(null)
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setSelected((s) => (s === m ? null : m))
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && conn[m]) unplug(m)
    },
  })

  const active = drag?.male ?? selected

  /* ─────────── Rendu ─────────── */
  const cablePath = (a: Pt, b: Pt) => {
    const sag = Math.min(140, Math.hypot(b.x - a.x, b.y - a.y) * 0.3) + 30
    return `M${a.x} ${a.y} C ${a.x} ${a.y + sag}, ${b.x} ${b.y + sag}, ${b.x} ${b.y}`
  }
  const leadA = pos['home:coax-lead-A'] ?? null
  const leadB = pos['home:coax-lead-B'] ?? null
  const cA = malePos('coax.A')
  const cB = malePos('coax.B')
  const dA = malePos('cordon.A')
  const dB = malePos('cordon.B')
  const paths: { d: string; thick: number }[] = []
  if (leadA && cA) paths.push({ d: cablePath(leadA, cA), thick: 9 })
  if (leadB && cB) paths.push({ d: cablePath(leadB, cB), thick: 9 })
  if (dA && dB) paths.push({ d: cablePath(dA, dB), thick: 7 })

  const item = (m: Male, p: Pt, w: number, h: number, dx: number, dy: number, label: string, shape: ReactNode) => (
    <button
      key={m}
      type="button"
      className={`bench-item pointer-events-auto absolute touch-none ${snapped === m ? 'is-snap' : ''} ${selected === m ? 'is-selected' : ''} ${drag?.male === m ? 'is-drag' : ''}`}
      style={{ left: p.x - dx, top: p.y - dy, width: w, height: h }}
      aria-label={label}
      aria-pressed={selected === m}
      data-demo={`male-${m}`}
      {...itemHandlers(m)}
    >
      {shape}
    </button>
  )

  return (
    <div className="mt-6">
      <div ref={board} className="bench-board relative rounded-3xl p-3 sm:p-5">
        <style>{BENCH_CSS}</style>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.5fr)]">
          <div className="grid content-start gap-4">
            {top}
            <Generator gen={gen} setGen={setGen} />
            <Accessories
              cable={cable}
              conn={conn}
              potR={potR}
              setPotR={setPotR}
              ohm={ohm}
              selected={selected}
              itemHandlers={itemHandlers}
              onRange={() => commit({})}
              onUndo={() => {
                const prev = history.at(-1)
                if (prev) {
                  setConn(prev)
                  setHistory((h) => h.slice(0, -1))
                }
              }}
              canUndo={history.length > 0}
            />
          </div>
          <ScopeInstrument sources={sources} apiRef={scopeRef} annotate={annotate} annotateVersion={annotateVersion} />
        </div>

        {/* Câbles, Té et bouchons montés, cibles d'aimantation */}
        <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible" aria-hidden="true">
          {paths.map(({ d, thick }, i) => (
            <g key={i} fill="none" strokeLinecap="round">
              <path d={d} stroke="#0d0e10" strokeWidth={thick} />
              <path d={d} stroke="#2a2d31" strokeWidth={thick - 2.5} />
              <path d={d} stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" transform="translate(-1 -1.5)" />
            </g>
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 z-20">
          {TEES.map((t) => {
            const p = conn[t] || drag?.male === t ? malePos(t) : null
            return p ? item(t, p, 2 * ARM + 28, RISE + 28, ARM + 14, RISE + 14, `${NAMES[t]} monté sur ${conn[t] ? NAMES[conn[t]!] : '—'} (glisser pour retirer)`, <TeeShape />) : null
          })}
          {PLUGS.map((m) => {
            const p = conn[m] || drag?.male === m ? malePos(m) : null
            return p ? item(m, p, 44, 44, 22, 22, `${NAMES[m]}${conn[m] ? ` sur ${NAMES[conn[m]!]}` : ''} (glisser pour retirer)`, <TerminatorShape kind={m} />) : null
          })}
          {CABLE_ENDS.map((m) => {
            const p = malePos(m)
            return p ? item(m, p, 44, 44, 22, 22, `${NAMES[m]}${conn[m] ? ` branché sur ${NAMES[conn[m]!]}` : ' (libre)'}`, <PlugShape coax={m.startsWith('coax')} />) : null
          })}
          {active &&
            targets(active).map((f) => {
              const p = femalePos(f)!
              return (
                <button
                  key={f}
                  type="button"
                  className="snap-target pointer-events-auto absolute rounded-full"
                  style={{ left: p.x - 24, top: p.y - 24, width: 48, height: 48 }}
                  aria-label={`Brancher ${NAMES[active]} sur ${NAMES[f]}`}
                  onClick={() => plug(active, f)}
                />
              )
            })}
        </div>

        {/* Barre d'action de la sélection (toucher puis BNC) */}
        {selected && (
          <div className="sel-bar sticky bottom-2 z-30 mx-auto mt-3 flex w-fit max-w-full flex-wrap items-center gap-2 rounded-2xl px-3 py-2 text-sm" role="status">
            <span>
              <b>{NAMES[selected]}</b> : touchez une BNC en surbrillance
            </span>
            {conn[selected] && (
              <button type="button" className="bench-btn min-h-11 rounded-xl px-3" onClick={() => unplug(selected)}>
                Débrancher
              </button>
            )}
            <button type="button" className="bench-btn min-h-11 rounded-xl px-3" onClick={() => setSelected(null)}>
              Annuler
            </button>
          </div>
        )}
      </div>
      <p className={`mt-3 rounded-2xl px-4 py-3 text-sm ${topo.ok ? 'bench-desc' : 'bench-desc is-error'}`} role="status" aria-live="polite" data-testid="montage">
        <b>Montage : </b>
        {describe(topo)}
      </p>
    </div>
  )
}

/* ─────────── Générateur d'impulsions GEII PG-50 ─────────── */

function Generator({ gen, setGen }: { gen: GenState; setGen: (g: GenState) => void }) {
  const set = (p: Partial<GenState>) => setGen({ ...gen, ...p })
  const log = (v: number, n: number, lo: number, hi: number, k = 1.1) => clamp(v * k ** n, lo, hi)
  return (
    <div data-demo="gen" className="inst-case rounded-[20px] p-3 sm:p-4" role="group" aria-label="Générateur d’impulsions GEII PG-50">
      <div className="flex items-baseline justify-between gap-2">
        <span className="inst-silk text-[13px] font-semibold tracking-[0.18em]">GEII PG-50</span>
        <span className="inst-silk text-[10px] tracking-[0.14em] opacity-75">PULSE GENERATOR · Zg 50 Ω</span>
      </div>
      <div className="mt-2 flex flex-wrap items-stretch gap-3">
        <div className="lcd flex min-w-[11rem] flex-1 flex-col justify-center rounded-lg px-3 py-2 font-mono" aria-live="polite">
          <span className="text-lg leading-tight" style={{ color: GREEN }}>
            {gen.on ? `${n3(gen.eg)} V` : 'OUTPUT OFF'}
            {gen.on && gen.mode === 'pulse' && <span className="ml-3">{formatSI(gen.width, 's')}</span>}
          </span>
          <span className="text-sm opacity-85" style={{ color: GREEN }}>
            {gen.mode === 'pulse' ? `T ${formatSI(gen.period, 's', 4)} · Imp.` : `${formatSI(gen.f, 'Hz', 4)} · Sinus`}
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <GenKey label="Impulsion" lit={gen.mode === 'pulse'} onClick={() => set({ mode: 'pulse' })} />
          <GenKey label="Sinus" lit={gen.mode === 'sine'} onClick={() => set({ mode: 'sine' })} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
        <FrontKnob demoId="knob-eg" size={46} label="Amplitude" valueText={`${n3(gen.eg)} V`} onStep={(n) => set({ eg: clamp(Math.round((gen.eg + n * 0.05) * 100) / 100, 0, 10) })} onEnter={(v) => set({ eg: clamp(v, 0, 10) })} />
        {gen.mode === 'pulse' ? (
          <>
            <FrontKnob demoId="knob-width" size={46} label="Largeur" valueText={formatSI(gen.width, 's')} onStep={(n) => set({ width: log(gen.width, n, 10e-9, 1e-3) })} onEnter={(v) => set({ width: clamp(v, 10e-9, 1e-3) })} />
            <FrontKnob demoId="knob-period" size={46} label="Période" valueText={formatSI(gen.period, 's')} onStep={(n) => set({ period: log(gen.period, n, 1e-6, 1) })} onEnter={(v) => set({ period: clamp(v, 1e-6, 1) })} />
          </>
        ) : (
          <FrontKnob demoId="knob-f" size={46} label="Fréquence" valueText={formatSI(gen.f, 'Hz')} onStep={(n) => set({ f: log(gen.f, n, 1e3, 20e6, 1.05) })} onEnter={(v) => set({ f: clamp(v, 1e3, 20e6) })} />
        )}
        <div className="flex flex-col items-center gap-1">
          <GenKey label="Output" lit={gen.on} onClick={() => set({ on: !gen.on })} />
          <BncFemale port="gen" label="OUTPUT" ring={gen.on ? '#22c55e' : undefined} />
        </div>
      </div>
    </div>
  )
}

function GenKey({ label, lit, onClick }: { label: string; lit: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={lit} className="inst-key min-h-11 rounded-lg px-3 text-[12px] font-semibold" style={lit ? ({ background: CH1_Y, color: '#111', boxShadow: `0 0 12px ${CH1_Y}99` } as CSSProperties) : undefined}>
      {label}
    </button>
  )
}

/* ─────────── Touret, plateau d'accessoires, potentiomètre, multimètre ─────────── */

function Accessories({
  cable,
  conn,
  potR,
  setPotR,
  ohm,
  selected,
  itemHandlers,
  onRange,
  onUndo,
  canUndo,
}: {
  cable: Cable
  conn: Connections
  potR: number
  setPotR: (r: number) => void
  ohm: number | null
  selected: Male | null
  itemHandlers: (m: Male) => object
  onRange: () => void
  onUndo: () => void
  canUndo: boolean
}) {
  const tray: Male[] = [...TEES, ...PLUGS]
  return (
    <div className="tray grid gap-3 rounded-[20px] p-3 sm:p-4" role="group" aria-label="Plateau d’accessoires">
      <div className="flex flex-wrap items-center gap-2">
        <span className="tray-title text-[11px] font-semibold tracking-[0.18em]">PAILLASSE</span>
        <span className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={onUndo} disabled={!canUndo} className="bench-btn min-h-11 rounded-xl px-3 text-sm disabled:opacity-40">
            Montage précédent
          </button>
          <button type="button" onClick={onRange} disabled={Object.keys(conn).length === 0} className="bench-btn min-h-11 rounded-xl px-3 text-sm disabled:opacity-40">
            Ranger le banc
          </button>
        </span>
      </div>
      <div className="grid gap-3">
        {/* Touret : les deux bouts du câble long en partent */}
        <div className="flex items-center gap-3">
          <div data-demo="touret" className="relative h-32 w-32 shrink-0" aria-label={`Câble coaxial long enroulé : ${cable.N} spires, diamètre ${n3(cable.D)} m`} role="img">
            <svg viewBox="-64 -64 128 128" className="h-full w-full" aria-hidden="true">
              <circle r="62" fill="#2c2f33" />
              {Array.from({ length: 11 }, (_, i) => (
                <circle key={i} r={58 - i * 3.2} fill="none" stroke={i % 2 ? '#1b1d20' : '#26292d'} strokeWidth="3" />
              ))}
              <circle r="20" fill="#3b4046" stroke="#1d2023" strokeWidth="2" />
              <circle r="5" fill="#1a1c1f" />
              <text y="-28" textAnchor="middle" fontSize="9" fill="#e9ecef">
                {cable.N} spires
              </text>
              <text y="36" textAnchor="middle" fontSize="9" fill="#e9ecef">
                Ø {n3(cable.D)} m
              </text>
            </svg>
            <span data-home="coax-lead-A" className="absolute right-2 top-4 h-1 w-1" />
            <span data-home="coax-lead-B" className="absolute bottom-4 right-2 h-1 w-1" />
          </div>
          <div className="grid gap-1 text-xs">
            <span className="tray-title font-semibold">Câble long</span>
            <span className="flex items-center gap-2">
              <span data-home="coax.A" className="inline-block h-11 w-11" /> <span className="tray-title">bout A</span>
            </span>
            <span className="flex items-center gap-2">
              <span data-home="coax.B" className="inline-block h-11 w-11" /> <span className="tray-title">bout B</span>
            </span>
          </div>
        </div>
        {/* Accessoires libres */}
        <div className="grid content-start gap-2">
          <div className="flex flex-wrap gap-2">
            {tray.map((m) =>
              !conn[m] ? (
                <button
                  key={m}
                  type="button"
                  className={`tray-item flex min-h-11 touch-none flex-col items-center justify-center rounded-xl px-2 py-1 ${selected === m ? 'is-selected' : ''}`}
                  aria-label={`${NAMES[m]} (glisser, ou toucher puis choisir une BNC)`}
                  aria-pressed={selected === m}
                  data-demo={`tray-${m}`}
                  {...itemHandlers(m)}
                >
                  {m === 'tee1' || m === 'tee2' ? (
                    <svg width="56" height="40" viewBox="-28 -30 56 40" aria-hidden="true">
                      <TeeGlyph />
                    </svg>
                  ) : (
                    <svg width="44" height="40" viewBox="-22 -20 44 40" aria-hidden="true">
                      <TerminatorGlyph kind={m as Plug} />
                    </svg>
                  )}
                  <span className="tray-title text-[10px]">{m === 'tee1' || m === 'tee2' ? 'Té BNC' : m === 'cc' ? 'Court-circuit' : m === 'b50' ? 'Bouchon 50 Ω' : 'Bouchon 75 Ω'}</span>
                </button>
              ) : null,
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="tray-title whitespace-nowrap font-semibold">Supports de Té</span>
            {(['park1', 'park2'] as const).map((p) => (
              <span key={p} data-port={p} className="park inline-block h-11 w-11 rounded-full" role="img" aria-label={NAMES[p]} />
            ))}
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="tray-title whitespace-nowrap font-semibold">Cordon 1 m</span>
            <span data-home="cordon.A" className="inline-block h-11 w-11" />
            <span data-home="cordon.B" className="inline-block h-11 w-11" />
          </div>
        </div>
      </div>
      {/* Potentiomètre et multimètre */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="inst-case flex items-end gap-3 rounded-2xl px-3 py-2" role="group" aria-label="Boîtier potentiomètre 0 à 200 Ω">
          <FrontKnob demoId="knob-pot" size={44} label="Potentiomètre" valueText="0–200 Ω" onStep={(n) => setPotR(clamp(Math.round((potR + n * 0.5) * 2) / 2, 0, RES3.potMax))} />
          <BncFemale port="pot" label="ENTRÉE" />
        </div>
        <div className="meter flex items-center gap-3 rounded-2xl px-3 py-2" role="group" aria-label="Multimètre en ohmmètre sur le potentiomètre">
          <div className="lcd-meter rounded-md px-3 py-1.5 font-mono text-base" aria-live="polite" data-testid="ohmmetre" data-demo="ohmmetre">
            {ohm === null ? 'OL' : `${ohm.toFixed(1).replace('.', ',')} Ω`}
          </div>
          <span className="max-w-[14rem] text-xs text-[#e9ecef]">{ohm === null ? 'Débranchez le potentiomètre pour le mesurer.' : 'Ohmmètre sur les bornes du potentiomètre'}</span>
        </div>
      </div>
      <p className="tray-title text-xs opacity-80">Glissez une fiche sur une BNC, ou touchez-la puis touchez la BNC en surbrillance. Appui long ou glisser hors de la BNC : débrancher.</p>
    </div>
  )
}

/* ─────────── Dessins : BNC femelle, fiche mâle, Té, bouchons ─────────── */

function BncFemale({ port, label, ring }: { port: Female; label: string; ring?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <svg width="44" height="44" viewBox="-24 -24 48 48" data-port={port} role="img" aria-label={`Embase BNC ${label}`}>
        {ring && <circle r="22" fill="none" stroke={ring} strokeWidth="2.5" />}
        <polygon points="18,0 9,15.6 -9,15.6 -18,0 -9,-15.6 9,-15.6" fill="#b7bec5" stroke="#3b4046" strokeWidth="0.8" />
        <circle r="11" fill="#d5dade" stroke="#3b4046" strokeWidth="0.8" />
        <circle r="7" fill="#e9e4d6" />
        <circle r="2" fill="#c8a24a" />
      </svg>
      <span className="inst-silk text-[10px] font-semibold">{label}</span>
    </div>
  )
}

function PlugShape({ coax }: { coax: boolean }) {
  return (
    <svg width="44" height="44" viewBox="-22 -22 44 44" className="plug-rot" aria-hidden="true">
      <circle r="15" fill="#c9cfd5" stroke="#4b5157" strokeWidth="1" />
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * 2 * Math.PI
        return <line key={i} x1={Math.cos(a) * 15} y1={Math.sin(a) * 15} x2={Math.cos(a) * 11.5} y2={Math.sin(a) * 11.5} stroke="#79818a" strokeWidth="1" />
      })}
      <circle r="10" fill={coax ? '#2a2d31' : '#3a3e44'} />
      <circle r="3" fill="#c8a24a" />
    </svg>
  )
}

function TeeGlyph() {
  return (
    <g>
      <rect x="-5" y="-6" width="10" height="14" fill="#b7bec5" stroke="#4b5157" strokeWidth="0.8" />
      <rect x="-26" y="-24" width="52" height="16" rx="5" fill="#c9cfd5" stroke="#4b5157" strokeWidth="0.8" />
      <circle cx="-22" cy="-16" r="5" fill="#e9e4d6" stroke="#8a9097" />
      <circle cx="22" cy="-16" r="5" fill="#e9e4d6" stroke="#8a9097" />
    </g>
  )
}

/** Té monté : pied sur la BNC (bas centre), bras à ±ARM, RISE plus haut */
function TeeShape() {
  const w = 2 * ARM + 28
  const h = RISE + 28
  return (
    <svg width={w} height={h} viewBox={`${-w / 2} ${-RISE - 14} ${w} ${h}`} className="plug-rot-soft" aria-hidden="true">
      <rect x="-6" y={-RISE + 6} width="12" height={RISE - 4} fill="#b7bec5" stroke="#4b5157" strokeWidth="0.8" />
      <rect x={-ARM - 10} y={-RISE - 9} width={2 * ARM + 20} height="18" rx="6" fill="#c9cfd5" stroke="#4b5157" strokeWidth="0.8" />
      <circle cx={-ARM} cy={-RISE} r="6" fill="#e9e4d6" stroke="#8a9097" />
      <circle cx={ARM} cy={-RISE} r="6" fill="#e9e4d6" stroke="#8a9097" />
      <circle r="9" fill="#c9cfd5" stroke="#4b5157" />
    </svg>
  )
}

function TerminatorGlyph({ kind }: { kind: Plug }) {
  return (
    <g>
      <rect x="-16" y="-11" width="18" height="22" rx="4" fill="#c9cfd5" stroke="#4b5157" strokeWidth="0.8" />
      <rect x="2" y="-9" width="16" height="18" rx="5" fill={kind === 'cc' ? '#4b5057' : '#1f2328'} />
      <text x="10" y="3.5" textAnchor="middle" fontSize="7" fontWeight="700" fill="#e9ecef">
        {kind === 'cc' ? 'CC' : kind === 'b50' ? '50' : '75'}
      </text>
    </g>
  )
}

function TerminatorShape({ kind }: { kind: Plug }) {
  return (
    <svg width="44" height="44" viewBox="-22 -22 44 44" className="plug-rot" aria-hidden="true">
      <circle r="14" fill="#c9cfd5" stroke="#4b5157" />
      <circle r="10" fill={kind === 'cc' ? '#4b5057' : '#1f2328'} />
      <text y="3.5" textAnchor="middle" fontSize="9" fontWeight="700" fill="#e9ecef">
        {kind === 'cc' ? 'CC' : kind === 'b50' ? '50' : '75'}
      </text>
    </svg>
  )
}

const BENCH_CSS = `
.bench-board {
  background-color: #d8d4cb;
  background-image: radial-gradient(1200px 400px at 20% -10%, rgba(255,255,255,0.12), transparent 60%), repeating-linear-gradient(115deg, rgba(60,50,30,0.05) 0 2px, transparent 2px 7px), linear-gradient(180deg, #d8d4cb, #cbc6bb);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), 0 1px 2px rgba(0,0,0,0.08);
  color: #2b2b2b;
}
.inst-case { background: linear-gradient(180deg, #34383d, #24272b); color: #eceff2; box-shadow: 0 16px 30px -18px rgba(0,0,0,0.55), inset 0 2px 0 rgba(255,255,255,0.06); }
.inst-silk { color: #eceff2; }
.inst-key { color: #eceff2; background: linear-gradient(180deg, #474c53, #33373c); box-shadow: inset 0 1px 0 rgba(255,255,255,0.18), 0 2px 0 #141619; transition: transform 150ms ease; }
.inst-key:active { transform: translateY(1px); }
.lcd { background: #0a0f0c; box-shadow: inset 0 2px 6px rgba(0,0,0,0.8); text-shadow: 0 0 6px rgba(125,255,168,0.5); }
.tray { background: rgba(0,0,0,0.07); box-shadow: inset 0 0 0 1px rgba(0,0,0,0.08); }
.tray-title { color: #2b2b2b; }
.tray-item { background: rgba(255,255,255,0.45); box-shadow: 0 0 0 1px rgba(0,0,0,0.1); cursor: grab; transition: box-shadow 150ms ease, transform 150ms ease; }
.tray-item:hover { transform: translateY(-1px); }
.tray-item.is-selected, .bench-item.is-selected { box-shadow: 0 0 0 3px #2563eb; border-radius: 12px; }
.bench-item { cursor: grab; filter: drop-shadow(0 3px 3px rgba(0,0,0,0.35)); }
.bench-item.is-drag { cursor: grabbing; z-index: 5; }
.bench-item:focus-visible, .tray-item:focus-visible, .snap-target:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
.bench-item.is-snap .plug-rot { animation: bnc-twist 260ms ease-out; }
.bench-item.is-snap .plug-rot-soft { animation: bnc-drop 220ms ease-out; }
@keyframes bnc-twist { 0% { transform: rotate(0deg) scale(1.12); } 70% { transform: rotate(90deg) scale(0.96); } 100% { transform: rotate(90deg) scale(1); } }
@keyframes bnc-drop { from { transform: translateY(-4px); } to { transform: translateY(0); } }
.snap-target { box-shadow: 0 0 0 3px rgba(37,99,235,0.9), 0 0 16px rgba(37,99,235,0.6); background: rgba(37,99,235,0.12); animation: bnc-pulse 1.2s ease-in-out infinite; }
@keyframes bnc-pulse { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
.bench-btn { background: rgba(255,255,255,0.7); color: #1f2328; box-shadow: 0 0 0 1px rgba(0,0,0,0.12); }
.sel-bar { background: #1f2328; color: #f4f4f5; box-shadow: 0 10px 24px -12px rgba(0,0,0,0.6); }
.sel-bar .bench-btn { background: #33373c; color: #f4f4f5; box-shadow: none; }
.park { box-shadow: inset 0 0 0 2px rgba(0,0,0,0.18); background: repeating-linear-gradient(45deg, rgba(0,0,0,0.06) 0 4px, transparent 4px 8px); }
.meter { background: linear-gradient(180deg, #2b2f33, #1d2023); }
.lcd-meter { background: #b9c6a8; color: #1d2416; }
.bench-desc { background: var(--color-card); box-shadow: 0 0 0 1px var(--color-line); }
.bench-desc.is-error { box-shadow: 0 0 0 2px var(--color-warn); }
@media (prefers-reduced-motion: reduce) {
  .bench-item .plug-rot, .bench-item .plug-rot-soft, .snap-target { animation: none !important; }
  .tray-item, .inst-key { transition: none; }
}
`
