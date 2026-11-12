import { describe, expect, it } from 'vitest'
import enonce from '../../../docs/au3/enonce.md?raw'
import { AU3_QUESTIONS } from '../../data/questions.au3'
import { AU3, au3, type RefKey } from '../../data/reference'
import { reduire, type Action, type EtatBanc } from '../banc'
import { badgeAffiche } from '../hypothese'
import { GBF_DEFAUT, periodeGbf } from '../instruments/gbf'
import { acquerir, exporterCsv, lireCsv, planAcquisition, type ReglagesOscillo } from '../instruments/oscillo'
import { chargerSession, cleSession, progressionNeuve, sessionNeuve, SESSION_VERSION } from '../session'
import { inverserDt, massesNonNoires, MONTAGE_TP2, oublierAmpli, PRESET_TP1, PRESET_TP2, verifier } from '../sim/cablage'
import { gainAffichage } from '../sim/regulateur'
import { BANC_REEL, simulate } from '../sim/simulate'
import { noteTr5 } from '../tp1/affichage'
import { attendusTp1, BANC_SANS_BRUIT } from '../tp1/attendus'
import { fenetreEchelon, identifier } from '../tp1/identification'
import { attenduQ12, attendusTp2, CABLAGE_TP2, courbeBf, ecartTr5b, essaiK38, essaiK40, Q12_NON_NEGLIGEABLE, Q12_SANS_OBJET, theoriqueBf, type ReglagesEssai } from './attendus'
import { CONSEIL_FORMULE, corrigerFormule } from './correction'

// Tolérances du PRD (§6 étape 3) : ne jamais les élargir
const tol = (k: RefKey) => AU3[k].tol!
const TOL_FIT = 0.02
const TOL_TAU_Q12 = 0.02
const TOL_ECART_POINTS = 0.01
const TOL_PLAFOND = 0.005
const MAX_DIVERGENCE = 50e-3
const ZONE_MORTE = 0.01
const DUREE_PLATEAU = 0.5e-3
const D1_FAIBLE = 0.05
const proche = (x: number, ref: number, t: number) => expect(Math.abs(x / ref - 1), `${x} vs ${ref}`).toBeLessThanOrEqual(t)

const A38 = attendusTp2(essaiK38(au3('CR_TP2K38_C0')))
const A40 = attendusTp2(essaiK40(au3('CR_TP2K40_C0')))

describe('TP2, K = 3,8 (créneau 3,26 Vpp, 2 Hz)', () => {
  it('1. G0b = 0,34 ±3 %', () => proche(A38.g0b, au3('CR_TP2K38_G0B'), tol('CR_TP2K38_G0B')))
  it('2. t1 = 3,5 ms ±5 % ; t3 = 10 ms ±5 %', () => {
    proche(A38.t1, au3('CR_TP2K38_T1'), tol('CR_TP2K38_T1'))
    proche(A38.t3, au3('CR_TP2K38_T3'), tol('CR_TP2K38_T3'))
  })
  it('3. zb (abaque) = 0,90 ±5 % ; ωnb (abaque, via t3) = 274,3 rad/s ±5 %', () => {
    proche(A38.zbAbaque!, au3('CR_TP2K38_ZB'), tol('CR_TP2K38_ZB'))
    proche(A38.wnbAbaque!, au3('CR_TP2K38_WNB'), tol('CR_TP2K38_WNB'))
  })
  it('4. U max (voie 3) = 8,04 V ±5 %', () => proche(A38.umax, au3('CR_TP2K38_UMAX'), tol('CR_TP2K38_UMAX')))
})

