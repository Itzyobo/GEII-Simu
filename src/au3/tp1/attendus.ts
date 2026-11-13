import { au3 } from '../../data/reference'
import type { ReglagesGbf } from '../instruments/gbf'
import { PRESET_TP1 } from '../sim/cablage'
import { BANC_REEL, simulate, type Banc } from '../sim/simulate'
import { lireAbaque } from './abaque'

/**
 * Réponses attendues du TP1, calculées depuis le modèle (jamais codées en dur) :
 * algorithme de curseur appliqué à la courbe du modèle sans bruit, sur l'échelon positif en régime établi,
 * puis inversion de l'abaque.
 */

export const BANC_SANS_BRUIT: Banc = { ...BANC_REEL, bruit: 0, ondulation: 0 }

/** Mesures « curseurs » d'un échelon : Y1 au front, Y2 en fin de palier, instants relatifs au front */
export interface MesuresEchelon {
  /** m(∞) = ΔY sur la mesure */
  dm: number
  /** U0 = ΔY sur l'entrée (crête à crête) */
  du: number
  g0: number
  tau: number
  t1: number
  t3: number
  tr5: number
}

/** Premier instant (interpolé) où x franchit `seuil` en montant, après l'indice i0 ; NaN sinon */
function franchissement(t: ArrayLike<number>, x: ArrayLike<number>, i0: number, seuil: number): number {
  for (let i = Math.max(1, i0); i < x.length; i++) {
    const a = x[i - 1]!
    const b = x[i]!
    if (a < seuil && b >= seuil) return t[i - 1]! + ((t[i]! - t[i - 1]!) * (seuil - a)) / (b - a)
  }
  return NaN
}

/**
 * Algorithme de curseur (méthode de l'énoncé) : Y1 = mesure à l'instant du front, Y2 = mesure en fin de palier,
 * m(∞) = Y2 − Y1 ; puis X2 − X1 quand la mesure atteint 63,2 %, 26,4 %, 80,1 % et 95 % de m(∞).
 */
export function mesurerEchelon(t: ArrayLike<number>, u: ArrayLike<number>, m: ArrayLike<number>, iFront: number, iFin: number): MesuresEchelon {
  const m0 = m[iFront]!
  const dm = m[iFin]! - m0
  const du = u[iFin]! - u[Math.max(0, iFront - 1)]!
  const tf = t[iFront]!
  const instant = (p: number) => franchissement(t, m, iFront, m0 + p * dm) - tf
  return { dm, du, g0: dm / du, tau: instant(au3('NIVEAU_TAU')), t1: instant(au3('NIVEAU_T1')), t3: instant(au3('NIVEAU_T3')), tr5: instant(au3('NIVEAU_TR5')) }
}

/** Courbe de référence : montage TP1, platine sous tension, ampli normal, modèle sans bruit au pas d'Euler */
export function courbeReference(gbf: ReglagesGbf, banc: Banc = BANC_SANS_BRUIT) {
  const T = 1 / gbf.frequence
  const front = au3('PERIODES_CHAUFFE') * T
  const r = simulate(banc, { gbf, platine: { sousTension: true, ampli: 'normal', g1: au3('TP2_K38_G1'), g2: au3('TP2_K38_G2'), z1: null, z2: null }, duree: front + T / 2, pasSortie: banc.pas }, PRESET_TP1, 0)
  const iFront = Math.round(front / banc.pas)
  // Fin du palier haut : dernier échantillon avant le front descendant
  const iFin = Math.round((front + T / 2) / banc.pas) - 1
  return { r, iFront, iFin }
}

export interface AttendusTp1 extends MesuresEchelon {
  rapport: number
  z: number | null
  wnT3: number | null
  wn: number | null
}

/** Réponses attendues pour les réglages du GBF de l'étudiant (carré attendu ; sinon les réglages de l'énoncé) */
export function attendusTp1(gbf: ReglagesGbf, banc: Banc = BANC_SANS_BRUIT): AttendusTp1 {
  const g = gbf.forme === 'carre' && gbf.sortie && gbf.frequence > 0 ? gbf : { ...gbf, forme: 'carre' as const, sortie: true, frequence: au3('TP1_GBF_FREQ'), vpp: au3('TP1_GBF_VPP') }
  const { r, iFront, iFin } = courbeReference(g, banc)
  const mes = mesurerEchelon(r.t, r.voie1, r.voie2, iFront, iFin)
  const a = lireAbaque(mes.t1, mes.t3)
  return { ...mes, rapport: mes.t3 / mes.t1, z: a?.z ?? null, wnT3: a?.wnT3 ?? null, wn: a?.wn ?? null }
}

/** Écart relatif signé (modèle / référence − 1) */
export const ecartRelatif = (modele: number, reference: number) => modele / reference - 1

/** TR5% du modèle comparé au CR, dans les conditions du CR (carré 12,3 Vpp à 1,3 Hz) : écart connu, affiché */
export function ecartTr5(): { modele: number; cr: number; ecart: number } {
  const gbf: ReglagesGbf = { forme: 'carre', frequence: au3('TP1_GBF_FREQ'), vpp: au3('CR_TP1_DU'), offset: 0, attenuation: false, sortie: true }
  const modele = attendusTp1(gbf).tr5
  return { modele, cr: au3('CR_TP1_TR5'), ecart: ecartRelatif(modele, au3('CR_TP1_TR5')) }
}

/**
 * TR5% lu sur une trace : DERNIER franchissement de la bande m(∞) ± 5 %ΔM (énoncé : l'instant où la mesure atteint
 * 0,95·m(∞) ou 1,05·m(∞) « sans jamais s'en éloigner de plus de 5 % ensuite »). m(∞) = moyenne de la fin du palier
 * (dernier dixième), instant relatif au front.
 */
export function dernierFranchissement(t: ArrayLike<number>, m: ArrayLike<number>, iFront: number, iFin: number): number {
  const nFin = Math.max(1, Math.floor((iFin - iFront) / au3('OSC_DIV_X')))
  let somme = 0
  for (let i = iFin - nFin + 1; i <= iFin; i++) somme += m[i]!
  const fin = somme / nFin
  const bande = (1 - au3('NIVEAU_TR5')) * Math.abs(fin - m[iFront]!)
  let iDernier = iFront
  for (let i = iFront; i <= iFin; i++) if (Math.abs(m[i]! - fin) > bande) iDernier = i + 1
  return t[Math.min(iDernier, iFin)]! - t[iFront]!
}
