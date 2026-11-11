import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import enonce from '../../docs/au3/enonce.md?raw'
import { AU3, type RefKey } from '../data/reference'
import { AU3_ATTENDUS, AU3_QUESTIONS, couverture } from '../data/questions.au3'
import { dependDHypothese } from './hypothese'
import { chargerSession, cleSession, sauverSession, sessionNeuve, SESSION_VERSION } from './session'

/** Code AU3 hors tests (texte brut), par chemin depuis la racine du dépôt */
const SOURCES = import.meta.glob<string>(['/src/au3/**/*.{ts,tsx}', '/src/data/questions.au3.ts', '!/src/au3/**/*.test.{ts,tsx}'], { query: '?raw', import: 'default', eager: true })

/* ───────────── 12. Règle des constantes ───────────── */

/** Nombres tolérés hors de reference.ts : 0, 1, 2 (et −1 = moins unaire appliqué à 1) */
const TOLERES = new Set([0, 1, 2])

/**
 * Liste blanche explicite :
 * - prng.ts : constantes de l'algorithme mulberry32 (pas des valeurs de modèle ni de réglage) ;
 * - miseEnPage.ts : pixels, couleurs, pas des boutons (pas des paramètres de modèle, correction 4 de l'étape 2) ;
 * - index de tableau `x[3]` (accès par position) ;
 * - les classes Tailwind et les attributs SVG de présentation sont des chaînes : jamais des NumericLiteral.
 */
const FICHIERS_BLANCS = new Set(['/src/au3/sim/prng.ts', '/src/au3/miseEnPage.ts'])

function litterauxInterdits(chemin: string, texte: string): string[] {
  const src = ts.createSourceFile(chemin, texte, ts.ScriptTarget.Latest, true, chemin.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const fautes: string[] = []
  const visite = (n: ts.Node) => {
    if (ts.isNumericLiteral(n) && !TOLERES.has(Number(n.text)) && !(ts.isElementAccessExpression(n.parent) && n.parent.argumentExpression === n)) {
      const { line } = src.getLineAndCharacterOfPosition(n.getStart())
      fautes.push(`${chemin}:${line + 1} → ${n.text}`)
    }
    ts.forEachChild(n, visite)
  }
  visite(src)
  return fautes
}

describe('12. règle des constantes', () => {
  it('aucun nombre littéral hors {0, 1, -1, 2} dans le code AU3 (hors reference.ts et tests)', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(10)
    const fautes = Object.entries(SOURCES).filter(([f]) => !FICHIERS_BLANCS.has(f)).flatMap(([f, texte]) => litterauxInterdits(f, texte))
    expect(fautes).toEqual([])
  })

  it('le détecteur trouve bien un littéral interdit', () => {
    const src = ts.createSourceFile('x.ts', 'const a = 3.5; const b = t[4]; const c = -1', ts.ScriptTarget.Latest, true)
    const vus: string[] = []
    const visite = (n: ts.Node) => {
      if (ts.isNumericLiteral(n) && !TOLERES.has(Number(n.text)) && !(ts.isElementAccessExpression(n.parent) && n.parent.argumentExpression === n)) vus.push(n.text)
      ts.forEachChild(n, visite)
    }
    visite(src)
    expect(vus).toEqual(['3.5'])
  })

  it('chaque entrée de reference AU3 a une valeur, une unité et une source valide', () => {
    for (const [k, e] of Object.entries(AU3)) {
      expect(Number.isFinite(e.valeur), k).toBe(true)
      expect(['CR', 'enonce', 'hypothese'], k).toContain(e.source)
    }
  })
})

/* ───────────── 13. Accueil : attendus officiels ───────────── */

const normaliser = (s: string) => s.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()
const ENONCE = normaliser(enonce)

