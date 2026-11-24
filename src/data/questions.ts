/**
 * Registre des questions notées (identifiants stables) et des attendus du PRD qu'elles couvrent.
 * Sert au barème d'examen (répartition égale), à la progression et au bloc « Attendus » de l'accueil.
 */

export type TpSlug = 'pas-a-pas' | 'alim-decoupage' | 'machine-asynchrone'

export interface QuestionRef {
  id: string
  label: string
}

export const QUESTIONS: Record<TpSlug, QuestionRef[]> = {
  'pas-a-pas': [
    { id: 'pap-cablage', label: 'Câblage — driver TB6600' },
    { id: 'pap-q4', label: 'Q4 — vitesse à 20 Hz en pas complet' },
    { id: 'pap-q5', label: 'Q5 — vitesse à 180 Hz en demi-pas' },
    { id: 'pap-q6', label: 'Q6 — fréquence Freq2' },
    { id: 'pap-q7', label: 'Q7 — mode courant / mode tension' },
    { id: 'pap-q8', label: 'Q8 — déphasage I_A / I_B' },
    { id: 'pap-q9', label: 'Q9 — inversion du sens (DIR)' },
    { id: 'pap-q10', label: 'Q10 — périodes d’horloge par période de courant' },
    { id: 'pap-q11', label: 'Q11 — séquence des courants' },
    { id: 'pap-q12', label: 'Q12 — inductance d’un enroulement' },
  ],
  'alim-decoupage': [
    { id: 'alim1-cablage', label: 'P1 Câblage — maquette IT237' },
    { id: 'alim1-q1-periode', label: 'P1 Q1 — période des impulsions' },
    { id: 'alim1-q1-alpha', label: 'P1 Q1 — rapport cyclique' },
    { id: 'alim1-q3', label: 'P1 Q3 — tension zener Vz' },
    { id: 'alim1-q4', label: 'P1 Q4 — inductance magnétisante Lm' },
    { id: 'alim1-q5', label: 'P1 Q5 — aire maxi sans saturation' },
    { id: 'alim1-q6', label: 'P1 Q6 — diminuer ΔV' },
    { id: 'alim2-cablage', label: 'P2 Câblage — platine flyback' },
    { id: 'alim2-q1-vemin', label: 'P2 Q1 — tension d’entrée minimale' },
    { id: 'alim2-q1-vemax', label: 'P2 Q1 — tension d’entrée maximale' },
    { id: 'alim2-q1-vs', label: 'P2 Q1 — tension de sortie' },
    { id: 'alim2-q1-is', label: 'P2 Q1 — courant de sortie nominal' },
    { id: 'alim2-q1-f', label: 'P2 Q1 — fréquence de découpage' },
    { id: 'alim2-q1-eta', label: 'P2 Q1 — rendement nominal' },
    { id: 'alim2-q1-iso', label: 'P2 Q1 — isolation galvanique' },
    { id: 'alim2-releves', label: 'P2 Q2 — tableau des 5 relevés et rendements' },
    { id: 'alim2-q2', label: 'P2 Q2 — rendement à 0,5 A' },
    { id: 'alim2-q3', label: 'P2 Q3 — rendement de l’alim linéaire' },
    { id: 'alim2-q5-m', label: 'P2 Q5 — rapport de transformation m' },
    { id: 'alim2-q5-f', label: 'P2 Q5 — fréquence de découpage mesurée' },
    { id: 'alim2-dcm-mode', label: 'P2 — conduction discontinue vue sur V2' },
    { id: 'alim2-dcm-courant', label: 'P2 — courant de basculement continu / discontinu' },
  ],
  'machine-asynchrone': [
    { id: 'mas-cablage', label: 'Câblage — réseau / variateur' },
    { id: 'mas-q1-cu', label: 'Q1 — couple utile nominal' },
    { id: 'mas-q1-p', label: 'Q1 — paires de pôles' },
    { id: 'mas-q1-ns', label: 'Q1 — vitesse de synchronisme' },
    { id: 'mas-q2', label: 'Q2 — couplage sur le réseau 400 V' },
    { id: 'mas-q3', label: 'Q3 — tableau des essais en charge' },
    { id: 'mas-q4', label: 'Q4 — résistance Rs' },
    { id: 'mas-q5-p0', label: 'Q5 — P’0 en étoile' },
    { id: 'mas-q5-i0', label: 'Q5 — I’s0 en étoile' },
    { id: 'mas-q6-g', label: 'Q6 — Cu = f(g)' },
    { id: 'mas-q6-cos', label: 'Q6 — cos φ à vide' },
    { id: 'mas-q6-qa', label: 'Q6 — évolution de Qa' },
    { id: 'mas-q7-table', label: 'Q7 — tableau du variateur' },
    { id: 'mas-q7-uf', label: 'Q7 — rapport U/f' },
    { id: 'mas-q7-var', label: 'Q7 — utilité du variateur' },
    { id: 'mas-q8-pertes', label: 'Q8 — séparation des pertes (calculs)' },
    { id: 'mas-q8-alpha', label: 'Q8 — coefficient α' },
    { id: 'mas-bilan', label: 'Bilan de puissance au point nominal' },
    { id: 'mas-bilan-qcm', label: 'Bilan — méthode la plus fiable' },
  ],
}

