import { au3 } from '../../data/reference'
import type { ReglagesGbf } from '../instruments/gbf'
import { regulateur, type Impedance } from '../sim/regulateur'
import { Z1_TP4, Z2_TP4 } from '../sim/cablage'
import { simulate, type Banc } from '../sim/simulate'
import { BANC_SANS_BRUIT } from '../tp1/attendus'
import { attendusTp2, CABLAGE_TP2, type AttendusTp2, type ReglagesEssai } from '../tp2/attendus'

/**
 * TP4 (aucune mesure réelle : tout est prédit par le modèle calé sur TP1/TP2, badge « valeur non vérifiée »).
 * Partie I : régulateur PI série de la platine, consigne carrée. Partie II réduite : moteur du banc, échelon 0 → 1 V,
 * bouteille = échelon de couple (BOUTEILLE) à 0,15 s, PI comparé à P.
 */

export { Z1_TP4, Z2_TP4 }

/** II.5 : bloc intégral retiré, R(p) = K : R2 seule sur Z2 */
export const Z2_P: Impedance = { composants: ['R2'], montage: 'serie' }

/** Affichage G1 de l'énoncé (G1 = 0,95 → 95) */
export const AFFICHAGE_TP4 = Math.round(au3('TP4_G1') * au3('K_P_DIVISEUR'))

export const gbfTp4 = (): ReglagesGbf => ({ forme: 'carre', frequence: au3('TP4_GBF_FREQ'), vpp: au3('TP4_GBF_VPP'), offset: 0, attenuation: false, sortie: true })

export const essaiTp4 = (affichage = AFFICHAGE_TP4, z1: Impedance | null = Z1_TP4, z2: Impedance | null = Z2_TP4): ReglagesEssai => ({ gbf: gbfTp4(), g1: affichage, g2: au3('TP4_G2'), z1, z2 })

export interface AttendusTp4 extends AttendusTp2 {
  /** Erreur statique relative en fin de demi-période : 1 − G0b */
  erreur: number
  cahier: { erreur: boolean; tr5: boolean; d1: boolean }
}

export function attendusTp4(e: ReglagesEssai = essaiTp4(), banc: Banc = BANC_SANS_BRUIT): AttendusTp4 {
  const a = attendusTp2(e, banc)
  const erreur = 1 - a.g0b
  return { ...a, erreur, cahier: { erreur: Math.abs(erreur) < au3('TP4_ERREUR_MAX'), tr5: a.tr5 < au3('TP4_TR5_MAX'), d1: a.d1rel < au3('TP4_D1_MAX') } }
}

export const respecte = (a: AttendusTp4) => a.cahier.erreur && a.cahier.tr5 && a.cahier.d1

/** Configuration qui détermine la réponse de la Q5 : composants, G2 et GBF de l'étudiant */
export interface ConfigBalayage {
  z1: Impedance | null
  z2: Impedance | null
  g2: number
  gbf: ReglagesGbf
}
export const CONFIG_ENONCE: ConfigBalayage = { z1: Z1_TP4, z2: Z2_TP4, g2: au3('TP4_G2'), gbf: gbfTp4() }

/** Q5 : balayage de l'Affichage G1 (00 à 99) ; l'ensemble des valeurs qui respectent le cahier des charges */
export function balayageG1(c: ConfigBalayage = CONFIG_ENONCE, banc: Banc = BANC_SANS_BRUIT) {
  const tous = Array.from({ length: au3('AFFICHAGE_G1_MAX') + 1 }, (_, affichage) => ({ affichage, a: attendusTp4({ gbf: c.gbf, g1: affichage, g2: c.g2, z1: c.z1, z2: c.z2 }, banc) }))
  const ok = tous.filter((x) => respecte(x.a)).map((x) => x.affichage)
  return { tous, ok, frontiere: ok.length ? Math.max(...ok) : null }
}

