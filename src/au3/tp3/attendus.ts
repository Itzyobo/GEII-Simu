import { au3, AU3_EPSILON, AU3_LISTES } from '../../data/reference'
import { SUPPORTS_TP3 } from '../banc'
import { GBF_DEFAUT, type ReglagesGbf } from '../instruments/gbf'
import { MISE_EN_PAGE } from '../miseEnPage'
import { MONTAGE_TP3_I, MONTAGE_TP3_II2, type Borne, type Cablage, type Liaison } from '../sim/cablage'
import { BANC_POSITION, etatInitial, simulerPosition, type BancPosition, type EtatPosition, type ResultatPosition } from '../sim/position'
import { gainAffichage, rapportResistif, type Impedance } from '../sim/regulateur'
import type { ReglagesPlatine } from '../sim/simulate'
import { mesurerBf, type MesuresBf } from '../tp2/attendus'
import { DEGRES_PAR_TOUR } from '../unites'

/**
 * Réponses attendues du TP3, calculées par simulation du modèle de position (aucune mesure réelle : badge partout).
 * Partie I : rampe du potentiomètre en boucle ouverte (+12 V), période et angle mort lus sur la trace.
 * Partie II.2 : échelon établi de la consigne carrée ±2 V à 0,2 Hz, algorithme de curseur du TP2 (mesurerBf).
 */

const [NOIR, ROUGE, VERT, JAUNE] = MISE_EN_PAGE.cable.couleurs

/** Un câble par liaison de l'énoncé, « masse » = première masse de la platine, masses en noir */
export const cablageDe = (liaisons: readonly Liaison[], prefixe: string): Cablage =>
  liaisons.flatMap((l): Liaison[] => (l.et ? [{ a: l.a, b: l.b, nom: l.nom }, { ...l.et, nom: l.nom }] : [l])).map((l, i) => {
    const a: Borne = l.a === 'masse' ? 'plat.masse1' : l.a
    const b: Borne = l.b === 'masse' ? 'plat.masse1' : l.b
    return { id: `${prefixe}-${i}`, a, b, couleur: l.a === 'masse' || l.b === 'masse' ? NOIR : a.startsWith('pot') || b.startsWith('pot') ? VERT : a === 'gbf.out' ? JAUNE : ROUGE }
  })

export const CABLAGE_TP3_I = cablageDe(MONTAGE_TP3_I, 'tp3-i')
/** II.2 complet : II.1 + U sur la voie 3 + E sur la voie 4 (facultatif dans l'énoncé) */
export const CABLAGE_TP3_II: Cablage = [...cablageDe(MONTAGE_TP3_II2, 'tp3-ii'), { id: 'tp3-ii-e', a: 'plat.erreur', b: 'osc.v4', couleur: ROUGE }]

/** Alimentation du potentiomètre inversée (bornes rouge et bleue permutées) */
export const inverserPot = (c: Cablage): Cablage => {
  const p = (b: Borne): Borne => (b === 'pot.rouge' ? 'pot.bleue' : b === 'pot.bleue' ? 'pot.rouge' : b)
  return c.map((x) => ({ ...x, a: p(x.a), b: p(x.b) }))
}
/** Fil de sortie du potentiomètre vers l'entrée Mesure débranché (II.2 Mesures Q6) */
export const debrancherMesure = (c: Cablage): Cablage => c.filter((x) => !(['pot.verte', 'plat.mesure'] as Borne[]).every((b) => x.a === b || x.b === b))

export const platineTp3 = (g1 = au3('TP3_G1'), supports: Pick<ReglagesPlatine, 'z1' | 'z2'> = SUPPORTS_TP3): ReglagesPlatine => ({ sousTension: true, ampli: 'normal', g1, g2: au3('TP3_G2'), ...supports })
export const gbfTp3 = (): ReglagesGbf => ({ forme: 'carre', frequence: au3('TP3_GBF_FREQ'), vpp: au3('TP3_GBF_VPP'), offset: 0, attenuation: false, sortie: true })
/** Tension continue réglée par l'offset (II.1 : tous les boutons de forme relâchés) */
export const gbfContinu = (offset: number): ReglagesGbf => ({ ...GBF_DEFAUT, forme: 'continu', offset })

/** K calculé de la platine : (Z2/Z1)·G1·G2/100 (résistances inégales : K multiplié par Z2/Z1) ; null si non résistif */
export function kTp3(g1: number, g2: number, z1: Impedance | null, z2: Impedance | null): number | null {
  const r = rapportResistif(z1, z2)
  return r === null ? null : r * gainAffichage(g1, g2)
}
/** Affichage G1 qui donne K avec G2 = TP3_G2 (K = Affichage G1 × G2 / 100) */
export const affichagePourK = (k: number) => Math.round((k * au3('K_P_DIVISEUR')) / au3('TP3_G2'))

const PAS_OSCILLO = (au3('TP3_SDIV') * au3('OSC_DIV_X')) / au3('OSC_POINTS')

/* ───────────── Partie I : boucle ouverte ───────────── */

export interface Rampe {
  r: ResultatPosition
  /** Période temporelle de la rampe (s) */
  periode: number
  /** Pente des segments de droite : +1 ou −1 */
  pente: number
  /** Durée de la partie non linéaire sur une période (s) et angle mort correspondant (°) */
  dureeNonLineaire: number
  angleMort: number
  /** Paliers de l'angle mort dans l'ordre du temps (V) */
  paliers: number[]
}

