import { au3 } from '../../data/reference'
import type { ReglagesGbf } from '../instruments/gbf'
import { PRECABLAGE_TP2, PRESET_TP2, type Cablage } from '../sim/cablage'
import { gainAffichage } from '../sim/regulateur'
import { simulate, type Banc, type ResultatSim } from '../sim/simulate'
import { lireAbaque } from '../tp1/abaque'
import { BANC_SANS_BRUIT, ecartRelatif, mesurerEchelon } from '../tp1/attendus'

/**
 * Réponses attendues du TP2 (boucle fermée, régulateur P), calculées depuis le modèle sans bruit :
 * algorithme de curseur du TP1 (réutilisé) sur l'échelon positif établi, plus dépassement, Tpb/2, TR5%b
 * (définition de l'énoncé : entrée définitive dans m(∞) ± 5 %ΔM) et U max (voie 3).
 */

export interface ReglagesEssai {
  gbf: ReglagesGbf
  g1: number
  g2: number
}

export const essaiK38 = (vpp = au3('TP2_K38_GBF_VPP')): ReglagesEssai => ({ gbf: { forme: 'carre', frequence: au3('TP2_GBF_FREQ'), vpp, offset: 0, attenuation: false, sortie: true }, g1: au3('TP2_K38_G1'), g2: au3('TP2_K38_G2') })
export const essaiK40 = (vpp = au3('TP2_K40_GBF_VPP')): ReglagesEssai => ({ gbf: { forme: 'carre', frequence: au3('TP2_GBF_FREQ'), vpp, offset: 0, attenuation: false, sortie: true }, g1: au3('TP2_K40_G1'), g2: au3('TP2_K40_G2') })

/** Montage complet du TP2 : 9 liaisons de l'énoncé + consigne pré-câblée sur la voie 1 */
export const CABLAGE_TP2: Cablage = [...PRESET_TP2, ...PRECABLAGE_TP2]

/** Simulation sur une période de chauffe puis le palier haut (front montant établi) */
export function courbeBf(e: ReglagesEssai, banc: Banc = BANC_SANS_BRUIT, cablage: Cablage = CABLAGE_TP2) {
  const T = 1 / e.gbf.frequence
  const front = au3('PERIODES_CHAUFFE') * T
  const r = simulate(banc, { gbf: e.gbf, platine: { sousTension: true, ampli: 'normal', g1: e.g1, g2: e.g2, z1: null, z2: null }, duree: front + T / 2, pasSortie: banc.pas }, cablage, 0)
  return { r, iFront: Math.round(front / banc.pas), iFin: Math.round((front + T / 2) / banc.pas) - 1 }
}

export interface MesuresBf {
  c0: number
  dm: number
  g0b: number
  tau: number
  t1: number
  t3: number
  /** TR5%b : entrée définitive dans la bande m(∞) ± 5 %ΔM */
  tr5: number
  /** Premier dépassement (V) et relatif à m(∞) */
  d1: number
  d1rel: number
  /** Instant du premier pic (Tpb/2) */
  tpb2: number
  umax: number
  /** Pente de la mesure à l'origine, rapportée à celle d'un 1er ordre de même τ (≈ 0 : tangente horizontale) */
  penteRelative: number
}

export function mesurerBf(r: ResultatSim, iFront: number, iFin: number): MesuresBf {
  const e = mesurerEchelon(r.t, r.voie1, r.voie2, iFront, iFin)
  const m0 = r.voie2[iFront]!
  const fin = m0 + e.dm
  let iPic = iFront
  let umax = 0
  for (let i = iFront; i <= iFin; i++) {
    if (r.voie2[i]! > r.voie2[iPic]!) iPic = i
    umax = Math.max(umax, Math.abs(r.voie3[i]!))
  }
  const bande = (1 - au3('NIVEAU_TR5')) * e.dm
  let iSortie = iFront
  for (let i = iFront; i <= iFin; i++) if (Math.abs(r.voie2[i]! - fin) > bande) iSortie = i
  const tf = r.t[iFront]!
  const tw = au3('TANGENTE_FENETRE') * e.tau
  const iw = iFront + Math.max(1, Math.round(tw / (r.t[1]! - r.t[0]!)))
  const d1 = Math.max(0, r.voie2[iPic]! - fin)
  return {
    c0: e.du,
    dm: e.dm,
    g0b: e.g0,
    tau: e.tau,
    t1: e.t1,
    t3: e.t3,
    tr5: r.t[iSortie + 1]! - tf,
    d1,
    d1rel: d1 / e.dm,
    tpb2: r.t[iPic]! - tf,
    umax,
    penteRelative: (r.voie2[iw]! - m0) / (r.t[iw]! - tf) / (e.dm / e.tau),
  }
}

