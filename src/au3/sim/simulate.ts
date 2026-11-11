import { au3 } from '../../data/reference'
import { generateurGbf, type ReglagesGbf } from '../instruments/gbf'
import { reseaux, type Borne, type Cablage } from './cablage'
import { gaussien, mulberry32 } from './prng'
import { formeEtat, gainAffichage, transfertRegulateur, type Impedance } from './regulateur'

/** Paramètres physiques du banc (poste 4, moteur 1). Par défaut : reference.ts ; les tests peuvent en remplacer. */
export interface Banc {
  g0r: number
  uf: number
  tauA: number
  tauB: number
  /** σ du bruit gaussien de la DT, relatif à Δm */
  bruit: number
  /** Amplitude de l'ondulation de commutation, relative à m */
  ondulation: number
  ondulationHzParV: number
  pas: number
  rInduit: number
  usat: number
  gainAmpli: number
  imaxAmpli: number
  imaxG2: number
  zGbf: number
  alim: number
  flottant: number
  secteurHz: number
  bouteille: number
  /** Réduction relative du palier bas du GBF relié à la platine éteinte */
  dissymetrieGbf: number
}

export const BANC_REEL: Banc = {
  g0r: au3('G0R'),
  uf: au3('UF'),
  tauA: au3('TAU_A'),
  tauB: au3('TAU_B'),
  bruit: au3('BRUIT_DT'),
  ondulation: au3('ONDULATION_DT'),
  ondulationHzParV: au3('ONDULATION_HZ_PAR_V'),
  pas: au3('PAS_EULER'),
  rInduit: au3('R_INDUIT'),
  usat: au3('USAT'),
  gainAmpli: au3('GAIN_AMPLI_COURANT'),
  imaxAmpli: au3('IMAX_AMPLI'),
  imaxG2: au3('IMAX_SORTIE_G2'),
  zGbf: au3('GBF_IMPEDANCE'),
  alim: au3('ALIM_PLATINE'),
  flottant: au3('FLOTTANT_AMPLITUDE'),
  secteurHz: au3('SECTEUR_HZ'),
  bouteille: au3('BOUTEILLE'),
  dissymetrieGbf: au3('GBF_DISSYMETRIE'),
}

/**
 * Ampli de courant (TP1, remarque après « Mettre sous tension », hypothèse AMPLI_BLOQUE) :
 * bloqué = sortie collée à +USAT (le moteur tourne toujours dans le même sens) ou à 0 V (il ne tourne pas),
 * quelle que soit l'entrée ; réamorcé = rallumé avec l'entrée à la masse : il fonctionne, mais se rebloque
 * s'il est rallumé avec le GBF sur son entrée, tant que la masse n'a pas été remplacée par le GBF sous tension.
 */
export type EtatAmpli = 'normal' | 'bloque-haut' | 'bloque-zero' | 'reamorce-haut' | 'reamorce-zero'

export interface ReglagesPlatine {
  sousTension: boolean
  ampli: EtatAmpli
  /** Affichage G1 (00 à 99) */
  g1: number
  g2: number
  z1: Impedance | null
  z2: Impedance | null
}

export interface ReglagesSim {
  gbf: ReglagesGbf
  platine: ReglagesPlatine
  duree: number
  /** Intervalle entre deux échantillons renvoyés (arrondi à un multiple du pas d'Euler) */
  pasSortie: number
  /** Instant d'arrivée de la bouteille (échelon de couple), absent = pas de bouteille */
  bouteilleT?: number
}

export type CodeDefaut = 'court-circuit' | 'masse-moteur-absente' | 'dt-flottante' | 'ampli-oublie' | 'dt-inversee' | 'regulateur-non-gere'
export interface Evenement {
  t: number
  type: 'defaut' | 'saturation'
  code: CodeDefaut | 'saturation-g2'
  message: string
}
export type Topologie = 'boucle-ouverte' | 'boucle-fermee' | 'defaut' | 'incomplet'

export interface ResultatSim {
  t: Float64Array
  voie1: Float64Array
  voie2: Float64Array
  voie3: Float64Array
  voie4: Float64Array
  /** Vitesse réelle en volts DT, sans bruit (pour les réponses calculées) */
  vitesse: Float64Array
  /** Sortie G2 (commande U) */
  commande: Float64Array
  evenements: Evenement[]
  topologie: Topologie
}

