/**
 * Valeurs de référence de TP-Sim — SEULE source de constantes physiques du projet.
 * Ne jamais redéfinir ces valeurs ailleurs : importer depuis ce fichier.
 *
 * Unités : SI de base (V, A, Ω, H, F, s, Hz, W…) ; l'unité usuelle est rappelée en commentaire.
 * Sources : « CR » = comptes rendus, « énoncé » = sujet de TP / datasheet, « hypothèse » = à vérifier.
 */

/* ───────────────────────────── Alim à découpage ───────────────────────────── */

export interface PointRendement {
  /** Puissance de sortie — W */
  ps: number
  /** Rendement — sans unité (0…1) */
  eta: number
}

export const ALIM = {
  /** Tension d'alimentation E — V — énoncé */
  E: 5,
  /** Shunt de mesure de i1 — Ω — énoncé */
  rShunt: 1,
  /** Inductance magnétisante Lm — H (22 mH) — CR */
  lm: 22e-3,
  /** Tension zener Vz — V — CR */
  vz: 15.8,
  /** Aire d'impulsion E·t avant saturation, mesurée — V·s (≈ 880 V·µs) — CR */
  aireSaturationMesuree: 880e-6,
  /** Aire d'impulsion avant saturation, constructeur — V·s (1100 V·µs) — énoncé */
  aireSaturationConstructeur: 1100e-6,
  /** Courant au début de la saturation — A (≈ 86 mA) — CR */
  iDebutSaturation: 86e-3,
  /** Résistance de charge Rs — Ω — énoncé */
  rCharge: 330,
  /** Condensateur de filtrage C — F (10 µF) — énoncé */
  c: 10e-6,
  /** Inductance magnétisante constructeur (IT237) — H (25 mH) — CR */
  lmConstructeur: 25e-3,
  /** Tension de seuil de la diode D2 — V — hypothèse, à vérifier */
  vd: 0.7,
  /** Division de Lm au-delà de l'aire de saturation — sans unité — hypothèse */
  facteurSaturation: 20,
  /** Courant primaire maximal (alim E à travers le shunt) — A — hypothèse */
  iLimite: 5,
} as const

export const FLYBACK = {
  /** Tension d'entrée minimale — V — datasheet MAX17691B (CR) */
  veMin: 18,
  /** Tension d'entrée maximale — V — datasheet MAX17691B (CR) */
  veMax: 36,
  /** Tension d'entrée par défaut — V — CR */
  veDefaut: 30,
  /** Tension de sortie Vs — V — datasheet MAX17691B (CR) */
  vs: 5,
  /** Courant de sortie nominal — A — datasheet MAX17691B (CR) */
  isNominal: 1.5,
  /** Rendement nominal (à Is nominal) — sans unité (87 %) — datasheet MAX17691B (CR) */
  etaNominal: 0.87,
  /** Fréquence de découpage — Hz (150 kHz) — datasheet MAX17691B (CR) */
  fDecoupage: 150e3,
  /** Rapport de transformation m = n2/n1 — sans unité — hypothèse, à vérifier */
  m: 1 / 3,
  /** Seuil de diode de sortie, même valeur que D2 — V — hypothèse, à vérifier */
  vd: 0.7,
  /** Courant de charge sous lequel on passe en conduction discontinue — A — hypothèse, à vérifier */
  iDiscontinu: 0.15,
  /** Plage de courant réglée au rhéostat (valeur max → mini) — A — 0,5 A énoncé, 0,05 A hypothèse (PRD) */
  isMin: 0.05,
  isMax: 0.5,
  /**
   * Formes d'onde, aspect seulement (n'influe sur aucune grandeur mesurée) — hypothèse, à vérifier :
   * oscillation de conduction discontinue (fréquence, amortissement), pic de commutation au blocage
   * (amplitude relative, fréquence, amortissement), bruit relatif.
   */
  formeOnde: { fDcm: 1.2e6, tauDcm: 0.35e-6, pic: 0.35, fPic: 18e6, tauPic: 60e-9, bruit: 0.015 },
  /** Rendement selon la puissance de sortie — CR, plafonné au réaliste (≈ 89 % à 2,5 W) */
  rendement: [
    { ps: 0.5, eta: 0.8 },
    { ps: 1.3, eta: 0.87 },
    { ps: 2.5, eta: 0.89 },
  ] as const satisfies readonly PointRendement[],
  /** Rendement de l'alim linéaire équivalente η = Vs/Ve à Ve = 30 V — sans unité (17 %) — CR */
  etaLineaire30V: 0.17,
} as const

