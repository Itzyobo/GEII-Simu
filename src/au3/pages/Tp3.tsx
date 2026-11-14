import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { AU3_QUESTIONS, type QuestionAu3 } from '../../data/questions.au3'
import { au3 } from '../../data/reference'
import { ampliBloque, sessionTp3, type Action } from '../banc'
import { catalogueTp3, type Catalogue } from '../examen/catalogue'
import { facteurAttenuation } from '../instruments/gbf'
import type { Enregistrement } from '../instruments/oscillo'
import { MISE_EN_PAGE } from '../miseEnPage'
import type { EtapeTp3, SessionAu3 } from '../session'
import { LIAISON_TP3_ENLEVEE, MONTAGES, nomImpedance, type Liaison, type MontageId } from '../sim/cablage'
import { gainAffichage } from '../sim/regulateur'
import { afficher, lecturesAffichees, nombre } from '../tp1/affichage'
import { ChampNum, Question, QuestionOuverte, type PropsReponse } from '../tp1/Reponses'
import { kTp3, penteTrace } from '../tp3/attendus'
import FigureK from '../tp3/FigureK'
import MoteurPosition from '../tp3/MoteurPosition'
import { creerTempsReel } from '../tp3/tempsReel'
import { useContexteTp3, type ContexteTp3 } from '../tp3/useContexte'
import BadgeNonVerifie from '../ui/BadgeNonVerifie'
import Etabli from '../ui/Etabli'
import { SELON_MODELE } from '../hypothese'
import { formatSi } from '../ui/format'
import type { PropsPage } from '../ui/types'
import { useBanc } from '../ui/useBanc'
import { DEGRES_PAR_TOUR } from '../unites'

const Q = Object.fromEntries(AU3_QUESTIONS.filter((q) => q.tp === 'tp3').map((q) => [q.id, q])) as Record<string, QuestionAu3>
const qu = (id: string): QuestionAu3 => {
  const q = Q[id]
  if (!q) throw new Error(`Question TP3 inconnue : ${id}`)
  return q
}
const G = MISE_EN_PAGE.gbf
const PC = MISE_EN_PAGE.pourcent
const proche = (a: number, b: number, pas: number) => Math.abs(a - b) <= pas / 2
const K7 = gainAffichage(au3('TP3_G1'), au3('TP3_G2'))
const PARTIES: { id: MontageId; titre: string }[] = [
  { id: 'tp3', titre: 'I. Boucle ouverte' },
  { id: 'tp3-ii1', titre: 'II.1 Antenne' },
  { id: 'tp3-ii2', titre: 'II.2 Essuie-glace' },
]

const Etat = ({ ok, children }: { ok: boolean; children: ReactNode }) => <li className={ok ? 'text-au3-ok' : 'text-au3-muted'}>{ok ? '✓' : '○'} {children}</li>

/** TP3 : asservissement de position (antenne puis essuie-glace). Aucune mesure réelle : badge sur toutes les questions. */
export default function Tp3() {
  const b = useBanc('tp3', 'tp3', 'libre', sessionTp3)
  return <PageTp3 {...b} />
}

function Liaisons({ liaisons, verdict, examen }: { liaisons: readonly Liaison[]; verdict: PropsPage['etat']['verdict']; examen: boolean }) {
  return (
    <ol className="space-y-0.5 text-xs">
      {liaisons.map((l) => {
        const ok = examen || !verdict ? undefined : verdict.correctes.includes(l)
        return (
          <li key={l.nom} className={ok === undefined ? '' : ok ? 'text-au3-ok' : 'text-au3-err'}>
            {ok === undefined ? '' : ok ? '✓ ' : '✗ '}
            {l.nom}
          </li>
        )
      })}
    </ol>
  )
}

/** « Faire valider … par l'enseignant » : enregistre l'étape ; la correction ne s'affiche qu'en entraînement */
function Validation({ etape, s, agir, examen, children }: { etape: EtapeTp3; s: SessionAu3; agir: (a: Action) => void; examen: boolean; children: ReactNode }) {
  const quand = s.tp3.validations[etape]
  return (
    <div className="space-y-1 text-xs" data-validation={etape}>
      <button type="button" onClick={() => agir({ type: 'valider-tp3', etape })} className="rounded bg-au3-accent px-2 py-1 font-semibold text-on-accent">
        Faire valider
      </button>
      {quand !== undefined && (
        <p className="text-au3-muted" role="status">
          Étape enregistrée ({new Date(quand).toLocaleTimeString('fr-FR')}).
        </p>
      )}
      {quand !== undefined && !examen && <div className="rounded bg-au3-panel-2 p-2 ring-1 ring-au3-line" data-validation-correction={etape}>{children}</div>}
    </div>
  )
}

