/**
 * Mode partiel : sujet tiré au sort (graine affichée, rejouable), chronomètre calculé depuis l'heure de début,
 * aucun indice ni correction avant le rendu ; puis note globale, note par attendu et correction complète.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { REF } from '../data/reference'
import Chronogramme from '../components/Chronogramme'
import UnverifiedBadge from '../components/UnverifiedBadge'
import { genererSujet, noter, tempsRestant, type ItemPartiel, type Sujet } from '../lib/partiel'
import { dispatch, useStore, type Partiel } from '../lib/store'
import { toHex } from '../models/crc'

const maintenant = () => Date.now()
const nouvelleGraine = () => Math.floor(Math.random() * 1e6)
const fr = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 })
const BLOCS: { id: ItemPartiel['bloc']; titre: string }[] = [
  { id: 'message', titre: '1. Message codé' },
  { id: 'trame', titre: '2. Trame Modbus à écrire' },
  { id: 'reponse', titre: '3. Réponse à interpréter' },
  { id: 'cours', titre: '4. Questions de cours' },
]

export default function PagePartiel() {
  const { partiel } = useStore()
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold">Mode partiel</h1>
      {!partiel ? <Lancement /> : partiel.rendu ? <Correction p={partiel} /> : <Epreuve p={partiel} />}
    </main>
  )
}

function Lancement() {
  const [graine, setGraine] = useState(nouvelleGraine)
  const [minutes, setMinutes] = useState(String(REF.partielDuree.value / 60))
  const [manip, setManip] = useState(false)
  const input = 'min-h-10 rounded-md bg-card px-2 ring-1 ring-line'
  return (
    <form
      className="mt-4 space-y-3 rounded-card bg-card p-4 ring-1 ring-line"
      onSubmit={(e) => {
        e.preventDefault()
        const m = Number(minutes.replace(',', '.'))
        if (m > 0) dispatch({ type: 'partielDebut', graine, duree: Math.round(m * 60), manip, maintenant: maintenant() })
      }}
    >
      <p className="text-sm text-muted">
        Un chronogramme à décoder, une trame Modbus à écrire, une réponse à interpréter, trois questions de cours et, en option, une manipulation au banc. Pas d’indice ni de correction
        avant le rendu ; les badges « valeur non vérifiée » restent affichés.
        <UnverifiedBadge deps={['partielDuree', 'partielBareme']} />
      </p>
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          Graine du sujet
          <input type="number" min={0} value={graine} onChange={(e) => setGraine(Number(e.target.value))} className={`${input} w-32 font-mono`} />
        </label>
        <label className="flex flex-col gap-1">
          Durée (minutes)
          <input inputMode="decimal" value={minutes} onChange={(e) => setMinutes(e.target.value)} className={`${input} w-24`} />
        </label>
        <label className="flex min-h-10 items-center gap-2">
          <input type="checkbox" checked={manip} onChange={(e) => setManip(e.target.checked)} className="size-4" />
          Avec la manipulation au banc
        </label>
        <button type="submit" className="min-h-10 rounded-lg bg-accent px-4 font-semibold text-on-accent">
          Commencer
        </button>
      </div>
    </form>
  )
}

function Epreuve({ p }: { p: Partiel }) {
  const sujet = genererSujet(p.graine, p.manip)
  const [now, setNow] = useState(maintenant)
  const restant = Math.max(0, tempsRestant(p, now))
  useEffect(() => {
    const id = window.setInterval(() => setNow(maintenant()), 1000)
    return () => window.clearInterval(id)
  }, [])
  // Fin du chrono, y compris si la page est rouverte après l'heure
  useEffect(() => {
    if (tempsRestant(p, now) <= 0) dispatch({ type: 'partielRendre', maintenant: now })
  }, [p, now])
  const mm = Math.floor(restant / 60)
  const ss = Math.floor(restant % 60)

  return (
    <>
      <div className="sticky top-0 z-10 mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-card-2 p-3 text-sm ring-1 ring-line">
        <span className="font-mono text-lg font-bold" role="timer" aria-label="Temps restant">
          {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
        </span>
        <span className="text-muted">graine {p.graine}</span>
        <span className="flex-1" />
        <button type="button" onClick={() => dispatch({ type: 'partielRendre', maintenant: maintenant() })} className="min-h-10 rounded-lg bg-accent px-4 font-semibold text-on-accent">
          Rendre
        </button>
      </div>
      {BLOCS.map((b) => (
        <section key={b.id} className="mt-6 rounded-card bg-card p-4 ring-1 ring-line">
          <h2 className="font-semibold">{b.titre}</h2>
          <Enonce sujet={sujet} bloc={b.id} />
          <div className="mt-3 space-y-3">
            {sujet.items
              .filter((it) => it.bloc === b.id)
              .map((it) => (
                <Champ key={it.id} item={it} value={p.reponses[it.id] ?? ''} />
              ))}
          </div>
        </section>
      ))}
      {p.manip && (
        <section className="mt-6 rounded-card bg-card p-4 ring-1 ring-line">
          <h2 className="font-semibold">5. Manipulation au banc</h2>
          <p className="mt-1 text-sm">
            Sur le <Link to="/modbus/banc" className="text-accent underline">banc</Link>, partie B : reliez les deux cartes au pupitre (câbles DB9/bleu-vert), posez la sonde Ch1 sur
            TX+ et la sonde Ch2 sur TX_EN de la carte 1, chacune avec sa pince de masse, puis « Faire vérifier ». Le premier essai réussi vaut tous les points, le deuxième la moitié.
          </p>
          <p className="mt-1 text-sm text-muted">Essais de « Faire vérifier » : {p.verifs}</p>
        </section>
      )}
    </>
  )
}

/** Données propres à chaque bloc : chronogramme, consigne, octets échangés */
function Enonce({ sujet, bloc }: { sujet: Sujet; bloc: ItemPartiel['bloc'] }) {
  if (bloc === 'message')
    return (
      <div className="mt-2">
        <p className="text-sm text-muted">Chronogramme relevé sur TXD en niveau {sujet.exercice.level}. Retrouvez le débit, le format et le message ASCII.</p>
        <div className="mt-2">
          <Chronogramme ex={sujet.exercice} />
        </div>
      </div>
    )
  if (bloc === 'trame') return <p className="mt-2 text-sm">{sujet.trame.consigne}</p>
  if (bloc === 'reponse')
    return (
      <p className="mt-2 font-mono text-sm break-words">
        Requête : {toHex(sujet.echange.requete)}
        <br />
        Réponse : {toHex(sujet.echange.reponse)}
      </p>
    )
  return null
}