/* ───────────────────────────── Moteur pas à pas ───────────────────────────── */

export type ModePas = 'entier' | 'demi' | 'quart'

export const PAP = {
  /** Pas par tour selon le mode — pas/tr — énoncé. Vitesse : N = 60·f / Np (tr/min). */
  pasParTour: { entier: 200, demi: 400, quart: 800 } as const satisfies Record<ModePas, number>,
  /** Tension d'alimentation des phases — V — énoncé */
  vAlim: 15,
  /** Consigne de courant — A — énoncé */
  iConsigne: 1,
  /** Largeur d'hystérésis de la régulation de courant — A (1 A / 0,9 A) — énoncé */
  hysteresis: 0.1,
  /** Inductance apparente d'une phase, L = 15·Δt/Δi à 1 kHz en pas entier — H (9,7 mH ; Δt = 1,28 ms, Δi = 1,98 A) — CR, valeur cible */
  lApparenteMesuree: 9.7e-3,
  /** Inductance réelle d’une phase (modèle) — H (6,894 mH) — calé avec ke (voir stepper.test.ts) */
  lReelle: 6.894e-3,
  /** Résistance d’une phase — Ω — hypothèse, faible devant E − e pour un courant bien triangulaire à Freq2 */
  rPhase: 0.5,
  /** Freq2, passage en mode tension en pas entier — Hz (≈ 1400 Hz, à obtenir par calage de la f.c.é.m.) — CR */
  freq2: 1400,
  /** Fréquence de décrochage — Hz (au-delà de ≈ 2,5 kHz) — hypothèse */
  fDecrochage: 2500,
  /** Périodes d'horloge par période de courant selon le mode — sans unité — cours */
  periodesHorlogeParPeriodeCourant: { entier: 4, demi: 8, quart: 16 } as const satisfies Record<ModePas, number>,
  /** Déphasage I_A / I_B — fraction de période (T/4), signe inversé avec DIR — CR */
  dephasageIaIb: 0.25,
  /** Constante de f.c.é.m. Ke (e = Ke·Ω·signe(consigne)) — V·s/rad — calé avec lReelle : Freq2 ≈ 1425 Hz et L apparente = 9,7 mH à 1 kHz (voir stepper.test.ts) */
  ke: 0.1379,
} as const

/**
 * Driver TB6600 : micro-pas selon S1-S2-S3 (true = ON = haut). Toute autre combinaison : moteur inactif.
 * Énoncé — hypothèse, à vérifier sur l'étiquette du driver (en particulier la ligne 1/4 de pas).
 */
export const TB6600_MODES: readonly { s: readonly [boolean, boolean, boolean]; mode: ModePas }[] = [
  { s: [true, true, false], mode: 'entier' },
  { s: [true, false, true], mode: 'demi' },
  { s: [true, false, false], mode: 'quart' },
]

/* ─────────────── Machine asynchrone (couplage triangle, 400 V, 50 Hz) ─────────────── */

export interface PointMas {
  /** Couple de charge — N·m */
  couple: number
  /** Vitesse — tr/min */
  n: number
  /** Courant de ligne Is — A */
  is: number
  /** Tension simple V — V */
  v: number
  /** Puissance active absorbée Pa — W */
  pa: number
  /** Puissance réactive absorbée Qa — var */
  qa: number
}

