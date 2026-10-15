import { ATTENDUS } from '../data/attendus'
import { QUESTIONS, SECTIONS } from '../data/questions'
import UnverifiedBadge from '../components/UnverifiedBadge'

const ATTENDU_TEXT = Object.fromEntries(ATTENDUS.map((a) => [a.id, a.text]))

export default function Questions() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold">Questions de l’énoncé</h1>
      <p className="mt-2 text-sm text-muted">Intitulés recopiés mot pour mot de l’énoncé (TP-11 à TP-15).</p>
      {SECTIONS.map((s) => (
        <section key={s} className="mt-8">
          <h2 className="text-sm font-semibold tracking-wide text-muted">SECTION {s}</h2>
          <ul className="mt-2 divide-y divide-line rounded-card bg-card ring-1 ring-line">
            {QUESTIONS.filter((q) => q.section === s).map((q) => (
              <li key={q.id} id={q.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 px-4 py-3 target:bg-accent/5">
                <div className="min-w-0 flex-1">
                  <p>
                    {q.intitule}
                    <UnverifiedBadge deps={q.deps} />
                  </p>
                  <p className="mt-0.5 text-xs text-muted">Attendus : {q.attendus.map((a) => ATTENDU_TEXT[a]).join(' · ')}</p>
                </div>
                <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${q.statut === 'implémentée' ? 'bg-ok/15 text-ok' : 'bg-card-2 text-muted'}`}>{q.statut}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  )
}
