import type { Signal } from '../lib/scope'

/** Signaux test de la page /demo (pas des constantes physiques de TP). */
export const DEMO_F = 1000
export const DEMO_DUTY = 0.3

/** Sinus 1 kHz, 2 V crête. */
export const demoSine: Signal = (t) => 2 * Math.sin(2 * Math.PI * DEMO_F * t)

/** Carré 0/5 V, 1 kHz, rapport cyclique 30 %. */
export const demoSquare: Signal = (t) => {
  const x = t * DEMO_F
  return x - Math.floor(x) < DEMO_DUTY ? 5 : 0
}
