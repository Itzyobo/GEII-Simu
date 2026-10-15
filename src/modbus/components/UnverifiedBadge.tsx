import { unverifiedOf } from '../data/questions'
import type { RefKey } from '../data/reference'

/** Badge « valeur non vérifiée » : la réponse dépend d'au moins une entrée « hypothèse » de reference.ts. */
export default function UnverifiedBadge({ deps }: { deps: readonly RefKey[] }) {
  const hyps = unverifiedOf(deps)
  if (hyps.length === 0) return null
  const why = hyps.map((h) => `${h.hyp} — ${h.text}`).join('\n')
  return (
    <span
      tabIndex={0}
      title={why}
      aria-label={`valeur non vérifiée : ${why}`}
      className="ml-2 inline-block cursor-help rounded-md bg-amber-500/15 px-1.5 py-0.5 align-middle text-[11px] font-semibold whitespace-nowrap text-amber-700 ring-1 ring-amber-600/30"
    >
      valeur non vérifiée · {hyps.map((h) => h.hyp).join(', ')}
    </span>
  )
}
