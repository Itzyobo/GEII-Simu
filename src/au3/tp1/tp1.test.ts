import { describe, expect, it } from 'vitest'
import { AU3_QUESTIONS } from '../../data/questions.au3'
import { AU3, au3, type RefKey } from '../../data/reference'
import { reduire, type Action, type EtatBanc } from '../banc'
import { badgeAffiche } from '../hypothese'
import { GBF_DEFAUT, periodeGbf, type ReglagesGbf } from '../instruments/gbf'
import { acquerir, exporterCsv, lireCsv, moyenner, planAcquisition, type Csv, type ReglagesOscillo } from '../instruments/oscillo'
import { sessionNeuve } from '../session'
import { PRESET_TP1, type Cablage } from '../sim/cablage'
import { BANC_REEL, simulate, vitesseAffichee, type Banc, type ReglagesPlatine } from '../sim/simulate'
import { lireAbaque, rapportT3T1, wnT3 } from './abaque'
import { noteTr5 } from './affichage'
import { attendusTp1, BANC_SANS_BRUIT, ecartTr5 } from './attendus'
import { corrigerAbaque, corrigerMesure } from './correction'
import { fenetreEchelon, identifier } from './identification'

// Tolérances du PRD (§6 étape 2 et prompt) : ne jamais les élargir
const tol = (k: RefKey) => AU3[k].tol!
const TOL_ABAQUE_COURBE = 0.005
const TOL_FIT_SANS_BRUIT = 0.02
const TOL_FIT_SYNTHETIQUE = 0.01
const TOL_FIT_BRUIT = 0.03
const TOL_SYMETRIE = 0.01
const TOL_ECART_POINTS = 0.01
const proche = (x: number, ref: number, t: number) => expect(Math.abs(x / ref - 1), `${x} vs ${ref}`).toBeLessThanOrEqual(t)

/** Créneau du CR : 12,3 Vpp, 1,3 Hz */
const GBF_CR: ReglagesGbf = { ...GBF_DEFAUT, forme: 'carre', frequence: au3('TP1_GBF_FREQ'), vpp: au3('CR_TP1_DU'), offset: 0 }
const A = attendusTp1(GBF_CR)

describe('TP1 : réponses attendues du modèle sans bruit, comparées au CR', () => {
  it('1. G0 = Δm/ΔU = 0,151 ±3 %', () => proche(A.g0, au3('CR_TP1_G0'), tol('CR_TP1_G0')))
  it('2. τ (63,2 %) = 11,8 ms ±5 %', () => proche(A.tau, au3('CR_TP1_TAU'), tol('CR_TP1_TAU')))
  it('3. t1 (26,4 %) = 5,2 ms ±5 % ; t3 (80,1 %) = 18 ms ±5 %', () => {
    proche(A.t1, au3('CR_TP1_T1'), tol('CR_TP1_T1'))
    proche(A.t3, au3('CR_TP1_T3'), tol('CR_TP1_T3'))
  })
  it('4. abaque : z = 1,22 ±5 % ; ωn = (ωn·t3)/t3 = 211,5 rad/s ±5 %', () => {
    const a = lireAbaque(A.t1, A.t3)!
    proche(a.z, au3('CR_TP1_Z'), tol('CR_TP1_Z'))
    proche(a.wn, au3('CR_TP1_WN'), tol('CR_TP1_WN'))
    expect(a.wn).toBeCloseTo(a.wnT3 / A.t3)
  })
  it('5. courbes de l’abaque : t3/t1(1) = 3,003 ; ωn·t3(1) = 3,001 ; t3/t1(1,22) = 3,438 (±0,5 %)', () => {
    proche(rapportT3T1(1), 3.003, TOL_ABAQUE_COURBE)
    proche(wnT3(1), 3.001, TOL_ABAQUE_COURBE)
    proche(rapportT3T1(1.22), 3.438, TOL_ABAQUE_COURBE)
  })
  it('6. TR5% du modèle = 30,7 ms ±5 % ; écart affiché au CR (33 ms) = −7 % ±1 point (écart connu, pas un test de conformité)', () => {
    const e = ecartTr5()
    proche(e.modele, 30.7e-3, tol('CR_TP1_TAU'))
    expect(Math.abs(e.ecart - -0.07)).toBeLessThanOrEqual(TOL_ECART_POINTS)
    expect(noteTr5(e)).toBe('modèle 30,7 ms ; CR 33 ms (−7 %) : la dérive lente en fin de courbe n’est pas modélisée')
  })
  it('règle du badge : chaque clé CR citée en « validee » est atteinte par le modèle dans sa tolérance', () => {
    const modele: Partial<Record<RefKey, number>> = { CR_TP1_DM: A.dm, CR_TP1_G0: A.g0, CR_TP1_TAU: A.tau, CR_TP1_T1: A.t1, CR_TP1_T3: A.t3, CR_TP1_Z: A.z!, CR_TP1_WN: A.wn! }
    for (const q of AU3_QUESTIONS.filter((x) => x.tp === 'tp1'))
      for (const k of q.validee) {
        expect(AU3[k].tol, `${q.id} : ${k} sans tolérance`).toBeDefined()
        expect(modele[k], `${q.id} : ${k} non calculé`).toBeDefined()
        proche(modele[k]!, au3(k), tol(k))
      }
  })
})

