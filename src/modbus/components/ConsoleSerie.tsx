/**
 * Console du PC n°1 : lance SERIE_1, SERIE_2 ou SERIE_3 (dossier Documentation technique\RES3\Serie).
 * SERIE_1 et SERIE_2 demandent l'octet en deux chiffres hexadécimaux (H28 pour SERIE_2).
 * Le programme n'émet que si le câblage a été vérifié (store) et le commutateur sur « contrôle de flux » (H18).
 */
import { useState } from 'react'
import { ACTIVITY_LABEL, dispatch, useStore, type Activity } from '../lib/store'
import UnverifiedBadge from './UnverifiedBadge'

const hex2 = (b: number) => b.toString(16).toUpperCase().padStart(2, '0')
const nouvelleGraine = () => Math.floor(Math.random() * 2 ** 31)
const PROMPT = 'C:\\Documentation technique\\RES3\\Serie>'

export default function ConsoleSerie() {
  const s = useStore()
  const act = s.session.activity
  const prog = act === 'realterm' ? 'serie3' : act
  const [saisie, setSaisie] = useState(() => hex2(prog === 'serie2' ? s.octets.serie2 : s.octets.serie1))
  const [erreur, setErreur] = useState<string | null>(null)
  const demandeOctet = prog === 'serie1' || prog === 'serie2'
  const nom = ACTIVITY_LABEL[prog]

  const choisir = (a: Activity) => {
    dispatch({ type: 'activity', activity: a })
    if (a === 'serie2') dispatch({ type: 'serie2Graine', graine: nouvelleGraine() })
    setErreur(null)
    const p = a === 'realterm' ? 'serie3' : a
    if (p === 'serie1' || p === 'serie2') setSaisie(hex2(s.octets[p]))
  }
  const valider = () => {
    if (demandeOctet) {
      if (!/^[0-9a-f]{2}$/i.test(saisie.trim())) return setErreur('Deux chiffres hexadécimaux attendus (ex. 55).')
      dispatch({ type: 'octet', programme: prog, value: parseInt(saisie.trim(), 16) })
    }
    setErreur(null)
    dispatch({ type: 'startEmission' })
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Programme du PC n°1">
        {(Object.keys(ACTIVITY_LABEL) as Activity[]).map((a) => (
          <button
            key={a}
            type="button"
            role="radio"
            aria-checked={act === a}
            disabled={s.bus.active}
            onClick={() => choisir(a)}
            className={`min-h-10 rounded-lg px-3 text-sm ring-1 disabled:opacity-40 ${act === a ? 'bg-white text-black ring-white' : 'ring-white/20 hover:bg-white/10'}`}
          >
            {ACTIVITY_LABEL[a]}
          </button>
        ))}
      </div>
      <div className="overflow-hidden rounded-md ring-1 ring-black">
        <p className="truncate bg-gradient-to-r from-[#000080] to-[#1084d0] px-2 py-0.5 text-xs font-bold text-white">C:\WINDOWS\system32\cmd.exe — {nom}</p>
        <div className="min-h-36 bg-black p-2 font-mono text-[12px] leading-5 break-words text-neutral-200">
          <p>
            {PROMPT} {nom}
          </p>
          {s.bus.active ? (
            <>
              <p>{demandeOctet ? `Caractère ${hex2(s.octets[prog])}H transmis périodiquement sur COM1.` : 'Trame transmise périodiquement sur COM1.'}</p>
              {!s.wiring.flow.c1 && <p className="text-amber-300">Commutateur hors « contrôle de flux » : rien ne sort sur TXD.</p>}
              <p className="animate-pulse">_</p>
            </>
          ) : demandeOctet ? (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                valider()
              }}
            >
              <label>
                Caractère à émettre (2 chiffres hexadécimaux) :{' '}
                <input value={saisie} onChange={(e) => setSaisie(e.target.value)} maxLength={2} aria-label="Caractère à émettre" className="w-10 bg-neutral-800 px-1 text-white uppercase outline-none focus:ring-1 focus:ring-white" />
              </label>
            </form>
          ) : (
            <p>Appuyez sur Valider pour lancer l’émission.</p>
          )}
          {erreur && <p className="text-red-400">{erreur}</p>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {s.bus.active ? (
          <button type="button" onClick={() => dispatch({ type: 'stopEmission' })} className="min-h-10 rounded-lg bg-red-600 px-4 text-sm font-semibold">
            Arrêter (Ctrl+C)
          </button>
        ) : (
          <button type="button" onClick={valider} className="min-h-10 rounded-lg bg-emerald-600 px-4 text-sm font-semibold">
            Valider
          </button>
        )}
        {prog === 'serie2' && <UnverifiedBadge deps={s.serie2.reel ? ['serie2SaisieOctet'] : ['serie2Format', 'serie2SaisieOctet']} />}
        {prog === 'serie1' && <UnverifiedBadge deps={['serie1StopBits', 'serie1Repetition']} />}
      </div>
    </div>
  )
}
