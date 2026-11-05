/**
 * Boutons S1 et S2 de la Curiosity HPC : actifs à 0 (tirage 10 kΩ, annexe 1).
 * Chaque transition peut rebondir selon H3 : probabilité INFO3.button.bounceProbability,
 * 1 à 4 rebonds répartis sur 0,3 à 3 ms, paliers d'au moins 20 µs. Le niveau final est toujours le bon.
 * Le tirage passe par un générateur à graine injecté (tests reproductibles).
 */
import { INFO3 } from '../../data/reference'
import type { Level } from './gpio'
import type { Rng } from './prng'

const H3 = INFO3.button

export interface Edge {
  /** Temps — s */
  t: number
  level: Level
}

/** Fronts produits par une transition vers `target` à l'instant t (le premier front est à t) */
export function transitionEdges(t: number, target: Level, rng: Rng, bounce: boolean): Edge[] {
  const edges: Edge[] = [{ t, level: target }]
  if (!bounce || rng() >= H3.bounceProbability) return edges
  const n = H3.bounceCount.min + Math.floor(rng() * (H3.bounceCount.max - H3.bounceCount.min + 1))
  const duration = H3.bounceDuration.min + rng() * (H3.bounceDuration.max - H3.bounceDuration.min)
  // Un rebond = retour bref au niveau précédent puis retour au niveau visé : 2 fronts
  const count = n + n
  const free = duration - count * H3.minBounceWidth
  const u = Array.from({ length: count }, () => rng()).sort((a, b) => a - b)
  const other: Level = target ? 0 : 1
  for (let j = 0; j < count; j++) edges.push({ t: t + (j + 1) * H3.minBounceWidth + u[j] * free, level: j % 2 === 0 ? other : target })
  return edges
}

export interface ButtonOptions {
  /** Niveau électrique quand le bouton est appuyé */
  activeLevel: Level
  rng: Rng
}

export class Button {
  readonly activeLevel: Level
  private readonly rng: Rng
  pressed = false

  constructor(opts: ButtonOptions) {
    this.activeLevel = opts.activeLevel
    this.rng = opts.rng
  }

  get idleLevel(): Level {
    return this.activeLevel ? 0 : 1
  }

  /** Appui à l'instant t (s) ; `bounce` = false pour un appui « propre » */
  press(t: number, bounce: boolean): Edge[] {
    this.pressed = true
    return transitionEdges(t, this.activeLevel, this.rng, bounce)
  }

  release(t: number, bounce: boolean): Edge[] {
    this.pressed = false
    return transitionEdges(t, this.idleLevel, this.rng, bounce)
  }
}