export const MAS = {
  /** Relevés en charge, triangle 400 V 50 Hz (interpolés selon le couple) — CR */
  releves: [
    { couple: 0, n: 1497, is: 1.8, v: 240, pa: 199, qa: 1270 },
    { couple: 2.5, n: 1483, is: 1.9, v: 238, pa: 594, qa: 1256 },
    { couple: 5, n: 1467, is: 2.4, v: 239, pa: 1060, qa: 1373 },
    { couple: 7.5, n: 1452, is: 2.9, v: 236, pa: 1538, qa: 1390 },
    { couple: 10, n: 1436, is: 3.6, v: 238, pa: 2027, qa: 1489 },
  ] as const satisfies readonly PointMas[],
  /** Réseau : tension composée — V — énoncé */
  uReseau: 400,
  /** Réseau : fréquence — Hz — énoncé */
  fReseau: 50,
  /** Plaque signalétique — CR (relevé de plaque) */
  plaque: {
    /** Couplage plaque : Δ 400 V / Y 690 V — tensions triangle / étoile — V */
    u: [400, 690],
    /** Courants nominaux triangle / étoile — A */
    i: [3.4, 1.97],
    /** Puissance utile nominale — W (1,5 kW) */
    pn: 1500,
    /** Vitesse nominale — tr/min */
    nn: 1440,
    /** Facteur de puissance nominal — sans unité */
    cosPhi: 0.77,
    /** Nombre de paires de pôles — sans unité */
    p: 2,
  },
  /** Résistance statorique à chaud Rs — Ω — CR */
  rsChaud: 12,
  /** Essai à vide en étoile sur 400 V : puissance absorbée P0 — W — CR */
  p0Etoile400: 49.8,
  /** Essai à vide en étoile sur 400 V : courant I0 — A — CR */
  i0Etoile400: 0.5,
  /** Sensibilité du capteur de couple — V/(N·m) — énoncé */
  capteurCouple: 0.3,
  /** Tension maximale du capteur de couple — V — énoncé */
  capteurLimite: 3,
  /** Limite de courant de ligne (coupure) — A — CR, consigne enseignant (3,4 A = courant nominal plaque) */
  iLimite: 3.9,
  /** Variateur : vitesse à vide par hertz, N ≈ 30·f — (tr/min)/Hz — CR */
  variateurNParHz: 30,
  /** Variateur : loi du fondamental U = 8,15 V/Hz × f (tension composée) — V/Hz — CR, moyenne des 3 points */
  variateurUsurF: 8.15,
  /** Variateur : créneaux de sortie ±450 V — V — énoncé */
  variateurCreneau: 450,
  /** Variateur : fréquence de découpage des créneaux — Hz (3 kHz) — énoncé */
  variateurFDecoupage: 3000,
  /** Variateur : composante harmonique Uh vue en mesure RMS — V — hypothèse pédagogique */
  variateurUh: 200,
  /** Variateur : points mesurés du fondamental U(f), conservés comme repère — Hz → V — CR */
  variateurPoints: [
    { f: 15, u: 121.8 },
    { f: 35, u: 302 },
    { f: 50, u: 409.6 },
  ] as const,
  /** Montage 1 (réseau) : sorties du commutateur 3 wattmètres où la pince de l'analyseur est acceptée — hypothèse, à vérifier */
  pinceMontage1: ['S1', 'S2', 'S3'] as const,
  /** Montage 2 (variateur) : sorties du variateur où la pince de l'analyseur est acceptée — hypothèse, à vérifier */
  pinceMontage2: ['U/T1', 'V/T2', 'W/T3'] as const,
  /** Repérage des bornes de puissance du variateur Schneider (entrée réseau / sortie moteur) — hypothèse, à vérifier */
  bornesVariateur: { entree: ['R/L1', 'S/L2', 'T/L3'], sortie: ['U/T1', 'V/T2', 'W/T3'] } as const,
  /** Tension lue par l'analyseur : simple (phase–N) en montage 1, composée (entre 2 sorties) en montage 2 — hypothèse, à vérifier */
  tensionAnalyseur: { montage1: 'simple', montage2: 'composee' } as const,
} as const

/* ───────────────────────────────── Commun ───────────────────────────────── */

/** Bruit relatif ajouté à toutes les lectures — sans unité (±1 à 2 %) — hypothèse (PRD) */
export const BRUIT = { min: 0.01, max: 0.02 } as const

/** Pince ampèremétrique de l'oscilloscope : sensibilité — V/A (100 mV/A) — hypothèse */
export const PINCE_SENSIBILITE = 0.1

