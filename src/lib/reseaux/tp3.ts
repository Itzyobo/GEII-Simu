/**
 * TP3 Ethernet 10Base2 : réponses attendues (calculées par ethernet.ts / traffic.ts), vérification des réglages
 * de l'oscilloscope (3.1), chronogrammes Manchester à compléter (2.2 b) et exercice bonus de décodage.
 */
import { ETH10B2 } from '../../data/reference'
import { mulberry32 } from '../../au3/sim/prng'
import type { ScopeSettings } from '../scope/types'
import { BIT, BYTE_US, durationUs, ETHERTYPE_ARP, ethFrame, LEVELS, manchester, serialize } from './ethernet'
import { pingFrames, salle } from './traffic'

/** Réglages demandés en 3.1 */
export const CONSIGNE_31 = { coupling: 'DC', vdiv: 0.5, offset: 0, sdiv: 2e-6, source: 0, slope: 'descendant', mode: 'normal', delay: 0, ref: 'centre', level: -0.1 } as const
/** Tolérance sur le seuil de déclenchement — V */
const TOL_NIVEAU = 0.02
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol

/** Ce qui ne va pas dans les réglages de l'étudiant (vide = conforme) */
export function checkScope31(s: ScopeSettings): string[] {
  const c = CONSIGNE_31
  const ch = s.ch[0]
  const ko: string[] = []
  if (!ch.on) ko.push('CH1 éteinte')
  if (ch.coupling !== c.coupling) ko.push(`couplage CH1 en ${ch.coupling}, attendu DC`)
  if (ch.probe !== 1) ko.push('sonde réglée sur 10:1 alors que la liaison BNC est 1:1')
  if (!near(ch.vdiv, c.vdiv, c.vdiv * 1e-6)) ko.push('calibre CH1 : 0,5 V/div attendu')
  if (!near(ch.offset, c.offset, ch.vdiv / 25)) ko.push('position verticale : 0 V au centre de l’écran attendu')
  if (!near(s.sdiv, c.sdiv, c.sdiv * 1e-6)) ko.push('base de temps : 2 µs/div attendu')
  if (s.trig.source !== c.source) ko.push('source de déclenchement : CH1 attendue')
  if (s.trig.slope !== c.slope) ko.push('front de déclenchement : descendant attendu')
  if (s.trig.mode !== c.mode) ko.push('mode de déclenchement : Normal attendu (en Auto l’écran défile entre deux trames)')
  if (s.ref !== c.ref || !near(s.delay, c.delay, s.sdiv / 10)) ko.push('déclenchement au centre de l’écran : référence centre et retard 0 attendus')
  if (!near(s.trig.level, c.level, TOL_NIVEAU)) ko.push('seuil de déclenchement : −0,1 V attendu')
  return ko
}

/** Demi-bits Manchester (1 = haut) d'une suite d'octets émise poids faible en premier */
export const halvesOf = (bytes: readonly number[]) => manchester(serialize(bytes))

/** Chronogrammes de 2.2 b */
export const CHRONOS = [
  { id: 'res3-tp3-22b-pre', titre: 'Un octet de préambule (55h)', bytes: [0x55] },
  { id: 'res3-tp3-22b-ff', titre: 'Un octet FFh', bytes: [0xff] },
  { id: 'res3-tp3-22b-sfd', titre: 'SFD (D5h) puis 1er octet d’une MAC de broadcast (FFh)', bytes: [0xd5, 0xff] },
] as const

export interface Tp3Attendus {
  /** Impédance vue par la carte — Ω */
  z: number
  /** Tensions extrêmes (valeurs absolues) — V */
  vMin: number
  vMax: number
  /** Fréquence du préambule et d'une suite de 1 — Hz */
  fPre: number
  fFF: number
  /** Préambule + SFD, puis MAC destination — µs */
  preSfdUs: number
  macUs: number
  ping50: { octets: number; us: number }
  ping5: { bourrage: number; octets: number; us: number; trameMin: number }
  ping5000: { n: number; dernier: number; ifgUs: number; totalUs: number }
}

export function tp3Attendus(): Tp3Attendus {
  const { pcs, tsx } = salle(1)
  const req = (L: number) => pingFrames(0, L, pcs[0], tsx, 8, 1)
  const [p50] = req(50)
  const [p5] = req(5)
  const p5000 = req(5000)
  const last = p5000[p5000.length - 1]
  const end = (i: number) => p5000[i].t0 + durationUs(p5000[i].frame) * 1e-6
  const pre = ETH10B2.preambule + 1
  return {
    z: ETH10B2.zCharge,
    vMin: -LEVELS.haut,
    vMax: -LEVELS.bas,
    // 55h : 1,0,1,0… ⇒ une période de 2 bits ; FFh : un front par bit
    fPre: 1 / (2 * BIT),
    fFF: 1 / BIT,
    preSfdUs: pre * BYTE_US,
    macUs: 6 * BYTE_US,
    ping50: { octets: p50.frame.wire.length, us: durationUs(p50.frame) },
    ping5: { bourrage: p5.frame.padLen, octets: p5.frame.wire.length, us: durationUs(p5.frame), trameMin: p5.frame.wire.length - pre },
    ping5000: { n: p5000.length, dernier: last.frame.wire.length, ifgUs: (p5000[1].t0 - end(0)) * 1e6, totalUs: end(p5000.length - 1) * 1e6 },
  }
}

/** Exercice bonus : trame vue à partir du milieu du préambule ; trouver le 1er octet de la MAC destination. */
export function bonusExercise(seed: number): { halves: Uint8Array; macByte: number; skipHalves: number } {
  const rnd = mulberry32(seed ^ 0x2545f491)
  const macByte = Math.floor(rnd() * 256)
  const f = ethFrame([macByte, 0x11, 0x22, 0x33, 0x44, 0x55], salle(seed).pcs[0].mac, ETHERTYPE_ARP, new Uint8Array(28))
  // On montre les 2 derniers octets du préambule (début décalé au hasard), le SFD et la MAC destination complète
  const pre = ETH10B2.preambule
  const skipHalves = (pre - 2) * 16 + 1 + Math.floor(rnd() * 6)
  return { halves: manchester(serialize(f.wire.subarray(0, pre + 1 + 6))).subarray(skipHalves), macByte, skipHalves }
}

/** Réglages conseillés (texte) */
export const CONSEILS_TP3 = {
  broadcast: '0,5 V/div · 0 V centré · DC · 2 µs/div · réf. gauche (retard 0) · Normal, front descendant CH1 à −0,1 V · Single puis zoom (s/div) sur le préambule',
  ping50: '0,5 V/div · 0 V centré · 10 µs/div · réf. gauche · Normal, front descendant à −0,1 V · Single ; la trame occupe ≈ 8 div',
  ping5: '0,5 V/div · 10 µs/div · réf. gauche · Normal, front descendant à −0,1 V · Single ; curseurs X sur début et fin',
  ping5000: '0,5 V/div · 500 µs/div · réf. gauche · Normal, front descendant à −0,1 V, holdoff ≈ 10 ms · Single, puis zoom (s/div 2 µs, retard) sur chaque espace inter-trame',
} as const
