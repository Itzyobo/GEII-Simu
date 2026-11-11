import { AU3, type RefKey } from '../../data/reference'
import { badgeAffiche, hypothesesDe } from '../hypothese'

/** Badge orange « valeur non vérifiée » : la réponse dépend d'une hypothèse et n'est validée par aucun test contre le CR */
export default function BadgeNonVerifie({ cles, validee = [], detail: plus }: { cles: readonly RefKey[]; validee?: readonly RefKey[]; detail?: string }) {
  if (!badgeAffiche(cles, validee)) return null
  const detail = hypothesesDe(cles)
    .map((k) => `${k}${AU3[k].note ? ` (${AU3[k].note})` : ''}`)
    .join(' ; ')
  return (
    <span className="ml-2 inline-block rounded-md bg-au3-warn/15 px-1.5 py-0.5 align-middle text-[11px] font-semibold text-au3-warn ring-1 ring-au3-warn/40" title={`${plus ? `${plus} — ` : ''}Dépend d’hypothèses de reference.ts : ${detail}`}>
      valeur non vérifiée
    </span>
  )
}
