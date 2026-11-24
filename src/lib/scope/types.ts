/**
 * Contrat entre un banc et l'oscilloscope réaliste (src/lib/scope/engine.ts).
 * Le banc ne fournit que des SignalSource ; l'oscillo se charge du déclenchement, de l'échantillonnage,
 * de la bande passante, du CAN et des mesures.
 */

/** Tension présente sur la BNC d'une voie, en fonction du temps (s, horloge du banc). */
export interface SignalSource {
  /** Tension à l'instant t — V */
  value(t: number): number
  /**
   * Instants des coins du signal dans [t0, t1], triés : début et fin de chaque transition.
   * Entre deux coins consécutifs, le signal est linéaire ou lent devant la largeur d'une colonne.
   * Vide pour un signal lisse (sinus), qui doit alors donner sa période.
   */
  edges(t0: number, t1: number): number[]
  /** Période — s ; absente pour un signal non périodique (trame à instant aléatoire) */
  period?: number
}

export type Coupling = 'DC' | 'AC' | 'GND'
export type Probe = 1 | 10
export type Slope = 'montant' | 'descendant'
export type TrigMode = 'auto' | 'normal'
export type TimeRef = 'centre' | 'gauche'
export type Ch = 0 | 1

export interface ChannelSettings {
  on: boolean
  /** Calibre affiché (sonde réglée comprise) — V/div */
  vdiv: number
  /** Réglage fin du calibre (sinon suite 1-2-5) */
  fine: boolean
  /** Position verticale : tension au centre de l'écran — V affichés (readout « 0 V centré ») */
  offset: number
  coupling: Coupling
  /** Atténuation réglée dans le menu de la voie (la liaison BNC est 1:1) */
  probe: Probe
}

/** Acquisition : Normal (1 échantillon par intervalle), Peak Detect (min/max à 2 GSa/s), Moyenne sur N acquisitions */
export type AcqMode = 'normal' | 'peak' | 'moyenne'

export type MeasureKind = 'vpp' | 'max' | 'min' | 'ampl' | 'largeurP' | 'largeurN' | 'periode' | 'freq' | 'montee' | 'retard'

export interface Horizontal {
  /** s/div */
  sdiv: number
  /** Retard : temps au point de référence, mesuré depuis le déclenchement — s */
  delay: number
  ref: TimeRef
}

export interface ScopeSettings extends Horizontal {
  ch: [ChannelSettings, ChannelSettings]
  trig: { source: Ch; slope: Slope; /** V affichés */ level: number; holdoff: number; mode: TrigMode }
  /** x : s depuis le déclenchement ; y : V affichés sur la voie ych */
  cursors: { on: boolean; x1: number; x2: number; y1: number; y2: number; ych: Ch }
  measures: { source: Ch; kinds: MeasureKind[] }
  acq: { mode: AcqMode; /** 2 à 256 */ n: number }
}
