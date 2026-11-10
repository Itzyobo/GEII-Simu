/**
 * Panneau EUSART de MCC Classic (Easy Setup, libellés = H43) : Mode asynchrone, Enable EUSART, Enable
 * Transmit, Enable Receive, Baud Rate, 8 bits, « Redirect STDIO to USART » (cours p. 110), Enable EUSART
 * Interrupts ; baud réel et erreur (au-delà de 5 % : signalé, cours p. 107).
 */
import { INFO3 } from '../../data/reference'
import { updateEusart, type MccConfig } from './config'
import { eusartBaud, fmtPercent } from './eusart'

export default function EusartPanel({ config, onChange, head, field }: { config: MccConfig; onChange(c: MccConfig): void; head: string; field: string }) {
  const e = config.eusart
  if (!e) return null
  const set = (patch: Parameters<typeof updateEusart>[1]) => onChange(updateEusart(config, patch))
  const { actual, error } = eusartBaud(config, e)
  const bad = Math.abs(error) > INFO3.eusart.maxErrorRatio
  const box = (label: string, checked: boolean, k: 'enable' | 'transmit' | 'receive' | 'redirectStdio' | 'interrupts') => (
    <label className="col-span-full flex items-center gap-1.5">
      <input type="checkbox" checked={checked} onChange={(x) => set({ [k]: x.target.checked })} /> {label}
    </label>
  )
  return (
    <>
      <div className={head}>EUSART — Easy Setup</div>
      <div className="grid gap-x-4 gap-y-1.5 p-3 text-xs sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
        <label htmlFor="eu-mode">Mode</label>
        <select id="eu-mode" className={field} value="asynchronous" disabled>
          <option>asynchronous</option>
        </select>
        {box('Enable EUSART', e.enable, 'enable')}
        {box('Enable Transmit', e.transmit, 'transmit')}
        {box('Enable Receive', e.receive, 'receive')}
        <label htmlFor="eu-baud">Baud Rate</label>
        <select id="eu-baud" className={field} value={e.baud} onChange={(x) => set({ baud: Number(x.target.value) })}>
          {INFO3.eusart.bauds.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <label htmlFor="eu-bits">Transmission Bits</label>
        <select id="eu-bits" className={field} value="8-bit" disabled>
          <option>8-bit</option>
        </select>
        <span>Error</span>
        <output className={`font-mono ${bad ? 'font-semibold text-[#b71c1c]' : ''}`}>
          {Math.round(actual)} bauds réels ({fmtPercent(error)}){bad ? ' — écart supérieur à 5 %' : ''}
        </output>
        {box('Redirect STDIO to USART', e.redirectStdio, 'redirectStdio')}
        {box('Enable EUSART Interrupts', e.interrupts, 'interrupts')}
        <p className="col-span-full text-[#777]">Broches TX1 et RX1 : lignes EUSART du Pin Manager: Grid View (PPS). BRG16 = BRGH = 1 : SP1BRG = Fosc / (4 × baud) − 1.</p>
      </div>
    </>
  )
}
