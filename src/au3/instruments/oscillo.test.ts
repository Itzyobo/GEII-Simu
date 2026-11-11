import { describe, expect, it } from 'vitest'
import { au3 } from '../../data/reference'
import { MISE_EN_PAGE } from '../miseEnPage'
import { sessionNeuve } from '../session'
import { PRESET_TP1 } from '../sim/cablage'
import { BANC_REEL, simulate, type Banc, type ReglagesPlatine } from '../sim/simulate'
import { GBF_DEFAUT, periodeGbf } from './gbf'
import {
  acquerir,
  exporterCsv,
  lireCsv,
  lireCurseurs,
  moyenner,
  pasQuantif,
  planAcquisition,
  pxVersTemps,
  pxVersTension,
  quantifier,
  tempsVersPx,
  tensionVersPx,
  type Enregistrement,
  type ReglagesOscillo,
} from './oscillo'

const O = { divX: au3('OSC_DIV_X'), divY: au3('OSC_DIV_Y'), refGaucheDiv: au3('OSC_REF_GAUCHE_DIV'), points: au3('OSC_POINTS'), pxParDiv: MISE_EN_PAGE.oscillo.pxParDiv }
// Tolérances du PRD : ne jamais les élargir
const TOL_MOYENNAGE = 0.1
const TOL_CONVERSION = 0.005
const TOL_QUANTIF = 0.01
const TOL_CSV = 1e-7

const gbfTp1 = { ...GBF_DEFAUT, forme: 'carre' as const, frequence: au3('TP1_GBF_FREQ'), vpp: au3('CR_TP1_DU'), offset: 0 }
const platine: ReglagesPlatine = { sousTension: true, ampli: 'normal', g1: au3('TP2_K38_G1'), g2: au3('TP2_K38_G2'), z1: null, z2: null }

/** Une acquisition complète du TP1 (simulation + oscilloscope) pour une graine */
function acquisition(osc: ReglagesOscillo, banc: Banc, graine: number): Enregistrement {
  const plan = planAcquisition(osc, periodeGbf(gbfTp1), banc.pas)
  const s = simulate(banc, { gbf: gbfTp1, platine, duree: plan.duree, pasSortie: plan.pasSortie }, PRESET_TP1, graine)
  const rec = acquerir(osc, { t: s.t, voies: [s.voie1, s.voie2, s.voie3, s.voie4] }, plan, 0)
  if (!rec) throw new Error('pas de déclenchement')
  return rec
}

const ecartType = (x: number[]) => {
  const m = x.reduce((a, b) => a + b, 0) / x.length
  return Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / x.length)
}