describe('TP2, K = 40 (créneau 0,295 Vpp, 2 Hz)', () => {
  it('5. G0b = 0,69 ±3 %', () => proche(A40.g0b, au3('CR_TP2K40_G0B'), tol('CR_TP2K40_G0B')))
  it('6. D1/m(∞) = 0,25 ±10 % ; Tpb/2 = 5,7 ms ±5 %', () => {
    proche(A40.d1rel, au3('CR_TP2K40_D1'), tol('CR_TP2K40_D1'))
    proche(A40.tpb2, au3('CR_TP2K40_TPB_2'), tol('CR_TP2K40_TPB_2'))
  })
  it('7. zb (formule) = 0,42 ±5 % ; ωnb (formule) = 607,3 rad/s ±5 %', () => {
    expect(A40.zbFormule).toBeCloseTo(-Math.log(A40.d1rel) / Math.sqrt(Math.PI ** 2 + Math.log(A40.d1rel) ** 2), 12)
    expect(A40.wnbFormule).toBeCloseTo((2 * Math.PI) / (2 * A40.tpb2 * Math.sqrt(1 - A40.zbFormule! ** 2)), 9)
    proche(A40.zbFormule!, au3('CR_TP2K40_ZB'), tol('CR_TP2K40_ZB'))
    proche(A40.wnbFormule!, au3('CR_TP2K40_WNB'), tol('CR_TP2K40_WNB'))
  })
  it('8. U max = 9,54 V ±5 % ; pas de saturation (U max < 10,6 V)', () => {
    proche(A40.umax, au3('CR_TP2K40_UMAX'), tol('CR_TP2K40_UMAX'))
    expect(A40.umax).toBeLessThan(au3('USAT'))
  })
  it('9. TR5%b du modèle : 15,3 ms ±5 % et 12,2 ms ±5 % ; écarts au CR −10 % et −12 % (±1 point), affichés', () => {
    const e38 = ecartTr5b('k38')
    const e40 = ecartTr5b('k40')
    proche(e38.modele, 15.3e-3, tol('CR_TP2K38_T1'))
    proche(e40.modele, 12.2e-3, tol('CR_TP2K38_T1'))
    expect(Math.abs(e38.ecart - -0.1)).toBeLessThanOrEqual(TOL_ECART_POINTS)
    expect(Math.abs(e40.ecart - -0.12)).toBeLessThanOrEqual(TOL_ECART_POINTS)
    expect(noteTr5(e38, 'dérive lente non modélisée')).toBe('modèle 15,3 ms ; CR 17 ms (−10 %) : dérive lente non modélisée')
    expect(noteTr5(e40, 'm(∞) lu avant stabilisation dans le CR')).toMatch(/^modèle 12,\d ms ; CR 13,8 ms \(−1[12] %\) : m\(∞\) lu avant stabilisation dans le CR$/)
  })
  it('règle du badge : chaque clé CR « validee » du TP2 est atteinte par le modèle dans sa tolérance', () => {
    const modele: Partial<Record<RefKey, number>> = {
      CR_TP2K38_G0B: A38.g0b, CR_TP2K38_T1: A38.t1, CR_TP2K38_T3: A38.t3, CR_TP2K38_ZB: A38.zbAbaque!, CR_TP2K38_WNB: A38.wnbAbaque!, CR_TP2K38_UMAX: A38.umax,
      CR_TP2K40_G0B: A40.g0b, CR_TP2K40_D1: A40.d1rel, CR_TP2K40_TPB_2: A40.tpb2, CR_TP2K40_ZB: A40.zbFormule!, CR_TP2K40_WNB: A40.wnbFormule!, CR_TP2K40_UMAX: A40.umax,
    }
    const tp1 = attendusTp1({ ...GBF_DEFAUT, vpp: au3('CR_TP1_DU') })
    Object.assign(modele, { CR_TP1_G0: tp1.g0, CR_TP1_Z: tp1.z!, CR_TP1_WN: tp1.wn! })
    for (const q of AU3_QUESTIONS.filter((x) => x.tp === 'tp2'))
      for (const k of q.validee) {
        expect(AU3[k].tol, `${q.id} : ${k}`).toBeDefined()
        expect(modele[k], `${q.id} : ${k} non calculé`).toBeDefined()
        proche(modele[k]!, au3(k), tol(k))
      }
  })
})