/* ───────────── Moindres carrés ───────────── */

const OSC: ReglagesOscillo = {
  voies: [2, 0.5, 5, 0.5].map((vdiv, j) => ({ active: j < 2, vdiv, position: 0, couplage: 'DC' as const })),
  sdiv: 5e-3,
  declenchement: { source: 0, front: 'montant', niveau: 0, mode: 'normal' },
  moyennage: 1,
  run: true,
}
const PLATINE: ReglagesPlatine = { sousTension: true, ampli: 'normal', g1: au3('TP2_K38_G1'), g2: au3('TP2_K38_G2'), z1: null, z2: null }

/** .csv exporté de l'oscilloscope après `n` acquisitions moyennées */
function csvTp1(banc: Banc, n: number): Csv {
  const plan = planAcquisition(OSC, periodeGbf(GBF_CR), banc.pas)
  const recs = Array.from({ length: n }, (_, g) => {
    const s = simulate(banc, { gbf: GBF_CR, platine: PLATINE, duree: plan.duree, pasSortie: plan.pasSortie }, PRESET_TP1, g + 1)
    return acquerir(OSC, { t: s.t, voies: [s.voie1, s.voie2, s.voie3, s.voie4] }, plan, 0)!
  })
  return lireCsv(exporterCsv(moyenner(recs)!))
}

describe('identification moindres carrés (Nelder–Mead)', () => {
  const zModele = (BANC_REEL.tauA + BANC_REEL.tauB) / (2 * Math.sqrt(BANC_REEL.tauA * BANC_REEL.tauB))
  const wnModele = 1 / Math.sqrt(BANC_REEL.tauA * BANC_REEL.tauB)
  const sansBruit = identifier(fenetreEchelon(csvTp1(BANC_SANS_BRUIT, 1))!, 2)

  it('7. ordre 2 sur le .csv sans bruit : z et ωn du modèle à ±2 %', () => {
    proche(sansBruit.z!, zModele, TOL_FIT_SANS_BRUIT)
    proche(sansBruit.wn!, wnModele, TOL_FIT_SANS_BRUIT)
  })

  it('8. ordre 1 sur une réponse d’ordre 1 pure (G0 = 0,151, τ = 11,8 ms) : retrouvés à ±1 %', () => {
    const g0 = 0.151
    const tau = 11.8e-3
    const du = 12.3
    const m0 = -0.9
    const t = Array.from({ length: 2000 }, (_, k) => -5e-3 + k * 25e-6)
    const csv: Csv = {
      entetes: [['x-axis', '1', '2'], ['second', 'Volt', 'Volt']],
      colonnes: [t, t.map((x) => (x < 0 ? -du / 2 : du / 2)), t.map((x) => (x < 0 ? m0 : m0 + g0 * du * (1 - Math.exp(-x / tau))))],
    }
    const r = identifier(fenetreEchelon(csv)!, 1)
    proche(r.g0, g0, TOL_FIT_SYNTHETIQUE)
    proche(r.tau!, tau, TOL_FIT_SYNTHETIQUE)
  })

  it('9. robustesse : .csv bruité (σ = 1 %, moyennage 16), ordre 2 → z et ωn à ±3 % du fit sans bruit', () => {
    const r = identifier(fenetreEchelon(csvTp1(BANC_REEL, 16))!, 2)
    proche(r.z!, sansBruit.z!, TOL_FIT_BRUIT)
    proche(r.wn!, sansBruit.wn!, TOL_FIT_BRUIT)
  })
})

