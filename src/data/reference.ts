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
  /** Inductance réelle d'une phase (modèle) — H (6,885 mH) — calé avec ke (voir stepper.test.ts) */
  lReelle: 6.885e-3,
  /** Résistance d'une phase — Ω — hypothèse */
  rPhase: 1.5,
  /** Freq2, passage en mode tension en pas entier — Hz (≈ 1400 Hz, à obtenir par calage de la f.c.é.m.) — CR */
  freq2: 1400,
  /** Fréquence de décrochage — Hz (au-delà de ≈ 2,5 kHz) — hypothèse */
  fDecrochage: 2500,
  /** Périodes d'horloge par période de courant selon le mode — sans unité — cours */
  periodesHorlogeParPeriodeCourant: { entier: 4, demi: 8, quart: 16 } as const satisfies Record<ModePas, number>,
  /** Déphasage I_A / I_B — fraction de période (T/4), signe inversé avec DIR — CR */
  dephasageIaIb: 0.25,
  /** Constante de f.c.é.m. Ke (e = Ke·Ω·signe(consigne)) — V·s/rad — calé avec lReelle : Freq2 ≈ 1425 Hz et L apparente = 9,7 mH à 1 kHz (voir stepper.test.ts) */
  ke: 0.1366,
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
} as const

/* ───────────────────────────────── Commun ───────────────────────────────── */

/** Bruit relatif ajouté à toutes les lectures — sans unité (±1 à 2 %) — hypothèse (PRD) */
export const BRUIT = { min: 0.01, max: 0.02 } as const

/** Pince ampèremétrique de l'oscilloscope : sensibilité — V/A (100 mV/A) — hypothèse */
export const PINCE_SENSIBILITE = 0.1