/* ───────── Oscilloscope numérique 2 voies réaliste (type InfiniiVision, src/lib/scope/) ───────── */

export const OSCILLO = {
  /** Divisions de l'écran, horizontales / verticales — sans unité — constructeur */
  divX: 10,
  divY: 8,
  /** Calibres verticaux extrêmes à l'entrée BNC, suite 1-2-5 — V/div — constructeur */
  vdivMin: 2e-3,
  vdivMax: 5,
  /** Bases de temps extrêmes, suite 1-2-5 — s/div — constructeur */
  sdivMin: 2e-9,
  sdivMax: 10,
  /** Profondeur mémoire — points — ordre de grandeur, hypothèse */
  memoire: 1e6,
  /** Fréquence d'échantillonnage maximale — Sa/s (2 GSa/s) — constructeur */
  fsMax: 2e9,
  /** Résolution du CAN sur la plage verticale de l'écran — bits — constructeur */
  bits: 8,
  /** Bruit propre ramené à l'entrée — V RMS (≈ 1 mV) — ordre de grandeur, hypothèse */
  bruit: 1e-3,
  /** Bande passante à −3 dB, passe-bas du 1er ordre (montée ≈ 0,35/BP ≈ 3,5 ns) — Hz — constructeur */
  bandePassante: 100e6,
  /** Impédance d'entrée — Ω (1 MΩ) — constructeur */
  rEntree: 1e6,
  /** Temps mort entre deux acquisitions (≈ 50 000 acquisitions/s) — s — ordre de grandeur, hypothèse */
  tempsMort: 20e-6,
  /** Holdoff réglable, minimum = valeur par défaut — s — constructeur */
  holdoffMin: 40e-9,
  holdoffMax: 10,
  /** Attente sans déclenchement avant balayage libre en mode Auto — s — hypothèse */
  autoTimeout: 0.05,
  /** Default Setup : CH1 seule, 5 V/div, 100 µs/div — constructeur */
  defautVdiv: 5,
  defautSdiv: 100e-6,
  /** Cran du réglage fin du calibre vertical — facteur multiplicatif — hypothèse */
  cranFin: 1.02,
} as const

/* ───────── Réseaux RES3 · TP3 Ethernet 10Base2 (src/lib/reseaux/ethernet.ts, traffic.ts) ───────── */

export const ETH10B2 = {
  /** Débit — bit/s (10 Mbit/s, 100 ns par bit) — norme IEEE 802.3 */
  debit: 10e6,
  /** Octets de préambule (55h) avant le SFD (D5h) — norme */
  preambule: 7,
  /** Charge utile minimale d'une trame (bourrage au-delà) — octets — norme */
  payloadMin: 46,
  /** MTU Ethernet — octets — norme */
  mtu: 1500,
  /** Données IP par fragment (MTU − en-tête IP de 20 octets) — octets — norme */
  fragment: 1480,
  /** Espace inter-trame — s (9,6 µs = 96 temps bit) — norme */
  ifg: 9.6e-6,
  /** TTL des paquets émis par Windows — sans unité — cours */
  ttlWindows: 128,
  /** Courant tiré par la carte pendant la trame : 40 ± 30 mA — A — cours */
  iMoyen: 40e-3,
  iEcart: 30e-3,
  /** Charge vue par la carte : deux demi-câbles bouchonnés en parallèle (50 Ω // 50 Ω) — Ω — cours */
  zCharge: 25,
  /** Durée des fronts du signal Manchester — s (≈ 25 ns) — ordre de grandeur, hypothèse */
  front: 25e-9,
  /** Fin de trame : maintien au niveau haut puis retour à 0 V — s — ordre de grandeur, hypothèse */
  finMaintien: 200e-9,
  finRetour: 100e-9,
  /** Délai de réponse de l'automate TSX 57 à un ping — s (0,5 à 2 ms) — hypothèse */
  reponseMin: 0.5e-3,
  reponseMax: 2e-3,
  /** Durée de vie d'une entrée du cache ARP du PC (simulée) — s — hypothèse */
  arpCache: 60,
  /** Broadcasts de fond (ARP, UDP) par seconde — hypothèse */
  broadcastsMin: 2,
  broadcastsMax: 5,
  /** Part des broadcasts de fond qui sont des UDP (le reste : requêtes ARP) — hypothèse */
  partUdp: 0.2,
  /** Distance point d'observation → extrémité dont on retire le bouchon — m — énoncé */
  dBouchon: 15,
  /** Vitesse de propagation dans le RG58 — m/s — ordre de grandeur, hypothèse */
  v: 2e8,
  /** Longueur du coax de la salle — m (≈ 40 m) — énoncé */
  lSalle: 40,
  /** Plage du ping « valeur mystère » et du partiel — octets */
  pingMin: 1,
  pingMax: 1472,
  /** Part des tirages du partiel sous 18 octets (bourrage obligatoire) */
  partBourrage: 0.3,
  /** Tolérance sur les durées mesurées — relative (±2 %) */
  tolDuree: 0.02,
} as const