type Source = 'aucune' | 'gbf' | 'p12' | 'm12' | 'masse' | 'ampli' | 'g2' | 'erreur' | 'dt+' | 'dt-'
const SOURCES: Partial<Record<Borne, Source>> = {
  'gbf.out': 'gbf',
  'plat.p12': 'p12',
  'plat.m12': 'm12',
  'plat.ampliOut': 'ampli',
  'plat.sortieG2': 'g2',
  'plat.erreur': 'erreur',
}

/** Ce que lit une entrée : la source de son réseau, si ce réseau est chargé par le moteur, si l'entrée est en l'air sans câble */
interface Lecteur {
  source: Source
  charge: boolean
  isole: boolean
}

export interface AnalyseTopologie {
  lecteur: (b: Borne) => Lecteur
  moteurBranche: boolean
  regulateurEnChaine: boolean
  /** Le GBF est relié à une borne de la platine (son carré est faussé quand elle est éteinte) */
  gbfSurPlatine: boolean
  topologie: Topologie
  defauts: Evenement[]
}

/** Déduit la topologie du graphe de bornes : sources de chaque réseau, défauts, boucle ouverte ou fermée */
export function analyserTopologie(cablage: Cablage): AnalyseTopologie {
  const r = reseaux(cablage)
  const sources = r.membres.map((m) => [...new Set(m.map((b) => (r.de(b) === r.masse ? 'masse' : SOURCES[b])).filter((s): s is Source => !!s))])
  const nv = r.de('mot.verte')
  const nj = r.de('mot.jaune')
  // La DT est une source flottante entre verte (+) et jaune (−) : elle n'impose une tension que si l'autre borne est à la masse
  if (nj === r.masse && nv !== r.masse) sources[nv]!.push('dt+')
  else if (nv === r.masse && nj !== r.masse) sources[nj]!.push('dt-')
  const defauts: Evenement[] = []
  const defaut = (code: CodeDefaut, message: string) => defauts.push({ t: 0, type: 'defaut', code, message })
  sources.forEach((s, i) => {
    if (s.length > 1) defaut('court-circuit', `Court-circuit : ${s.join(' et ')} reliés (${r.membres[i]!.join(', ')})`)
  })
  const source = (b: Borne): Source => {
    const s = sources[r.de(b)]!
    return s.includes('masse') ? 'masse' : (s[0] ?? 'aucune')
  }
  const nr = r.de('mot.rouge')
  const nn = r.de('mot.noir')
  const moteurBranche = source('mot.rouge') !== 'aucune' && source('mot.noir') !== 'aucune' && nr !== nn
  const commandeMoteur = source('mot.rouge') === 'masse' ? source('mot.noir') : source('mot.rouge')
  const regulateurEnChaine = commandeMoteur === 'g2' || (commandeMoteur === 'ampli' && source('plat.ampliIn') === 'g2')

  if ((source('mot.rouge') === 'aucune') !== (source('mot.noir') === 'aucune') && (r.degre('mot.rouge') > 0 || r.degre('mot.noir') > 0))
    defaut('masse-moteur-absente', 'Alimentation du moteur incomplète (borne rouge ou noire non reliée) : le moteur reste immobile')
  if ((r.degre('mot.verte') > 0 || r.degre('mot.jaune') > 0) && nj !== r.masse && nv !== r.masse)
    defaut('dt-flottante', 'Sortie DT non référencée à la masse (borne jaune non reliée) : mesure flottante')
  if (moteurBranche && (commandeMoteur === 'g2' || commandeMoteur === 'erreur'))
    defaut('ampli-oublie', 'Moteur alimenté directement par la platine sans l’ampli de courant : courant limité à 25 mA, le moteur ne démarre pas')
  if (source('plat.mesure') === 'dt-') defaut('dt-inversee', 'DT inversée (verte et jaune) sur l’entrée Mesure : réaction positive')

  const enBoucle = source('plat.mesure') === 'dt+' || source('plat.mesure') === 'dt-'
  const topologie: Topologie = defauts.length ? 'defaut' : !moteurBranche ? 'incomplet' : regulateurEnChaine && enBoucle ? 'boucle-fermee' : 'boucle-ouverte'
  return {
    lecteur: (b) => ({ source: source(b), charge: moteurBranche && (r.de(b) === nr || r.de(b) === nn), isole: r.membres[r.de(b)]!.length === 1 && r.degre(b) === 0 }),
    moteurBranche,
    regulateurEnChaine,
    gbfSurPlatine: r.membres[r.de('gbf.out')]!.some((b) => b.startsWith('plat.')),
    topologie,
    defauts,
  }
}