function Champ({ item, value }: { item: ItemPartiel; value: string }) {
  const id = `partiel-${item.id}`
  const set = (v: string) => dispatch({ type: 'partielReponse', id: item.id, value: v })
  const cls = 'min-h-10 w-full max-w-full rounded-md bg-card px-2 ring-1 ring-line'
  return (
    <div className="grid gap-1 sm:grid-cols-[18rem_minmax(0,1fr)] sm:items-center">
      <label htmlFor={id} className="text-sm">
        {item.label}
      </label>
      {item.options ? (
        <select id={id} value={value} onChange={(e) => set(e.target.value)} className={`${cls} sm:w-auto`}>
          <option value="">—</option>
          {item.options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      ) : (
        <input id={id} value={value} onChange={(e) => set(e.target.value)} className={`${cls} font-mono`} />
      )}
    </div>
  )
}

function Correction({ p }: { p: Partiel }) {
  const sujet = genererSujet(p.graine, p.manip)
  const note = noter(sujet, p.reponses, p)
  return (
    <>
      <p className="mt-2 text-sm text-muted">
        Sujet de graine {p.graine}, rendu {p.renduA ? `après ${Math.round((p.renduA - p.debut) / 60000)} min` : ''}.
      </p>
      <section className="mt-4 overflow-x-auto rounded-card bg-card ring-1 ring-line" aria-label="Note">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="px-3 py-2">Attendu</th>
              <th className="px-3 py-2 text-right">Points</th>
            </tr>
          </thead>
          <tbody>
            {note.lignes.map((l) => (
              <tr key={l.id} className="border-t border-line">
                <td className="px-3 py-2">{l.label}</td>
                <td className="px-3 py-2 text-right font-mono">
                  {fr(l.points)} / {fr(l.max)}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-line font-semibold">
              <td className="px-3 py-2">Note globale</td>
              <td className="px-3 py-2 text-right font-mono">
                {fr(note.total)} / {fr(note.max)}
              </td>
            </tr>
            <tr className="border-t border-line font-semibold">
              <td className="px-3 py-2">Note sur 20</td>
              <td className="px-3 py-2 text-right font-mono">{fr(note.sur20)} / 20</td>
            </tr>
          </tbody>
        </table>
      </section>
      {(p.manip || p.penalites > 0) && (
        <p className="mt-2 text-sm text-muted">
          Câblage : {p.cablageEssai ? `réussi au ${p.cablageEssai}${p.cablageEssai === 1 ? 'er' : 'e'} essai` : 'non validé'} · manipulations pendant une émission : {p.penalites}
        </p>
      )}
      <Chronogramme ex={sujet.exercice} />
      <ul className="mt-4 divide-y divide-line rounded-card bg-card ring-1 ring-line" aria-label="Correction détaillée">
        {note.details.map((d) => (
          <li key={d.item.id} className="px-4 py-3 text-sm">
            <p className="font-medium">{d.item.label}</p>
            <p className="mt-0.5">
              Votre réponse : {d.traite ? <span className="font-mono">{d.reponse}</span> : <span className="text-err">non traitée</span>} ·{' '}
              <span className={d.verdict.ok ? 'text-ok' : d.verdict.partiel ? 'text-warn' : 'text-err'}>{fr(d.points)} pt</span>
            </p>
            {d.traite && d.verdict.message && <p className="mt-0.5 text-muted">{d.verdict.message}</p>}
            <p className="mt-0.5">Correction : {d.item.correction}</p>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => dispatch({ type: 'partielQuitter' })} className="mt-4 min-h-10 rounded-lg px-4 ring-1 ring-line">
        Nouveau partiel
      </button>
    </>
  )
}
