/**
 * Panneau TMR2 / TMR4 / TMR6 de MCC Classic, libellés des captures du CR TP3 : Hardware Settings,
 * Timer Clock, Timer Period, Software Settings. Tous les calculs viennent de timers.ts (testé).
 */
import { useState } from 'react'
import { INFO3 } from '../../data/reference'
import { updateTimer, type MccConfig, type TimerConfig, type TimerId } from './config'
import {
  actualPeriod,
  CONTROL_MODES,
  displayedClock,
  formatFrequency,
  formatPeriod,
  label,
  parsePeriod,
  periodRange,
  POSTSCALERS,
  PRESCALERS,
  setControlMode,
  startOptions,
} from './timers'

interface Props {
  id: TimerId
  config: MccConfig
  onChange(cfg: MccConfig): void
  head: string
  field: string
}

export default function TimerPanel({ id, config, onChange, head, field }: Props) {
  const t = config.timers?.[id]
  const [draft, setDraft] = useState<string | null>(null)
  if (!t) return null
  const set = (patch: Partial<TimerConfig>) => onChange(updateTimer(config, id, patch))
  const range = periodRange(config, t)
  const typed = draft === null ? null : parsePeriod(draft)
  const periodError = draft === null ? null : typed === null ? 'Valeur illisible (ex. 10 ms)' : typed < range.min || typed > range.max ? 'Hors de la plage autorisée' : null
  const commit = () => {
    if (draft !== null && typed !== null && !periodError) set({ periodS: typed })
    setDraft(null)
  }
  const mono = t.controlMode === 'Monostable'
  const sub = 'col-span-full mt-1 border-b border-[#ddd] pb-0.5 font-semibold'
  const lbl = (s: string) => `${id}-${s}`

  return (
    <>
      <div className={head}>{id}</div>
      <div className="grid gap-x-4 gap-y-1.5 p-3 text-xs sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
        <div className={sub}>Hardware Settings</div>
        <label className="col-span-full flex items-center gap-1.5">
          <input type="checkbox" checked={t.enabled} onChange={(e) => set({ enabled: e.target.checked })} /> Enable Timer
        </label>
        <label htmlFor={lbl('mode')}>Control Mode</label>
        <select id={lbl('mode')} className={field} value={t.controlMode} onChange={(e) => onChange(setControlMode(config, id, e.target.value))}>
          {CONTROL_MODES.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <label htmlFor={lbl('ers')}>Ext Reset Source</label>
        <select id={lbl('ers')} className={field} value={t.ersSource} onChange={(e) => set({ ersSource: e.target.value })}>
          {INFO3.timers.ersSources.map((s) => (
            <option key={s.label} value={s.label}>
              {label(s.label, id)}
            </option>
          ))}
        </select>
        <label htmlFor={lbl('start')}>Start/Reset Option</label>
        <select id={lbl('start')} className={field} value={t.startOption} onChange={(e) => set({ startOption: e.target.value })}>
          {startOptions(t.controlMode).map((s) => (
            <option key={s} value={s}>
              {label(s, id)}
            </option>
          ))}
        </select>

        <div className={sub}>Timer Clock</div>
        <label htmlFor={lbl('cs')}>Clock Source</label>
        <select id={lbl('cs')} className={field} value={t.clockSource} onChange={(e) => set({ clockSource: e.target.value })}>
          {INFO3.timers.clockSources.map((s) => (
            <option key={s.label}>{s.label}</option>
          ))}
        </select>
        <label className="col-span-full flex items-center gap-1.5">
          <input type="checkbox" checked={t.clockSync} onChange={(e) => set({ clockSync: e.target.checked })} /> Enable Clock Sync
        </label>
        <label htmlFor={lbl('freq')}>Clock Frequency</label>
        <input id={lbl('freq')} className={field} disabled readOnly value={formatFrequency(displayedClock(config, t))} title="Lecture seule : 32.768 kHz affiché pour LFINTOSC, calculs faits avec 31 kHz (cours p. 64)" />
        <label htmlFor={lbl('pol')}>Polarity</label>
        <select id={lbl('pol')} className={field} value={t.polarity} onChange={(e) => set({ polarity: e.target.value })}>
          {INFO3.timers.polarities.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <label htmlFor={lbl('pre')}>Prescaler</label>
        <select id={lbl('pre')} className={field} value={t.prescaler} onChange={(e) => set({ prescaler: Number(e.target.value) })}>
          {PRESCALERS.map((p) => (
            <option key={p} value={p}>
              1:{p}
            </option>
          ))}
        </select>
        <label className="col-span-full flex items-center gap-1.5">
          <input type="checkbox" checked={t.prescalerSync} onChange={(e) => set({ prescalerSync: e.target.checked })} /> Enable Prescaler O/P Sync
        </label>
        <label htmlFor={lbl('post')}>Postscaler</label>
        <select id={lbl('post')} className={field} value={mono ? 1 : t.postscaler} disabled={mono} title={mono ? 'Monostable : postscaler 1:1 imposé' : ''} onChange={(e) => set({ postscaler: Number(e.target.value) })}>
          {POSTSCALERS.map((p) => (
            <option key={p} value={p}>
              1:{p}
            </option>
          ))}
        </select>

        <div className={sub}>Timer Period</div>
        <label htmlFor={lbl('period')}>Timer Period</label>
        <div className="min-w-0">
          <input
            id={lbl('period')}
            className={`${field} w-32 ${periodError ? 'border-[#d32f2f] bg-[#ffebee]' : ''}`}
            value={draft ?? formatPeriod(t.periodS)}
            aria-invalid={!!periodError}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && commit()}
          />
          <span className="ml-2 text-[#555]">
            {formatPeriod(range.min)} ≤ Timer Period ≤ {formatPeriod(range.max)}
          </span>
          {periodError && <p className="text-[#b71c1c]">{periodError}</p>}
        </div>
        <span>Actual Period</span>
        <output className="font-mono">{formatPeriod(actualPeriod(config, t))}</output>
        <p className="col-span-full text-[#777]">(Period calculated via Timer Period)</p>

        <div className={sub}>Software Settings</div>
        <label className="col-span-full flex items-center gap-1.5">
          <input type="checkbox" checked={t.interrupt} onChange={(e) => set({ interrupt: e.target.checked })} /> Enable Timer Interrupt
        </label>
      </div>
    </>
  )
}
