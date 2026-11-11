import { Link } from 'react-router'
import { TPS } from './tps'
import { QUESTIONS } from '../data/questions'
import { useProgress } from '../lib/progress'
import { CHAPITRES } from '../cours/chapitres'

/** Les matières du site et leurs ressources : ajouter une entrée par nouvelle matière ou nouveau TP. */
const MATIERES = [
  {
    code: 'ENER3',
    titre: 'Énergie électrique',
    cartes: [
      { to: '/ener', tag: 'TP', title: 'Travaux pratiques', items: TPS.map((tp) => tp.title), ener: true },
      { to: '/ener/cours', tag: 'Cours', title: 'Cours animé', items: CHAPITRES.map((c) => c.titre), ener: false },
    ],
  },
  {
    code: 'Réseaux',
    titre: 'Réseaux locaux industriels',
    cartes: [{ to: '/modbus', tag: 'TP2 · GEII', title: 'Liaison série / MODBUS', items: ['Liaison série (SERIE_1 à 3, RealTerm)', 'Scrutation du réseau', 'Esclaves OTB, TDS, TQS, THT'], ener: false }],
  },
  {
    code: 'AU3',
    titre: 'Automatique',
    cartes: [{ to: '/au3', tag: 'TP · MCC', title: 'Moteur à courant continu + DT', items: ['TP1 : boucle ouverte, identification', 'TP2 : régulateur proportionnel', 'TP4 : régulateur PI série', 'Banc libre : GBF, oscilloscope, platine'], ener: false }],
  },
]

export default function Dashboard() {
  const progress = useProgress()
  const ids = TPS.flatMap((tp) => QUESTIONS[tp.slug].map((q) => q.id))
  const done = ids.filter((id) => progress.questions[id]?.success === true).length
  const lastExam = progress.exams.at(-1)

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <p className="text-xs font-semibold tracking-[0.2em] text-accent">SIMULATEURS DE TP · COURS</p>
      <h1 className="mt-2 text-3xl font-bold">TP-Sim</h1>
      <p className="mt-2 max-w-2xl text-muted">Choisissez une matière, puis un TP pour vous entraîner, un examen blanc ou le cours animé.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Questions ENER3 réussies" value={`${done} / ${ids.length}`} />
        <Stat label="Examens passés" value={String(progress.exams.length)} />
        <Stat label="Dernière note" value={lastExam ? `${lastExam.note.toFixed(1).replace('.', ',')} / 20` : '—'} />
      </div>

      {MATIERES.map((m) => (
        <section key={m.code} className="mt-10">
          <h2 className="flex items-baseline gap-3">
            <span className="font-mono text-xs font-semibold tracking-[0.2em] text-accent uppercase">{m.code}</span>
            <span className="text-xl font-bold">{m.titre}</span>
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {m.cartes.map((s) => (
              <Link key={s.to} to={s.to} className="group rounded-card bg-card p-5 shadow-sm shadow-black/[0.03] ring-1 ring-line transition hover:ring-accent">
                <p className="font-mono text-xs text-accent">{s.tag}</p>
                <h3 className="mt-1 text-lg font-semibold group-hover:text-accent">{s.title}</h3>
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
          </div>
        </section>
      ))}
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