const borne = (v: number, max: number) => Math.max(-max, Math.min(max, v))

/**
 * Simulation temporelle pure du banc (PRD §4.1, §4.2). Moteur + DT :
 *   u_eff = u − Uf·s(t) − u_bouteille ; τa·dx1/dt = G0r·u_eff − x1 ; τb·dm/dt = x1 − m
 * s(t) = signe de la consigne si le régulateur commande le moteur, sinon signe de la tension moteur.
 * Zone morte : moteur à l'arrêt et |u| < Uf → il reste à l'arrêt (et s'arrête s'il repasse par zéro).
 * Euler explicite au pas banc.pas. Bruit : σ = bruit·Δm (Δm tiré d'une première passe sans bruit).
 */
export function simulate(banc: Banc, reglages: ReglagesSim, cablage: Cablage, graine: number): ResultatSim {
  const topo = analyserTopologie(cablage)
  const evenements = [...topo.defauts]
  const h = transfertRegulateur(reglages.platine.z1, reglages.platine.z2)
  if (!h) evenements.push({ t: 0, type: 'defaut', code: 'regulateur-non-gere', message: 'Composants de Z1/Z2 non gérés : régulateur hors service' })
  if (banc.bruit > 0) {
    const sansBruit = boucle(banc, reglages, topo, graine, 0, [])
    let max = -Infinity
    let min = Infinity
    for (const v of sansBruit.vitesse) {
      max = Math.max(max, v)
      min = Math.min(min, v)
    }
    return { ...boucle(banc, reglages, topo, graine, banc.bruit * (max - min), evenements), evenements }
  }
  return boucle(banc, reglages, topo, graine, 0, evenements)
}

