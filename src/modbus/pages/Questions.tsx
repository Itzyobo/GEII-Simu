import { useState } from 'react'
import { Link } from 'react-router'
import { ATTENDUS } from '../data/attendus'
import { QUESTIONS, SECTIONS, type Question } from '../data/questions'
import { champsPartieA, type Champ } from '../lib/partieA'
import { champsPartieB } from '../lib/partieB'
import { champsPartieC } from '../lib/partieC'
import { points } from '../models/answers'
import { dispatch, enPartiel, useStore } from '../lib/store'
import TraceClic from '../components/TraceClic'
import UnverifiedBadge from '../components/UnverifiedBadge'

const ATTENDU_TEXT = Object.fromEntries(ATTENDUS.map((a) => [a.id, a.text]))
const PARTIES_BC = { ...champsPartieB(), ...champsPartieC() }

export default function Questions() {
  const s = useStore()
  const champs = { ...champsPartieA(s), ...PARTIES_BC }
  // Le vrai format de SERIE_2 saisi dans Réglages lève le badge H3
  const depsOf = (q: Question) => (s.serie2.reel ? q.deps.filter((d) => d !== 'serie2Format') : q.deps)

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold">Questions de l’énoncé</h1>
      <p className="mt-2 text-sm text-muted">Intitulés recopiés mot pour mot de l’énoncé (TP-11 à TP-15). Faites la manip sur le banc, puis répondez.</p>
      {enPartiel(s) && <PartielEnCours />}
      {SECTIONS.map((sec) => (
        <section key={sec} className="mt-8">
          <h2 className="text-sm font-semibold tracking-wide text-muted">SECTION {sec}</h2>
          <ul className="mt-2 divide-y divide-line rounded-card bg-card ring-1 ring-line">
            {QUESTIONS.filter((q) => q.section === sec).map((q) => (
              <li key={q.id} id={q.id} className="px-4 py-3 target:bg-accent/5">
                <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                  <div className="min-w-0 flex-1">
                    <p>
                      {q.intitule}
                      <UnverifiedBadge deps={depsOf(q)} />
                    </p>
                    <p className="mt-0.5 text-xs text-muted">Attendus : {q.attendus.map((a) => ATTENDU_TEXT[a]).join(' · ')}</p>
                  </div>
                  <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${q.statut === 'implémentée' ? 'bg-ok/15 text-ok' : 'bg-card-2 text-muted'}`}>{q.statut}</span>
                </div>
                {q.id in champs &&
                  !enPartiel(s) &&
                  (champs[q.id] ? (
                    <Reponses qid={q.id} champs={champs[q.id]!} answers={s.answers} />
                  ) : (
                    <p className="mt-2 text-sm text-muted">
                      Lancez d’abord SERIE_2 sur le <Link to="/modbus/banc" className="text-accent underline">banc</Link> : son format est tiré au premier lancement.
                    </p>
                  ))}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  )
}

/** Bandeau des pages d'entraînement pendant un partiel : aucune correction avant le rendu. */
export function PartielEnCours() {
  return (
    <p className="mt-3 rounded-lg bg-warn/10 p-3 text-sm text-warn ring-1 ring-warn/30" role="note">
      Partiel en cours : les corrections de cette page sont masquées jusqu’au rendu. Répondez dans la page{' '}
      <Link to="/modbus/partiel" className="underline">
        Mode partiel
      </Link>
      .
    </p>
  )
}

/** Champs de réponse d'une question, avec « Corriger » et le verdict de chaque champ. */
export function Reponses({ qid, champs, answers }: { qid: string; champs: Champ[]; answers: ReturnType<typeof useStore>['answers'] }) {
  const key = (c: Champ) => `${qid}.${c.key}`
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(champs.map((c) => [c.key, answers[key(c)]?.value ?? ''])))
  const corriger = () => champs.forEach((c) => dispatch({ type: 'answer', key: key(c), value: values[c.key] ?? '', points: points(c.check(values[c.key] ?? '')) }))

  return (
    <form
      className="mt-3 space-y-2 rounded-lg bg-card-2 p-3"
      onSubmit={(e) => {
        e.preventDefault()
        corriger()
      }}
    >
      {champs.map((c) => {
        const a = answers[key(c)]
        const verdict = a ? c.check(a.value) : null
        const id = `${qid}-${c.key}`
        const set = (value: string) => setValues((v) => ({ ...v, [c.key]: value }))
        const large = c.affirmations || c.trace
        return (
          <div key={c.key} className={`grid gap-1 sm:items-center ${large ? '' : 'sm:grid-cols-[16rem_minmax(0,1fr)]'}`}>
            {large ? (
              <p id={id} className="text-sm">
                {c.label}
              </p>
            ) : (
              <label htmlFor={id} className="text-sm">
                {c.label}
              </label>
            )}
            <div className="min-w-0">
              {c.affirmations ? (
                <ul className="space-y-1" aria-labelledby={id}>
                  {c.affirmations.map((af, k) => {
                    const coche = (values[c.key] ?? '')[k] === '1'
                    return (
                      <li key={k}>
                        <label className="flex min-h-10 items-start gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="mt-1 size-4 shrink-0"
                            checked={coche}
                            onChange={() => set(c.affirmations!.map((_, j) => (j === k ? (coche ? '0' : '1') : (values[c.key] ?? '')[j] === '1' ? '1' : '0')).join(''))}
                          />
                          <span>
                            {k + 1}. {af.texte}
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              ) : c.trace ? (
                <TraceClic trace={c.trace} value={values[c.key] ?? ''} onPick={set} />
              ) : c.options ? (
                <select id={id} value={values[c.key]} onChange={(e) => set(e.target.value)} className="min-h-10 w-full max-w-full rounded-md bg-card px-2 ring-1 ring-line sm:w-auto">
                  <option value="">—</option>
                  {c.options.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input id={id} value={values[c.key]} onChange={(e) => set(e.target.value)} className="min-h-10 w-full rounded-md bg-card px-2 font-mono ring-1 ring-line" />
              )}
              {verdict && a?.value === values[c.key] && (
                <p role="status" className={`mt-1 text-sm ${verdict.ok ? 'text-ok' : verdict.partiel ? 'text-warn' : 'text-err'}`}>
                  {verdict.message}
                </p>
              )}
            </div>
          </div>
        )
      })}
      <button type="submit" className="min-h-10 rounded-lg bg-accent px-4 font-semibold text-on-accent">
        Corriger
      </button>
    </form>
  )
}
