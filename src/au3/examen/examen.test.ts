import { renderToString } from 'react-dom/server'
import { createElement } from 'react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { AU3_QUESTIONS } from '../../data/questions.au3'
import { AU3_EPSILON, au3 } from '../../data/reference'
import { reduire, type Action, type EtatBanc } from '../banc'
import { badgeAffiche, dependDHypothese } from '../hypothese'
import { periodeGbf } from '../instruments/gbf'
import { acquerir, moyenner, planAcquisition, type ReglagesOscillo } from '../instruments/oscillo'
import { PageTp1 } from '../pages/Tp1'
import { PageTp2 } from '../pages/Tp2'
import { PageTp4 } from '../pages/Tp4'
import { chargerSession, cleSession, ESPACE_EXAMEN, progressionNeuve, sauverSession, sessionNeuve, SESSION_VERSION, type SessionAu3, type TpExamen } from '../session'
import { PRESET_TP1, PRESET_TP2, type Cablage } from '../sim/cablage'
import { frontiereIntegrateur, polynomeBoucle, regulateur, routhStable, type Impedance } from '../sim/regulateur'
import { BANC_REEL, simulate } from '../sim/simulate'
import { lecturesAffichees } from '../tp1/affichage'
import { corrigerTr5, valeursTr5 } from '../tp1/correction'
import { attendusTp1 } from '../tp1/attendus'
import { GBF_DEFAUT } from '../instruments/gbf'
import { attendusTp2, CABLAGE_TP2, essaiK38, essaiK40, type ReglagesEssai } from '../tp2/attendus'
import { attendusTp4, essaiTp4, scenarioII, Z1_TP4, Z2_TP4 } from '../tp4/attendus'
import { MS_PAR_SECONDE } from '../unites'
import BilanExamen from './BilanExamen'
import { catalogueTp1, catalogueTp2, catalogueTp4, contexteTp1, contexteTp2, contexteTp4, type Catalogue } from './catalogue'
import { noter, tempsRestant, tirage } from './notation'

const T0 = 1_700_000_000_000
const MS = MS_PAR_SECONDE
/** Applique des actions à 1 s d'intervalle depuis l'instant `t` */
const suite = (e: EtatBanc, t: number, ...actions: Action[]) => actions.reduce((x, a, i) => reduire(x, a, t + i * MS), e)
const vide = (): EtatBanc => ({ session: sessionNeuve('examen'), montage: 'tp1', verdict: null, message: null })
const examen = (tp: TpExamen, incident: 'aucun' | 'ampli-bloque' = 'aucun', duree = au3('DUREE_EXAMEN')) => suite(vide(), T0, { type: 'demarrer-examen', tp, graine: 42, incident, duree })
const catalogue = (s: SessionAu3, tp: TpExamen): Catalogue => (tp === 'tp1' ? catalogueTp1(contexteTp1(s)) : tp === 'tp2' ? catalogueTp2(contexteTp2(s, null)) : catalogueTp4(contexteTp4(s, null)))
const note = (e: EtatBanc) => noter(e.session, e.session.examen!.tp, catalogue(e.session, e.session.examen!.tp))
const memoire = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
}
const SANS_LIAISON_5: Cablage = PRESET_TP2.filter((c) => c.id !== 'tp2-5')
const fmt = (x: number) => String(Number(x.toPrecision(MAX_CHIFFRES))).replace('.', ',')
const MAX_CHIFFRES = 6

/** Réponses égales aux valeurs attendues du catalogue (avec unité ; justification pour les questions qualitatives) */
function repondreTout(s: SessionAu3, c: Catalogue, sauf: string[] = []): SessionAu3 {
  const reponses = { ...s.reponses }
  for (const ch of Object.values(c.champs)) if (ch.attendu !== null && !sauf.includes(ch.id)) reponses[ch.id] = { valeur: `${fmt(ch.attendu)}${ch.unite ? ` ${ch.unite}` : ''}`, essais: 1 }
  for (const o of Object.values(c.ouvertes)) if (o.attendu !== null && !sauf.includes(o.id)) reponses[o.id] = { valeur: `${o.attendu}\njustification`, essais: 1 }
  return { ...s, reponses }
}
const PAGES = { tp1: PageTp1, tp2: PageTp2, tp4: PageTp4 } as const
/** Session d'entraînement aux réglages de l'énoncé du TP (GBF, G1, G2, composants) */
function reglee(tp: TpExamen): SessionAu3 {
  const s = sessionNeuve('libre')
  if (tp === 'tp1') return s
  if (tp === 'tp2') {
    const e = essaiK38()
    return { ...s, gbf: e.gbf, platine: { ...s.platine, g1: e.g1, g2: e.g2 } }
  }
  const e = essaiTp4()
  return { ...s, gbf: e.gbf, platine: { ...s.platine, g1: e.g1, g2: e.g2, z1: Z1_TP4, z2: Z2_TP4 } }
}
const rendre = (s: SessionAu3, tp: TpExamen) => renderToString(createElement(MemoryRouter, null, createElement(PAGES[tp], { etat: { session: s, montage: tp, verdict: null, message: null }, agir: () => {} })))

