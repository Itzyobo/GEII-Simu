/**
 * Constantes AU3 (moteur à courant continu + dynamo tachymétrique, platine « Régulateur analogique »,
 * GBF TTi TG315, oscilloscope Keysight DSOX2004A). SEULE source de nombres du module AU3 :
 * src/au3/ n'en contient aucun hors 0, 1, -1, 2 et les index (test src/au3/constantes.test.ts).
 *
 * `AU3` : valeurs de modèle et de réglage, typées RefEntry (source « CR », « enonce » ou « hypothese »).
 * `AU3_INSTRUMENTS` : listes et géométrie des instruments et de l'interface (calibres, pixels, couleurs
 * de voies), qui ne sont ni des mesures ni des paramètres de modèle.
 * Unités SI de base (V, A, Ω, F, s, Hz). Référence : « PRD — Simulateur de TP AU3 (MCC).md » §3.
 */

export type RefSource = 'CR' | 'enonce' | 'hypothese'

export interface RefEntry {
  valeur: number
  unite: string
  source: RefSource
  note?: string
  /** Tolérance relative d'une cible de test (PRD §6), quand il y en a une */
  tol?: number
}

const AU3_VALEURS = {
  /* ───────────── Énoncé : platine « Régulateur analogique » ───────────── */
  USAT: { valeur: 10.6, unite: 'V', source: 'enonce', note: 'Saturation de la sortie G2 : 12 V – somme des tensions de seuil de 2 diodes (méthodes de travail, point 5)' },
  ALIM_PLATINE: { valeur: 12, unite: 'V', source: 'enonce', note: 'Sorties ±12 V de la platine (TP3)' },
  GAIN_AMPLI_COURANT: { valeur: 1, unite: '', source: 'enonce', note: 'TP1 p. 6 : « Le gain en tension de cet ampli est 1 »' },
  IMAX_AMPLI: { valeur: 1, unite: 'A', source: 'enonce', note: 'Ampli de courant < 1 A (figures TP1/TP2)' },
  IMAX_SORTIE_G2: { valeur: 0.025, unite: 'A', source: 'enonce', note: 'Sortie de l’amplificateur G2 < 25 mA (TP2 câblage 2)' },
  K_P_DIVISEUR: { valeur: 100, unite: '', source: 'enonce', note: 'K = Affichage G1 × G2 / 100 (TP2 : K = 38*10/100)' },
  AFFICHAGE_G1_MAX: { valeur: 99, unite: '', source: 'enonce', note: 'Affichage G1 de 00 à 99' },
  G2_X1: { valeur: 1, unite: '', source: 'enonce', note: 'Sélecteur G2 ∈ {1, 10, 100}' },
  G2_X10: { valeur: 10, unite: '', source: 'enonce' },
  G2_X100: { valeur: 100, unite: '', source: 'enonce' },
  R1: { valeur: 10e3, unite: 'Ω', source: 'enonce', note: 'TP4 : R1 de 10 kΩ sur Z1' },
  R2: { valeur: 27e3, unite: 'Ω', source: 'enonce', note: 'TP4 : R2 de 27 kΩ en série avec C2 sur Z2' },
  C2: { valeur: 330e-9, unite: 'F', source: 'enonce', note: 'TP4 : C2 de 330 nF' },

  /* ───────────── Énoncé : GBF ───────────── */
  GBF_IMPEDANCE: { valeur: 50, unite: 'Ω', source: 'enonce', note: 'Sortie MAIN OUT 50 Ω (fiche GBF)' },
  GBF_ATTENUATION_DB: { valeur: 20, unite: 'dB', source: 'enonce', note: 'Bouton d’atténuation 20 dB (TP2 I.2, TP4)' },

  /* ───────────── Énoncé : réglages des TP ───────────── */
  TP1_GBF_FREQ: { valeur: 1.3, unite: 'Hz', source: 'enonce' },
  TP1_GBF_VPP: { valeur: 12, unite: 'V', source: 'enonce' },
  TP2_GBF_FREQ: { valeur: 2, unite: 'Hz', source: 'enonce' },
  TP2_K38_GBF_VPP: { valeur: 3.2, unite: 'V', source: 'enonce' },
  TP2_K38_K: { valeur: 3.8, unite: '', source: 'enonce' },
  TP2_K38_G1: { valeur: 38, unite: '', source: 'enonce', note: 'Affichage G1' },
  TP2_K38_G2: { valeur: 10, unite: '', source: 'enonce' },
  TP2_K40_GBF_VPP: { valeur: 0.3, unite: 'V', source: 'enonce' },
  TP2_K40_K: { valeur: 40, unite: '', source: 'enonce' },
  TP2_K40_G1: { valeur: 40, unite: '', source: 'enonce', note: 'Affichage G1' },
  TP2_K40_G2: { valeur: 100, unite: '', source: 'enonce' },
  TP4_GBF_FREQ: { valeur: 4.9, unite: 'Hz', source: 'enonce' },
  TP4_GBF_VPP: { valeur: 0.8, unite: 'V', source: 'enonce' },
  TP4_G1: { valeur: 0.95, unite: '', source: 'enonce', note: 'Affichage G1 = 95, donc G1 = 0.95' },
  TP4_G2: { valeur: 10, unite: '', source: 'enonce' },
  TP4_TI_ENONCE: { valeur: 0.0091, unite: 's', source: 'enonce', note: 'Ti ≈ 0.0091 s (placement de pôles)' },
  TP4_K_ENONCE: { valeur: 25.8, unite: '', source: 'enonce', note: 'K ≈ 25.8 (zb ≈ 0.7 annoncé)' },
  TP4_BOUTEILLE_T: { valeur: 0.15, unite: 's', source: 'enonce', note: 'Arrivée d’une bouteille à t = 0.15 s (II.4)' },

  /* ───────────── Hypothèses (PRD §3.2 et §3.4, ajustées sur le CR) ───────────── */
  G0R: { valeur: 0.1953, unite: '', source: 'hypothese', note: 'H2 : gain statique réel moteur + DT, ajusté sur les 3 Δm du CR' },
  UF: { valeur: 1.388, unite: 'V', source: 'hypothese', note: 'H1/H2 : frottement sec vu comme une tension opposée au sens commandé' },
  TAU_A: { valeur: 9.27e-3, unite: 's', source: 'hypothese', note: 'H3 : constante de temps lente' },
  TAU_B: { valeur: 2.53e-3, unite: 's', source: 'hypothese', note: 'H3 : constante de temps rapide' },
  BRUIT_DT: { valeur: 0.01, unite: '', source: 'hypothese', note: 'H4 : σ du bruit gaussien de la DT, relatif à Δm' },
  ONDULATION_DT: { valeur: 0.01, unite: '', source: 'hypothese', note: 'H4 : ondulation de commutation, relative à m' },
  ONDULATION_HZ_PAR_V: { valeur: 200, unite: 'Hz/V', source: 'hypothese', note: 'H4 : fréquence de l’ondulation proportionnelle à la vitesse (valeur inventée)' },
  BOUTEILLE: { valeur: 0.5, unite: 'V', source: 'hypothese', note: 'H5 : couple de la bouteille, échelon de tension équivalent' },
  COUPURE_AC_OSCILLO: { valeur: 3.5, unite: 'Hz', source: 'hypothese', note: 'Couplage AC : passe-haut du 1er ordre' },
  PAS_EULER: { valeur: 5e-6, unite: 's', source: 'hypothese', note: 'Pas d’intégration Euler explicite' },
  QUANTIF_OSCILLO_BITS: { valeur: 8, unite: 'bit', source: 'hypothese', note: 'Quantification sur la plage affichée (8 divisions)' },
  R_INDUIT: { valeur: 12, unite: 'Ω', source: 'hypothese', note: 'Résistance vue par la source qui alimente le moteur ; avec 25 mA (G2) le moteur reçoit 0.3 V < Uf : il ne démarre pas' },
  SECTEUR_HZ: { valeur: 50, unite: 'Hz', source: 'hypothese', note: 'Voie flottante : bruit 50 Hz de valeur moyenne nulle' },
  FLOTTANT_AMPLITUDE: { valeur: 0.2, unite: 'V', source: 'hypothese', note: 'Amplitude crête du 50 Hz capté par une entrée en l’air' },
  GBF_VPP_MAX: { valeur: 20, unite: 'V', source: 'hypothese', note: 'Amplitude maximale du TG315 (non donnée par l’énoncé)' },
  GBF_OFFSET_MAX: { valeur: 10, unite: 'V', source: 'hypothese', note: 'Offset maximal du TG315 (non donné par l’énoncé)' },
  GBF_FREQ_MIN: { valeur: 0.1, unite: 'Hz', source: 'hypothese' },
  GBF_FREQ_MAX: { valeur: 100, unite: 'Hz', source: 'hypothese', note: 'Bornée pour le simulateur : « quelques Hertz maximum » en B26' },
  PERIODES_CHAUFFE: { valeur: 1, unite: 'période', source: 'hypothese', note: 'Périodes du GBF simulées avant la recherche du déclenchement (régime périodique établi)' },

  /* ───────────── CR : valeurs apparentes mesurées (PRD §3.1, cibles de test) ───────────── */
  CR_TP1_DU: { valeur: 12.3, unite: 'V', source: 'CR', note: 'ΔU crête-à-crête de l’entrée' },
  CR_TP1_DM: { valeur: 1.86, unite: 'V', source: 'CR', tol: 0.03 },
  CR_TP1_G0: { valeur: 0.151, unite: '', source: 'CR', tol: 0.03 },
  CR_TP1_TAU: { valeur: 11.8e-3, unite: 's', source: 'CR', tol: 0.05, note: 'Modèle : 12.15 ms' },
  CR_TP1_T1: { valeur: 5.2e-3, unite: 's', source: 'CR', tol: 0.05, note: 't1 à 26.4 %' },
  CR_TP1_T3: { valeur: 18e-3, unite: 's', source: 'CR', tol: 0.05, note: 't3 à 80.1 %' },
  CR_TP1_Z: { valeur: 1.22, unite: '', source: 'CR', tol: 0.05, note: 'Abaque' },
  CR_TP1_WN: { valeur: 211.5, unite: 'rad/s', source: 'CR', tol: 0.05, note: 'Abaque' },
  CR_TP1_TR5: { valeur: 33e-3, unite: 's', source: 'CR', note: 'Inclut la dérive lente non modélisée (modèle : 30.7 ms, écart −7 %)' },
  CR_TP2K38_C0: { valeur: 3.26, unite: 'V', source: 'CR' },
  CR_TP2K38_DM: { valeur: 1.1, unite: 'V', source: 'CR' },
  CR_TP2K38_G0B: { valeur: 0.34, unite: '', source: 'CR', tol: 0.03 },
  CR_TP2K38_T1: { valeur: 3.5e-3, unite: 's', source: 'CR', tol: 0.05 },
  CR_TP2K38_T3: { valeur: 10e-3, unite: 's', source: 'CR', tol: 0.05 },
  CR_TP2K38_ZB: { valeur: 0.9, unite: '', source: 'CR', tol: 0.05 },
  CR_TP2K38_WNB: { valeur: 274.3, unite: 'rad/s', source: 'CR', tol: 0.05 },
  CR_TP2K38_TR5: { valeur: 17e-3, unite: 's', source: 'CR', note: 'Inclut la dérive lente (modèle : 15.3 ms, écart −10 %)' },
  CR_TP2K38_UMAX: { valeur: 8.04, unite: 'V', source: 'CR', tol: 0.05, note: 'Capture, voie 3' },
  CR_TP2K40_C0: { valeur: 0.295, unite: 'V', source: 'CR' },
  CR_TP2K40_DM: { valeur: 0.2, unite: 'V', source: 'CR' },
  CR_TP2K40_G0B: { valeur: 0.69, unite: '', source: 'CR', tol: 0.03 },
  CR_TP2K40_D1: { valeur: 0.25, unite: '', source: 'CR', tol: 0.1, note: 'D1 / m(∞)' },
  CR_TP2K40_TPB_2: { valeur: 5.7e-3, unite: 's', source: 'CR', tol: 0.05, note: 'Temps de pic Tpb/2' },
  CR_TP2K40_ZB: { valeur: 0.42, unite: '', source: 'CR', tol: 0.05 },
  CR_TP2K40_WNB: { valeur: 607.3, unite: 'rad/s', source: 'CR', tol: 0.05 },
  CR_TP2K40_TR5: { valeur: 13.8e-3, unite: 's', source: 'CR', note: 'm(∞) lu avant stabilisation (modèle : 12.2 ms, écart −12 %)' },
  CR_TP2K40_UMAX: { valeur: 9.54, unite: 'V', source: 'CR', tol: 0.05, note: 'Capture, voie 3' },
  /* Valeurs Matlab du CR : affichées, non testées (à K = 3.8 elles contredisent les curseurs de 10 %) */
  CR_TP1_MATLAB_O1_G0: { valeur: 0.153, unite: '', source: 'CR', note: 'Matlab ordre 1 — affichée, non testée' },
  CR_TP1_MATLAB_O1_TAU: { valeur: 12.1e-3, unite: 's', source: 'CR', note: 'Matlab ordre 1 — affichée, non testée' },
  CR_TP1_MATLAB_O2_G0: { valeur: 0.152, unite: '', source: 'CR', note: 'Matlab ordre 2 — affichée, non testée' },
  CR_TP1_MATLAB_O2_Z: { valeur: 1.26, unite: '', source: 'CR', note: 'Matlab ordre 2 — affichée, non testée' },
  CR_TP1_MATLAB_O2_WN: { valeur: 218.4, unite: 'rad/s', source: 'CR', note: 'Matlab ordre 2 — affichée, non testée' },
  CR_TP2K38_MATLAB_G0B: { valeur: 0.34, unite: '', source: 'CR', note: 'Matlab — affichée, non testée' },
  CR_TP2K38_MATLAB_ZB: { valeur: 1.01, unite: '', source: 'CR', note: 'Matlab — affichée, non testée' },
  CR_TP2K38_MATLAB_WNB: { valeur: 297.6, unite: 'rad/s', source: 'CR', note: 'Matlab — affichée, non testée' },
  CR_TP2K40_MATLAB_G0B: { valeur: 0.69, unite: '', source: 'CR', note: 'Matlab — affichée, non testée' },
  CR_TP2K40_MATLAB_ZB: { valeur: 0.45, unite: '', source: 'CR', note: 'Matlab — affichée, non testée' },
  CR_TP2K40_MATLAB_WNB: { valeur: 591.3, unite: 'rad/s', source: 'CR', note: 'Matlab — affichée, non testée' },
} as const satisfies Record<string, RefEntry>

