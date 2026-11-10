/**
 * Terminal série du PC (port COM virtuel de l'USB blanc, H12) : baud et format, affichage de \r et \n en
 * option, horodatage en option, Effacer, envoi d'une ligne. Les octets sont décodés dans le Worker au baud
 * du terminal (H47) : un baud différent de celui du PIC donne des caractères corrompus.
 */
import { useState } from 'react'
import { INFO3 } from '../../data/reference'
import { terminalText } from '../models/terminal'
import type { SimControls } from './useSim'

const T = INFO3.terminal
const LF = 0x0a

/** Texte avec un horodatage (s simulées) en tête de chaque ligne */
function stamped(bytes: number[], times: number[], showControl: boolean): string {
  let out = ''
  let line: number[] = []
  let t0: number | null = null
  const flush = () => {
    if (!line.length) return
    out += `[${(t0 ?? 0).toFixed(3).replace('.', ',')} s] ${terminalText(line, showControl)}`
    line = []
    t0 = null
  }
  bytes.forEach((b, i) => {
    if (t0 === null) t0 = times[i]
    line.push(b)
    if (b === LF) flush()
  })
  flush()
  return out
}

export default function Terminal({ sim, connected }: { sim: SimControls; connected: boolean }) {
  const [baud, setBaud] = useState<number>(T.defaultBaud)
  const [format, setFormat] = useState<string>(T.defaultFormat)
  const [showControl, setShowControl] = useState(false)
  const [stamp, setStamp] = useState(false)
  const [line, setLine] = useState('')
  const { bytes, t } = sim.view.serial
  const text = stamp ? stamped(bytes, t, showControl) : terminalText(bytes, showControl)
  const field = 'rounded border border-line bg-card px-1 py-0.5 text-xs'
  return (
    <section className="space-y-2 rounded-card bg-card p-3 ring-1 ring-line" aria-label="Terminal série">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <h3 className="text-sm font-semibold">Terminal</h3>
        <span className={connected ? 'text-ok' : 'text-muted'}>{connected ? 'COM (USB blanc) ouvert' : 'Aucun port COM : brancher l’USB blanc'}</span>
        <label className="ml-auto flex items-center gap-1">
          Baud
          <select
            aria-label="Baud du terminal"
            className={field}
            value={baud}
            onChange={(e) => {
              const b = Number(e.target.value)
              setBaud(b)
              sim.setTerminal(b, format)
            }}
          >
            {INFO3.eusart.bauds.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          Format
          <select
            aria-label="Format du terminal"
            className={field}
            value={format}
            onChange={(e) => {
              setFormat(e.target.value)
              sim.setTerminal(baud, e.target.value)
            }}
          >
            {T.formats.map((f) => (
              <option key={f.id}>{f.id}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={showControl} onChange={(e) => setShowControl(e.target.checked)} /> Afficher \r et \n
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={stamp} onChange={(e) => setStamp(e.target.checked)} /> Horodatage
        </label>
        <button type="button" onClick={() => sim.clearSerial()} className="ml-auto rounded border border-line px-2 py-0.5 hover:bg-card-2">
          Effacer
        </button>
      </div>
      <pre aria-label="Écran du terminal" aria-live="polite" className="h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-screen p-2 font-mono text-xs text-[#d8e2dc]">
        {connected ? text : ''}
      </pre>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!line) return
          sim.sendSerial([...line].map((c) => c.charCodeAt(0) & ((1 << INFO3.c.bitsPerByte) - 1)))
          setLine('')
        }}
      >
        <input aria-label="Texte à envoyer" disabled={!connected} className={`${field} min-w-0 flex-1`} value={line} onChange={(e) => setLine(e.target.value)} placeholder="Envoyer au PIC (RX)" />
        <button type="submit" disabled={!connected || !line} className="rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-on-accent disabled:opacity-40">
          Envoyer
        </button>
      </form>
    </section>
  )
}