describe('1. rechargement en plein examen', () => {
  it('chrono (depuis l’horodatage), câblage, composants, réponses, essais, pénalités et score identiques', () => {
    let e = examen('tp4')
    e = suite(e, T0 + MS, { type: 'remplacer-cablage', cablage: PRESET_TP2 }, { type: 'composant', support: 'z1', z: Z1_TP4 }, { type: 'composant', support: 'z2', z: Z2_TP4 }, { type: 'faire-verifier' }, { type: 'interrupteur' }, { type: 'retirer-cable', id: 'tp2-5' }, { type: 'autoscale' }, { type: 'reponse', id: 'tp4-i-q1', valeur: '0,8 V' })
    const st = memoire()
    sauverSession(st, e.session, ESPACE_EXAMEN)
    const relu = chargerSession(st, 'examen', ESPACE_EXAMEN)!
    expect(relu).toEqual(e.session)
    const maintenant = T0 + au3('DUREE_EXAMEN') * MS / 2
    expect(tempsRestant(relu.examen!, maintenant)).toBe(tempsRestant(e.session.examen!, maintenant))
    expect(tempsRestant(relu.examen!, maintenant)).toBe(au3('DUREE_EXAMEN') / 2)
    expect(relu.platine.sousTension).toBe(true)
    expect(noter(relu, 'tp4', catalogue(relu, 'tp4')).total).toBe(note(e).total)
  })
})

describe('2. barème du câblage', () => {
  const cable = (cablage: Cablage) => ({ type: 'remplacer-cablage', cablage }) as const
  it('1er essai réussi → 4 pts ; échec puis réussite → 2 pts ; 2 échecs puis réussite → 0 ; recliquer sans modification ne compte pas', () => {
    const p1 = suite(examen('tp2'), T0 + MS, cable(PRESET_TP2), { type: 'faire-verifier' })
    expect(note(p1).cablage.points).toBe(au3('POINTS_CABLAGE'))
    const p2 = suite(examen('tp2'), T0 + MS, cable(SANS_LIAISON_5), { type: 'faire-verifier' }, { type: 'faire-verifier' }, cable(PRESET_TP2), { type: 'faire-verifier' })
    expect(p2.session.essaisVerification).toBe(2)
    expect(note(p2).cablage.points).toBe(au3('POINTS_CABLAGE') * au3('COEF_DEUXIEME_ESSAI'))
    const p3 = suite(examen('tp2'), T0 + MS, cable(SANS_LIAISON_5), { type: 'faire-verifier' }, cable(PRESET_TP2.filter((c) => c.id !== 'tp2-6')), { type: 'faire-verifier' }, cable(PRESET_TP2), { type: 'faire-verifier' })
    expect(p3.session.essaisVerification).toBe(3)
    expect(note(p3).cablage.points).toBe(0)
    expect(p3.session.essaiReussi).toBe(3)
  })
})

