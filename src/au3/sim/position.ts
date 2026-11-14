import { au3 } from '../../data/reference'
import { generateurGbf, type ReglagesGbf } from '../instruments/gbf'
import { DEGRES_PAR_TOUR } from '../unites'
import { reseaux, type Borne, type Cablage } from './cablage'
import { formeEtat, regulateur as transfertPlatine } from './regulateur'
import type { Evenement, ReglagesPlatine } from './simulate'

/**
 * TP3 : asservissement de position (moteur + potentiomètre rotatif avec angle mort). Fonctions pures.
 *   u_eff = zoneMorte(u, UF) = signe(u)·max(|u| − UF, 0)
 *   τa·dx1/dt = KV·u_eff − x1 ; τb·dΩ/dt = x1 − Ω ; dθ/dt = Ω   (θ en degrés, non borné)
 * Potentiomètre : piste linéaire de la borne rouge à la borne bleue sur 360° − angle mort, puis soudure côté bleue
 * (tension de la borne bleue), isolant (0 V), soudure côté rouge (tension de la borne rouge). Câblé comme l'énoncé
 * (rouge à −12 V, bleue à +12 V) : pente positive ; alimentation inversée : pente négative.
 * Boucle fermée : régulateur à impédances de la platine, R(p) = (Z2/Z1)·G1·G2, sortie G2 bornée à ±USAT.
 * Euler explicite au pas PAS_EULER, le même pour tout le TP3 ; l'état (pas entier n, x1, Ω, θ, régulateur) se
 * prolonge par tranches (mode temps réel) exactement comme d'un seul bloc.
 */
export interface BancPosition {
  kv: number
  uf: number
  tauA: number
  tauB: number
  pas: number
  soudureM12: number
  isolant: number
  soudureP12: number
  usat: number
  gainAmpli: number
  imaxAmpli: number
  imaxG2: number
  rInduit: number
  zGbf: number
  alim: number
  flottant: number
  secteurHz: number
}

export const BANC_POSITION: BancPosition = {
  kv: au3('TP3_KV'),
  uf: au3('TP3_UF'),
  tauA: au3('TAU_A'),
  tauB: au3('TAU_B'),
  pas: au3('PAS_EULER'),
  soudureM12: au3('TP3_SOUDURE_M12'),
  isolant: au3('TP3_ISOLANT'),
  soudureP12: au3('TP3_SOUDURE_P12'),
  usat: au3('USAT'),
  gainAmpli: au3('GAIN_AMPLI_COURANT'),
  imaxAmpli: au3('IMAX_AMPLI'),
  imaxG2: au3('IMAX_SORTIE_G2'),
  rInduit: au3('R_INDUIT'),
  zGbf: au3('GBF_IMPEDANCE'),
  alim: au3('TP3_VALIM_POT'),
  flottant: au3('FLOTTANT_AMPLITUDE'),
  secteurHz: au3('SECTEUR_HZ'),
}

export const angleMort = (b: BancPosition) => b.soudureM12 + b.isolant + b.soudureP12
/** Étendue angulaire de la piste linéaire */
export const lineaire = (b: BancPosition) => DEGRES_PAR_TOUR - angleMort(b)

/** Tension de sortie du potentiomètre à l'angle θ (degrés), ses bornes rouge et bleue étant à vRouge et vBleue */
export function tensionPot(b: BancPosition, theta: number, vRouge: number, vBleue: number): number {
  const a = theta - DEGRES_PAR_TOUR * Math.floor(theta / DEGRES_PAR_TOUR)
  const L = lineaire(b)
  if (a < L) return vRouge + ((vBleue - vRouge) * a) / L
  if (a < L + b.soudureP12) return vBleue
  if (a < L + b.soudureP12 + b.isolant) return 0
  return vRouge
}

/** Zone morte du frottement sec */
export const zoneMorte = (u: number, uf: number) => Math.sign(u) * Math.max(Math.abs(u) - uf, 0)

export interface EtatPosition {
  /** Nombre de pas d'Euler effectués depuis t = 0 (t = n·pas, sans dérive d'arrondi) */
  n: number
  x1: number
  /** Vitesse angulaire (°/s) */
  omega: number
  /** Position angulaire (°), non bornée */
  theta: number
  /** États du régulateur (forme commandable) */
  r1: number
  r2: number
}

/** Moteur à l'arrêt, potentiomètre au milieu de sa piste (0 V câblé comme l'énoncé) */
export const etatInitial = (b: BancPosition = BANC_POSITION, n = 0): EtatPosition => ({ n, x1: 0, omega: 0, theta: lineaire(b) / 2, r1: 0, r2: 0 })

