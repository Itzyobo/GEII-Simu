import { AU3, type RefKey } from '../../data/reference'
import { dependDHypothese, hypothesesDe } from '../hypothese'

/** Badge orange « valeur non vérifiée » : affiché seulement si une des clés est une hypothèse */
export default function BadgeNonVerifie({ cles }: { cles: readonly RefKey[] }) {
  if (!dependDHypothese(cles)) return null
  const detail = hypothesesDe(cles)
    .map((k) => `${k}${AU3[k].note ? ` (${AU3[k].note})` : ''}`)
    .join(' ; ')
  return (
    <span className="ml-2 inline-block rounded-md bg-au3-warn/15 px-1.5 py-0.5 align-middle text-[11px] font-semibold text-au3-warn ring-1 ring-au3-warn/40" title={`Dépend d’hypothèses de reference.ts : ${detail}`}>
      valeur non vérifiée
    </span>
  )
}
