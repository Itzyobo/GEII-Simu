/** Réglages : saisie du vrai format de SERIE_2 quand il est connu (remplace le tirage H3, lève le badge de 2.2). */
import { useState } from 'react'
import { REF, type Parity } from '../data/reference'
import { PARITE_LABEL } from '../models/answers'
import { dispatch, useStore } from '../lib/store'
import type { Liaison } from '../models/uart'

export default function Reglages() {
  const { serie2 } = useStore()
  const [f, setF] = useState<Liaison>(serie2.reel ?? { baud: REF.serie2Candidats.value.bauds[0]!, dataBits: 8, parity: 'none', stopBits: 1 })
  const input = 'min-h-10 rounded-md bg-card px-2 ring-1 ring-line'

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">Réglages</h1>
      <section className="mt-6 rounded-card bg-card p-4 ring-1 ring-line">
        <h2 className="font-semibold">Vrai format de SERIE_2</h2>
        <p className="mt-1 text-sm text-muted">
          Tant qu’il n’est pas saisi, SERIE_2 émet dans un format tiré au sort pour la session (H3) et la question 2.2 porte le badge « valeur non vérifiée ». État actuel :{' '}
          <b>{serie2.reel ? 'format réel saisi' : 'format tiré au sort'}</b>.
        </p>
        <form
          className="mt-3 flex flex-wrap items-end gap-3 text-sm"
          onSubmit={(e) => {
            e.preventDefault()
            dispatch({ type: 'serie2Reel', reel: f })
          }}
        >
          <label className="flex flex-col gap-1">
            Débit (bauds)
            <input type="number" min={1} value={f.baud} onChange={(e) => setF({ ...f, baud: Number(e.target.value) })} className={`${input} w-28`} />
          </label>
          <label className="flex flex-col gap-1">
            Bits de données
            <select value={f.dataBits} onChange={(e) => setF({ ...f, dataBits: Number(e.target.value) as 7 | 8 })} className={input}>
              <option value={7}>7</option>
              <option value={8}>8</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            Parité
            <select value={f.parity} onChange={(e) => setF({ ...f, parity: e.target.value as Parity })} className={input}>
              {(Object.entries(PARITE_LABEL) as [Parity, string][]).map(([p, l]) => (
                <option key={p} value={p}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            Bits de stop
            <select value={f.stopBits} onChange={(e) => setF({ ...f, stopBits: Number(e.target.value) as 1 | 2 })} className={input}>
              <option value={1}>1</option>
              <option value={2}>2</option>
            </select>
          </label>
          <button type="submit" disabled={!(f.baud > 0)} className="min-h-10 rounded-lg bg-accent px-4 font-semibold text-on-accent disabled:opacity-40">
            Enregistrer
          </button>
          {serie2.reel && (
            <button type="button" onClick={() => dispatch({ type: 'serie2Reel', reel: null })} className="min-h-10 rounded-lg px-4 ring-1 ring-line">
              Revenir au tirage
            </button>
          )}
        </form>
      </section>
    </main>
  )
}
