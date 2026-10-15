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
  ttlLow: ref({ value: 0, unit: 'V', source: 'CR', note: 'Vcc = 5 V (CR) et tableau du binôme « TTL : 5 V » ; repos haut' }),
  ttlHigh: ref({ value: 5, unit: 'V', source: 'CR', note: 'Vcc = 5 V (CR) et tableau du binôme « TTL : 5 V »' }),
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
  debitsStandards: ref({ value: [1200, 2400, 4800, 9600, 19200, 38400], unit: 'baud', source: 'hypothèse', hyp: 'H30', note: 'seules réponses de débit notées juste' }),
  toleranceDebit: ref({ value: 0.1, source: 'hypothèse', hyp: 'H30', note: 'mesure à ± 10 % du bon débit standard sans l’arrondir : moitié des points' }),
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
  rs485IdlePlus: ref({ value: 2.65, unit: 'V', source: 'hypothèse', hyp: 'H9', note: 'TX+ en haute impédance, fixé par la polarisation' }),
  rs485IdleMinus: ref({ value: 2.35, unit: 'V', source: 'hypothèse', hyp: 'H9', note: 'TX− en haute impédance : différentiel +0,30 V, lu comme un 1' }),
  rs485SansPolarisation: ref({ value: 2.5, unit: 'V', source: 'hypothèse', hyp: 'H9', note: 'réglage « polarisation absente » : les deux fils au même potentiel' }),
  rs485Seuil: ref({ value: 0.2, unit: 'V', source: 'cours', note: 'EIA-485 : sensibilité du récepteur ± 200 mV ; en deçà, bit indéterminé' }),
  rs485Conflit: ref({ value: 0.05, unit: 'V', source: 'hypothèse', hyp: 'H39', note: 'différentiel quand deux drivers imposent des bits opposés (|V| < 200 mV)' }),
  terminaisonRebond: ref({
    value: { amplitude: 0.3, oscillations: 3 },
    source: 'hypothèse',
    hyp: 'H49',
    note: 'sans terminaison : une réflexion par aller-retour sur le câble, 30 % de l’excursion, amortie en 3 oscillations (amplitude non mesurée)',
  }),
  propagation: ref({ value: 5e-9, unit: 's/m', source: 'cours', note: 'paire torsadée : ≈ 0,66 c, soit ≈ 5 ns/m ; retard d’un rebond = 2 × L × 5 ns/m' }),
  busLongueur: ref({ value: 2, unit: 'm', source: 'hypothèse', hyp: 'H53', note: 'longueur du bus au banc du TP ; curseur de démonstration jusqu’à 1 200 m' }),
  scopePoints: ref({ value: 2500, source: 'hypothèse', hyp: 'H54', note: 'points d’acquisition par écran : un palier plus court qu’un point n’apparaît pas' }),
  bruitSansPolarisation: ref({ value: 20e-3, unit: 's', source: 'hypothèse', hyp: 'H50', note: 'sans polarisation, la ligne flottante change d’état au hasard toutes les 20 ms en moyenne' }),

  /* ───────────────────────────── Cours : normes RS232 et RS485 ───────────────────────────── */

  rs232Longueur: ref({ value: 15, unit: 'm', source: 'cours', note: 'RS232 (EIA/TIA-232) : longueur usuelle maximale' }),
  rs232Capacite: ref({ value: 2500e-12, unit: 'F', source: 'cours', note: 'RS232 : capacité de câble maximale, qui fixe la longueur' }),
  rs232Liaison: ref({ value: 'point à point, référencée à la masse, full duplex', source: 'cours', note: 'RS232 : TXD et RXD séparés, une masse commune' }),
  rs485Longueur: ref({ value: 1200, unit: 'm', source: 'cours', note: 'RS485 (EIA-485) : longueur maximale à bas débit' }),
  rs485DebitLongueurMax: ref({ value: 100e3, unit: 'bit/s', source: 'cours', note: 'RS485 : 1 200 m jusqu’à 100 kbit/s ; au-delà, la longueur admissible baisse quand le débit monte' }),
  rs485Charges: ref({ value: 32, source: 'cours', note: 'RS485 : 32 charges unitaires sur une paire' }),
  rs485Liaison: ref({ value: 'différentielle, multipoint, half duplex sur 2 fils (d’où TX_EN)', source: 'cours', note: 'RS485 à 2 fils' }),
  terminaisonOhms: ref({ value: 120, unit: 'Ω', source: 'cours', note: 'résistance à chaque extrémité de la paire, égale à son impédance caractéristique : supprime les réflexions' }),
  polarisationRole: ref({ value: 'fixe un état de repos stable (1) quand aucun driver ne pilote', source: 'cours', note: 'polarisation, ou failsafe, de la paire RS485' }),

  /* ───────────────────────────── Mode partiel ───────────────────────────── */

  partielDuree: ref({ value: 30 * 60, unit: 's', source: 'hypothèse', hyp: 'H51', note: 'durée par défaut, réglable' }),
  partielBareme: ref({
    value: { question: 1, cablage: 1, penalite: 0.5 },
    source: 'hypothèse',
    hyp: 'H52',
    note: '1 point par question ; câblage : 1 point au 1er essai, ½ au 2e, 0 ensuite ; −0,5 point par manipulation pendant une émission',
  }),
  rs485Convention: ref({ value: 'TX+ > TX− ⇔ 1 logique', source: 'hypothèse', hyp: 'H34', note: 'repos (1) : TX+ haut, TX− bas' }),
  parcoursIntervalle: ref({
    value: 0.2014,
    unit: 's',
    source: 'photo',
    note: 'analyseur : 10:52:14,650 → 14,852 → 15,053 → 15,254 → 15,454 → 15,657 → 15,859 → 16,059 → 16,261, soit (16,261 − 14,650) / 8',
  }),
  parcoursAdresses: ref({ value: 256, source: 'énoncé', note: 'adresses 00 à FF (« 00, 01, 02, …, 255 »)' }),
  esclaveDelaiReponse: ref({ value: 3e-3, unit: 's', source: 'hypothèse', hyp: 'H32', note: 'fin de la requête → premier start de la réponse (≥ 1,75 ms de la norme)' }),
  txEnAvance: ref({ value: 50e-6, unit: 's', source: 'hypothèse', hyp: 'H33', note: 'TX_EN monte avant le premier start' }),
  txEnRetard: ref({ value: 50e-6, unit: 's', source: 'hypothèse', hyp: 'H33', note: 'TX_EN redescend après le dernier stop ; même chose pour le driver d’un esclave' }),
  parasiteAmplitude: ref({ value: 1, unit: 'V', source: 'hypothèse', hyp: 'H35', note: 'parasite de mode commun de démonstration, sinus crête' }),
  parasiteFrequence: ref({ value: 1000, unit: 'Hz', source: 'hypothèse', hyp: 'H35' }),
  deuxMaitresDecalage: ref({ value: 0.5e-3, unit: 's', source: 'hypothèse', hyp: 'H37', note: 'second parcours calé sur les créneaux du premier' }),
  memoriseesAuMilieuDuCreneau: ref({ value: 0.5, unit: 'créneau', source: 'hypothèse', hyp: 'H38', note: 'trames mémorisées envoyées pendant un parcours : au milieu d’un créneau de 201,4 ms' }),

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
  tqsFonctions: ref({ value: [3, 4, 6], source: 'énoncé', note: 'annexe' }),
  thtFonctions: ref({ value: [3, 4, 6], source: 'énoncé', note: 'annexe' }),
  exceptionLibelles: ref({
    value: { 1: 'Code fonction inconnu', 2: 'Adresse incorrecte', 3: 'Valeur de donnée incorrecte', 4: 'Défaut de l’esclave' } as Record<number, string>,
    source: 'hypothèse',
    hyp: 'H36',
    note: '01 lu sur la photo de l’analyseur ; 02 à 04 reconstitués',
  }),
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
  regVitesseCode38400: ref({
    value: 8,
    source: 'hypothèse',
    hyp: 'H14',
    note: 'absent de l’annexe ; 0003 = 1 200, débit doublé à chaque code : 0004 = 2 400, 0005 = 4 800, 0006 = 9 600, 0007 = 19 200, 0008 = 38 400',
  }),
  otbRegistresEcrits: ref({ value: [100, 101, 102], source: 'hypothèse', hyp: 'H47', note: 'seuls registres de l’OTB acceptés en 06 et 16 (sorties TOR et analogiques)' }),
  configMuet: ref({ value: true, source: 'hypothèse', hyp: 'H48', note: 'vitesse ≠ 0008 ou parité ≠ 0001 réécrite : le module ne comprend plus le bus' }),
  regPariteCode: ref({ value: { 0: 'aucune', 1: 'paire', 2: 'impaire' } as Record<number, string>, source: 'hypothèse', hyp: 'H43', note: '0001 (paire) lu dans l’annexe ; 0 et 2 reconstitués' }),
  exceptionFonction: ref({ value: 0x01, source: 'hypothèse', hyp: 'H15' }),
  exceptionRegistre: ref({ value: 0x02, source: 'hypothèse', hyp: 'H16' }),
  exceptionValeur: ref({ value: 0x03, source: 'hypothèse', hyp: 'H42', note: 'valeur hors plage' }),
  otbAnalogMax: ref({ value: 4095, source: 'hypothèse', hyp: 'H40', note: 'entrées IN0–IN3 et sorties OUT1–OUT2 sur 12 bits' }),
  otbPotentiometres: ref({ value: [0.5, 0.25] as [number, number], source: 'hypothèse', hyp: 'H40', note: 'position initiale des 2 potentiomètres (IN0, IN1) ; IN2 et IN3 non câblées' }),
  tdsCaracteres: ref({ value: 'abcdefghijklmnopqrstuvwxyz0123456789 ', source: 'énoncé', note: 'annexe : « Code ASCII (a…z, 0…9, space) »' }),
  tdsLuminositeMax: ref({ value: 4, source: 'énoncé', note: '0 (éteint) à 4 (éclairage maxi)' }),
  tdsEntierMax: ref({ value: 9999, source: 'énoncé', note: 'annexe : 0 à 9999' }),
  tdsEtatInitial: ref({ value: { luminosite: 4, texte: '    ' }, source: 'hypothèse', hyp: 'H44', note: 'afficheur allumé, vide, à la mise sous tension' }),
  thtMagnus: ref({ value: { b: 17.62, c: 243.12 }, unit: '°C', source: 'hypothèse', hyp: 'H13', note: 'constantes de Magnus' }),
  memoriseesCycle: ref({ value: 'plus longue période saisie', source: 'hypothèse', hyp: 'H45', note: 'trames mémorisées envoyées tour à tour, une par créneau de 201,4 ms' }),
  analyseurLibelles: ref({ value: 'reconstitués', source: 'hypothèse', hyp: 'H46', note: 'libellés du Détail Trame hors réponse 03/04 et exception' }),
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
  H9: {
    text: 'Polarisation du bus, non mesurée : en haute impédance TX+ ≈ 2,65 V et TX− ≈ 2,35 V, soit +0,30 V lu comme un 1 logique. Réglage « polarisation absente » : les deux fils à 2,5 V, différentiel nul.',
  },
  H10: { text: 'Exception du TDS recalculée avec le code 01 : la photo est floue.' },
  H11: { text: 'Entier affiché sur le TDS non noté.' },
  H12: { text: 'THT : 00F0H choisi car cohérent avec le TQS, mais 00E0H n’est pas exclu.' },
  H13: { text: 'Point de rosée calculé par la formule de Magnus (b = 17,62, c = 243,12 °C) à partir de H12 et de 23,9 %HR.' },
  H14: {
    text: 'Code du registre de vitesse pour 38 400 bauds absent de l’annexe : 0008, en prolongeant 0003 = 1 200 bps avec un doublement par code (0004 = 2 400, 0005 = 4 800, 0006 = 9 600, 0007 = 19 200, 0008 = 38 400).',
  },
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
  H27: { text: 'Supprimée : niveaux TTL 0 V / 5 V sourcés par le CR (« Vcc = 5 V » et tableau du binôme « TTL : 5 V »).', resolue: true },
  H28: { text: 'SERIE_2 demande l’octet à émettre comme SERIE_1 : l’énoncé dit « Réaliser les mêmes opérations que précédemment ».' },
  H29: {
    text: 'Générateur « message codé » : 1 200 à 19 200 bauds, 7 ou 8 bits, sans parité / paire / impaire, 1 stop ; 3 à 8 caractères (lettres, chiffres, espace) ; RS232 une fois sur deux à partir du niveau 2 ; 2 V/div en TTL, 5 V/div en RS232 ; un bit couvre au moins 1,5 div.',
  },
  H30: {
    text: 'Correction : la bonne réponse de débit est le débit standard exact (1 200, 2 400, 4 800, 9 600, 19 200, 38 400) ; une valeur à ± 10 % du bon débit sans être un standard vaut la moitié des points ; tensions à ± 5 % ; une réponse à ± 1 % de la base de temps est signalée comme confusion avec la durée d’un bit.',
  },
  H31: { text: 'RealTerm réduit : ports COM1 et COM2 proposés (seul COM1 relié à la carte) ; débits 1 200 à 19 200 bauds ; s’ouvre en 9 600 bauds, 8 bits, sans parité, 1 stop.' },
  H32: { text: 'Délai de réponse d’un esclave : 3 ms entre la fin de la requête et le start de la réponse (non mesuré ; la norme impose au moins 1,75 ms).' },
  H33: { text: 'TX_EN monte 50 µs avant le premier start et redescend 50 µs après le dernier stop (non mesuré) ; le driver d’un esclave suit la même règle.' },
  H34: { text: 'Convention RS485 : 1 logique (et repos piloté) ⇔ TX+ > TX−.' },
  H35: { text: 'Parasite de mode commun de démonstration : sinus de 1 V crête à 1 kHz ajouté aux deux fils.' },
  H36: { text: 'Libellés de l’analyseur pour les codes d’exception 02 à 04 non photographiés (seul 01 « Code fonction inconnu » est lu).' },
  H37: {
    text: 'Deux cartes en Maître : un second parcours lancé pendant le premier se cale sur ses créneaux, décalé de 0,5 ms (les deux PC lancés ensemble). Simplification : en réalité, deux maîtres décalés ne se percutent que par moments.',
  },
  H38: { text: 'Pendant un parcours, le logiciel envoie les trames mémorisées au milieu d’un créneau de 201,4 ms, à la période d’interrogation.' },
  H39: {
    text: 'Conflit de drivers RS485 : un bit identique sur les deux émetteurs passe normalement ; des bits opposés donnent un différentiel de 0,05 V (sous le seuil de 200 mV), et le récepteur lit un bit au hasard (générateur à graine).',
  },
  H40: { text: 'OTB : entrées analogiques IN0 et IN1 réglées par les 2 potentiomètres, IN2 et IN3 non câblées (0) ; entrées et sorties analogiques sur 12 bits (0 à 4 095) ; potentiomètres à 50 % et 25 % au départ.' },
  H41: { text: 'OTB : l’octet fort écrit dans le registre 100 est ignoré ; écrire en 06 ou 16 un registre d’entrée (0 à 4) ou un code d’identification → exception 02.' },
  H42: { text: 'Valeur hors plage (entier > 9 999, luminosité > 4, caractère hors a…z / 0…9 / espace, nombre de mots hors 1…125) → exception 03.' },
  H43: {
    text: 'Registres de configuration 1 à 3 écrits en 06 : écho, puis effet immédiat ; nouvelle adresse (1 à 247) prise aussitôt. Codes de parité : 0 aucune, 1 paire (annexe), 2 impaire.',
  },
  H44: { text: 'TDS : entier aligné à droite sans zéros non significatifs ; le dernier registre écrit (texte ou entier) fixe le mode d’affichage ; au départ luminosité 4 et affichage vide.' },
  H45: { text: 'Trames mémorisées : envoyées tour à tour, une par créneau de 201,4 ms ; le cycle se répète à la plus longue période saisie (au moins le temps d’envoyer toutes les trames).' },
  H46: { text: 'Libellés du « Détail Trame » pour les requêtes et les réponses 06 et 16 reconstitués sur le modèle de la photo (réponse 03/04 et exception lues sur les photos).' },
  H47: { text: 'OTB : les fonctions 06 et 16 n’acceptent que les registres 100 à 102 (sorties TOR et analogiques) ; tout autre registre → exception 02.' },
  H48: { text: 'Vitesse (≠ 0008) ou parité (≠ 0001) réécrite dans un module : écho, puis le module ne comprend plus le bus et reste muet jusqu’à « Réinitialiser le pupitre ».' },
  H49: {
    text: 'Terminaison absente : après chaque front de TX+ et TX−, une réflexion par aller-retour sur le câble (retard 2 × L × 5 ns/m), d’amplitude 30 % de l’excursion, amortie en 3 oscillations ; l’amplitude n’est pas mesurée.',
  },
  H50: { text: 'Polarisation absente : la ligne flottante change d’état au hasard toutes les 20 ms en moyenne ; le récepteur y lit des caractères parasites.' },
  H51: { text: 'Mode partiel : 30 minutes par défaut (réglable).' },
  H52: { text: 'Barème du partiel : 1 point par question ; câblage 1 point au 1er « Faire vérifier » réussi, ½ au 2e, 0 ensuite ; −0,5 point par manipulation pendant une émission.' },
  H53: { text: 'Longueur du bus au banc du TP : 2 m (quelques mètres de câble entre les cartes et le pupitre), non mesurée.' },
  H54: { text: 'Oscilloscope : 2 500 points d’acquisition par écran ; un palier plus court qu’un point n’apparaît ni sur la trace ni dans les mesures.' },
}
