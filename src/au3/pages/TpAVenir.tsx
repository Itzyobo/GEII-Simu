import { Link } from 'react-router'
import { AU3_QUESTIONS, type TpAu3 } from '../../data/questions.au3'
import BadgeNonVerifie from '../ui/BadgeNonVerifie'

/** Page d'un TP en attente : son catalogue de questions (intitulés exacts de l'énoncé), statut « à venir » */
export default function TpAVenir({ tp }: { tp: TpAu3 }) {
  const questions = AU3_QUESTIONS.filter((q) => q.tp === tp)
  return (
    <div className="min-h-screen bg-au3-bg text-au3-ink">
      <main className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
        <header>
          <p className="text-xs text-au3-muted">
            <Link to="/au3" className="underline">
              AU3
            </Link>{' '}
            › {tp.toUpperCase()}
          </p>
          <h1 className="text-xl font-semibold">{tp.toUpperCase()} — questions à venir</h1>
          <p className="mt-1 text-sm text-au3-muted">
            En attendant, entraînez-vous sur le{' '}
            <Link to="/au3/libre" className="text-au3-accent underline">
              banc libre
            </Link>
            .
          </p>
        </header>
        <ol className="space-y-1.5">
          {questions.map((q) => (
            <li key={q.id} className="rounded-lg bg-au3-panel px-3 py-2 text-sm ring-1 ring-au3-line">
              <span className="mr-2 font-mono text-xs text-au3-accent">{q.numero}</span>
              {q.intitule}
              <BadgeNonVerifie cles={q.cles} />
              <span className="ml-2 text-xs text-au3-muted">· à venir</span>
            </li>
          ))}
        </ol>
      </main>
    </div>
  )
}
