/**
 * RealTerm réduit (PC n°2, 2.4) : réglages de réception et texte reçu en continu, avec compteurs d'erreurs.
 * Fenêtre complète non photographiée : reconstituée (H31). Chaque période du programme du PC n°1, on décode
 * ce qui arrive sur RXD de la carte 2 (rien sans câble croisé).
 */
import { useEffect, useRef, useState } from 'react'
import { REF, type Parity } from '../data/reference'
import { emitting } from '../lib/bench'
import { dispatch, useStore } from '../lib/store'
import { realtermReceive, realtermText, type RealtermSettings } from '../models/serie'
import UnverifiedBadge from './UnverifiedBadge'

const MAX_TEXTE = 600
const PARITES: [Parity, string][] = [
  ['none', 'None'],
  ['even', 'Even'],
  ['odd', 'Odd'],
]

export default function RealTerm() {
  const s = useStore()
  const rt = s.realterm
  const [recu, setRecu] = useState({ texte: '', trame: 0, parite: 0, car: 0 })
  const latest = useRef(s)
  useEffect(() => {
    latest.current = s
  })

  useEffect(() => {
    const id = window.setInterval(() => {
      const st = latest.current
      const rx = realtermReceive(emitting(st), st.wiring.serialCable, st.realterm)
      if (rx.length === 0) return
      setRecu((r) => ({
        texte: (r.texte + realtermText(rx)).slice(-MAX_TEXTE),
        trame: r.trame + rx.filter((c) => c.framingError).length,
        parite: r.parite + rx.filter((c) => c.parityError).length,
        car: r.car + rx.length,
      }))
    }, REF.serie3Repetition.value * 1000)
    return () => window.clearInterval(id)
  }, [])

  const set = (patch: Partial<RealtermSettings>) => dispatch({ type: 'realterm', patch })
  const sel = 'min-h-9 rounded-sm bg-white px-1 text-black ring-1 ring-neutral-500'

  return (
    <div className="overflow-hidden rounded-md bg-[#d4d0c8] text-[12px] text-black ring-1 ring-black">
      <p className="bg-gradient-to-r from-[#000080] to-[#1084d0] px-2 py-0.5 font-bold text-white">RealTerm: Serial Capture Program</p>
      <pre aria-label="Texte reçu" aria-live="off" className="m-1 h-24 overflow-y-auto bg-black p-1 font-mono break-all whitespace-pre-wrap text-yellow-300">
        {recu.texte || ' '}
      </pre>
      <div className="flex flex-wrap items-end gap-x-3 gap-y-1 px-2 pb-1">
        <label className="flex flex-col">
          Port
          <select aria-label="Port" value={rt.port} onChange={(e) => set({ port: e.target.value })} className={sel}>
            {REF.realtermPorts.value.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col">
          Baud
          <select aria-label="Baud" value={rt.baud} onChange={(e) => set({ baud: Number(e.target.value) })} className={sel}>
            {REF.realtermBauds.value.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </label>
        <fieldset className="flex items-center gap-1">
          <legend>Data Bits</legend>
          {([7, 8] as const).map((n) => (
            <label key={n} className="flex min-h-9 items-center gap-0.5">
              <input type="radio" name="rt-bits" checked={rt.dataBits === n} onChange={() => set({ dataBits: n })} />
              {n}
            </label>
          ))}
        </fieldset>
        <fieldset className="flex items-center gap-1">
          <legend>Parity</legend>
          {PARITES.map(([p, label]) => (
            <label key={p} className="flex min-h-9 items-center gap-0.5">
              <input type="radio" name="rt-parity" checked={rt.parity === p} onChange={() => set({ parity: p })} />
              {label}
            </label>
          ))}
        </fieldset>
        <fieldset className="flex items-center gap-1">
          <legend>Stop Bits</legend>
          {([1, 2] as const).map((n) => (
            <label key={n} className="flex min-h-9 items-center gap-0.5">
              <input type="radio" name="rt-stop" checked={rt.stopBits === n} onChange={() => set({ stopBits: n })} />
              {n}
            </label>
          ))}
        </fieldset>
        <button type="button" onClick={() => setRecu({ texte: '', trame: 0, parite: 0, car: 0 })} className="min-h-9 border-2 border-t-white border-l-white border-r-[#404040] border-b-[#404040] bg-[#d4d0c8] px-2">
          Clear
        </button>
      </div>
      <p className="border-t border-neutral-400 px-2 py-0.5" role="status">
        Caractères : {recu.car} · Erreurs de trame : <b>{recu.trame}</b> · Erreurs de parité : <b>{recu.parite}</b>
        <UnverifiedBadge deps={['realtermPorts']} />
      </p>
    </div>
  )
}
