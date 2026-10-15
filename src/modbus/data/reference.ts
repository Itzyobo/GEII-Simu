/**
 * Valeurs de référence du simulateur TP2 « Liaison série / MODBUS » — SEULE source de constantes
 * physiques, temporelles, adresses, registres, trames et niveaux. Ne rien redéfinir ailleurs.
 *
 * Reprise de PRD §3. Unités SI (s, V, Hz, baud) ; l'unité usuelle est rappelée dans `unit` ou `note`.
 * Sources : CR = compte rendu et notes du 8 octobre 2026 ; énoncé = TP-10 à TP-18 ; photo = photos du
 * logiciel et du banc ; calcul = déduit d'autres entrées ; cours = norme publiée (Modbus, EIA-485, RS232) et rien
 * d'autre ; hypothèse = toute valeur choisie sans source, à vérifier (numéro H obligatoire).
 */

export type Source = 'CR' | 'énoncé' | 'photo' | 'calcul' | 'cours' | 'hypothèse'
export type Hyp = `H${number}`

/** Une entrée « hypothèse » porte obligatoirement son numéro H. */
export type Ref<T> = { value: T; unit?: string; note?: string } & (
  | { source: Exclude<Source, 'hypothèse'>; hyp?: Hyp }
  | { source: 'hypothèse'; hyp: Hyp }
)

export type Parity = 'none' | 'even' | 'odd'

const ref = <T,>(r: Ref<T>) => r

/* ───────────────────────────── Liaison série ───────────────────────────── */

const SERIE1_BAUD = 2400
const MODBUS_BAUD = 38400
const CARACTERE_8O1 = 11 // start + 8 données + parité + stop

