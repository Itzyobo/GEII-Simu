/**
 * Panneau ADCC de MCC Classic (Easy Setup, libellés = H49) : Enable ADC, Result Alignment, références,
 * Clock Source, Clock (FOSC/2 à FOSC/128), TAD (alerte sous 1 µs, cours p. 98), Acquisition Count,
 * Enable ADC Interrupt ; voies : ligne ADCC ANx du Grid View, Custom Name dans Pin Module.
 */
import { INFO3 } from '../../data/reference'
import { updateAdcc, type MccConfig } from './config'
import { adcChannels, adccConversionS, adccTad, anName } from './adcc'
import { formatPeriod } from './timers'

const BYTE = (1 << INFO3.c.bitsPerByte) - 1

export default function AdccPanel({ config, onChange, head, field }: { config: MccConfig; onChange(c: MccConfig): void; head: string; field: string }) {
  const a = config.adcc
  if (!a) return null
  const set = (patch: Parameters<typeof updateAdcc>[1]) => onChange(updateAdcc(config, patch))
  const tad = adccTad(config, a)
  const low = tad < INFO3.adcc.minTadS * (1 - INFO3.vm.tickEpsilon)
  return (
    <>
      <div className={head}>ADCC — Easy Setup</div>
      <div className="grid gap-x-4 gap-y-1.5 p-3 text-xs sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
        <label className="col-span-full flex items-center gap-1.5">
          <input type="checkbox" checked={a.enabled} onChange={(e) => set({ enabled: e.target.checked })} /> Enable ADC
        </label>
        <label htmlFor="adc-al">Result Alignment</label>
        <select id="adc-al" className={field} value={a.alignment} onChange={(e) => set({ alignment: e.target.value as 'right' | 'left' })}>
          <option value="right">right</option>
          <option value="left">left</option>
        </select>
        <label htmlFor="adc-pref">Positive Reference</label>
        <select id="adc-pref" className={field} value="VDD" disabled>
          <option>VDD</option>
        </select>
        <label htmlFor="adc-nref">Negative Reference</label>
        <select id="adc-nref" className={field} value="VSS" disabled>
          <option>VSS</option>
        </select>
        <label htmlFor="adc-cs">Clock Source</label>
        <select id="adc-cs" className={field} value={a.clockSource} onChange={(e) => set({ clockSource: e.target.value as 'FOSC/ADCLK' | 'FRC' })}>
          <option>FOSC/ADCLK</option>
          <option>FRC</option>
        </select>
        <label htmlFor="adc-clk">Clock</label>
        <select id="adc-clk" className={field} value={a.divider} disabled={a.clockSource === 'FRC'} onChange={(e) => set({ divider: Number(e.target.value) })}>
          {INFO3.adcc.dividers.map((d) => (
            <option key={d} value={d}>
              FOSC/{d}
            </option>
          ))}
        </select>
        <span>TAD</span>
        <output className={`font-mono ${low ? 'font-semibold text-[#b71c1c]' : ''}`}>
          {formatPeriod(tad)}
          {low ? ` — inférieur à ${formatPeriod(INFO3.adcc.minTadS)} (cours p. 98)` : ''}
        </output>
        <label htmlFor="adc-acq">Acquisition Count</label>
        <input id="adc-acq" type="number" min={0} max={BYTE} className={`${field} w-24`} value={a.acquisition} onChange={(e) => set({ acquisition: Math.min(BYTE, Math.max(0, Math.round(Number(e.target.value) || 0))) })} />
        <span>Conversion Time</span>
        <output className="font-mono">{formatPeriod(adccConversionS(config, a))}</output>
        <label className="col-span-full flex items-center gap-1.5">
          <input type="checkbox" checked={a.interrupt} onChange={(e) => set({ interrupt: e.target.checked })} /> Enable ADC Interrupt
        </label>
        <p className="col-span-full text-[#777]">
          Voies : {adcChannels(config).map((p) => `${p.customName} (${anName(p.pin)})`).join(', ') || 'aucune'} — ligne ADCC ANx du Pin Manager: Grid View, Custom Name dans Pin Module.
        </p>
      </div>
    </>
  )
}
