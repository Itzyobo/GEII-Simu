import type { RefKey } from './reference'

/**
 * AU3 : attendus officiels (« A la fin du TPx, vous devez savoir », copiés mot pour mot de docs/au3/enonce.md)
 * et catalogue des questions. L'id d'une question est l'ancre <a id="…"> de l'énoncé ; son intitulé est le
 * texte exact de l'énoncé. TP1 (étape 2) et TP2 (étape 3) disponibles ; TP4 « à venir ».
 *
 * Règle du badge (PRD §3.4) : « valeur non vérifiée » si la réponse attendue dépend d'une hypothèse (`cles`)
 * ET n'est pas validée par un test contre une valeur du CR dans sa tolérance (`validee` : clés CR testées,
 * voir src/au3/regles.test.ts).
 */

export type TpAu3 = 'tp1' | 'tp2' | 'tp3' | 'tp4'

export interface Attendu {
  id: string
  tp: TpAu3
  texte: string
}

export const AU3_ATTENDUS: readonly Attendu[] = [
  { id: 'tp1-a1', tp: 'tp1', texte: 'Réaliser une réponse à un échelon d’un système et faire les mesures permettant de l’identifier et aussi celles attestant de ses performances,' },
  { id: 'tp1-a2', tp: 'tp1', texte: 'Choisir un modèle théorique (d’ordre 1 ou 2) à partir d’une réponse à un échelon de ce système réel,' },
  { id: 'tp1-a3', tp: 'tp1', texte: 'Identifier les paramètres d’un modèle (d’ordre 1 ou 2) en utilisant des mesures sur l’oscilloscope et éventuellement des abaques,' },
  { id: 'tp1-a4', tp: 'tp1', texte: 'Identifier les paramètres d’un modèle (d’ordre 1 ou 2) en utilisant les scripts Matlab (minimisation de l’erreur entre le modèle simulé et les mesures).' },
  { id: 'tp2-a1', tp: 'tp2', texte: 'Effectuer le cablage d’un système en boucle fermée avec un régulateur proportionnel avec les platines à disposition en salle B26,' },
  { id: 'tp2-a2', tp: 'tp2', texte: 'Réaliser une réponse à un échelon de ce système bouclé et faire les mesures sur l’oscilloscope permettant de l’identifier (modèle d’ordre 2) et aussi celles attestant de ses performances dans différents cas,' },
  { id: 'tp2-a3', tp: 'tp2', texte: 'Choisir un modèle théorique (d’ordre 2 avec facteur d’amortissement supérieur ou inférieur à 1) à partir d’une réponse à un échelon de ce système réel bouclé,' },
  { id: 'tp2-a4', tp: 'tp2', texte: 'Identifier les paramètres d’un modèle (d’ordre 2) en utilisant les scripts Matlab (minimisation de l’erreur entre le modèle simulé et les mesures),' },
  { id: 'tp2-a5', tp: 'tp2', texte: 'Choisir la meilleure valeur du paramètre K pour que le système bouclé ait les performances souhaitées ou conclure que le régulateur proportionnel n’est pas adapté au cahier des charges du client (qui veut toujours une erreur statique nulle entre la consigne et la mesure, notamment).' },
  { id: 'tp3-a1', tp: 'tp3', texte: 'Effectuer le cablage d’un asservissement de position effectué avec un moteur à courant continu, un capteur de position angulaire et un régulateur proportionnel.' },
  { id: 'tp3-a2', tp: 'tp3', texte: 'Visualiser et comprendre le signal en sortie du capteur de position angulaire (potentiomètre rotatif) quand le moteur est alimenté par une tension continue (en boucle ouverte).' },
  { id: 'tp3-a3', tp: 'tp3', texte: 'Visualiser et comprendre le signal en sortie du capteur de position angulaire (potentiomètre rotatif) quand la consigne est changée manuellement (en boucle fermée) : orientation d’une antenne parabolique.' },
  { id: 'tp3-a4', tp: 'tp3', texte: 'Réaliser une réponse à un échelon du système bouclé (balai d’essui-glace) et faire les mesures permettant d’attester de ses performances : précision, rapidité, dépassement.' },
  { id: 'tp4-a1', tp: 'tp4', texte: 'Effectuer le câblage d’un système asservi (moteur de modèle réduit de bateau, ici) en boucle fermée avec un régulateur PI série avec les platines à disposition en salle B26,' },
  { id: 'tp4-a2', tp: 'tp4', texte: 'Effectuer le réglage des paramètres d’un régulateur PI série par la méthode du placement de pôles avec ces platines,' },
  { id: 'tp4-a3', tp: 'tp4', texte: 'Effectuer toutes les mesures attestant des performances du système bouclé.' },
  { id: 'tp4-a4', tp: 'tp4', texte: 'Effectuer la simulation d’un convoyeur en boucle fermée avec un régulateur PI série dont on veut asservir et réguler la vitesse et étudier son démarrage, le régime permanent atteint et son comportement en cas d’arrivée d’une bouteille.' },
]

