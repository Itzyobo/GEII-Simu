/** Intitulé exact d'une question, lu dans docs/info3/enonce.md par son ancre (et texte commun éventuel). */
import type { Info3Question } from '../../data/questions'
import { questionTitle } from '../tp1/content'
import Markdown from './Markdown'

export default function QuestionTitle({ q, enonce }: { q: Info3Question; enonce: string }) {
  const title = questionTitle(enonce, q.id)
  const ctx = q.contexte ? questionTitle(enonce, q.contexte) : null
  return (
    <div className="space-y-2">
      {ctx && (
        <details className="rounded-lg bg-card-2 px-2 py-1 ring-1 ring-line">
          <summary className="cursor-pointer text-xs font-semibold text-muted">Texte commun de l’énoncé</summary>
          <Markdown text={ctx} />
        </details>
      )}
      {q.entrainement && <p className="inline-block rounded bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent ring-1 ring-accent/30">Question d’entraînement (hors énoncé)</p>}
      {title ? <Markdown text={title} /> : <p className="text-sm text-err">Ancre « {q.id} » absente de docs/info3/enonce.md.</p>}
    </div>
  )
}