type Source = 'aucune' | 'gbf' | 'p12' | 'm12' | 'masse' | 'ampli' | 'g2' | 'erreur' | 'pot'
const SOURCES: Partial<Record<Borne, Source>> = {
  'gbf.out': 'gbf',
  'plat.p12': 'p12',
  'plat.m12': 'm12',
  'plat.ampliOut': 'ampli',
  'plat.sortieG2': 'g2',
  'plat.erreur': 'erreur',
  'pot.verte': 'pot',
}
interface Lecteur {
  source: Source
  charge: boolean
  isole: boolean
}

export interface EntreesPosition {
  gbf: ReglagesGbf
  platine: ReglagesPlatine
  cablage: Cablage
}

/** Un échantillon : instant, voies 1 à 4, position, commande U */
export type Echantillon = (t: number, voies: readonly [number, number, number, number], theta: number, u: number) => void

export interface ModelePosition {
  defauts: Evenement[]
  /** Le moteur est commandé par la sortie G2 (directement ou par l'ampli) et la Mesure lit le potentiomètre */
  boucleFermee: boolean
  /** Avance de `duree` (arrondie au pas) ; `echantillon` est appelé tous les `decim` pas (indices multiples de decim) */
  avancer: (e: EtatPosition, duree: number, echantillon?: Echantillon, decim?: number) => EtatPosition
}

const borne = (v: number, max: number) => Math.max(-max, Math.min(max, v))

/** Prépare le banc de position pour des entrées fixes (câblage, GBF, platine) : topologie, régulateur, générateur */
export function preparer(b: BancPosition, entrees: EntreesPosition): ModelePosition {
  const { gbf: reglagesGbf, platine: p, cablage } = entrees
  const r = reseaux(cablage)
  const sources = r.membres.map((m) => [...new Set(m.map((x) => (r.de(x) === r.masse ? 'masse' : SOURCES[x])).filter((s): s is Source => !!s))])
  const defauts: Evenement[] = []
  sources.forEach((s, i) => {
    if (s.length > 1) defauts.push({ t: 0, type: 'defaut', code: 'court-circuit', message: `Court-circuit : ${s.join(' et ')} reliés (${r.membres[i]!.join(', ')})` })
  })
  const source = (x: Borne): Source => {
    const s = sources[r.de(x)]!
    return s.includes('masse') ? 'masse' : (s[0] ?? 'aucune')
  }
  const nr = r.de('mot.rouge')
  const nn = r.de('mot.noir')
  const moteurBranche = source('mot.rouge') !== 'aucune' && source('mot.noir') !== 'aucune' && nr !== nn
  if ((source('mot.rouge') === 'aucune') !== (source('mot.noir') === 'aucune') && (r.degre('mot.rouge') > 0 || r.degre('mot.noir') > 0))
    defauts.push({ t: 0, type: 'defaut', code: 'masse-moteur-absente', message: 'Alimentation du moteur incomplète (borne rouge ou noire non reliée) : le moteur reste immobile' })
  const lecteur = (x: Borne): Lecteur => ({ source: source(x), charge: moteurBranche && (r.de(x) === nr || r.de(x) === nn), isole: r.membres[r.de(x)]!.length === 1 && r.degre(x) === 0 })
  const commande = source('mot.rouge') === 'masse' ? source('mot.noir') : source('mot.rouge')
  const boucleFermee = (commande === 'g2' || (commande === 'ampli' && source('plat.ampliIn') === 'g2')) && source('plat.mesure') === 'pot'

  const L = { consigne: lecteur('plat.consigne'), mesure: lecteur('plat.mesure'), ampliIn: lecteur('plat.ampliIn'), rouge: lecteur('mot.rouge'), noir: lecteur('mot.noir'), potR: lecteur('pot.rouge'), potB: lecteur('pot.bleue') }
  const osc = (['osc.v1', 'osc.v2', 'osc.v3', 'osc.v4'] as const).map(lecteur)
  const on = p.sousTension
  const h = transfertPlatine(p.z1, p.z2, p.g1, p.g2)
  const { ordre, a: [a0, a1], c: [c0, c1], D } = h ? formeEtat(h) : { ordre: 0, a: [0, 0], c: [0, 0], D: 0 }
  const regule = on && h !== null
  const genere = generateurGbf(reglagesGbf)
  const ampliColle = !on ? null : p.ampli === 'bloque-haut' ? b.usat : p.ampli === 'bloque-zero' ? 0 : null
  const limiteAmpli = b.imaxAmpli * b.rInduit
  const limiteG2 = b.imaxG2 * b.rInduit
  const diviseurGbf = b.rInduit / (b.rInduit + b.zGbf)
  const wSecteur = 2 * Math.PI * b.secteurHz
  const { pas, tauA, tauB, kv, uf, usat } = b

  const avancer = (e0: EtatPosition, duree: number, echantillon?: Echantillon, decim = 1): EtatPosition => {
    let { x1, omega, theta, r1, r2 } = e0
    const n0 = e0.n
    const n1 = Math.round((n0 * pas + duree) / pas)
    let vg = 0
    let pot = 0
    let g2 = 0
    let erreur = 0
    let ampli = 0
    let t = 0
    const lire = (l: Lecteur): number => {
      switch (l.source) {
        case 'gbf':
          return l.charge ? vg * diviseurGbf : vg
        case 'p12':
          return on ? b.alim : 0
        case 'm12':
          return on ? -b.alim : 0
        case 'masse':
          return 0
        case 'ampli':
          return l.charge ? borne(ampli, limiteAmpli) : ampli
        case 'g2':
          return l.charge ? borne(g2, limiteG2) : g2
        case 'erreur':
          return l.charge ? borne(erreur, limiteG2) : erreur
        case 'pot':
          return pot
        case 'aucune':
          return l.isole ? 0 : b.flottant * Math.sin(wSecteur * t)
      }
    }
    for (let i = n0; i < n1; i++) {
      t = i * pas
      vg = genere(t)
      pot = tensionPot(b, theta, lire(L.potR), lire(L.potB))
      if (regule) {
        const ec = lire(L.consigne) - lire(L.mesure)
        g2 = borne(D * ec + c0 * r1 + c1 * r2, usat)
        if (ordre === 1) r1 += pas * (ec - a0 * r1)
        else if (ordre === 2) {
          const d2 = ec - a0 * r1 - a1 * r2
          r1 += pas * r2
          r2 += pas * d2
        }
        erreur = borne(ec, usat)
      } else g2 = erreur = 0
      ampli = !on ? 0 : (ampliColle ?? b.gainAmpli * lire(L.ampliIn))
      const u = moteurBranche ? lire(L.rouge) - lire(L.noir) : 0
      if (echantillon && i % decim === 0) echantillon(t, [lire(osc[0]!), lire(osc[1]!), lire(osc[2]!), lire(osc[3]!)], theta, g2)
      const nx1 = x1 + (pas / tauA) * (kv * zoneMorte(u, uf) - x1)
      const nom = omega + (pas / tauB) * (x1 - omega)
      theta += pas * omega
      x1 = nx1
      omega = nom
    }
    return { n: Math.max(n0, n1), x1, omega, theta, r1, r2 }
  }
  return { defauts, boucleFermee, avancer }
}

