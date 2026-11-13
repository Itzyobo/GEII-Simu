import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { AU3_QUESTIONS, type QuestionAu3 } from '../../data/questions.au3'
import { au3, type RefKey } from '../../data/reference'
import { ampliBloque } from '../banc'
import { exporterCsv, type Enregistrement } from '../instruments/oscillo'
import { MISE_EN_PAGE } from '../miseEnPage'
import { chargerSession, type ProgressionEssai, type SessionAu3 } from '../session'
import { inverserDt, MONTAGE_TP2, oublierAmpli, PRECABLAGE_TP2 } from '../sim/cablage'
import { gainAffichage } from '../sim/regulateur'
import Abaque from '../tp1/AbaqueInteractif'
import { catalogueTp2, contexteTp2, Q12_CHOIX } from '../examen/catalogue'
import { afficher, commandWindow, fenetreDeCsv, lecturesAffichees, nombre, noteTr5, pourcent, valeurDe } from '../tp1/affichage'
import { identifier, partNonExpliquee } from '../tp1/identification'
import { ChampNum, Question, QuestionOuverte, type PropsReponse } from '../tp1/Reponses'
import { Superposition } from '../tp1/Superposition'
import { ecartTr5b } from '../tp2/attendus'
import BadgeNonVerifie from '../ui/BadgeNonVerifie'
import Etabli from '../ui/Etabli'
import { formatSi } from '../ui/format'
import type { PropsPage } from '../ui/types'
import { useBanc } from '../ui/useBanc'

const Q = Object.fromEntries(AU3_QUESTIONS.filter((q) => q.tp === 'tp2').map((q) => [q.id, q])) as Record<string, QuestionAu3>
const qu = (id: string): QuestionAu3 => {
  const q = Q[id]
  if (!q) throw new Error(`Question TP2 inconnue : ${id}`)
  return q
}
const TOL_M = au3('TOL_MESURE')
const Q12_SANS_OBJET = Q12_CHOIX[0]
const K38 = gainAffichage(au3('TP2_K38_G1'), au3('TP2_K38_G2'))
const NOTE_TR5_38 = noteTr5(ecartTr5b('k38'), 'dérive lente non modélisée')
const NOTE_TR5_40 = noteTr5(ecartTr5b('k40'), 'm(∞) lu avant stabilisation dans le CR')
const VARIANTES_CLES: RefKey[] = ['R_INDUIT', 'G0R', 'UF', 'TAU_A', 'TAU_B']
const G = MISE_EN_PAGE.gbf
const proche = (a: number, b: number, pas: number) => Math.abs(a - b) <= pas / 2

const Etat = ({ ok, children }: { ok: boolean; children: ReactNode }) => <li className={ok ? 'text-au3-ok' : 'text-au3-muted'}>{ok ? '✓' : '○'} {children}</li>

function Coherence({ libelle, a, b, tol }: { libelle: string; a: number | null; b: number | null; tol: number }) {
  if (a === null || b === null) return <li className="text-au3-muted">{libelle} : réponse manquante, cohérence non vérifiée</li>
  const ok = Math.abs(a / b - 1) <= tol
  return (
    <li className={ok ? 'text-au3-ok' : 'text-au3-err'}>
      {ok ? '✓' : '✗'} {libelle} : {nombre(a)} dans la fonction de transfert, {nombre(b)} dans votre réponse
    </li>
  )
}