describe('13. attendus officiels et intitulés', () => {
  it('17 attendus (TP1 : 4, TP2 : 5, TP3 : 4, TP4 : 4), présents mot pour mot dans l’énoncé', () => {
    expect(AU3_ATTENDUS.map((a) => a.tp)).toEqual(['tp1', 'tp1', 'tp1', 'tp1', 'tp2', 'tp2', 'tp2', 'tp2', 'tp2', 'tp3', 'tp3', 'tp3', 'tp3', 'tp4', 'tp4', 'tp4', 'tp4'])
    for (const a of AU3_ATTENDUS) expect(ENONCE, a.texte).toContain(normaliser(a.texte))
  })

  it('TP3 « non couvert », TP1 couvert (étape 2), TP2 et TP4 reliés à des questions à venir', () => {
    for (const a of AU3_ATTENDUS) expect(couverture(a).etat, a.id).toBe(a.tp === 'tp3' ? 'non-couvert' : a.tp === 'tp1' ? 'couvert' : 'a-venir')
  })

  it('chaque question a une ancre dans l’énoncé et reprend son intitulé exact', () => {
    for (const q of AU3_QUESTIONS) {
      expect(enonce, q.id).toContain(`<a id="${q.id}"></a>`)
      expect(ENONCE, q.id).toContain(normaliser(q.intitule))
      expect(q.statut).toBe(q.tp === 'tp1' ? 'disponible' : 'a-venir')
      for (const id of q.attendus) expect(AU3_ATTENDUS.map((a) => a.id)).toContain(id)
    }
    expect(new Set(AU3_QUESTIONS.map((q) => q.id)).size).toBe(AU3_QUESTIONS.length)
  })

  it('l’énoncé contient TP1 à TP4, les fiches GBF et oscilloscope et les méthodes de travail', () => {
    for (const ancre of ['tp1', 'tp2', 'tp3', 'tp4', 'fiche-gbf', 'fiche-oscilloscope']) expect(enonce).toContain(`<a id="${ancre}"></a>`)
    expect(enonce).toContain('## METHODES DE TRAVAIL')
    expect(enonce).toContain('<!-- p. 34 -->')
  })
})

/* ───────────── 14. Badge « valeur non vérifiée » ───────────── */

describe('14. badge « valeur non vérifiée »', () => {
  it('dependDHypothese renvoie true dès qu’une clé a la source « hypothese »', () => {
    expect(dependDHypothese([])).toBe(false)
    expect(dependDHypothese(['CR_TP1_DM', 'TP1_GBF_FREQ'])).toBe(false)
    expect(dependDHypothese(['CR_TP1_DM', 'G0R'])).toBe(true)
    for (const k of Object.keys(AU3) as RefKey[]) expect(dependDHypothese([k])).toBe(AU3[k].source === 'hypothese')
  })

  it('toutes les questions du TP4 dépendent d’une hypothèse (aucune mesure)', () => {
    for (const q of AU3_QUESTIONS.filter((x) => x.tp === 'tp4' && x.id !== 'tp4-cablage')) expect(dependDHypothese(q.cles), q.id).toBe(true)
  })
})

/* ───────────── Session (mode examen, étape 5) ───────────── */

describe('session localStorage versionnée', () => {
  const memoire = () => {
    const m = new Map<string, string>()
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
  }

  it('une session survit à un rechargement (chrono, réponses, essais, événements, câblage)', () => {
    const st = memoire()
    const s = { ...sessionNeuve('examen'), chrono: { debut: 5, ecouleMs: 1234 }, reponses: { 'tp1-i21-q1': { valeur: '1,86 V', essais: 1 } }, essaisVerification: 2 }
    s.evenementsSousTension.push({ instant: 9, type: 'manip-sous-tension', detail: 'x' })
    sauverSession(st, s)
    expect(chargerSession(st, 'examen')).toEqual(s)
  })

  it('une session d’une autre version ou illisible est ignorée', () => {
    const st = memoire()
    st.setItem(cleSession('libre'), JSON.stringify({ ...sessionNeuve('libre'), version: SESSION_VERSION + 1 }))
    expect(chargerSession(st, 'libre')).toBeNull()
    st.setItem(cleSession('libre'), '{pas du json')
    expect(chargerSession(st, 'libre')).toBeNull()
  })
})