export type StatutQuestion = 'a-venir' | 'disponible'

export interface QuestionAu3 {
  /** = ancre de docs/au3/enonce.md */
  id: string
  tp: TpAu3
  numero: string
  intitule: string
  attendus: readonly string[]
  /** Clés de reference.ts dont dépend la réponse attendue (badge si l'une est une hypothèse) */
  cles: readonly RefKey[]
  /** Clés CR (avec tolérance) contre lesquelles la réponse attendue du modèle est testée */
  validee: readonly RefKey[]
  statut: StatutQuestion
  /** Affichée « optionnelle », non notée (« S'il vous reste du temps ») */
  optionnelle?: boolean
}

/** TP1 : les réponses attendues viennent du modèle (hypothèses H1 à H3) */
const TP1: RefKey[] = ['TP1_GBF_FREQ', 'TP1_GBF_VPP', 'G0R', 'UF', 'TAU_A', 'TAU_B']
/** La forme d'ordre 2 de la courbe (tangente horizontale) est attestée par t1 et t3 du CR */
const FORME: RefKey[] = ['CR_TP1_T1', 'CR_TP1_T3']
/** TP2 : réponses attendues du modèle (hypothèses H1 à H3) en boucle fermée */
const MODELE: RefKey[] = ['G0R', 'UF', 'TAU_A', 'TAU_B']
const TP2_K38: RefKey[] = ['TP2_GBF_FREQ', 'TP2_K38_GBF_VPP', 'TP2_K38_G1', 'TP2_K38_G2', ...MODELE]
const TP2_K40: RefKey[] = ['TP2_GBF_FREQ', 'TP2_K40_GBF_VPP', 'TP2_K40_G1', 'TP2_K40_G2', ...MODELE]
const FORME38: RefKey[] = ['CR_TP2K38_T1', 'CR_TP2K38_T3']
const ID38: RefKey[] = ['CR_TP2K38_G0B', 'CR_TP2K38_ZB', 'CR_TP2K38_WNB']
const ID40: RefKey[] = ['CR_TP2K40_G0B', 'CR_TP2K40_ZB', 'CR_TP2K40_WNB']
/** TP4 : aucune mesure, tout vient du modèle extrapolé (hypothèses H1 à H3, H6, H7) */
const TP4_MODELE: RefKey[] = ['TP4_GBF_FREQ', 'TP4_GBF_VPP', 'TP4_G1', 'TP4_G2', 'R1', 'R2', 'C2', 'G0R', 'UF', 'TAU_A', 'TAU_B']
const TP4_BOUTEILLE: RefKey[] = [...TP4_MODELE, 'BOUTEILLE', 'TP4_BOUTEILLE_T']

const q = (id: string, tp: TpAu3, numero: string, intitule: string, attendus: string[], cles: RefKey[]): QuestionAu3 => ({ id, tp, numero, intitule, attendus, cles, validee: [], statut: 'a-venir' })
const q2 = (id: string, numero: string, intitule: string, attendus: string[], cles: RefKey[], validee: RefKey[] = [], optionnelle = false): QuestionAu3 => ({ id, tp: 'tp2', numero, intitule, attendus, cles, validee, statut: 'disponible', optionnelle })
const q1 = (id: string, numero: string, intitule: string, attendus: string[], cles: RefKey[], validee: RefKey[] = []): QuestionAu3 => ({ id, tp: 'tp1', numero, intitule, attendus, cles, validee, statut: 'disponible' })