export const TP_OF: Record<string, TpSlug> = Object.fromEntries(
  (Object.keys(QUESTIONS) as TpSlug[]).flatMap((tp) => QUESTIONS[tp].map((q) => [q.id, tp])),
)
export const LABEL_OF: Record<string, string> = Object.fromEntries(Object.values(QUESTIONS).flat().map((q) => [q.id, q.label]))

/** Lignes « Câblage » (une par TP ou partie) : notées en examen selon l'essai qui valide le montage. */
export const isWiringLine = (id: string) => id.endsWith('-cablage')

/**
 * Attendus officiels des TP (liste fournie, mot pour mot), reliés aux questions (dont les lignes « Câblage ») qui les couvrent.
 * Une ligne sans couverture (ids vide) est affichée « non couvert ».
 */
export const ATTENDUS: { tp: TpSlug; text: string; ids: string[] }[] = [
  { tp: 'alim-decoupage', text: 'Savoir câbler les platines hacheurs.', ids: ['alim1-cablage', 'alim2-cablage'] },
  { tp: 'alim-decoupage', text: 'Savoir câbler / mesurer / calculer un rendement d’une platine hacheur.', ids: ['alim2-cablage', 'alim2-releves', 'alim2-q2', 'alim2-q3'] },
  {
    tp: 'alim-decoupage',
    text: 'Savoir régler / mesurer / retrouver le rapport cyclique, fréquence de fonctionnement sur les deux platines.',
    ids: ['alim1-q1-periode', 'alim1-q1-alpha', 'alim2-q1-f', 'alim2-q5-f'],
  },
  { tp: 'alim-decoupage', text: 'Savoir différencier / régler un fonctionnement conduction continu / discontinu.', ids: ['alim2-dcm-mode', 'alim2-dcm-courant'] },
  { tp: 'alim-decoupage', text: 'Savoir mesurer / calculer l’inductance du primaire du transformateur.', ids: ['alim1-q4'] },
  { tp: 'pas-a-pas', text: 'Savoir câbler les platines moteurs pas à pas.', ids: ['pap-cablage'] },
  { tp: 'pas-a-pas', text: 'Savoir calculer la vitesse de rotation à partir d’une fréquence d’impulsion.', ids: ['pap-q4', 'pap-q5'] },
  { tp: 'pas-a-pas', text: 'Savoir mesurer une tension et courant dans un enroulement et expliquer le fonctionnement mode courant.', ids: ['pap-q7'] },
  { tp: 'pas-a-pas', text: 'Déterminer le mode courant et mode tension, trouver les fréquences correspondantes.', ids: ['pap-q6', 'pap-q7'] },
  { tp: 'pas-a-pas', text: 'Savoir différencier un mode demi pas d’un mode pas complet.', ids: ['pap-q5', 'pap-q10', 'pap-q11'] },
  { tp: 'pas-a-pas', text: 'Savoir expliquer l’inversion de sens de fonctionnement par des relevés.', ids: ['pap-q8', 'pap-q9'] },
  { tp: 'machine-asynchrone', text: 'Savoir câbler un couplage étoile ou triangle, identifier la tension aux bornes d’un enroulement.', ids: ['mas-cablage', 'mas-q2'] },
  {
    tp: 'machine-asynchrone',
    text: 'Savoir relever les informations d’une plaque signalétique, calculer un couple utile, calculer le nombre de paires de pôles.',
    ids: ['mas-q1-cu', 'mas-q1-p', 'mas-q1-ns'],
  },
  { tp: 'machine-asynchrone', text: 'Savoir câbler une machine asynchrone sur le réseau ou à l’aide d’un variateur.', ids: ['mas-cablage', 'mas-q7-table'] },
  {
    tp: 'machine-asynchrone',
    text: 'Savoir mesurer puissances absorbées actives, réactives et apparentes, courant tension aux bornes d’une phase.',
    ids: ['mas-q3'],
  },
  { tp: 'machine-asynchrone', text: 'Savoir mesurer / calculer un bilan de puissance et rendement.', ids: ['mas-q3', 'mas-bilan', 'mas-bilan-qcm'] },
  { tp: 'machine-asynchrone', text: 'Savoir mesurer / calculer les pertes joules statoriques Pjs.', ids: ['mas-q4', 'mas-q8-pertes', 'mas-bilan'] },
  { tp: 'machine-asynchrone', text: 'Savoir exploiter les courbes Cu=f(N) et Cu = f(g).', ids: ['mas-q6-g'] },
  {
    tp: 'machine-asynchrone',
    text: 'Montrer que la relation V/f est constante pour une alimentation par variateur de fréquence.',
    ids: ['mas-q7-table', 'mas-q7-uf'],
  },
]

