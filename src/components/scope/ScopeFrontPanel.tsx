/**
 * Face avant de l'oscilloscope « GEII DSO-2102 » (modèle inventé) : écran avec bandeau d'état, échelles et
 * libellés des 6 touches contextuelles, commandes groupées comme sur l'appareil (Horizontal, Vertical par voie,
 * Trigger, Run Control, Auto Scale, Default Setup, Acquire, Cursors, Meas, molette universelle), embases BNC.
 * Ne fait que réexposer les réglages de useScope : le comportement est celui de la vue compacte.
 * Sur mobile : écran pleine largeur, commandes en panneaux balayables.
 */
import { useId, useState, type CSSProperties, type ReactNode } from 'react'
import { OSCILLO } from '../../data/reference'
import { autoScale, defaultSetup, SDIV_STEPS, VDIV_STEPS } from '../../lib/scope/engine'
import type { AcqMode, Ch, Coupling, MeasureKind } from '../../lib/scope/types'
import FrontKnob from './FrontKnob'
import { AVG_STEPS, fr, MEASURES, OFFSET_DIV, STATUS_COLOR, zero, type ScopeApi } from './useScope'

const { divX } = OSCILLO
/** Couleurs standard des voies d'oscilloscope (jaune, vert) */
export const CH_COLORS = ['#f5d90a', '#34d399'] as const
const RUN_GREEN = '#22c55e'
const STOP_RED = '#ef4444'
const AMBER = '#f59e0b'

type MenuId = 'ch0' | 'ch1' | 'horiz' | 'trig' | 'acq' | 'cursors' | 'meas'
interface Softkey {
  label: string
  value?: string
  onPress?: () => void
  /** Couleur de la valeur (voie) */
  color?: string
}

/** Pas suivant dans une suite 1-2-5 (n crans) */
const stepIn = (list: readonly number[], v: number, n: number) => {
  let i = 0
  for (let k = 1; k < list.length; k++) if (Math.abs(list[k]! - v) < Math.abs(list[i]! - v)) i = k
  return list[Math.min(list.length - 1, Math.max(0, i + n))]!
}
const cycle = <T,>(xs: readonly T[], v: T): T => xs[(xs.indexOf(v) + 1) % xs.length]!

/** Embase BNC femelle en façade ; `port` sert de point de branchement au banc */
export function BncJack({ label, color, port, sub }: { label: string; color?: string; port?: string; sub?: string }) {
  const gid = `bnc${useId().replace(/:/g, '')}`
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="48" height="48" viewBox="-24 -24 48 48" role="img" aria-label={`Embase BNC ${label}`} data-port={port}>
        <defs>
          <radialGradient id={gid} cx="35%" cy="30%" r="75%">
            <stop offset="0" stopColor="#f4f6f8" />
            <stop offset="0.5" stopColor="#a9b1b9" />
            <stop offset="1" stopColor="#5d646b" />
          </radialGradient>
        </defs>
        {color && <circle r="22" fill="none" stroke={color} strokeWidth="2.5" />}
        <polygon points="18,0 9,15.6 -9,15.6 -18,0 -9,-15.6 9,-15.6" fill={`url(#${gid})`} stroke="#3b4046" strokeWidth="0.8" />
        <circle r="11" fill={`url(#${gid})`} stroke="#3b4046" strokeWidth="0.8" />
        <rect x="-13.5" y="-2" width="4" height="4" rx="1" fill="#c9ced3" stroke="#555" strokeWidth="0.5" />
        <rect x="9.5" y="-2" width="4" height="4" rx="1" fill="#c9ced3" stroke="#555" strokeWidth="0.5" />
        <circle r="7" fill="#e9e4d6" />
        <circle r="2" fill="#c8a24a" />
      </svg>
      <span className="fp-silk text-[11px] font-semibold tracking-wide">{label}</span>
      {sub && <span className="fp-silk hidden text-[9px] opacity-60 @lg:inline">{sub}</span>}
    </div>
  )
}