export const AU3_QUESTIONS: readonly QuestionAu3[] = [
  /* ───────────── TP1 (ordre de l'énoncé) ───────────── */
  q1('tp1-numeros', 'Préparation', 'Notez dans votre compte-rendu le n° du moteur et de la platine de régulation.', ['tp1-a1'], ['NUMERO_MOTEUR', 'NUMERO_POSTE']),
  q1('tp1-reglages', 'Réglages', 'Réglez la tension de la sortie MAIN OUT (50 Ω) du GBF avec une forme périodique carrée de fréquence la plus près possible de 1,3 Hz et avec une variation d’amplitude la plus près possible de 12V sans offset (entre -6V et + 6V, Vpp ≈ 12V ) sur le GBF en l’observant sur l’oscilloscope.', ['tp1-a1'], ['TP1_GBF_FREQ', 'TP1_GBF_VPP', 'GBF_DISSYMETRIE']),
  q1('tp1-cablage', 'Câblage', 'Câblages à réaliser (platine éteinte) :', ['tp1-a1'], ['TP1_GBF_FREQ', 'TP1_GBF_VPP']),
  q1('tp1-sous-tension', 'Mise sous tension', 'Mettre sous tension la platine Régulateur', ['tp1-a1'], ['AMPLI_BLOQUE', 'GBF_DISSYMETRIE']),
  q1('tp1-i21-q1', 'I.2.1 Q1', 'Mesurez m(∞) (ΔY sur la courbe verte),', ['tp1-a1', 'tp1-a3'], TP1, ['CR_TP1_DM']),
  q1('tp1-i21-q2', 'I.2.1 Q2', 'Mesurez U0, amplitude crête-à-crête de la variation du signal d’alimentation carré (ΔY sur la courbe jaune),', ['tp1-a1', 'tp1-a3'], ['TP1_GBF_VPP', 'CR_TP1_DU']),
  q1('tp1-i21-g0', 'I.2.1 G0', 'Calculez alors le gain statique du système,', ['tp1-a3'], TP1, ['CR_TP1_G0']),
  q1('tp1-i21-q3', 'I.2.1 Q3', 'Mesurez τ (ΔX sur la courbe verte),', ['tp1-a1', 'tp1-a3'], TP1, ['CR_TP1_TAU']),
  q1('tp1-i21-g1', 'I.2.1 G1(p)', 'Donner alors la fonction de transfert du 1ier ordre du système, G1(p).', ['tp1-a3'], TP1, ['CR_TP1_G0', 'CR_TP1_TAU']),
  q1('tp1-i21-q4', 'I.2.1 Q4', 'Mesurez le temps de réponse à 5%, TR5%, en donnant tous les petits calculs nécessaires (0,95*m(∞), …).', ['tp1-a1'], [...TP1, 'CR_TP1_TR5']),
  q1('tp1-i22-q1', 'I.2.2 Q1', 'Le gain statique du système, G0, a déjà été déterminé en I.2.1. Redonnez-le.', ['tp1-a3'], TP1, ['CR_TP1_G0']),
  q1('tp1-i22-q2', 'I.2.2 Q2', 'Pour déterminer la valeur de z, mesurez sur l’oscilloscope les temps t1 et t3 pour atteindre respectivement 26.4% et 80.1% de la valeur finale m(∞).', ['tp1-a1', 'tp1-a3'], TP1, ['CR_TP1_T1', 'CR_TP1_T3', 'CR_TP1_Z']),
  q1('tp1-i22-q3', 'I.2.2 Q3', 'z étant estimé, mettez une croix au point de la courbe ωnt3 qui a comme abscisse z. La valeur de ωn est l’ordonnée de ce point divisée par t3, en secondes.', ['tp1-a3'], TP1, ['CR_TP1_WN']),
  q1('tp1-i22-g2', 'I.2.2 G2(p)', 'Donner alors la fonction de transfert du 2ième ordre du système, G2(p).', ['tp1-a3'], TP1, ['CR_TP1_G0', 'CR_TP1_Z', 'CR_TP1_WN']),
  q1('tp1-i22-q4', 'I.2.2 Q4', 'Le TR5%, a déjà été déterminé en I.2.1. Redonnez-le.', ['tp1-a1'], [...TP1, 'CR_TP1_TR5']),
  q1('tp1-i23-q11', 'I.2.3 Q11', 'Est-ce qu’un modèle d’ordre 1 représente bien le comportement du démarrage du moteur et la stabilisation de sa vitesse ?', ['tp1-a2', 'tp1-a4'], TP1, FORME),
  q1('tp1-i23-q12', 'I.2.3 Q12', 'Est-ce que les paramètres G0 et τ du modèle optimisé par Matlab (donnés dans la « Command Window ») sont les mêmes que ceux que vous avez obtenus avec des mesures directement sur l’écran de l’oscilloscope question 1.2.1 ?', ['tp1-a4'], [...TP1, 'CR_TP1_MATLAB_O1_G0', 'CR_TP1_MATLAB_O1_TAU']),
  q1('tp1-i23-o2-q1', 'I.2.3 ordre 2 Q1', 'Est-ce qu’un modèle d’ordre 2 représente bien le comportement du démarrage du moteur et la stabilisation de sa vitesse ?', ['tp1-a2', 'tp1-a4'], TP1, FORME),
  q1('tp1-i23-o2-q2', 'I.2.3 ordre 2 Q2', 'Est-ce que les paramètres G0, z et ωn du modèle optimisé par Matlab (donnés dans le workspace) sont les mêmes que ceux que vous avez obtenus avec des mesures directement sur l’écran de l’oscilloscope question 1.2.2 ?', ['tp1-a4'], [...TP1, 'CR_TP1_MATLAB_O2_G0', 'CR_TP1_MATLAB_O2_Z', 'CR_TP1_MATLAB_O2_WN'], ['CR_TP1_G0', 'CR_TP1_Z', 'CR_TP1_WN']),
  q1('tp1-conclusion', 'Conclusion', 'Conclure sur l’ordre le plus probable du système réel. Justifiez', ['tp1-a2'], TP1, FORME),
  q1('tp1-deviner', 'Conclusion', 'Aurait-on pu le deviner dès que l’on a obtenu la réponse à un échelon ? Comment ?', ['tp1-a2'], TP1, FORME),

  /* ───────────── TP2 (ordre de l'énoncé) ───────────── */
  q2('tp2-reglages', 'Réglages K = 3,8', 'Réglages à effectuer (platine éteinte) :', ['tp2-a1'], ['TP2_GBF_FREQ', 'TP2_K38_GBF_VPP', 'TP2_K38_G1', 'TP2_K38_G2']),
  q2('tp2-cablage', 'Câblage', 'Câblages à réaliser (en boucle fermée cette fois) (platine éteinte) :', ['tp2-a1'], ['TP2_K38_G1', 'TP2_K38_G2']),
  q2('tp2-sous-tension', 'Mise sous tension', 'Mettre sous tension la platine Régulateur', ['tp2-a1'], ['AMPLI_BLOQUE', 'GBF_DISSYMETRIE']),
  q2('tp2-i1-ordre', 'I.1', 'A l’observation de la courbe verte, d’après vos connaissances et le cours/TD AU3, quel pourrait être l’ordre de ce système (on pourra regarder la tangente au démarrage (à l’origine) en zoomant et se rappeler du TP1) ?', ['tp2-a3'], TP2_K38, FORME38),
  q2('tp2-i11-q1', 'I.1.1 Q1', 'Est-ce que la mesure de la vitesse m(∞) (en Volts) atteint la valeur de la consigne C0 (en Volts) en régime permanent (erreur statique nulle) ?', ['tp2-a2', 'tp2-a5'], TP2_K38, ['CR_TP2K38_G0B']),
  q2('tp2-i11-q2', 'I.1.1 Q2', 'Mesurez m(∞),', ['tp2-a2'], TP2_K38, ['CR_TP2K38_G0B']),
  q2('tp2-i11-q3', 'I.1.1 Q3', 'Mesurez/Rappelez C0, amplitude crête-à-crête de la variation du signal de consigne carré.', ['tp2-a2'], ['TP2_K38_GBF_VPP', 'CR_TP2K38_C0']),
  q2('tp2-i11-q4', 'I.1.1 Q4', 'Calculez alors le gain statique du système bouclé,', ['tp2-a2'], TP2_K38, ['CR_TP2K38_G0B']),
  q2('tp2-i11-q5', 'I.1.1 Q5', 'Pour déterminer la valeur de zb, on procède comme dans le TP1 car la réponse à un échelon n’est pas oscillatoire amortie (pas de dépassement ni d’oscillations).', ['tp2-a3'], ['TP2_K38_G1', 'TP2_K38_G2']),
  q2('tp2-i11-q6', 'I.1.1 Q6', 'Pour déterminer la valeur de zb, mesurez sur l’oscilloscope les temps t1 et t3 pour atteindre respectivement 26.4% et 80.1% de la valeur finale m(∞).', ['tp2-a2'], TP2_K38, [...FORME38, 'CR_TP2K38_ZB']),
  q2('tp2-i11-q7', 'I.1.1 Q7', 'zb étant estimé, mettez une croix au point de la courbe ωnt3 qui a comme abscisse zb. La valeur de ωnb est l’ordonnée de ce point divisée par t3 en secondes.', ['tp2-a2'], TP2_K38, ['CR_TP2K38_WNB']),
  q2('tp2-i11-gb2', 'I.1.1 Gb2(p)', 'Donner alors la fonction de transfert du 2ième ordre du système, Gb2(p).', ['tp2-a2'], TP2_K38, ID38),
  q2('tp2-i11-q8', 'I.1.1 Q8', 'Calculez les valeurs numériques théoriques G0b théorique, zb théorique, ωnb théorique, grace aux valeurs trouvées lors du TP1 en boucle ouverte G0, z et ωn et avec K=3,8', ['tp2-a3'], ['TP2_K38_G1', 'TP2_K38_G2', ...MODELE], ['CR_TP1_G0', 'CR_TP1_Z', 'CR_TP1_WN']),
  q2('tp2-i11-q9', 'I.1.1 Q9', 'Comparez les aux valeurs que vous venez de trouver par identification.', ['tp2-a3'], TP2_K38, ID38),
  q2('tp2-i11-q10', 'I.1.1 Q10', 'Mesurez le temps de réponse à 5%, TR5%b, en donnant tous les petits calculs nécessaires (0,95*m(∞), …).', ['tp2-a2'], [...TP2_K38, 'CR_TP2K38_TR5']),
  q2('tp2-i12-q9', 'I.1.2 Q9', 'Est-ce que les valeurs des 3 paramètres G0b, zb, ωnb sont les mêmes que celles que vous avez trouvées avec des mesures directes sur l’écran de l’oscilloscope ?', ['tp2-a4'], [...TP2_K38, 'CR_TP2K38_MATLAB_G0B', 'CR_TP2K38_MATLAB_ZB', 'CR_TP2K38_MATLAB_WNB'], ID38),
  q2('tp2-i12-q10', 'I.1.2 Q10', 'Observer si la simulation de la réponse à un échelon du modèle est superposée (ou presque) aux mesures ou pas', ['tp2-a4'], TP2_K38, FORME38),
  q2('tp2-i12-q11', 'I.1.2 Q11', 'Est-ce que le modèle d’ordre 2 que vous avez trouvé représente bien le comportement du démarrage du moteur et la stabilisation de sa vitesse ?', ['tp2-a4'], TP2_K38, FORME38),
  q2('tp2-i12-q12', 'I.1.2 Q12', 'Si zb ≥ 1, notez les valeurs des 2 constantes de temps trouvées : tau1 et tau2. L’une est elle négligeable par rapport à l’autre ?', ['tp2-a4'], [...TP2_K38, 'RAPPORT_NEGLIGEABLE'], ['CR_TP2K38_ZB', 'CR_TP2K38_WNB']),
  q2('tp2-i2-reglages', 'Réglages K = 40', 'Réglages à changer (platine éteinte) :', ['tp2-a2'], ['TP2_GBF_FREQ', 'TP2_K40_GBF_VPP', 'TP2_K40_G1', 'TP2_K40_G2']),
  q2('tp2-i2-ordre', 'I.2', 'A l’observation de la courbe verte de mesure et d’après vos connaissances du cours/TD d’AU3, quel pourrait être l’ordre de ce système bouclé ?', ['tp2-a3'], TP2_K40, ['CR_TP2K40_D1', 'CR_TP2K40_TPB_2']),
  q2('tp2-i21-q1', 'I.2.1 Q1', 'Avec ce nouveau réglage du paramètre K, est-ce que la mesure de la vitesse m(∞) atteint maintenant la valeur de la consigne C0 en régime permanent (erreur statique nulle) ?', ['tp2-a2', 'tp2-a5'], TP2_K40, ['CR_TP2K40_G0B']),
  q2('tp2-i21-q2', 'I.2.1 Q2', 'Mesurez la valeur de la consigne C0, en positionnant correctement les 2 curseurs Y1 et Y2 et en regardant la variation correspondante ΔY.', ['tp2-a2'], ['TP2_K40_GBF_VPP', 'CR_TP2K40_C0']),
  q2('tp2-i21-q3', 'I.2.1 Q3', 'Mesurez la valeur de la mesure M en régime statique, m(∞), en positionnant correctement les 2 curseurs Y1 et Y2 et en regardant la variation correspondante ΔY.', ['tp2-a2'], TP2_K40, ['CR_TP2K40_G0B']),
  q2('tp2-i21-q4', 'I.2.1 Q4', 'Calculez le gain statique du système bouclé,', ['tp2-a2'], TP2_K40, ['CR_TP2K40_G0B']),
  q2('tp2-i21-q5', 'I.2.1 Q5', 'Est-ce le même que pour K=3.8 (question 4. du I.1.1.) ? Pour quelle raison ?', ['tp2-a5'], [...TP2_K38, ...TP2_K40], ['CR_TP2K38_G0B', 'CR_TP2K40_G0B']),
  q2('tp2-i21-q6', 'I.2.1 Q6', 'Mesurez le premier dépassement D1 (défini sur la figure ci-dessous) en positionnant correctement les 2 curseurs Y1 et Y2 et en regardant la variation correspondante ΔY.', ['tp2-a2'], TP2_K40, ['CR_TP2K40_D1']),
  q2('tp2-i21-q7', 'I.2.1 Q7', 'Calculez D1/m(∞).', ['tp2-a2'], TP2_K40, ['CR_TP2K40_D1']),
  q2('tp2-i21-q8', 'I.2.1 Q8', 'Puis calculez la valeur de zb avec la formule générale suivante (même notations que la figure de la question 6. ou à l’aide de l’abaque ci-dessous :', ['tp2-a2', 'tp2-a3'], TP2_K40, ['CR_TP2K40_ZB']),
  q2('tp2-i21-q9', 'I.2.1 Q9', 'Mesurez Tpb ou Tpb/2.', ['tp2-a2'], TP2_K40, ['CR_TP2K40_TPB_2']),
  q2('tp2-i21-q10', 'I.2.1 Q10', 'Calculez ωnb avec la formule générale donnée avec la figure de la question 6.', ['tp2-a2'], TP2_K40, ['CR_TP2K40_WNB']),
  q2('tp2-i21-q12', 'I.2.1 Q12', 'Mesurez le temps de réponse à 5% du système bouclé, TR5%b, en donnant tous les petits calculs nécessaires (0,95*m(∞), 1,05*m(∞), …). Est il le même que pour le réglage K=3,8 ? Pour quelle raison ?', ['tp2-a2', 'tp2-a5'], [...TP2_K40, 'CR_TP2K40_TR5']),
  q2('tp2-i22-q9', 'I.2.2 Q9', 'Est-ce que les valeurs des paramètres sont les mêmes que celles que vous avez trouvées avec des mesures directes sur l’écran de l’oscilloscope ?', ['tp2-a4'], [...TP2_K40, 'CR_TP2K40_MATLAB_G0B', 'CR_TP2K40_MATLAB_ZB', 'CR_TP2K40_MATLAB_WNB'], ID40),
  q2('tp2-i22-q10', 'I.2.2 Q10', 'Les différences principales sont elles au démarrage (régime transitoire) ou en régime permanent ?', ['tp2-a4'], TP2_K40),
  q2('tp2-i22-q11', 'I.2.2 Q11', 'Est-ce que ce modèle d’ordre 2 représente bien le comportement du démarrage du moteur et la stabilisation de sa vitesse quand il est asservi en boucle fermée avec un régulateur proportionnel de gain K=40 ? Pour quelle raison ? Quel phénomène physique a pu être négligé dans le modèle ?', ['tp2-a4'], TP2_K40, ID40),
  q2('tp2-i22-q12', 'I.2.2 Q12', 'S’il vous reste du temps : compléter le script « main-ident.m » pour tracer la réponse à un échelon du modèle d’ordre 2 que vous avez trouvé question 13. du I.2.1., sur la même figure que les 2 autres courbes (mesures et réponse à un échelon du modèle optimisé par matlab).', ['tp2-a4'], TP2_K40, ID40, true),
  q2('tp2-conclusion-1', 'Conclusion 1', 'Est-ce que cette méthode d’asservissement en "bouclant" le MCC avec son capteur de vitesse et un régulateur proportionnel permet à la mesure m(t) de rejoindre la consigne c(t) en régime permanent avec une erreur statique nulle donc une précision parfait, comme l’attend tout client ?', ['tp2-a5'], [...TP2_K38, ...TP2_K40], ['CR_TP2K38_G0B', 'CR_TP2K40_G0B']),
  q2('tp2-conclusion-2', 'Conclusion 2', 'Est-ce que cette réponse à la question 1. de la conclusion dépend de la valeur de K ?', ['tp2-a5'], [...TP2_K38, ...TP2_K40], ['CR_TP2K38_G0B', 'CR_TP2K40_G0B']),
  q2('tp2-comparaison-ecart', 'Comparaison', 'A-t-on l’écart statique le plus faible entre la consigne c(t) et la mesure m(t) en régime permanent ?', ['tp2-a5'], [...TP2_K38, ...TP2_K40], ['CR_TP2K38_G0B', 'CR_TP2K40_G0B']),
  q2('tp2-comparaison-tr5', 'Comparaison', 'A-t-on le temps de réponse Tr5%b le plus faible ?', ['tp2-a5'], [...TP2_K38, ...TP2_K40, 'CR_TP2K38_TR5', 'CR_TP2K40_TR5']),
  q2('tp2-comparaison-depassement', 'Comparaison', 'A-t-on le dépassement le plus grand ?', ['tp2-a5'], [...TP2_K38, ...TP2_K40], ['CR_TP2K40_D1']),

  /* ───────────── TP4 (valeurs non vérifiées) ───────────── */
  q('tp4-cablage', 'tp4', 'Câblage', 'Câblages à réaliser (en boucle fermée) (platine éteinte) :', ['tp4-a1'], ['R1', 'R2', 'C2']),
  q('tp4-reglages', 'tp4', 'Réglages', 'Réglages à effectuer (platine éteinte) :', ['tp4-a2'], TP4_MODELE),
  q('tp4-i-q1', 'tp4', 'I Q1', 'Mesurez avec les curseurs la valeur finale de la variation de la mesure, m(∞)=ΔM (en Volts).', ['tp4-a3'], TP4_MODELE),
  q('tp4-i-q2', 'tp4', 'I Q2', 'D’après l’observation des courbes m(t) et c(t) en régime statique, donnez le gain statique de la boucle fermée, G0b et l’erreur statique en %.', ['tp4-a3'], TP4_MODELE),
  q('tp4-i-q3', 'tp4', 'I Q3', 'Mesurez le 1ier dépassement, D1 (en Volts)', ['tp4-a3'], TP4_MODELE),
  q('tp4-i-q4', 'tp4', 'I Q4', 'Calculez D1/m(∞) (en %).', ['tp4-a3'], TP4_MODELE),
  q('tp4-i-q5', 'tp4', 'I Q5', 'Si le dépassement D1/m(∞) (en %) est plus grand que celui fixé par le cahier des charges du client, diminuez G1 et effectuez à nouveau les mesures quand le cahier des charges du client est respecté', ['tp4-a2', 'tp4-a3'], TP4_MODELE),
  q('tp4-i-q6', 'tp4', 'I Q6', 'Mesurez avec les curseurs le temps de réponse à 5% de ce système bouclé, TR5%b, en donnant tous les petits calculs nécessaires (0,95*m(∞), 1,05*m(∞), …).', ['tp4-a3'], TP4_MODELE),
  q('tp4-i-q7', 'tp4', 'I Q7', 'Est-ce que le cahier des charges du client est bien respecté (précision, rapidité, dépassement) ? Expliquez', ['tp4-a2', 'tp4-a3'], TP4_MODELE),
  q('tp4-ii3-c', 'tp4', 'II.3 c', 'D’après l’observation des courbes m(t) et c(t) en régime statique, donnez le gain statique de la boucle fermée, G0b et l’erreur statique en %. Avez-vous la même précision que lors des expérimentations du I ?', ['tp4-a4'], TP4_MODELE),
  q('tp4-ii3-d', 'tp4', 'II.3 d', 'En observant le signal de commande en sortie du régulateur, U sur la figure 2, constatez vous que U (qui est la tension d’alimentation du moteur) est plus grand au départ pour un démarrage rapide et est non nul en régime permanent pour que le moteur tourne à la vitesse souhaitée.', ['tp4-a4'], TP4_MODELE),
  q('tp4-ii3-e', 'tp4', 'II.3 e', 'Mesures et calculs pour quantifier les performances du démarrage du moteur (sans bouteille) et de la stabilisation de sa vitesse en régime permanent', ['tp4-a4'], TP4_MODELE),
  q('tp4-ii3-f', 'tp4', 'II.3 f', 'Est-ce que le cahier des charges du client est bien respecté concernant le démarrage du convoyeur (précision, rapidité, dépassement) ? Expliquez', ['tp4-a4'], TP4_MODELE),
  q('tp4-ii4-b', 'tp4', 'II.4 b', 'Mesures et calculs pour quantifier les performances de régulation de la vitesse du moteur après l’arrivée d’une bouteille (avec des « data cursor »).', ['tp4-a4'], TP4_BOUTEILLE),
  q('tp4-ii4-c', 'tp4', 'II.4 c', 'Est-ce que le cahier des charges du client concernant l’impact de l’arrivée d’une bouteille sur la mesure de vitesse du convoyeur (en phase transitoire et en régime permanent) (précision, dépassement) est bien respecté ? Expliquez', ['tp4-a4'], TP4_BOUTEILLE),
  q('tp4-ii5-d', 'tp4', 'II.5 d', 'Simuler pour observer si le comportement du moteur bouclé avec un régulateur proportionnel est aussi exemplaire au démarrage et après une perturbation (arrivée d’une bouteille).', ['tp4-a4'], TP4_BOUTEILLE),
  q('tp4-ii5-e', 'tp4', 'II.5 e', 'Que concluez-vous ?', ['tp4-a4'], TP4_BOUTEILLE),
]

export type EtatCouverture = 'couvert' | 'a-venir' | 'non-couvert'

/** Couverture d'un attendu : questions qui le citent ; « à venir » tant qu'aucune n'est disponible */
export function couverture(a: Attendu): { etat: EtatCouverture; questions: QuestionAu3[] } {
  const questions = AU3_QUESTIONS.filter((x) => x.attendus.includes(a.id))
  if (!questions.length) return { etat: 'non-couvert', questions }
  return { etat: questions.some((x) => x.statut === 'disponible') ? 'couvert' : 'a-venir', questions }
}
