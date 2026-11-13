import { useCallback, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { AU3_QUESTIONS, type QuestionAu3 } from '../../data/questions.au3'
import { au3 } from '../../data/reference'
import { ampliBloque } from '../banc'
import { MISE_EN_PAGE } from '../miseEnPage'
import { MONTAGE_TP2, nomImpedance, PRECABLAGE_TP2 } from '../sim/cablage'
import { catalogueTp4, configTp4, contexteTp4 } from '../examen/catalogue'
import { facteurAttenuation } from '../instruments/gbf'
import type { Enregistrement } from '../instruments/oscillo'
import { afficher, lecturesAffichees, nombre, pourcent } from '../tp1/affichage'
import { ChampNum, Question, QuestionOuverte, type PropsReponse } from '../tp1/Reponses'
import { AFFICHAGE_TP4, kTi } from '../tp4/attendus'
import { criteres } from '../tp4/correction'
import { useBalayage } from '../tp4/useBalayage'
import FigureII from '../tp4/Figures'
import Etabli from '../ui/Etabli'
import { formatSi } from '../ui/format'
import type { PropsPage } from '../ui/types'
import { useBanc } from '../ui/useBanc'

const Q = Object.fromEntries(AU3_QUESTIONS.filter((q) => q.tp === 'tp4').map((q) => [q.id, q])) as Record<string, QuestionAu3>
const qu = (id: string): QuestionAu3 => {
  const q = Q[id]
  if (!q) throw new Error(`Question TP4 inconnue : ${id}`)
  return q
}
const G = MISE_EN_PAGE.gbf
const proche = (a: number, b: number, pas: number) => Math.abs(a - b) <= pas / 2
const DEMI_PERIODE = 1 / (2 * au3('TP4_GBF_FREQ'))

const Etat = ({ ok, children }: { ok: boolean; children: ReactNode }) => <li className={ok ? 'text-au3-ok' : 'text-au3-muted'}>{ok ? '✓' : '○'} {children}</li>

/** TP4 : régulateur PI série sur la platine (partie I) et partie II réduite sur le moteur du banc. Aucune mesure réelle. */
export default function Tp4() {
  const b = useBanc('tp4', 'tp4')
  return <PageTp4 {...b} />
}

/** TP4 piloté par un banc : entraînement (/au3/tp4) ou examen (aucun indice, aucune correction) */
export function PageTp4({ etat, agir, entete }: PropsPage) {
  const s = etat.session
  const [ouvert, setOuvert] = useState(true)
  const [rec, setRec] = useState<Enregistrement | null>(null)
  const onEnregistrement = useCallback((r: Enregistrement | null) => setRec(r), [])
  const p: PropsReponse = { session: s, agir, examen: s.mode === 'examen' }
  const vpp = s.gbf.vpp * facteurAttenuation(s.gbf)
  // Q5 : balayage de l'Affichage G1 dans un Worker, mémoïsé par configuration, demandé après la réponse
  const balayage = useBalayage(configTp4(s), !!s.reponses['tp4-i-q5'])
  const ctx = contexteTp4(s, balayage)
  const C = catalogueTp4(ctx)
  const { a95, retenu, aRet, ii3, ii4, ii5, c3, variation } = ctx
  const lireTr5 = () => lecturesAffichees(rec)
  const { K, Ti } = kTi()

  const reglages = [
    { ok: s.gbf.forme === 'carre', texte: 'forme périodique carrée' },
    { ok: proche(s.gbf.frequence, au3('TP4_GBF_FREQ'), G.pasFreq), texte: `fréquence la plus près possible de ${nombre(au3('TP4_GBF_FREQ'))} Hz` },
    { ok: proche(vpp, au3('TP4_GBF_VPP'), G.pasVpp), texte: `Vpp ≈ ${nombre(au3('TP4_GBF_VPP'))} V (actuel : ${nombre(vpp)} Vpp)` },
    { ok: Math.abs(s.gbf.offset) < G.pasOffset / 2, texte: 'sans offset' },
    { ok: s.platine.g1 === AFFICHAGE_TP4, texte: `« Affichage G1 » à ${AFFICHAGE_TP4} (actuel : ${s.platine.g1})` },
    { ok: s.platine.g2 === au3('TP4_G2'), texte: `G2 à ${au3('TP4_G2')}` },
  ]

  const panneau = (
    <div className="space-y-3 text-sm">
      <h2 className="text-base font-semibold">Questions du TP4</h2>

      <h3 className="pt-1 text-sm font-semibold">I. PI série sur la platine, consigne carrée</h3>
      {ctx.stable === false && !p.examen && (
        <p className="rounded bg-au3-err/15 px-2 py-1 text-xs text-au3-err ring-1 ring-au3-err/40" role="status" data-boucle-instable>
          Correction : boucle instable avec les composants et l’Affichage G1 actuels (critère de Routh) : la mesure oscille sans se stabiliser, les mesures de m(∞), D1 et TR5%b n’ont pas de sens.
        </p>
      )}
      <Question q={qu('tp4-cablage')}>
        <ol className="space-y-0.5 text-xs">
          {MONTAGE_TP2.map((l) => {
            const ok = p.examen ? undefined : etat.verdict?.correctes.includes(l)
            return (
              <li key={l.nom} className={ok === undefined ? '' : ok ? 'text-au3-ok' : 'text-au3-err'}>
                {ok === undefined ? '' : ok ? '✓ ' : '✗ '}
                {l.nom}
              </li>
            )
          })}
        </ol>
        <p className="text-xs text-au3-muted">
          Supports (à poser platine éteinte) : Z1 = {nomImpedance(s.platine.z1)}, Z2 = {nomImpedance(s.platine.z2)}. L’énoncé : R1 sur Z1, R2 et C2 en série sur Z2. « Faire vérifier » contrôle aussi la nature et la valeur des composants.
        </p>
        <p className="text-xs text-au3-warn">Pré-câblé (pointillés) : GBF MAIN OUT → voie 1, comme au TP2.</p>
      </Question>
      <Question q={qu('tp4-reglages')}>
        <ul className="space-y-0.5 text-xs" data-reglages="tp4" hidden={p.examen}>
          {reglages.map((r) => (
            <Etat key={r.texte} ok={r.ok}>
              {r.texte}
            </Etat>
          ))}
        </ul>
      </Question>
      <Question q={qu('tp4-sous-tension')}>
        <ul className="space-y-0.5 text-xs">
          <Etat ok={s.verifieSur !== null}>câblage et supports vérifiés (« Faire vérifier »)</Etat>
          <Etat ok={s.platine.sousTension}>platine sous tension</Etat>
          <Etat ok={!ampliBloque(s.platine.ampli)}>ampli de courant {s.platine.ampli === 'normal' ? 'normal' : 'bloqué : procédure du TP1/TP2'}</Etat>
        </ul>
      </Question>

      <Question q={qu('tp4-i-q1')}>
        <ChampNum champ={C.champs['tp4-i-q1']} label="m(∞) = ΔM" p={p} />
      </Question>
      <Question q={qu('tp4-i-q2')}>
        <ChampNum champ={C.champs['tp4-i-q2#g0b']} label="G0b" p={p} />
        <ChampNum champ={C.champs['tp4-i-q2']} label="Erreur statique" p={p} />
      </Question>
      <Question q={qu('tp4-i-q3')}>
        <ChampNum champ={C.champs['tp4-i-q3']} label="D1 = ΔY" p={p} />
      </Question>
      <Question q={qu('tp4-i-q4')}>
        <ChampNum champ={C.champs['tp4-i-q4']} label="D1/m(∞)" p={p} />
      </Question>
      <Question q={qu('tp4-i-q5')}>
        {!!s.reponses['tp4-i-q5'] && !balayage && !p.examen && (
          <p className="text-xs text-au3-muted" role="status" data-q5-en-cours>
            Correction en cours : balayage du modèle sur les 100 valeurs d’Affichage G1…
          </p>
        )}
        <ChampNum champ={C.champs['tp4-i-q5']} label="Affichage G1 retenu" p={p} apres={() => (
            <span className="block text-au3-muted" data-correction-q5>
              {' '}
              À Affichage {AFFICHAGE_TP4} : {criteres(a95).join(' ; ')}. Réglage de l’énoncé : K = (R2/R1)·G1·G2 = {nombre(K)}, Ti = R2·C2 = {formatSi(Ti, 's')}.
            </span>
          )} />
      </Question>
      <Question q={qu('tp4-i-q6')}>
        <p className="text-xs text-au3-muted">Avec l’Affichage G1 retenu ({retenu}).</p>
        <ChampNum champ={C.champs['tp4-i-q6#bas']} label="0,95·m(∞)" p={p} />
        <ChampNum champ={C.champs['tp4-i-q6#haut']} label="1,05·m(∞)" p={p} />
        <ChampNum champ={C.champs['tp4-i-q6']} label="TR5%b" p={p} lire={lireTr5} />
      </Question>
      <Question q={qu('tp4-i-q7')}>
        <QuestionOuverte
          id="tp4-i-q7"
          choix={C.ouvertes['tp4-i-q7']!.choix}
          attendu={C.ouvertes['tp4-i-q7']!.attendu}
          correction={
            <>
              <p>Affichage G1 = {retenu} :</p>
              <ul data-criteres>
                {criteres(aRet).map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
              <p>TR5%b doit être mesurable dans la demi-période du carré : {formatSi(DEMI_PERIODE, 's')} à {nombre(au3('TP4_GBF_FREQ'))} Hz. Le régulateur PI annule l’erreur statique (intégrateur), ce que le P du TP2 ne pouvait pas faire.</p>
            </>
          }
          p={p}
        />
      </Question>

      <section aria-label="Partie II" className="space-y-2 rounded-lg bg-au3-warn/10 p-3 text-xs ring-1 ring-au3-warn/40" data-bandeau-ii>
        <h3 className="text-sm font-semibold text-au3-ink">II. Convoyeur : simulation réduite</h3>
        <p className="text-au3-warn">Moteur du banc, pas celui du convoyeur de l’énoncé (fichiers Simulink non fournis). Consigne 0 → {nombre(au3('TP4_II_CONSIGNE'))} V à t = 0, moteur arrêté, PI de la partie I (Affichage {AFFICHAGE_TP4}) ; bouteille = échelon de couple à {formatSi(au3('TP4_BOUTEILLE_T'), 's')}.</p>
      </section>
      <Question q={qu('tp4-ii2')}>
        <p className="text-xs text-au3-err">Non couverte : couleurs et ordres des blocs du fichier Simulink, non fourni.</p>
      </Question>

      <FigureII id="ii3-1" s={ii3} series={['c', 'm']} titre="II.3 — figure 1 : consigne C et mesure M (sans bouteille)" />
      <FigureII id="ii3-2" s={ii3} series={['u']} titre="II.3 — figure 2 : commande U" />
      <Question q={qu('tp4-ii3-c')}>
        <ChampNum champ={C.champs['tp4-ii3-c#g0b']} label="G0b" p={p} />
        <ChampNum champ={C.champs['tp4-ii3-c']} label="Erreur statique" p={p} />
        <QuestionOuverte id="tp4-ii3-c#meme" choix={C.ouvertes['tp4-ii3-c#meme']!.choix} attendu={C.ouvertes['tp4-ii3-c#meme']!.attendu} correction={<p>Erreur statique nulle dans les deux cas ({pourcent(-ii3.erreurDemarrage)} ici, {pourcent(-a95.erreur)} au I) : c’est l’intégrateur du PI.</p>} p={p} />
      </Question>
      <Question q={qu('tp4-ii3-d')}>
        <QuestionOuverte id="tp4-ii3-d" choix={C.ouvertes['tp4-ii3-d']!.choix} attendu={C.ouvertes['tp4-ii3-d']!.attendu} correction={<p>U = {afficher(ii3.u0, 'V')} au départ (démarrage rapide, saturé à ±USAT), puis {afficher(ii3.uFin, 'V')} en régime permanent : non nul, pour vaincre le frottement et tenir la vitesse.</p>} p={p} />
      </Question>
      <Question q={qu('tp4-ii3-e')}>
        <ChampNum champ={C.champs['tp4-ii3-e#minf']} label="m(∞)" p={p} />
        <ChampNum champ={C.champs['tp4-ii3-e#d1']} label="D1" p={p} />
        <ChampNum champ={C.champs['tp4-ii3-e#d1rel']} label="D1/m(∞)" p={p} />
        <ChampNum champ={C.champs['tp4-ii3-e']} label="TR5%b" p={p} />
      </Question>
      <Question q={qu('tp4-ii3-f')}>
        <QuestionOuverte
          id="tp4-ii3-f"
          choix={C.ouvertes['tp4-ii3-f']!.choix}
          attendu={C.ouvertes['tp4-ii3-f']!.attendu}
          correction={
            <p>
              Précision : erreur statique {pourcent(-ii3.erreurDemarrage)} ({c3.precision ? 'respectée' : 'non respectée'}). Rapidité : TR5%b = {formatSi(ii3.tr5, 's')} pour {formatSi(au3('TP4_II_TR5_MAX'), 's')} exigées ({c3.rapidite ? 'respectée' : 'non respectée'}). Dépassement : D1/m(∞) = {pourcent(ii3.d1rel)} (le cahier des charges du convoyeur ne le chiffre pas au démarrage).
            </p>
          }
          p={p}
        />
      </Question>

      <FigureII id="ii4-1" s={ii4} series={['c', 'm', 'cc']} titre="II.4 — figure 1 : C et M en haut, couple de charge Cc en bas (bouteille)" />
      <FigureII id="ii4-2" s={ii4} series={['u']} titre="II.4 — figure 2 : commande U" />
      <Question q={qu('tp4-ii4-b')}>
        <ChampNum champ={C.champs['tp4-ii4-b#ecart']} label="Écart max C − M" p={p} />
        <ChampNum champ={C.champs['tp4-ii4-b']} label="Erreur statique finale" p={p} />
        <QuestionOuverte
          id="tp4-ii4-b#aire"
          choix={C.ouvertes['tp4-ii4-b#aire']!.choix}
          attendu={C.ouvertes['tp4-ii4-b#aire']!.attendu}
          correction={
            <>
              <p>
                Après la bouteille, e(t) &gt; 0 : son aire (intégrale) grandit et fait monter U de {afficher(ii4.uFin, 'V')} à {afficher(ii4.uApres, 'V')}, jusqu’à compenser le couple de charge. Quand l’aire cesse de croître, e(t) est revenu à 0 : erreur statique nulle.
              </p>
              <FigureII id="ii4-aire" s={ii4} series={['u']} aire titre="Aire de e(t) et commande U (u = K[e + (1/Ti)∫e dt])" />
            </>
          }
          p={p}
        />
      </Question>
      <Question q={qu('tp4-ii4-c')}>
        <QuestionOuverte
          id="tp4-ii4-c"
          choix={C.ouvertes['tp4-ii4-c']!.choix}
          attendu={C.ouvertes['tp4-ii4-c']!.attendu}
          correction={
            <p>
              Variation de vitesse à l’arrivée de la bouteille : {pourcent(variation)} de la consigne (exigée &lt; {pourcent(au3('TP4_II_VARIATION_MAX'))}) ; erreur statique finale {pourcent(ii4.erreurFinale ?? 0)}.
            </p>
          }
          p={p}
        />
      </Question>

      <FigureII id="ii5-1" s={ii4} p={ii5} series={['c', 'm', 'mP', 'cc']} titre="II.5 — bouteille : mesure M avec le PI (vert) contre le P seul R(p) = K (orange)" />
      <FigureII id="ii5-2" s={ii5} series={['u']} titre="II.5 — régulateur P seul : commande U" />
      <Question q={qu('tp4-ii5-d')}>
        <QuestionOuverte id="tp4-ii5-d" choix={C.ouvertes['tp4-ii5-d']!.choix} attendu={C.ouvertes['tp4-ii5-d']!.attendu} correction={<p>Non : avec R(p) = K, erreur statique {pourcent(ii5.erreurDemarrage)} au démarrage et {pourcent(ii5.erreurFinale ?? 0)} après la bouteille (écart maximal {afficher(ii5.ecartMax, 'V')}, contre {afficher(ii4.ecartMax, 'V')} avec le PI).</p>} p={p} />
      </Question>
      <Question q={qu('tp4-ii5-e')}>
        <QuestionOuverte id="tp4-ii5-e" choix={C.ouvertes['tp4-ii5-e']!.choix} attendu={C.ouvertes['tp4-ii5-e']!.attendu} correction={<p>Seule l’action intégrale annule l’erreur statique, au démarrage comme après une perturbation : U monte automatiquement tant que e(t) ≠ 0.</p>} p={p} />
      </Question>
    </div>
  )

  return (
    <div className="min-h-screen bg-au3-bg text-au3-ink">
      <div className="flex flex-col lg:flex-row">
        <main className="min-w-0 flex-1 space-y-3 p-3 sm:p-4">
          <header className="flex flex-wrap items-end gap-3">
            <div>
              <p className="text-xs text-au3-muted">
                <Link to="/au3" className="underline">
                  AU3
                </Link>{' '}
                › TP4
              </p>
              <h1 className="text-lg font-semibold">TP4 – Asservissement de la vitesse d’un Moteur à Courant Continu bouclé avec un régulateur PI série</h1>
            </div>
            <button type="button" onClick={() => setOuvert(!ouvert)} aria-expanded={ouvert} aria-controls="tp4-questions" className="ml-auto rounded bg-au3-panel-2 px-2 py-1 text-xs ring-1 ring-au3-line hover:ring-au3-accent">
              {ouvert ? 'Masquer les questions ▸' : '◂ Questions'}
            </button>
          </header>
          <p role="note" className="rounded bg-au3-warn/15 px-3 py-2 text-sm font-semibold text-au3-warn ring-1 ring-au3-warn/40" data-bandeau-tp4>
            Aucune mesure réelle : toutes les valeurs sont prédites par le modèle calé sur TP1/TP2
          </p>
          {entete}
          <Etabli etat={etat} agir={agir} preset={false} variantes={!p.examen} examen={p.examen} onEnregistrement={onEnregistrement} precablage={PRECABLAGE_TP2} />
        </main>
        {ouvert && (
          <aside id="tp4-questions" aria-label="Questions du TP4" className="w-full shrink-0 border-t border-au3-line bg-au3-bg p-3 lg:sticky lg:top-0 lg:h-screen lg:w-[460px] lg:overflow-y-auto lg:border-t-0 lg:border-l">
            {panneau}
          </aside>
        )}
      </div>
    </div>
  )
}
