/** Messages typés entre le fil principal et le Worker de simulation (unions discriminées). */
import type { INFO3 } from '../../data/reference'

export type Speed = (typeof INFO3.vm.speeds)[number]

/** Fil principal → Worker */
export type InMsg =
  /** Build (F11) : compile sans charger */
  | { type: 'build'; files: Record<string, string> }
  /** Make and Program Device / Debug : compile et charge dans le PIC (sans lancer) */
  | { type: 'load'; files: Record<string, string> }
  | { type: 'run'; speed: Speed }
  | { type: 'pause' }
  | { type: 'reset' }
  /** Step Into */
  | { type: 'step' }
  | { type: 'stepOver' }
  | { type: 'stepOut' }
  | { type: 'stimulus'; action: 'press' | 'release'; button: string; bounce: boolean }
  | { type: 'breakpoint'; file: string; line: number | null }
  /** Fenêtres Variables et SFR */
  | { type: 'inspect' }
  /** Défi du professeur virtuel */
  | { type: 'grade'; question: string; files: Record<string, string> }
  /** Mise hors tension (USB noir débranché) : programme arrêté, broches relâchées */
  | { type: 'powerOff' }
  /** Horloge interne du Worker : temps réel écoulé depuis le tick précédent */
  | { type: 'tick'; wallMs: number }
  /** Banc : mikroBUS où la carte Rotary est enfichée, USB blanc (port COM du terminal) — appliqués au PIC courant et aux suivants */
  | { type: 'bench'; rotary: 'mikrobus1' | 'mikrobus2' | null; usbWhite?: boolean; matrix?: 'mikrobus1' | 'mikrobus2' | null }
  /** Terminal série : baud et format (8N1…), octets tapés au clavier */
  | { type: 'terminal'; baud: number; format: string }
  | { type: 'terminalSend'; bytes: number[] }
  /** Banc analogique : potentiomètre (0 à 1), joystick (x vers la droite, y vers le haut, -1 à 1), bouton du joystick */
  | { type: 'analog'; pot?: number; joy?: [number, number]; joySw?: boolean }
  /** Codeur : crans (signe = sens), rotation continue (crans/s, 0 = arrêt), bouton SW */
  | { type: 'rotary'; action: 'turn'; detents: number }
  | { type: 'rotary'; action: 'spin'; rate: number }
  | { type: 'rotary'; action: 'sw'; pressed: boolean }
  /** Analyseur logique : voies observées (broches RA0…, pseudo-voies ISR, TMRxIF) */
  | { type: 'analyzer'; channels: string[] }

/** Changement d'une voie de l'analyseur logique (t en s simulées) */
export interface TraceChange {
  ch: string
  t: number
  level: 0 | 1
}

export type OutputLevel = 'info' | 'warning' | 'error'

export interface WatchRow {
  name: string
  value: string
}

/** Worker → fil principal */
export type OutMsg =
  | {
      type: 'frame'
      /** Temps simulé — s */
      tSim: number
      /** Broches dont le niveau a changé depuis l'image précédente */
      pinsDiff: Record<string, 0 | 1>
      /** Fraction du temps à 1 sur l'image, pour les LED dont la valeur a changé */
      ledDuty: Record<string, number>
      /** Anneau de 16 LED de la carte Rotary : fraction du temps allumée (LED 1 à 16), si elle a changé */
      ringDuty?: number[]
      /** Matrice 8x8 R click : lueur moyenne de chaque LED (ligne 0 en haut, 64 valeurs), si elle a changé */
      matrixGlow?: number[]
    }
  | { type: 'output'; level: OutputLevel; text: string; file?: string; line?: number; col?: number }
  | { type: 'halted'; reason: string }
  | { type: 'built'; ok: boolean; ms: number; loaded: boolean }
  /** Position courante après un arrêt (pas à pas, point d'arrêt, pause) */
  | { type: 'stopped'; file?: string; line?: number }
  | { type: 'snapshot'; func: string | null; locals: WatchRow[]; globals: WatchRow[]; sfrs: WatchRow[] }
  | { type: 'graded'; question: string; ok: boolean; messages: string[] }
  /** Inspecteur d'interruptions : GIE, PEIE, puis IE, IF et nombre d'appels par source */
  | { type: 'irq'; gie: number; peie: number; sources: { name: string; ie: number; flag: number; calls: number }[] }
  /** Analyseur logique : changements des voies observées depuis l'image précédente ; `reset` = nouvelle origine des temps */
  | { type: 'trace'; changes: TraceChange[]; reset: boolean }
  /** Diagnostic (mode libre) : lu dans les registres et pendant l'exécution */
  | { type: 'diag'; analogReads: string[]; inputWrites: string[]; fosc: number }
  /** Terminal : octets reçus depuis l'image précédente (instant du start, s simulées) */
  | { type: 'serial'; bytes: number[]; t: number[] }
