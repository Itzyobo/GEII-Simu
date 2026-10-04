import { UNVERIFIED } from '../data/questions'

/** Badge affiché quand la réponse attendue dépend d'une constante « hypothèse » de reference.ts (registre + dépendances contextuelles). */
export default function UnverifiedBadge({ id, extra }: { id: string; extra?: string[] }) {
  const deps = [...(UNVERIFIED[id] ?? []), ...(extra ?? [])]
  if (deps.length === 0) return null
  return (
    <span
      className="ml-2 inline-block rounded-md bg-accent/15 px-1.5 py-0.5 align-middle text-[11px] font-semibold text-accent ring-1 ring-accent/40"
      title={`Réponse calculée avec ${deps.join(', ')}, marqué(s) « hypothèse » dans reference.ts`}
    >
      valeur non vérifiée
    </span>
  )
}
