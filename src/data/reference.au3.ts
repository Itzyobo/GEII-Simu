/**
 * Constantes AU3 (moteur à courant continu + dynamo tachymétrique, platine « Régulateur analogique »,
 * GBF TTi TG315, oscilloscope Keysight DSOX2004A). SEULE source de nombres du module AU3 :
 * src/au3/ n'en contient aucun hors 0, 1, -1, 2 et les index (test src/au3/regles.test.ts).
 *
 * `AU3` : valeurs de modèle et de réglage, typées RefEntry (source « CR », « enonce » ou « hypothese »).
 * `AU3_LISTES` : listes des instruments (calibres, moyennages), typées RefListe (même champ source).
 * La mise en page (pixels, couleurs, pas des boutons) n'est pas un paramètre de modèle : src/au3/miseEnPage.ts.
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
  GBF_ATTENUATION_FACTEUR: { valeur: 0.1, unite: '', source: 'enonce', note: 'Atténuation de 20 dB en tension : amplitude divisée par 10' },

  /* ───────────── Oscilloscope DSOX2004A : géométrie d'acquisition ───────────── */
  OSC_DIV_X: { valeur: 10, unite: 'div', source: 'hypothese', note: 'Divisions horizontales du DSOX2004A (non données par l’énoncé)' },
  OSC_DIV_Y: { valeur: 8, unite: 'div', source: 'hypothese', note: 'Divisions verticales : plage de quantification (non données par l’énoncé)' },
  OSC_REF_GAUCHE_DIV: { valeur: 1, unite: 'div', source: 'enonce', note: 'Fiche oscilloscope p. 4 : déclenchement « au niveau du 1ier carreau à gauche de l’écran »' },
  OSC_POINTS: { valeur: 2000, unite: 'points', source: 'hypothese', note: 'Points d’un enregistrement .csv' },

  /* ───────────── Énoncé : méthodes de mesure du TP1 ───────────── */
  NIVEAU_TAU: { valeur: 0.632, unite: '', source: 'enonce', note: 'τ : « 0,63*m(∞) » (I.2.1) ; 1 − e⁻¹ = 0,632' },
  NIVEAU_T1: { valeur: 0.264, unite: '', source: 'enonce', note: 't1 : 26.4 % de m(∞) (I.2.2 Q2)' },
  NIVEAU_T3: { valeur: 0.801, unite: '', source: 'enonce', note: 't3 : 80.1 % de m(∞) (I.2.2 Q2)' },
  NIVEAU_TR5: { valeur: 0.95, unite: '', source: 'enonce', note: 'TR5% : « 0,95*m(∞) » (I.2.1 Q4)' },
  ABAQUE_Z_MIN: { valeur: 0.5, unite: '', source: 'enonce', note: '« Abaque valide pour tous les systèmes d’ordre 2 tels que 0,5 < z < 3 »' },
  ABAQUE_Z_MAX: { valeur: 3, unite: '', source: 'enonce' },

  /* ───────────── Correction et calcul (PRD §4.3) ───────────── */
  TOL_MESURE: { valeur: 0.05, unite: '', source: 'hypothese', note: 'PRD §4.3 : tolérance d’une mesure de l’étudiant (±5 %)' },
  TOL_ABAQUE: { valeur: 0.1, unite: '', source: 'hypothese', note: 'PRD §4.3 : tolérance d’une lecture d’abaque (±10 %)' },
  ITERATIONS_DICHOTOMIE: { valeur: 60, unite: '', source: 'hypothese', note: 'Inversion numérique de l’abaque (précision 2⁻⁶⁰ de l’intervalle)' },
  IDENT_ITER_MAX: { valeur: 4000, unite: '', source: 'hypothese', note: 'Nelder–Mead : itérations maximales par passe' },
  IDENT_TOL: { valeur: 1e-12, unite: '', source: 'hypothese', note: 'Nelder–Mead : arrêt quand l’écart relatif du critère sur le simplexe passe sous ce seuil' },
  IDENT_PAS_INITIAL: { valeur: 0.2, unite: '', source: 'hypothese', note: 'Nelder–Mead : taille du simplexe initial (paramètres en logarithme)' },
  IDENT_PASSES: { valeur: 3, unite: '', source: 'hypothese', note: 'Nelder–Mead relancé depuis le meilleur point (évite un simplexe dégénéré)' },
  SUPERPOSITION_MAX: { valeur: 0.01, unite: '', source: 'hypothese', note: 'Modèle « superposé » à la mesure si moins de 1 % de la variance de la mesure reste inexpliquée' },
  RAPPORT_NEGLIGEABLE: { valeur: 5, unite: '', source: 'hypothese', note: 'TP2 I.1.2 Q12 : une constante de temps est négligeable si τmax/τmin ≥ 5 (règle usuelle, non donnée par l’énoncé)' },
  TANGENTE_FENETRE: { valeur: 0.05, unite: '', source: 'hypothese', note: 'Pente de la mesure au démarrage : régression sur t ≤ 5 % de τ' },

  /* ───────────── Banc du CR ───────────── */
  NUMERO_MOTEUR: { valeur: 1, unite: '', source: 'CR', note: 'Boîtier « MOTEUR 1 » (photos du CR)' },
  NUMERO_POSTE: { valeur: 4, unite: '', source: 'CR', note: 'Platine du poste 4, salle B26 (photos du CR)' },

  /* ───────────── Énoncé : réglages des TP ───────────── */
  TP1_GBF_FREQ: { valeur: 1.3, unite: 'Hz', source: 'enonce' },
  TP1_GBF_VPP: { valeur: 12, unite: 'V', source: 'enonce' },
  TP2_GBF_FREQ: { valeur: 2, unite: 'Hz', source: 'enonce' },
  TP2_K38_GBF_VPP: { valeur: 3.2, unite: 'V', source: 'enonce' },
  TP2_K38_K: { valeur: 3.8, unite: '', source: 'enonce' },
  TP2_K38_G1: { valeur: 38, unite: '', source: 'enonce', note: 'Affichage G1' },
  TP2_K38_G2: { valeur: 10, unite: '', source: 'enonce' },
  TP2_K40_GBF_VPP: { valeur: 0.3, unite: 'V', source: 'enonce' },
  TP2_VOIE3_VDIV: { valeur: 5, unite: 'V/div', source: 'enonce', note: 'TP2 liaison 9 : « Réglez le calibre de la voie 3 (uniquement) à 5V »' },
  TP2_K40_K: { valeur: 40, unite: '', source: 'enonce' },
  TP2_K40_G1: { valeur: 40, unite: '', source: 'enonce', note: 'Affichage G1' },
  TP2_K40_G2: { valeur: 100, unite: '', source: 'enonce' },
  TP4_GBF_FREQ: { valeur: 4.9, unite: 'Hz', source: 'enonce' },
  TP4_GBF_VPP: { valeur: 0.8, unite: 'V', source: 'enonce' },
  TP4_G1: { valeur: 0.95, unite: '', source: 'enonce', note: 'Affichage G1 = 95, donc G1 = 0.95' },
  TP4_G2: { valeur: 10, unite: '', source: 'enonce' },
  TP4_TI_ENONCE: { valeur: 0.0091, unite: 's', source: 'enonce', note: 'Ti ≈ 0.0091 s (placement de pôles)' },
  TP4_K_ENONCE: { valeur: 25.8, unite: '', source: 'enonce', note: 'K ≈ 25.8 (zb ≈ 0.7 annoncé)' },
  TP4_TR5_MAX: { valeur: 0.2, unite: 's', source: 'enonce', note: 'Cahier des charges du TP4 (I) : TR5%b inférieur à 200 ms' },
  TP4_D1_MAX: { valeur: 0.05, unite: '', source: 'enonce', note: 'Cahier des charges du TP4 (I) : 1er dépassement inférieur à 5 %' },
  TP4_ERREUR_MAX: { valeur: 0.005, unite: '', source: 'hypothese', note: '« Sans erreur statique » (énoncé) mesuré à 0,5 % près (PRD §6, étape 4)' },
  TP4_II_CONSIGNE: { valeur: 1, unite: 'V', source: 'enonce', note: 'II : mesure de vitesse égale à 1 V en régime permanent' },
  TP4_II_TR5_MAX: { valeur: 0.03, unite: 's', source: 'enonce', note: 'II : redémarrage et bonne vitesse en moins de 30 ms' },
  TP4_II_VARIATION_MAX: { valeur: 0.05, unite: '', source: 'enonce', note: 'II : variation de vitesse inférieure à 5 % à l’arrivée d’une bouteille' },
  TP4_II_DUREE: { valeur: 0.3, unite: 's', source: 'hypothese', note: 'II : durée simulée (démarrage, puis bouteille à 0,15 s)' },
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
  GBF_DISSYMETRIE: { valeur: 0.2, unite: '', source: 'hypothese', note: 'TP1 p. 6 : carré « pas symétrique » quand la platine est éteinte ; palier bas réduit de 20 % (valeur inventée)' },
  AMPLI_BLOQUE: { valeur: 1, unite: '', source: 'hypothese', note: 'TP1 p. 6, remarque : ampli de courant bloqué, sortie collée à +USAT ou 0 V quelle que soit l’entrée ; seule la procédure de l’énoncé le débloque' },
  VITESSE_ARRET: { valeur: 0.01, unite: '', source: 'hypothese', note: 'Animation : moteur dessiné à l’arrêt sous 1 % de la pleine échelle G0r·USAT' },
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

