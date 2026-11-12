/**
 * Mise en page AU3 : pixels, couleurs, pas des boutons, réglages à l'allumage, format d'affichage.
 * Ce ne sont pas des paramètres de modèle (aucune réponse attendue n'en dépend, sauf la résolution d'un pixel
 * des curseurs) : ils vivent ici et non dans reference.ts. Fichier en liste blanche du test des constantes.
 */
export const MISE_EN_PAGE = {
  oscillo: {
    /** Pixels par division : entier, pour des curseurs exacts au pixel */
    pxParDiv: 50,
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
    /** Tirets d'une liaison pré-câblée */
    pointillePrecablage: '2 6',
    /** Contournement d'une zone d'exclusion : marge (px), pas de recherche (px), essais, points d'échantillonnage */
    marge: 12,
    pasContour: 20,
    essaisContour: 40,
    echantillons: 32,
  },
  /** Préfixes SI d'affichage, du plus grand au plus petit facteur */
  prefixes: [
    { facteur: 1, symbole: '' },
    { facteur: 1e-3, symbole: 'm' },
    { facteur: 1e-6, symbole: 'µ' },
  ],
  moteur: {
    /** Durée d'un tour de l'animation à pleine échelle (s) */
    tourPleineEchelle: 0.4,
  },
  ui: {
    /** Graine du bruit à la première acquisition */
    graineInitiale: 7,
    /** Découpage de la page de l'établi */
    largeurEtabli: 1360,
    hauteurEtabli: 700,
  },
  /** Chrono d'examen : secondes par minute, rafraîchissement (ms) */
  chrono: { secondesParMinute: 60, rafraichissementMs: 1000, chiffres: 2 },
  /** Facteur d'affichage d'une fraction en pourcentage */
  pourcent: 100,
  /** Chiffres significatifs de la note de TR5% (30,7 ms ; 33 ms) */
  chiffresTr5: { modele: 3, cr: 3 },
  abaque: {
    largeur: 520,
    hauteur: 300,
    marge: { gauche: 44, droite: 12, haut: 12, bas: 34 },
    points: 120,
    /** Graduations de l'axe z (échelle logarithmique) et de l'axe des ordonnées */
    graduationsZ: [0.5, 0.7, 1, 1.5, 2, 3],
    yMax: 10,
    pasY: 1,
    croix: 6,
    /** Abscisse z de l’étiquette directe de la courbe ωn·t3 (au-dessus de t3/t1, sans chevauchement) */
    etiquetteZ: 2,
  },
  identification: {
    /** Points tracés (sous-échantillonnage du .csv) ; fraction de la fenêtre montrée par le zoom sur le démarrage */
    pointsTrace: 400,
    /** Mesure (trait plein), modèle (tirets), tangentes (pointillés) : palette validée sur le fond #1e2127 (dataviz) */
    couleurs: { mesure: '#1f9e5a', modele: '#c87a0c', tangente: '#3a84d4' },
    tirets: '6 4',
    /** Opacité de l'aire sous e(t) (II.4 b) */
    opaciteAire: 0.3,
    pointilles: '2 3',
    zoom: 0.15,
    hauteurGraphe: 220,
    marge: { top: 4, right: 8, bottom: 0, left: 0 },
    police: 11,
    largeurAxe: 56,
    chiffresAxe: 2,
    chiffres: 4,
  },
} as const
