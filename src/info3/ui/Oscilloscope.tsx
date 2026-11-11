/**
 * Oscilloscope 2 voies du banc (canvas) : sondes sur TP16, TP17, TP19, TP20 de la carte fille ou sur une
 * broche du PIC, base de temps de 200 ns à 1 s/div, déclenchement sur front (voie, sens, niveau),
 * curseurs ΔT et 1/ΔT, période automatique, décodage SPI en option (CH1 = horloge, CH2 = données).
 * Les signaux viennent des changements datés envoyés par le Worker (voies demandées sous le nom « scope »).
 */
import { useEffect, useRef, useState } from 'react'
import { INFO3 } from '../../data/reference'
import { acquire, SCOPE_POINTS } from '../../lib/scope'
import { ALL_PINS } from '../models/gpio'
import { fmtNumberFr, fmtTime } from './analyzer'
import { autoPeriod, decodeSpi, findTriggerTime, signalOf, type TriggerEdge } from './scope'
import type { SimControls } from './useSim'

const S = INFO3.scope
const W = 1000
const H = 400
const CURSOR_STEPS = 1000
const COLORS = ['#facc15', '#22d3ee']
/** Zéro de chaque voie (en divisions depuis le haut) ; 1 V/div */
const ZERO_DIV = [3.8, 7.8]
const V_PER_DIV = 1
const DIV_X = W / S.divisions
const DIV_Y = H / S.verticalDivisions

const probeLabel = (pin: string) => {
  const tp = S.testPoints.find((p) => p.pin === pin)
  return tp ? `${tp.tp} (${tp.signal}, ${pin})` : pin
}