describe('3. pénalités', () => {
  it('une tentative sous tension enlève exactement PENALITE_SOUS_TENSION ; le déblocage de l’ampli n’enlève rien ; jamais sous 0', () => {
    const base = suite(examen('tp2'), T0 + MS, { type: 'remplacer-cablage', cablage: PRESET_TP2 }, { type: 'faire-verifier' }, { type: 'interrupteur' })
    const apres = suite(base, T0 + MS * MS, { type: 'retirer-cable', id: 'tp2-8' })
    expect(note(base).total - note(apres).total).toBeCloseTo(au3('PENALITE_SOUS_TENSION'), 12)
    expect(note(suite(base, T0 + MS * MS, { type: 'autoscale' })).total).toBeCloseTo(note(base).total - au3('PENALITE_AUTOSCALE'), 12)
    // incident « ampli bloqué » : procédure de l'énoncé (éteindre, entrée ampli à la masse, rallumer, remettre la source)
    const bloque = suite(examen('tp2', 'ampli-bloque'), T0 + MS, { type: 'remplacer-cablage', cablage: PRESET_TP2 }, { type: 'faire-verifier' }, { type: 'interrupteur' }, { type: 'interrupteur' }, { type: 'rebrancher', id: 'tp2-2', de: 'plat.sortieG2', vers: 'plat.masse3' }, { type: 'interrupteur' }, { type: 'rebrancher', id: 'tp2-2', de: 'plat.masse3', vers: 'plat.sortieG2' })
    expect(bloque.session.platine.ampli).toBe('normal')
    expect(note(bloque).penalites).toEqual([])
    expect(note(bloque).total).toBe(note(base).total)
    const ruine = suite(base, T0 + MS * MS, ...Array.from({ length: au3('POINTS_CABLAGE') / au3('PENALITE_SOUS_TENSION') + 2 }, (): Action => ({ type: 'retirer-cable', id: 'tp2-8' })))
    expect(note(ruine).brut).toBeLessThan(0)
    expect(note(ruine).total).toBe(0)
  })
})

describe('4. aucun indice avant la fin (DOM rendu)', () => {
  const INDICES = ['Attendu (modèle)', 'Réponse attendue', 'Conseil', 'data-verdict=', 'data-correction=', 'Écart de méthode', 'Vérification :', 'data-coherence', 'modèle 30,7', 'Pour comparaison, Matlab']
  for (const tp of ['tp1', 'tp2', 'tp4'] as const) {
    it(`${tp} : toutes les questions répondues, aucune valeur attendue, correction ni conseil ; le badge reste visible`, () => {
      const e = examen(tp)
      const s = repondreTout(e.session, catalogue(e.session, tp))
      const html = rendre(s, tp)
      for (const x of INDICES) expect(html, x).not.toContain(x)
      expect(html).toContain('valeur non vérifiée')
    })
    it(`${tp} : en entraînement, les mêmes réponses (valeurs du catalogue) sont toutes corrigées justes par la page`, () => {
      const s = repondreTout(reglee(tp), catalogue(reglee(tp), tp), ['tp4-i-q5'])
      const html = rendre(s, tp)
      expect(html).toContain('data-verdict="juste"')
      expect(html).not.toContain('data-verdict="faux"')
      expect(html).not.toContain('✗ Réponse attendue')
    })
  }
})

describe('5. fin du chrono', () => {
  it('à 0 : réponses figées, bilan affiché, questions non traitées listées avec leur correction', () => {
    const e = suite(examen('tp2'), T0 + MS, { type: 'remplacer-cablage', cablage: PRESET_TP2 }, { type: 'faire-verifier' }, { type: 'reponse', id: 'tp2-i11-q3', valeur: '3,2 V' })
    const fin = T0 + (au3('DUREE_EXAMEN') + 1) * MS
    expect(tempsRestant(e.session.examen!, fin)).toBe(0)
    const termine = reduire(e, { type: 'terminer-examen' }, fin)
    expect(termine.session.examen!.termine).toBe(true)
    const fige = suite(termine, fin + MS, { type: 'reponse', id: 'tp2-i11-q2', valeur: '1 V' }, { type: 'interrupteur' }, { type: 'remplacer-cablage', cablage: [] })
    expect(fige.session).toEqual(termine.session)
    const b = note(fige)
    const html = renderToString(createElement(BilanExamen, { bilan: b, examen: fige.session.examen! }))
    expect(html).toContain('data-bilan')
    expect(html).toContain('data-correction-examen="tp2-i11-q2"')
    expect(html).not.toContain('data-correction-examen="tp2-i11-q3"')
    expect(html.replace(/<!-- -->/g, '')).toMatch(/Attendu : [\d,]+ (mV|V)/)
  })
})

