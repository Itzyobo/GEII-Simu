import { Link } from 'react-router'
import { TPS } from './tps'
import { QUESTIONS } from '../data/questions'
import { useProgress } from '../lib/progress'

/** Les simulateurs du site : ajouter une entrée par nouvelle matière. */
const SIMULATEURS = [
  { to: '/ener', code: 'ENER3', title: 'Énergie électrique', items: TPS.map((tp) => tp.title), ener: true },
  { to: '/modbus', code: 'TP2 · GEII', title: 'Liaison série / MODBUS', items: ['Liaison série (SERIE_1 à 3, RealTerm)', 'Scrutation du réseau', 'Esclaves OTB, TDS, TQS, THT'], ener: false },
]

export default function Dashboard() {
  const progress = useProgress()
  const ids = TPS.flatMap((tp) => QUESTIONS[tp.slug].map((q) => q.id))
  const done = ids.filter((id) => progress.questions[id]?.success === true).length
  const lastExam = progress.exams.at(-1)

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <p className="text-xs font-semibold tracking-[0.2em] text-accent">SIMULATEURS DE TP</p>
      <h1 className="mt-2 text-3xl font-bold">TP-Sim</h1>
      <p className="mt-2 max-w-2xl text-muted">Choisissez une matière, puis un TP pour vous entraîner ou passer un examen blanc.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Questions ENER3 réussies" value={`${done} / ${ids.length}`} />
        <Stat label="Examens passés" value={String(progress.exams.length)} />
        <Stat label="Dernière note" value={lastExam ? `${lastExam.note.toFixed(1).replace('.', ',')} / 20` : '—'} />
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {SIMULATEURS.map((s) => (
          <Link key={s.to} to={s.to} className="group rounded-card bg-card p-5 shadow-sm shadow-black/[0.03] ring-1 ring-line transition hover:ring-accent">
            <p className="font-mono text-xs text-accent">{s.code}</p>
            <h2 className="mt-1 text-lg font-semibold group-hover:text-accent">{s.title}</h2>
            <ul className="mt-3 space-y-1 text-sm text-muted">
              {s.items.map((t) => (
                <li key={t}>· {t}</li>
              ))}
            </ul>
            {s.ener && (
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-card-2" aria-hidden>
                <div className="h-full bg-accent" style={{ width: `${(100 * done) / ids.length}%` }} />
              </div>
            )}
          </Link>
        ))}
        <div className="flex items-center justify-center rounded-card border border-dashed border-line p-5 text-sm text-muted">
          D’autres matières arrivent bientôt
        </div>
      </div>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card bg-card p-4 ring-1 ring-line">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-mono text-xl font-semibold">{value}</p>
    </div>
  )
}
