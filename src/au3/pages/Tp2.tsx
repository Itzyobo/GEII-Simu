import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { AU3_QUESTIONS, type QuestionAu3 } from '../../data/questions.au3'
import { au3, type RefKey } from '../../data/reference'
import { ampliBloque } from '../banc'
import { GBF_DEFAUT } from '../instruments/gbf'
import { exporterCsv, type Enregistrement } from '../instruments/oscillo'
import { MISE_EN_PAGE } from '../miseEnPage'
import { chargerSession, type ProgressionEssai, type SessionAu3 } from '../session'
import { inverserDt, MONTAGE_TP2, oublierAmpli, PRECABLAGE_TP2 } from '../sim/cablage'
import { gainAffichage } from '../sim/regulateur'
import Abaque from '../tp1/AbaqueInteractif'
import { afficher, commandWindow, fenetreDeCsv, nombre, noteTr5, pourcent, valeurDe } from '../tp1/affichage'
import { attendusTp1 } from '../tp1/attendus'
import { identifier, partNonExpliquee, residus } from '../tp1/identification'
import { ChampNum, Question, QuestionOuverte, type PropsReponse } from '../tp1/Reponses'
import { Superposition } from '../tp1/Superposition'
import { attenduQ12, attendusTp2, ecartTr5b, essaiK38, essaiK40, Q12_NEGLIGEABLE, Q12_NON_NEGLIGEABLE, Q12_SANS_OBJET, theoriqueBf, type AttendusTp2 } from '../tp2/attendus'
import { corrigerFormule } from '../tp2/correction'
import BadgeNonVerifie from '../ui/BadgeNonVerifie'
import Etabli from '../ui/Etabli'
import { formatSi } from '../ui/format'
import { useBanc } from '../ui/useBanc'

const Q = Object.fromEntries(AU3_QUESTIONS.filter((q) => q.tp === 'tp2').map((q) => [q.id, q])) as Record<string, QuestionAu3>
const qu = (id: string): QuestionAu3 => {
  const q = Q[id]
  if (!q) throw new Error(`Question TP2 inconnue : ${id}`)
  return q
}
const TOL_M = au3('TOL_MESURE')
const TOL_A = au3('TOL_ABAQUE')
const K38 = gainAffichage(au3('TP2_K38_G1'), au3('TP2_K38_G2'))
const K40 = gainAffichage(au3('TP2_K40_G1'), au3('TP2_K40_G2'))
const NOTE_TR5_38 = noteTr5(ecartTr5b('k38'), 'dérive lente non modélisée')
const NOTE_TR5_40 = noteTr5(ecartTr5b('k40'), 'm(∞) lu avant stabilisation dans le CR')
const OUI_NON = ['Oui', 'Non'] as const
const ORDRES = ['Ordre 1', 'Ordre 2'] as const
const LES_K = ['K = 3,8', 'K = 40'] as const
const DIFFERENCES = ['Au démarrage', 'En régime permanent'] as const
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