/** TP3 piloté par un banc : entraînement (/au3/tp3) ou examen (aucun indice, aucune correction) */
export function PageTp3({ etat, agir, entete }: PropsPage) {
  const s = etat.session
  const examen = s.mode === 'examen'
  const [ouvert, setOuvert] = useState(true)
  const [rec, setRec] = useState<Enregistrement | null>(null)
  const onEnregistrement = useCallback((r: Enregistrement | null) => setRec(r), [])
  // Banc en temps réel : créé une fois, entrées mises à jour à chaque réglage (l'état mécanique continue)
  const [tempsReel] = useState(() => creerTempsReel({ gbf: s.gbf, platine: s.platine, cablage: s.cablage }))
  useEffect(() => tempsReel.entrees({ gbf: s.gbf, platine: s.platine, cablage: s.cablage }), [tempsReel, s.gbf, s.platine, s.cablage])
  const moteur = useCallback((bornes: Parameters<typeof MoteurPosition>[0]['bornes']) => <MoteurPosition bornes={bornes} tempsReel={tempsReel} />, [tempsReel])
  const ctx = useContexteTp3()
  const C = useMemo(() => (ctx ? catalogueTp3(ctx) : null), [ctx])
  const K = kTp3(s.platine.g1, s.platine.g2, s.platine.z1, s.platine.z2)
  const kAffiche = gainAffichage(s.platine.g1, s.platine.g2)
  const inegales = K !== null && Math.abs(K - kAffiche) > Number.EPSILON * kAffiche

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
                › TP3
              </p>
              <h1 className="text-lg font-semibold">TP3 – Asservissement de position d’un moteur à courant continu avec un régulateur Proportionnel</h1>
            </div>
            <button type="button" onClick={() => setOuvert(!ouvert)} aria-expanded={ouvert} aria-controls="tp3-questions" className="ml-auto rounded bg-au3-panel-2 px-2 py-1 text-xs ring-1 ring-au3-line hover:ring-au3-accent">
              {ouvert ? 'Masquer les questions ▸' : '◂ Questions'}
            </button>
          </header>
          <p role="note" className="rounded bg-au3-warn/15 px-3 py-2 text-sm font-semibold text-au3-warn ring-1 ring-au3-warn/40" data-bandeau-tp3>
            Aucune mesure réelle : valeurs calées sur les indications de l’énoncé
          </p>
          {entete}
          <div className="flex flex-wrap items-center gap-2 text-xs" role="group" aria-label="Partie du TP3 (montage attendu)">
            <span className="text-au3-muted">Partie :</span>
            {PARTIES.map((x) => (
              <button key={x.id} type="button" aria-pressed={etat.montage === x.id} onClick={() => agir({ type: 'montage', montage: x.id })} className={`rounded px-2 py-1 ring-1 ${etat.montage === x.id ? 'bg-au3-accent text-on-accent ring-au3-accent' : 'bg-au3-panel-2 ring-au3-line'}`}>
                {x.titre}
              </button>
            ))}
            {!examen && (
              <label className="ml-auto flex max-w-full min-w-0 flex-wrap items-center gap-1 text-au3-muted">
                Variante enseignant
                <select
                  value={nomImpedance(s.platine.z2)}
                  onChange={(e) => agir({ type: 'composant', support: 'z2', z: { composants: [e.target.value === 'R2' ? 'R2' : 'R3'], montage: 'serie' } })}
                  className="max-w-full min-w-0 rounded bg-au3-panel-2 px-1 text-au3-ink"
                  aria-label="Résistances des supports"
                >
                  <option value="R3">résistances égales (R1 / R3)</option>
                  <option value="R2">résistances du TP4 laissées (R1 10 kΩ / R2 27 kΩ)</option>
                </select>
              </label>
            )}
          </div>
          {!examen && inegales && (
            <p role="status" className="rounded bg-au3-err/15 px-3 py-1.5 text-xs text-au3-err ring-1 ring-au3-err/40" data-k-inegal>
              Résistances inégales sur Z1 et Z2 : K = (Z2/Z1) × G1 × G2 / 100 = {nombre(K!)} au lieu de {nombre(kAffiche)} affiché.
            </p>
          )}
          <Etabli etat={etat} agir={agir} preset={false} variantes={!examen} examen={examen} onEnregistrement={onEnregistrement} moteur={moteur} tempsReel={tempsReel} />
        </main>
        {ouvert && (
          <aside id="tp3-questions" aria-label="Questions du TP3" className="w-full shrink-0 border-t border-au3-line bg-au3-bg p-3 lg:sticky lg:top-0 lg:h-screen lg:w-[460px] lg:overflow-y-auto lg:border-t-0 lg:border-l">
            {C && ctx ? (
              <Panneau s={s} agir={agir} examen={examen} C={C} ctx={ctx} rec={rec} verdict={etat.verdict} K={K ?? kAffiche} />
            ) : (
              <p className="text-xs text-au3-muted" role="status" data-tp3-calcul>
                Calcul des réponses attendues (simulations du modèle)…
              </p>
            )}
          </aside>
        )}
      </div>
    </div>
  )
}