/* ───────── Réseaux RES3 · partiel pratique (src/lib/reseaux/partiel.ts) ───────── */

export const RES3_PARTIEL = {
  /** Durée de l'épreuve — s (1 h 30) — énoncé */
  dureeS: 90 * 60,
  /**
   * PARTIEL_BAREME — points par question ; parties : câble 7, trame série 6, ping 7 (total 20) — hypothèse,
   * à valider avec l'enseignant (répartition interne aux parties choisie par nous)
   */
  PARTIEL_BAREME: {
    cable: { zc: 2, l: 2, gammaOpen: 1, gammaShort: 1, methode: 1 },
    serie: { baud: 1.5, parity: 1.5, level: 1, message: 2 },
    ping: { L: 2, padding: 1.5, durationUs: 2, macByte: 1.5 },
  },
  /**
   * Tolérances : points pleins à ±5 % (Zc, l) et ±2 % (durée), moitié à ±10 % et ±5 % ;
   * Γ, parité, norme, L, bourrage et octet de MAC exacts ; message au prorata des caractères justes
   */
  tolZc: 0.05,
  tolZcMoitie: 0.1,
  tolL: 0.05,
  tolLMoitie: 0.1,
  tolDuree: 0.02,
  tolDureeMoitie: 0.05,
} as const

/* ───────── Réseaux RES3 · trame série du partiel (src/lib/reseaux/serial.ts) ───────── */

export const RES3_SERIE = {
  /** Débits normalisés proposés — baud — cours (RS-232) */
  debits: [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200] as const,
  /**
   * Tirage pondéré du débit : part des débits ≤ debitLentMax (1200 à 19200 bauds), le reste de 38400 à 115200
   * — sans unité (85 %) — hypothèse. Niveaux TTL / RS-232 : ceux mesurés au TP2 (src/modbus/data/reference.ts).
   */
  partDebitsLents: 0.85,
  debitLentMax: 19200,
  /** Fronts : TTL ≈ 20 ns ; RS-232 limité en vitesse de balayage ≈ 30 V/µs — s, V/s — ordres de grandeur, hypothèse */
  frontTtl: 20e-9,
  slewRs232: 30e6,
  /** Le message est réémis en boucle toutes les ≈ 200 ms — s — hypothèse */
  periode: 0.2,
  /** Bits de repos tirés entre deux caractères : 0 à 3 */
  reposMax: 3,
  /** Débit mesuré : points pleins à ±3 % (ou valeur normalisée exacte), moitié à ±10 % — relatif */
  tolDebit: 0.03,
  tolDebitMoitie: 0.1,
  /** Mots du message : 2 à 4 caractères ASCII imprimables */
  mots: ['OK', 'Go', 'TP3', 'Hi!', 'R2D2', '42', 'Net', 'bus', 'ON', 'off', 'IUT', 'Ok7', 'GEII', 'abc', 'Z80', 'x=1', 'Rx', 'Tx', '7E1', 'Ping', 'LAN', 'b10', 'Mux', 'Ack'] as const,
} as const

/* ───────── Réseaux RES3 · TP1 câble coaxial (src/lib/reseaux/coax.ts) ───────── */