/** Bloc export .csv + identification moindres carrés ordre 2 d'un essai */
function Identification({ s, essai, fichier, rec, agir }: { s: SessionAu3; essai: 'k38' | 'k40'; fichier: string; rec: Enregistrement | null; agir: PropsReponse['agir'] }) {
  const pr = s.tp2[essai]
  const fen = useMemo(() => fenetreDeCsv(pr.csv), [pr.csv])
  const tangentes = false
  const exporter = () => {
    if (!rec) return
    const csv = exporterCsv(rec)
    agir({ type: 'tp2', essai, patch: { csv, ordre1: null, ordre2: null } })
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = fichier
    a.click()
    URL.revokeObjectURL(url)
  }
  const cr = essai === 'k38' ? (['CR_TP2K38_MATLAB_G0B', 'CR_TP2K38_MATLAB_ZB', 'CR_TP2K38_MATLAB_WNB'] as const) : (['CR_TP2K40_MATLAB_G0B', 'CR_TP2K40_MATLAB_ZB', 'CR_TP2K40_MATLAB_WNB'] as const)
  return (
    <section aria-label={`Identification moindres carrés, ${essai === 'k38' ? 'K = 3,8' : 'K = 40'}`} className="space-y-2 rounded-lg bg-au3-panel p-3 ring-1 ring-au3-line">
      <p className="text-xs text-au3-muted">Étapes 1 à 8 (scripts Matlab, import du .csv) remplacées par : « Exporter .csv », puis « Identification moindres carrés ordre 2 ».</p>
      <div className="flex flex-wrap gap-2 text-xs">
        <button type="button" onClick={exporter} disabled={!rec} className="rounded bg-au3-accent px-2 py-1 font-semibold text-on-accent disabled:opacity-40">
          Exporter .csv ({fichier})
        </button>
        <button type="button" onClick={() => fen && agir({ type: 'tp2', essai, patch: { ordre2: identifier(fen, 2) } })} disabled={!fen} className="rounded bg-au3-panel-2 px-2 py-1 ring-1 ring-au3-line disabled:opacity-40">
          Identification moindres carrés ordre 2 ({fichier})
        </button>
      </div>
      {pr.csv && !fen && <p className="text-xs text-au3-err">Le .csv ne contient pas un échelon positif sur les voies 1 et 2 : vérifiez le déclenchement et les voies actives, puis exportez de nouveau.</p>}
      {fen && pr.ordre2 && (
        <div className="space-y-1">
          <pre className="overflow-x-auto rounded bg-black p-2 font-mono text-[11px] text-[#d4d4d4]" aria-label={`Command Window ${fichier}`} data-command-window={essai}>
            {commandWindow(fen, pr.ordre2)}
          </pre>
          <p className="text-[11px] text-au3-muted" hidden={s.mode === 'examen'}>
            Pour comparaison, Matlab dans le CR (non testé, ne sert pas de référence) : G0b = {nombre(au3(cr[0]))}, zb = {nombre(au3(cr[1]))}, ωnb = {nombre(au3(cr[2]))} rad/s
          </p>
          <Superposition f={fen} r={pr.ordre2} tangentes={tangentes} />
        </div>
      )}
    </section>
  )
}

/** TP2 : MCC + DT en boucle fermée avec un régulateur proportionnel, K = 3,8 puis K = 40 */
export default function Tp2() {
  const b = useBanc('tp2', 'tp2')
  return <PageTp2 {...b} />
}

