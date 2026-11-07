/**
 * Codeur incrémental EC12D (ROTARY O click) : 30 crans par tour, 15 impulsions par voie.
 * Positions stables A = B (00 ou 11, en alternance d'un cran à l'autre). Sens horaire : A bascule d'abord,
 * puis B (A en avance, H9) ; sens antihoraire : B d'abord. Sorties franches, sans rebond (H35).
 */
import { INFO3 } from '../../data/reference'
import type { Level } from './gpio'

export type Channel = 'A' | 'B'

export interface EncoderEdge {
  channel: Channel
  level: Level
  /** Décalage depuis le début du pas — s */
  dt: number
}

export class Ec12d {
  /** Position en crans depuis la mise sous tension (positif = sens horaire) */
  position = 0

  /** Niveau commun de A et B au cran p */
  static levelAt(p: number): Level {
    return (((p % 2) + 2) % 2) as Level
  }

  get a(): Level {
    return Ec12d.levelAt(this.position)
  }
  get b(): Level {
    return Ec12d.levelAt(this.position)
  }

  /** Un cran dans le sens `dir` (+1 horaire, −1 antihoraire) : fronts de A et B dans l'ordre */
  step(dir: 1 | -1): EncoderEdge[] {
    this.position += dir
    const level = Ec12d.levelAt(this.position)
    const first: Channel = dir > 0 ? 'A' : 'B'
    const second: Channel = dir > 0 ? 'B' : 'A'
    return [
      { channel: first, level, dt: 0 },
      { channel: second, level, dt: INFO3.rotary.phaseDelayS },
    ]
  }

  reset() {
    this.position = 0
  }
}