describe('10. valeurs théoriques (I.1.1 Q8) avec les valeurs attendues du TP1', () => {
  it('G0b = KG0/(1+KG0), zb = z/√(1+KG0), ωnb = ωn√(1+KG0), recalculés depuis reference', () => {
    const t = attendusTp1({ ...GBF_DEFAUT, frequence: au3('TP1_GBF_FREQ'), vpp: au3('TP1_GBF_VPP') })
    const K = (au3('TP2_K38_G1') * au3('TP2_K38_G2')) / au3('K_P_DIVISEUR')
    const r = theoriqueBf(gainAffichage(au3('TP2_K38_G1'), au3('TP2_K38_G2')), t.g0, t.z!, t.wn!)
    expect(r.g0b).toBeCloseTo((K * t.g0) / (1 + K * t.g0), 12)
    expect(r.zb).toBeCloseTo(t.z! / Math.sqrt(1 + K * t.g0), 12)
    expect(r.wnb).toBeCloseTo(t.wn! * Math.sqrt(1 + K * t.g0), 9)
  })
})

/* ───────────── 11. moindres carrés sur le .csv sans bruit ───────────── */

function csvBf(e: ReglagesEssai, vdiv: [number, number]) {
  const osc: ReglagesOscillo = {
    voies: [vdiv[0], vdiv[1], 5, 0.5].map((v, j) => ({ active: j < 2, vdiv: v, position: 0, couplage: 'DC' as const })),
    sdiv: 5e-3,
    declenchement: { source: 0, front: 'montant', niveau: 0, mode: 'normal' },
    moyennage: 1,
    run: true,
  }
  const plan = planAcquisition(osc, periodeGbf(e.gbf), BANC_SANS_BRUIT.pas)
  const s = simulate(BANC_SANS_BRUIT, { gbf: e.gbf, platine: { sousTension: true, ampli: 'normal', g1: e.g1, g2: e.g2, z1: null, z2: null }, duree: plan.duree, pasSortie: plan.pasSortie }, CABLAGE_TP2, 1)
  return lireCsv(exporterCsv(acquerir(osc, { t: s.t, voies: [s.voie1, s.voie2, s.voie3, s.voie4] }, plan, 0)!))
}

describe('11. fit ordre 2 sur le .csv sans bruit : zb et ωnb du modèle à ±2 %', () => {
  const { tauA, tauB, g0r } = BANC_REEL
  const bf = (K: number) => ({ zb: (tauA + tauB) / (2 * Math.sqrt(tauA * tauB * (1 + K * g0r))), wnb: Math.sqrt((1 + K * g0r) / (tauA * tauB)) })
  it('K = 3,8', () => {
    const r = identifier(fenetreEchelon(csvBf(essaiK38(au3('CR_TP2K38_C0')), [0.5, 0.2]))!, 2)
    const m = bf(gainAffichage(au3('TP2_K38_G1'), au3('TP2_K38_G2')))
    proche(r.z!, m.zb, TOL_FIT)
    proche(r.wn!, m.wnb, TOL_FIT)
  })
  it('K = 40', () => {
    const r = identifier(fenetreEchelon(csvBf(essaiK40(au3('CR_TP2K40_C0')), [0.05, 0.05]))!, 2)
    const m = bf(gainAffichage(au3('TP2_K40_G1'), au3('TP2_K40_G2')))
    proche(r.z!, m.zb, TOL_FIT)
    proche(r.wn!, m.wnb, TOL_FIT)
  })
})

