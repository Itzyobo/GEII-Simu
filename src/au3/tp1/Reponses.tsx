import { useState, type ReactNode } from 'react'
import type { QuestionAu3 } from '../../data/questions.au3'
import type { Action } from '../banc'
import { MISE_EN_PAGE } from '../miseEnPage'
import type { SessionAu3 } from '../session'
import BadgeNonVerifie from '../ui/BadgeNonVerifie'
import { afficher, pourcent } from './affichage'
import type { Correction } from './correction'
import { valeursChamp, type ChampDef } from '../examen/catalogue'

const STYLE_VERDICT: Record<Correction['verdict'], string> = {
  juste: 'text-au3-ok',
  faux: 'text-au3-err',
  incomplete: 'text-au3-warn',
  illisible: 'text-au3-warn',
}
const LIBELLE: Record<Correction['verdict'], string> = { juste: '✓ juste', faux: '✗ faux', incomplete: '⚠ incomplète', illisible: '⚠ illisible' }

/** Bloc d'une question : ancre = id (même clé que l'énoncé), numéro, intitulé exact, badge selon la règle du badge */
export function Question({ q, children, badge }: { q: QuestionAu3; children?: ReactNode; badge?: string }) {
  return (
    <section id={q.id} aria-labelledby={`${q.id}-titre`} className="scroll-mt-4 rounded-lg bg-au3-panel p-3 ring-1 ring-au3-line">
      <h3 id={`${q.id}-titre`} className="text-sm">
        <span className="mr-2 font-mono text-xs text-au3-accent">{q.numero}</span>
        {q.intitule}
        <BadgeNonVerifie cles={q.cles} validee={q.validee} detail={badge} />
      </h3>
      {badge && (
        <p className="mt-1 text-xs text-au3-warn" data-note-badge={q.id}>
          {badge}
        </p>
      )}
      {children && <div className="mt-2 space-y-2">{children}</div>}
    </section>
  )
}

export interface PropsReponse {
  session: SessionAu3
  agir: (a: Action) => void
  /** Mode examen : aucune correction affichée (étape 5) */
  examen: boolean
}

/**
 * Champ numérique : l'étudiant saisit sa valeur avec son unité, « Valider » l'enregistre (essais comptés) ;
 * hors examen, la correction s'affiche ensuite (verdict, écart, valeur attendue calculée par le modèle).
 */
export function ChampNum({ champ, label, p, apres, lire }: { champ: ChampDef | undefined; label: string; p: PropsReponse; apres?: (c: Correction) => ReactNode; lire?: () => number[] | undefined }) {
  if (!champ) throw new Error(`Champ absent du catalogue : ${label}`)
  const { id, unite } = champ
  const enregistre = p.session.reponses[id]
  const [saisie, setSaisie] = useState(enregistre?.valeur ?? '')
  const c = enregistre && champ.attendu !== null ? champ.corriger(enregistre.valeur, enregistre.lectures) : null
  return (
    <div className="text-xs">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          p.agir({ type: 'reponse', id, valeur: saisie, lectures: lire?.() })
        }}
      >
        <label htmlFor={id + '-champ'} className="min-w-28 text-au3-muted">
          {label}
        </label>
        <input id={id + '-champ'} value={saisie} onChange={(e) => setSaisie(e.target.value)} placeholder={unite ? `valeur et unité (${unite})` : 'valeur (sans unité)'} className="w-36 rounded bg-black/40 px-2 py-1 font-mono text-au3-ink ring-1 ring-au3-line focus:ring-au3-accent" />
        <button type="submit" className="rounded bg-au3-accent px-2 py-1 font-semibold text-black">
          Valider
        </button>
        {enregistre && <span className="text-au3-muted">essai {enregistre.essais}</span>}
      </form>
      {c && !p.examen && (
        <p className={`mt-1 ${STYLE_VERDICT[c.verdict]}`} role="status" data-verdict={c.verdict} data-champ={id}>
          {LIBELLE[c.verdict]} — {c.message}
          {c.ecart !== null && champ.tolerance !== null && ` Écart ${pourcent(c.ecart)} (tolérance ±${Math.round(champ.tolerance * MISE_EN_PAGE.pourcent)} %).`} Attendu (modèle) : {lecturesTexte(champ, enregistre?.lectures)}.{apres?.(c)}
        </p>
      )}
    </div>
  )
}

/** Valeur(s) attendue(s) affichée(s) : deux lectures du TR5% quand un creux frôle la bande, sinon le texte du catalogue */
function lecturesTexte(champ: ChampDef, lectures?: readonly number[]) {
  const v = valeursChamp(champ, lectures)
  return v.length > 1 ? v.map((x) => afficher(x, champ.unite)).join(' ou ') + ' (lectures sur votre trace)' : champ.texte
}

/**
 * Question qualitative : choix + justification. La correction rédigée ne s'affiche qu'après la réponse
 * de l'étudiant (et jamais en mode examen).
 */
export function QuestionOuverte({ id, choix, attendu, correction, p }: { id: string; choix: readonly string[]; attendu: string | null; correction: ReactNode; p: PropsReponse }) {
  const r = p.session.reponses[id]
  const [choisi, setChoisi] = useState(r?.valeur.split('\n')[0] ?? '')
  const [texte, setTexte] = useState(r?.valeur.split('\n').slice(1).join('\n') ?? '')
  return (
    <div className="space-y-1.5 text-xs">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          p.agir({ type: 'reponse', id, valeur: `${choisi}\n${texte}` })
        }}
        className="space-y-1.5"
      >
        <div role="radiogroup" aria-label="Votre réponse" className="flex flex-wrap gap-2">
          {choix.map((x) => (
            <label key={x} className="flex items-center gap-1">
              <input type="radio" name={id} value={x} checked={choisi === x} onChange={() => setChoisi(x)} />
              {x}
            </label>
          ))}
        </div>
        <textarea aria-label="Justification" value={texte} onChange={(e) => setTexte(e.target.value)} rows={2} placeholder="Justifiez" className="w-full rounded bg-black/40 px-2 py-1 text-au3-ink ring-1 ring-au3-line focus:ring-au3-accent" />
        <button type="submit" disabled={!choisi} className="rounded bg-au3-accent px-2 py-1 font-semibold text-black disabled:opacity-40">
          Valider
        </button>
      </form>
      {r && !p.examen && (
        <div className="rounded bg-black/30 p-2 ring-1 ring-au3-line" role="status" data-correction={id}>
          {attendu !== null && (
            <p className={r.valeur.startsWith(attendu + '\n') ? 'text-au3-ok' : 'text-au3-err'}>
              {r.valeur.startsWith(attendu + '\n') ? '✓' : '✗'} Réponse attendue : {attendu}
            </p>
          )}
          <div className="mt-1 text-au3-ink">{correction}</div>
        </div>
      )}
    </div>
  )
}