function Panneau({ s, agir, examen, C, ctx, rec, verdict, K }: { s: SessionAu3; agir: (a: Action) => void; examen: boolean; C: Catalogue; ctx: ContexteTp3; rec: Enregistrement | null; verdict: PropsPage['etat']['verdict']; K: number }) {
  const p: PropsReponse = { session: s, agir, examen }
  const o = (id: string) => C.ouvertes[id]!
  const pente = penteTrace(rec?.voies[1])
  const vpp = s.gbf.vpp * facteurAttenuation(s.gbf)
  const { rampe, k7, k9, k1 } = ctx
  const lireK = () => [K]
  const lireTr5 = () => lecturesAffichees(rec)
  const v = s.oscillo.voies

  return (
    <div className="space-y-3 text-sm">
      <h2 className="text-base font-semibold">Questions du TP3</h2>
      <p className="text-xs text-au3-muted">Cahier des charges de l’essuie-glace : erreur statique nulle (à {nombre(au3('TP4_ERREUR_MAX') * PC)} % près) et TR5%b &lt; {formatSi(au3('TP3_TR5_MAX'), 's')}.</p>
      <Question q={qu('tp3-triangle')}>
        <p className="text-xs text-au3-err" data-non-couverte="tp3-triangle">
          Optionnel, non couvert : consigne triangulaire et erreur de traînage.
        </p>
      </Question>

      <h3 className="pt-1 text-sm font-semibold">I. Signal du potentiomètre en boucle ouverte (+12 V)</h3>
      <div className="rounded bg-au3-panel-2 p-2 text-xs ring-1 ring-au3-line" data-piege-enonce>
        <p className="italic">« La tension délivrée en sortie du potentiomètre est proportionnelle à la vitesse de rotation du moteur. »</p>
        <p className="mt-1 text-au3-warn">Note de correction : cette phrase de l’énoncé est fausse. La tension du potentiomètre est proportionnelle à la POSITION angulaire θ (hors angle mort), pas à la vitesse : c’est un capteur de position. La vitesse est sa dérivée, Ω = dθ/dt.</p>
      </div>
      <Question q={qu('tp3-i-reglages')}>
        <ul className="space-y-0.5 text-xs" hidden={examen} data-reglages="tp3-i">
          <Etat ok={v[1]?.vdiv === au3('TP3_VOIE2_VDIV')}>calibre de la voie 2 à {formatSi(au3('TP3_VOIE2_VDIV'), 'V')}/div</Etat>
          <Etat ok={s.oscillo.sdiv === au3('TP3_SDIV')}>calibre horizontal à {formatSi(au3('TP3_SDIV'), 's')}/div</Etat>
        </ul>
      </Question>
      <Question q={qu('tp3-i-cablage')}>
        <Liaisons liaisons={MONTAGES.tp3.liaisons} verdict={verdict} examen={examen} />
      </Question>
      <Question q={qu('tp3-i-sous-tension')}>
        <ul className="space-y-0.5 text-xs">
          <Etat ok={s.verifieSur !== null}>câblage vérifié (« Faire vérifier »)</Etat>
          <Etat ok={s.platine.sousTension}>platine sous tension</Etat>
          <Etat ok={!ampliBloque(s.platine.ampli)}>ampli de courant {s.platine.ampli === 'normal' ? 'normal' : 'bloqué : procédure du TP1/TP2'}</Etat>
          {!examen && (
            <li className={pente > 0 ? 'text-au3-ok' : pente < 0 ? 'text-au3-err' : 'text-au3-muted'} data-pente={pente}>
              {pente > 0 ? '✓ segments de pente positive' : pente < 0 ? '✗ pente négative : inversez les connexions du potentiomètre à −12 V et +12 V' : '○ pente : aucune rampe affichée'}
            </li>
          )}
        </ul>
      </Question>
      <Question q={qu('tp3-i-q1')}>
        <QuestionOuverte id="tp3-i-q1" choix={C.ouvertes['tp3-i-q1']!.choix} attendu={C.ouvertes['tp3-i-q1']!.attendu} correction={<p>Oui : la mesure est un segment de droite incliné pendant {nombre((1 - rampe.dureeNonLineaire / rampe.periode) * PC)} % de chaque période ; seul l’angle mort ({nombre(rampe.angleMort)}°) n’est pas linéaire.</p>} p={p} />
      </Question>
      <Question q={qu('tp3-i-q2')}>
        <QuestionOuverte id="tp3-i-q2" choix={C.ouvertes['tp3-i-q2']!.choix} attendu={C.ouvertes['tp3-i-q2']!.attendu} correction={<p>Oui : le moteur alimenté en continu tourne sans s’arrêter ; le signal se répète à chaque tour du disque ({afficher(rampe.periode, 's')} par tour), car θ et θ + 360° donnent la même tension.</p>} p={p} />
      </Question>
      <Question q={qu('tp3-i-q3')}>
        <QuestionOuverte id="tp3-i-q3" choix={C.ouvertes['tp3-i-q3']!.choix} attendu={C.ouvertes['tp3-i-q3']!.attendu} correction={<p>Rampe de −12 V à +12 V sur {nombre(DEGRES_PAR_TOUR - rampe.angleMort)}°, puis l’angle mort, dans l’ordre du temps : {rampe.paliers.map((x) => formatSi(x, 'V')).join(' → ')}. Soudure d’alimentation +12 V (le curseur touche la borne +12 V), isolant à 0 V, soudure d’alimentation −12 V.</p>} p={p} />
      </Question>
      <Question q={qu('tp3-i-q4')}>
        <ChampNum champ={C.champs['tp3-i-q4']} label="Période T" p={p} />
        <ChampNum champ={C.champs['tp3-i-q4#angle']} label="Période angulaire" p={p} />
      </Question>
      <Question q={qu('tp3-i-q5')}>
        <ChampNum champ={C.champs['tp3-i-q5#duree']} label="Durée non linéaire" p={p} />
        <ChampNum champ={C.champs['tp3-i-q5']} label="Angle mort" p={p} />
      </Question>
      <Question q={qu('tp3-i-valider')}>
        <Validation etape="angle-mort" s={s} agir={agir} examen={examen}>
          <p data-correction-q4>Q4 : la période temporelle vaut T = {afficher(rampe.periode, 's')} (T_TOUR du modèle : {afficher(au3('TP3_T_TOUR'), 's')}) ; elle correspond à un tour, soit {DEGRES_PAR_TOUR}°.</p>
          <p data-correction-q5>
            Q5 : angle mort = (durée de la partie non linéaire / T) × 360° = ({afficher(rampe.dureeNonLineaire, 's')} / {afficher(rampe.periode, 's')}) × 360° = {nombre(rampe.angleMort)}° (modèle : soudure {au3('TP3_SOUDURE_M12')}° + isolant {au3('TP3_ISOLANT')}° + soudure {au3('TP3_SOUDURE_P12')}° = {au3('TP3_ANGLE_MORT')}°).
          </p>
        </Validation>
      </Question>
      <Question q={qu('tp3-i-q6')}>
        <QuestionOuverte id="tp3-i-q6" choix={C.ouvertes['tp3-i-q6']!.choix} attendu={C.ouvertes['tp3-i-q6']!.attendu} correction={<p>Non : la position ne se stabilise pas, le disque tourne tout le temps (vitesse finale {nombre(rampe.r.final.omega)} °/s). C’est l’intégrateur mécanique : la position est l’intégrale de la vitesse, θ(p) = Ω(p)/p. Aux TP1 et TP2, la vitesse se stabilisait.</p>} p={p} />
      </Question>

      <h3 className="pt-1 text-sm font-semibold">II.1 Antenne : consigne changée à la main (offset du GBF)</h3>
      <Question q={qu('tp3-ii1-reglages')}>
        <ul className="space-y-0.5 text-xs" hidden={examen} data-reglages="tp3-ii1">
          <Etat ok={s.gbf.forme === 'continu'}>tous les boutons de forme du GBF relâchés (tension continue, réglée par l’offset)</Etat>
          <Etat ok={s.platine.g1 === au3('TP3_G1') && s.platine.g2 === au3('TP3_G2')}>
            « Affichage G1 » à {au3('TP3_G1')} et G2 à {au3('TP3_G2')} : K = {nombre(K7)} (actuel : K = {nombre(K)})
          </Etat>
          <Etat ok={v[0]?.vdiv === au3('TP3_VOIE2_VDIV') && v[1]?.vdiv === au3('TP3_VOIE2_VDIV')}>voies 1 et 2 sur le calibre {formatSi(au3('TP3_VOIE2_VDIV'), 'V')}/div</Etat>
        </ul>
      </Question>
      <Question q={qu('tp3-ii1-cablage')}>
        <Liaisons liaisons={[LIAISON_TP3_ENLEVEE, ...MONTAGES['tp3-ii1'].liaisons]} verdict={verdict} examen={examen} />
        <p className="text-xs">5. Vérifiez que les 2 résistances placées sur les supports de la platine « régulateur analogique » ont bien des valeurs égales.</p>
        <p className="text-xs text-au3-muted">
          Supports : Z1 = {nomImpedance(s.platine.z1)}, Z2 = {nomImpedance(s.platine.z2)} (R1 = {formatSi(au3('R1'), 'Ω')}, R2 = {formatSi(au3('R2'), 'Ω')}, R3 = {formatSi(au3('TP3_R_EGALES'), 'Ω')}). « Faire vérifier » contrôle la n° 5.
        </p>
        {!examen && verdict?.impedances
          .filter((z) => z.support === 'egales')
          .map((z) => (
            <p key={z.support} className={z.ok ? 'text-xs text-au3-ok' : 'text-xs text-au3-err'} data-verdict-egales>
              {z.ok ? '✓' : '✗'} {z.message}
            </p>
          ))}
      </Question>
      <p className="text-xs text-au3-muted">Tournez la molette d’offset du GBF (platine sous tension) : le disque suit en temps réel. En mode de déclenchement Normal, la trace ne se met à jour qu’à un front : appuyez sur « Force Trigger ».</p>
      <Question q={qu('tp3-ii1-q1')}>
        <QuestionOuverte id="tp3-ii1-q1" choix={o('tp3-ii1-q1').choix} attendu={C.ouvertes['tp3-ii1-q1']!.attendu} correction={<p>Le disque tourne vers l’orientation qui correspond à la consigne, puis s’arrête. Modèle (consigne {formatSi(ctx.c, 'V')} depuis 0 V) : rotation de {nombre(ctx.mise.deplacement)}°, écart final {formatSi(ctx.mise.erreur, 'V')}.</p>} p={p} />
      </Question>
      <Question q={qu('tp3-ii1-q2')}>
        <QuestionOuverte id="tp3-ii1-q2" choix={o('tp3-ii1-q2').choix} attendu={C.ouvertes['tp3-ii1-q2']!.attendu} correction={<p>Il reste immobile (modèle : {nombre(ctx.repos.deplacement)}° en {afficher(ctx.demi, 's')}) : la mesure a rejoint la consigne, l’erreur e est presque nulle, donc U = K·e est plus petite que la tension de frottement ({formatSi(au3('TP3_UF'), 'V')}).</p>} p={p} />
      </Question>
      <Question q={qu('tp3-ii1-q3')}>
        <QuestionOuverte id="tp3-ii1-q3" choix={o('tp3-ii1-q3').choix} attendu={C.ouvertes['tp3-ii1-q3']!.attendu} correction={<p>Le disque tourne pour suivre la nouvelle orientation, dans le sens qui réduit l’erreur, et s’arrête quand la mesure (voie 2) rejoint la consigne (voie 1).</p>} p={p} />
      </Question>
      <Question q={qu('tp3-ii1-q4')}>
        <QuestionOuverte id="tp3-ii1-q4" choix={o('tp3-ii1-q4').choix} attendu={C.ouvertes['tp3-ii1-q4']!.attendu} correction={<p>Réaction rapide : pour un échelon de {formatSi(au3('TP3_GBF_VPP'), 'V')}, TR5%b = {afficher(k7.tr5, 's')} à K = 7, dépassement {nombre(k7.d1rel * PC)} %.</p>} p={p} />
      </Question>
      <Question q={qu('tp3-ii1-q5')}>
        <QuestionOuverte id="tp3-ii1-q5" choix={o('tp3-ii1-q5').choix} attendu={C.ouvertes['tp3-ii1-q5']!.attendu} correction={<p>Mesure et consigne superposées : erreur statique {nombre(Math.abs(k7.erreur) * PC)} % à K = 7.</p>} p={p} />
      </Question>
      <Question q={qu('tp3-ii1-q6')}>
        <QuestionOuverte
          id="tp3-ii1-q6"
          choix={o('tp3-ii1-q6').choix}
          attendu={C.ouvertes['tp3-ii1-q6']!.attendu}
          predit={qu('tp3-ii1-q6').cles}
          correction={
            <p data-predit>
              {SELON_MODELE}Non. Loin de ±12 V, le disque se positionne sur la consigne. À la limite de l’offset ({formatSi(au3('GBF_OFFSET_MAX'), 'V')}), le modèle arrête le disque à {nombre(ctx.limite.theta)}° du début de la piste, dans la soudure (la piste linéaire s’arrête à {nombre(DEGRES_PAR_TOUR - au3('TP3_ANGLE_MORT'))}°) : la mesure y vaut {formatSi(ctx.limite.mesure, 'V')} quel que soit l’angle, la position n’est plus mesurée ni régulée. Les orientations de l’angle mort ({au3('TP3_ANGLE_MORT')}°) sont inaccessibles ; c’est pourquoi « la consigne ne sera jamais choisie en limite d’angle mort ».
              <BadgeNonVerifie cles={qu('tp3-ii1-q6').cles} />
            </p>
          }
          p={p}
        />
      </Question>
      <Question q={qu('tp3-ii1-q7')}>
        <QuestionOuverte id="tp3-ii1-q7" choix={o('tp3-ii1-q7').choix} attendu={C.ouvertes['tp3-ii1-q7']!.attendu} correction={<p>À K = 1, le disque réagit plus mollement (TR5%b = {afficher(k1.tr5, 's')} contre {afficher(k7.tr5, 's')} à K = 7) et s’arrête avant la consigne : erreur statique {nombre(k1.erreur * PC)} %, car U = K·e passe sous la tension de frottement avant que e soit nulle.</p>} p={p} />
      </Question>
      <Question q={qu('tp3-ii1-q8')}>
        <QuestionOuverte id="tp3-ii1-q8" choix={o('tp3-ii1-q8').choix} attendu={C.ouvertes['tp3-ii1-q8']!.attendu} correction={<p>K = 7 : la position suit la consigne plus vite et plus précisément ; avec des gestes non brutaux, U ne sature pas longtemps. À K = 1, l’outil traîne derrière la consigne et s’arrête à côté.</p>} p={p} />
      </Question>
      <Question q={qu('tp3-ii1-valider')}>
        <Validation etape="conclusions" s={s} agir={agir} examen={examen}>
          <p>Le disque suit la consigne réglée à la main, d’autant mieux et plus vite que K est grand (K = 7 : TR5%b {afficher(k7.tr5, 's')}, erreur {nombre(Math.abs(k7.erreur) * PC)} % ; K = 1 : {afficher(k1.tr5, 's')}, {nombre(k1.erreur * PC)} %), si l’on ne manipule pas trop brusquement la consigne. Les positions de l’angle mort ne peuvent pas être régulées.</p>
        </Validation>
      </Question>

      <h3 className="pt-1 text-sm font-semibold">II.2 Essuie-glace : consigne carrée</h3>
      <Question q={qu('tp3-ii2-reglages')}>
        <ul className="space-y-0.5 text-xs" hidden={examen} data-reglages="tp3-ii2">
          <Etat ok={Math.abs(K - K7) < Number.EPSILON * K7}>K remis à {nombre(K7)} (actuel : {nombre(K)})</Etat>
          <Etat ok={Math.abs(s.gbf.offset) < G.pasOffset / 2}>offset à 0</Etat>
          <Etat ok={s.gbf.forme === 'carre' && proche(s.gbf.frequence, au3('TP3_GBF_FREQ'), G.pasFreq)}>carré de fréquence la plus près possible de {nombre(au3('TP3_GBF_FREQ'))} Hz</Etat>
          <Etat ok={proche(vpp, au3('TP3_GBF_VPP'), G.pasVpp)}>variation de {nombre(au3('TP3_GBF_VPP'))} V (entre −2 V et +2 V) (actuel : {nombre(vpp)} Vpp)</Etat>
        </ul>
      </Question>
      <Question q={qu('tp3-ii2-cablage')}>
        <Liaisons liaisons={MONTAGES['tp3-ii2'].liaisons.slice(0, 1)} verdict={verdict} examen={examen} />
        <ul className="space-y-0.5 text-xs" hidden={examen}>
          <Etat ok={v[2]?.vdiv === au3('TP3_VOIE3_VDIV')}>calibre de la voie 3 (seulement) à {formatSi(au3('TP3_VOIE3_VDIV'), 'V')}/div</Etat>
        </ul>
        <p className="text-xs text-au3-muted">Le reste du câblage est celui du II.1. Erreur E sur la voie 4 : facultatif (Observations Q4).</p>
      </Question>
      <Question q={qu('tp3-ii2-valider')}>
        <Validation etape="courbes" s={s} agir={agir} examen={examen}>
          <p>Courbes attendues (K = 7, ±2 V, 0,2 Hz) : la mesure M rejoint la consigne en {afficher(k7.tr5, 's')} (TR5%b) sans dépassement visible ; U (voie 3) sature à ±{formatSi(au3('USAT'), 'V')} pendant {afficher(k7.dureeSaturation, 's')} au début de chaque échelon, puis revient vers 0.</p>
        </Validation>
      </Question>
      <Question q={qu('tp3-ii2-o-q1')}>
        <QuestionOuverte id="tp3-ii2-o-q1" choix={o('tp3-ii2-o-q1').choix} attendu={C.ouvertes['tp3-ii2-o-q1']!.attendu} correction={<p>Oui : bouclée, la position se stabilise après un régime transitoire (m(∞) = {afficher(k7.dm, 'V')} pour C0 = {formatSi(au3('TP3_GBF_VPP'), 'V')}), comme la vitesse aux TP1 et TP2. En boucle ouverte (partie I), elle ne se stabilisait pas.</p>} p={p} />
      </Question>
      <Question q={qu('tp3-ii2-o-q2')}>
        <QuestionOuverte id="tp3-ii2-o-q2" choix={o('tp3-ii2-o-q2').choix} attendu={C.ouvertes['tp3-ii2-o-q2']!.attendu} correction={<p>Tangente à l’origine horizontale (pente au démarrage {nombre(k7.penteRelative * PC)} % de celle d’un 1er ordre de même τ) : ordre 2 au moins. Le moteur part à vitesse nulle, la position démarre donc avec une pente nulle.</p>} p={p} />
      </Question>
      <Question q={qu('tp3-ii2-o-q3')}>
        <QuestionOuverte id="tp3-ii2-o-q3" choix={o('tp3-ii2-o-q3').choix} attendu={C.ouvertes['tp3-ii2-o-q3']!.attendu} correction={<p>Oui : erreur statique {nombre(Math.abs(k7.erreur) * PC)} %, sous {nombre(au3('TP4_ERREUR_MAX') * PC)} %.</p>} p={p} />
      </Question>
      <Question q={qu('tp3-ii2-o-q4')}>
        <QuestionOuverte id="tp3-ii2-o-q4" choix={o('tp3-ii2-o-q4').choix} attendu={C.ouvertes['tp3-ii2-o-q4']!.attendu} correction={<p>Oui (à {nombre(Math.abs(k7.erreur) * PC)} % près) : E = C − M revient à 0 en régime permanent. L’intégrateur mécanique (la position intègre la vitesse) annule l’erreur statique, même avec un régulateur P, tant que K·e vainc le frottement.</p>} p={p} />
      </Question>
      <Question q={qu('tp3-ii2-o-q5')}>
        <QuestionOuverte id="tp3-ii2-o-q5" choix={o('tp3-ii2-o-q5').choix} attendu={C.ouvertes['tp3-ii2-o-q5']!.attendu} correction={<p>Non : au front, E = {formatSi(au3('TP3_GBF_VPP'), 'V')} et K × E = {nombre(K7 * au3('TP3_GBF_VPP'))} V &gt; {formatSi(au3('USAT'), 'V')} : U sature à ±{formatSi(au3('USAT'), 'V')} pendant {afficher(k7.dureeSaturation, 's')} au début de chaque échelon (U plat alors que E décroît), puis U = K·E redevient linéaire.</p>} p={p} />
      </Question>

      <h4 className="text-xs font-semibold">Mesures (K = 7)</h4>
      <Question q={qu('tp3-ii2-m-q1')}>
        <ChampNum champ={C.champs['tp3-ii2-m-q1']} label="m(∞)" p={p} />
      </Question>
      <Question q={qu('tp3-ii2-m-q2')}>
        <ChampNum champ={C.champs['tp3-ii2-m-q2']} label="G0b" p={p} />
      </Question>
      <Question q={qu('tp3-ii2-m-q3')}>
        <p className="text-xs text-au3-muted">Le K de la platine au moment de la réponse est enregistré (K = {nombre(K)}) : à K = 7, D1 = 0 ; à K = 9, D1 du modèle.</p>
        <ChampNum champ={C.champs['tp3-ii2-m-q3']} label="D1" p={p} lire={lireK} apres={() => <span className="block text-au3-muted"> Modèle : D1 = {afficher(k7.d1, 'V')} à K = 7, {afficher(k9.d1, 'V')} ({nombre(k9.d1rel * PC)} %) à K = 9.</span>} />
      </Question>
      <Question q={qu('tp3-ii2-m-q4')}>
        <ChampNum champ={C.champs['tp3-ii2-m-q4']} label="D1/m(∞)" p={p} lire={lireK} />
      </Question>
      <Question q={qu('tp3-ii2-m-q5')}>
        <ChampNum champ={C.champs['tp3-ii2-m-q5']} label="TR5%b" p={p} lire={lireTr5} />
      </Question>
      <Question q={qu('tp3-ii2-m-q6')}>
        <QuestionOuverte id="tp3-ii2-m-q6" choix={o('tp3-ii2-m-q6').choix} attendu={C.ouvertes['tp3-ii2-m-q6']!.attendu} correction={<p>L’entrée « Mesure » est en l’air (0 V) : l’erreur vaut la consigne, U = K·C sature à {formatSi(ctx.fil.u, 'V')} et le disque tourne sans arrêt ({nombre(ctx.fil.tours)} tours en {afficher(ctx.demi, 's')} dans le modèle) : la boucle est ouverte, comme en partie I.</p>} p={p} />
      </Question>
      <Question q={qu('tp3-ii2-m-q7')}>
        <QuestionOuverte
          id="tp3-ii2-m-q7"
          choix={o('tp3-ii2-m-q7').choix}
          attendu={C.ouvertes['tp3-ii2-m-q7']!.attendu}
          correction={
            <>
              <ul data-comparaison-k>
                {ctx.comparaison.essais.map((x) => (
                  <li key={x.K} className={x.a.respecte ? 'text-au3-ok' : 'text-au3-muted'}>
                    K = {x.K} : erreur statique {nombre(Math.abs(x.a.erreur) * PC)} %, TR5%b = {afficher(x.a.tr5, 's')} {x.a.respecte ? '— cahier des charges respecté' : '— non respecté'}
                  </li>
                ))}
              </ul>
              <p>Ensemble des K qui respectent le cahier des charges (calculé par simulation) : {ctx.comparaison.retenus.map((k) => `K = ${k}`).join(', ') || 'aucun'}. Si K est trop petit, le frottement sec empêche la mesure de rejoindre la consigne.</p>
              <FigureK comparaison={ctx.comparaison} />
            </>
          }
          p={p}
        />
      </Question>
    </div>
  )
}