/** Liste de valeurs d'un instrument, avec sa source (comme une RefEntry) */
export interface RefListe {
  valeurs: readonly number[]
  unite: string
  source: RefSource
  note?: string
}

/** Listes des instruments. La fiche oscilloscope p. 4 ne donne aucun calibre ; seuls les moyennages « sur 4 ou 8 acquisitions » y figurent. */
export const AU3_LISTES = {
  CALIBRES_V: { valeurs: [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10], unite: 'V/div', source: 'hypothese', note: 'Suite 1-2-5 du DSOX2004A (non donnée par la fiche p. 4)' },
  CALIBRES_S: { valeurs: [100e-6, 200e-6, 500e-6, 1e-3, 2e-3, 5e-3, 10e-3, 20e-3, 50e-3, 100e-3, 200e-3, 500e-3, 1], unite: 's/div', source: 'hypothese', note: 'Suite 1-2-5 du DSOX2004A (non donnée par la fiche p. 4)' },
  MOYENNAGES: { valeurs: [1, 4, 8, 16], unite: 'acquisitions', source: 'hypothese', note: '4 et 8 : fiche oscilloscope p. 4 ; 1 (Normal) et 16 (PRD §2) : non donnés par l’énoncé' },
} as const satisfies Record<string, RefListe>

/** Sentinelle numérique : écart considéré comme nul */
export const AU3_EPSILON = 1e-12