describe('10. correction des réponses', () => {
  it('τ : 11,8 ms acceptée, 13 ms refusée, « 11,8 » sans unité incomplète ; z abaque : 1,30 accepté (±10 %), 1,40 refusé', () => {
    expect(corrigerMesure('11,8 ms', A.tau, 's').verdict).toBe('juste')
    expect(corrigerMesure('0.0118 s', A.tau, 's').verdict).toBe('juste')
    expect(corrigerMesure('13 ms', A.tau, 's').verdict).toBe('faux')
    expect(corrigerMesure('11,8', A.tau, 's').verdict).toBe('incomplete')
    expect(corrigerMesure('11,8 mV', A.tau, 's').verdict).toBe('faux')
    expect(corrigerAbaque('1,30', A.z!, '').verdict).toBe('juste')
    expect(corrigerAbaque('1,40', A.z!, '').verdict).toBe('faux')
  })
})

/* ───────────── Banc : exception de verrouillage, dissymétrie, animation ───────────── */

const T0 = 1_000
const suite = (e: EtatBanc, ...actions: Action[]) => actions.reduce((x, a, i) => reduire(x, a, T0 + i), e)
const banc = (): EtatBanc => ({ session: { ...sessionNeuve('libre'), cablage: [...PRESET_TP1] }, montage: 'tp1', verdict: null, message: null })

describe('11. ampli bloqué : seule exception au verrouillage sous tension', () => {
  it('séquence de l’énoncé → ampli débloqué, 0 événement « manip sous tension »', () => {
    let e = suite(banc(), { type: 'variante-ampli', etat: 'bloque-haut' }, { type: 'faire-verifier' }, { type: 'interrupteur' })
    expect(e.session.platine.ampli).toBe('bloque-haut')
    // Éteindre, relier l'entrée de l'ampli à la masse (extrémité GBF du câble 1 déplacée), rallumer
    e = suite(e, { type: 'interrupteur' }, { type: 'rebrancher', id: 'tp1-1', de: 'gbf.out', vers: 'plat.masse3' }, { type: 'interrupteur' })
    expect(e.session.platine.sousTension).toBe(true)
    expect(e.session.platine.ampli).toBe('reamorce-haut')
    // Remplacer la masse par le GBF sans éteindre
    e = suite(e, { type: 'rebrancher', id: 'tp1-1', de: 'plat.masse3', vers: 'gbf.out' })
    expect(e.session.platine.ampli).toBe('normal')
    expect(e.session.cablage.find((c) => c.id === 'tp1-1')).toMatchObject({ a: 'gbf.out', b: 'plat.ampliIn' })
    expect(e.session.evenementsSousTension).toEqual([])
    expect(e.message).toBeNull()
  })

  it('toute autre modification sous tension → refusée et journalisée', () => {
    const e0 = suite(banc(), { type: 'variante-ampli', etat: 'bloque-zero' }, { type: 'faire-verifier' }, { type: 'interrupteur' })
    const autres: Action[] = [
      { type: 'rebrancher', id: 'tp1-1', de: 'gbf.out', vers: 'plat.masse3' },
      { type: 'rebrancher', id: 'tp1-3', de: 'plat.masse1', vers: 'gbf.out' },
      { type: 'retirer-cable', id: 'tp1-1' },
      { type: 'ajouter-cable', a: 'plat.ampliIn', b: 'gbf.out', couleur: '#d62828' },
    ]
    for (const a of autres) {
      const e = suite(e0, a)
      expect(e.session.cablage).toEqual(e0.session.cablage)
      expect(e.session.evenementsSousTension).toHaveLength(1)
    }
    // Ampli normal : même l'opération de la procédure est refusée
    const normal = suite(banc(), { type: 'faire-verifier' }, { type: 'interrupteur' })
    const m = suite({ ...normal, session: { ...normal.session, cablage: normal.session.cablage.map((c) => (c.id === 'tp1-1' ? { ...c, a: 'plat.masse3' as const } : c)) } }, { type: 'rebrancher', id: 'tp1-1', de: 'plat.masse3', vers: 'gbf.out' })
    expect(m.session.evenementsSousTension).toHaveLength(1)
  })

  it('l’ampli bloqué colle la sortie à +USAT : le moteur tourne toujours dans le même sens', () => {
    const r = simulate(BANC_SANS_BRUIT, { gbf: GBF_CR, platine: { ...PLATINE, ampli: 'bloque-haut' }, duree: 1 / au3('TP1_GBF_FREQ'), pasSortie: BANC_REEL.pas * 10 }, PRESET_TP1, 0)
    expect(Math.min(...Array.from(r.vitesse.slice(r.vitesse.length / 2)))).toBeGreaterThan(0)
  })
})

