import { au3 } from '../../data/reference'
import { facteurDecibel } from '../unites'

/** GBF TTi TG315 : forme, fréquence, amplitude crête à crête, offset, atténuation 20 dB, sortie MAIN OUT */
export type FormeGbf = 'continu' | 'carre' | 'triangle'

export interface ReglagesGbf {
  forme: FormeGbf
  frequence: number
  /** Amplitude crête à crête (V), avant atténuation */
  vpp: number
  offset: number
  attenuation: boolean
  /** Sortie MAIN OUT active */
  sortie: boolean
}

export const GBF_DEFAUT: ReglagesGbf = { forme: 'carre', frequence: au3('TP1_GBF_FREQ'), vpp: au3('TP1_GBF_VPP'), offset: 0, attenuation: false, sortie: true }

/** Facteur de tension de l'atténuateur (20 dB → 0.1) */
export const facteurAttenuation = (g: ReglagesGbf) => (g.attenuation ? facteurDecibel(au3('GBF_ATTENUATION_DB')) : 1)

/**
 * Générateur de la tension à vide de MAIN OUT, constantes précalculées (appelé à chaque pas d'Euler).
 * Le carré démarre au niveau haut à t = 0 (front montant à chaque période).
 */
export function generateurGbf(g: ReglagesGbf): (t: number) => number {
  if (!g.sortie) return () => 0
  const k = facteurAttenuation(g)
  const max = au3('GBF_VPP_MAX') / 2
  const borne = (v: number) => (v > max ? max : v < -max ? -max : v)
  if (g.forme === 'continu') {
    const v = borne(k * g.offset)
    return () => v
  }
  const f = g.frequence
  const off = k * g.offset
  const a = (k * g.vpp) / 2
  if (g.forme === 'carre') {
    const haut = borne(off + a)
    const bas = borne(off - a)
    return (t) => (t * f - Math.floor(t * f) < 1 / 2 ? haut : bas)
  }
  return (t) => borne(off + a * (1 - 2 * Math.abs(2 * (t * f - Math.floor(t * f)) - 1)))
}

/** Tension à vide de la sortie MAIN OUT à l'instant t */
export const tensionGbf = (g: ReglagesGbf, t: number): number => generateurGbf(g)(t)

/** Période du signal, ou null pour une tension continue */
export const periodeGbf = (g: ReglagesGbf): number | null => (g.forme === 'continu' || g.frequence <= 0 ? null : 1 / g.frequence)
