/**
 * Panneau MSSP1 de MCC Classic (Easy Setup, libellés = H37) : Serial Protocol SPI, Mode Master, SPI Mode,
 * Input Data Sampled at, Clock Source, Clock Divider (SSP1ADD), fréquence de SCK obtenue.
 */
import { INFO3 } from '../../data/reference'
import { updateMssp, type MccConfig } from './config'
import { sckFrequency, usesDivider } from './spi'
import { formatFrequency } from './timers'

const BYTE_MAX = (1 << INFO3.c.bitsPerByte) - 1

export default function MsspPanel({ config, onChange, head, field }: { config: MccConfig; onChange(c: MccConfig): void; head: string; field: string }) {
  const m = config.mssp
  if (!m) return null
  const set = (patch: Parameters<typeof updateMssp>[1]) => onChange(updateMssp(config, patch))
  const f = sckFrequency(config, m)
  return (
    <>
      <div className={head}>MSSP1 — Easy Setup</div>
      <div className="grid gap-x-4 gap-y-1.5 p-3 text-xs sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
        <label htmlFor="mssp-proto">Serial Protocol</label>
        <select id="mssp-proto" className={field} value="SPI" disabled>
          <option>SPI</option>
        </select>
        <label htmlFor="mssp-role">Mode</label>
        <select id="mssp-role" className={field} value="Master" disabled>
          <option>Master</option>
        </select>
        <label htmlFor="mssp-mode">SPI Mode</label>
        <select id="mssp-mode" className={field} value={m.mode} onChange={(e) => set({ mode: Number(e.target.value) })}>
          {INFO3.spi.modes.map((x) => (
            <option key={x.mode} value={x.mode}>
              SPI Mode {x.mode}
            </option>
          ))}
        </select>
        <label htmlFor="mssp-smp">Input Data Sampled at</label>
        <select id="mssp-smp" className={field} value={m.sample} onChange={(e) => set({ sample: e.target.value })}>
          {INFO3.spi.sampleOptions.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <label htmlFor="mssp-cs">Clock Source</label>
        <select id="mssp-cs" className={field} value={m.clockSource} onChange={(e) => set({ clockSource: e.target.value })}>
          {INFO3.spi.clockSources.map((c) => (
            <option key={c.label}>{c.label}</option>
          ))}
        </select>
        <label htmlFor="mssp-div">Clock Divider</label>
        <input
          id="mssp-div"
          type="number"
          min={0}
          max={BYTE_MAX}
          className={`${field} w-24`}
          disabled={!usesDivider(m)}
          value={m.divider}
          onChange={(e) => set({ divider: Math.min(BYTE_MAX, Math.max(0, Math.round(Number(e.target.value) || 0))) })}
        />
        <span>SPI Clock Frequency</span>
        <output className="font-mono font-semibold">{f === null ? 'TMR2 absent du projet' : formatFrequency(f)}</output>
        <p className="col-span-full text-[#777]">Broches SCK1, SDI1, SDO1 : lignes MSSP1 du Pin Manager: Grid View (PPS).</p>
      </div>
    </>
  )
}
