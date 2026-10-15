/** Toutes les hypothèses (H) : valeur retenue, raison, entrées de reference.ts et questions qui en dépendent. */
import { Link } from 'react-router'
import { HYPOTHESES, REF, type Hyp, type RefKey } from '../data/reference'
import { QUESTIONS, QUESTIONS_COURS } from '../data/questions'

const valeur = (v: unknown): string => {
  if (typeof v === 'number') return v.toLocaleString('fr-FR', { maximumSignificantDigits: 6 })
  if (typeof v === 'string') return v
  return JSON.stringify(v)
}

export default function Hypotheses() {
  const hyps = (Object.keys(HYPOTHESES) as Hyp[]).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold">Hypothèses</h1>
      <p className="mt-2 text-sm text-muted">
        Chaque valeur que ni l’énoncé, ni le CR, ni une photo, ni une norme ne fixe est une hypothèse numérotée. Les questions qui en dépendent portent le badge « valeur non
        vérifiée ». Une vraie valeur saisie dans <Link to="/modbus/reglages" className="text-accent underline">Réglages</Link> (SERIE_2) lève le badge correspondant.
      </p>
      <ul className="mt-6 space-y-3">
        {hyps.map((h) => {
          const { text, resolue } = HYPOTHESES[h]!
          const refs = (Object.keys(REF) as RefKey[]).filter((k) => REF[k].hyp === h)
          const ouvertes = refs.filter((k) => REF[k].source === 'hypothèse')
          const questions = [...QUESTIONS, ...QUESTIONS_COURS].filter((q) => q.deps.some((d) => ouvertes.includes(d)))
          return (
            <li key={h} id={h} className="rounded-card bg-card p-4 ring-1 ring-line target:ring-accent">
              <p className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono font-bold">{h}</span>
                {resolue && <span className="rounded-md bg-ok/15 px-2 py-0.5 text-xs font-semibold text-ok">résolue</span>}
              </p>
              <p className="mt-1 text-sm">{text}</p>
              {refs.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs text-muted">
                  {refs.map((k) => (
                    <li key={k} className="break-words">
                      <span className="font-mono">{k}</span> = {valeur(REF[k].value)} {REF[k].unit ?? ''} · source : {REF[k].source}
                      {REF[k].note ? ` · ${REF[k].note}` : ''}
                    </li>
                  ))}
                </ul>
              )}
              {questions.length > 0 && (
                <p className="mt-2 text-xs">
                  Questions concernées :{' '}
                  {questions.map((q, i) => (
                    <span key={q.id}>
                      {i > 0 && ', '}
                      <Link to={`/modbus/${q.section === 'cours' ? 'cours' : 'questions'}#${q.id}`} className="underline-offset-2 hover:underline">
                        {q.section} ({q.id})
                      </Link>
                    </span>
                  ))}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </main>
  )
}