function boucle(banc: Banc, reglages: ReglagesSim, topo: AnalyseTopologie, graine: number, sigma: number, evenements: Evenement[]): ResultatSim {
  const { pas, uf, tauA, tauB, g0r, usat } = banc
  const p = reglages.platine
  const on = p.sousTension
  const h = transfertRegulateur(p.z1, p.z2)
  const { A, B, D } = h ? formeEtat(h) : { A: 0, B: 0, D: 0 }
  const K = gainAffichage(p.g1, p.g2)
  const n = Math.max(1, Math.round(reglages.duree / pas))
  const decim = Math.max(1, Math.round(reglages.pasSortie / pas))
  const nOut = Math.floor(n / decim) + 1
  const out = { t: new Float64Array(nOut), voie1: new Float64Array(nOut), voie2: new Float64Array(nOut), voie3: new Float64Array(nOut), voie4: new Float64Array(nOut), vitesse: new Float64Array(nOut), commande: new Float64Array(nOut) }
  const voies = [out.voie1, out.voie2, out.voie3, out.voie4]

  const alea = mulberry32(graine)
  const gauss = gaussien(alea)
  const deuxPi = 2 * Math.PI
  const phiSecteur = deuxPi * alea()
  let phiOnd = deuxPi * alea()
  const wSecteur = deuxPi * banc.secteurHz
  const kOnd = deuxPi * banc.ondulationHzParV * pas

  const L = {
    consigne: topo.lecteur('plat.consigne'),
    mesure: topo.lecteur('plat.mesure'),
    ampliIn: topo.lecteur('plat.ampliIn'),
    rouge: topo.lecteur('mot.rouge'),
    noir: topo.lecteur('mot.noir'),
  }
  const osc = (['osc.v1', 'osc.v2', 'osc.v3', 'osc.v4'] as const).map((b) => topo.lecteur(b))
  const limiteAmpli = banc.imaxAmpli * banc.rInduit
  const limiteG2 = banc.imaxG2 * banc.rInduit
  const diviseurGbf = banc.rInduit / (banc.rInduit + banc.zGbf)
  const gbf = generateurGbf(reglages.gbf)
  // Platine éteinte : le GBF qui lui est relié donne un carré dissymétrique (palier bas réduit)
  const basGbf = !on && topo.gbfSurPlatine ? 1 - banc.dissymetrieGbf : 1
  const ampliColle = !on ? null : p.ampli === 'bloque-haut' ? usat : p.ampli === 'bloque-zero' ? 0 : null
  const regulateur = on && h !== null
  const enBoucle = L.mesure.source === 'dt+' || L.mesure.source === 'dt-'
  const bouteilleT = reglages.bouteilleT ?? Infinity

  let x1 = 0
  let m = 0
  let arret = true
  let xi = 0
  let g2 = 0
  let erreur = 0
  let ampli = 0
  let vg = 0
  let mMes = 0
  let sature = false
  let t = 0

  /** Mesure de la DT : vitesse + bruit gaussien + ondulation de commutation (tirée seulement quand on la lit) */
  const mesurerDt = () => m + (sigma ? sigma * gauss() : 0) + banc.ondulation * Math.abs(m) * Math.sin(phiOnd)

  const lire = (l: Lecteur): number => {
    switch (l.source) {
      case 'gbf':
        return l.charge ? vg * diviseurGbf : vg
      case 'p12':
        return on ? banc.alim : 0
      case 'm12':
        return on ? -banc.alim : 0
      case 'masse':
        return 0
      case 'ampli':
        return l.charge ? borne(ampli, limiteAmpli) : ampli
      case 'g2':
        return l.charge ? borne(g2, limiteG2) : g2
      case 'erreur':
        return l.charge ? borne(erreur, limiteG2) : erreur
      case 'dt+':
        return mMes
      case 'dt-':
        return -mMes
      case 'aucune':
        return l.isole ? 0 : banc.flottant * Math.sin(wSecteur * t + phiSecteur)
    }
  }

  for (let i = 0; i <= n; i++) {
    t = i * pas
    const sortie = i % decim === 0
    vg = gbf(t)
    if (vg < 0) vg *= basGbf
    if (enBoucle || sortie) mMes = mesurerDt()

    // Platine : régulateur (sortie G2 bornée, intégrateur sans anti-emballement), borne Erreur, ampli de courant
    const c = lire(L.consigne)
    if (regulateur) {
      const e = c - lire(L.mesure)
      const y = K * (D * e + xi)
      g2 = borne(y, usat)
      if (!sature && Math.abs(y) >= usat) {
        sature = true
        evenements.push({ t, type: 'saturation', code: 'saturation-g2', message: 'Sortie G2 saturée à ±USAT' })
      }
      xi += pas * (A * xi + B * e)
      erreur = borne(e, usat)
    }
    ampli = !on ? 0 : (ampliColle ?? banc.gainAmpli * lire(L.ampliIn))

    // Moteur + DT
    const u = topo.moteurBranche ? lire(L.rouge) - lire(L.noir) : 0
    if (!(arret && Math.abs(u) < uf)) {
      const s = topo.regulateurEnChaine ? Math.sign(c) : Math.sign(u)
      const ueff = u - uf * s - (t >= bouteilleT ? banc.bouteille : 0)
      const nx1 = x1 + (pas / tauA) * (g0r * ueff - x1)
      const nm = m + (pas / tauB) * (x1 - m)
      // Frottement sec : si la commande est dans la zone morte et que la vitesse repasse par zéro, le moteur s'arrête
      arret = Math.abs(u) < uf && nm * m <= 0
      x1 = arret ? 0 : nx1
      m = arret ? 0 : nm
    }
    phiOnd += kOnd * Math.abs(m)

    if (sortie) {
      const k = i / decim
      out.t[k] = t
      out.vitesse[k] = m
      out.commande[k] = g2
      for (let j = 0; j < osc.length; j++) voies[j]![k] = lire(osc[j]!)
    }
  }
  return { ...out, evenements, topologie: topo.topologie }
}

/**
 * Vitesse affichée par l'animation du moteur, en fraction de la pleine échelle G0r·USAT : moyenne de |m|
 * sur la dernière période simulée (sans bruit), ramenée à 0 sous le seuil VITESSE_ARRET (moteur arrêté).
 */
export function vitesseAffichee(banc: Banc, reglages: Omit<ReglagesSim, 'duree' | 'pasSortie'>, cablage: Cablage): number {
  const periode = reglages.gbf.forme === 'continu' || reglages.gbf.frequence <= 0 ? banc.tauA : 1 / reglages.gbf.frequence
  const tours = au3('PERIODES_CHAUFFE') + 1
  const pasSortie = banc.pas * Math.max(1, Math.round(periode / au3('OSC_POINTS') / banc.pas))
  const r = simulate({ ...banc, bruit: 0, ondulation: 0 }, { ...reglages, duree: tours * periode, pasSortie }, cablage, 0)
  const debut = Math.floor((r.t.length * (tours - 1)) / tours)
  let somme = 0
  for (let i = debut; i < r.t.length; i++) somme += Math.abs(r.vitesse[i]!)
  const v = somme / Math.max(1, r.t.length - debut) / (banc.g0r * banc.usat)
  return v < au3('VITESSE_ARRET') ? 0 : Math.min(1, v)
}
