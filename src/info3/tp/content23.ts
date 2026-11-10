/**
 * Questions des TP2 et TP3 décrites par « parties » : défi noté par le professeur virtuel, QCM (une ou
 * plusieurs réponses), valeurs numériques, mise en ordre, liste de contrôle. Les réponses attendues sont
 * calculées (INFO3, fichiers générés du projet de l'étudiant), jamais écrites en dur.
 */
import { INFO3 } from '../../data/reference'
import { timerClockHz } from '../models/timer246'
import { sckFrequency } from '../mcc/spi'
import { pwmPeriod } from '../mcc/pwm'
import { systemFosc } from '../mcc/config'
import { PRESCALERS } from '../mcc/timers'
import { parsePin } from '../models/gpio'
import type { Project } from '../project/project'
import type { Tp23QuestionId } from '../project/verify23'

export interface Choice {
  prompt: string
  options: string[]
  /** Bonne(s) réponse(s) ; plusieurs = cases à cocher */
  answers: string[]
  multi?: boolean
  explanation: string
}

export interface NumField {
  label: string
  expected: number
  /** Saisie en hexadécimal acceptée (registres) */
  register?: boolean
  /** Mesure : nombre décimal accepté, écart relatif toléré */
  tolerance?: number
}

export type Part =
  | { kind: 'grade' }
  | { kind: 'qcm'; qcm: Choice }
  | { kind: 'numeric'; prompt: string; fields: NumField[] | null; missing: string }
  | { kind: 'order'; prompt: string; correct: string[]; shuffled: string[] }
  | { kind: 'checklist'; items: string[] }

/** Mélange déterministe pour les mises en ordre (paires inversées, puis rotation d'un cran) */
export function shuffle<T>(xs: readonly T[]): T[] {
  const b = [...xs]
  for (let i = 0; i + 1 < b.length; i += 2) [b[i], b[i + 1]] = [b[i + 1], b[i]]
  return b.length > 2 ? [...b.slice(1), b[0]] : b
}

const MCC_DIR = INFO3.mcc.dir
const [S1, S2] = INFO3.pins.buttons
const P = INFO3.tp1.namePrefix
const MHZ = INFO3.units.usPerS
const MS = INFO3.units.msPerS

/** Nom MCC de la source IOC d'une broche : RB4 → IOCBF4 */
const iocId = (pin: string) => {
  const { port, bit } = parsePin(pin)
  return `IOC${port}F${bit}`
}

/* ───────────── TP2 ───────────── */

const MACROS = ['INTERRUPT_GlobalInterruptEnable();', 'INTERRUPT_PeripheralInterruptEnable();', 'INTERRUPT_GlobalInterruptDisable();', 'INTERRUPT_PeripheralInterruptDisable();']

export function qcmLines(): Choice {
  return {
    prompt: 'Quelle(s) ligne(s) du main.c généré faut-il décommenter pour que l’IOC de S1 et S2 déclenche l’ISR ?',
    options: MACROS,
    answers: [MACROS[0]],
    multi: true,
    explanation: 'L’IOC est une source de premier niveau (PIE0) : GIE suffit. PEIE ne valide que les périphériques de PIE1 à PIE8 ; les deux macros « Disable » couperaient les interruptions.',
  }
}

export function qcmPeie(): Choice {
  return {
    prompt: 'Pourquoi INTERRUPT_PeripheralInterruptEnable() n’est-il pas nécessaire pour l’IOC ?',
    options: ['IOC est une interruption de premier niveau (PIE0)', 'MCC les active déjà', 'PEIE ne concerne que les timers', 'GIE active aussi PEIE'],
    answers: ['IOC est une interruption de premier niveau (PIE0)'],
    explanation:
      'IOCIE est dans PIE0 : le PIC ne regarde que GIE pour ces sources. PEIE conditionne PIE1 à PIE8. MCC met bien IOCIE à 1 dans PIN_MANAGER_Initialize, mais ne touche ni GIE ni PEIE : la réponse « MCC les active déjà » ne l’explique pas.',
  }
}

export function callChain(): string[] {
  const id = iocId(S1.pin)
  return ['INTERRUPT_InterruptManager()', 'PIN_MANAGER_IOC()', `${id}_ISR()`, `${id}_InterruptHandler() → ${P.button}${S1.name}_ISR()`]
}