describe('6. bilan par attendu', () => {
  it('chaque question compte une fois dans le total ; dans le bilan, une fois par attendu lié', () => {
    const e = examen('tp2')
    const s = repondreTout(suite(e, T0 + MS, { type: 'remplacer-cablage', cablage: PRESET_TP2 }, { type: 'faire-verifier' }).session, catalogue(e.session, 'tp2'))
    const b = noter(s, 'tp2', catalogue(s, 'tp2'))
    const sommeQuestions = b.questions.reduce((a, q) => a + q.points, 0)
    expect(b.total).toBeCloseTo(sommeQuestions + b.cablage.points, 9)
    const lieesAttendus = b.questions.reduce((a, q) => a + q.points * q.question.attendus.length, 0)
    const cablageAttendus = AU3_QUESTIONS.find((q) => q.id === 'tp2-cablage')!.attendus.length * b.cablage.points
    expect(b.parAttendu.reduce((a, x) => a + x.points, 0)).toBeCloseTo(lieesAttendus + cablageAttendus, 9)
    expect(b.questions.some((q) => q.question.attendus.length > 1)).toBe(true)
    expect(b.parAttendu.filter((x) => !x.couvert).map((x) => x.attendu.tp)).toEqual(['tp3', 'tp3', 'tp3', 'tp3'])
  })
})

describe('7. migration v3 → v4', () => {
  it('une session d’entraînement TP2 v3 est conservée', () => {
    const st = memoire()
    const { essaiReussi: _a, examen: _b, ...base } = sessionNeuve('libre')
    void [_a, _b]
    const v3 = { ...base, version: 3, cablage: [...PRESET_TP2], reponses: { 'tp2-i11-q2': { valeur: '1,05 V', essais: 2 } }, tp2: { k38: { ...progressionNeuve(), croixT3T1: { z: 0.9, y: 2.8 } }, k40: progressionNeuve() } }
    st.setItem(cleSession('libre', 'tp2'), JSON.stringify(v3))
    const s = chargerSession(st, 'libre', 'tp2')!
    expect(s.version).toBe(SESSION_VERSION)
    expect(SESSION_VERSION).toBe(4)
    expect(s.reponses).toEqual(v3.reponses)
    expect(s.cablage).toEqual(v3.cablage)
    expect(s.tp2).toEqual(v3.tp2)
    expect([s.essaiReussi, s.examen]).toEqual([null, null])
  })
})

describe('8. graine', () => {
  it('même graine → même TP et même incident ; les trois TP et les deux issues sont tirés', () => {
    for (const g of [0, 1, 42, 123456789]) expect(tirage(g)).toEqual(tirage(g))
    const tirages = Array.from({ length: 300 }, (_, g) => tirage(g))
    expect(new Set(tirages.map((t) => t.tp))).toEqual(new Set(['tp1', 'tp2', 'tp4']))
    const incidents = tirages.filter((t) => t.incident === 'ampli-bloque').length / tirages.length
    expect(incidents).toBeGreaterThan(0.2)
    expect(incidents).toBeLessThan(0.45)
  })
})

/* ───────────── 9. Corrections de l'étape 4 ───────────── */

