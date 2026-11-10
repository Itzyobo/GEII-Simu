/**
 * Panneau CCP1 (mode PWM), PWM6 ou PWM7 de MCC Classic : Enable PWM, Timer Select, Duty Cycle, Output
 * Polarity (PWM6/7), CCPR Alignment (CCP1) ; période, fréquence et résolution obtenues (libellés = H42).
 */
import { TIMER_IDS, updatePwm, type MccConfig, type PwmId, type TimerId } from './config'
import { dutyValue, pwmSummary } from './pwm'

export default function PwmPanel({ id, config, onChange, head, field }: { id: PwmId; config: MccConfig; onChange(c: MccConfig): void; head: string; field: string }) {
  const c = config.pwm?.[id]
  if (!c) return null
  const set = (patch: Parameters<typeof updatePwm>[2]) => onChange(updatePwm(config, id, patch))
  const s = pwmSummary(config, c)
  const ccp = id === 'CCP1'
  return (
    <>
      <div className={head}>{ccp ? 'CCP1 — Easy Setup' : `${id} — Easy Setup`}</div>
      <div className="grid gap-x-4 gap-y-1.5 p-3 text-xs sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
        {ccp ? (
          <>
            <label htmlFor={`${id}-mode`}>CCP Mode</label>
            <select id={`${id}-mode`} className={field} value="PWM" disabled>
              <option>PWM</option>
            </select>
          </>
        ) : (
          <>
            <span>Enable PWM</span>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={c.enabled} onChange={(e) => set({ enabled: e.target.checked })} /> Enable PWM
            </label>
          </>
        )}
        <label htmlFor={`${id}-tmr`}>Timer Select</label>
        <select id={`${id}-tmr`} className={field} value={c.timer} onChange={(e) => set({ timer: e.target.value as TimerId })}>
          {TIMER_IDS.map((t) => (
            <option key={t} value={t}>
              {t.toLowerCase().replace('tmr', 'timer')}
            </option>
          ))}
        </select>
        <label htmlFor={`${id}-dc`}>Duty Cycle (%)</label>
        <input id={`${id}-dc`} type="number" min={0} max={100} step={0.1} className={`${field} w-24`} value={c.dutyCycle} onChange={(e) => set({ dutyCycle: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} />
        {ccp ? (
          <>
            <label htmlFor={`${id}-al`}>CCPR Alignment</label>
            <select id={`${id}-al`} className={field} value={c.alignment ?? 'right_aligned'} onChange={(e) => set({ alignment: e.target.value as 'right_aligned' | 'left_aligned' })}>
              <option value="right_aligned">right_aligned</option>
              <option value="left_aligned">left_aligned</option>
            </select>
          </>
        ) : (
          <>
            <label htmlFor={`${id}-pol`}>Output Polarity</label>
            <select id={`${id}-pol`} className={field} value={c.polarity} onChange={(e) => set({ polarity: e.target.value as 'active_hi' | 'active_lo' })}>
              <option value="active_hi">active_hi</option>
              <option value="active_lo">active_lo</option>
            </select>
          </>
        )}
        <span>Duty Cycle (10 bits)</span>
        <output className="font-mono">{dutyValue(config, c)}</output>
        <span>PWM Period</span>
        <output className="font-mono font-semibold">{s.period}</output>
        <span>PWM Frequency</span>
        <output className="font-mono">{s.frequency}</output>
        <span>PWM Resolution (bits)</span>
        <output className="font-mono">{s.resolution}</output>
        <p className="col-span-full text-[#777]">Broche de sortie : ligne {id} du Pin Manager: Grid View (PPS). La période se règle dans {c.timer} (Timer Period, PR2).</p>
      </div>
    </>
  )
}