/** Valeurs TP1 de l'étudiant (G0, z, ωn) si elles existent, sinon réponses attendues du TP1 */
function valeursTp1(): { g0: number; z: number; wn: number; source: string } {
  const t = typeof localStorage === 'undefined' ? null : chargerSession(localStorage, 'libre', 'tp1')
  const v = (id: string, u: string) => (t ? valeurDe(t, id, u) : null)
  const att = attendusTp1(t?.gbf ?? GBF_DEFAUT)
  const g0 = v('tp1-i22-q1', '') ?? v('tp1-i21-g0', '')
  const z = v('tp1-i22-q2', '')
  const wn = v('tp1-i22-q3', 'rad/s')
  return g0 !== null && z !== null && wn !== null ? { g0, z, wn, source: 'vos réponses du TP1' } : { g0: att.g0, z: att.z!, wn: att.wn!, source: 'les réponses attendues du TP1 (vos réponses du TP1 sont incomplètes)' }
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
        <button type="button" onClick={exporter} disabled={!rec} className="rounded bg-au3-accent px-2 py-1 font-semibold text-black disabled:opacity-40">
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
          <p className="text-[11px] text-au3-muted">
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
  const { etat, agir } = useBanc('tp2', 'tp2')
  const s = etat.session
  const [ouvert, setOuvert] = useState(true)
  const [rec, setRec] = useState<Enregistrement | null>(null)
  const onEnregistrement = useCallback((r: Enregistrement | null) => setRec(r), [])
  const p: PropsReponse = { session: s, agir, examen: s.mode === 'examen' }
  const v = (id: string, unite: string) => valeurDe(s, id, unite)
  const K = gainAffichage(s.platine.g1, s.platine.g2)
  const carre = s.gbf.forme === 'carre' && s.gbf.sortie
  // Réponses attendues : réglages de l'étudiant quand le K actuel est celui de l'essai, sinon ceux de l'énoncé
  const vppEtudiant = s.gbf.vpp * (s.gbf.attenuation ? au3('GBF_ATTENUATION_FACTEUR') : 1)
  const a38 = useMemo<AttendusTp2>(() => attendusTp2(carre && K === K38 ? essaiK38(vppEtudiant) : essaiK38()), [carre, K, vppEtudiant])
  const a40 = useMemo<AttendusTp2>(() => attendusTp2(carre && K === K40 ? essaiK40(vppEtudiant) : essaiK40()), [carre, K, vppEtudiant])
  const tp1 = useMemo(() => valeursTp1(), [])
  const th = theoriqueBf(K38, tp1.g0, tp1.z, tp1.wn)

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

  // Identifications de l'étudiant
  const f38 = useMemo(() => fenetreDeCsv(s.tp2.k38.csv), [s.tp2.k38.csv])
  const f40 = useMemo(() => fenetreDeCsv(s.tp2.k40.csv), [s.tp2.k40.csv])
  const o38 = s.tp2.k38.ordre2
  const o40 = s.tp2.k40.ordre2
  const q12 = o38 ? attenduQ12(o38.z!, o38.wn!) : null
  const superpose = (f: typeof f38, r: typeof o38) => (f && r ? (partNonExpliquee(f, r) < au3('SUPERPOSITION_MAX') ? 'Oui' : 'Non') : null)
  const res40 = f40 && o40 ? residus(f40, o40) : null

  const ecarts = (lignes: { nom: string; a: number | undefined | null; b: number | null; tol: number }[], noms: [string, string]) => (
    <ul className="space-y-0.5">
      {lignes.map((l) => (
        <li key={l.nom}>
          {l.nom} : {noms[0]} {l.a == null ? '—' : nombre(l.a)}, {noms[1]} {l.b === null ? '—' : nombre(l.b)}
          {l.a != null && l.b !== null && ` (écart ${pourcent(l.a / l.b - 1)}, tolérance ±${Math.round(l.tol * MISE_EN_PAGE.pourcent)} %)`}
        </li>
      ))}
    </ul>
  )
  const memes = (lignes: { a: number | undefined | null; b: number | null; tol: number }[]) => (lignes.some((l) => l.a == null || l.b === null) ? null : lignes.every((l) => Math.abs(l.a! / l.b! - 1) <= l.tol) ? 'Oui' : 'Non')
  const id38 = { g0b: v('tp2-i11-q4', ''), zb: v('tp2-i11-q6', ''), wnb: v('tp2-i11-q7', 'rad/s') }
  const id40 = { g0b: v('tp2-i21-q4', ''), zb: v('tp2-i21-q8', ''), wnb: v('tp2-i21-q10', 'rad/s') }
  const lTh = [
    { nom: 'G0b', a: id38.g0b, b: th.g0b, tol: TOL_M },
    { nom: 'zb', a: id38.zb, b: th.zb, tol: TOL_A },
    { nom: 'ωnb (rad/s)', a: id38.wnb, b: th.wnb, tol: TOL_A },
  ]
  const lFit38 = [
    { nom: 'G0b', a: o38?.g0, b: id38.g0b, tol: TOL_M },
    { nom: 'zb', a: o38?.z, b: id38.zb, tol: TOL_A },
    { nom: 'ωnb (rad/s)', a: o38?.wn, b: id38.wnb, tol: TOL_A },
  ]
  const lFit40 = [
    { nom: 'G0b', a: o40?.g0, b: id40.g0b, tol: TOL_M },
    { nom: 'zb', a: o40?.z, b: id40.zb, tol: TOL_M },
    { nom: 'ωnb (rad/s)', a: o40?.wn, b: id40.wnb, tol: TOL_M },
  ]
  const erreurNonNulle = (a: AttendusTp2) => Math.abs(a.dm / a.c0 - 1) > TOL_M
  const theo40 = theoriqueBf(K40, tp1.g0, tp1.z, tp1.wn).g0b
  const ecartStatique = (a: AttendusTp2) => 1 - a.g0b

  const variante = (nom: string, action: () => void) => (
    <button type="button" disabled={s.platine.sousTension} onClick={action} className="rounded bg-au3-panel-2 px-2 py-1 ring-1 ring-au3-line disabled:opacity-40">
      {nom}
    </button>
  )

  const panneau = (
    <div className="space-y-3 text-sm">
      <h2 className="text-base font-semibold">Questions du TP2</h2>

      <Question q={qu('tp2-reglages')}>
        <ul className="space-y-0.5 text-xs" data-reglages="k38">
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
            const ok = etat.verdict?.correctes.includes(l)
            return (
              <li key={l.nom} className={ok === undefined ? '' : ok ? 'text-au3-ok' : 'text-au3-err'}>
                {ok === undefined ? '' : ok ? '✓ ' : '✗ '}
                {l.nom}
              </li>
            )
          })}
        </ol>
        <ul className="text-xs" data-controles-cablage>
          <Etat ok={!!voie3 && voie3.vdiv === au3('TP2_VOIE3_VDIV')}>Voie 3 au calibre {au3('TP2_VOIE3_VDIV')} V/div (liaison 9)</Etat>
          <li className="text-au3-muted">Liaisons 4 et 6 : câbles noirs (une masse non noire est signalée sur l’établi).</li>
          <li className="text-au3-warn">Pré-câblé (pointillés) : GBF MAIN OUT → voie 1. L’énoncé fait observer la consigne sur la voie 1 mais aucune liaison numérotée ne la câble.</li>
        </ul>
      </Question>

      <Question q={qu('tp2-sous-tension')} badge="Blocage de l’ampli de courant et dissymétrie du GBF : comportements supposés (hypothèses), non mesurés.">
        <ul className="space-y-0.5 text-xs" data-sous-tension>
          <Etat ok={s.verifieSur !== null}>câblage vérifié (« Faire vérifier »)</Etat>
          <Etat ok={s.platine.sousTension}>platine sous tension</Etat>
          <Etat ok={!ampliBloque(s.platine.ampli)}>ampli de courant : {s.platine.ampli === 'normal' ? 'normal' : s.platine.ampli.startsWith('reamorce') ? 'réamorcé, remplacez la masse par la sortie G2 sans éteindre' : 'bloqué'}</Etat>
        </ul>
        <p className="text-xs text-au3-muted">Procédure de l’énoncé si le moteur tourne tout le temps dans le même sens : éteindre, entrée de l’ampli à la masse, rallumer, puis remettre la source sans éteindre. Au TP2, l’entrée de l’ampli est reliée à la sortie G2 (liaison 2) : c’est elle qui remplace la masse (l’énoncé écrit « le signal venant du GBF », repris du TP1).</p>
      </Question>

      <h3 className="pt-2 text-sm font-semibold">I.1 Boucle fermée, K = 3,8</h3>
      <Question q={qu('tp2-i1-ordre')}>
        <QuestionOuverte id="tp2-i1-ordre" choix={ORDRES} attendu={a38.penteRelative < 1 / 2 ? ORDRES[1] : ORDRES[0]} correction={<p>Tangente à l’origine quasi horizontale (pente {nombre(a38.penteRelative)} fois celle d’un 1er ordre de même τ), comme au TP1 : ordre 2, sans dépassement visible.</p>} p={p} />
      </Question>
      <Question q={qu('tp2-i11-q1')}>
        <QuestionOuverte id="tp2-i11-q1" choix={OUI_NON} attendu={erreurNonNulle(a38) ? 'Non' : 'Oui'} correction={<p>m(∞) = {afficher(a38.dm, 'V')} pour C0 = {afficher(a38.c0, 'V')} : erreur statique de {pourcent(a38.dm / a38.c0 - 1)}. Un régulateur proportionnel ne l’annule pas.</p>} p={p} />
      </Question>
      <Question q={qu('tp2-i11-q2')}>
        <ChampNum id="tp2-i11-q2" label="m(∞) = ΔY" unite="V" attendu={a38.dm} tolerance={TOL_M} p={p} />
      </Question>
      <Question q={qu('tp2-i11-q3')}>
        <ChampNum id="tp2-i11-q3" label="C0 = ΔY" unite="V" attendu={a38.c0} tolerance={TOL_M} p={p} />
      </Question>
      <Question q={qu('tp2-i11-q4')}>
        <ChampNum id="tp2-i11-q4" label="G0b = m(∞)/C0" unite="" attendu={a38.g0b} tolerance={TOL_M} p={p} />
      </Question>
      <Question q={qu('tp2-i11-q5')} />
      <Question q={qu('tp2-i11-q6')}>
        <ChampNum id="tp2-i11-q6#t1" label="t1 (26,4 %)" unite="s" attendu={a38.t1} tolerance={TOL_M} p={p} />
        <ChampNum id="tp2-i11-q6#t3" label="t3 (80,1 %)" unite="s" attendu={a38.t3} tolerance={TOL_M} p={p} />
        <ChampNum id="tp2-i11-q6#rapport" label="t3/t1" unite="" attendu={a38.rapport} tolerance={TOL_M} p={p} />
        <Abaque tp1={s.tp2.k38} onChange={(patch: Partial<ProgressionEssai>) => agir({ type: 'tp2', essai: 'k38', patch })} />
        <ChampNum id="tp2-i11-q6" label="zb (abaque)" unite="" attendu={a38.zbAbaque} tolerance={TOL_A} p={p} />
      </Question>
      <Question q={qu('tp2-i11-q7')}>
        <ChampNum id="tp2-i11-q7#wnt3" label="ωnb·t3 (abaque)" unite="" attendu={a38.wnT3} tolerance={TOL_A} p={p} />
        <ChampNum id="tp2-i11-q7" label="ωnb = (ωnb·t3)/t3" unite="rad/s" attendu={a38.wnbAbaque} tolerance={TOL_A} p={p} />
      </Question>
      <Question q={qu('tp2-i11-gb2')}>
        <p className="font-mono text-xs">Gb2(p) = G0b / (1 + 2zb·p/ωnb + p²/ωnb²)</p>
        <ChampNum id="tp2-i11-gb2#g0b" label="G0b dans Gb2(p)" unite="" attendu={a38.g0b} tolerance={TOL_M} p={p} />
        <ChampNum id="tp2-i11-gb2#zb" label="zb dans Gb2(p)" unite="" attendu={a38.zbAbaque} tolerance={TOL_A} p={p} />
        <ChampNum id="tp2-i11-gb2#wnb" label="ωnb dans Gb2(p)" unite="rad/s" attendu={a38.wnbAbaque} tolerance={TOL_A} p={p} />
        {!!s.reponses['tp2-i11-gb2#g0b'] && !p.examen && (
          <ul className="text-xs" data-coherence="gb2">
            <Coherence libelle="G0b" a={v('tp2-i11-gb2#g0b', '')} b={id38.g0b} tol={TOL_M} />
            <Coherence libelle="zb" a={v('tp2-i11-gb2#zb', '')} b={id38.zb} tol={TOL_M} />
            <Coherence libelle="ωnb" a={v('tp2-i11-gb2#wnb', 'rad/s')} b={id38.wnb} tol={TOL_M} />
          </ul>
        )}
      </Question>
      <Question q={qu('tp2-i11-q8')}>
        <p className="text-xs text-au3-muted" data-source-tp1>
          Calculées avec {tp1.source} : G0 = {nombre(tp1.g0)}, z = {nombre(tp1.z)}, ωn = {nombre(tp1.wn)} rad/s ; K = {nombre(K38)}.
        </p>
        <ChampNum id="tp2-i11-q8#g0b" label="G0b théorique" unite="" attendu={th.g0b} tolerance={TOL_M} p={p} />
        <ChampNum id="tp2-i11-q8#zb" label="zb théorique" unite="" attendu={th.zb} tolerance={TOL_M} p={p} />
        <ChampNum id="tp2-i11-q8#wnb" label="ωnb théorique" unite="rad/s" attendu={th.wnb} tolerance={TOL_M} p={p} />
      </Question>
      <Question q={qu('tp2-i11-q9')}>
        <QuestionOuverte
          id="tp2-i11-q9"
          choix={['Mêmes valeurs', 'Valeurs différentes']}
          attendu={memes(lTh) === null ? null : memes(lTh) === 'Oui' ? 'Mêmes valeurs' : 'Valeurs différentes'}
          correction={
            <>
              {ecarts(lTh, ['identifié', 'théorique'])}
              <p>Cause principale : le frottement sec. Le gain apparent du moteur baisse quand l’amplitude de la commande diminue (G0 apparent = G0r·(ΔU − 2Uf)/ΔU), et la commande est plus petite en boucle fermée qu’au TP1 : G0b identifié plus faible que la théorie linéaire.</p>
            </>
          }
          p={p}
        />
      </Question>
      <Question q={qu('tp2-i11-q10')} badge={NOTE_TR5_38}>
        <ChampNum id="tp2-i11-q10#seuil" label="0,95·m(∞)" unite="V" attendu={au3('NIVEAU_TR5') * a38.dm} tolerance={TOL_M} p={p} />
        <ChampNum id="tp2-i11-q10" label="TR5%b" unite="s" attendu={a38.tr5} tolerance={TOL_M} p={p} />
      </Question>

      <h3 className="pt-2 text-sm font-semibold">I.1.2 Identification par un modèle d’ordre 2 avec K = 3,8 : Optimisation avec Matlab®</h3>
      <Identification s={s} essai="k38" fichier="Signaux_2.csv" rec={rec} agir={agir} />
      <Question q={qu('tp2-i12-q9')}>
        <QuestionOuverte id="tp2-i12-q9" choix={OUI_NON} attendu={memes(lFit38)} correction={o38 ? ecarts(lFit38, ['moindres carrés', 'vous']) : <p>Lancez d’abord l’identification.</p>} p={p} />
      </Question>
      <Question q={qu('tp2-i12-q10')}>
        <QuestionOuverte id="tp2-i12-q10" choix={OUI_NON} attendu={superpose(f38, o38)} correction={f38 && o38 ? <p>Part de la mesure non expliquée par le modèle : {pourcent(partNonExpliquee(f38, o38))} : les courbes sont superposées.</p> : <p>Lancez d’abord l’identification.</p>} p={p} />
      </Question>
      <Question q={qu('tp2-i12-q11')}>
        <QuestionOuverte id="tp2-i12-q11" choix={OUI_NON} attendu={superpose(f38, o38)} correction={<p>Oui : le 2e ordre suit le démarrage (tangente horizontale) et la valeur finale ; seule la dérive lente du moteur réel, non modélisée ici, peut s’écarter en fin de palier.</p>} p={p} />
      </Question>
      <Question q={qu('tp2-i12-q12')}>
        {q12 && q12.choix !== Q12_SANS_OBJET && (
          <>
            <ChampNum id="tp2-i12-q12#tau1" label="τ1 (plus petite)" unite="s" attendu={q12.tau1} tolerance={TOL_M} p={p} />
            <ChampNum id="tp2-i12-q12#tau2" label="τ2 (plus grande)" unite="s" attendu={q12.tau2} tolerance={TOL_M} p={p} />
          </>
        )}
        <QuestionOuverte
          id="tp2-i12-q12"
          choix={[Q12_SANS_OBJET, Q12_NEGLIGEABLE, Q12_NON_NEGLIGEABLE]}
          attendu={q12?.choix ?? null}
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
        <ul className="space-y-0.5 text-xs" data-reglages="k40">
          {reglages40.map((r) => (
            <Etat key={r.texte} ok={r.ok}>
              {r.texte}
            </Etat>
          ))}
        </ul>
        <p className="text-xs text-au3-muted">Remarque de l’énoncé : le signal de sortie peut « sembler » ne pas s’afficher. Dézoomez temporellement pour voir une période entière, et adaptez les calibres (0,3 V sur des calibres prévus pour 3,2 V occupe peu de place à l’écran).</p>
      </Question>
      <Question q={qu('tp2-i2-ordre')}>
        <QuestionOuverte id="tp2-i2-ordre" choix={ORDRES} attendu={a40.d1rel > 0 ? ORDRES[1] : ORDRES[0]} correction={<p>Dépassement D1/m(∞) = {pourcent(a40.d1rel)} et oscillations amorties : ordre 2 avec zb &lt; 1 (un 1er ordre ne dépasse jamais sa valeur finale).</p>} p={p} />
      </Question>
      <Question q={qu('tp2-i21-q1')}>
        <QuestionOuverte id="tp2-i21-q1" choix={OUI_NON} attendu={erreurNonNulle(a40) ? 'Non' : 'Oui'} correction={<p>m(∞) = {afficher(a40.dm, 'V')} pour C0 = {afficher(a40.c0, 'V')} : erreur statique de {pourcent(a40.dm / a40.c0 - 1)}, plus faible qu’à K = 3,8 mais non nulle.</p>} p={p} />
      </Question>
      <Question q={qu('tp2-i21-q2')}>
        <ChampNum id="tp2-i21-q2" label="C0 = ΔY" unite="V" attendu={a40.c0} tolerance={TOL_M} p={p} />
      </Question>
      <Question q={qu('tp2-i21-q3')}>
        <ChampNum id="tp2-i21-q3" label="m(∞) = ΔY" unite="V" attendu={a40.dm} tolerance={TOL_M} p={p} />
      </Question>
      <Question q={qu('tp2-i21-q4')}>
        <ChampNum id="tp2-i21-q4" label="G0b = m(∞)/C0" unite="" attendu={a40.g0b} tolerance={TOL_M} p={p} />
      </Question>
      <Question q={qu('tp2-i21-q5')}>
        <QuestionOuverte
          id="tp2-i21-q5"
          choix={OUI_NON}
          attendu={Math.abs(a40.g0b / a38.g0b - 1) > TOL_M ? 'Non' : 'Oui'}
          correction={
            <p>
              Non : G0b = {nombre(a40.g0b)} contre {nombre(a38.g0b)} à K = 3,8, plus grand, car G0b = KG0/(1+KG0) tend vers 1 quand K augmente. La théorie linéaire donne {nombre(theo40)} : l’écart ({pourcent(a40.g0b / theo40 - 1)}) vient du frottement sec, qui réduit le gain apparent en petite amplitude.
            </p>
          }
          p={p}
        />
      </Question>
      <Question q={qu('tp2-i21-q6')}>
        <ChampNum id="tp2-i21-q6" label="D1 = ΔY" unite="V" attendu={a40.d1} tolerance={TOL_M} p={p} />
      </Question>
      <Question q={qu('tp2-i21-q7')}>
        <ChampNum id="tp2-i21-q7" label="D1/m(∞)" unite="" attendu={a40.d1rel} tolerance={TOL_M} p={p} />
      </Question>
      <Question q={qu('tp2-i21-q8')}>
        <p className="font-mono text-xs">zb = −ln(D1/m∞) / √(π² + ln²(D1/m∞))</p>
        <ChampNum id="tp2-i21-q8" label="zb (formule)" unite="" attendu={a40.zbFormule} tolerance={TOL_A} p={p} corrigeur={corrigerFormule} />
      </Question>
      <Question q={qu('tp2-i21-q9')}>
        <ChampNum id="tp2-i21-q9" label="Tpb/2" unite="s" attendu={a40.tpb2} tolerance={TOL_M} p={p} />
      </Question>
      <Question q={qu('tp2-i21-q10')}>
        <p className="font-mono text-xs">ωnb = 2π / (Tpb·√(1 − zb²))</p>
        <ChampNum id="tp2-i21-q10" label="ωnb (formule)" unite="rad/s" attendu={a40.wnbFormule} tolerance={TOL_M} p={p} />
      </Question>
      <Question q={qu('tp2-i21-q12')} badge={NOTE_TR5_40}>
        <ChampNum id="tp2-i21-q12#bas" label="0,95·m(∞)" unite="V" attendu={au3('NIVEAU_TR5') * a40.dm} tolerance={TOL_M} p={p} />
        <ChampNum id="tp2-i21-q12#haut" label="1,05·m(∞)" unite="V" attendu={(2 - au3('NIVEAU_TR5')) * a40.dm} tolerance={TOL_M} p={p} />
        <ChampNum id="tp2-i21-q12" label="TR5%b" unite="s" attendu={a40.tr5} tolerance={TOL_M} p={p} />
        <QuestionOuverte id="tp2-i21-q12#meme" choix={['Le même', 'Différent']} attendu={Math.abs(a40.tr5 / a38.tr5 - 1) > TOL_M ? 'Différent' : 'Le même'} correction={<p>TR5%b = {formatSi(a40.tr5, 's')} à K = 40 contre {formatSi(a38.tr5, 's')} à K = 3,8 : plus rapide car ωnb augmente avec K (ωnb = ωn√(1+KG0)), malgré les oscillations (zb plus petit).</p>} p={p} />
      </Question>

      <h3 className="pt-2 text-sm font-semibold">I.2.2 Identification par un modèle d’ordre 2 avec K = 40 : Optimisation avec Matlab®</h3>
      <Identification s={s} essai="k40" fichier="Signaux_2_40.csv" rec={rec} agir={agir} />
      <Question q={qu('tp2-i22-q9')}>
        <QuestionOuverte id="tp2-i22-q9" choix={OUI_NON} attendu={memes(lFit40)} correction={o40 ? ecarts(lFit40, ['moindres carrés', 'vous']) : <p>Lancez d’abord l’identification.</p>} p={p} />
      </Question>
      <Question q={qu('tp2-i22-q10')}>
        <QuestionOuverte
          id="tp2-i22-q10"
          choix={DIFFERENCES}
          attendu={res40 ? (res40.demarrage > res40.permanent ? DIFFERENCES[0] : DIFFERENCES[1]) : null}
          correction={res40 ? <p>Écart quadratique moyen modèle − mesure : {afficher(res40.demarrage, 'V')} au démarrage, {afficher(res40.permanent, 'V')} en régime permanent.</p> : <p>Lancez d’abord l’identification.</p>}
          p={p}
        />
      </Question>
      <Question q={qu('tp2-i22-q11')}>
        <QuestionOuverte
          id="tp2-i22-q11"
          choix={OUI_NON}
          attendu={superpose(f40, o40)}
          correction={<p>Le 2e ordre suit le dépassement et les oscillations. Phénomène négligé : le frottement sec (non linéaire), qui fait dépendre le gain apparent de l’amplitude ; le modèle linéaire identifié n’est valable que pour cette amplitude de consigne. La saturation de U (±10,6 V) n’est pas atteinte ici.</p>}
          p={p}
        />
      </Question>
      <Question q={qu('tp2-i22-q12')}>
        <p className="text-xs text-au3-muted">Optionnelle, non notée.</p>
      </Question>

      <h3 className="pt-2 text-sm font-semibold">Conclusions du TP2 à retenir</h3>
      <Question q={qu('tp2-conclusion-1')}>
        <QuestionOuverte id="tp2-conclusion-1" choix={OUI_NON} attendu={erreurNonNulle(a38) && erreurNonNulle(a40) ? 'Non' : 'Oui'} correction={<p>Non : l’erreur statique n’est jamais nulle avec un régulateur proportionnel (pas d’intégrateur dans la boucle) : {pourcent(-ecartStatique(a38))} à K = 3,8, {pourcent(-ecartStatique(a40))} à K = 40.</p>} p={p} />
      </Question>
      <Question q={qu('tp2-conclusion-2')}>
        <QuestionOuverte id="tp2-conclusion-2" choix={OUI_NON} attendu={erreurNonNulle(a38) && erreurNonNulle(a40) ? 'Non' : 'Oui'} correction={<p>Non : quel que soit K, l’erreur reste non nulle ; seule sa valeur ε∞/C0 = 1/(1+KG0) diminue quand K augmente.</p>} p={p} />
      </Question>
      <p className="text-xs text-au3-muted">Pour laquelle des 2 valeurs de K, 3,8 ou 40 :</p>
      <Question q={qu('tp2-comparaison-ecart')}>
        <QuestionOuverte id="tp2-comparaison-ecart" choix={LES_K} attendu={ecartStatique(a40) < ecartStatique(a38) ? LES_K[1] : LES_K[0]} correction={<p>Écart statique relatif : {pourcent(ecartStatique(a38))} à K = 3,8, {pourcent(ecartStatique(a40))} à K = 40.</p>} p={p} />
      </Question>
      <Question q={qu('tp2-comparaison-tr5')} badge={`${NOTE_TR5_38} ; ${NOTE_TR5_40}`}>
        <QuestionOuverte id="tp2-comparaison-tr5" choix={LES_K} attendu={a40.tr5 < a38.tr5 ? LES_K[1] : LES_K[0]} correction={<p>TR5%b : {formatSi(a38.tr5, 's')} à K = 3,8, {formatSi(a40.tr5, 's')} à K = 40.</p>} p={p} />
      </Question>
      <Question q={qu('tp2-comparaison-depassement')}>
        <QuestionOuverte id="tp2-comparaison-depassement" choix={LES_K} attendu={a40.d1rel > a38.d1rel ? LES_K[1] : LES_K[0]} correction={<p>D1/m(∞) : {pourcent(a38.d1rel)} à K = 3,8, {pourcent(a40.d1rel)} à K = 40.</p>} p={p} />
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
          <Etabli etat={etat} agir={agir} preset={false} variantes onEnregistrement={onEnregistrement} precablage={PRECABLAGE_TP2} />
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