export function qcmStable(): Choice {
  return {
    prompt: 'Le codeur est arrêté sur un cran. Que valent ENCA et ENCB ?',
    options: ['ENCA = ENCB (00 ou 11 selon le cran)', 'ENCA ≠ ENCB (01 ou 10)', 'Toujours 00', 'Toujours 11'],
    answers: ['ENCA = ENCB (00 ou 11 selon le cran)'],
    explanation: `Entre deux crans, une voie bascule puis l’autre : au repos les deux voies sont égales, 00 et 11 alternent d’un cran au suivant (${INFO3.rotary.detentsPerTurn} crans, ${INFO3.rotary.pulsesPerTurn} impulsions par voie et par tour).`,
  }
}

/* ───────────── TP3 ───────────── */

/** Registres écrits par le tmr2.c généré du projet */
export function tmr2Registers(p: Project): Record<string, number> | null {
  const c = p.generated?.[`${MCC_DIR}/tmr2.c`]
  if (!c) return null
  const out: Record<string, number> = {}
  for (const r of ['T2PR', 'T2CLKCON', 'T2CON']) {
    const m = new RegExp(`\\b${r}\\s*=\\s*(0x[0-9A-Fa-f]+)\\s*;`).exec(c)
    if (!m) return null
    out[r] = parseInt(m[1], 16)
  }
  return out
}

const CKPS_SHIFT = 4
const CKPS_MASK = 0b111

export function tmr2Fields(p: Project): NumField[] | null {
  const r = tmr2Registers(p)
  if (!r) return null
  return [
    { label: 'T2PR =', expected: r.T2PR, register: true },
    { label: 'T2CLKCON =', expected: r.T2CLKCON, register: true },
    { label: 'Prescaler 1:', expected: 2 ** ((r.T2CON >> CKPS_SHIFT) & CKPS_MASK) },
  ]
}

/** Période maximale de TMR2IF à FOSC/4 avec Fosc = 4 MHz : 256 × 128 × 16 / 1 MHz */
export function maxPeriodFosc4(): number {
  const T = INFO3.timers
  const clk = timerClockHz(T.clockSources[0].cs, INFO3.clock.foscDefault, INFO3.clock.foscDefault)
  return (T.counterRange * 2 ** T.prescalerMaxLog2 * T.postscalerMax) / clk
}

const fmt = (x: number, digits = 0) => x.toLocaleString('fr-FR', { maximumFractionDigits: digits })

export function qcmOneSecond(): Choice {
  const max = maxPeriodFosc4()
  const right = `La période maximale vaut 256 × 128 × 16 / 1 MHz ≈ ${fmt(max * MS)} ms, inférieure à 1 s`
  return {
    prompt: `Pourquoi Timer2 ne peut-il pas lever TMR2IF toutes les secondes avec la source FOSC/4 et Fosc = ${fmt(INFO3.clock.foscDefault / MHZ)} MHz ?`,
    options: [right, 'Le postscaler est limité à 1:8', 'T2PR est un registre 16 bits qu’il faudrait écrire en deux fois', 'FOSC/4 ne peut pas cadencer Timer2'],
    answers: [right],
    explanation: `T2PR (8 bits) donne au plus 256 incréments, le prescaler 1:128 et le postscaler 1:16 : ${fmt(max * MS)} ms. Il faut une horloge plus lente (LFINTOSC, 31 kHz) ou un Fosc plus bas.`,
  }
}

export function qcmPostscaler(): Choice {
  const right = 'Le timer s’arrête après une seule période : TMR2IF doit être levé dès la première égalité TMR2 = T2PR'
  return {
    prompt: 'En mode Monostable, MCC impose le postscaler 1:1. Pourquoi ?',
    options: [right, 'Le postscaler ne fonctionne pas avec LFINTOSC', 'Pour obtenir exactement 10 ms', 'Le postscaler est réservé à l’entrée T2IN'],
    answers: [right],
    explanation: 'Un monostable ne compte qu’une période par déclenchement : avec un postscaler 1:N, TMR2IF n’arriverait qu’au N-ième appui (cours p. 63).',
  }
}

