import { describe, expect, it } from 'vitest'
import { AU3_QUESTIONS, couverture, AU3_ATTENDUS } from '../../data/questions.au3'
import { au3 } from '../../data/reference'
import { reduire, type EtatBanc } from '../banc'
import { badgeAffiche } from '../hypothese'
import { sessionNeuve } from '../session'
import { MONTAGES, verifier } from '../sim/cablage'
import { parametresPI, regulateur, type Impedance } from '../sim/regulateur'
import { BANC_SANS_BRUIT } from '../tp1/attendus'
import { PRESET_TP2 } from '../sim/cablage'
import { AFFICHAGE_TP4, attendusTp4, balayageG1, essaiTp4, kTi, scenarioII, Z1_TP4, Z2_TP4 } from './attendus'
import { corrigerG1 } from './correction'

// Critères chiffrés du PRD §6 (étape 4) : ne jamais élargir
const TOL_1 = 0.01
const TOL_D1_PRD = 0.1
const D1_PRD = 0.185
const ERREUR_MAX = au3('TP4_ERREUR_MAX')
const ERREUR_P = 0.05
const TOL_PLAFOND = 0.005
const AFFICHAGE_INTEGRATEUR_STABLE = 30
const DUREE_INTEGRATEUR = 0.5
const proche = (x: number, ref: number, t: number) => expect(Math.abs(x / ref - 1), `${x} vs ${ref}`).toBeLessThanOrEqual(t)

const A95 = attendusTp4()
const A60 = attendusTp4(essaiTp4(60))

describe('TP4 partie I : régulateur PI série à impédances', () => {
  it('1. Ti = R2·C2 = 8,91 ms ±1 %', () => {
    expect(kTi().Ti).toBeCloseTo(au3('R2') * au3('C2'), 12)
    proche(kTi().Ti, 8.91e-3, TOL_1)
  })
  it('2. K = (R2/R1)·G1·G2 = 25,65 ±1 % pour Affichage 95, G2 = 10', () => {
    expect(AFFICHAGE_TP4).toBe(95)
    expect(kTi().K).toBeCloseTo((au3('R2') / au3('R1')) * au3('TP4_G1') * au3('TP4_G2'), 9)
    proche(kTi().K, 25.65, TOL_1)
    expect(parametresPI(regulateur(Z1_TP4, Z2_TP4, AFFICHAGE_TP4, au3('TP4_G2'))!)).toEqual(kTi())
  })
  it('3. G1 = 0,95, 0,8 Vpp, 4,9 Hz : erreur statique < 0,5 % en fin de demi-période', () => {
    expect(Math.abs(A95.erreur)).toBeLessThan(ERREUR_MAX)
  })
  it('4. G1 = 0,95 : voie 3 plafonne à 10,6 V au démarrage ; D1/m(∞) = 18,5 % ±10 %', () => {
    proche(A95.umax, au3('USAT'), TOL_PLAFOND)
    proche(A95.d1rel, D1_PRD, TOL_D1_PRD)
  })
  it('5. G1 = 0,6 : D1/m(∞) < 5 %', () => expect(A60.d1rel).toBeLessThan(au3('TP4_D1_MAX')))
  it('6. Q5 : frontière (plus grand Affichage respectant le cahier des charges) : D1 < 5 %, le suivant non ; entre 60 et 79', () => {
    const b = balayageG1()
    const f = b.frontiere!
    expect(f).toBeGreaterThanOrEqual(60)
    expect(f).toBeLessThanOrEqual(79)
    expect(b.tous[f]!.a.d1rel).toBeLessThan(au3('TP4_D1_MAX'))
    expect(b.tous[f + 1]!.a.d1rel).toBeGreaterThanOrEqual(au3('TP4_D1_MAX'))
    expect(b.ok).toContain(60)
    expect(b.ok).not.toContain(AFFICHAGE_TP4)
    // correction : toute valeur de l'ensemble est acceptée ; sinon la condition qui échoue est nommée
    expect(corrigerG1(String(f), b.tous).verdict).toBe('juste')
    const refus = corrigerG1(String(AFFICHAGE_TP4), b.tous)
    expect(refus.verdict).toBe('faux')
    expect(refus.message).toMatch(/D1\/m\(∞\)/)
    expect(refus.message).not.toMatch(/TR5%b/)
  })
})