/**
 * Questions dont la réponse attendue dépend d'une constante marquée « hypothèse » dans reference.ts
 * (badge « valeur non vérifiée »). Clé : id de question ; valeur : chemins des constantes.
 * Règle : la réponse changerait si la constante s'écartait de ±50 % de sa valeur.
 */
export const UNVERIFIED: Record<string, string[]> = {
  'pap-q6': ['PAP.rPhase', 'PAP.fDecrochage'],
  'pap-q7': ['PAP.rPhase', 'PAP.fDecrochage'],
  'pap-q12': ['PAP.rPhase'],
  'alim1-q5': ['ALIM.facteurSaturation'],
  'alim2-q5-m': ['FLYBACK.m'],
  'alim2-dcm-mode': ['FLYBACK.iDiscontinu'],
  'alim2-dcm-courant': ['FLYBACK.iDiscontinu'],
  // Banc MAS : montage attendu et grandeur lue par l'analyseur (V simple en montage 1, U composée en montage 2)
  'mas-cablage': ['MAS.pinceMontage1', 'MAS.pinceMontage2', 'MAS.bornesVariateur', 'MAS.tensionAnalyseur'],
  'mas-q3': ['MAS.tensionAnalyseur'],
  'mas-q7-table': ['MAS.tensionAnalyseur'],
  'mas-q7-uf': ['MAS.tensionAnalyseur'],
}

/** Badges supplémentaires selon le mode réglé sur le driver : en 1/4 de pas, la table S1–S3 est à vérifier. */
export const UNVERIFIED_BY_MODE: Partial<Record<'entier' | 'demi' | 'quart', Record<string, string[]>>> = {
  quart: { 'pap-q10': ['TB6600_MODES'], 'pap-q11': ['TB6600_MODES'] },
}

/* ───────────── INFO3 : dans questions.info3.ts (chargé avec /info3 seulement), réexporté ici ───────────── */
export { INFO3_ANCHORS_HORS_QUESTION, INFO3_QUESTIONS, INFO3_VALIDATION, coverage, type CoverageState, type Info3Question, type Info3QuestionKind, type ValidationPoint } from './questions.info3'

/* ───────────── Réseaux RES3 · TP1 câble coaxial (page /modbus/tp1) ───────────── */

/** Questions notées du TP1 RES3, dans l'ordre du fascicule (progression localStorage, comme les autres TP). */
export const RES3_TP1_QUESTIONS: QuestionRef[] = [
  { id: 'res3-tp1-a-eg', label: '3.2.2 a — Eg à vide' },
  { id: 'res3-tp1-a-rin', label: '3.2.2 a — justification 1 MΩ ≫ 50 Ω' },
  { id: 'res3-tp1-b-gamma', label: '3.2.2 b — Γ circuit ouvert' },
  { id: 'res3-tp1-b-ratio', label: '3.2.2 b — rapport écho / incident (ouvert)' },
  { id: 'res3-tp1-b-dt', label: '3.2.2 b — retard de l’écho' },
  { id: 'res3-tp1-b-l', label: '3.2.2 b — longueur du câble' },
  { id: 'res3-tp1-b-spires', label: '3.2.2 b — longueur par les spires' },
  { id: 'res3-tp1-b-ei', label: '3.2.2 b — amplitude incidente Ei' },
  { id: 'res3-tp1-b-zc', label: '3.2.2 b — Zc, méthode 1' },
  { id: 'res3-tp1-c-gamma', label: '3.2.2 c — Γ court-circuit' },
  { id: 'res3-tp1-c-ratio', label: '3.2.2 c — rapport écho / incident (CC)' },
  { id: 'res3-tp1-d-zc', label: '3.2.2 d — Zc, méthode 2 (potentiomètre)' },
  { id: 'res3-tp1-d-ch2', label: '3.2.2 d — vérification sur CH2' },
  { id: 'res3-tp1-e-sinus', label: '3.2.2 e — pourquoi un sinus' },
  { id: 'res3-tp1-e-alpha', label: '3.2.2 e — atténuation en dB/100 m' },
  { id: 'res3-tp1-e-phase', label: '3.2.2 e — déphasage' },
  { id: 'res3-tp1-bf-open', label: '3.2.3 — tension finale, ouvert' },
  { id: 'res3-tp1-bf-short', label: '3.2.3 — tension finale, court-circuit' },
  { id: 'res3-tp1-bf-adapte', label: '3.2.3 — tension, adapté' },
  { id: 'res3-tp1-bf-2tau', label: '3.2.3 — durée non équipotentielle' },
  { id: 'res3-tp1-bf-conclusion', label: '3.2.3 — conclusion' },
]