export function qcmClockTrap(): Choice {
  const lf = INFO3.clock.lfintosc
  const shown = INFO3.clock.mccGreyedClockField
  const pre = 2
  const pr = (hz: number) => Math.round((INFO3.tp3.debounceS * hz) / pre) - 1
  const right = `${fmt(lf / INFO3.units.msPerS)} kHz : la fréquence réelle de LFINTOSC`
  return {
    prompt: `Pour LFINTOSC, MCC affiche « Clock Frequency : ${fmt(shown / INFO3.units.msPerS, 3)} kHz ». Quelle fréquence MCC utilise-t-il pour calculer T2PR ?`,
    options: [right, `${fmt(shown / INFO3.units.msPerS, 3)} kHz : la valeur affichée`, '500 kHz (MFINTOSC)', '1 MHz (FOSC/4)'],
    answers: [right],
    explanation: `Le champ affiché est trompeur : avec 1:${pre} et 10 ms, MCC écrit T2PR = ${pr(lf)} (calculé avec ${fmt(lf)} Hz) ; avec ${fmt(shown)} Hz on trouverait ${pr(shown)} (cours p. 64).`,
  }
}

export function debugChecklist(): string[] {
  return [
    `Poser un point d’arrêt dans ${P.button}${S1.name}_ISR, lancer Debug et appuyer sur ${S1.name} : l’exécution s’arrête au premier appui`,
    'Déplacer le point d’arrêt dans IT_Timer2 (un seul point d’arrêt disponible), Continue, puis appuyer sur S2',
    `L’arrêt a lieu ${fmt(INFO3.tp3.debounceS * MS)} ms après l’appui (pas immédiatement) : vérifier sur l’analyseur logique avec les voies ${S2.pin} et ISR`,
    'Observer les variables (cpt) dans la fenêtre Variables à chaque arrêt',
  ]
}

/* ───────────── TP4 ───────────── */

const US_PER_S = INFO3.units.usPerS
const bitsOf = (v: number) => Array.from({ length: INFO3.c.bitsPerByte }, (_, i) => (v >> (INFO3.c.bitsPerByte - 1 - i)) & 1)

/** §1 : période de SCK attendue (µs), calculée depuis la configuration MSSP1 du projet */
export function sckFields(p: Project): NumField[] | null {
  const m = p.mcc.mssp
  const f = m ? sckFrequency(p.mcc, m) : null
  if (!f) return null
  return [{ label: 'Période de SCK (µs) :', expected: US_PER_S / f, tolerance: INFO3.tp4.sckTolerance }]
}

export function qcmMsbFirst(): Choice {
  const b = INFO3.tp4.byte
  const msb = bitsOf(b).join(', ')
  const lsb = [...bitsOf(b)].reverse().join(', ')
  const right = `Bit 7 (MSB) en premier : ${msb}`
  return {
    prompt: `Dans quel ordre les bits de 0x${b.toString(16).toUpperCase()} sortent-ils sur MOSI ?`,
    options: [right, `Bit 0 (LSB) en premier : ${lsb}`, 'Dans l’ordre fixé par le mode SPI choisi', 'Bit 0 en premier en modes 0 et 1, bit 7 en modes 2 et 3'],
    answers: [right],
    explanation: 'Le MSSP envoie toujours le bit de poids fort en premier, quel que soit le mode (cours p. 71) : on le lit à l’oscilloscope sur TP16 au front de lecture de SCK.',
  }
}

export function qcmSpiMode(): Choice {
  const modes = INFO3.spi.modes.map((m) => `Mode ${m.mode} (CKP = ${m.ckp}, CKE = ${m.cke})`)
  return {
    prompt: 'Quel(s) mode(s) SPI conviennent aux 74HC595 de l’anneau ?',
    options: modes,
    answers: INFO3.tp4.goodModes.map((g) => modes[g]),
    multi: true,
    explanation:
      'Le 74HC595 décale au front montant de SCK. En modes 0 et 3, MOSI change sur le front descendant et reste stable au front montant. En modes 1 et 2, MOSI change sur ce même front montant : le 74HC595 lit le bit précédent et le motif est décalé d’un rang (H14 ; cours p. 71 à 74 et 81).',
  }
}

export function qcmWriteExchange(): Choice {
  const right = 'WriteByte écrit SSP1BUF et rend la main aussitôt ; ExchangeByte attend la fin du transfert (SSP1IF), l’efface et renvoie l’octet reçu'
  return {
    prompt: 'Quelle différence entre SPI1_WriteByte et SPI1_ExchangeByte ?',
    options: [right, 'WriteByte attend la fin du transfert, ExchangeByte non', 'ExchangeByte envoie deux octets à la suite', 'Aucune : ExchangeByte est un autre nom de WriteByte'],
    answers: [right],
    explanation: 'Deux WriteByte trop rapprochés écrivent SSP1BUF pendant le transfert : WCOL = 1 et le second octet est perdu. ExchangeByte attend SSP1IF, donc on peut enchaîner les octets, puis basculer LATCH une fois le transfert terminé (cours p. 74).',
  }
}

