/** Outils communs aux scripts de démonstration */
import { SDIV_STEPS } from '../../scope/engine'
import type { CaptureInfo } from '../lab'

/** Nombre à la française, 3 chiffres significatifs par défaut */
export const fr = (v: number, d = 3) => String(Number(v.toPrecision(d))).replace('.', ',')
/** Durée lisible : « 412 ns », « 1,22 µs » */
export function frTime(t: number): string {
  const a = Math.abs(t)
  if (a < 1e-6) return `${fr(t * 1e9)} ns`
  if (a < 1e-3) return `${fr(t * 1e6)} µs`
  if (a < 1) return `${fr(t * 1e3)} ms`
  return `${fr(t)} s`
}
/** Plus petit cran 1-2-5 de base de temps ≥ x */
export const sdivAtLeast = (x: number) => SDIV_STEPS.find((s) => s >= x * 0.999) ?? SDIV_STEPS[SDIV_STEPS.length - 1]!
/** Instants relatifs au déclenchement (curseurs X) */
export const rel = (c: CaptureInfo | null, t: number) => t - (c?.tTrig ?? 0)
/** Demande l'acquisition courante (erreur explicite si rien n'a déclenché) */
export function need(c: CaptureInfo | null): CaptureInfo {
  if (!c) throw new Error('aucune acquisition : rien n’a déclenché')
  return c
}