export default function Oscilloscope({ sim, defaults }: { sim: SimControls; defaults: [string, string] }) {
  const [probes, setProbes] = useState<string[]>(defaults)
  const [tbIndex, setTbIndex] = useState<number>(S.timebases.indexOf(2e-6))
  const [trig, setTrig] = useState<{ ch: number; edge: TriggerEdge; level: number }>({ ch: 0, edge: 'rising', level: S.triggerLevel })
  const [held, setHeld] = useState<number | null>(null)
  const [cursors, setCursors] = useState<[number, number]>([CURSOR_STEPS * 0.5, CURSOR_STEPS * 0.6])
  const [spi, setSpi] = useState<{ on: boolean; mode: number }>({ on: false, mode: 0 })
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const { setAnalyzer } = sim

  useEffect(() => {
    setAnalyzer('scope', probes)
  }, [probes, setAnalyzer])

  const span = S.timebases[tbIndex] * S.divisions
  const tEnd = held ?? sim.view.tSim
  const data = probes.map((p) => sim.trace.get(p))
  const tTrig = findTriggerTime(data[trig.ch], trig.edge, trig.level, tEnd, span)
  const t0 = tTrig === null ? tEnd - span : tTrig - span / 2
  const period = autoPeriod(data[trig.ch], t0, span)
  const bytes = spi.on ? decodeSpi(data[0], data[1], spi.mode, t0, t0 + span) : []
  const ct = cursors.map((c) => (c / CURSOR_STEPS) * span)
  const dt = Math.abs(ct[1] - ct[0])

  // Redessiné à chaque rendu (nouvelle image du Worker, réglage modifié)
  useEffect(() => {
    const cv = canvas.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx) return
    ctx.fillStyle = '#05080a'
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = '#1f2d26'
    ctx.lineWidth = 1
    for (let i = 0; i <= S.divisions; i++) {
      ctx.beginPath()
      ctx.moveTo(i * DIV_X, 0)
      ctx.lineTo(i * DIV_X, H)
      ctx.stroke()
    }
    for (let j = 0; j <= S.verticalDivisions; j++) {
      ctx.beginPath()
      ctx.moveTo(0, j * DIV_Y)
      ctx.lineTo(W, j * DIV_Y)
      ctx.stroke()
    }
    data.forEach((a, k) => {
      if (!a.length) return
      const v = acquire(signalOf(a), t0, span, SCOPE_POINTS)
      ctx.strokeStyle = COLORS[k]
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let i = 0; i < v.length; i++) {
        const x = (i / v.length) * W
        const y = (ZERO_DIV[k] - v[i] / V_PER_DIV) * DIV_Y
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    })
    ctx.fillStyle = '#e5e7eb'
    ctx.font = '22px monospace'
    for (const b of bytes) ctx.fillText(`0x${b.value.toString(16).toUpperCase().padStart(2, '0')}`, ((b.t - t0) / span) * W + 4, 26)
    ;[0, 1].forEach((i) => {
      ctx.strokeStyle = i ? '#f97316' : '#e5e7eb'
      ctx.setLineDash([8, 6])
      ctx.beginPath()
      ctx.moveTo((ct[i] / span) * W, 0)
      ctx.lineTo((ct[i] / span) * W, H)
      ctx.stroke()
      ctx.setLineDash([])
    })
    // Repère du déclenchement
    ctx.fillStyle = COLORS[trig.ch]
    ctx.fillRect(W / 2 - 3, 0, 6, 10)
  })

  const sel = 'rounded border border-line bg-card px-1 py-0.5'
  return (
    <details className="rounded-card bg-card p-3 ring-1 ring-line" open>
      <summary className="cursor-pointer text-sm font-semibold">Oscilloscope</summary>
      <div className="mt-2 space-y-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {probes.map((p, i) => (
            <label key={i} className="flex items-center gap-1">
              <span className="font-semibold" style={{ color: COLORS[i] }}>
                CH{i + 1}
              </span>
              <select aria-label={`Sonde CH${i + 1}`} className={sel} value={p} onChange={(e) => setProbes((ps) => ps.map((x, j) => (j === i ? e.target.value : x)))}>
                <optgroup label="Points de test">
                  {S.testPoints.map((tp) => (
                    <option key={tp.tp} value={tp.pin}>
                      {probeLabel(tp.pin)}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Broches du PIC">
                  {ALL_PINS.map((pin) => (
                    <option key={pin} value={pin}>
                      {pin}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1">
            Base de temps
            <select aria-label="Base de temps de l’oscilloscope" className={sel} value={tbIndex} onChange={(e) => setTbIndex(Number(e.target.value))}>
              {S.timebases.map((t, i) => (
                <option key={t} value={i}>
                  {fmtTime(t)}/div
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1">
            Déclenchement
            <select aria-label="Voie de déclenchement" className={sel} value={trig.ch} onChange={(e) => setTrig({ ...trig, ch: Number(e.target.value) })}>
              <option value={0}>CH1</option>
              <option value={1}>CH2</option>
            </select>
            <select aria-label="Front de déclenchement" className={sel} value={trig.edge} onChange={(e) => setTrig({ ...trig, edge: e.target.value as TriggerEdge })}>
              <option value="rising">montant</option>
              <option value="falling">descendant</option>
            </select>
            <input
              aria-label="Niveau de déclenchement (V)"
              type="number"
              step={0.1}
              min={0}
              max={S.vHigh}
              className={`${sel} w-16`}
              value={trig.level}
              onChange={(e) => setTrig({ ...trig, level: Math.min(S.vHigh, Math.max(0, Number(e.target.value) || 0)) })}
            />
            V
          </label>
          <button type="button" className="rounded-md px-2 py-0.5 ring-1 ring-line hover:bg-card-2" aria-pressed={held !== null} onClick={() => setHeld(held === null ? sim.view.tSim : null)}>
            {held === null ? 'Stop' : 'Run'}
          </button>
          <span className={tTrig === null ? 'text-warn' : 'text-ok'}>{tTrig === null ? 'Auto (pas de front)' : 'Trig’d'}</span>
        </div>
        <canvas ref={canvas} width={W} height={H} className="block h-auto w-full rounded" role="img" aria-label={`Écran : CH1 ${probeLabel(probes[0])}, CH2 ${probeLabel(probes[1])}, ${fmtTime(S.timebases[tbIndex])}/div, 1 V/div`} />
        <div className="grid gap-1 sm:grid-cols-2">
          {cursors.map((c, i) => (
            <label key={i} className="flex min-w-0 items-center gap-2">
              <span className="shrink-0">Curseur {i ? 'B' : 'A'}</span>
              <input
                type="range"
                aria-label={`Curseur ${i ? 'B' : 'A'} de l’oscilloscope`}
                min={0}
                max={CURSOR_STEPS}
                value={c}
                className="min-w-0 flex-1"
                onChange={(e) => setCursors((cs) => (i ? [cs[0], Number(e.target.value)] : [Number(e.target.value), cs[1]]))}
              />
            </label>
          ))}
        </div>
        <p className="tabular-nums" data-testid="scope-measures">
          ΔT = <span className="font-mono font-semibold">{fmtTime(dt)}</span>
          {dt > 0 && <span> · 1/ΔT = {fmtNumberFr(Number((1 / dt).toPrecision(4)))} Hz</span>}
          {' · '}Période CH{trig.ch + 1} : <span className="font-mono font-semibold">{Number.isFinite(period) ? fmtTime(period) : '—'}</span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={spi.on} onChange={(e) => setSpi({ ...spi, on: e.target.checked })} /> Décodage SPI (CH1 = SCK, CH2 = données)
          </label>
          <select aria-label="Mode SPI du décodage" className={sel} value={spi.mode} disabled={!spi.on} onChange={(e) => setSpi({ ...spi, mode: Number(e.target.value) })}>
            {INFO3.spi.modes.map((m) => (
              <option key={m.mode} value={m.mode}>
                mode {m.mode}
              </option>
            ))}
          </select>
          {spi.on && <span data-testid="scope-bytes" className="font-mono">{bytes.length ? bytes.map((b) => `0x${b.value.toString(16).toUpperCase().padStart(2, '0')}`).join(' ') : 'aucun octet à l’écran'}</span>}
        </div>
      </div>
    </details>
  )
}
