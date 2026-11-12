import { au3 } from '../../data/reference'
import { MISE_EN_PAGE } from '../miseEnPage'
import type { SessionExamen } from '../session'
import BadgeNonVerifie from '../ui/BadgeNonVerifie'
import { nombre } from '../tp1/affichage'
import type { Bilan } from './notation'

const pts = (x: number) => nombre(x)
const heure = (t: number) => new Date(t).toLocaleTimeString('fr-FR')

/**
 * Bilan de fin d'examen : score, barème du câblage, journal horodaté des pénalités, score par attendu officiel,
 * puis questions non traitées avec leur correction complète (valeur calculée par le modèle, formule, justification).
 */
export default function BilanExamen({ bilan, examen }: { bilan: Bilan; examen: SessionExamen }) {
  const nonTraitees = bilan.questions.filter((q) => !q.traitee)
  return (
    <div className="space-y-4 text-sm" data-bilan>
      <section className="rounded-lg bg-au3-panel p-4 ring-1 ring-au3-line">
        <h2 className="text-base font-semibold">Bilan de l’examen — {examen.tp.toUpperCase()}</h2>
        <p className="mt-1 text-2xl font-semibold" data-score>
          {pts(bilan.total)} / {pts(bilan.max)} points
        </p>
        <p className="text-xs text-au3-muted">
          Questions {pts(bilan.questions.reduce((a, q) => a + q.points, 0))} + câblage {pts(bilan.cablage.points)} − pénalités {pts(bilan.penalites.reduce((a, p) => a + p.points, 0))}
          {bilan.brut < 0 && ' (score ramené à 0)'}. Graine {examen.graine}, incident : {examen.incident === 'aucun' ? 'aucun' : 'ampli de courant bloqué'}.
        </p>
      </section>

      <section className="rounded-lg bg-au3-panel p-4 ring-1 ring-au3-line" data-bilan-cablage>
        <h3 className="font-semibold">Câblage</h3>
        <p className="text-xs">
          {bilan.cablage.essaiReussi === null ? `Jamais accepté (${bilan.cablage.essais} essai(s))` : `Accepté au ${bilan.cablage.essaiReussi === 1 ? '1er' : `${bilan.cablage.essaiReussi}e`} essai`} : {pts(bilan.cablage.points)} / {pts(bilan.cablage.max)} (1er essai 100 %, 2e {nombre(au3('COEF_DEUXIEME_ESSAI') * au3('POINTS_CABLAGE'))} points, ensuite 0).
        </p>
      </section>

      <section className="rounded-lg bg-au3-panel p-4 ring-1 ring-au3-line" data-journal>
        <h3 className="font-semibold">Journal des pénalités</h3>
        {bilan.penalites.length ? (
          <ul className="mt-1 space-y-0.5 text-xs">
            {bilan.penalites.map((p, i) => (
              <li key={i}>
                {heure(p.instant)} — {p.type === 'autoscale' ? 'Autoscale' : 'manipulation sous tension refusée'} ({p.detail}) : −{pts(p.points)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-au3-muted">Aucune pénalité.</p>
        )}
      </section>

      <section className="rounded-lg bg-au3-panel p-4 ring-1 ring-au3-line" data-par-attendu>
        <h3 className="font-semibold">Par attendu officiel (« A la fin du TPx, vous devez savoir »)</h3>
        <table className="mt-2 w-full text-xs">
          <tbody>
            {bilan.parAttendu.map((a) => (
              <tr key={a.attendu.id} className="border-t border-au3-line align-top">
                <td className="py-1 pr-2 font-mono text-au3-muted">{a.attendu.tp.toUpperCase()}</td>
                <td className="py-1 pr-2">{a.attendu.texte}</td>
                <td className="py-1 text-right whitespace-nowrap" data-attendu={a.attendu.id}>
                  {!a.couvert ? <span className="text-au3-err">non couvert</span> : a.evalue ? `${pts(a.points)} / ${pts(a.max)}` : <span className="text-au3-muted">autre TP</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-lg bg-au3-panel p-4 ring-1 ring-au3-line" data-questions-notees>
        <h3 className="font-semibold">Questions</h3>
        <ul className="mt-1 space-y-0.5 text-xs">
          {bilan.questions.map((q) => (
            <li key={q.question.id}>
              <span className="font-mono text-au3-accent">{q.question.numero}</span> : {pts(q.points)} / {pts(q.max)}
              {!q.traitee && <span className="text-au3-muted"> (non traitée)</span>}
              <BadgeNonVerifie cles={q.question.cles} validee={q.question.validee} />
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg bg-au3-panel p-4 ring-1 ring-au3-line" data-non-traitees>
        <h3 className="font-semibold">Questions non traitées et leur correction ({nonTraitees.length})</h3>
        {nonTraitees.map((q) => (
          <div key={q.question.id} className="mt-2 rounded bg-black/30 p-2 text-xs" data-correction-examen={q.question.id}>
            <p>
              <span className="font-mono text-au3-accent">{q.question.numero}</span> {q.question.intitule}
            </p>
            <ul className="mt-1 space-y-0.5">
              {q.champs.map((c) => (
                <li key={c.def.id}>
                  Attendu : {c.def.texte}
                  {c.def.tolerance !== null && ` (tolérance ±${nombre(c.def.tolerance * MISE_EN_PAGE.pourcent)} %)`}
                </li>
              ))}
              {q.ouvertes.map((o) => (
                <li key={o.def.id}>
                  Réponse attendue : {o.def.attendu ?? 'dépend de votre identification (non faite)'} — {o.def.texte}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  )
}