/** TP2 piloté par un banc : entraînement (/au3/tp2) ou examen (aucun indice, aucune correction) */
export function PageTp2({ etat, agir, entete }: PropsPage) {
  const s = etat.session
  const [ouvert, setOuvert] = useState(true)
  const [rec, setRec] = useState<Enregistrement | null>(null)
  const onEnregistrement = useCallback((r: Enregistrement | null) => setRec(r), [])
  const p: PropsReponse = { session: s, agir, examen: s.mode === 'examen' }
  const v = (id: string, unite: string) => valeurDe(s, id, unite)
  // Valeurs TP1 de l'étudiant : sa session d'entraînement TP1 (aucune en examen)
  const sessionTp1 = useMemo(() => (s.mode === 'examen' || typeof localStorage === 'undefined' ? null : chargerSession(localStorage, 'libre', 'tp1')), [s.mode])
  const ctx = contexteTp2(s, sessionTp1)
  const C = catalogueTp2(ctx)
  const { K, vpp: vppEtudiant, a38, a40, tp1, f38, o38, o40, q12, res40, id38, lTh, lFit38, lFit40, theo40, ecartStatique } = ctx
  const lireTr5 = () => lecturesAffichees(rec)

  const reglages38 = [
    { ok: s.gbf.forme === 'carre', texte: 'forme périodique carrée' },
    { ok: proche(s.gbf.frequence, au3('TP2_GBF_FREQ'), G.pasFreq), texte: `fréquence la plus près possible de ${nombre(au3('TP2_GBF_FREQ'))} Hz` },
    { ok: proche(vppEtudiant, au3('TP2_K38_GBF_VPP'), G.pasVpp), texte: `Vpp ≈ ${nombre(au3('TP2_K38_GBF_VPP'))} V (actuel : ${nombre(vppEtudiant)} Vpp)` },
    { ok: Math.abs(s.gbf.offset) < G.pasOffset / 2, texte: 'sans offset' },
    { ok: s.platine.g1 === au3('TP2_K38_G1') && s.platine.g2 === au3('TP2_K38_G2'), texte: `Affichage G1 = ${au3('TP2_K38_G1')}, G2 = ${au3('TP2_K38_G2')} → K = ${nombre(K)} (calculé)` },
  ]
  const reglages40 = [
    { ok: proche(vppEtudiant, au3('TP2_K40_GBF_VPP'), au3('TP2_K40_GBF_VPP') * G.pasVpp), texte: `Vpp ≈ ${nombre(au3('TP2_K40_GBF_VPP'))} V, atténuation 20 dB si nécessaire (actuel : ${nombre(vppEtudiant)} Vpp)` },
    { ok: s.platine.g1 === au3('TP2_K40_G1') && s.platine.g2 === au3('TP2_K40_G2'), texte: `Affichage G1 = ${au3('TP2_K40_G1')}, G2 = ${au3('TP2_K40_G2')} → K = ${nombre(K)} (calculé)` },
    { ok: !s.platine.sousTension, texte: 'platine éteinte pendant le changement' },
  ]
  const voie3 = s.oscillo.voies[2]

  const ecarts = (lignes: readonly { nom: string; a: number | undefined | null; b: number | null; tol: number }[], noms: [string, string]) => (
    <ul className="space-y-0.5">
      {lignes.map((l) => (
        <li key={l.nom}>
          {l.nom} : {noms[0]} {l.a == null ? '—' : nombre(l.a)}, {noms[1]} {l.b === null ? '—' : nombre(l.b)}
          {l.a != null && l.b !== null && ` (écart ${pourcent(l.a / l.b - 1)}, tolérance ±${Math.round(l.tol * MISE_EN_PAGE.pourcent)} %)`}
        </li>
      ))}
    </ul>
  )
  const variante = (nom: string, action: () => void) => (
    <button type="button" disabled={s.platine.sousTension} onClick={action} className="rounded bg-au3-panel-2 px-2 py-1 ring-1 ring-au3-line disabled:opacity-40">
      {nom}
    </button>
  )

  const panneau = (
    <div className="space-y-3 text-sm">
      <h2 className="text-base font-semibold">Questions du TP2</h2>

      <Question q={qu('tp2-reglages')}>
        <ul className="space-y-0.5 text-xs" data-reglages="k38" hidden={p.examen}>
          {reglages38.map((r) => (
            <Etat key={r.texte} ok={r.ok}>
              {r.texte}
            </Etat>
          ))}
        </ul>
      </Question>

      <Question q={qu('tp2-cablage')}>
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
        <ul className="text-xs" data-controles-cablage hidden={p.examen}>
          <Etat ok={!!voie3 && voie3.vdiv === au3('TP2_VOIE3_VDIV')}>Voie 3 au calibre {au3('TP2_VOIE3_VDIV')} V/div (liaison 9)</Etat>
          <li className="text-au3-muted">Liaisons 4 et 6 : câbles noirs (une masse non noire est signalée sur l’établi).</li>
          <li className="text-au3-warn">Pré-câblé (pointillés) : GBF MAIN OUT → voie 1. L’énoncé fait observer la consigne sur la voie 1 mais aucune liaison numérotée ne la câble.</li>
        </ul>
      </Question>

      <Question q={qu('tp2-sous-tension')} badge={p.examen ? undefined : 'Blocage de l’ampli de courant et dissymétrie du GBF : comportements supposés (hypothèses), non mesurés.'}>
        <ul className="space-y-0.5 text-xs" data-sous-tension hidden={p.examen}>
          <Etat ok={s.verifieSur !== null}>câblage vérifié (« Faire vérifier »)</Etat>
          <Etat ok={s.platine.sousTension}>platine sous tension</Etat>
          <Etat ok={!ampliBloque(s.platine.ampli)}>ampli de courant : {s.platine.ampli === 'normal' ? 'normal' : s.platine.ampli.startsWith('reamorce') ? 'réamorcé, remplacez la masse par la sortie G2 sans éteindre' : 'bloqué'}</Etat>
        </ul>
        <p className="text-xs text-au3-muted" hidden={p.examen}>Procédure de l’énoncé si le moteur tourne tout le temps dans le même sens : éteindre, entrée de l’ampli à la masse, rallumer, puis remettre la source sans éteindre. Au TP2, l’entrée de l’ampli est reliée à la sortie G2 (liaison 2) : c’est elle qui remplace la masse (l’énoncé écrit « le signal venant du GBF », repris du TP1).</p>
      </Question>

      <h3 className="pt-2 text-sm font-semibold">I.1 Boucle fermée, K = 3,8</h3>
      <Question q={qu('tp2-i1-ordre')}>
        <QuestionOuverte id="tp2-i1-ordre" choix={C.ouvertes['tp2-i1-ordre']!.choix} attendu={C.ouvertes['tp2-i1-ordre']!.attendu} correction={<p>Tangente à l’origine quasi horizontale (pente {nombre(a38.penteRelative)} fois celle d’un 1er ordre de même τ), comme au TP1 : ordre 2, sans dépassement visible.</p>} p={p} />
      </Question>
      <Question q={qu('tp2-i11-q1')}>
        <QuestionOuverte id="tp2-i11-q1" choix={C.ouvertes['tp2-i11-q1']!.choix} attendu={C.ouvertes['tp2-i11-q1']!.attendu} correction={<p>m(∞) = {afficher(a38.dm, 'V')} pour C0 = {afficher(a38.c0, 'V')} : erreur statique de {pourcent(a38.dm / a38.c0 - 1)}. Un régulateur proportionnel ne l’annule pas.</p>} p={p} />
      </Question>
      <Question q={qu('tp2-i11-q2')}>
        <ChampNum champ={C.champs['tp2-i11-q2']} label="m(∞) = ΔY" p={p} />
      </Question>
      <Question q={qu('tp2-i11-q3')}>
        <ChampNum champ={C.champs['tp2-i11-q3']} label="C0 = ΔY" p={p} />
      </Question>
      <Question q={qu('tp2-i11-q4')}>
        <ChampNum champ={C.champs['tp2-i11-q4']} label="G0b = m(∞)/C0" p={p} />
      </Question>
      <Question q={qu('tp2-i11-q5')} />
      <Question q={qu('tp2-i11-q6')}>
        <ChampNum champ={C.champs['tp2-i11-q6#t1']} label="t1 (26,4 %)" p={p} />
        <ChampNum champ={C.champs['tp2-i11-q6#t3']} label="t3 (80,1 %)" p={p} />
        <ChampNum champ={C.champs['tp2-i11-q6#rapport']} label="t3/t1" p={p} />
        <Abaque tp1={s.tp2.k38} examen={p.examen} onChange={(patch: Partial<ProgressionEssai>) => agir({ type: 'tp2', essai: 'k38', patch })} />
        <ChampNum champ={C.champs['tp2-i11-q6']} label="zb (abaque)" p={p} />
      </Question>
      <Question q={qu('tp2-i11-q7')}>
        <ChampNum champ={C.champs['tp2-i11-q7#wnt3']} label="ωnb·t3 (abaque)" p={p} />
        <ChampNum champ={C.champs['tp2-i11-q7']} label="ωnb = (ωnb·t3)/t3" p={p} />
      </Question>
      <Question q={qu('tp2-i11-gb2')}>
        <p className="font-mono text-xs">Gb2(p) = G0b / (1 + 2zb·p/ωnb + p²/ωnb²)</p>
        <ChampNum champ={C.champs['tp2-i11-gb2#g0b']} label="G0b dans Gb2(p)" p={p} />
        <ChampNum champ={C.champs['tp2-i11-gb2#zb']} label="zb dans Gb2(p)" p={p} />
        <ChampNum champ={C.champs['tp2-i11-gb2#wnb']} label="ωnb dans Gb2(p)" p={p} />
        {!!s.reponses['tp2-i11-gb2#g0b'] && !p.examen && (
          <ul className="text-xs" data-coherence="gb2">
            <Coherence libelle="G0b" a={v('tp2-i11-gb2#g0b', '')} b={id38.g0b} tol={TOL_M} />
            <Coherence libelle="zb" a={v('tp2-i11-gb2#zb', '')} b={id38.zb} tol={TOL_M} />
            <Coherence libelle="ωnb" a={v('tp2-i11-gb2#wnb', 'rad/s')} b={id38.wnb} tol={TOL_M} />
          </ul>
        )}
      </Question>
      <Question q={qu('tp2-i11-q8')}>
        <p className="text-xs text-au3-muted" data-source-tp1 hidden={p.examen}>
          Calculées avec {tp1.source} : G0 = {nombre(tp1.g0)}, z = {nombre(tp1.z)}, ωn = {nombre(tp1.wn)} rad/s ; K = {nombre(K38)}.
        </p>
        <ChampNum champ={C.champs['tp2-i11-q8#g0b']} label="G0b théorique" p={p} />
        <ChampNum champ={C.champs['tp2-i11-q8#zb']} label="zb théorique" p={p} />
        <ChampNum champ={C.champs['tp2-i11-q8#wnb']} label="ωnb théorique" p={p} />
      </Question>
      <Question q={qu('tp2-i11-q9')}>
        <QuestionOuverte
          id="tp2-i11-q9"
          choix={C.ouvertes['tp2-i11-q9']!.choix}
          attendu={C.ouvertes['tp2-i11-q9']!.attendu}
          correction={
            <>
              {ecarts(lTh, ['identifié', 'théorique'])}
              <p>Cause principale : le frottement sec. Le gain apparent du moteur baisse quand l’amplitude de la commande diminue (G0 apparent = G0r·(ΔU − 2Uf)/ΔU), et la commande est plus petite en boucle fermée qu’au TP1 : G0b identifié plus faible que la théorie linéaire.</p>
            </>
          }
          p={p}
        />
      </Question>
      <Question q={qu('tp2-i11-q10')} badge={p.examen ? undefined : NOTE_TR5_38}>
        <ChampNum champ={C.champs['tp2-i11-q10#seuil']} label="0,95·m(∞)" p={p} />
        <ChampNum champ={C.champs['tp2-i11-q10']} label="TR5%b" p={p} lire={lireTr5} />
      </Question>

      <h3 className="pt-2 text-sm font-semibold">I.1.2 Identification par un modèle d’ordre 2 avec K = 3,8 : Optimisation avec Matlab®</h3>
      <Identification s={s} essai="k38" fichier="Signaux_2.csv" rec={rec} agir={agir} />
      <Question q={qu('tp2-i12-q9')}>
        <QuestionOuverte id="tp2-i12-q9" choix={C.ouvertes['tp2-i12-q9']!.choix} attendu={C.ouvertes['tp2-i12-q9']!.attendu} correction={o38 ? ecarts(lFit38, ['moindres carrés', 'vous']) : <p>Lancez d’abord l’identification.</p>} p={p} />
      </Question>
      <Question q={qu('tp2-i12-q10')}>
        <QuestionOuverte id="tp2-i12-q10" choix={C.ouvertes['tp2-i12-q10']!.choix} attendu={C.ouvertes['tp2-i12-q10']!.attendu} correction={f38 && o38 ? <p>Part de la mesure non expliquée par le modèle : {pourcent(partNonExpliquee(f38, o38))} : les courbes sont superposées.</p> : <p>Lancez d’abord l’identification.</p>} p={p} />
      </Question>
      <Question q={qu('tp2-i12-q11')}>
        <QuestionOuverte id="tp2-i12-q11" choix={C.ouvertes['tp2-i12-q11']!.choix} attendu={C.ouvertes['tp2-i12-q11']!.attendu} correction={<p>Oui : le 2e ordre suit le démarrage (tangente horizontale) et la valeur finale ; seule la dérive lente du moteur réel, non modélisée ici, peut s’écarter en fin de palier.</p>} p={p} />
      </Question>
      <Question q={qu('tp2-i12-q12')}>
        {q12 && q12.choix !== Q12_SANS_OBJET && (
          <>
            <ChampNum champ={C.champs['tp2-i12-q12#tau1']} label="τ1 (plus petite)" p={p} />
            <ChampNum champ={C.champs['tp2-i12-q12#tau2']} label="τ2 (plus grande)" p={p} />
          </>
        )}
        <QuestionOuverte
          id="tp2-i12-q12"
          choix={C.ouvertes['tp2-i12-q12']!.choix}
          attendu={C.ouvertes['tp2-i12-q12']!.attendu}
          correction={
            !o38 || !q12 ? (
              <p>Lancez d’abord l’identification : la réponse dépend du zb de votre modèle.</p>
            ) : q12.tau1 === null ? (
              <p>Votre fit donne zb = {nombre(o38.z!)} &lt; 1 : pôles complexes, pas de constantes de temps réelles. Question sans objet.</p>
            ) : (
              <p>
                Votre fit donne zb = {nombre(o38.z!)} ≥ 1 : τ = 1/(ωnb(zb ∓ √(zb² − 1))) = {formatSi(q12.tau1, 's')} et {formatSi(q12.tau2!, 's')}, rapport {nombre(q12.tau2! / q12.tau1)} {q12.negligeable ? '≥' : '<'} {au3('RAPPORT_NEGLIGEABLE')} : {q12.negligeable ? 'la plus petite est négligeable' : 'aucune n’est négligeable'}.
              </p>
            )
          }
          p={p}
        />
      </Question>

      <h3 className="pt-2 text-sm font-semibold">I.2 Boucle fermée, K = 40</h3>
      <Question q={qu('tp2-i2-reglages')}>
        <ul className="space-y-0.5 text-xs" data-reglages="k40" hidden={p.examen}>
          {reglages40.map((r) => (
            <Etat key={r.texte} ok={r.ok}>
              {r.texte}
            </Etat>
          ))}
        </ul>
        <p className="text-xs text-au3-muted">Remarque de l’énoncé : le signal de sortie peut « sembler » ne pas s’afficher. Dézoomez temporellement pour voir une période entière, et adaptez les calibres (0,3 V sur des calibres prévus pour 3,2 V occupe peu de place à l’écran).</p>
      </Question>
      <Question q={qu('tp2-i2-ordre')}>
        <QuestionOuverte id="tp2-i2-ordre" choix={C.ouvertes['tp2-i2-ordre']!.choix} attendu={C.ouvertes['tp2-i2-ordre']!.attendu} correction={<p>Dépassement D1/m(∞) = {pourcent(a40.d1rel)} et oscillations amorties : ordre 2 avec zb &lt; 1 (un 1er ordre ne dépasse jamais sa valeur finale).</p>} p={p} />
      </Question>
      <Question q={qu('tp2-i21-q1')}>
        <QuestionOuverte id="tp2-i21-q1" choix={C.ouvertes['tp2-i21-q1']!.choix} attendu={C.ouvertes['tp2-i21-q1']!.attendu} correction={<p>m(∞) = {afficher(a40.dm, 'V')} pour C0 = {afficher(a40.c0, 'V')} : erreur statique de {pourcent(a40.dm / a40.c0 - 1)}, plus faible qu’à K = 3,8 mais non nulle.</p>} p={p} />
      </Question>
      <Question q={qu('tp2-i21-q2')}>
        <ChampNum champ={C.champs['tp2-i21-q2']} label="C0 = ΔY" p={p} />
      </Question>
      <Question q={qu('tp2-i21-q3')}>
        <ChampNum champ={C.champs['tp2-i21-q3']} label="m(∞) = ΔY" p={p} />
      </Question>
      <Question q={qu('tp2-i21-q4')}>
        <ChampNum champ={C.champs['tp2-i21-q4']} label="G0b = m(∞)/C0" p={p} />
      </Question>
      <Question q={qu('tp2-i21-q5')}>
        <QuestionOuverte
          id="tp2-i21-q5"
          choix={C.ouvertes['tp2-i21-q5']!.choix}
          attendu={C.ouvertes['tp2-i21-q5']!.attendu}
          correction={
            <p>
              Non : G0b = {nombre(a40.g0b)} contre {nombre(a38.g0b)} à K = 3,8, plus grand, car G0b = KG0/(1+KG0) tend vers 1 quand K augmente. La théorie linéaire donne {nombre(theo40)} : l’écart ({pourcent(a40.g0b / theo40 - 1)}) vient du frottement sec, qui réduit le gain apparent en petite amplitude.
            </p>
          }
          p={p}
        />
      </Question>
      <Question q={qu('tp2-i21-q6')}>
        <ChampNum champ={C.champs['tp2-i21-q6']} label="D1 = ΔY" p={p} />
      </Question>
      <Question q={qu('tp2-i21-q7')}>
        <ChampNum champ={C.champs['tp2-i21-q7']} label="D1/m(∞)" p={p} />
      </Question>
      <Question q={qu('tp2-i21-q8')}>
        <p className="font-mono text-xs">zb = −ln(D1/m∞) / √(π² + ln²(D1/m∞))</p>
        <ChampNum champ={C.champs['tp2-i21-q8']} label="zb (formule)" p={p} />
      </Question>
      <Question q={qu('tp2-i21-q9')}>
        <ChampNum champ={C.champs['tp2-i21-q9']} label="Tpb/2" p={p} />
      </Question>
      <Question q={qu('tp2-i21-q10')}>
        <p className="font-mono text-xs">ωnb = 2π / (Tpb·√(1 − zb²))</p>
        <ChampNum champ={C.champs['tp2-i21-q10']} label="ωnb (formule)" p={p} />
      </Question>
      <Question q={qu('tp2-i21-q12')} badge={p.examen ? undefined : NOTE_TR5_40}>
        <ChampNum champ={C.champs['tp2-i21-q12#bas']} label="0,95·m(∞)" p={p} />
        <ChampNum champ={C.champs['tp2-i21-q12#haut']} label="1,05·m(∞)" p={p} />
        <ChampNum champ={C.champs['tp2-i21-q12']} label="TR5%b" p={p} lire={lireTr5} />
        <QuestionOuverte id="tp2-i21-q12#meme" choix={C.ouvertes['tp2-i21-q12#meme']!.choix} attendu={C.ouvertes['tp2-i21-q12#meme']!.attendu} correction={<p>TR5%b = {formatSi(a40.tr5, 's')} à K = 40 contre {formatSi(a38.tr5, 's')} à K = 3,8 : plus rapide car ωnb augmente avec K (ωnb = ωn√(1+KG0)), malgré les oscillations (zb plus petit).</p>} p={p} />
      </Question>

      <h3 className="pt-2 text-sm font-semibold">I.2.2 Identification par un modèle d’ordre 2 avec K = 40 : Optimisation avec Matlab®</h3>
      <Identification s={s} essai="k40" fichier="Signaux_2_40.csv" rec={rec} agir={agir} />
      <Question q={qu('tp2-i22-q9')}>
        <QuestionOuverte id="tp2-i22-q9" choix={C.ouvertes['tp2-i22-q9']!.choix} attendu={C.ouvertes['tp2-i22-q9']!.attendu} correction={o40 ? ecarts(lFit40, ['moindres carrés', 'vous']) : <p>Lancez d’abord l’identification.</p>} p={p} />
      </Question>
      <Question q={qu('tp2-i22-q10')}>
        <QuestionOuverte
          id="tp2-i22-q10"
          choix={C.ouvertes['tp2-i22-q10']!.choix}
          attendu={C.ouvertes['tp2-i22-q10']!.attendu}
          correction={res40 ? <p>Écart quadratique moyen modèle − mesure : {afficher(res40.demarrage, 'V')} au démarrage, {afficher(res40.permanent, 'V')} en régime permanent.</p> : <p>Lancez d’abord l’identification.</p>}
          p={p}
        />
      </Question>
      <Question q={qu('tp2-i22-q11')}>
        <QuestionOuverte
          id="tp2-i22-q11"
          choix={C.ouvertes['tp2-i22-q11']!.choix}
          attendu={C.ouvertes['tp2-i22-q11']!.attendu}
          correction={<p>Le 2e ordre suit le dépassement et les oscillations. Phénomène négligé : le frottement sec (non linéaire), qui fait dépendre le gain apparent de l’amplitude ; le modèle linéaire identifié n’est valable que pour cette amplitude de consigne. La saturation de U (±10,6 V) n’est pas atteinte ici.</p>}
          p={p}
        />
      </Question>
      <Question q={qu('tp2-i22-q12')}>
        <p className="text-xs text-au3-muted">Optionnelle, non notée.</p>
      </Question>

      <h3 className="pt-2 text-sm font-semibold">Conclusions du TP2 à retenir</h3>
      <Question q={qu('tp2-conclusion-1')}>
        <QuestionOuverte id="tp2-conclusion-1" choix={C.ouvertes['tp2-conclusion-1']!.choix} attendu={C.ouvertes['tp2-conclusion-1']!.attendu} correction={<p>Non : l’erreur statique n’est jamais nulle avec un régulateur proportionnel (pas d’intégrateur dans la boucle) : {pourcent(-ecartStatique(a38))} à K = 3,8, {pourcent(-ecartStatique(a40))} à K = 40.</p>} p={p} />
      </Question>
      <Question q={qu('tp2-conclusion-2')}>
        <QuestionOuverte id="tp2-conclusion-2" choix={C.ouvertes['tp2-conclusion-2']!.choix} attendu={C.ouvertes['tp2-conclusion-2']!.attendu} correction={<p>Non : quel que soit K, l’erreur reste non nulle ; seule sa valeur ε∞/C0 = 1/(1+KG0) diminue quand K augmente.</p>} p={p} />
      </Question>
      <p className="text-xs text-au3-muted">Pour laquelle des 2 valeurs de K, 3,8 ou 40 :</p>
      <Question q={qu('tp2-comparaison-ecart')}>
        <QuestionOuverte id="tp2-comparaison-ecart" choix={C.ouvertes['tp2-comparaison-ecart']!.choix} attendu={C.ouvertes['tp2-comparaison-ecart']!.attendu} correction={<p>Écart statique relatif : {pourcent(ecartStatique(a38))} à K = 3,8, {pourcent(ecartStatique(a40))} à K = 40.</p>} p={p} />
      </Question>
      <Question q={qu('tp2-comparaison-tr5')} badge={p.examen ? undefined : `${NOTE_TR5_38} ; ${NOTE_TR5_40}`}>
        <QuestionOuverte id="tp2-comparaison-tr5" choix={C.ouvertes['tp2-comparaison-tr5']!.choix} attendu={C.ouvertes['tp2-comparaison-tr5']!.attendu} correction={<p>TR5%b : {formatSi(a38.tr5, 's')} à K = 3,8, {formatSi(a40.tr5, 's')} à K = 40.</p>} p={p} />
      </Question>
      <Question q={qu('tp2-comparaison-depassement')}>
        <QuestionOuverte id="tp2-comparaison-depassement" choix={C.ouvertes['tp2-comparaison-depassement']!.choix} attendu={C.ouvertes['tp2-comparaison-depassement']!.attendu} correction={<p>D1/m(∞) : {pourcent(a38.d1rel)} à K = 3,8, {pourcent(a40.d1rel)} à K = 40.</p>} p={p} />
      </Question>

      {!p.examen && (
        <section aria-label="Variantes d’erreur" className="space-y-2 rounded-lg bg-au3-panel p-3 ring-1 ring-au3-warn/40">
          <h3 className="text-sm font-semibold">
            Variantes d’erreur
            <BadgeNonVerifie cles={VARIANTES_CLES} detail="Erreurs de manipulation simulées avec le même modèle, sans mesure réelle (hypothèse H8)" />
          </h3>
          <p className="text-xs text-au3-muted">Elles modifient votre câblage ou vos réglages, comme en salle (platine éteinte). « Faire vérifier » les détecte ; la mise sous tension en montre l’effet.</p>
          <div className="flex flex-wrap gap-2 text-xs">
            {variante('DT inversée (verte ↔ jaune)', () => agir({ type: 'remplacer-cablage', cablage: inverserDt(s.cablage) }))}
            {variante('Ampli de courant oublié (G2 → moteur)', () => agir({ type: 'remplacer-cablage', cablage: oublierAmpli(s.cablage) }))}
            {variante('GBF trop fort à K = 40 (amplitude du K = 3,8 non changée)', () => (agir({ type: 'gbf', patch: { vpp: au3('TP2_K38_GBF_VPP'), attenuation: false } }), agir({ type: 'platine', patch: { g1: au3('TP2_K40_G1'), g2: au3('TP2_K40_G2') } })))}
            {variante('K = 40 sans changer les calibres', () => (agir({ type: 'gbf', patch: { vpp: au3('TP2_K40_GBF_VPP'), attenuation: false } }), agir({ type: 'platine', patch: { g1: au3('TP2_K40_G1'), g2: au3('TP2_K40_G2') } })))}
          </div>
        </section>
      )}
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
                › TP2
              </p>
              <h1 className="text-lg font-semibold">TP2 – Etude, au démarrage et en régime permanent, de la vitesse d’un Moteur à Courant Continu (MCC) bouclé avec un régulateur proportionel</h1>
            </div>
            <button type="button" onClick={() => setOuvert(!ouvert)} aria-expanded={ouvert} aria-controls="tp2-questions" className="ml-auto rounded bg-au3-panel-2 px-2 py-1 text-xs ring-1 ring-au3-line hover:ring-au3-accent">
              {ouvert ? 'Masquer les questions ▸' : '◂ Questions'}
            </button>
          </header>
          {entete}
          <Etabli etat={etat} agir={agir} preset={false} variantes={!p.examen} examen={p.examen} onEnregistrement={onEnregistrement} precablage={PRECABLAGE_TP2} />
        </main>
        {ouvert && (
          <aside id="tp2-questions" aria-label="Questions du TP2" className="w-full shrink-0 border-t border-au3-line bg-au3-bg p-3 lg:sticky lg:top-0 lg:h-screen lg:w-[460px] lg:overflow-y-auto lg:border-t-0 lg:border-l">
            {panneau}
          </aside>
        )}
      </div>
    </div>
  )
}
