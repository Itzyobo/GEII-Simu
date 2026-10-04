import { useState } from 'react'
import { Link } from 'react-router'
import { TPS } from './tps'
import { ATTENDUS, LABEL_OF, QUESTIONS } from '../data/questions'
import { resetProgress, useProgress } from '../lib/progress'

const fr = (x: number, d = 1) => x.toFixed(d).replace('.', ',')
const dateFr = (iso: string) => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })

export default function Home() {
  const progress = useProgress()
  const [confirmReset, setConfirmReset] = useState(false)
  const ok = (id: string) => progress.questions[id]?.success === true
  const lastBlanc = progress.exams.filter((e) => e.kind === 'blanc').at(-1)

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <p className="text-xs font-semibold tracking-[0.2em] text-accent">ENER3 · SIMULATEUR DE TP</p>
      <h1 className="mt-2 text-3xl font-bold">TP-Sim</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Réglez, câblez, mesurez, puis répondez aux questions de l’énoncé. Les valeurs simulées sont calées sur les comptes rendus.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {TPS.map((tp) => {
          const ids = QUESTIONS[tp.slug].map((q) => q.id)
          const pct = (100 * ids.filter(ok).length) / ids.length
          const last = progress.exams.filter((e) => e.kind === tp.slug).at(-1)
          return (
            <Link key={tp.slug} to={`/tp/${tp.slug}`} className="group flex flex-col rounded-card bg-card p-5 ring-1 ring-line transition hover:ring-accent">
              <h2 className="text-lg font-semibold group-hover:text-accent">{tp.title}</h2>
              <p className="mt-2 flex-1 text-sm text-muted">{tp.summary}</p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-card-2" aria-hidden>
                <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 font-mono text-xs text-muted">
                {fr(pct, 0)} % des questions réussies · {last ? `dernière note ${fr(last.note)} / 20` : 'pas encore d’examen'}
              </p>
            </Link>
          )
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4 rounded-card bg-card p-5 ring-1 ring-line">
        <div className="flex-1">
          <h2 className="font-semibold">Examen blanc — 1 h 30</h2>
          <p className="text-sm text-muted">
            Les 3 TP enchaînés dans un ordre aléatoire, sans correction avant la remise.
            {lastBlanc && ` Dernier : ${fr(lastBlanc.note)} / 20 (${dateFr(lastBlanc.date)}).`}
          </p>
        </div>
        <Link to="/examen-blanc" className="inline-flex min-h-11 items-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#1a1306]">
          Commencer l’examen blanc
        </Link>
      </div>

      <section className="mt-10">
        <h2 className="text-sm font-semibold tracking-wide text-muted">ATTENDUS</h2>
        <p className="mt-1 text-xs text-muted">
          Liste officielle des attendus, avec les questions et sections qui les couvrent. Acquis quand toutes ont été réussies au moins une fois ; « non couvert » quand le simulateur ne propose encore aucun exercice.
        </p>
        {TPS.map((tp) => (
          <div key={tp.slug} className="mt-4">
            <h3 className="mb-1 text-sm font-semibold">{tp.title}</h3>
            <div className="overflow-x-auto rounded-card ring-1 ring-line">
              <table className="w-full text-sm">
                <tbody>
                  {ATTENDUS.filter((a) => a.tp === tp.slug).map((a) => {
                    const status = a.ids.length === 0 ? 'non couvert' : a.ids.every(ok) ? 'acquis' : 'à revoir'
                    const tone = status === 'acquis' ? 'bg-ok/15 text-ok' : status === 'à revoir' ? 'bg-accent/15 text-accent' : 'bg-card-2 text-muted'
                    return (
                      <tr key={a.text} className="border-t border-line first:border-t-0 align-top">
                        <td className="w-2/5 px-3 py-2">{a.text}</td>
                        <td className="px-3 py-2 text-xs">
                          {a.ids.length === 0 && <span className="text-muted">aucune question ni section</span>}
                          {a.ids.map((id) => (
                            <Link key={id} to={`/tp/${a.tp}${id.endsWith('-cablage') ? '' : `?q=${id}`}`} className={`mr-2 inline-block underline-offset-2 hover:underline ${ok(id) ? 'text-ok' : 'text-muted'}`}>
                              {LABEL_OF[id]}
                            </Link>
                          ))}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${tone}`}>{status}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>

      {progress.exams.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold tracking-wide text-muted">HISTORIQUE DES EXAMENS</h2>
          <ul className="mt-2 space-y-1 font-mono text-xs text-muted">
            {[...progress.exams].reverse().map((e, k) => (
              <li key={k}>
                {dateFr(e.date)} · {e.kind === 'blanc' ? 'Examen blanc' : TPS.find((t) => t.slug === e.kind)?.title ?? e.kind} · <span className="text-ink">{fr(e.note)} / 20</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-10 flex flex-wrap items-center gap-3">
        {confirmReset ? (
          <>
            <span className="text-sm text-err">Effacer toute la progression et l’historique des examens ?</span>
            <button
              type="button"
              onClick={() => {
                resetProgress()
                setConfirmReset(false)
              }}
              className="min-h-11 rounded-lg bg-err px-4 text-sm font-semibold text-[#1a0606]"
            >
              Oui, réinitialiser
            </button>
            <button type="button" onClick={() => setConfirmReset(false)} className="min-h-11 rounded-lg bg-card-2 px-4 text-sm ring-1 ring-line">
              Annuler
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirmReset(true)} className="min-h-11 rounded-lg bg-card-2 px-4 text-sm ring-1 ring-line hover:ring-err">
            Réinitialiser la progression
          </button>
        )}
        <Link to="/demo" className="ml-auto text-xs text-muted/60 hover:text-muted">
          démo des composants
        </Link>
      </div>
    </main>
  )
}
