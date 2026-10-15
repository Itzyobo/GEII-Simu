/** Quiz de cours : haute impédance et TX_EN, terminaison, polarisation, RS232 contre RS485, longueur de câble. */
import { COURS, corrigerCours, type Theme } from '../data/cours'
import type { Champ } from '../lib/partieA'
import { enPartiel, useStore } from '../lib/store'
import UnverifiedBadge from '../components/UnverifiedBadge'
import { PartielEnCours, Reponses } from './Questions'

const THEMES: { id: Theme; titre: string }[] = [
  { id: 'impedance', titre: 'Impédance : haute impédance, terminaison, polarisation' },
  { id: 'longueur', titre: 'Longueur de câble et débit' },
  { id: 'rs', titre: 'RS232 contre RS485' },
]

export default function Cours() {
  const s = useStore()
  const partiel = enPartiel(s)
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold">Cours : liaisons RS232 et RS485</h1>
      <p className="mt-2 text-sm text-muted">
        Chaque correction donne la justification physique. Sur le banc (partie B, entraînement), les boutons « Polarisation absente » et « Terminaison absente » illustrent deux de ces
        questions.
      </p>
      {partiel && <PartielEnCours />}
      {THEMES.map((th) => (
        <section key={th.id} className="mt-8">
          <h2 className="text-sm font-semibold tracking-wide text-muted">{th.titre.toUpperCase()}</h2>
          <ul className="mt-2 divide-y divide-line rounded-card bg-card ring-1 ring-line">
            {COURS.filter((q) => q.theme === th.id).map((q) => {
              const champ: Champ = { key: 'r', label: q.unite ? `Réponse (${q.unite})` : 'Réponse', options: q.options, check: (v) => corrigerCours(q, v) }
              return (
                <li key={q.id} id={q.id} className="px-4 py-3 target:bg-accent/5">
                  <p>
                    {q.enonce}
                    <UnverifiedBadge deps={q.deps} />
                  </p>
                  {!partiel && <Reponses qid={q.id} champs={[champ]} answers={s.answers} />}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </main>
  )
}
