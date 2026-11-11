/** Hypothèses INFO3 (/info3/hypotheses) : état, façon de les vérifier en TP, questions qui en dépendent. */
import { Link } from 'react-router'
import { INFO3_QUESTIONS } from '../../data/questions'
import { INFO3, type Info3Hypothese } from '../../data/reference'
import { hypState } from '../../info3/ui/hypState'

const CLS: Record<string, string> = {
  vérifiée: 'bg-ok/10 text-ok ring-ok/30',
  partielle: 'bg-warn/10 text-warn ring-warn/30',
  réfutée: 'bg-card-2 text-muted ring-line',
  'non vérifiée': 'bg-err/10 text-err ring-err/30',
}
const num = (id: string) => Number(id.slice(1))
const label = (id: string) => {
  const q = INFO3_QUESTIONS.find((x) => x.id === id)!
  return `TP${q.tp} ${q.numero}`
}

export default function HypothesesPage() {
  const list = [...(INFO3.hypotheses as readonly Info3Hypothese[])].sort((a, b) => num(a.id) - num(b.id))
  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <header>
        <p className="text-xs text-muted">
          <Link to="/info3" className="underline">
            INFO3
          </Link>{' '}
          › Hypothèses
        </p>
        <h1 className="text-xl font-semibold">Hypothèses du simulateur</h1>
        <p className="mt-1 text-sm text-muted">Valeurs inventées ou non sourcées. Une question qui en dépend affiche le badge « valeur non vérifiée ». À vérifier en séance.</p>
      </header>
      <ul className="space-y-2">
        {list.map((h) => {
          const deps = INFO3_QUESTIONS.filter((q) => q.hyp.includes(h.id)).map((q) => q.id)
          const st = hypState(h)
          return (
            <li key={h.id} id={h.id} className="space-y-1 rounded-card bg-card p-3 ring-1 ring-line" data-hyp={h.id} data-state={st}>
              <p className="flex flex-wrap items-baseline gap-2">
                <span className="font-semibold tabular-nums">{h.id}</span>
                <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ring-1 ${CLS[st]}`}>{st}</span>
              </p>
              <p className="text-sm">{h.texte}</p>
              <p className="text-xs text-muted">À vérifier : {h.commentVerifier}</p>
              {h.preuve && <p className="text-xs text-muted">Preuve : {h.preuve}</p>}
              <p className="text-xs text-muted">Questions : {deps.length ? deps.map(label).join(', ') : 'aucune question directement'}</p>
            </li>
          )
        })}
      </ul>
    </main>
  )
}