export const REF = {
  serie1DataBits: ref({ value: 8 as const, source: 'énoncé', note: 'SERIE_1 : 8 bits, parité impaire' }),
  serie1Parity: ref({ value: 'odd' as Parity, source: 'énoncé' }),
  serie1StopBits: ref({ value: 1 as const, source: 'hypothèse', hyp: 'H1' }),
  serie1BitMesure: ref({ value: 440e-6, unit: 's', source: 'CR', note: 'lu aux curseurs ; ne correspond à aucun débit standard' }),
  serie1Baud: ref({
    value: SERIE1_BAUD,
    unit: 'baud',
    source: 'CR',
    hyp: 'H2',
    note: 'mesure Freq : 1,1899 kHz sur le signal alterné, soit 420 µs par bit (H2 résolue) ; modèle 416,7 µs par bit',
  }),
  serie1FreqMesuree: ref({ value: 1189.9, unit: 'Hz', source: 'CR', note: 'fréquencemètre de l’oscilloscope, signal alterné de 55H' }),
  serie1Repetition: ref({ value: 100e-3, unit: 's', source: 'hypothèse', hyp: 'H22', note: 'SERIE_1 et SERIE_2 : caractère suivi de repos jusqu’à sa répétition' }),
  serie1Duree11Bits: ref({ value: 4.84e-3, unit: 's', source: 'CR', note: '= 11 × 440 µs, pas une mesure indépendante (modèle : 4,58 ms)' }),
  serie2Format: ref({ value: 'inconnu', source: 'hypothèse', hyp: 'H3' }),
  serie2Candidats: ref({
    value: { bauds: [1200, 2400, 4800, 9600], dataBits: [7, 8] as const, parities: ['none', 'even', 'odd'] as Parity[], stopBits: 1 as const },
    source: 'hypothèse',
    hyp: 'H3',
    note: 'format tiré au sort une fois par session',
  }),
  serie2SaisieOctet: ref({ value: true, source: 'hypothèse', hyp: 'H28', note: 'SERIE_2 demande l’octet comme SERIE_1 (« mêmes opérations que précédemment »)' }),
  serie3Baud: ref({ value: 4800, unit: 'baud', source: 'CR', note: 'confirmé par RealTerm' }),
  serie3DataBits: ref({ value: 7 as const, source: 'CR', note: 'confirmé par RealTerm' }),
  serie3Parity: ref({ value: 'odd' as Parity, source: 'CR', note: 'confirmé par RealTerm' }),
  serie3StopBits: ref({ value: 1 as const, source: 'hypothèse', hyp: 'H4' }),
  serie3Message: ref({
    value: 'lyon 1',
    source: 'CR',
    note: 'RealTerm + notes du binôme : 6C 79 6F 6E 20 31, avec une espace ; le CR écrivait « lyon1 »',
  }),
  serie3Repetition: ref({ value: 111e-3, unit: 's', source: 'CR', note: 'période de répétition du message entier, silence compris' }),
  realtermPort: ref({ value: 'COM1', source: 'énoncé', note: '2.4 : « COM1, cadence de transfert, nombre de bits, parité, … »' }),
  realtermPorts: ref({ value: ['COM1', 'COM2'], source: 'hypothèse', hyp: 'H31', note: 'ports proposés ; seul COM1 est relié à la carte' }),
  realtermReglagesDefaut: ref({
    value: { baud: 9600, dataBits: 8 as 7 | 8, parity: 'none' as Parity, stopBits: 1 as 1 | 2 },
    source: 'hypothèse',
    hyp: 'H31',
    note: 'réglages de réception à l’ouverture de RealTerm',
  }),
  realtermBauds: ref({ value: [1200, 2400, 4800, 9600, 19200], source: 'hypothèse', hyp: 'H31', note: 'débits proposés dans RealTerm réduit' }),
  ttlLow: ref({ value: 0, unit: 'V', source: 'hypothèse', hyp: 'H27', note: 'repos haut' }),
  ttlHigh: ref({ value: 5, unit: 'V', source: 'hypothèse', hyp: 'H27' }),
  rs232High: ref({ value: 11.5, unit: 'V', source: 'CR', hyp: 'H5', note: 'Max mesuré 11,5 V (H5 résolue) ; niveau du 0 logique' }),
  rs232CreteACrete: ref({ value: 23.3, unit: 'V', source: 'CR', hyp: 'H5', note: 'crête à crête mesuré (H5 résolue)' }),
  rs232Low: ref({ value: 11.5 - 23.3, unit: 'V', source: 'calcul', note: '≈ −11,8 V = Max − crête à crête ; repos bas (1 logique)' }),
  scopeSerie1TimeDiv: ref({ value: 500e-6, unit: 's/div', source: 'photo' }),
  scopeSerie1Rs232VoltDiv: ref({ value: 10, unit: 'V/div', source: 'photo' }),
  scopeSerie1Probe: ref({ value: 1 as const, source: 'photo', note: 'sonde 1:1' }),
  scopeSerie1TtlVoltDiv: ref({ value: 2, unit: 'V/div', source: 'hypothèse', hyp: 'H6' }),
  scopeSerie1Slope: ref({ value: 'falling' as const, source: 'hypothèse', hyp: 'H6' }),
  scopeSerie1Mode: ref({ value: 'normal' as const, source: 'hypothèse', hyp: 'H6' }),
  scopeSerie1TtlLevel: ref({ value: (0 + 5) / 2, unit: 'V', source: 'hypothèse', hyp: 'H23', note: 'niveau de déclenchement par défaut : mi-hauteur entre les niveaux TTL' }),
  scopePositionInitiale: ref({ value: 4, unit: 'div', source: 'hypothèse', hyp: 'H25', note: 'retard du déclenchement par rapport au centre' }),
  scopeCurseursInitiaux: ref({ value: { x1: 2, x2: 4 }, unit: 'div', source: 'hypothèse', hyp: 'H25', note: 'depuis le bord gauche' }),
  scopeRafraichissement: ref({ value: 0.15, unit: 's', source: 'hypothèse', hyp: 'H26', note: 'intervalle entre deux acquisitions affichées' }),
  scopeDefilement: ref({ value: 0.17, unit: 'écran', source: 'hypothèse', hyp: 'H26', note: 'avance de la trace par acquisition en Auto sans déclenchement' }),

  /* ───────────────────────────── Générateur « message codé » et correction ───────────────────────────── */

  exerciceFormats: ref({
    value: { bauds: [1200, 2400, 4800, 9600, 19200], dataBits: [7, 8] as const, parities: ['none', 'even', 'odd'] as Parity[], stopBits: 1 as const },
    source: 'hypothèse',
    hyp: 'H29',
  }),
  exerciceLongueur: ref({ value: { 1: [3, 4], 2: [4, 6], 3: [6, 8] } as Record<1 | 2 | 3, [number, number]>, unit: 'caractères', source: 'hypothèse', hyp: 'H29' }),
  exerciceRs232Des: ref({ value: 2 as const, source: 'hypothèse', hyp: 'H29', note: 'difficulté à partir de laquelle le niveau peut être RS232' }),
  exerciceAlphabet: ref({ value: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ', source: 'hypothèse', hyp: 'H29', note: 'lettres, chiffres, espace (pas en tête ni en fin)' }),
  exerciceRepos: ref({ value: 2, unit: 'bits', source: 'hypothèse', hyp: 'H29', note: 'repos avant et après le message' }),
  exerciceVoltDiv: ref({ value: { TTL: 2, RS232: 5 }, unit: 'V/div', source: 'hypothèse', hyp: 'H29' }),
  exerciceBitMinDiv: ref({ value: 1.5, unit: 'div', source: 'hypothèse', hyp: 'H29', note: 'base de temps = plus grand calibre 1-2-5 tel qu’un bit couvre au moins 1,5 div' }),
  toleranceDebit: ref({ value: 0.1, source: 'hypothèse', hyp: 'H30', note: 'écart relatif accepté sur le débit répondu' }),
  toleranceTension: ref({ value: 0.05, source: 'hypothèse', hyp: 'H30', note: 'écart relatif accepté sur une tension répondue' }),
  toleranceBaseDeTemps: ref({ value: 0.01, source: 'hypothèse', hyp: 'H30', note: 'réponse reconnue comme la base de temps de l’écran' }),

  /* ───────────────────────────── Modbus : liaison et oscilloscope ───────────────────────────── */

  modbusBaud: ref({ value: MODBUS_BAUD, unit: 'baud', source: 'énoncé', note: 'énoncé + photo (barre d’état)' }),
  modbusDataBits: ref({ value: 8 as const, source: 'énoncé' }),
  modbusParity: ref({ value: 'even' as Parity, source: 'énoncé' }),
  modbusStopBits: ref({ value: 1 as const, source: 'énoncé' }),
  modbusPort: ref({ value: 'COM1', source: 'photo', note: 'barre d’état' }),
  modbusBit: ref({ value: 1 / MODBUS_BAUD, unit: 's', source: 'calcul', note: '26,04 µs' }),
  modbusOctet: ref({ value: CARACTERE_8O1 / MODBUS_BAUD, unit: 's', source: 'calcul', note: '11 bits = 286,5 µs' }),
  modbusSilence: ref({ value: 1.75e-3, unit: 's', source: 'cours', note: '≥ 1,75 ms, norme au-delà de 19 200 bauds' }),
  modbusRequete07: ref({ value: (4 * CARACTERE_8O1) / MODBUS_BAUD, unit: 's', source: 'calcul', note: '4 octets = 1,146 ms' }),
  pollPeriod: ref({ value: 1, unit: 's', source: 'photo', note: 'Fréquence interrogation esclave, valeur par défaut' }),
  captureVoltDiv: ref({ value: 1, unit: 'V/div', source: 'CR', note: 'Ch1 et Ch2' }),
  captureProbe: ref({ value: 10 as const, source: 'CR', note: 'sondes 10:1' }),
  captureMathVoltDiv: ref({ value: 1, unit: 'V/div', source: 'CR', note: 'Math = Ch1 − Ch2' }),
  captureMathOffset: ref({ value: 1.6902, unit: 'V', source: 'CR' }),
  captureTriggerLevel: ref({ value: 2.54, unit: 'V', source: 'CR' }),
  captureTimeDiv: ref({ value: 500e-6, unit: 's/div', source: 'hypothèse', hyp: 'H7' }),
  rs485Low: ref({ value: 1, unit: 'V', source: 'hypothèse', hyp: 'H8', note: 'TX+ et TX− opposés, ≈ 1 V et ≈ 4 V' }),
  rs485High: ref({ value: 4, unit: 'V', source: 'hypothèse', hyp: 'H8' }),
  rs485Idle: ref({ value: 2.5, unit: 'V', source: 'hypothèse', hyp: 'H9', note: 'haute impédance, sur les deux fils' }),

  /* ───────────────────────────── Esclaves ───────────────────────────── */

  esclaves: ref({ value: { OTB: 23, TDS: 30, TQS: 35, THT: 41 }, source: 'CR', note: 'analyseur ; étiquettes du pupitre' }),
  exceptionOTB: ref({ value: [0x17, 0x87, 0x01, 0x63, 0xf4], source: 'CR', note: 'capture' }),
  exceptionTDS: ref({ value: [0x1e, 0x87, 0x01, 0xb3, 0xf6], source: 'hypothèse', hyp: 'H10' }),
  exceptionTQS: ref({ value: [0x23, 0x87, 0x03, 0xa3, 0xfb], source: 'CR', note: 'capture, CRC vérifié' }),
  exceptionTHT: ref({ value: [0x29, 0x87, 0x01, 0x02, 0x38], source: 'CR', note: 'capture' }),
  otbFonctions: ref({ value: [3, 6, 16], source: 'énoncé', note: 'annexe' }),
  otbRegSorties: ref({ value: 100, source: 'énoncé', note: 'écrit en fonction 06' }),
  otbValeurTest: ref({ value: 0x5a, source: 'énoncé' }),
  otbLedsAllumees: ref({ value: ['Q1', 'Q3', 'Q4', 'Q6'], source: 'CR', note: 'photo des LED après écriture de 5AH' }),
  otbRegEntrees: ref({ value: 0, source: 'CR', note: 'lu en 03' }),
  otbReponseEntrees: ref({ value: [0x17, 0x03, 0x02, 0x0f, 0x0f, 0xb4, 0x73], source: 'CR', note: 'capture' }),
  otbCodesIdent: ref({ value: { 1102: 0x6004, 1103: 0x6007 }, source: 'énoncé', note: 'annexe' }),
  tdsFonctions: ref({ value: [3, 6], source: 'énoncé', note: 'annexe' }),
  tdsRegTexte: ref({ value: [100, 101, 102, 103], source: 'énoncé', note: 'ASCII minuscule' }),
  tdsRegLuminosite: ref({ value: 110, source: 'énoncé', note: '0 à 4' }),
  tdsRegDuree: ref({ value: 111, source: 'énoncé' }),
  tdsRegTempsRestant: ref({ value: 112, source: 'énoncé' }),
  tdsRegEntier: ref({ value: 113, source: 'énoncé', note: 'entier 0 à 9 999' }),
  tdsEntierTeste: ref({ value: 1234, source: 'hypothèse', hyp: 'H11' }),
  tdsRenduAbcd: ref({ value: 'AbCd', source: 'CR', note: 'photo de « abcd »' }),
  tqsTemperature: ref({ value: 0x00f3, unit: '0,1 °C', source: 'CR', note: 'registre 1 en 04 = 24,3 °C' }),
  thtTemperature: ref({ value: 0x00f0, unit: '0,1 °C', source: 'hypothèse', hyp: 'H12', note: '24,0 °C' }),
  thtHumidite: ref({ value: 0x00ef, unit: '0,1 %HR', source: 'CR', note: 'registre 5 en 04 = 23,9 %HR' }),
  thtPointRosee: ref({ value: 2.1, unit: '°C', source: 'hypothèse', hyp: 'H13' }),
  registre1LuEn03: ref({ value: { TQS: 0x0023, THT: 0x0029 }, source: 'énoncé', note: 'annexe : adresse Modbus du module' }),
  regVitesseDefaut: ref({ value: { code: 3, baud: 1200 }, source: 'énoncé', note: 'registre 2, annexe' }),
  regVitesseCode38400: ref({ value: null, source: 'hypothèse', hyp: 'H14', note: 'absent de l’annexe' }),
  exceptionFonction: ref({ value: 0x01, source: 'hypothèse', hyp: 'H15' }),
  exceptionRegistre: ref({ value: 0x02, source: 'hypothèse', hyp: 'H16' }),
  basesParDefaut: ref({
    value: { esclave: 'dec', adresse: 'hex', nombre: 'dec', valeur: 'hex' } as const,
    source: 'hypothèse',
    hyp: 'H17',
  }),
  controleFluxRequis: ref({ value: true, source: 'hypothèse', hyp: 'H18' }),

  /* ───────────────────────────── Modbus : limites de la norme ───────────────────────────── */

  modbusEsclaveMax: ref({ value: 247, source: 'cours', note: '0 = diffusion' }),
  modbusMotMax: ref({ value: 65535, source: 'cours', note: 'adresses et valeurs sur 16 bits' }),
  modbusMotsParRequete: ref({ value: 125, source: 'cours' }),
  modbusBitsParRequete: ref({ value: 2000, source: 'cours' }),
  crcPolynome: ref({ value: 0xa001, source: 'cours', note: 'A001H, CRC-16 Modbus réfléchi' }),
  crcInit: ref({ value: 0xffff, source: 'cours', note: 'FFFFH' }),

  /* ───────────────────────────── Paramètres de simulation ───────────────────────────── */

  scopeBruit: ref({ value: 0.01, source: 'hypothèse', hyp: 'H19', note: 'écart type relatif du gain de chaque acquisition' }),
  scopeBruitMax: ref({ value: 0.015, source: 'hypothèse', hyp: 'H19', note: 'erreur de gain tronquée : Max reste à ± 2 %' }),
  scopeBruitPoint: ref({ value: 0.003, source: 'hypothèse', hyp: 'H19', note: 'bruit visuel point par point, relatif, hors mesures' }),
  maitreFonctionDefaut: ref({ value: 1, source: 'hypothèse', hyp: 'H24', note: 'Fonction à réaliser à l’ouverture de Configuration Maître' }),
  sansMasseDerive: ref({ value: 1.5, unit: 'V', source: 'hypothèse', hyp: 'H20', note: 'décalage max d’une voie sans pince de masse' }),
  sansMasseBruit: ref({ value: 0.4, unit: 'V', source: 'hypothèse', hyp: 'H20', note: 'écart type du bruit capté sans masse' }),
  saisieFonctions15et16: ref({ value: 'valeurs séparées par des espaces', source: 'hypothèse', hyp: 'H21' }),
}

export type RefKey = keyof typeof REF

/** PRD §3, liste des hypothèses (H19+ ajoutées au fil des étapes). */
export const HYPOTHESES: Record<Hyp, { text: string; resolue?: boolean }> = {
  H1: { text: 'SERIE_1 a 1 bit de stop. Sur un caractère répété, 2 stops ressemblent à 1 stop suivi de repos.' },
  H2: { text: 'Résolue : 1,1899 kHz mesurés sur le signal alterné donnent 420 µs par bit, donc 2 400 bauds.', resolue: true },
  H3: { text: 'SERIE_2 : format tiré au sort parmi les formats standards jusqu’à ce que la vraie valeur soit saisie.' },
  H4: { text: 'SERIE_3 a 1 bit de stop. Un récepteur réglé sur 1 stop lit aussi 2 stops.' },
  H5: { text: 'Résolue : RS232 mesuré à Max 11,5 V et 23,3 V crête à crête.', resolue: true },
  H6: { text: 'Calibre TTL de SERIE_1 : 2 V/div, front descendant, mode Normal. La base de temps de 500 µs/div est lue sur les photos.' },
  H7: { text: 'Base de temps de la capture Modbus lue sur une photo floue.' },
  H8: { text: 'Niveaux bas et haut de TX+ et TX− non mesurés.' },
  H9: { text: 'Niveau du bus au repos fixé par la polarisation, non mesuré.' },
  H10: { text: 'Exception du TDS recalculée avec le code 01 : la photo est floue.' },
  H11: { text: 'Entier affiché sur le TDS non noté.' },
  H12: { text: 'THT : 00F0H choisi car cohérent avec le TQS, mais 00E0H n’est pas exclu.' },
  H13: { text: 'Point de rosée calculé par la formule de Magnus à partir de H12 et de 23,9 %HR.' },
  H14: { text: 'Code du registre de vitesse pour 38 400 bauds absent de l’annexe.' },
  H15: { text: 'Fonctions non implémentées hors 07 : exception 01 pour tous les modules.' },
  H16: { text: 'Écriture à un registre absent : exception 02.' },
  H17: {
    text: 'Les boîtes « Décimal / Hexadécimal » du logiciel sont des boutons qui basculent la base du champ. Valeurs par défaut lues sur les photos : esclave en décimal, adresse en hexadécimal, nombre en décimal, valeur en hexadécimal.',
  },
  H18: { text: 'Commutateur hors « contrôle de flux » : aucune émission.' },
  H19: {
    text: 'Bruit de l’oscilloscope : gain de chaque acquisition tiré selon une gaussienne d’écart type 1 %, tronquée à ± 1,5 % ; bruit visuel point par point d’écart type 0,3 %, hors mesures (paramètres de simulation, pas une mesure).',
  },
  H20: { text: 'Pince de masse absente : trace décalée jusqu’à ±1,5 V et bruit gaussien de 0,4 V (valeurs inventées, effet qualitatif).' },
  H21: {
    text: 'Champs des fonctions 2, 5, 15 et 16 du logiciel non photographiés : intitulés reconstitués sur le modèle de F1/F3/F6 ; valeurs de F15/F16 saisies séparées par des espaces.',
  },
  H22: { text: 'SERIE_1 : chaque caractère est suivi d’un repos ; période de répétition 100 ms (durée non relevée).' },
  H23: { text: 'Niveau de déclenchement TTL par défaut : 2,5 V, mi-hauteur entre 0 V et 5 V (réglage non noté).' },
  H24: { text: 'Configuration Maître s’ouvre sur la fonction 1, première de la liste (valeur par défaut non photographiée).' },
  H25: { text: 'Réglages initiaux de l’écran : déclenchement 4 div à gauche du centre, curseurs X à 2 et 4 div du bord gauche.' },
  H26: { text: 'Une acquisition affichée toutes les 150 ms ; en Auto sans déclenchement, la trace avance de 0,17 écran par acquisition.' },
  H27: { text: 'Niveaux TTL 0 V / 5 V : ni écrits dans l’énoncé, ni mesurés au TP.' },
  H28: { text: 'SERIE_2 demande l’octet à émettre comme SERIE_1 : l’énoncé dit « Réaliser les mêmes opérations que précédemment ».' },
  H29: {
    text: 'Générateur « message codé » : 1 200 à 19 200 bauds, 7 ou 8 bits, sans parité / paire / impaire, 1 stop ; 3 à 8 caractères (lettres, chiffres, espace) ; RS232 une fois sur deux à partir du niveau 2 ; 2 V/div en TTL, 5 V/div en RS232 ; un bit couvre au moins 1,5 div.',
  },
  H30: { text: 'Correction : débit accepté à ± 10 %, tensions à ± 5 % ; une réponse à ± 1 % de la base de temps est signalée comme confusion avec la durée d’un bit.' },
  H31: { text: 'RealTerm réduit : ports COM1 et COM2 proposés (seul COM1 relié à la carte) ; débits 1 200 à 19 200 bauds ; s’ouvre en 9 600 bauds, 8 bits, sans parité, 1 stop.' },
}