describe('9. intégrateur pur (C2 seul sur Z2) : frontière de Routh', () => {
  const C2: Impedance = { composants: ['C2'], montage: 'serie' }
  const { g0r, tauA, tauB } = BANC_REEL
  const f = frontiereIntegrateur(g0r, tauA, tauB, au3('TP4_G2'))
  const ECART = 5
  const DUREE = 3
  const RESOLUTION = 1e-6
  /** Amplitude crête-à-crête de la mesure sur chacune des 3 dernières périodes d'oscillation */
  const amplitudes = (affichage: number) => {
    const r = scenarioII(C2, false, affichage, undefined, DUREE)
    const n = Math.round((2 * Math.PI * Math.sqrt(tauA * tauB)) / BANC_REEL.pas)
    return [3, 2, 1].map((k) => {
      const tranche = Array.from(r.m.slice(r.m.length - k * n, r.m.length - (k - 1) * n))
      return Math.max(...tranche) - Math.min(...tranche)
    })
  }
  it('(a) Ki·G0r < (τa+τb)/(τa·τb), Ki = G1·G2/(R1·C2), recalculé depuis reference ; Routh confirme de part et d’autre', () => {
    const affichage = ((tauA + tauB) / (tauA * tauB * g0r)) * au3('R1') * au3('C2') * au3('K_P_DIVISEUR') / au3('TP4_G2')
    expect(f).toBeCloseTo(affichage, 9)
    const stable = (a: number) => routhStable(polynomeBoucle(regulateur(Z1_TP4, C2, a, au3('TP4_G2'))!, g0r, tauA, tauB))
    expect(stable(Math.floor(f))).toBe(true)
    expect(stable(Math.ceil(f))).toBe(false)
  })
  it('(b) Affichage frontière − 5 : convergence, erreur finale < 0,5 %', () => {
    expect(Math.abs(scenarioII(C2, false, Math.round(f) - ECART, undefined, DUREE).erreurDemarrage)).toBeLessThan(au3('TP4_ERREUR_MAX'))
  })
  it('(c) frontière + 5 et (d) Affichage 95 : oscillation entretenue (amplitude des 3 dernières périodes non décroissante)', () => {
    for (const a of [Math.round(f) + ECART, 95]) {
      const pp = amplitudes(a)
      expect(pp[0]!, `${a}`).toBeGreaterThan(au3('TP4_ERREUR_MAX'))
      expect(pp[1]!).toBeGreaterThanOrEqual(pp[0]! * (1 - RESOLUTION))
      expect(pp[2]!).toBeGreaterThanOrEqual(pp[1]! * (1 - RESOLUTION))
    }
    // contre-exemple : sous la frontière, l'amplitude décroît nettement d'une période à l'autre
    const amortie = amplitudes(Math.round(f) - ECART)
    expect(amortie[2]!).toBeLessThan(amortie[0]! * (1 - RESOLUTION))
  })
  it('la page signale « boucle instable » avec les composants et le G1 de la platine', () => {
    const s = sessionNeuve('libre')
    const instable = { ...s, platine: { ...s.platine, z1: Z1_TP4, z2: C2, g1: 95, g2: au3('TP4_G2') } }
    expect(contexteTp4(instable, null).stable).toBe(false)
    expect(rendre(instable, 'tp4')).toContain('boucle instable')
    expect(contexteTp4({ ...s, platine: { ...s.platine, z1: Z1_TP4, z2: Z2_TP4, g1: 95, g2: au3('TP4_G2') } }, null).stable).toBe(true)
  })
})

