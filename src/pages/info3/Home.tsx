import { Link } from 'react-router'
import { coverage, INFO3_QUESTIONS, INFO3_VALIDATION, type CoverageState } from '../../data/questions'

const STATE: Record<CoverageState, { label: string; cls: string }> = {
  covered: { label: 'couvert', cls: 'bg-ok/10 text-ok ring-ok/30' },
  partial: { label: 'partiel', cls: 'bg-warn/10 text-warn ring-warn/30' },
  none: { label: 'non couvert', cls: 'bg-err/10 text-err ring-err/30' },
}
const TPS = [
  { tp: 1, title: 'Ports parallèles', to: '/info3/tp1' },
  { tp: 2, title: 'Interruptions IOC et encodeur' },
  { tp: 3, title: 'Timer 2' },
  { tp: 4, title: 'SPI et anneau de 16 LED' },
  { tp: 5, title: 'PWM, UART et LED RGB' },
  { tp: 6, title: 'CAN, joystick et matrice 8x8' },
]
const label = (id: string) => {
  const q = INFO3_QUESTIONS.find((x) => x.id === id)
  const m = /^tp(\d)-(.+)$/.exec(id)
  return q ? `TP${q.tp} ${q.numero}` : m ? `TP${m[1]} ${m[2].replace(/-/g, '.')}` : id
}

/** Accueil INFO3 : points de validation A1 à A10, TP1 à TP6, mode libre */
export default function Info3Home() {
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <header>
        <p className="text-xs text-muted">
          <Link to="/" className="underline">
            TP-Sim
          </Link>{' '}
          › INFO3
        </p>
        <h1 className="text-xl font-semibold">INFO3 — PIC16F18875 sur Curiosity HPC</h1>
        <p className="mt-1 text-sm text-muted">MCC, code C, carte et professeur virtuel, comme en salle.</p>
      </header>

      <section aria-labelledby="tps">
        <h2 id="tps" className="mb-2 text-sm font-semibold">
          Travaux pratiques
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TPS.map((t) =>
            t.to ? (
              <Link key={t.tp} to={t.to} className="rounded-card bg-card p-4 ring-1 ring-line hover:ring-accent">
                <p className="text-xs text-muted">TP{t.tp}</p>
                <p className="font-semibold">{t.title}</p>
              </Link>
            ) : (
              <div key={t.tp} className="rounded-card bg-card-2 p-4 opacity-70 ring-1 ring-line" aria-disabled>
                <p className="text-xs text-muted">TP{t.tp} · à venir</p>
                <p className="font-semibold">{t.title}</p>
              </div>
            ),
          )}
          <Link to="/info3/libre" className="rounded-card bg-card p-4 ring-1 ring-line hover:ring-accent">
            <p className="text-xs text-muted">Hors TP</p>
            <p className="font-semibold">Mode libre</p>
            <p className="text-xs text-muted">Projet vierge, Diagnostic, export et import JSON</p>
          </Link>
        </div>
      </section>

      <section aria-labelledby="valid">
        <h2 id="valid" className="mb-2 text-sm font-semibold">
          Points de validation
        </h2>
        <p className="mb-2 text-xs text-muted">Pas d’attendus officiels : les « Faire valider » de l’énoncé et le compte rendu servent de référence. Une ligne sans question reste en rouge.</p>
        <ul className="space-y-1.5">
          {INFO3_VALIDATION.map((v) => {
            const c = coverage(v)
            return (
              <li key={v.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg bg-card px-3 py-2 ring-1 ring-line">
                <span className="w-8 font-semibold tabular-nums">{v.id}</span>
                <span className="min-w-0 flex-1 text-sm">{v.point}</span>
                <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ring-1 ${STATE[c.state].cls}`}>
                  {STATE[c.state].label}
                  {c.state === 'partial' ? ` (${c.available.length}/${c.linked.length})` : ''}
                </span>
                <span className="w-full text-xs text-muted sm:w-auto">
                  {c.linked.length ? c.linked.map((id) => (c.available.includes(id) ? label(id) : `${label(id)} (à venir)`)).join(', ') : '—'}
                </span>
              </li>
            )
          })}
        </ul>
      </section>
    </main>
  )
}
