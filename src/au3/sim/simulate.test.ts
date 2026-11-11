import { describe, expect, it } from 'vitest'
import { AU3, au3 } from '../../data/reference'
import { GBF_DEFAUT } from '../instruments/gbf'
import { PRESET_TP1, type Cablage } from './cablage'
import { BANC_REEL, simulate, type Banc, type ReglagesSim } from './simulate'

// Tolérances du PRD (§6, étape 1) : ne jamais les élargir
const TOL_DM = AU3.CR_TP1_DM.tol! // 3 %
const TOL_G0 = AU3.CR_TP1_G0.tol! // 3 %
const TOL_SYMETRIE = 0.01
const ZONE_MORTE_MAX = 0.01 // V
const TOL_CONVERGENCE = 0.005
const TOL_MOYENNE = 0.005
const F = au3('TP1_GBF_FREQ')
const T = 1 / F
const maxi = (x: ArrayLike<number>) => {
  let r = -Infinity
  for (let i = 0; i < x.length; i++) r = Math.max(r, x[i]!)
  return r
}
const mini = (x: ArrayLike<number>) => -maxi(Array.from(x, (v) => -v))
const SANS_BRUIT: Banc = { ...BANC_REEL, bruit: 0, ondulation: 0 }

const reglagesTp1 = (vpp: number, pasSortie = BANC_REEL.pas): ReglagesSim => ({
  gbf: { ...GBF_DEFAUT, forme: 'carre', frequence: F, vpp, offset: 0 },
  platine: { sousTension: true, g1: au3('TP2_K38_G1'), g2: au3('TP2_K38_G2'), z1: null, z2: null },
  // départ à l'arrêt : 1re période de mise en régime, front montant établi à t = T, palier haut jusqu'à 1,5 T
  duree: 1.5 * T,
  pasSortie,
})

/** Paliers et Δm du front montant à t = T (régime périodique établi) */
function analyseFront(t: Float64Array, m: Float64Array) {
  const dt = t[1]! - t[0]!
  const bas = m[Math.round(T / dt) - 1]!
  const haut = m[Math.round(1.5 * T / dt) - 1]!
  const dm = haut - bas
  // instant à 63 % de Δm, interpolé
  let t63 = NaN
  for (let i = Math.round(T / dt); i < m.length; i++) {
    const seuil = bas + 0.63 * dm
    if (m[i]! >= seuil) {
      t63 = t[i - 1]! + (dt * (seuil - m[i - 1]!)) / (m[i]! - m[i - 1]!) - T
      break
    }
  }
  return { bas, haut, dm, t63 }
}

describe('moteur + DT en boucle ouverte (TP1)', () => {
  const r = simulate(SANS_BRUIT, reglagesTp1(au3('CR_TP1_DU')), PRESET_TP1, 1)
  const a = analyseFront(r.t, r.voie2)

  it('1. carré 12,3 Vpp 1,3 Hz : Δm(∞) = 1,86 V ±3 % et G0 apparent = 0,151 ±3 %', () => {
    expect(r.topologie).toBe('boucle-ouverte')
    expect(Math.abs(a.dm / au3('CR_TP1_DM') - 1)).toBeLessThan(TOL_DM)
    expect(Math.abs(a.dm / au3('CR_TP1_DU') / au3('CR_TP1_G0') - 1)).toBeLessThan(TOL_G0)
  })

  it('2. paliers haut et bas symétriques à ±1 %', () => {
    expect(Math.abs(a.haut / -a.bas - 1)).toBeLessThan(TOL_SYMETRIE)
  })

  it('voie 1 = créneau du GBF (±6,15 V)', () => {
    expect(maxi(r.voie1)).toBeCloseTo(au3('CR_TP1_DU') / 2, 6)
    expect(mini(r.voie1)).toBeCloseTo(-au3('CR_TP1_DU') / 2, 6)
  })

  it('3. zone morte : carré 2 Vpp → |Δm| < 0,01 V', () => {
    const z = simulate(SANS_BRUIT, reglagesTp1(2), PRESET_TP1, 1)
    expect(maxi(z.vitesse) - mini(z.vitesse)).toBeLessThan(ZONE_MORTE_MAX)
  })

  it('4. convergence : un pas de 2,5 µs change Δm et l’instant à 63 % de moins de 0,5 %', () => {
    const fin = { ...SANS_BRUIT, pas: BANC_REEL.pas / 2 }
    const b = analyseFront(...((r2) => [r2.t, r2.voie2] as const)(simulate(fin, reglagesTp1(au3('CR_TP1_DU'), fin.pas), PRESET_TP1, 1)))
    expect(Math.abs(b.dm / a.dm - 1)).toBeLessThan(TOL_CONVERGENCE)
    expect(Math.abs(b.t63 / a.t63 - 1)).toBeLessThan(TOL_CONVERGENCE)
  })
})