describe('oscilloscope DSOX2004A', () => {
  it('déclenche sur le front montant de la voie 1 : créneau jaune à 1 division du bord gauche, réponse verte', () => {
    const osc = sessionNeuve('libre').oscillo
    const rec = acquisition(osc, { ...BANC_REEL, bruit: 0, ondulation: 0 }, 1)
    const i0 = O.refGaucheDiv * (O.points / O.divX)
    expect(rec.declenche).toBe(true)
    expect(rec.voies[0]![i0 - 1]!).toBeLessThan(0)
    expect(rec.voies[0]![i0 + 1]!).toBeGreaterThan(0)
    expect(rec.voies[1]![O.points - 1]!).toBeGreaterThan(rec.voies[1]![i0]!)
  })

  it('6. moyennage 16 : écart-type du bruit sur le palier divisé par 4 ±10 %', () => {
    // Palier haut (≈ +0,93 V) zoomé : 0,1 V/div, 0 V décalé de 9,3 divisions ; base de temps 50 ms/div
    const vdiv = 0.1
    const centre = 0.93
    const osc: ReglagesOscillo = {
      ...sessionNeuve('libre').oscillo,
      sdiv: 50e-3,
      voies: sessionNeuve('libre').oscillo.voies.map((v, j) => ({ ...v, active: j < 2, ...(j === 1 ? { vdiv, position: -centre / vdiv } : {}) })),
    }
    const banc = { ...BANC_REEL, ondulation: 0 } // bruit aléatoire seul (PRD §4.4)
    const reference = acquisition(osc, { ...banc, bruit: 0 }, 0)
    const palier = (r: Enregistrement) => {
      const out: number[] = []
      r.voies[1]!.forEach((v, k) => {
        const t = r.t0 + k * r.dt
        if (t > 0.15 && t < 0.37) out.push(v - reference.voies[1]![k]!)
      })
      return out
    }
    const graines = Array.from({ length: 16 }, (_, k) => k + 100)
    const seule = ecartType(palier(acquisition(osc, banc, graines[0]!)))
    const moyenne = ecartType(palier(moyenner(graines.map((g) => acquisition(osc, banc, g)))!))
    expect(Math.abs(seule / moyenne / 4 - 1)).toBeLessThan(TOL_MOYENNAGE)
  })

  it('7. curseurs : ΔX et ΔY exacts au pixel près ; conversion pixel → unité à ±0,5 % pour 3 calibres', () => {
    const osc = sessionNeuve('libre').oscillo
    for (const [sdiv, vdiv] of [
      [1e-3, 0.5],
      [5e-3, 1],
      [20e-3, 2],
    ] as const) {
      const reg = { ...osc, sdiv, voies: osc.voies.map((v) => ({ ...v, vdiv })) }
      const c = { x1: 73, x2: 73 + 3 * O.pxParDiv, y1: 40, y2: 40 + 5 * O.pxParDiv, source: 0, suivre: false }
      const l = lireCurseurs(c, reg, null)
      expect(l.dx).toBeCloseTo(3 * sdiv, 12)
      expect(l.dy).toBeCloseTo(-5 * vdiv, 12)
      expect(l.invDx).toBeCloseTo(1 / (3 * sdiv), 6)
      // une grandeur quelconque placée au pixel le plus proche est relue à ±0,5 %
      const t = 7.3 * sdiv
      const v = 3.1 * vdiv
      expect(Math.abs(pxVersTemps(Math.round(tempsVersPx(t, sdiv)), sdiv) / t - 1)).toBeLessThan(TOL_CONVERSION)
      expect(Math.abs(pxVersTension(Math.round(tensionVersPx(v, vdiv, 0)), vdiv, 0) / v - 1)).toBeLessThan(TOL_CONVERSION)
    }
  })

  it('curseurs en mode « suivre signal » : Y1 et Y2 lisent la trace aux instants X1 et X2', () => {
    const osc = sessionNeuve('libre').oscillo
    const rec = acquisition(osc, { ...BANC_REEL, bruit: 0, ondulation: 0 }, 1)
    const l = lireCurseurs({ x1: O.refGaucheDiv * O.pxParDiv, x2: O.divX * O.pxParDiv - 1, y1: 0, y2: 0, source: 1, suivre: true }, osc, rec)
    expect(l.y1).not.toBeNull()
    expect(l.dy!).toBeGreaterThan(au3('CR_TP1_DM') / 2)
  })

  it('8. quantification : à 2 V/div le pas vaut 16 V / 256 ±1 % ; une trace hors écran est écrêtée', () => {
    const vdiv = 2
    expect(Math.abs(pasQuantif(vdiv) / (16 / 256) - 1)).toBeLessThan(TOL_QUANTIF)
    const q = pasQuantif(vdiv)
    const lu = quantifier(1.234, vdiv, 0)
    expect(Math.abs(lu - 1.234)).toBeLessThanOrEqual(q / 2 + 1e-12)
    expect(Math.abs((lu + O.divY / 2 * vdiv) / q - Math.round((lu + O.divY / 2 * vdiv) / q))).toBeLessThan(1e-9)
    expect(quantifier(100, vdiv, 0)).toBe((O.divY / 2) * vdiv)
    expect(quantifier(-100, vdiv, 0)).toBe((-O.divY / 2) * vdiv)
  })

  it('9. export .csv relu par le parseur : en-têtes et valeurs identiques', () => {
    const osc = sessionNeuve('libre').oscillo
    const rec = acquisition(osc, BANC_REEL, 3)
    const actives = { ...rec, voies: rec.voies.map((v, j) => (j < 2 ? v : null)) }
    const csv = exporterCsv(actives)
    const lu = lireCsv(csv)
    expect(lu.entetes).toEqual([
      ['x-axis', '1', '2'],
      ['second', 'Volt', 'Volt'],
    ])
    expect(lu.colonnes[0]!.length).toBe(O.points)
    lu.colonnes[0]!.forEach((t, k) => expect(Math.abs(t - (actives.t0 + k * actives.dt))).toBeLessThanOrEqual(TOL_CSV * Math.abs(actives.t0)))
    for (const j of [0, 1]) lu.colonnes[j + 1]!.forEach((v, k) => expect(Math.abs(v - actives.voies[j]![k]!)).toBeLessThanOrEqual(TOL_CSV * Math.max(1, Math.abs(v))))
    expect(csv.split('\n')[2]).toMatch(/^-?\d\.\d{7}E[+-]\d{2},/)
  })

  it('couplage AC : le palier retombe (passe-haut ≈ 3,5 Hz)', () => {
    const osc = sessionNeuve('libre').oscillo
    const reg = { ...osc, sdiv: 50e-3, voies: osc.voies.map((v, j) => (j === 1 ? { ...v, couplage: 'AC' as const } : v)) }
    const rec = acquisition(reg, { ...BANC_REEL, bruit: 0, ondulation: 0 }, 1)
    const v = rec.voies[1]!
    const iPic = v.indexOf(Math.max(...v))
    expect(v[O.points - 1]!).toBeLessThan(v[iPic]! - au3('CR_TP1_DM') / 4)
  })

  it('mode Normal sans déclenchement (seuil hors du signal) → pas de nouvelle trace', () => {
    const osc = sessionNeuve('libre').oscillo
    const reg = { ...osc, declenchement: { ...osc.declenchement, niveau: au3('CR_TP1_DU') } }
    const plan = planAcquisition(reg, periodeGbf(gbfTp1), BANC_REEL.pas)
    const s = simulate(BANC_REEL, { gbf: gbfTp1, platine, duree: plan.duree, pasSortie: plan.pasSortie }, PRESET_TP1, 1)
    expect(acquerir(reg, { t: s.t, voies: [s.voie1, s.voie2, s.voie3, s.voie4] }, plan, 0)).toBeNull()
    expect(acquerir({ ...reg, declenchement: { ...reg.declenchement, mode: 'auto' } }, { t: s.t, voies: [s.voie1, s.voie2, s.voie3, s.voie4] }, plan, 0)?.declenche).toBe(false)
  })
})