export type RefKey = keyof typeof AU3_VALEURS
export const AU3: Readonly<Record<RefKey, RefEntry>> = AU3_VALEURS

/** Valeur numérique d'une entrée (raccourci de lecture) */
export const au3 = (k: RefKey): number => AU3[k].valeur

/**
 * Instruments et interface : listes de calibres, géométrie de l'écran, rythme d'affichage.
 * Pas des valeurs de modèle : elles ne portent pas de source et ne déclenchent pas de badge.
 */
export const AU3_INSTRUMENTS = {
  oscillo: {
    divX: 10,
    divY: 8,
    /** Pixels par division : entier, pour des curseurs exacts au pixel */
    pxParDiv: 50,
    /** Déclenchement placé à 1 division du bord gauche (« Référence temps » à gauche) */
    refGaucheDiv: 1,
    /** Points d'un enregistrement (export .csv) */
    points: 2000,
    calibresV: [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10],
    calibresS: [100e-6, 200e-6, 500e-6, 1e-3, 2e-3, 5e-3, 10e-3, 20e-3, 50e-3, 100e-3, 200e-3, 500e-3, 1],
    moyennages: [1, 4, 8, 16],
    /** Couleurs des voies 1 à 4 : jaune, vert, bleu, rose (DSOX2004A) */
    couleurs: ['#f2d21b', '#3ddc84', '#4aa8ff', '#ff6fb5'],
    /** Pas des boutons de position (div) et de niveau de déclenchement (V) */
    pasPosition: 0.2,
    pasNiveau: 0.05,
    /** Rafraîchissement en Run (ms) */
    rafraichissementMs: 400,
    /** Chiffres significatifs affichés */
    chiffres: 4,
    /** Réglages à l'allumage du simulateur (proches de ceux du TP1) */
    defaut: {
      vdiv: [2, 0.5, 5, 0.5],
      sdiv: 5e-3,
      curseurs: { x1: 50, x2: 150, y1: 100, y2: 300 },
    },
    /** Chiffres après la virgule de la mantisse dans l'export .csv (format DSOX : -1.0000000E-02) */
    csvChiffres: 7,
  },
  gbf: {
    /** Pas des boutons + / − : fréquence (Hz), amplitude (V), offset (V) */
    pasFreq: 0.1,
    pasVpp: 0.1,
    pasOffset: 0.1,
    chiffres: 3,
  },
  cable: {
    couleurs: ['#1b1b1b', '#d62828', '#2a9d3f', '#f2c218', '#2b6fd6', '#f08a24', '#ffffff'],
    /** Affaissement des courbes de Bézier (px) */
    affaissement: 60,
    epaisseur: 4,
  },
  /** Définition du décibel en tension : facteur = base^(−dB / parDecade) */
  decibel: { base: 10, parDecade: 20 },
  /** Préfixes SI d'affichage, du plus grand au plus petit facteur */
  prefixes: [
    { facteur: 1, symbole: '' },
    { facteur: 1e-3, symbole: 'm' },
    { facteur: 1e-6, symbole: 'µ' },
  ],
  ui: {
    /** Graine du bruit à la première acquisition */
    graineInitiale: 7,
    /** Découpage de la page de l'établi */
    largeurEtabli: 1360,
    hauteurEtabli: 700,
  },
} as const

/** Sentinelle numérique : écart considéré comme nul */
export const AU3_EPSILON = 1e-12