describe('12. I.1.2 Q12 selon le zb du fit de l’étudiant', () => {
  it('zb = 0,92 → sans objet ; zb = 1,01, ωnb = 297,6 → τ1 = 2,92 ms, τ2 = 3,87 ms (±2 %), non négligeable', () => {
    expect(attenduQ12(0.92, 272).choix).toBe(Q12_SANS_OBJET)
    const r = attenduQ12(au3('CR_TP2K38_MATLAB_ZB'), au3('CR_TP2K38_MATLAB_WNB'))
    expect(r.choix).toBe(Q12_NON_NEGLIGEABLE)
    proche(r.tau1!, 2.92e-3, TOL_TAU_Q12)
    proche(r.tau2!, 3.87e-3, TOL_TAU_Q12)
  })
  it('zb à K = 40 : formule ou abaque (énoncé) ; une lecture d’abaque à +8 % est acceptée, avec le conseil « la formule est plus précise »', () => {
    const exacte = corrigerFormule(String(A40.zbFormule!).replace('.', ','), A40.zbFormule!)
    expect(exacte.verdict).toBe('juste')
    expect(exacte.message).not.toContain(CONSEIL_FORMULE)
    const abaque = corrigerFormule(String(A40.zbFormule! * 1.08).replace('.', ','), A40.zbFormule!)
    expect(abaque.verdict).toBe('juste')
    expect(abaque.message).toContain(CONSEIL_FORMULE)
    expect(corrigerFormule(String(A40.zbFormule! * 1.12).replace('.', ','), A40.zbFormule!).verdict).toBe('faux')
  })
})

describe('variantes d’erreur (câblage réel de l’étudiant)', () => {
  const T = 1 / au3('TP2_GBF_FREQ')
  const sim = (e: ReglagesEssai, cablage = CABLAGE_TP2) => simulate(BANC_SANS_BRUIT, { gbf: e.gbf, platine: { sousTension: true, ampli: 'normal', g1: e.g1, g2: e.g2, z1: null, z2: null }, duree: T, pasSortie: BANC_REEL.pas }, cablage, 0)

  it('13. DT inversée en boucle fermée : |U| = 10,6 V en moins de 50 ms', () => {
    const r = sim(essaiK38(au3('CR_TP2K38_C0')), inverserDt(CABLAGE_TP2))
    const i = r.voie3.findIndex((u) => Math.abs(u) >= au3('USAT'))
    expect(i).toBeGreaterThan(0)
    expect(r.t[i]!).toBeLessThan(MAX_DIVERGENCE)
  })

  it('14. ampli oublié : Δm < 0,01 V ; |voie 3| ≤ USAT ; la mesure reste nulle', () => {
    const r = sim(essaiK38(au3('CR_TP2K38_C0')), oublierAmpli(CABLAGE_TP2))
    expect(Math.max(...r.vitesse) - Math.min(...r.vitesse)).toBeLessThan(ZONE_MORTE)
    expect(Math.max(...Array.from(r.voie3, Math.abs))).toBeLessThanOrEqual(au3('USAT'))
    expect(Math.max(...Array.from(r.voie2, Math.abs))).toBe(0)
  })

  /** Une simulation du palier haut avec la saturation réelle, une sans (USAT infini) : jamais de valeur de comparaison en dur */
  const avecEtSans = (vpp: number) => [attendusTp2(essaiK40(vpp)), attendusTp2(essaiK40(vpp), { ...BANC_SANS_BRUIT, usat: Infinity })] as const

  it('15(a). K = 40, 0,4 Vpp : voie 3 à 10,6 V ±0,5 % pendant au moins 0,5 ms ; D1/m(∞) saturé < linéaire ; Tpb/2 saturé > linéaire', () => {
    const { r, iFront, iFin } = courbeBf(essaiK40(0.4))
    let plateau = 0
    let plusLong = 0
    for (let i = iFront; i <= iFin; i++) {
      plateau = Math.abs(Math.abs(r.voie3[i]!) / au3('USAT') - 1) <= TOL_PLAFOND ? plateau + 1 : 0
      plusLong = Math.max(plusLong, plateau)
    }
    expect(plusLong * BANC_SANS_BRUIT.pas).toBeGreaterThanOrEqual(DUREE_PLATEAU)
    const [sature, lineaire] = avecEtSans(0.4)
    expect(sature.d1rel).toBeLessThan(lineaire.d1rel)
    expect(sature.tpb2).toBeGreaterThan(lineaire.tpb2)
  })

  it('15(b). K = 40, 3,26 Vpp (amplitude du K = 3,8 non changée) : D1/m(∞) < 5 % ; TR5%b plus grand que le cas linéaire à 0,295 Vpp', () => {
    const [fort] = avecEtSans(au3('CR_TP2K38_C0'))
    const [, lineaire] = avecEtSans(au3('CR_TP2K40_C0'))
    expect(fort.d1rel).toBeLessThan(D1_FAIBLE)
    expect(fort.tr5).toBeGreaterThan(lineaire.tr5)
  })

  it('15(c). K = 40, 0,295 Vpp : pas de saturation', () => {
    expect(courbeBf(essaiK40(au3('CR_TP2K40_C0'))).r.evenements.some((e) => e.code === 'saturation-g2')).toBe(false)
  })
})