export default function ScopeFrontPanel({ scope }: { scope: ScopeApi }) {
  const { st, setSt, set, setCh, setTrig, setCur, setMode, setProbe, readout, canvasRef, onDown, onMove, endDrag, forceTrigger, cursorKey, setCursorKey, nudgeCursor, dX, dY, measureValue, fiftyPct, sources } = scope
  const [menu, setMenu] = useState<MenuId>('ch0')
  const [measPick, setMeasPick] = useState<MeasureKind>('vpp')

  const ch = (c: Ch) => st.ch[c]
  const vdivSteps = (c: Ch) => VDIV_STEPS.map((v) => v * st.ch[c].probe)
  const turnVdiv = (c: Ch, n: number) => setCh(c, { vdiv: ch(c).fine ? ch(c).vdiv * OSCILLO.cranFin ** n : stepIn(vdivSteps(c), ch(c).vdiv, n) })
  const turnOffset = (c: Ch, n: number) => setCh(c, { offset: Math.max(-OFFSET_DIV * ch(c).vdiv, Math.min(OFFSET_DIV * ch(c).vdiv, zero(ch(c).offset + (n * ch(c).vdiv) / 25))) })
  const turnLevel = (n: number) => setTrig({ level: zero(st.trig.level + (n * ch(st.trig.source).vdiv) / 25) })
  const turnHoldoff = (n: number) => setTrig({ holdoff: Math.max(OSCILLO.holdoffMin, Math.min(OSCILLO.holdoffMax, st.trig.holdoff * 1.25 ** n)) })

  /** Touche voie : allume et ouvre le menu ; rappuyer avec le menu ouvert éteint la voie */
  const chKey = (c: Ch) => {
    const id: MenuId = c === 0 ? 'ch0' : 'ch1'
    if (!ch(c).on) {
      setCh(c, { on: true })
      setMenu(id)
    } else if (menu === id) setCh(c, { on: false })
    else setMenu(id)
  }


  /** Molette universelle : agit sur le réglage du menu ouvert */
  const uni = (n: number) => {
    if (menu === 'trig') turnHoldoff(n)
    else if (menu === 'acq') set({ acq: { ...st.acq, n: stepIn(AVG_STEPS, st.acq.n, n) } })
    else if (menu === 'cursors') nudgeCursor(n > 0 ? 1 : -1)
    else if (menu === 'meas') {
      const ks = MEASURES.map((m) => m.kind)
      setMeasPick(ks[(ks.indexOf(measPick) + n + ks.length * 10) % ks.length]!)
    } else if (menu === 'horiz') set({ delay: zero(st.delay + (n * st.sdiv) / 10) })
  }

  const menus: Record<MenuId, { title: string; keys: Softkey[] }> = {
    ch0: chMenu(0),
    ch1: chMenu(1),
    horiz: {
      title: 'Horizontal',
      keys: [
        { label: 'Référence', value: st.ref === 'centre' ? 'Centre' : 'Gauche', onPress: () => set({ ref: st.ref === 'centre' ? 'gauche' : 'centre' }) },
        { label: 'Retard', value: fr(st.delay, 's'), onPress: () => set({ delay: 0 }) },
        { label: 'Zoom', value: readout.mode === 'stop' ? 'sur enreg.' : 'Stop d’abord' },
        { label: 'Sa/s', value: readout.fs ? fr(readout.fs, 'Sa/s') : '—' },
        { label: '' },
        { label: '' },
      ],
    },
    trig: {
      title: 'Déclenchement',
      keys: [
        { label: 'Source', value: `CH${st.trig.source + 1}`, color: CH_COLORS[st.trig.source], onPress: () => setTrig({ source: st.trig.source === 0 ? 1 : 0 }) },
        { label: 'Front', value: st.trig.slope === 'montant' ? '↑ montant' : '↓ desc.', onPress: () => setTrig({ slope: st.trig.slope === 'montant' ? 'descendant' : 'montant' }) },
        { label: 'Mode', value: st.trig.mode === 'auto' ? 'Auto' : 'Normal', onPress: () => setTrig({ mode: st.trig.mode === 'auto' ? 'normal' : 'auto' }) },
        { label: 'Holdoff ⟳', value: fr(st.trig.holdoff, 's') },
        { label: 'Niveau', value: '50 %', onPress: fiftyPct },
        { label: '' },
      ],
    },
    acq: {
      title: 'Acquisition',
      keys: [
        { label: 'Mode', value: ({ normal: 'Normal', peak: 'Peak Det.', moyenne: 'Moyenne' } as const)[st.acq.mode], onPress: () => set({ acq: { ...st.acq, mode: cycle<AcqMode>(['normal', 'peak', 'moyenne'], st.acq.mode) } }) },
        { label: 'Moyennes ⟳', value: `× ${st.acq.n}` },
        { label: 'Sa/s', value: readout.fs ? fr(readout.fs, 'Sa/s') : '—' },
        { label: 'Mémoire', value: '1 Mpts' },
        { label: '' },
        { label: '' },
      ],
    },
    cursors: {
      title: 'Curseurs',
      keys: [
        { label: 'Curseurs', value: st.cursors.on ? 'On' : 'Off', onPress: () => setCur({ on: !st.cursors.on, ...(st.cursors.on ? {} : { x1: (-divX * st.sdiv) / 5, x2: (divX * st.sdiv) / 5 }) }) },
        { label: 'Actif ⟳', value: cursorKey.toUpperCase(), onPress: () => setCursorKey(cycle(['x1', 'x2', 'y1', 'y2'] as const, cursorKey)) },
        { label: 'Voie Y', value: `CH${st.cursors.ych + 1}`, color: CH_COLORS[st.cursors.ych], onPress: () => setCur({ ych: st.cursors.ych === 0 ? 1 : 0 }) },
        { label: 'ΔX', value: fr(dX, 's') },
        { label: '1/ΔX', value: fr(1 / dX, 'Hz') },
        { label: 'ΔY', value: fr(dY, 'V') },
      ],
    },
    meas: {
      title: 'Mesures',
      keys: [
        { label: 'Source', value: `CH${st.measures.source + 1}`, color: CH_COLORS[st.measures.source], onPress: () => set({ measures: { ...st.measures, source: st.measures.source === 0 ? 1 : 0 } }) },
        { label: 'Choisir ⟳', value: MEASURES.find((m) => m.kind === measPick)?.label },
        {
          label: st.measures.kinds.includes(measPick) ? 'Retirer' : 'Ajouter',
          value: MEASURES.find((m) => m.kind === measPick)?.label,
          onPress: () => set({ measures: { ...st.measures, kinds: st.measures.kinds.includes(measPick) ? st.measures.kinds.filter((k) => k !== measPick) : [...st.measures.kinds, measPick] } }),
        },
        { label: 'Effacer', value: 'tout', onPress: () => set({ measures: { ...st.measures, kinds: [] } }) },
        { label: '' },
        { label: '' },
      ],
    },
  }
  function chMenu(c: Ch): { title: string; keys: Softkey[] } {
    const x = st.ch[c]
    return {
      title: `Voie ${c + 1}`,
      keys: [
        { label: 'Couplage', value: x.coupling, color: CH_COLORS[c], onPress: () => setCh(c, { coupling: cycle<Coupling>(['DC', 'AC', 'GND'], x.coupling) }) },
        { label: 'Sonde', value: `${x.probe}:1`, color: CH_COLORS[c], onPress: () => setProbe(c, x.probe === 1 ? 10 : 1) },
        { label: 'Réglage fin', value: x.fine ? 'On' : 'Off', onPress: () => setCh(c, { fine: !x.fine }) },
        { label: 'Position', value: `${fr(zero(x.offset), 'V')}`, onPress: () => setCh(c, { offset: 0 }) },
        { label: 'Voie', value: x.on ? 'Affichée' : 'Éteinte', onPress: () => setCh(c, { on: !x.on }) },
        { label: 'BNC', value: sources[c] ? 'signal' : 'rien' },
      ],
    }
  }
  const m = menus[menu]

  const stopped = readout.mode === 'stop'
  const measKinds = MEASURES.filter((x) => st.measures.kinds.includes(x.kind))

  /* ─────────── Groupes de commandes ─────────── */
  const horizontal = (
    <Group title="HORIZONTAL">
      <div className="flex items-end justify-around gap-2">
        <FrontKnob size={68} label="s/div" valueText={`${fr(st.sdiv, 's')}/div`} onStep={(n) => set({ sdiv: stepIn(SDIV_STEPS, st.sdiv, -n) })} onEnter={(v) => v > 0 && set({ sdiv: stepIn(SDIV_STEPS, v, 0) })} />
        <FrontKnob size={48} label="Retard" valueText={fr(st.delay, 's')} onStep={(n) => set({ delay: zero(st.delay + (n * st.sdiv) / 10) })} onPress={() => set({ delay: 0 })} pressLabel="0" onEnter={(v) => set({ delay: v })} />
        <Key label="Zoom" onPress={() => setMenu('horiz')} active={menu === 'horiz'} />
      </div>
    </Group>
  )
  const vertical = (
    <Group title="VERTICAL">
      <div className="grid grid-cols-2 gap-2">
        {([0, 1] as const).map((c) => (
          <div key={c} className="flex flex-col items-center gap-1.5">
            <Key label={String(c + 1)} lit={st.ch[c].on ? CH_COLORS[c] : undefined} round onPress={() => chKey(c)} aria={`Voie ${c + 1} : ${st.ch[c].on ? 'allumée' : 'éteinte'} (menu de la voie)`} active={menu === (c === 0 ? 'ch0' : 'ch1')} />
            <FrontKnob
              size={52}
              label="V/div"
              tint={CH_COLORS[c]}
              valueText={`${fr(st.ch[c].vdiv, 'V')}`}
              onStep={(n) => turnVdiv(c, n)}
              onEnter={(v) => v > 0 && setCh(c, { vdiv: st.ch[c].fine ? Math.min(OSCILLO.vdivMax * st.ch[c].probe, Math.max(OSCILLO.vdivMin * st.ch[c].probe, v)) : stepIn(vdivSteps(c), v, 0) })}
            />
            <FrontKnob size={40} label="Position" valueText={fr(zero(st.ch[c].offset), 'V')} onStep={(n) => turnOffset(c, n)} onPress={() => setCh(c, { offset: 0 })} pressLabel="0" onEnter={(v) => setCh(c, { offset: Math.max(-OFFSET_DIV * st.ch[c].vdiv, Math.min(OFFSET_DIV * st.ch[c].vdiv, v)) })} />
          </div>
        ))}
      </div>
    </Group>
  )
  const trigger = (
    <Group title="TRIGGER">
      <div className="flex items-end justify-around gap-2">
        <FrontKnob size={52} label="Niveau" tint={CH_COLORS[st.trig.source]} valueText={fr(st.trig.level, 'V')} onStep={turnLevel} onPress={fiftyPct} pressLabel="50 %" onEnter={(v) => setTrig({ level: v })} />
        <div className="flex flex-col gap-2">
          <Key label="Menu" onPress={() => setMenu('trig')} active={menu === 'trig'} />
          <Key label="Force" onPress={forceTrigger} />
        </div>
      </div>
    </Group>
  )
  const runCtl = (
    <div className="grid gap-2">
      <Group title="RUN CONTROL">
        <div className="flex justify-around gap-2">
          <Key label="Run/Stop" wide lit={stopped ? STOP_RED : RUN_GREEN} onPress={() => setMode(stopped ? 'run' : 'stop')} aria={`Run/Stop : ${stopped ? 'arrêté' : 'en marche'}`} />
          <Key label="Single" wide lit={readout.mode === 'single' ? AMBER : undefined} onPress={() => setMode('single')} />
        </div>
      </Group>
      <Group title="">
        <div className="grid grid-cols-2 gap-2">
          <Key label="Auto Scale" wide onPress={() => setSt(autoScale(sources, st, performance.now() / 1000))} />
          <Key
            label="Default Setup"
            wide
            onPress={() => {
              setSt(defaultSetup())
              setMode('run')
              setMenu('ch0')
            }}
          />
          <Key label="Acquire" wide onPress={() => setMenu('acq')} active={menu === 'acq'} />
          <Key label="Cursors" wide onPress={() => setMenu('cursors')} active={menu === 'cursors'} />
          <Key label="Meas" wide onPress={() => setMenu('meas')} active={menu === 'meas'} />
          <div className="flex justify-center">
            <FrontKnob size={44} label="Universelle" onStep={uni} />
          </div>
        </div>
      </Group>
    </div>
  )
  const panels: [string, ReactNode][] = [
    ['Horizontal', horizontal],
    ['Vertical', vertical],
    ['Trigger', trigger],
    ['Run · Mesures', runCtl],
  ]

  return (
    <div className="fp-case @container relative rounded-[22px] p-3 @lg:p-4" style={FP_VARS}>
      <style>{FP_CSS}</style>
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <defs>
          <radialGradient id="fk-cap" cx="35%" cy="30%" r="80%">
            <stop offset="0" stopColor="#5b6168" />
            <stop offset="0.55" stopColor="#30343a" />
            <stop offset="1" stopColor="#17191c" />
          </radialGradient>
          <radialGradient id="fk-chrome" cx="35%" cy="30%" r="75%">
            <stop offset="0" stopColor="#f4f6f8" />
            <stop offset="0.5" stopColor="#a9b1b9" />
            <stop offset="1" stopColor="#5d646b" />
          </radialGradient>
        </defs>
      </svg>
      <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
        <span className="fp-silk text-[13px] font-semibold tracking-[0.18em]">GEII DSO-2102</span>
        <span className="fp-silk hidden text-[10px] tracking-[0.14em] opacity-80 @lg:inline">DIGITAL STORAGE OSCILLOSCOPE · 100 MHz · 2 GSa/s</span>
      </div>
      <div className="grid gap-3 @4xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <div className="flex gap-2">
            {/* Écran */}
            <div className="fp-bezel min-w-0 flex-1 rounded-xl p-1.5 @lg:p-2">
              <div className="fp-screen relative overflow-hidden rounded-md font-mono text-[11px] @lg:text-[12px]">
                <div className="flex flex-wrap items-center gap-x-3 px-2 py-1 text-[#e7eaee]">
                  <span>{fr(st.sdiv, 's')}/</span>
                  <span>Δ {fr(st.delay, 's')}</span>
                  <span className="rounded px-1" style={{ color: STATUS_COLOR[readout.status], background: 'rgba(255,255,255,0.06)' }}>
                    {readout.status}
                  </span>
                  <span style={{ color: CH_COLORS[st.trig.source] }}>
                    {st.trig.slope === 'montant' ? '↑' : '↓'} {st.trig.source + 1} {fr(st.trig.level, 'V')}
                  </span>
                  <span className="opacity-70">{st.trig.mode === 'auto' ? 'Auto' : 'Normal'}</span>
                  <span className="hidden opacity-70 @lg:inline">{readout.fs ? fr(readout.fs, 'Sa/s') : ''}</span>
                  {readout.trigOff !== 0 && <span className="text-[#fb923c]">T hors écran {readout.trigOff < 0 ? '◂' : '▸'}</span>}
                </div>
                <div className="grid @lg:grid-cols-[minmax(0,1fr)_96px]">
                  <canvas
                    ref={canvasRef}
                    className="block aspect-[5/4] w-full touch-none"
                    onPointerDown={onDown}
                    onPointerMove={onMove}
                    onPointerUp={endDrag}
                    aria-label="Écran de l'oscilloscope"
                  />
                  {/* Libellés des touches contextuelles (ordinateur) */}
                  <div className="hidden flex-col border-l border-white/10 @lg:flex" aria-hidden="true">
                    <div className="px-1.5 py-1 text-center text-[10px] font-semibold tracking-wide text-[#e7eaee] opacity-80">{m.title}</div>
                    {m.keys.map((k, i) => (
                      <div key={i} className="flex flex-1 flex-col items-center justify-center border-t border-white/10 px-1 text-center leading-tight">
                        <span className="text-[11px] text-[#e7eaee]">{k.label}</span>
                        {k.value && (
                          <span className="text-[11px]" style={{ color: k.color ?? '#9fb3c8' }}>
                            {k.value}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 px-2 py-1">
                  {([0, 1] as const).map((c) =>
                    st.ch[c].on ? (
                      <span key={c} style={{ color: CH_COLORS[c] }}>
                        {c + 1} {fr(st.ch[c].vdiv, 'V')}/ {fr(zero(st.ch[c].offset), 'V')} {st.ch[c].coupling} {st.ch[c].probe}:1{readout.clipped[c] ? ' ⚠' : ''}
                      </span>
                    ) : null,
                  )}
                  <span className="text-[#e7eaee] opacity-70">{({ normal: 'Acq. Normal', peak: 'Peak Detect', moyenne: `Moyenne ×${st.acq.n}` } as const)[st.acq.mode]}</span>
                </div>
                {(measKinds.length > 0 || st.cursors.on) && (
                  <div className="flex flex-wrap gap-x-4 border-t border-white/10 px-2 py-1">
                    {measKinds.map((x) => (
                      <span key={x.kind} style={{ color: x.kind === 'retard' ? '#e7eaee' : CH_COLORS[st.measures.source] }}>
                        {x.label}
                        {x.kind === 'retard' ? '' : `(${st.measures.source + 1})`} {Number.isFinite(measureValue(x.kind)) ? fr(measureValue(x.kind), x.unit) : '—'}
                      </span>
                    ))}
                    {st.cursors.on && (
                      <span className="text-[#e7eaee]">
                        ΔX {fr(dX, 's')} · 1/ΔX {fr(1 / dX, 'Hz')} · <span style={{ color: CH_COLORS[st.cursors.ych] }}>ΔY {fr(dY, 'V')}</span>
                      </span>
                    )}
                  </div>
                )}
                <div className="fp-glass pointer-events-none absolute inset-0" aria-hidden="true" />
              </div>
            </div>
            {/* Touches contextuelles physiques (ordinateur) */}
            <div className="hidden w-10 flex-col justify-around gap-1 py-6 @lg:flex" role="group" aria-label={`Menu ${m.title}`}>
              {m.keys.map((k, i) => (
                <Key key={i} label="" small onPress={k.onPress} disabled={!k.onPress} aria={k.label ? `${k.label}${k.value ? ` : ${k.value}` : ''}` : 'Touche contextuelle libre'} />
              ))}
            </div>
          </div>
          {/* Touches contextuelles (mobile) : le libellé est sur la touche */}
          <div className="mt-2 @lg:hidden" role="group" aria-label={`Menu ${m.title}`}>
            <p className="fp-silk mb-1 text-[11px] font-semibold tracking-wide">MENU · {m.title}</p>
            <div className="grid grid-cols-3 gap-1.5">
              {m.keys.map((k, i) => (
                <button key={i} type="button" disabled={!k.onPress} onClick={k.onPress} className="fp-key min-h-12 rounded-lg px-1 text-[11px] leading-tight disabled:opacity-50">
                  <span className="block">{k.label || '—'}</span>
                  {k.value && (
                    <span className="block font-mono" style={{ color: k.color ?? '#b9c6d3' }}>
                      {k.value}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3 px-1">
            <span className="fp-silk text-[10px] tracking-[0.14em] opacity-70">1 MΩ ≈ 16 pF · 300 V CAT I</span>
            <div className="flex items-end gap-4 @lg:gap-6">
              <BncJack label="CH1" color={CH_COLORS[0]} port="scope-ch1" />
              <BncJack label="CH2" color={CH_COLORS[1]} port="scope-ch2" />
              <BncJack label="EXT TRIG" />
            </div>
          </div>
        </div>

        {/* Commandes : grille sur grand écran, panneaux balayables sur mobile */}
        <div className="min-w-0">
          <p className="fp-silk mb-2 text-[11px] opacity-75 @lg:hidden">Balayez les panneaux ←→ · plus confortable en paysage</p>
          <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 @lg:mx-0 @lg:grid @lg:grid-cols-2 @lg:overflow-visible @lg:px-0 @4xl:grid-cols-1">
            {panels.map(([name, p]) => (
              <div key={name} className="w-[86%] shrink-0 snap-center @lg:w-auto" aria-label={`Panneau ${name}`} role="group">
                {p}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="fp-group h-full rounded-xl px-2.5 pb-2.5 pt-0.5">
      {title && <legend className="fp-silk px-1 text-[11px] font-semibold tracking-[0.16em]">{title}</legend>}
      {children}
    </fieldset>
  )
}

/** Touche caoutchouc, éventuellement lumineuse (halo à la couleur de la fonction) */
function Key({
  label,
  lit,
  wide,
  small,
  round,
  aria,
  onPress,
  active,
  disabled,
}: {
  label: string
  lit?: string
  wide?: boolean
  small?: boolean
  round?: boolean
  aria?: string
  onPress?: () => void
  active?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      aria-label={aria}
      aria-pressed={active}
      className={`fp-key ${round ? 'rounded-full' : 'rounded-lg'} ${small ? 'h-11 w-10' : wide ? 'min-h-11 px-3' : 'min-h-11 min-w-12 px-2'} text-[12px] font-semibold ${active ? 'is-active' : ''} disabled:opacity-60`}
      style={lit ? ({ background: lit, color: '#101214', boxShadow: `0 0 14px 1px ${lit}88, inset 0 1px 0 rgba(255,255,255,.35)` } as CSSProperties) : undefined}
    >
      {label}
    </button>
  )
}

const FP_VARS = { '--case-1': '#34383d', '--case-2': '#24272b' } as CSSProperties

const FP_CSS = `
.fp-case { background: linear-gradient(180deg, var(--case-1), var(--case-2)); box-shadow: 0 22px 40px -18px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04), inset 0 2px 0 rgba(255,255,255,0.06), inset 0 -2px 0 rgba(0,0,0,0.4); color: #eceff2; }
.fp-silk { color: #eceff2; }
.fp-bezel { background: #0b0d0f; box-shadow: inset 0 2px 6px rgba(0,0,0,0.8), 0 1px 0 rgba(255,255,255,0.06); }
.fp-screen { background: #05080a; }
.fp-glass { background: linear-gradient(135deg, rgba(255,255,255,0.07), rgba(255,255,255,0.015) 35%, transparent 36%); }
.fp-group { border: 1px solid rgba(236,239,242,0.22); }
.fp-key { color: #eceff2; background: linear-gradient(180deg, #474c53, #33373c); box-shadow: inset 0 1px 0 rgba(255,255,255,0.18), 0 2px 0 #141619, 0 3px 6px rgba(0,0,0,0.35); transition: transform 150ms ease, box-shadow 150ms ease, background 200ms ease; }
.fp-key:active:not(:disabled) { transform: translateY(1px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.1), 0 1px 0 #141619; }
.fp-key.is-active { box-shadow: inset 0 1px 0 rgba(255,255,255,0.18), 0 2px 0 #141619, 0 0 0 2px #93c5fd; }
.fp-key:focus-visible { outline: 2px solid #93c5fd; outline-offset: 3px; }
@media (prefers-reduced-motion: reduce) { .fp-key { transition: none; } }
`