describe('bruit à graine (mulberry32)', () => {
  const reg = reglagesTp1(au3('CR_TP1_DU'), BANC_REEL.pas * 4)
  const moyennePalier = (m: Float64Array, t: Float64Array) => {
    const dt = t[1]! - t[0]!
    const i0 = Math.round((1.25 * T) / dt)
    const i1 = Math.round((1.5 * T) / dt) - 1
    let s = 0
    for (let i = i0; i < i1; i++) s += m[i]!
    return s / (i1 - i0)
  }

  it('5. même graine → mêmes échantillons ; graine différente → bruit différent, même moyenne à ±0,5 %', () => {
    const a = simulate(BANC_REEL, reg, PRESET_TP1, 42)
    const b = simulate(BANC_REEL, reg, PRESET_TP1, 42)
    const c = simulate(BANC_REEL, reg, PRESET_TP1, 43)
    expect(b.voie2).toEqual(a.voie2)
    expect(c.voie2).not.toEqual(a.voie2)
    expect(Math.abs(moyennePalier(c.voie2, c.t) / moyennePalier(a.voie2, a.t) - 1)).toBeLessThan(TOL_MOYENNE)
  })
})

describe('défauts de câblage', () => {
  const k38: ReglagesSim = {
    gbf: { ...GBF_DEFAUT, forme: 'carre', frequence: au3('TP2_GBF_FREQ'), vpp: au3('TP2_K38_GBF_VPP'), offset: 0 },
    platine: { sousTension: true, g1: au3('TP2_K38_G1'), g2: au3('TP2_K38_G2'), z1: null, z2: null },
    duree: 1 / au3('TP2_GBF_FREQ'),
    pasSortie: BANC_REEL.pas * 10,
  }
  const boucle = (dt: 'normale' | 'inversee', moteur: 'ampli' | 'g2'): Cablage => [
    { id: '1', a: 'gbf.out', b: 'plat.consigne', couleur: '' },
    ...(moteur === 'ampli'
      ? [
          { id: '2', a: 'plat.sortieG2' as const, b: 'plat.ampliIn' as const, couleur: '' },
          { id: '3', a: 'plat.ampliOut' as const, b: 'mot.rouge' as const, couleur: '' },
        ]
      : [{ id: '3', a: 'plat.sortieG2' as const, b: 'mot.rouge' as const, couleur: '' }]),
    { id: '4', a: 'mot.noir', b: 'plat.masse1', couleur: '' },
    { id: '5', a: dt === 'normale' ? 'mot.verte' : 'mot.jaune', b: 'plat.mesure', couleur: '' },
    { id: '6', a: dt === 'normale' ? 'mot.jaune' : 'mot.verte', b: 'plat.masse2', couleur: '' },
    { id: '7', a: 'plat.sortieG2', b: 'osc.v3', couleur: '' },
  ]

  it('11. masse moteur absente → Δm < 0,01 V', () => {
    const r = simulate(SANS_BRUIT, reglagesTp1(au3('CR_TP1_DU'), BANC_REEL.pas * 10), PRESET_TP1.filter((c) => c.b !== 'plat.masse1'), 1)
    expect(maxi(r.vitesse) - mini(r.vitesse)).toBeLessThan(ZONE_MORTE_MAX)
    expect(r.evenements.some((e) => e.code === 'masse-moteur-absente')).toBe(true)
  })

  it('11. sortie G2 directement sur le moteur → courant limité à 25 mA, moteur immobile, U écrêtée', () => {
    const r = simulate(SANS_BRUIT, k38, boucle('normale', 'g2'), 1)
    expect(maxi(r.vitesse) - mini(r.vitesse)).toBeLessThan(ZONE_MORTE_MAX)
    expect(r.evenements.some((e) => e.code === 'ampli-oublie')).toBe(true)
    expect(maxi(r.voie3)).toBeCloseTo(au3('IMAX_SORTIE_G2') * au3('R_INDUIT'), 9)
  })

  it('boucle fermée K = 3,8 câblée correctement → topologie boucle fermée', () => {
    expect(simulate(SANS_BRUIT, k38, boucle('normale', 'ampli'), 1).topologie).toBe('boucle-fermee')
  })

  it('DT inversée en boucle fermée → divergence, sortie G2 saturée à ±USAT', () => {
    const r = simulate(SANS_BRUIT, k38, boucle('inversee', 'ampli'), 1)
    expect(r.evenements.some((e) => e.code === 'dt-inversee')).toBe(true)
    expect(r.evenements.some((e) => e.code === 'saturation-g2')).toBe(true)
    expect(maxi(r.commande.map(Math.abs))).toBeCloseTo(au3('USAT'), 9)
  })

  it('DT jaune non reliée → voie 2 flottante (50 Hz, moyenne nulle)', () => {
    const r = simulate(SANS_BRUIT, reglagesTp1(au3('CR_TP1_DU'), BANC_REEL.pas * 10), PRESET_TP1.filter((c) => c.a !== 'mot.jaune'), 1)
    const moy = r.voie2.reduce((s, v) => s + v, 0) / r.voie2.length
    expect(r.evenements.some((e) => e.code === 'dt-flottante')).toBe(true)
    expect(Math.abs(moy)).toBeLessThan(au3('FLOTTANT_AMPLITUDE') / 10)
    expect(maxi(r.voie2)).toBeGreaterThan(au3('FLOTTANT_AMPLITUDE') / 2)
  })
})