describe('16. câblage du TP2', () => {
  it('les 9 liaisons de l’énoncé (1 à 6, 8 à 10) → « Faire vérifier » 9/9 ; liaison 6 non noire signalée', () => {
    expect(MONTAGE_TP2.map((l) => l.nom.split('.')[0])).toEqual(['1', '2', '3', '4', '5', '6', '8', '9', '10'])
    const v = verifier(PRESET_TP2, MONTAGE_TP2)
    expect([v.correctes.length, v.total]).toEqual([9, 9])
    expect(v.massesNonNoires).toEqual([])
    const rouge = PRESET_TP2.map((c) => (c.id === 'tp2-6' ? { ...c, couleur: '#d62828' } : c))
    expect(massesNonNoires(rouge).map((c) => c.id)).toEqual(['tp2-6'])
  })
  it('chaque liaison reprend le texte de l’énoncé ; aucune ne relie la consigne à la voie 1', () => {
    const n = (s: string) => s.replace(/\s+/g, ' ')
    for (const l of MONTAGE_TP2) expect(n(enonce)).toContain(n(l.nom))
    expect(MONTAGE_TP2.some((l) => [l.a, l.b].includes('osc.v1'))).toBe(false)
  })
})

/* ───────────── 17. Corrections de l'étape 2 ───────────── */

const T0 = 1_000
const suite = (e: EtatBanc, ...actions: Action[]) => actions.reduce((x, a, i) => reduire(x, a, T0 + i), e)
const tp1 = (): EtatBanc => ({ session: { ...sessionNeuve('libre'), cablage: [...PRESET_TP1] }, montage: 'tp1', verdict: null, message: null })
/** Ampli bloqué, vérifié 6/6, éteint, entrée ampli mise à la masse */
const procedure = (...apres: Action[]) =>
  suite(tp1(), { type: 'variante-ampli', etat: 'bloque-haut' }, { type: 'faire-verifier' }, { type: 'interrupteur' }, { type: 'interrupteur' }, { type: 'rebrancher', id: 'tp1-1', de: 'gbf.out', vers: 'plat.masse3' }, ...apres, { type: 'interrupteur' })

