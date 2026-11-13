import { useCallback, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { AU3_QUESTIONS, type QuestionAu3 } from '../../data/questions.au3'
import { au3 } from '../../data/reference'
import { ampliBloque } from '../banc'
import { exporterCsv, type Enregistrement } from '../instruments/oscillo'
import { MISE_EN_PAGE } from '../miseEnPage'
import { MONTAGE_TP1 } from '../sim/cablage'
import Abaque from '../tp1/AbaqueInteractif'
import { catalogueTp1, contexteTp1 } from '../examen/catalogue'
import { commandWindow, lecturesAffichees, nombre, noteTr5, pourcent, valeurDe } from '../tp1/affichage'
import { ecartTr5 } from '../tp1/attendus'
import { identifier } from '../tp1/identification'
import { Superposition, ValeursMatlabCr } from '../tp1/Superposition'
import { ChampNum, Question, QuestionOuverte, type PropsReponse } from '../tp1/Reponses'
import Etabli from '../ui/Etabli'
import type { PropsPage } from '../ui/types'
import { useBanc } from '../ui/useBanc'

const Q = Object.fromEntries(AU3_QUESTIONS.filter((q) => q.tp === 'tp1').map((q) => [q.id, q])) as Record<string, QuestionAu3>
const qu = (id: string): QuestionAu3 => {
  const q = Q[id]
  if (!q) throw new Error(`Question TP1 inconnue : ${id}`)
  return q
}
const TOL_M = au3('TOL_MESURE')
const NOTE_TR5 = noteTr5(ecartTr5())

/** Cohérence d'un champ de G1(p)/G2(p) avec la réponse de l'étudiant à la question correspondante */
function Coherence({ libelle, a, b, tol }: { libelle: string; a: number | null; b: number | null; tol: number }) {
  if (a === null || b === null) return <li className="text-au3-muted">{libelle} : réponse manquante, cohérence non vérifiée</li>
  const ok = Math.abs(a / b - 1) <= tol
  return (
    <li className={ok ? 'text-au3-ok' : 'text-au3-err'}>
      {ok ? '✓' : '✗'} {libelle} : {nombre(a)} dans la fonction de transfert, {nombre(b)} dans votre réponse
    </li>
  )
}

const Etat = ({ ok, children }: { ok: boolean; children: ReactNode }) => <li className={ok ? 'text-au3-ok' : 'text-au3-muted'}>{ok ? '✓' : '○'} {children}</li>

/** TP1 : MCC + dynamo tachymétrique en boucle ouverte. Établi à gauche, questions dans un panneau rétractable à droite. */
export default function Tp1() {
  const b = useBanc('tp1')
  return <PageTp1 {...b} />
}

/** TP1 piloté par un banc : entraînement (/au3/tp1) ou examen (aucun indice, aucune correction) */
export function PageTp1({ etat, agir, entete }: PropsPage) {
  const s = etat.session
  const [ouvert, setOuvert] = useState(true)
  const [rec, setRec] = useState<Enregistrement | null>(null)
  const onEnregistrement = useCallback((r: Enregistrement | null) => setRec(r), [])
  const p: PropsReponse = { session: s, agir, examen: s.mode === 'examen' }
  const v = (id: string, unite: string) => valeurDe(s, id, unite)
  const ctx = contexteTp1(s)
  const C = catalogueTp1(ctx)
  const { fen, o1, o2, pente1, penteMes, l12, lo2, meilleurOrdre } = ctx
  const lireTr5 = () => lecturesAffichees(rec)
  const repondu = (id: string) => !!s.reponses[id]
  const tangentes = repondu('tp1-i23-q11') || repondu('tp1-i23-o2-q1') || repondu('tp1-conclusion')

  // Réglages du GBF demandés par l'énoncé (pas des boutons du GBF : « la plus près possible »)
  const G = MISE_EN_PAGE.gbf
  const reglages = [
    { ok: s.gbf.forme === 'carre', texte: 'forme périodique carrée' },
    { ok: Math.abs(s.gbf.frequence - au3('TP1_GBF_FREQ')) <= G.pasFreq / 2, texte: `fréquence la plus près possible de ${nombre(au3('TP1_GBF_FREQ'))} Hz (actuelle : ${nombre(s.gbf.frequence)} Hz)` },
    { ok: Math.abs(s.gbf.vpp - au3('TP1_GBF_VPP')) <= G.pasVpp / 2 && !s.gbf.attenuation, texte: `Vpp ≈ ${nombre(au3('TP1_GBF_VPP'))} V, sans atténuation (actuel : ${nombre(s.gbf.vpp)} Vpp${s.gbf.attenuation ? ', −20 dB' : ''})` },
    { ok: Math.abs(s.gbf.offset) < G.pasOffset / 2, texte: 'sans offset' },
    { ok: !s.platine.sousTension, texte: 'platine éteinte' },
  ]

  const exporter = () => {
    if (!rec) return
    const csv = exporterCsv(rec)
    agir({ type: 'tp1', patch: { csv, ordre1: null, ordre2: null } })
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'Signaux_1.csv'
    a.click()
    URL.revokeObjectURL(url)
  }
  const identifierOrdre = (ordre: 1 | 2) => fen && agir({ type: 'tp1', patch: ordre === 1 ? { ordre1: identifier(fen, 1) } : { ordre2: identifier(fen, 2) } })

  const pentes = pente1 !== null && penteMes !== null && (
    <p>
      Tangente à l’origine : modèle d’ordre 1, pente G0·ΔU/τ = {nombre(pente1)} V/s (non nulle) ; mesure, {nombre(penteMes)} V/s sur les premiers {Math.round(au3('TANGENTE_FENETRE') * MISE_EN_PAGE.pourcent)} % de τ (quasi horizontale) ; modèle d’ordre 2, pente nulle (horizontale). Voir les tangentes en pointillés sur le zoom.
    </p>
  )
  const ecarts = (lignes: readonly { nom: string; a: number | null | undefined; b: number | null; tol: number }[]) => (
    <ul className="space-y-0.5">
      {lignes.map((l) => (
        <li key={l.nom}>
          {l.nom} : moindres carrés {l.a == null ? '—' : nombre(l.a)}, vous {l.b === null ? '—' : nombre(l.b)}
          {l.a != null && l.b !== null && ` (écart ${pourcent(l.a / l.b - 1)}, tolérance ±${Math.round(l.tol * MISE_EN_PAGE.pourcent)} %)`}
        </li>
      ))}
    </ul>
  )
  // ωn calculé en divisant la lecture par t1 au lieu de t3 : écart de méthode signalé
  const wnLu = v('tp1-i22-q3', 'rad/s')
  const t1 = v('tp1-i22-q2#t1', 's')
  const t3 = v('tp1-i22-q2#t3', 's')
  const lecture = s.tp1.croixWnT?.y ?? null
  const parT1 = wnLu !== null && lecture !== null && t1 !== null && t3 !== null && Math.abs(wnLu - lecture / t1) < Math.abs(wnLu - lecture / t3)

  const panneau = (
    <div className="space-y-3 text-sm">
      <h2 className="text-base font-semibold">Questions du TP1</h2>

      <Question q={qu('tp1-numeros')}>
        <ChampNum champ={C.champs['tp1-numeros#moteur']} label="N° du moteur" p={p} />
        <ChampNum champ={C.champs['tp1-numeros#poste']} label="N° de la platine (poste)" p={p} />
      </Question>

      <Question q={qu('tp1-reglages')} badge={p.examen ? undefined : 'Platine éteinte, le carré observé à l’oscilloscope est dissymétrique (palier bas réduit, hypothèse) : c’est ce que décrit l’énoncé, il redevient correct à la mise sous tension.'}>
        <ul className="space-y-0.5 text-xs" data-reglages hidden={p.examen}>
          {reglages.map((r) => (
            <Etat key={r.texte} ok={r.ok}>
              {r.texte}
            </Etat>
          ))}
        </ul>
      </Question>

      <Question q={qu('tp1-cablage')}>
        <ol className="space-y-0.5 text-xs">
          {MONTAGE_TP1.map((l) => {
            const ok = p.examen ? undefined : etat.verdict?.correctes.includes(l)
            return (
              <li key={l.nom} className={ok === undefined ? '' : ok ? 'text-au3-ok' : 'text-au3-err'}>
                {ok === undefined ? '' : ok ? '✓ ' : '✗ '}
                {l.nom}
              </li>
            )
          })}
        </ol>
        <p className="text-xs text-au3-muted">Câblez sur l’établi (borne, puis borne), puis « Faire vérifier » avant la mise sous tension.</p>
      </Question>

      <Question q={qu('tp1-sous-tension')} badge={p.examen ? undefined : 'Blocage de l’ampli de courant et dissymétrie du GBF : comportements supposés (hypothèses), non mesurés.'}>
        <ul className="space-y-0.5 text-xs" data-sous-tension hidden={p.examen}>
          <Etat ok={s.verifieSur !== null}>câblage vérifié (« Faire vérifier »)</Etat>
          <Etat ok={s.platine.sousTension}>platine sous tension</Etat>
          <Etat ok={!ampliBloque(s.platine.ampli)}>ampli de courant : {s.platine.ampli === 'normal' ? 'normal' : s.platine.ampli.startsWith('reamorce') ? 'réamorcé, remplacez la masse par le GBF sans éteindre' : 'bloqué'}</Etat>
        </ul>
        <p className="text-xs text-au3-muted" hidden={p.examen}>
          Si le moteur tourne tout le temps dans le même sens ou ne tourne pas du tout : éteindre la platine, relier l’entrée de l’ampli de courant à la masse, rallumer, puis remplacer la masse par le GBF sans éteindre (cliquer le câble, « Déplacer l’extrémité Masse », puis GBF MAIN OUT). C’est la seule manipulation acceptée sous tension.
        </p>
      </Question>

      <h3 className="pt-2 text-sm font-semibold">I.2.1 Identification par un modèle d’ordre 1</h3>
      <Question q={qu('tp1-i21-q1')}>
        <ChampNum champ={C.champs['tp1-i21-q1']} label="m(∞) = ΔY" p={p} />
      </Question>
      <Question q={qu('tp1-i21-q2')}>
        <ChampNum champ={C.champs['tp1-i21-q2']} label="U0 = ΔY" p={p} />
      </Question>
      <Question q={qu('tp1-i21-g0')}>
        <ChampNum champ={C.champs['tp1-i21-g0']} label="G0 = m(∞)/U0" p={p} />
      </Question>
      <Question q={qu('tp1-i21-q3')}>
        <ChampNum champ={C.champs['tp1-i21-q3']} label="τ = ΔX" p={p} />
      </Question>
      <Question q={qu('tp1-i21-g1')}>
        <p className="font-mono text-xs">G1(p) = G0 / (1 + τ·p)</p>
        <ChampNum champ={C.champs['tp1-i21-g1#g0']} label="G0 dans G1(p)" p={p} />
        <ChampNum champ={C.champs['tp1-i21-g1#tau']} label="τ dans G1(p)" p={p} />
        {(repondu('tp1-i21-g1#g0') || repondu('tp1-i21-g1#tau')) && !p.examen && (
          <ul className="text-xs" data-coherence="g1">
            <Coherence libelle="G0" a={v('tp1-i21-g1#g0', '')} b={v('tp1-i21-g0', '')} tol={TOL_M} />
            <Coherence libelle="τ" a={v('tp1-i21-g1#tau', 's')} b={v('tp1-i21-q3', 's')} tol={TOL_M} />
          </ul>
        )}
      </Question>
      <Question q={qu('tp1-i21-q4')} badge={p.examen ? undefined : NOTE_TR5}>
        <ChampNum champ={C.champs['tp1-i21-q4#seuil']} label="0,95·m(∞)" p={p} />
        <ChampNum champ={C.champs['tp1-i21-q4']} label="TR5% = ΔX" p={p} lire={lireTr5} />
      </Question>

      <h3 className="pt-2 text-sm font-semibold">I.2.2 Identification par un modèle d’ordre 2</h3>
      <Question q={qu('tp1-i22-q1')}>
        <ChampNum champ={C.champs['tp1-i22-q1']} label="G0" p={p} />
      </Question>
      <Question q={qu('tp1-i22-q2')}>
        <ChampNum champ={C.champs['tp1-i22-q2#t1']} label="t1 (26,4 %)" p={p} />
        <ChampNum champ={C.champs['tp1-i22-q2#t3']} label="t3 (80,1 %)" p={p} />
        <ChampNum champ={C.champs['tp1-i22-q2#rapport']} label="t3/t1" p={p} />
        <Abaque tp1={s.tp1} examen={p.examen} onChange={(patch) => agir({ type: 'tp1', patch })} />
        <ChampNum champ={C.champs['tp1-i22-q2']} label="z (abaque)" p={p} />
      </Question>
      <Question q={qu('tp1-i22-q3')}>
        <ChampNum champ={C.champs['tp1-i22-q3#wnt3']} label="ωn·t3 (abaque)" p={p} />
        <ChampNum champ={C.champs['tp1-i22-q3']} label="ωn = (ωn·t3)/t3" p={p} />
        {parT1 && !p.examen && (
          <p className="text-xs text-au3-warn" role="status">
            Écart de méthode : votre ωn correspond à la lecture divisée par t1. L’énoncé impose ωn = (ωn·t3)/t3.
          </p>
        )}
      </Question>
      <Question q={qu('tp1-i22-g2')}>
        <p className="font-mono text-xs">G2(p) = G0 / (1 + (2z/ωn)·p + p²/ωn²)</p>
        <ChampNum champ={C.champs['tp1-i22-g2#g0']} label="G0 dans G2(p)" p={p} />
        <ChampNum champ={C.champs['tp1-i22-g2#z']} label="z dans G2(p)" p={p} />
        <ChampNum champ={C.champs['tp1-i22-g2#wn']} label="ωn dans G2(p)" p={p} />
        {(repondu('tp1-i22-g2#g0') || repondu('tp1-i22-g2#z') || repondu('tp1-i22-g2#wn')) && !p.examen && (
          <ul className="text-xs" data-coherence="g2">
            <Coherence libelle="G0" a={v('tp1-i22-g2#g0', '')} b={v('tp1-i22-q1', '')} tol={TOL_M} />
            <Coherence libelle="z" a={v('tp1-i22-g2#z', '')} b={v('tp1-i22-q2', '')} tol={TOL_M} />
            <Coherence libelle="ωn" a={v('tp1-i22-g2#wn', 'rad/s')} b={v('tp1-i22-q3', 'rad/s')} tol={TOL_M} />
          </ul>
        )}
      </Question>
      <Question q={qu('tp1-i22-q4')} badge={p.examen ? undefined : NOTE_TR5}>
        <ChampNum champ={C.champs['tp1-i22-q4']} label="TR5%" p={p} lire={lireTr5} />
      </Question>

      <section aria-labelledby="tp1-i23" className="space-y-2 rounded-lg bg-au3-panel p-3 ring-1 ring-au3-line">
        <h3 id="tp1-i23" className="text-sm font-semibold">
          I.2.3 Identification par un modèle d’ordre 1 ou 2 : Optimisation avec Matlab®
        </h3>
        <p className="text-xs text-au3-muted">Étapes 1 à 10 (copie des scripts, import du .csv dans Matlab) remplacées par : « Exporter .csv », puis « Identification moindres carrés ».</p>
        <div className="flex flex-wrap gap-2 text-xs">
          <button type="button" onClick={exporter} disabled={!rec} className="rounded bg-au3-accent px-2 py-1 font-semibold text-on-accent disabled:opacity-40">
            Exporter .csv (Signaux_1.csv)
          </button>
          <button type="button" onClick={() => identifierOrdre(1)} disabled={!fen} className="rounded bg-au3-panel-2 px-2 py-1 ring-1 ring-au3-line disabled:opacity-40">
            Identification moindres carrés : ordre 1
          </button>
          <button type="button" onClick={() => identifierOrdre(2)} disabled={!fen} className="rounded bg-au3-panel-2 px-2 py-1 ring-1 ring-au3-line disabled:opacity-40">
            Identification moindres carrés : ordre 2
          </button>
        </div>
        {s.tp1.csv && !fen && <p className="text-xs text-au3-err">Le .csv ne contient pas un échelon positif sur les voies 1 et 2 : vérifiez le déclenchement et les voies actives, puis exportez de nouveau.</p>}
        {fen &&
          [o1, o2].map(
            (r) =>
              r && (
                <div key={r.ordre} className="space-y-1">
                  <pre className="overflow-x-auto rounded bg-black p-2 font-mono text-[11px] text-[#d4d4d4]" aria-label={`Command Window, ordre ${r.ordre}`} data-command-window={r.ordre}>
                    {commandWindow(fen, r)}
                  </pre>
                  {!p.examen && <ValeursMatlabCr ordre={r.ordre} />}
                  <Superposition f={fen} r={r} tangentes={tangentes} />
                </div>
              ),
          )}
      </section>

      <Question q={qu('tp1-i23-q11')}>
        <QuestionOuverte
          id="tp1-i23-q11"
          choix={C.ouvertes['tp1-i23-q11']!.choix}
          attendu={C.ouvertes['tp1-i23-q11']!.attendu}
          correction={o1 ? <>{pentes}<p>Le 1er ordre retrouve la valeur finale (stabilisation) mais démarre avec une pente non nulle : il ne représente pas le démarrage.</p></> : <p>Lancez d’abord l’identification d’ordre 1 pour voir la correction.</p>}
          p={p}
        />
      </Question>
      <Question q={qu('tp1-i23-q12')}>
        <QuestionOuverte id="tp1-i23-q12" choix={C.ouvertes['tp1-i23-q12']!.choix} attendu={C.ouvertes['tp1-i23-q12']!.attendu} correction={o1 ? ecarts(l12) : <p>Lancez d’abord l’identification d’ordre 1.</p>} p={p} />
      </Question>
      <Question q={qu('tp1-i23-o2-q1')}>
        <QuestionOuverte
          id="tp1-i23-o2-q1"
          choix={C.ouvertes['tp1-i23-o2-q1']!.choix}
          attendu={C.ouvertes['tp1-i23-o2-q1']!.attendu}
          correction={o2 ? <>{pentes}<p>Le 2e ordre démarre avec une tangente horizontale, comme la mesure, et rejoint la même valeur finale{o1 ? ` (critère ${nombre(o2.critere)} V² contre ${nombre(o1.critere)} V² à l’ordre 1)` : ''}.</p></> : <p>Lancez d’abord l’identification d’ordre 2.</p>}
          p={p}
        />
      </Question>
      <Question q={qu('tp1-i23-o2-q2')}>
        <QuestionOuverte id="tp1-i23-o2-q2" choix={C.ouvertes['tp1-i23-o2-q2']!.choix} attendu={C.ouvertes['tp1-i23-o2-q2']!.attendu} correction={o2 ? ecarts(lo2) : <p>Lancez d’abord l’identification d’ordre 2.</p>} p={p} />
      </Question>
      <Question q={qu('tp1-conclusion')}>
        <QuestionOuverte
          id="tp1-conclusion"
          choix={C.ouvertes['tp1-conclusion']!.choix}
          attendu={C.ouvertes['tp1-conclusion']!.attendu}
          correction={o1 && o2 ? <>{pentes}<p>Critère des moindres carrés : ordre 1 = {nombre(o1.critere)} V², ordre 2 = {nombre(o2.critere)} V². L’ordre le plus probable est celui qui suit aussi le démarrage : {meilleurOrdre}.</p></> : <p>Lancez les identifications d’ordre 1 et 2.</p>}
          p={p}
        />
      </Question>
      <Question q={qu('tp1-deviner')}>
        <QuestionOuverte
          id="tp1-deviner"
          choix={C.ouvertes['tp1-deviner']!.choix}
          attendu={C.ouvertes['tp1-deviner']!.attendu}
          correction={
            <>
              <p>Oui, dès la réponse à un échelon : sa tangente à l’origine est horizontale (démarrage « en S »). Un 1er ordre démarre avec une pente G0·ΔU/τ non nulle ; une tangente horizontale indique un ordre au moins égal à 2.</p>
              {pentes}
            </>
          }
          p={p}
        />
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
                › TP1
              </p>
              <h1 className="text-lg font-semibold">TP1 – Etude de la vitesse d’un Moteur à Courant Continu au démarrage et en régime permanent</h1>
            </div>
            <button type="button" onClick={() => setOuvert(!ouvert)} aria-expanded={ouvert} aria-controls="tp1-questions" className="ml-auto rounded bg-au3-panel-2 px-2 py-1 text-xs ring-1 ring-au3-line hover:ring-au3-accent">
              {ouvert ? 'Masquer les questions ▸' : '◂ Questions'}
            </button>
          </header>
          {entete}
          <Etabli etat={etat} agir={agir} preset={false} variantes={!p.examen} examen={p.examen} onEnregistrement={onEnregistrement} />
        </main>
        {ouvert && (
          <aside id="tp1-questions" aria-label="Questions du TP1" className="w-full shrink-0 border-t border-au3-line bg-au3-bg p-3 lg:sticky lg:top-0 lg:h-screen lg:w-[460px] lg:overflow-y-auto lg:border-t-0 lg:border-l">
            {panneau}
          </aside>
        )}
      </div>
    </div>
  )
}