/* ───────────── TP5 ───────────── */

/** §1 : période PWM attendue à l'oscilloscope (ms), calculée depuis la configuration (TMR2 de PWM6) */
export function pwmPeriodFields(p: Project): NumField[] | null {
  const c = p.mcc.pwm?.PWM6
  const s = c ? pwmPeriod(p.mcc, c) : null
  if (!s) return null
  return [{ label: 'Période de la PWM (ms) :', expected: s * MS, tolerance: INFO3.tp5.scopeTolerance }]
}

/** §1 : prescaler qui donne la période la plus proche de « environ 4 ms » avec PR2 = 0xFF et le Fosc du projet */
export function prescalerFor4ms(p: Project): number {
  const fosc = systemFosc(p.mcc.system)
  const counts = 1 << INFO3.c.bitsPerByte
  const period = (pre: number) => (counts * pre * INFO3.clock.foscPerTcy) / fosc
  return PRESCALERS.reduce((best, pre) => (Math.abs(period(pre) - INFO3.tp5.periodS) < Math.abs(period(best) - INFO3.tp5.periodS) ? pre : best), PRESCALERS[0])
}

export function qcmPr2(): Choice {
  const levels = INFO3.pwm.dutyPerCount * (1 << INFO3.c.bitsPerByte)
  const right = `Avec PR2 = 255, la base 10 bits (TMR2 et 2 bits de plus) parcourt ${levels} valeurs : le rapport cyclique a ${INFO3.pwm.dutyBits} bits de résolution`
  return {
    prompt: 'Pourquoi faut-il PR2 = 0xFF pour une PWM sur 10 bits ?',
    options: [right, 'PR2 = 0xFF donne la période la plus courte', 'PR2 fixe le rapport cyclique : 0xFF = 100 %', 'Le PIC refuse toute autre valeur en mode PWM'],
    answers: [right],
    explanation: `Le seuil est comparé à TMR2 complété de 2 bits : la période compte 4 × (PR2 + 1) pas. Il n’y a 2^${INFO3.pwm.dutyBits} = ${levels} pas que si PR2 + 1 = 256 (cours p. 87) ; avec un PR2 plus petit la résolution baisse.`,
  }
}

export function qcmFosc4(): Choice {
  const right = 'La PWM compte au rythme de Tosc (base 10 bits = TMR2 et 2 bits de plus) : le timer doit être cadencé par FOSC/4'
  return {
    prompt: 'Pourquoi le timer de la PWM doit-il avoir FOSC/4 comme source ?',
    options: [right, 'FOSC/4 est la seule source qui permet d’utiliser le postscaler', 'Avec LFINTOSC la LED clignoterait au lieu de varier', 'MCC n’accepte pas d’autre source pour TMR2'],
    answers: [right],
    explanation: `Le cours (p. 85) impose FOSC/4 : la période vaut alors (PR2 + 1) × 4 × Tosc × prescaler et les 2 bits supplémentaires du seuil correspondent aux 4 Tosc d’un incrément de TMR2. MCC signale une autre source dans « Notifications [MCC] » (comportement simulé = H41).`,
  }
}

/* ───────────── TP6 ───────────── */

export function qcmJoystickRest(): Choice {
  const r = INFO3.analog.joyRest
  const right = `Au repos, le joystick ne donne ni 512 ni 50 % (X ≈ ${r.x}, Y ≈ ${r.y}) et la valeur de Y augmente vers le bas`
  return {
    prompt: 'Que constatez-vous sur les valeurs du joystick ?',
    options: [right, 'Au repos, X et Y valent exactement 512 (50 %)', 'Les deux axes augmentent vers la droite et vers le haut', 'Le joystick donne 0 au repos et 1023 en butée'],
    answers: [right],
    explanation: `Le point milieu des potentiomètres du joystick n’est pas à VDD/2 : il faut le mesurer (H4). Y croît vers le bas (H48) : la calibration devra inverser l’axe pour obtenir + en haut.`,
  }
}