/** Rampe du potentiomètre à +12 V en boucle ouverte, lue sur la trace échantillonnée comme l'oscilloscope (100 ms/div) */
export function rampeBoucleOuverte(inverse = false, b: BancPosition = BANC_POSITION, pasSortie = PAS_OSCILLO): Rampe {
  const T = au3('TP3_T_TOUR')
  const cablage = inverse ? inverserPot(CABLAGE_TP3_I) : CABLAGE_TP3_I
  // Démarrage (un tour), puis trois tours lus
  const r = simulerPosition(b, { gbf: GBF_DEFAUT, platine: platineTp3(), cablage }, (au3('PERIODES_CHAUFFE') + 2 + 2) * T, pasSortie)
  const m = r.voie2
  const debut = Math.round(T / pasSortie)
  const niveau = b.alim / 2
  const fronts: number[] = []
  for (let i = debut + 1; i < m.length; i++) if (m[i - 1]! < niveau && m[i]! >= niveau) fronts.push(i)
  const [i0, i1] = [fronts[0]!, fronts[1]!]
  const periode = r.t[i1]! - r.t[i0]!
  // Pente des segments : médiane des écarts entre échantillons (la partie linéaire est majoritaire)
  const d = Array.from({ length: i1 - i0 }, (_, k) => m[i0 + k + 1]! - m[i0 + k]!)
  const dLin = [...d].sort((x, y) => x - y)[Math.floor(d.length / 2)]!
  const nonLineaire = d.map((x) => Math.abs(x - dLin) > Math.abs(dLin) / 2)
  const dureeNonLineaire = nonLineaire.filter(Boolean).length * pasSortie
  const paliers: number[] = []
  for (let k = 1; k < d.length; k++) {
    // Palier : deux écarts nuls consécutifs, valeur différente du palier précédent
    if (Math.abs(d[k]!) < AU3_EPSILON && Math.abs(d[k - 1]!) < AU3_EPSILON) {
      const v = m[i0 + k]!
      if (paliers.length === 0 || Math.abs(paliers[paliers.length - 1]! - v) > AU3_EPSILON) paliers.push(v)
    }
  }
  return { r, periode, pente: Math.sign(dLin), dureeNonLineaire, angleMort: (dureeNonLineaire / periode) * DEGRES_PAR_TOUR, paliers }
}

/** Signe de la pente des segments d'une trace (médiane des écarts non nuls entre échantillons) ; 0 si la trace est plate */
export function penteTrace(x: ArrayLike<number> | null | undefined): number {
  if (!x || x.length < 2) return 0
  const d: number[] = []
  for (let i = 1; i < x.length; i++) if (Math.abs(x[i]! - x[i - 1]!) > AU3_EPSILON) d.push(x[i]! - x[i - 1]!)
  return d.length ? Math.sign([...d].sort((a, b) => a - b)[Math.floor(d.length / 2)]!) : 0
}

/* ───────────── Partie II.2 : consigne carrée ───────────── */

export interface EssaiTp3 extends MesuresBf {
  K: number
  /** Erreur statique relative : 1 − G0b */
  erreur: number
  /** Durée pendant laquelle U est saturé à ±USAT au début de l'échelon (s) */
  dureeSaturation: number
  /** Cahier des charges de l'essuie-glace : erreur < TP4_ERREUR_MAX et TR5%b < TP3_TR5_MAX */
  respecte: boolean
  r: ResultatPosition
}

/**
 * Échelon positif établi : la simulation part de θ milieu (0 V) au début d'une demi-période basse (t = T/2) ; la mesure
 * se stabilise à −2 V, puis le front montant à t = T donne l'échelon du régime périodique, lu jusqu'à la fin du palier haut.
 */
export function essaiTp3(g1 = au3('TP3_G1'), supports: Pick<ReglagesPlatine, 'z1' | 'z2'> = SUPPORTS_TP3, b: BancPosition = BANC_POSITION, cablage: Cablage = CABLAGE_TP3_II): EssaiTp3 {
  const T = 1 / au3('TP3_GBF_FREQ')
  const pasM = au3('TP3_PAS_MESURE')
  const n0 = Math.round(T / 2 / b.pas)
  const r = simulerPosition(b, { gbf: gbfTp3(), platine: platineTp3(g1, supports), cablage }, T, pasM, etatInitial(b, n0))
  const iFront = Math.round(T / 2 / pasM)
  const iFin = r.t.length - 1
  const m = mesurerBf(r, iFront, iFin)
  let nSat = 0
  for (let i = iFront; i <= iFin; i++) if (Math.abs(r.voie3[i]!) >= b.usat * (1 - AU3_EPSILON)) nSat++
  const erreur = 1 - m.g0b
  return { ...m, K: kTp3(g1, au3('TP3_G2'), supports.z1, supports.z2) ?? NaN, erreur, dureeSaturation: nSat * pasM, respecte: Math.abs(erreur) < au3('TP4_ERREUR_MAX') && m.tr5 < au3('TP3_TR5_MAX'), r }
}

/** Q7 : les K de l'énoncé (1, 2, 4, 7) qui respectent le cahier des charges, par simulation */
export function comparaisonK(b: BancPosition = BANC_POSITION) {
  const essais = AU3_LISTES.TP3_K_COMPARES.valeurs.map((K) => ({ K, a: essaiTp3(affichagePourK(K), SUPPORTS_TP3, b) }))
  return { essais, retenus: essais.filter((x) => x.a.respecte).map((x) => x.K) }
}

/* ───────────── Consigne continue (II.1) et défauts ───────────── */

/** Consigne continue `offset` depuis l'arrêt (θ milieu), pendant `duree` : position, mesure, commande */
export function reponseContinue(offset: number, duree: number, cablage: Cablage = CABLAGE_TP3_II, g1 = au3('TP3_G1'), etat?: EtatPosition, b: BancPosition = BANC_POSITION) {
  return simulerPosition(b, { gbf: gbfContinu(offset), platine: platineTp3(g1), cablage }, duree, au3('TP3_PAS_MESURE'), etat ?? etatInitial(b))
}