describe('12. dissymétrie du GBF relié à la platine', () => {
  const paliers = (sousTension: boolean, cablage: Cablage = PRESET_TP1) => {
    const T = 1 / au3('TP1_GBF_FREQ')
    const r = simulate(BANC_SANS_BRUIT, { gbf: GBF_CR, platine: { ...PLATINE, sousTension }, duree: T, pasSortie: BANC_REEL.pas * 10 }, cablage, 0)
    return { haut: r.voie1[1]!, bas: r.voie1[r.voie1.length - 2]! }
  }
  it('platine éteinte : palier bas réduit de 20 % ; sous tension : symétrique à ±1 %', () => {
    const off = paliers(false)
    proche(-off.bas / off.haut, 1 - au3('GBF_DISSYMETRIE'), TOL_SYMETRIE)
    expect(1 - -off.bas / off.haut).toBeCloseTo(0.2)
    const on = paliers(true)
    proche(-on.bas / on.haut, 1, TOL_SYMETRIE)
  })
})

describe('13. animation : vitesse simulée', () => {
  const platine = { ...PLATINE }
  it('carré 2 Vpp (zone morte) → vitesse affichée nulle', () => {
    expect(vitesseAffichee(BANC_REEL, { gbf: { ...GBF_CR, vpp: 2 }, platine }, PRESET_TP1)).toBe(0)
  })
  it('masse du moteur absente → vitesse affichée nulle', () => {
    expect(vitesseAffichee(BANC_REEL, { gbf: GBF_CR, platine }, PRESET_TP1.filter((c) => c.id !== 'tp1-3'))).toBe(0)
  })
  it('montage TP1 sous tension → le moteur tourne ; platine éteinte → arrêt', () => {
    expect(vitesseAffichee(BANC_REEL, { gbf: GBF_CR, platine }, PRESET_TP1)).toBeGreaterThan(au3('VITESSE_ARRET'))
    expect(vitesseAffichee(BANC_REEL, { gbf: GBF_CR, platine: { ...platine, sousTension: false } }, PRESET_TP1)).toBe(0)
  })
})

describe('14. badges du TP1', () => {
  const q = (id: string) => AU3_QUESTIONS.find((x) => x.id === id)!
  it('TR5% a le badge ; τ, t1/t3, G0, z, ωn ne l’ont pas', () => {
    for (const id of ['tp1-i21-q4', 'tp1-i22-q4', 'tp1-sous-tension', 'tp1-reglages']) expect(badgeAffiche(q(id).cles, q(id).validee), id).toBe(true)
    for (const id of ['tp1-i21-q3', 'tp1-i22-q2', 'tp1-i22-q3', 'tp1-i21-g0', 'tp1-i22-q1', 'tp1-i21-q1']) expect(badgeAffiche(q(id).cles, q(id).validee), id).toBe(false)
  })
})
