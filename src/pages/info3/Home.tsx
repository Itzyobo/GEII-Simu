import { Link } from 'react-router'
import { coverage, INFO3_QUESTIONS, INFO3_VALIDATION, type CoverageState } from '../../data/questions'
import { loadProgress } from '../../info3/project/progress'

const STATE: Record<CoverageState, { label: string; cls: string }> = {
  covered: { label: 'couvert', cls: 'bg-ok/10 text-ok ring-ok/30' },
  partial: { label: 'partiel', cls: 'bg-warn/10 text-warn ring-warn/30' },
  none: { label: 'non couvert', cls: 'bg-err/10 text-err ring-err/30' },
}
const TPS = [
  { tp: 1, title: 'Ports parallèles', to: '/info3/tp1' },
  { tp: 2, title: 'Interruptions IOC et encodeur', to: '/info3/tp2' },
  { tp: 3, title: 'Timer 2', to: '/info3/tp3' },
  { tp: 4, title: 'SPI et anneau de 16 LED', to: '/info3/tp4' },
  { tp: 5, title: 'PWM, UART et LED RGB', to: '/info3/tp5' },
  { tp: 6, title: 'CAN, joystick et matrice 8x8', to: '/info3/tp6' },
]
const label = (id: string) => {
  const q = INFO3_QUESTIONS.find((x) => x.id === id)
  const m = /^tp(\d)-(.+)$/.exec(id)
  return q ? `TP${q.tp} ${q.numero}` : m ? `TP${m[1]} ${m[2].replace(/-/g, '.')}` : id
}

/** Accueil INFO3 : progression par TP, TP1 à TP6, examen, mode libre, hypothèses, points de validation A1 à A10 */
export default function Info3Home() {
  const progress = loadProgress()
  const done = (tp: number) => {
    const ids = INFO3_QUESTIONS.filter((q) => q.tp === tp).map((q) => q.id)
    return { passed: ids.filter((id) => progress[id]?.state === 'passed').length, total: ids.length }
  }
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
          {TPS.map((t) => {
            const d = done(t.tp)
            return (
              <Link key={t.tp} to={t.to} className="rounded-card bg-card p-4 ring-1 ring-line hover:ring-accent">
                <p className="text-xs text-muted">TP{t.tp}</p>
                <p className="font-semibold">{t.title}</p>
                <p className="mt-2 text-xs text-muted" aria-label={`TP${t.tp} : ${d.passed} questions validées sur ${d.total}`}>
                  {d.passed} / {d.total} questions validées
                </p>
                <div className="mt-1 h-1.5 rounded bg-card-2" aria-hidden>
                  <div className="h-1.5 rounded bg-accent" style={{ width: `${(100 * d.passed) / d.total}%` }} />
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      <section aria-labelledby="hors" className="grid gap-3 sm:grid-cols-3">
        <h2 id="hors" className="sr-only">
          Hors TP
        </h2>
        <Link to="/info3/examen" className="rounded-card bg-card p-4 ring-1 ring-line hover:ring-accent">
          <p className="font-semibold">Mode examen</p>
          <p className="text-xs text-muted">Sujet tiré au sort, chrono, note sur 20 et correction</p>
        </Link>
        <Link to="/info3/libre" className="rounded-card bg-card p-4 ring-1 ring-line hover:ring-accent">
          <p className="font-semibold">Mode libre</p>
          <p className="text-xs text-muted">8 projets de départ, Diagnostic, export et import JSON</p>
        </Link>
        <Link to="/info3/hypotheses" className="rounded-card bg-card p-4 ring-1 ring-line hover:ring-accent">
          <p className="font-semibold">Hypothèses</p>
          <p className="text-xs text-muted">Valeurs non vérifiées, à confirmer en séance</p>
        </Link>
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
