/**
 * TP1 câble coaxial : réponses attendues du parcours, calculées depuis le modèle (coax.ts) et le câble tiré,
 * et réglages d'oscilloscope conseillés pour chaque étape.
 */
import { OSCILLO, RES3 } from '../../data/reference'
import { SDIV_STEPS, VDIV_STEPS } from '../scope/engine'
import { alphaAt, coaxTerms, gamma, lengthFromSpires, phaseLagDeg, type Cable } from './coax'

export interface Tp1Attendus {
  /** Tension lue à vide (entrée 1 MΩ) — V */
  egVide: number
  /** Amplitude incidente sur CH1 — V */
  Ei: number
  /** Temps de propagation aller — s */
  tau: number
  /** Retard de l'écho sur l'incident — s */
  dt: number
  /** Longueur estimée par les spires — m */
  lSpires: number
  /** Rapport écho/incident mesuré sur CH1, extrémité ouverte puis en court-circuit */
  ratioOpen: number
  ratioShort: number
  /** Atténuation du câble à 5 MHz — dB/100 m */
  alphaSinus: number
  /** Déphasage sortie/entrée à 5 MHz — degrés */
  phase: number
  /** Tensions finales sur CH1 en BF — V */
  bfOpen: number
  bfShort: number
  bfAdapte: number
}

export function tp1Attendus(c: Cable): Tp1Attendus {
  const cable = RES3.cables[c.type]
  const pulse = { kind: 'pulse', width: RES3.largeur, period: RES3.periode } as const
  const terms = (ZL: number) => coaxTerms({ Zc: c.Zc, l: c.l, ZL, alpha: cable.alpha10M, wave: pulse })
  const open = terms(Infinity)
  const ratio = (ZL: number) => terms(ZL).ch1[1].c / open.Ei
  const divider = (ZL: number) => (ZL === Infinity ? RES3.eg : (RES3.eg * ZL) / (RES3.zg + ZL))
  return {
    egVide: divider(OSCILLO.rEntree),
    Ei: open.Ei,
    tau: open.tau,
    dt: 2 * open.tau,
    lSpires: lengthFromSpires(c.N, c.D),
    ratioOpen: ratio(Infinity),
    ratioShort: ratio(0),
    alphaSinus: alphaAt(cable, RES3.fSinus),
    phase: phaseLagDeg(RES3.fSinus, c.l, RES3.v),
    bfOpen: divider(Infinity),
    bfShort: divider(0),
    bfAdapte: divider(c.Zc),
  }
}

/** Γ théoriques de l'extrémité (pour la correction) */
export const gammasTheoriques = (Zc: number) => ({ open: gamma(Infinity, Zc), short: gamma(0, Zc), adapte: gamma(Zc, Zc) })

export interface Conseil {
  vdiv: number
  sdiv: number
  mode: 'Normal' | 'Auto'
  niveau: number
  delay: number
}

const atLeast = (steps: readonly number[], x: number) => steps.find((s) => s >= x * 0.999) ?? steps[steps.length - 1]

/** Calibre pour qu'une tension crête occupe ≈ 3 div, base de temps pour qu'une durée tienne dans ≈ 8 div. */
export function conseil(crete: number, duree: number, niveau: number, mode: Conseil['mode'] = 'Normal'): Conseil {
  const sdiv = atLeast(SDIV_STEPS, duree / 8)
  // Référence au centre : on décale de 4 div pour que le déclenchement soit à gauche
  return { vdiv: atLeast(VDIV_STEPS, Math.abs(crete) / 3), sdiv, mode, niveau, delay: 4 * sdiv }
}

/** Réglages conseillés, étape par étape */
export function tp1Conseils(c: Cable) {
  const a = tp1Attendus(c)
  const echo = a.dt + 2 * RES3.largeur
  return {
    a: conseil(a.egVide, 2 * RES3.largeur, a.egVide / 2),
    b: conseil(a.Ei, echo, a.Ei / 2),
    c: conseil(a.Ei, echo, a.Ei / 2),
    d: conseil(a.Ei, echo, a.Ei / 2),
    e: { ...conseil(a.Ei, 2 / RES3.fSinus, 0, 'Auto'), delay: 0 },
    bfLent: conseil(a.bfOpen, 1.5 * RES3.largeurBF, a.Ei / 2),
    bfRapide: conseil(a.bfOpen, 4 * a.dt, a.Ei / 2),
  }
}