describe('TR5%b : derniers franchissements de la bande (trace sans bruit et trace affichée), 20 graines', () => {
  const GRAINES = Array.from({ length: 20 }, (_, g) => g + 1)
  const osc = (moy: number, v1: number, v2: number, sdiv: number): ReglagesOscillo => ({ voies: [v1, v2, 5, 0.5].map((vdiv, j) => ({ active: j < 2, vdiv, position: 0, couplage: 'DC' as const })), sdiv, declenchement: { source: 0, front: 'montant', niveau: 0, mode: 'normal' }, moyennage: moy, run: true })
  /** Lecture du TR5% sur la trace affichée (moyennage de `o`), pour une graine de bruit */
  const lecture = (e: ReglagesEssai, o: ReglagesOscillo, graine: number, cablage: Cablage = CABLAGE_TP2) => {
    const plan = planAcquisition(o, periodeGbf(e.gbf), BANC_REEL.pas)
    const recs = Array.from({ length: o.moyennage }, (_, g) => {
      const s = simulate(BANC_REEL, { gbf: e.gbf, platine: { sousTension: true, ampli: 'normal', g1: e.g1, g2: e.g2, z1: e.z1 ?? null, z2: e.z2 ?? null }, duree: plan.duree, pasSortie: plan.pasSortie }, cablage, graine * MS + g)
      return acquerir(o, { t: s.t, voies: [s.voie1, s.voie2, s.voie3, s.voie4] }, plan, 0)!
    })
    return lecturesAffichees(moyenner(recs))!
  }
  it('G1 = 0,60, moyennage 1 : la valeur sans bruit (8,2 ms ±5 %) est toujours attendue ; deux valeurs → explication', () => {
    const a = attendusTp4(essaiTp4(60))
    expect(Math.abs(a.tr5 / 8.2e-3 - 1)).toBeLessThanOrEqual(au3('TOL_MESURE'))
    let deux = 0
    for (const g of GRAINES) {
      const l = lecture(essaiTp4(60), osc(1, 0.2, 0.2, 10e-3), g)
      const v = valeursTr5(a.tr5, l)
      expect(v[0], `graine ${g}`).toBe(a.tr5)
      expect(corrigerTr5(`${fmt(8.2)} ms`, a.tr5, l).verdict, `graine ${g}`).toBe('juste')
      if (v.length > 1) {
        deux++
        expect(corrigerTr5(`${fmt(v[1]! * MS)} ms`, a.tr5, l).verdict).toBe('juste')
        expect(corrigerTr5(`${fmt(v[1]! * MS)} ms`, a.tr5, l).message).toContain('sans jamais s’en éloigner')
      } else expect(corrigerTr5(`${fmt(8.2)} ms`, a.tr5, l).message).not.toContain('Deux lectures')
    }
    expect(deux).toBeGreaterThan(0)
  })
  it('TP2 K = 40 et TP4 G1 = 0,95 : aucune valeur attendue n’est antérieure au pic', () => {
    for (const [e, o] of [[essaiK40(au3('CR_TP2K40_C0')), osc(1, 0.05, 0.05, 5e-3)], [essaiTp4(95), osc(1, 0.2, 0.2, 10e-3)]] as const) {
      const att = 'z1' in e && e.z1 ? attendusTp4(e) : attendusTp2(e)
      for (const g of GRAINES) for (const v of valeursTr5(att.tr5, lecture(e, o, g))) expect(v, `graine ${g}`).toBeGreaterThan(att.tpb2)
    }
  })
  it('TP1 et TP2 K = 3,8 : valeurs du modèle inchangées (30,7 et 15,3 ms ±5 %), toujours attendues', () => {
    const tp1 = attendusTp1({ ...GBF_DEFAUT, vpp: au3('CR_TP1_DU') })
    const k38 = attendusTp2(essaiK38(au3('CR_TP2K38_C0')))
    expect(Math.abs(tp1.tr5 / 30.7e-3 - 1)).toBeLessThanOrEqual(au3('TOL_MESURE'))
    expect(Math.abs(k38.tr5 / 15.3e-3 - 1)).toBeLessThanOrEqual(au3('TOL_MESURE'))
    for (const g of GRAINES.slice(0, 5)) {
      expect(valeursTr5(k38.tr5, lecture(essaiK38(au3('CR_TP2K38_C0')), osc(16, 0.5, 0.2, 5e-3), g))[0]).toBe(k38.tr5)
      expect(valeursTr5(tp1.tr5, lecture({ gbf: { ...GBF_DEFAUT, vpp: au3('CR_TP1_DU') }, g1: 38, g2: 10 }, osc(16, 2, 0.5, 10e-3), g, PRESET_TP1))[0]).toBe(tp1.tr5)
    }
  })
})

describe('points partiels par champ (POINTS_PAR_CHAMP)', () => {
  it('3 champs justes sur 4 = 0,75 ; un champ incomplet = COEF_INCOMPLET × la part de ce champ', () => {
    const e = examen('tp2')
    const c = catalogue(e.session, 'tp2')
    const juste = (id: string) => ({ valeur: `${fmt(c.champs[id]!.attendu!)} ${c.champs[id]!.unite}`.trim(), essais: 1 })
    const s: SessionAu3 = {
      ...e.session,
      reponses: {
        'tp2-i11-q6#t1': juste('tp2-i11-q6#t1'),
        'tp2-i11-q6#t3': juste('tp2-i11-q6#t3'),
        'tp2-i11-q6': juste('tp2-i11-q6'),
        'tp2-i11-q7': { valeur: fmt(c.champs['tp2-i11-q7']!.attendu!), essais: 1 },
      },
    }
    const b = noter(s, 'tp2', c)
    const q = (id: string) => b.questions.find((x) => x.question.id === id)!
    const part = au3('POINTS_QUESTION') * au3('POINTS_PAR_CHAMP')
    expect(q('tp2-i11-q6').champs).toHaveLength(4)
    expect(q('tp2-i11-q6').points).toBeCloseTo((part * 3) / 4, 12)
    expect(q('tp2-i11-q6').points).toBeCloseTo(0.75, 12)
    expect(q('tp2-i11-q7').champs).toHaveLength(2)
    expect(q('tp2-i11-q7').points).toBeCloseTo((au3('COEF_INCOMPLET') * part) / 2, 12)
  })
})