describe('TP4 partie II (moteur du banc) : bouteille, PI contre P', () => {
  it('7. PI : erreur statique finale < 0,5 % ; écart maximal après la bouteille > 0 et calculé', () => {
    const r = scenarioII(true, true)
    expect(Math.abs(r.erreurFinale!)).toBeLessThan(ERREUR_MAX)
    expect(r.ecartMax!).toBeGreaterThan(0)
    const i = r.t.findIndex((t) => t >= au3('TP4_BOUTEILLE_T'))
    let max = 0
    for (let k = i; k < r.t.length; k++) max = Math.max(max, r.c[k]! - r.m[k]!)
    expect(r.ecartMax).toBeCloseTo(max, 12)
  })
  it('II.4 : la bouteille fait monter U (l’intégrale compense le couple de charge)', () => {
    const r = scenarioII(true, true)
    expect(r.uApres).toBeGreaterThan(r.uFin)
  })
  it('8. P seul : erreur statique finale > 5 %', () => expect(scenarioII(false, true).erreurFinale!).toBeGreaterThan(ERREUR_P))
})

describe('mauvais placements des composants', () => {
  const avec = (z1: Impedance | null, z2: Impedance | null) => attendusTp4(essaiTp4(AFFICHAGE_TP4, z1, z2))
  it('9. R2 et C2 en parallèle sur Z2 : erreur statique > 5 % (pas d’intégrateur)', () => {
    expect(avec(Z1_TP4, { composants: ['R2', 'C2'], montage: 'parallele' }).erreur).toBeGreaterThan(ERREUR_P)
  })
  it('10. C2 seul sur Z2 : intégrateur pur, R(p) = G1·G2/(R1·C2·p) ; pas d’erreur statique (boucle stable, échelon long)', () => {
    const z2: Impedance = { composants: ['C2'], montage: 'serie' }
    const h = regulateur(Z1_TP4, z2, AFFICHAGE_TP4, au3('TP4_G2'))!
    const g = (AFFICHAGE_TP4 * au3('TP4_G2')) / au3('K_P_DIVISEUR')
    expect(h.num).toEqual([g])
    expect(h.den[0]).toBe(0)
    expect(h.den[1]).toBeCloseTo(au3('R1') * au3('C2'), 15)
    // Intégrateur pur : erreur statique nulle en régime permanent, si la boucle est stable. À l'Affichage 95 de l'énoncé,
    // le gain G1·G2/(R1·C2) ≈ 2 900 s⁻¹ avec les deux pôles du moteur rend la boucle instable (signalé au rapport).
    const stable = scenarioII(z2, false, AFFICHAGE_INTEGRATEUR_STABLE, BANC_SANS_BRUIT, DUREE_INTEGRATEUR)
    expect(Math.abs(stable.erreurDemarrage)).toBeLessThan(ERREUR_MAX)
    const instable = scenarioII(z2, false, AFFICHAGE_TP4, BANC_SANS_BRUIT, DUREE_INTEGRATEUR)
    expect(Math.abs(instable.erreurDemarrage)).toBeGreaterThan(ERREUR_P)
  })
  it('R2 sur Z1 (et R1 + C2 sur Z2) : un autre PI, calculé comme tel', () => {
    const h = regulateur({ composants: ['R2'], montage: 'serie' }, { composants: ['R1', 'C2'], montage: 'serie' }, AFFICHAGE_TP4, au3('TP4_G2'))!
    const pi = parametresPI(h)!
    expect(pi.Ti).toBeCloseTo(au3('R1') * au3('C2'), 12)
    expect(pi.K).toBeCloseTo((au3('R1') / au3('R2')) * au3('TP4_G1') * au3('TP4_G2'), 9)
  })
  it('un seul support garni : régulateur non câblé (hors service)', () => {
    expect(regulateur(null, Z2_TP4, AFFICHAGE_TP4, au3('TP4_G2'))).toBeNull()
    expect(regulateur(Z1_TP4, null, AFFICHAGE_TP4, au3('TP4_G2'))).toBeNull()
  })
  it('« Faire vérifier » : C2 en parallèle détecté ; Z vide = régulateur non câblé ; montage exact 11/11', () => {
    const m = MONTAGES.tp4
    expect(verifier(PRESET_TP2, m.liaisons, { z1: Z1_TP4, z2: Z2_TP4 }, m.impedances).reussi).toBe(true)
    const par = verifier(PRESET_TP2, m.liaisons, { z1: Z1_TP4, z2: { composants: ['R2', 'C2'], montage: 'parallele' } }, m.impedances)
    expect(par.reussi).toBe(false)
    expect(par.impedances.find((z) => z.support === 'z2')!.message).toMatch(/R2 \/\/ C2.*attendu R2 \+ C2 en série/)
    const vide = verifier(PRESET_TP2, m.liaisons, { z1: Z1_TP4, z2: null }, m.impedances)
    expect(vide.impedances.find((z) => z.support === 'z2')!.message).toMatch(/régulateur non câblé/)
    expect(vide.total).toBe(11)
  })
})