export function qcmCalibration(): Choice {
  const right = 'Mesurer la valeur brute au repos, la soustraire à chaque mesure, et inverser l’axe dont le sens est opposé (Y)'
  return {
    prompt: 'Comment obtenir 0 au repos, des valeurs négatives à gauche et en bas, positives à droite et en haut ?',
    options: [right, 'Soustraire 512 à chaque mesure', 'Diviser chaque mesure par 1023 puis multiplier par 100', 'Régler VREF pour que le repos tombe à 512'],
    answers: [right],
    explanation: 'Le repos n’est pas à 512 (H4) : 512 fixe donnerait un décalage. La différence avec la valeur de repos centre l’axe ; changer son signe pour Y (valeur brute croissante vers le bas, H48) met le positif en haut.',
  }
}

/* ───────────── Parties par question ───────────── */

export function partsOf(id: Tp23QuestionId, p: Project): Part[] {
  switch (id) {
    case 'tp2-1-1':
      return [{ kind: 'grade' }, { kind: 'qcm', qcm: qcmLines() }]
    case 'tp2-1-2':
      return [
        { kind: 'qcm', qcm: qcmPeie() },
        { kind: 'order', prompt: 'Remettre dans l’ordre la chaîne d’appel déclenchée par un appui sur S1 :', correct: callChain(), shuffled: shuffle(callChain()) },
      ]
    case 'tp2-2-1':
      return [
        {
          kind: 'numeric',
          prompt: 'Codeur EC12D de la carte ROTARY O click (documentation, annexe 4) :',
          fields: [
            { label: 'Crans par tour :', expected: INFO3.rotary.detentsPerTurn },
            { label: 'Impulsions par tour (une voie) :', expected: INFO3.rotary.pulsesPerTurn },
          ],
          missing: '',
        },
      ]
    case 'tp2-2-2':
      return [{ kind: 'grade' }, { kind: 'qcm', qcm: qcmStable() }]
    case 'tp2-2-3':
    case 'tp2-2-4':
      return [{ kind: 'grade' }]
    case 'tp3-1':
      return [
        { kind: 'grade' },
        { kind: 'numeric', prompt: 'Valeurs écrites par votre tmr2.c :', fields: tmr2Fields(p), missing: 'Ajouter TMR2 dans MCC puis cliquer sur Generate : les valeurs se lisent dans mcc_generated_files/tmr2.c.' },
        { kind: 'qcm', qcm: qcmOneSecond() },
      ]
    case 'tp3-2':
      return [{ kind: 'grade' }, { kind: 'qcm', qcm: qcmPostscaler() }, { kind: 'qcm', qcm: qcmClockTrap() }]
    case 'tp3-3':
      return [{ kind: 'checklist', items: debugChecklist() }]
    case 'tp4-1':
      return [
        { kind: 'grade' },
        { kind: 'numeric', prompt: 'Période de SCK relevée aux curseurs de l’oscilloscope (TP17) :', fields: sckFields(p), missing: 'Ajouter MSSP1 dans MCC (Device Resources › MSSP › MSSP1) : la période attendue se calcule depuis votre configuration.' },
        { kind: 'qcm', qcm: qcmMsbFirst() },
      ]
    case 'tp4-2':
      return [{ kind: 'grade' }, { kind: 'qcm', qcm: qcmSpiMode() }, { kind: 'qcm', qcm: qcmWriteExchange() }]
    case 'tp4-3':
    case 'tp4-4':
    case 'tp4-5':
    case 'tp4-6':
      return [{ kind: 'grade' }]
    case 'tp5-1':
      return [
        { kind: 'grade' },
        { kind: 'numeric', prompt: 'Période de la PWM relevée à l’oscilloscope (TP10, RGB_R) :', fields: pwmPeriodFields(p), missing: 'Ajouter PWM6 et TMR2 dans MCC : la période attendue se calcule depuis votre configuration.' },
        { kind: 'numeric', prompt: 'Prescaler de TMR2 pour une période d’environ 4 ms (PR2 = 0xFF, Fosc de votre System Module) :', fields: [{ label: 'Prescaler 1:', expected: prescalerFor4ms(p) }], missing: '' },
        { kind: 'qcm', qcm: qcmPr2() },
        { kind: 'qcm', qcm: qcmFosc4() },
      ]
    case 'tp5-2':
    case 'tp5-3':
    case 'tp5-4':
      return [{ kind: 'grade' }]
    case 'tp6-1-1':
      return [{ kind: 'grade' }, { kind: 'qcm', qcm: qcmJoystickRest() }]
    case 'tp6-1-2':
      return [{ kind: 'qcm', qcm: qcmCalibration() }]
    case 'tp6-1-3':
    case 'tp6-2':
    case 'tp6-3':
    case 'tp6-4':
      return [{ kind: 'grade' }]
  }
}
