import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { AU3, au3, type RefKey } from '../../data/reference'
import BilanExamen from '../examen/BilanExamen'
import { catalogueTp1, catalogueTp2, catalogueTp4, configTp4, contexteTp1, contexteTp2, contexteTp4 } from '../examen/catalogue'
import { dureeExamen, noter, tempsRestant, tirage, TPS_EXAMEN } from '../examen/notation'
import { MISE_EN_PAGE } from '../miseEnPage'
import { ESPACE_EXAMEN, type SessionAu3, type TpExamen } from '../session'
import { nombre } from '../tp1/affichage'
import { useBalayage } from '../tp4/useBalayage'
import { useBanc } from '../ui/useBanc'
import { PageTp1 } from './Tp1'
import { PageTp2 } from './Tp2'
import { PageTp4 } from './Tp4'

const CH = MISE_EN_PAGE.chrono
const BAREME: RefKey[] = ['DUREE_EXAMEN', 'DUREE_EXAMEN_MANIP', 'POINTS_QUESTION', 'POINTS_PAR_CHAMP', 'POINTS_CABLAGE', 'COEF_DEUXIEME_ESSAI', 'COEF_INCOMPLET', 'PENALITE_SOUS_TENSION', 'PENALITE_AUTOSCALE', 'INCIDENT_UN_SUR']
const deux = (n: number) => String(Math.floor(n)).padStart(CH.chiffres, '0')
/** 4500 s → « 75:00 » */
const mmss = (s: number) => `${deux(s / CH.secondesParMinute)}:${deux(s % CH.secondesParMinute)}`
const nouvelleGraine = () => crypto.getRandomValues(new Uint32Array(1))[0]!

/** Catalogue des réponses attendues du TP de l'examen (TP4 : balayage de la Q5 fourni par le Worker) */
function catalogueExamen(s: SessionAu3, tp: TpExamen, balayage: Parameters<typeof contexteTp4>[1]) {
  return tp === 'tp1' ? catalogueTp1(contexteTp1(s)) : tp === 'tp2' ? catalogueTp2(contexteTp2(s, null)) : catalogueTp4(contexteTp4(s, balayage))
}

/**
 * Mode examen (/au3/examen) : TP choisi ou tiré au sort, incident tiré par la graine, chrono depuis un horodatage
 * absolu, aucun indice ni correction avant la fin, barème du câblage et pénalités, bilan par attendu officiel.
 */