/** K et Ti du PI série de l'énoncé (résultat de calcul, jamais un réglage saisi) */
export function kTi(affichage = AFFICHAGE_TP4) {
  const h = regulateur(Z1_TP4, Z2_TP4, affichage, au3('TP4_G2'))!
  return { K: h.num[1]! / h.den[1]!, Ti: h.num[1]! / h.num[0]! }
}

/* ───────────── Partie II, réduite : moteur du banc ───────────── */

export interface ScenarioII {
  t: Float64Array
  c: Float64Array
  m: Float64Array
  u: Float64Array
  e: Float64Array
  /** Couple de charge de la bouteille (tension équivalente) */
  cc: Float64Array
  /** Démarrage (avant la bouteille, ou toute la durée) */
  mInf: number
  erreurDemarrage: number
  d1: number
  d1rel: number
  tr5: number
  u0: number
  /** U en régime permanent avant la bouteille, et en fin de simulation (après la bouteille) */
  uFin: number
  uApres: number
  /** Après la bouteille : écart maximal C − M (signé, le plus grand en valeur absolue) et erreur statique finale */
  ecartMax: number | null
  erreurFinale: number | null
}

/**
 * II.3 / II.4 / II.5 : échelon 0 → 1 V à t = 0 depuis l'arrêt, PI (`true`) ou P (`false`) ou tout autre Z2,
 * avec ou sans bouteille à 0,15 s, sur TP4_II_DUREE (ou `duree`).
 */
export function scenarioII(pi: boolean | Impedance, bouteille: boolean, affichage = AFFICHAGE_TP4, banc: Banc = BANC_SANS_BRUIT, duree = au3('TP4_II_DUREE')): ScenarioII {
  const z2 = pi === true ? Z2_TP4 : pi === false ? Z2_P : pi
  const gbf: ReglagesGbf = { forme: 'continu', frequence: au3('TP4_GBF_FREQ'), vpp: 0, offset: au3('TP4_II_CONSIGNE'), attenuation: false, sortie: true }
  const tb = au3('TP4_BOUTEILLE_T')
  const r = simulate(
    banc,
    { gbf, platine: { sousTension: true, ampli: 'normal', g1: affichage, g2: au3('TP4_G2'), z1: Z1_TP4, z2 }, duree, pasSortie: banc.pas, bouteilleT: bouteille ? tb : undefined },
    CABLAGE_TP2,
    0,
  )
  const n = r.t.length
  const iB = bouteille ? r.t.findIndex((t) => t >= tb) : n
  const iFin = iB - 1
  const mInf = r.voie2[iFin]!
  const c0 = r.voie1[iFin]!
  let iPic = 0
  for (let i = 0; i <= iFin; i++) if (r.voie2[i]! > r.voie2[iPic]!) iPic = i
  const bande = (1 - au3('NIVEAU_TR5')) * mInf
  let iSortie = -1
  for (let i = 0; i <= iFin; i++) if (Math.abs(r.voie2[i]! - mInf) > bande) iSortie = i
  let ecartMax: number | null = null
  if (bouteille) {
    ecartMax = 0
    for (let i = iB; i < n; i++) {
      const d = r.voie1[i]! - r.voie2[i]!
      if (Math.abs(d) > Math.abs(ecartMax)) ecartMax = d
    }
  }
  const d1 = Math.max(0, r.voie2[iPic]! - mInf)
  return {
    t: r.t,
    c: r.voie1,
    m: r.voie2,
    u: r.commande,
    e: Float64Array.from(r.voie1, (c, i) => c - r.voie2[i]!),
    cc: Float64Array.from(r.t, (t) => (bouteille && t >= tb ? banc.bouteille : 0)),
    mInf,
    erreurDemarrage: 1 - mInf / c0,
    d1,
    d1rel: d1 / mInf,
    tr5: iSortie >= iFin ? Infinity : r.t[iSortie + 1]!,
    u0: r.commande[1]!,
    uFin: r.commande[iFin]!,
    uApres: r.commande[n - 1]!,
    ecartMax,
    erreurFinale: bouteille ? 1 - r.voie2[n - 1]! / r.voie1[n - 1]! : null,
  }
}