/** Mode temps réel : un pas de durée dt depuis l'état courant (entrées de l'image courante) */
export const step = (etat: EtatPosition, entrees: EntreesPosition, dt: number, b: BancPosition = BANC_POSITION): EtatPosition => preparer(b, entrees).avancer(etat, dt)

export interface ResultatPosition {
  t: Float64Array
  voie1: Float64Array
  voie2: Float64Array
  voie3: Float64Array
  voie4: Float64Array
  theta: Float64Array
  commande: Float64Array
  final: EtatPosition
  defauts: Evenement[]
}

/** Simulation d'un bloc de `duree` depuis `etat` (par défaut : arrêt, potentiomètre au milieu), échantillonnée au pas `pasSortie` */
export function simulerPosition(b: BancPosition, entrees: EntreesPosition, duree: number, pasSortie: number, etat: EtatPosition = etatInitial(b)): ResultatPosition {
  const decim = Math.max(1, Math.round(pasSortie / b.pas))
  const n1 = Math.round((etat.n * b.pas + duree) / b.pas)
  const nOut = Math.floor((n1 - 1) / decim) - Math.ceil(etat.n / decim) + 1
  const n = Math.max(0, nOut)
  const out = { t: new Float64Array(n), voie1: new Float64Array(n), voie2: new Float64Array(n), voie3: new Float64Array(n), voie4: new Float64Array(n), theta: new Float64Array(n), commande: new Float64Array(n) }
  const voies = [out.voie1, out.voie2, out.voie3, out.voie4]
  let k = 0
  const m = preparer(b, entrees)
  const final = m.avancer(
    etat,
    duree,
    (t, v, theta, u) => {
      out.t[k] = t
      for (let j = 0; j < v.length; j++) voies[j]![k] = v[j]!
      out.theta[k] = theta
      out.commande[k++] = u
    },
    decim,
  )
  return { ...out, final, defauts: m.defauts }
}
