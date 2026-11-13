import { Link } from 'react-router'
import { TPS } from './tps'
import { QUESTIONS } from '../data/questions'
import { useProgress } from '../lib/progress'
import { CHAPITRES } from '../cours/chapitres'

/** Les matières du site et tous leurs TP : ajouter une entrée par nouvelle matière ou nouveau TP. */
const MATIERES = [
  {
    code: 'ENER3',
    titre: 'Énergie électrique',
    accueil: '/ener',
    liens: [
      ...TPS.map((tp) => ({ to: `/tp/${tp.slug}`, label: tp.title })),
      { to: '/examen-blanc', label: 'Examen blanc (1 h 30)' },
      { to: '/ener/cours', label: `Cours animé (${CHAPITRES.length} chapitres)` },
    ],
  },
  {
    code: 'Réseaux',
    titre: 'Réseaux locaux industriels',
    accueil: '/modbus',
    liens: [
      { to: '/modbus/banc', label: 'TP2 : liaison série / MODBUS (banc)' },
      { to: '/modbus/questions', label: 'Questions du TP2' },
      { to: '/modbus/exercices', label: 'Message codé' },
      { to: '/modbus/partiel', label: 'Partiel' },
      { to: '/modbus/cours', label: 'Cours' },
    ],
  },
  {
    code: 'INFO3',
    titre: 'Informatique industrielle (PIC16F18875)',
    accueil: '/info3',
    liens: [
      { to: '/info3/tp1', label: 'TP1 : ports parallèles' },
      { to: '/info3/tp2', label: 'TP2 : interruptions IOC et encodeur' },
      { to: '/info3/tp3', label: 'TP3 : Timer 2' },
      { to: '/info3/tp4', label: 'TP4 : SPI et anneau de 16 LED' },
      { to: '/info3/tp5', label: 'TP5 : PWM, UART et LED RGB' },
      { to: '/info3/tp6', label: 'TP6 : CAN, joystick et matrice 8x8' },
      { to: '/info3/examen', label: 'Mode examen' },
      { to: '/info3/libre', label: 'Mode libre' },
    ],
  },
  {
    code: 'AU3',
    titre: 'Automatique (MCC + dynamo tachymétrique)',
    accueil: '/au3',
    liens: [
      { to: '/au3/tp1', label: 'TP1 : boucle ouverte, identification' },
      { to: '/au3/tp2', label: 'TP2 : régulateur proportionnel' },
      { to: '/au3/tp4', label: 'TP4 : régulateur PI série' },
      { to: '/au3/examen', label: 'Mode examen' },
      { to: '/au3/libre', label: 'Banc libre' },
    ],
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
      <p className="mt-2 max-w-2xl text-muted">Choisissez une matière, puis un TP pour vous entraîner, un examen ou le cours.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Questions ENER3 réussies" value={`${done} / ${ids.length}`} />
        <Stat label="Examens ENER3 passés" value={String(progress.exams.length)} />
        <Stat label="Dernière note ENER3" value={lastExam ? `${lastExam.note.toFixed(1).replace('.', ',')} / 20` : '—'} />
      </div>

      {MATIERES.map((m) => (
        <section key={m.code} className="mt-10">
          <h2 className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-mono text-xs font-semibold tracking-[0.2em] text-accent uppercase">{m.code}</span>
            <span className="text-xl font-bold">{m.titre}</span>
            <Link to={m.accueil} className="ml-auto text-sm text-muted hover:text-accent">
              Accueil {m.code} →
            </Link>
          </h2>
          <div className="mt-4 rounded-card bg-card p-5 shadow-sm shadow-black/[0.03] ring-1 ring-line">
            <ul className="grid gap-2 sm:grid-cols-2">
              {m.liens.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="flex min-h-11 items-center rounded-lg bg-card-2 px-3 text-sm ring-1 ring-line hover:text-accent hover:ring-accent">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            {m.code === 'ENER3' && (
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-card-2" aria-hidden>
                <div className="h-full bg-accent" style={{ width: `${(100 * done) / ids.length}%` }} />
              </div>
            )}
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