/** zb par la formule du dépassement : zb = −ln(D1/m∞) / √(π² + ln²(D1/m∞)) */
export const zbDepassement = (d1rel: number) => -Math.log(d1rel) / Math.sqrt(Math.PI ** 2 + Math.log(d1rel) ** 2)
/** ωnb = 2π / (Tpb·√(1 − zb²)), avec Tpb = 2·(Tpb/2) */
export const wnbPseudoPeriode = (zb: number, tpb2: number) => (2 * Math.PI) / (2 * tpb2 * Math.sqrt(1 - zb * zb))

/** Valeurs théoriques en boucle fermée (énoncé I.1.1 Q8) */
export function theoriqueBf(K: number, g0: number, z: number, wn: number) {
  const r = 1 + K * g0
  return { g0b: (K * g0) / r, zb: z / Math.sqrt(r), wnb: wn * Math.sqrt(r) }
}

/** Constantes de temps d'un 2e ordre apériodique (zb ≥ 1) : τ = 1/(ωnb(zb ∓ √(zb² − 1))) ; null si pôles complexes */
export function constantesDeTemps(zb: number, wnb: number): { tau1: number; tau2: number; negligeable: boolean } | null {
  if (zb < 1) return null
  const r = Math.sqrt(zb * zb - 1)
  const tau1 = 1 / (wnb * (zb + r))
  const tau2 = 1 / (wnb * (zb - r))
  return { tau1, tau2, negligeable: tau2 / tau1 >= au3('RAPPORT_NEGLIGEABLE') }
}

export interface AttendusTp2 extends MesuresBf {
  K: number
  rapport: number
  /** Abaque t3/t1 (K = 3,8) */
  zbAbaque: number | null
  wnT3: number | null
  wnbAbaque: number | null
  /** Formules du dépassement (K = 40) ; null sans dépassement */
  zbFormule: number | null
  wnbFormule: number | null
}

export function attendusTp2(e: ReglagesEssai, banc: Banc = BANC_SANS_BRUIT): AttendusTp2 {
  const { r, iFront, iFin } = courbeBf(e, banc)
  const m = mesurerBf(r, iFront, iFin)
  const a = lireAbaque(m.t1, m.t3)
  const zf = m.d1rel > 0 ? zbDepassement(m.d1rel) : null
  return { ...m, K: gainAffichage(e.g1, e.g2), rapport: m.t3 / m.t1, zbAbaque: a?.z ?? null, wnT3: a?.wnT3 ?? null, wnbAbaque: a?.wn ?? null, zbFormule: zf, wnbFormule: zf === null ? null : wnbPseudoPeriode(zf, m.tpb2) }
}

/** TR5%b du modèle comparé au CR (écart connu, affiché avec le badge) */
export function ecartTr5b(essai: 'k38' | 'k40') {
  const a = essai === 'k38' ? attendusTp2(essaiK38(au3('CR_TP2K38_C0'))) : attendusTp2(essaiK40(au3('CR_TP2K40_C0')))
  const cr = au3(essai === 'k38' ? 'CR_TP2K38_TR5' : 'CR_TP2K40_TR5')
  return { modele: a.tr5, cr, ecart: ecartRelatif(a.tr5, cr) }
}

export const Q12_SANS_OBJET = 'Sans objet (zb < 1 : pôles complexes)'
export const Q12_NEGLIGEABLE = 'Oui, l’une est négligeable'
export const Q12_NON_NEGLIGEABLE = 'Non, aucune n’est négligeable'

/** I.1.2 Q12 : réponse attendue selon le zb trouvé par le fit de l'étudiant */
export function attenduQ12(zb: number, wnb: number) {
  const c = constantesDeTemps(zb, wnb)
  return c ? { choix: c.negligeable ? Q12_NEGLIGEABLE : Q12_NON_NEGLIGEABLE, ...c } : { choix: Q12_SANS_OBJET, tau1: null, tau2: null, negligeable: null }
}