describe('11. non-régression TP1/TP2 avec le nouveau régulateur', () => {
  it('supports vides : R(p) = G1·G2 (régulateur P) ; les fichiers de test TP1 et TP2 restent verts (suite complète)', () => {
    const h = regulateur(null, null, au3('TP2_K38_G1'), au3('TP2_K38_G2'))!
    expect(h).toEqual({ num: [au3('TP2_K38_K')], den: [1] })
  })
})

describe('12. badges et couverture du TP4', () => {
  it('toutes les questions du TP4 ont le badge ; II.2 est « non couverte »', () => {
    const tp4 = AU3_QUESTIONS.filter((q) => q.tp === 'tp4')
    for (const q of tp4) expect(badgeAffiche(q.cles, q.validee), q.id).toBe(true)
    expect(tp4.find((q) => q.id === 'tp4-ii2')!.statut).toBe('non-couverte')
    const a4 = AU3_ATTENDUS.find((a) => a.id === 'tp4-a4')!
    expect(couverture(a4).questions.map((q) => q.id)).toContain('tp4-ii2')
  })
})

describe('14. composants sous tension', () => {
  it('déposer ou retirer un composant platine allumée est refusé et journalisé', () => {
    const e0: EtatBanc = { session: { ...sessionNeuve('libre'), cablage: [...PRESET_TP2], platine: { ...sessionNeuve('libre').platine, z1: Z1_TP4, z2: Z2_TP4 } }, montage: 'tp4', verdict: null, message: null }
    const on = reduire(reduire(e0, { type: 'faire-verifier' }, 1), { type: 'interrupteur' }, 2)
    expect(on.session.platine.sousTension).toBe(true)
    const retrait = reduire(on, { type: 'composant', support: 'z2', z: null }, 3)
    const depot = reduire(retrait, { type: 'composant', support: 'z1', z: { composants: ['R1', 'R2'], montage: 'serie' } }, 4)
    expect(depot.session.platine.z1).toEqual(Z1_TP4)
    expect(depot.session.platine.z2).toEqual(Z2_TP4)
    expect(depot.session.evenementsSousTension).toHaveLength(2)
  })
  it('changer un composant après « Faire vérifier » redemande la vérification', () => {
    const e0: EtatBanc = { session: { ...sessionNeuve('libre'), cablage: [...PRESET_TP2], platine: { ...sessionNeuve('libre').platine, z1: Z1_TP4, z2: Z2_TP4 } }, montage: 'tp4', verdict: null, message: null }
    const e = reduire(reduire(reduire(e0, { type: 'faire-verifier' }, 1), { type: 'composant', support: 'z2', z: { composants: ['R2', 'C2'], montage: 'parallele' } }, 2), { type: 'interrupteur' }, 3)
    expect(e.session.platine.sousTension).toBe(false)
  })
  it('le banc sans bruit sert de référence (aucune valeur Matlab inventée)', () => expect(BANC_SANS_BRUIT.bruit).toBe(0))
})