describe('17. corrections de l’étape 2', () => {
  it('1(a) procédure exacte → rallumage permis sans nouvelle vérification', () => {
    const e = procedure()
    expect(e.session.platine.sousTension).toBe(true)
    expect(e.session.platine.ampli).toBe('reamorce-haut')
  })
  it('1(b) procédure + une liaison voie 1 déplacée → rallumage refusé', () => {
    const e = procedure({ type: 'rebrancher', id: 'tp1-6', de: 'osc.v1', vers: 'osc.v3' })
    expect(e.session.platine.sousTension).toBe(false)
  })
  it('1(c) ampli non bloqué + entrée ampli à la masse → rallumage refusé', () => {
    const e = suite(tp1(), { type: 'faire-verifier' }, { type: 'rebrancher', id: 'tp1-1', de: 'gbf.out', vers: 'plat.masse3' }, { type: 'interrupteur' })
    expect(e.session.platine.sousTension).toBe(false)
  })
  it('1 : une vérification ratée ne sert pas de référence à la procédure', () => {
    const e = suite(
      { ...tp1(), session: { ...tp1().session, cablage: PRESET_TP1.filter((c) => c.id !== 'tp1-6') } },
      { type: 'variante-ampli', etat: 'bloque-haut' },
      { type: 'faire-verifier' },
      { type: 'rebrancher', id: 'tp1-1', de: 'gbf.out', vers: 'plat.masse3' },
      { type: 'interrupteur' },
    )
    expect(e.session.platine.sousTension).toBe(false)
  })
  it('2. badges TP1 : I.2.3 Q2 (ordre 2) sans badge, Q12 (ordre 1) avec badge', () => {
    const q = (id: string) => AU3_QUESTIONS.find((x) => x.id === id)!
    expect(badgeAffiche(q('tp1-i23-o2-q2').cles, q('tp1-i23-o2-q2').validee)).toBe(false)
    expect(badgeAffiche(q('tp1-i23-q12').cles, q('tp1-i23-q12').validee)).toBe(true)
  })
  it('3. une session v2 du TP1 est migrée en v3 : réponses, câblage et progression identiques', () => {
    const m = new Map<string, string>()
    const st = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
    const { verifieReussiSur: _a, tp2: _b, ...base } = sessionNeuve('libre')
    void _a
    void _b
    const v2 = { ...base, version: 2, reponses: { 'tp1-i21-q3': { valeur: '12,2 ms', essais: 1 } }, cablage: [...PRESET_TP1], tp1: { ...progressionNeuve(), croixT3T1: { z: 1.2, y: 3.4 }, methodeWn: 't3' as const } }
    st.setItem(cleSession('libre', 'tp1'), JSON.stringify(v2))
    const s = chargerSession(st, 'libre', 'tp1')!
    expect(SESSION_VERSION).toBe(3)
    expect(s.version).toBe(SESSION_VERSION)
    expect(s.reponses).toEqual(v2.reponses)
    expect(s.cablage).toEqual(v2.cablage)
    expect(s.tp1).toEqual(v2.tp1)
    expect(s.verifieReussiSur).toBeNull()
    expect(s.tp2).toEqual({ k38: progressionNeuve(), k40: progressionNeuve() })
  })
  it('3. une session v1 est migrée jusqu’en v3 (ampli normal, progressions neuves)', () => {
    const m = new Map<string, string>()
    const st = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
    const { tp1: _t, tp2: _u, verifieReussiSur: _v, ...base } = sessionNeuve('libre')
    void [_t, _u, _v]
    const { ampli: _w, ...platine } = base.platine
    void _w
    st.setItem(cleSession('libre'), JSON.stringify({ ...base, version: 1, platine }))
    const s = chargerSession(st, 'libre')!
    expect(s.platine.ampli).toBe('normal')
    expect(s.tp1).toEqual(progressionNeuve())
  })
})

describe('18. badges du TP2', () => {
  const q = (id: string) => AU3_QUESTIONS.find((x) => x.id === id)!
  it('TR5%b (K = 3,8 et K = 40) avec badge ; G0b, t1/t3, zb, ωnb, D1, Tpb/2 sans badge', () => {
    for (const id of ['tp2-i11-q10', 'tp2-i21-q12', 'tp2-comparaison-tr5']) expect(badgeAffiche(q(id).cles, q(id).validee), id).toBe(true)
    for (const id of ['tp2-i11-q4', 'tp2-i21-q4', 'tp2-i11-q6', 'tp2-i11-q7', 'tp2-i21-q6', 'tp2-i21-q8', 'tp2-i21-q9', 'tp2-i21-q10']) expect(badgeAffiche(q(id).cles, q(id).validee), id).toBe(false)
  })
  it('les questions des TP1 et TP2 suivent l’ordre des ancres de l’énoncé', () => {
    for (const tp of ['tp1', 'tp2']) {
      const pos = AU3_QUESTIONS.filter((x) => x.tp === tp).map((x) => enonce.indexOf(`<a id="${x.id}"></a>`))
      expect(pos.every((p) => p >= 0)).toBe(true)
      expect(pos).toEqual([...pos].sort((a, b) => a - b))
    }
  })
})