/** Questions de cours (QCM) du TP1 RES3 ; la bonne réponse est l'index `correct`. */
export const RES3_TP1_COURS: Record<string, { statement: string; choices: string[]; correct: number; explanation: string }> = {
  'res3-tp1-a-rin': {
    statement: 'Pourquoi la tension lue générateur à vide est-elle directement Eg ?',
    choices: [
      'L’entrée 1 MΩ de l’oscilloscope est très grande devant Zg = 50 Ω : presque aucun courant, aucune chute dans Zg',
      'L’oscilloscope compense la résistance interne du générateur',
      'Le générateur régule sa tension de sortie quelle que soit la charge',
    ],
    correct: 0,
    explanation: 'V = Eg·1 MΩ / (1 MΩ + 50 Ω) = 0,99995·Eg : l’écart est invisible à l’écran.',
  },
  'res3-tp1-b-gamma': {
    statement: 'Coefficient de réflexion théorique en bout de ligne ouverte (ZL → ∞) ?',
    choices: ['Γ = +1', 'Γ = 0', 'Γ = −1', 'Γ = +0,5'],
    correct: 0,
    explanation: 'Γ = (ZL − Zc)/(ZL + Zc) → 1 quand ZL → ∞ : l’onde revient avec le même signe.',
  },
  'res3-tp1-c-gamma': {
    statement: 'Coefficient de réflexion théorique en court-circuit (ZL = 0) ?',
    choices: ['Γ = −1', 'Γ = 0', 'Γ = +1', 'Γ = −0,5'],
    correct: 0,
    explanation: 'Γ = (0 − Zc)/(0 + Zc) = −1 : l’écho revient inversé.',
  },
  'res3-tp1-d-ch2': {
    statement: 'Bouchon Zc en bout de ligne, Té vers CH2 : qu’observe-t-on ?',
    choices: [
      'CH1 : l’impulsion incidente seule ; CH2 : la même impulsion, retardée de τ et un peu atténuée',
      'CH1 : un écho positif à 2τ ; CH2 : rien',
      'CH1 et CH2 : la même impulsion au même instant',
    ],
    correct: 0,
    explanation: 'Ligne adaptée : ΓL = 0, aucune onde réfléchie. L’extrémité reçoit l’onde incidente après le temps de propagation τ = l/v.',
  },
  'res3-tp1-e-sinus': {
    statement: 'Pourquoi mesurer l’atténuation avec un sinus plutôt qu’avec l’impulsion ?',
    choices: [
      'L’atténuation dépend de la fréquence : un sinus n’en contient qu’une, la mesure est sans ambiguïté',
      'Le générateur ne sait pas produire d’impulsions à 5 MHz',
      'Un sinus n’est jamais réfléchi',
    ],
    correct: 0,
    explanation: 'Une impulsion de 40 ns a un spectre large (jusqu’à ≈ 25 MHz) : chaque composante est atténuée différemment et l’impulsion se déforme.',
  },
  'res3-tp1-bf-conclusion': {
    statement: 'Conclusion de l’étude BF (durée du signal ≫ 2τ) :',
    choices: [
      'Après quelques allers-retours le câble est équipotentiel : la tension finale ne dépend que de Eg, Zg et ZL (pont diviseur)',
      'Le câble se comporte toujours comme une résistance Zc',
      'Les réflexions n’existent plus en BF',
    ],
    correct: 0,
    explanation: 'L’escalier converge vers Eg·ZL/(Zg + ZL) : il y a toujours des réflexions, mais elles durent quelques τ, négligeables devant la durée du signal.',
  },
}