export default function Examen() {
  const { etat, agir } = useBanc(ESPACE_EXAMEN, 'tp1', 'examen')
  const s = etat.session
  const ex = s.examen
  const [maintenant, setMaintenant] = useState(() => Date.now())
  const [choix, setChoix] = useState<TpExamen | 'tirage'>('tirage')
  const [graine, setGraine] = useState(nouvelleGraine)
  const [duree, setDuree] = useState(() => au3('DUREE_EXAMEN'))
  const [confirmer, setConfirmer] = useState<'fin' | 'effacer' | null>(null)
  useEffect(() => {
    const id = setInterval(() => setMaintenant(Date.now()), CH.rafraichissementMs)
    return () => clearInterval(id)
  }, [])
  const restant = ex ? tempsRestant(ex, maintenant) : duree
  // Chrono à 0 : réponses figées, bilan affiché
  useEffect(() => {
    if (ex && !ex.termine && restant <= 0) agir({ type: 'terminer-examen' })
  }, [ex, restant]) // eslint-disable-line react-hooks/exhaustive-deps -- agir est stable dans son effet
  const balayage = useBalayage(configTp4(s), !!ex?.termine && ex.tp === 'tp4')
  const bilan = useMemo(() => (ex?.termine ? noter(s, ex.tp, catalogueExamen(s, ex.tp, balayage)) : null), [s, ex, balayage])
  const t = tirage(graine)

  if (!ex) {
    return (
      <div className="min-h-screen bg-au3-bg text-au3-ink">
        <main className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
          <p className="text-xs text-au3-muted">
            <Link to="/au3" className="underline">
              AU3
            </Link>{' '}
            › Examen
          </p>
          <h1 className="text-xl font-semibold">Mode examen</h1>
          <p className="rounded bg-au3-panel p-3 text-sm ring-1 ring-au3-line">
            Partiel de TP : « PARTIEL (1h15) » dans l’énoncé, qui comprend aussi un QCM, non simulé. Comme au partiel, votre compte-rendu personnel est autorisé : l’énoncé précise que vous y aurez accès. Le simulateur ne le fournit pas.
          </p>
          <fieldset className="rounded bg-au3-panel p-3 text-sm ring-1 ring-au3-line">
            <legend className="px-1 font-semibold">Durée</legend>
            {(['DUREE_EXAMEN', 'DUREE_EXAMEN_MANIP'] as const).map((k) => (
              <label key={k} className="mr-4 inline-flex items-center gap-1">
                <input type="radio" name="duree-examen" value={au3(k)} checked={duree === au3(k)} onChange={() => setDuree(au3(k))} />
                {nombre(au3(k) / CH.secondesParMinute)} min {k === 'DUREE_EXAMEN' ? '(partiel complet, énoncé)' : '(expérimentations seules : le partiel partage 1 h 15 avec un QCM, hypothèse)'}
              </label>
            ))}
          </fieldset>
          <fieldset className="rounded bg-au3-panel p-3 text-sm ring-1 ring-au3-line">
            <legend className="px-1 font-semibold">TP</legend>
            {(['tirage', ...TPS_EXAMEN] as const).map((x) => (
              <label key={x} className="mr-4 inline-flex items-center gap-1">
                <input type="radio" name="tp-examen" value={x} checked={choix === x} onChange={() => setChoix(x)} />
                {x === 'tirage' ? 'Tirage au sort' : x.toUpperCase()}
              </label>
            ))}
            <label className="mt-2 flex items-center gap-2">
              Graine
              <input type="number" value={graine} onChange={(e) => setGraine(Math.max(0, Math.round(Number(e.target.value) || 0)))} className="w-36 rounded bg-black/40 px-2 py-1 font-mono ring-1 ring-au3-line" aria-label="Graine du tirage" />
              <button type="button" onClick={() => setGraine(nouvelleGraine())} className="rounded bg-au3-panel-2 px-2 py-1 text-xs ring-1 ring-au3-line">
                Nouvelle graine
              </button>
            </label>
            <p className="mt-1 text-xs text-au3-muted">La graine détermine le TP tiré au sort et un éventuel incident de manipulation (même graine, même tirage).</p>
          </fieldset>
          <section className="rounded bg-au3-panel p-3 text-sm ring-1 ring-au3-line" data-bareme>
            <h2 className="font-semibold">Barème</h2>
            <ul className="mt-1 space-y-0.5 text-xs">
              {BAREME.map((k) => (
                <li key={k}>
                  <span className="font-mono">{k}</span> = {nombre(AU3[k].valeur)} {AU3[k].unite} ({AU3[k].source === 'hypothese' ? 'hypothèse' : 'énoncé'}) — {AU3[k].note}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-au3-muted">Mêmes tolérances qu’en entraînement (±{nombre(au3('TOL_MESURE') * MISE_EN_PAGE.pourcent)} %, ±{nombre(au3('TOL_ABAQUE') * MISE_EN_PAGE.pourcent)} % pour une lecture d’abaque). Aucune correction ni indice avant la fin.</p>
          </section>
          <button type="button" onClick={() => agir({ type: 'demarrer-examen', tp: choix === 'tirage' ? t.tp : choix, graine, incident: t.incident, duree })} className="rounded bg-au3-accent px-4 py-2 font-semibold text-black">
            Démarrer l’examen
          </button>
        </main>
      </div>
    )
  }

  const entete = (
    <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 rounded-lg bg-au3-panel p-2 text-sm ring-1 ring-au3-accent" data-entete-examen>
      <span className="font-semibold">Examen {ex.tp.toUpperCase()}</span>
      <span className="font-mono text-lg" role="timer" aria-label="Temps restant" data-chrono>
        {mmss(restant)}
      </span>
      <span className="text-xs text-au3-muted">
        sur {nombre(dureeExamen(ex) / CH.secondesParMinute)} min · graine {ex.graine}
      </span>
      {confirmer === 'fin' ? (
        <span className="ml-auto flex gap-2">
          <button type="button" onClick={() => (agir({ type: 'terminer-examen' }), setConfirmer(null))} className="rounded bg-au3-err px-2 py-1 text-xs font-semibold text-black">
            Confirmer la fin
          </button>
          <button type="button" onClick={() => setConfirmer(null)} className="rounded bg-au3-panel-2 px-2 py-1 text-xs ring-1 ring-au3-line">
            Continuer
          </button>
        </span>
      ) : (
        <button type="button" onClick={() => setConfirmer('fin')} className="ml-auto rounded bg-au3-panel-2 px-2 py-1 text-xs ring-1 ring-au3-line">
          Terminer l’examen
        </button>
      )}
    </div>
  )

  if (!ex.termine) {
    const Page = ex.tp === 'tp1' ? PageTp1 : ex.tp === 'tp2' ? PageTp2 : PageTp4
    return <Page etat={etat} agir={agir} entete={entete} />
  }

  return (
    <div className="min-h-screen bg-au3-bg text-au3-ink">
      <main className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
        <p className="text-xs text-au3-muted">
          <Link to="/au3" className="underline">
            AU3
          </Link>{' '}
          › Examen terminé
        </p>
        {bilan ? <BilanExamen bilan={bilan} examen={ex} /> : <p role="status">Correction en cours (balayage de la Q5)…</p>}
        {confirmer === 'effacer' ? (
          <p className="flex flex-wrap items-center gap-2 text-sm">
            Effacer définitivement cet examen et son bilan ?
            <button type="button" onClick={() => (agir({ type: 'effacer-examen' }), setConfirmer(null))} className="rounded bg-au3-err px-2 py-1 text-xs font-semibold text-black">
              Oui, effacer
            </button>
            <button type="button" onClick={() => setConfirmer(null)} className="rounded bg-au3-panel-2 px-2 py-1 text-xs ring-1 ring-au3-line">
              Non
            </button>
          </p>
        ) : (
          <button type="button" onClick={() => setConfirmer('effacer')} className="rounded bg-au3-panel-2 px-3 py-1 text-sm ring-1 ring-au3-line">
            Effacer l’examen
          </button>
        )}
      </main>
    </div>
  )
}
