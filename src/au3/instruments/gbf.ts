import { au3, AU3_INSTRUMENTS } from '../../data/reference'

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

const { base, parDecade } = AU3_INSTRUMENTS.decibel
/** Facteur de tension de l'atténuateur (20 dB → 0.1) */
export const facteurAttenuation = (g: ReglagesGbf) => (g.attenuation ? base ** (-au3('GBF_ATTENUATION_DB') / parDecade) : 1)

/** Tension à vide de la sortie MAIN OUT à l'instant t. Le carré démarre au niveau haut à t = 0 (front montant à chaque période). */
export function tensionGbf(g: ReglagesGbf, t: number): number {
  if (!g.sortie) return 0
  const k = facteurAttenuation(g)
  if (g.forme === 'continu') return clampGbf(k * g.offset)
  const phase = t * g.frequence - Math.floor(t * g.frequence)
  const forme = g.forme === 'carre' ? (phase < 1 / 2 ? 1 : -1) : 1 - 2 * Math.abs(2 * phase - 1)
  return clampGbf(k * (g.offset + (g.vpp / 2) * forme))
}

const clampGbf = (v: number) => Math.max(-au3('GBF_VPP_MAX') / 2, Math.min(au3('GBF_VPP_MAX') / 2, v))

/** Période du signal, ou null pour une tension continue */
export const periodeGbf = (g: ReglagesGbf): number | null => (g.forme === 'continu' || g.frequence <= 0 ? null : 1 / g.frequence)
