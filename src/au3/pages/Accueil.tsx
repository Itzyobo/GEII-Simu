import { Link } from 'react-router'
import { AU3_ATTENDUS, couverture, type EtatCouverture, type TpAu3 } from '../../data/questions.au3'
import BadgeNonVerifie from '../ui/BadgeNonVerifie'

const ETAT: Record<EtatCouverture, { label: string; cls: string }> = {
  couvert: { label: 'couvert', cls: 'bg-au3-ok/15 text-au3-ok ring-au3-ok/40' },
  'a-venir': { label: 'questions à venir', cls: 'bg-au3-accent/15 text-au3-accent ring-au3-accent/40' },
  'non-couvert': { label: 'non couvert', cls: 'bg-au3-err/15 text-au3-err ring-au3-err/40' },
}

const TPS: { tp: TpAu3; titre: string; to: string | null; note: string }[] = [
  { tp: 'tp1', titre: 'MCC + dynamo tachymétrique en boucle ouverte', to: '/au3/tp1', note: 'Identification ordre 1 et ordre 2' },
  { tp: 'tp2', titre: 'Boucle fermée, régulateur proportionnel', to: '/au3/tp2', note: 'K = 3,8 puis K = 40' },
  { tp: 'tp3', titre: 'Asservissement de position (antenne, essuie-glace)', to: null, note: 'Coupé : autre capteur, aucune mesure' },
  { tp: 'tp4', titre: 'Boucle fermée, régulateur PI série', to: '/au3/tp4', note: 'Valeurs non vérifiées' },
]

/** Accueil AU3 : attendus officiels de l'énoncé (« A la fin du TPx, vous devez savoir »), chacun relié aux questions qui le couvrent */
export default function Accueil() {
  return (
    <div className="min-h-screen bg-au3-bg text-au3-ink">
      <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
        <header>
          <p className="text-xs text-au3-muted">
            <Link to="/" className="underline">
              TP-Sim
            </Link>{' '}
            › AU3
          </p>
          <h1 className="text-xl font-semibold">AU3 — Moteur à courant continu et dynamo tachymétrique</h1>
          <p className="mt-1 text-sm text-au3-muted">GBF TG315, oscilloscope DSOX2004A, platine « Régulateur analogique » : poste 4, moteur 1, salle B26.</p>
        </header>

        <section aria-labelledby="banc" className="grid gap-3 sm:grid-cols-2">
          <h2 id="banc" className="sr-only">
            Banc et TP
          </h2>
          <Link to="/au3/libre" className="rounded-lg bg-au3-panel p-4 ring-1 ring-au3-accent/60 hover:ring-au3-accent">
            <p className="font-semibold text-au3-accent">Banc libre</p>
            <p className="text-xs text-au3-muted">Câblage, « Faire vérifier », mise sous tension, oscilloscope (curseurs, mesures, moyennage, Stop, .csv)</p>
          </Link>
          {TPS.map((t) =>
            t.to ? (
              <Link key={t.tp} to={t.to} className="rounded-lg bg-au3-panel p-4 ring-1 ring-au3-line hover:ring-au3-accent">
                <p className="text-xs text-au3-muted">{t.tp.toUpperCase()}</p>
                <p className="font-semibold">{t.titre}</p>
                <p className="text-xs text-au3-muted">
                  {t.note} · disponible
                  {t.tp === 'tp4' && <BadgeNonVerifie cles={['TAU_A']} />}
                </p>
              </Link>
            ) : (
              <div key={t.tp} className="rounded-lg bg-au3-panel/50 p-4 ring-1 ring-au3-line">
                <p className="text-xs text-au3-muted">{t.tp.toUpperCase()}</p>
                <p className="font-semibold text-au3-muted">{t.titre}</p>
                <p className="text-xs text-au3-muted">{t.note}</p>
              </div>
            ),
          )}
        </section>

        <section aria-labelledby="attendus">
          <h2 id="attendus" className="mb-1 text-sm font-semibold">
            Attendus officiels
          </h2>
          <p className="mb-3 text-xs text-au3-muted">Listes « A la fin du TPx, vous devez savoir » de l’énoncé, mot pour mot. Un attendu sans question reste affiché « non couvert ».</p>
          {(['tp1', 'tp2', 'tp3', 'tp4'] as const).map((tp) => (
            <div key={tp} className="mb-4">
              <h3 className="mb-1 text-xs font-semibold text-au3-muted">A la fin du {tp.toUpperCase()}, vous devez savoir :</h3>
              <ol className="space-y-1.5">
                {AU3_ATTENDUS.filter((a) => a.tp === tp).map((a) => {
                  const c = couverture(a)
                  return (
                    <li key={a.id} className="rounded-lg bg-au3-panel px-3 py-2 ring-1 ring-au3-line">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="min-w-0 flex-1 text-sm">{a.texte}</span>
                        <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ring-1 ${ETAT[c.etat].cls}`}>{ETAT[c.etat].label}</span>
                      </div>
                      <p className="mt-1 text-xs text-au3-muted">
                        {c.questions.length
                          ? c.questions.map((q, i) => (
                              <span key={q.id}>
                                {i > 0 && ' · '}
                                {q.statut === 'disponible' ? (
                                  <Link to={`/au3/${q.tp}#${q.id}`} className="underline hover:text-au3-accent">
                                    {q.numero}
                                  </Link>
                                ) : q.statut === 'non-couverte' ? (
                                  <span className="text-au3-err" data-non-couverte={q.id}>
                                    {q.numero} (non couverte)
                                  </span>
                                ) : (
                                  q.numero
                                )}
                              </span>
                            ))
                          : '—'}
                      </p>
                    </li>
                  )
                })}
              </ol>
            </div>
          ))}
        </section>
      </main>
    </div>
  )
}