export interface CableType {
  /** Impédance caractéristique — Ω */
  zc: number
  /** Atténuation à 5 MHz — dB/100 m — ordre de grandeur, hypothèse */
  alpha5M: number
  /** Atténuation à 10 MHz (utilisée pour les impulsions de 40 ns) — dB/100 m — ordre de grandeur, hypothèse */
  alpha10M: number
}

export const RES3 = {
  /** Fém du générateur d'impulsions réglée à vide (consigne) — V — énoncé */
  eg: 8,
  /** Résistance interne du générateur — Ω — énoncé */
  zg: 50,
  /** Vitesse de propagation dans le câble (≈ 2c/3) — m/s — ordre de grandeur, hypothèse */
  v: 2e8,
  /** Impulsion de consigne : largeur et période — s (40 ns, 1 ms) — énoncé */
  largeur: 40e-9,
  periode: 1e-3,
  /** Largeur d'impulsion de l'étude basse fréquence §3.2.3 — s (100 µs) — énoncé */
  largeurBF: 100e-6,
  /**
   * Pertes en impulsion (effet de peau) : passe-bas du 1er ordre dont la constante de temps croît comme
   * le carré de la longueur parcourue, calé pour que l'écho d'un câble de 100 m ouvert vaille 0,8 × l'incident
   * (impulsion de 40 ns) — sans unité — hypothèse, à recalibrer sur mesures réelles
   */
  ECHO_RATIO_100M: 0.8,
  /** Longueur de calage de ECHO_RATIO_100M : aller-retour sur 100 m — m */
  lCalagePeau: 200,
  /** Temps de front du générateur d'impulsions — s (≈ 3 ns) — ordre de grandeur, hypothèse */
  front: 3e-9,
  /** Fréquence du sinus §3.2.2 e — Hz (5 MHz) — énoncé */
  fSinus: 5e6,
  /** Câbles : RG58 50 Ω et RG59 75 Ω — ordres de grandeur, hypothèse (RG59 à 10 MHz ≈ 2,5·√2) */
  cables: {
    RG58: { zc: 50, alpha5M: 3.5, alpha10M: 5 },
    RG59: { zc: 75, alpha5M: 2.5, alpha10M: 3.5 },
  } as const satisfies Record<string, CableType>,
  /** Arrêt de la somme du treillis : terme < 1 mV ou 500 allers-retours — V, sans unité */
  seuilTerme: 1e-3,
  kMax: 500,
  /** Potentiomètre d'extrémité — Ω (0 à 200 Ω) — énoncé */
  potMax: 200,
  /** Bouchons d'extrémité disponibles — Ω — énoncé */
  bouchons: [50, 75] as const,
  /** Précision de l'ohmmètre — relative (±0,5 %) — ordre de grandeur, hypothèse */
  ohmmetreTol: 0.005,
  /** Cordon BNC du mode « générateur à vide » — m — hypothèse */
  lCordon: 1,
  /** Câble mystère : longueur entière tirée dans [40 ; 120] m — énoncé */
  lMin: 40,
  lMax: 120,
  /** Diamètres possibles de l'enroulement — m — hypothèse */
  diametres: [0.2, 0.25, 0.3] as const,
  /** Écart maximal entre N·π·D et la longueur réelle — relatif (±8 %) */
  ecartSpires: 0.08,
  /** Tolérances de correction : mesures ±5 %, longueur par les spires ±10 %, écart entre méthodes de Zc < 10 % */
  tolMesure: 0.05,
  tolSpires: 0.1,
  /** Tolérance absolue sur un déphasage — degrés */
  tolPhaseDeg: 5,
  ecartMethodes: 0.1,
  /** Réglages du générateur à l'arrivée en salle (avant réglage par l'étudiant) — hypothèse */
  genInitial: { eg: 1, largeur: 1e-6, periode: 10e-3, f: 1e6 },
} as const


/* ───────────── INFO3 : constantes dans reference.info3.ts, réexportées ici (seule source) ───────────── */
export { INFO3, info3Hypothese, type Info3Hypothese, type SfrDef } from './reference.info3'

/* ───────────── AU3 : constantes dans reference.au3.ts, réexportées ici (seule source) ───────────── */
export { AU3, AU3_LISTES, AU3_EPSILON, au3, type RefKey, type RefEntry, type RefListe, type RefSource } from './reference.au3'
