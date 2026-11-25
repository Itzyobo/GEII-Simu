/**
 * Oscilloscope numérique 2 voies réaliste : face avant (par défaut sur ordinateur) ou vue compacte
 * (par défaut sous 480 px), avec bascule visible. Même moteur pour les deux : components/scope/useScope.ts.
 * Le banc ne fournit que deux SignalSource (null = rien sur la BNC).
 */
import { useState, type ReactNode } from 'react'
import Knob from './Knob'
import { OSCILLO } from '../data/reference'
import { autoScale, defaultSetup, SDIV_STEPS, VDIV_STEPS } from '../lib/scope/engine'
import type { AcqMode, Ch, Coupling } from '../lib/scope/types'
import ScopeFrontPanel, { BncJack, CH_COLORS } from './scope/ScopeFrontPanel'
import { AVG_STEPS, CHS, COLORS, fr, MEASURES, OFFSET_DIV, STATUS_COLOR, useScope, zero, type ScopeApi, type ScopeProps } from './scope/useScope'

export type { ScopeZone } from './scope/useScope'

const { divY } = OSCILLO
/** Sous cette largeur d'écran, la vue compacte est proposée par défaut */
const COMPACT_MAX_PX = 480

export default function ScopeInstrument(props: ScopeProps) {
  const scope = useScope(props)
  const [view, setView] = useState<'face' | 'compact'>(() => (typeof window !== 'undefined' && window.innerWidth <= COMPACT_MAX_PX ? 'compact' : 'face'))
  return (
    <div className="min-w-0">
      <div role="group" aria-label="Affichage de l'oscilloscope" className="mb-2 flex justify-end">
        <div className="inline-flex overflow-hidden rounded-lg text-xs ring-1 ring-line">
          {(
            [
              ['face', 'Face avant'],
              ['compact', 'Compact'],
            ] as const
          ).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={view === k} onClick={() => setView(k)} className={`min-h-11 px-3 ${view === k ? 'bg-accent text-on-accent' : 'text-muted hover:text-ink'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>
      {view === 'face' ? <ScopeFrontPanel scope={scope} /> : <CompactView scope={scope} />}
    </div>
  )
}

/** Vue compacte (réglages en panneaux repliables) */
function CompactView({ scope }: { scope: ScopeApi }) {
  const { st, setSt, readout, cursorKey, setCursorKey, canvasRef, set, setCh, setTrig, setCur, setMode, setProbe, onDown, onMove, endDrag, nudgeCursor, dX, dY, measureValue, fiftyPct, span, sources, title } = scope
  return (
    <div className="rounded-card bg-card p-3 shadow-lg ring-1 ring-line">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="mr-auto font-semibold tracking-wide text-muted">{title}</span>
        <button
          type="button"
          onClick={() => setMode(readout.mode === 'stop' ? 'run' : 'stop')}
          className="min-h-11 rounded-md px-3 font-semibold text-black"
          style={{ background: readout.mode === 'stop' ? '#f87171' : '#3ee07a' }}
        >
          Run/Stop
        </button>
        <button type="button" onClick={() => setMode('single')} className={`min-h-11 rounded-md px-3 font-semibold ring-1 ring-line ${readout.mode === 'single' ? 'bg-[#fb923c] text-black' : ''}`}>
          Single
        </button>
        <button type="button" onClick={() => setSt(autoScale(sources, st, performance.now() / 1000))} className="min-h-11 rounded-md px-3 ring-1 ring-line hover:ring-accent">
          Auto Scale
        </button>
        <button
          type="button"
          onClick={() => {
            setSt(defaultSetup())
            setMode('run')
          }}
          className="min-h-11 rounded-md px-3 ring-1 ring-line hover:ring-accent"
        >
          Default Setup
        </button>
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-3">
        <div className="min-w-0">
          <div className="rounded-lg bg-screen p-1.5 ring-1 ring-black">
            {/* Bandeau du haut : horizontal, état, déclenchement */}
            <div className="flex flex-wrap gap-x-3 px-1 pb-1 font-mono text-[11px] text-[#d4d4d8]">
              <span>{fr(st.sdiv, 's')}/</span>
              <span>Δ {fr(st.delay, 's')}{st.ref === 'gauche' ? ' ◂' : ''}</span>
              <span style={{ color: STATUS_COLOR[readout.status] }}>{readout.status}</span>
              <span>{readout.fs ? `${fr(readout.fs, 'Sa/s')}` : ''}</span>
              <span style={{ color: COLORS[st.trig.source] }}>
                T {st.trig.slope === 'montant' ? '↑' : '↓'} {fr(st.trig.level, 'V')} {st.trig.mode === 'auto' ? 'Auto' : 'Norm'}
              </span>
              {readout.trigOff !== 0 && <span className="text-[#fb923c]">déclenchement hors écran {readout.trigOff < 0 ? '◂' : '▸'}</span>}
            </div>
            <canvas
              ref={canvasRef}
              className="block aspect-[5/4] w-full touch-none"
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={endDrag}
              aria-label="Écran de l'oscilloscope"
            />
            {/* Entrées BNC (points de branchement du banc) */}
            <div className="mt-1 flex items-center justify-end gap-4 rounded-md bg-[#24272b] px-2 py-1 text-[#eceff2]">
              <span className="mr-auto text-[10px] opacity-70">Entrées 1 MΩ</span>
              <BncJack label="CH1" color={CH_COLORS[0]} port="scope-ch1" />
              <BncJack label="CH2" color={CH_COLORS[1]} port="scope-ch2" />
            </div>
            {/* Bandeau du bas : voies */}
            <div className="flex flex-wrap gap-x-4 px-1 pt-1 font-mono text-[11px]">
              {CHS.map((c) =>
                st.ch[c].on ? (
                  <span key={c} style={{ color: COLORS[c] }}>
                    {c + 1} {fr(st.ch[c].vdiv, 'V')}/ {fr(zero(st.ch[c].offset), 'V')} centré {st.ch[c].coupling} {st.ch[c].probe}:1{readout.clipped[c] ? ' ⚠ écrêté' : ''}
                  </span>
                ) : null,
              )}
            </div>
            {(st.measures.kinds.length > 0 || st.cursors.on) && (
              <div className="mt-1 grid gap-0.5 px-1 font-mono text-[11px] text-[#e7e8ea]">
                {st.measures.kinds.length > 0 && (
                  <div className="flex flex-wrap gap-x-4" style={{ color: COLORS[st.measures.source] }}>
                    {MEASURES.filter((m) => st.measures.kinds.includes(m.kind)).map((m) => (
                      <span key={m.kind}>
                        {m.label}
                        {m.kind === 'retard' ? '' : `(${st.measures.source + 1})`} {Number.isFinite(measureValue(m.kind)) ? fr(measureValue(m.kind), m.unit) : '—'}
                      </span>
                    ))}
                  </div>
                )}
                {st.cursors.on && (
                  <div className="flex flex-wrap gap-x-4">
                    <span>ΔX {fr(dX, 's')}</span>
                    <span>1/ΔX {fr(1 / dX, 'Hz')}</span>
                    <span style={{ color: COLORS[st.cursors.ych] }}>ΔY({st.cursors.ych + 1}) {fr(dY, 'V')}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 grid gap-2 lg:mt-0 lg:content-start">
          <Panel title="Vertical" open>
            {CHS.map((c) => (
              <div key={c} className="flex flex-wrap items-end gap-2 rounded-lg bg-card-2 p-2">
                <div className="grid gap-1">
                  <button
                    type="button"
                    onClick={() => setCh(c, { on: !st.ch[c].on })}
                    aria-pressed={st.ch[c].on}
                    className="min-h-11 min-w-12 rounded-md px-2 font-mono text-xs font-semibold ring-1 ring-line"
                    style={st.ch[c].on ? { background: COLORS[c], color: '#111' } : undefined}
                  >
                    CH{c + 1}
                  </button>
                  <button type="button" onClick={() => setCh(c, { fine: !st.ch[c].fine })} aria-pressed={st.ch[c].fine} className={`min-h-11 rounded-md px-2 text-xs ring-1 ring-line ${st.ch[c].fine ? 'bg-accent text-on-accent' : 'text-muted'}`}>
                    Fin
                  </button>
                </div>
                {st.ch[c].fine ? (
                  <Knob label="V/div" value={st.ch[c].vdiv} onChange={(v) => setCh(c, { vdiv: v })} unit="V" min={OSCILLO.vdivMin * st.ch[c].probe} max={OSCILLO.vdivMax * st.ch[c].probe} step={1e-5} log color={COLORS[c]} />
                ) : (
                  <Knob label="V/div" value={st.ch[c].vdiv} onChange={(v) => setCh(c, { vdiv: v })} unit="V" steps={VDIV_STEPS.map((v) => v * st.ch[c].probe)} color={COLORS[c]} />
                )}
                <Knob
                  label="Position"
                  value={st.ch[c].offset}
                  onChange={(v) => setCh(c, { offset: v })}
                  unit="V"
                  min={-OFFSET_DIV * st.ch[c].vdiv}
                  max={OFFSET_DIV * st.ch[c].vdiv}
                  step={st.ch[c].vdiv / 50}
                  format={(v) => `${fr(zero(v), 'V')} centré`}
                  color={COLORS[c]}
                />
                <div className="grid gap-1">
                  <Seg<Coupling> value={st.ch[c].coupling} options={['DC', 'AC', 'GND']} onChange={(v) => setCh(c, { coupling: v })} label={`Couplage CH${c + 1}`} />
                  <Seg<1 | 10> value={st.ch[c].probe} options={[1, 10]} format={(p) => `${p}:1`} onChange={(p) => setProbe(c, p)} label={`Sonde CH${c + 1}`} />
                </div>
                <p className="w-full text-[11px] text-muted">Entrée 1 MΩ, BP 100 MHz. {sources[c] ? '' : 'Rien sur la BNC.'}</p>
              </div>
            ))}
          </Panel>

          <Panel title="Horizontal" open>
            <div className="flex flex-wrap items-end gap-2">
              <Knob label="s/div" value={st.sdiv} onChange={(v) => set({ sdiv: v })} unit="s" steps={SDIV_STEPS} />
              <Knob label="Retard" value={st.delay} onChange={(v) => set({ delay: v })} unit="s" min={-200 * st.sdiv} max={200 * st.sdiv} step={st.sdiv / 10} />
              <div className="grid gap-1">
                <button type="button" onClick={() => set({ delay: 0 })} className="min-h-11 rounded-md px-2 text-xs ring-1 ring-line">
                  Retard 0
                </button>
                <Seg value={st.ref} options={['centre', 'gauche'] as const} format={(r) => (r === 'centre' ? 'Réf. centre' : 'Réf. gauche')} onChange={(v) => set({ ref: v })} label="Référence de temps" />
              </div>
            </div>
            <p className="text-[11px] text-muted">Acquisition arrêtée : s/div et retard zooment dans l’enregistrement (sans gagner d’échantillons).</p>
          </Panel>

          <Panel title="Déclenchement" open>
            <div className="flex flex-wrap items-end gap-2">
              <div className="grid gap-1">
                <Seg<Ch> value={st.trig.source} options={[0, 1]} format={(c) => `CH${c + 1}`} onChange={(v) => setTrig({ source: v })} label="Source" />
                <Seg value={st.trig.slope} options={['montant', 'descendant'] as const} format={(v) => (v === 'montant' ? '↑ montant' : '↓ desc.')} onChange={(v) => setTrig({ slope: v })} label="Front" />
                <Seg value={st.trig.mode} options={['auto', 'normal'] as const} format={(v) => (v === 'auto' ? 'Auto' : 'Normal')} onChange={(v) => setTrig({ mode: v })} label="Mode" />
              </div>
              <Knob
                label="Niveau"
                value={st.trig.level}
                onChange={(v) => setTrig({ level: v })}
                unit="V"
                min={st.ch[st.trig.source].offset - (divY / 2) * st.ch[st.trig.source].vdiv}
                max={st.ch[st.trig.source].offset + (divY / 2) * st.ch[st.trig.source].vdiv}
                step={st.ch[st.trig.source].vdiv / 25}
                color={COLORS[st.trig.source]}
              />
              <button type="button" onClick={fiftyPct} className="min-h-11 rounded-md px-2 text-xs ring-1 ring-line">
                Niveau 50 %
              </button>
              <Knob label="Holdoff" value={st.trig.holdoff} onChange={(v) => setTrig({ holdoff: v })} unit="s" min={OSCILLO.holdoffMin} max={OSCILLO.holdoffMax} step={1e-9} log />
            </div>
          </Panel>

          <Panel title="Acquisition">
            <div className="flex flex-wrap items-end gap-2">
              <Seg<AcqMode> value={st.acq.mode} options={['normal', 'peak', 'moyenne']} format={(m) => ({ normal: 'Normal', peak: 'Peak Detect', moyenne: 'Moyenne' })[m]} onChange={(mode) => set({ acq: { ...st.acq, mode } })} label="Mode d'acquisition" />
              {st.acq.mode === 'moyenne' && <Knob label="Moyennes" value={st.acq.n} onChange={(n) => set({ acq: { ...st.acq, n } })} unit="" steps={AVG_STEPS} format={(n) => `× ${n}`} />}
            </div>
            <p className="text-[11px] text-muted">Peak Detect : min/max à 2 GSa/s entre deux points mémorisés. Moyenne : sur N acquisitions déclenchées.</p>
          </Panel>

          <Panel title="Curseurs">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setCur({ on: !st.cursors.on, x1: -span / 5, x2: span / 5 })} aria-pressed={st.cursors.on} className={`min-h-11 rounded-md px-3 text-xs font-semibold ring-1 ring-line ${st.cursors.on ? 'bg-accent text-on-accent' : ''}`}>
                {st.cursors.on ? 'Curseurs ON' : 'Curseurs OFF'}
              </button>
              <Seg value={cursorKey} options={['x1', 'x2', 'y1', 'y2'] as const} format={(k) => k.toUpperCase()} onChange={setCursorKey} label="Curseur actif" />
              <button type="button" onClick={() => nudgeCursor(-1)} disabled={!st.cursors.on} className="min-h-11 min-w-11 rounded-md ring-1 ring-line disabled:opacity-30" aria-label="Curseur : pas fin vers la gauche ou le bas">
                ◂
              </button>
              <button type="button" onClick={() => nudgeCursor(1)} disabled={!st.cursors.on} className="min-h-11 min-w-11 rounded-md ring-1 ring-line disabled:opacity-30" aria-label="Curseur : pas fin vers la droite ou le haut">
                ▸
              </button>
              <Seg<Ch> value={st.cursors.ych} options={[0, 1]} format={(c) => `Y sur CH${c + 1}`} onChange={(v) => setCur({ ych: v })} label="Voie des curseurs Y" />
            </div>
            <p className="text-[11px] text-muted">Glisser les barres à l’écran, puis ◂ ▸ pour le pas fin.</p>
          </Panel>

          <Panel title="Mesures">
            <Seg<Ch> value={st.measures.source} options={[0, 1]} format={(c) => `Source CH${c + 1}`} onChange={(v) => set({ measures: { ...st.measures, source: v } })} label="Source des mesures" />
            <div className="mt-2 flex flex-wrap gap-1">
              {MEASURES.map((m) => {
                const on = st.measures.kinds.includes(m.kind)
                return (
                  <button
                    key={m.kind}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set({ measures: { ...st.measures, kinds: on ? st.measures.kinds.filter((k) => k !== m.kind) : [...st.measures.kinds, m.kind] } })}
                    className={`min-h-11 rounded-md px-2 text-xs ring-1 ring-line ${on ? 'bg-accent text-on-accent' : ''}`}
                  >
                    {m.label}
                  </button>
                )
              })}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}


function Panel({ title, open, children }: { title: string; open?: boolean; children: ReactNode }) {
  return (
    <details open={open} className="rounded-lg ring-1 ring-line [&>summary]:min-h-11">
      <summary className="flex cursor-pointer items-center px-3 text-sm font-semibold">{title}</summary>
      <div className="grid gap-2 px-2 pb-2">{children}</div>
    </details>
  )
}

function Seg<T extends string | number>({ value, options, onChange, format = String, label }: { value: T; options: readonly T[]; onChange: (v: T) => void; format?: (v: T) => string; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex overflow-hidden rounded-md ring-1 ring-line">
      {options.map((o) => (
        <button key={String(o)} type="button" aria-pressed={o === value} onClick={() => onChange(o)} className={`min-h-11 px-2 text-xs ${o === value ? 'bg-accent text-on-accent' : 'text-muted hover:text-ink'}`}>
          {format(o)}
        </button>
      ))}
    </div>
  )
}