describe('durée de l’examen', () => {
  it('45 min (DUREE_EXAMEN_MANIP) : enregistrée dans la session et conservée au rechargement', () => {
    const e = examen('tp4', 'aucun', au3('DUREE_EXAMEN_MANIP'))
    const st = memoire()
    sauverSession(st, e.session, ESPACE_EXAMEN)
    const relu = chargerSession(st, 'examen', ESPACE_EXAMEN)!
    expect(relu.examen!.duree).toBe(au3('DUREE_EXAMEN_MANIP'))
    expect(tempsRestant(relu.examen!, T0 + MS)).toBe(au3('DUREE_EXAMEN_MANIP') - 1)
    expect(tempsRestant(relu.examen!, T0 + (au3('DUREE_EXAMEN_MANIP') + 1) * MS)).toBe(0)
    expect(examen('tp4').session.examen!.duree).toBe(au3('DUREE_EXAMEN'))
  })
})

/* ───────────── 10. Audit ───────────── */

const PAGES_SOURCES = import.meta.glob<string>(['/src/au3/pages/Tp*.tsx'], { query: '?raw', import: 'default', eager: true })
/** Réponses qui ne dépendent d'aucun paramètre du modèle (GBF réglé, numéros du banc) */
const HORS_MODELE = ['tp1-numeros', 'tp1-i21-q2', 'tp2-i11-q3', 'tp2-i21-q2']

describe('10. audit final', () => {
  const catalogues = { tp1: catalogue(sessionNeuve('libre'), 'tp1'), tp2: catalogue(sessionNeuve('libre'), 'tp2'), tp4: catalogue(sessionNeuve('libre'), 'tp4') }
  const idsCatalogue = (tp: TpExamen) => new Set([...Object.keys(catalogues[tp].champs), ...Object.keys(catalogues[tp].ouvertes)].map((id) => id.split('#')[0]!))
  it('(2) toute question dont la réponse dépend d’une hypothèse non validée par le CR a son badge', () => {
    for (const tp of ['tp1', 'tp2', 'tp4'] as const)
      for (const id of idsCatalogue(tp)) {
        const q = AU3_QUESTIONS.find((x) => x.id === id)!
        expect(dependDHypothese(q.cles) || HORS_MODELE.includes(id), `${id} : réponse calculée par le modèle sans clé d’hypothèse`).toBe(true)
        expect(badgeAffiche(q.cles, q.validee), id).toBe(dependDHypothese(q.cles) && q.validee.length === 0)
      }
    for (const q of AU3_QUESTIONS.filter((x) => x.tp === 'tp4')) expect(badgeAffiche(q.cles, q.validee), q.id).toBe(true)
  })
  it('(3) aucune réponse attendue en dur : chaque question notable est au catalogue, et les pages ne lisent que lui', () => {
    const sansReponse = new Set(['tp1-reglages', 'tp1-cablage', 'tp1-sous-tension', 'tp2-reglages', 'tp2-cablage', 'tp2-sous-tension', 'tp2-i11-q5', 'tp2-i2-reglages', 'tp4-cablage', 'tp4-reglages', 'tp4-sous-tension'])
    for (const q of AU3_QUESTIONS.filter((x) => x.tp !== 'tp3' && x.statut === 'disponible' && !x.optionnelle && !sansReponse.has(x.id)))
      expect(idsCatalogue(q.tp as TpExamen).has(q.id), `${q.id} absente du catalogue`).toBe(true)
    for (const [f, src] of Object.entries(PAGES_SOURCES)) {
      expect(src, f).not.toMatch(/<ChampNum[^>]*\sattendu=/)
      for (const m of src.matchAll(/\sattendu=\{([^}]*)\}/g)) expect(m[1] ?? '', f).toMatch(/^C\.ouvertes\['[^']+'\]!\.attendu$/)
    }
    // les valeurs attendues numériques viennent du modèle : elles changent quand le réglage du GBF change
    const s = sessionNeuve('libre')
    const autre = catalogueTp1(contexteTp1({ ...s, gbf: { ...s.gbf, vpp: s.gbf.vpp / 2 } }))
    expect(autre.champs['tp1-i21-q1']!.attendu).not.toBeCloseTo(catalogues.tp1.champs['tp1-i21-q1']!.attendu!, 3)
    expect(Math.abs(autre.champs['tp1-i21-q3']!.attendu! - catalogues.tp1.champs['tp1-i21-q3']!.attendu!)).toBeLessThan(AU3_EPSILON + au3('PAS_EULER'))
  })
})
