/** Ce que voit chaque point de test du banc : programme SERIE du PC n°1 (partie A), bus Modbus (partie B). */
import { REF } from '../data/reference'
import { busRun, busZones, rs485Lines, type BusFrame, type Lines } from '../models/bus'
import { programmeWave, serie1, serie2, serie3, type Programme } from '../models/serie'
import { constant, type Waveform } from '../models/uart'
import { emetteurs, type CardId, type ProbePoint, type State } from './store'

/** Programme de l'activité (lancé ou non) ; null si SERIE_2 n'a pas encore de format de session. */
export function programmeOf(s: State): Programme | null {
  switch (s.session.activity) {
    case 'serie1':
      return serie1(s.octets.serie1)
    case 'serie2':
      return s.serie2.graine === null ? null : serie2(s.serie2.graine, s.octets.serie2, s.serie2.reel)
    case 'serie3':
    case 'realterm':
      return serie3()
    case 'reseau':
      return null
  }
}

/* ───────────── Réseau Modbus (partie B) ───────────── */

const I = REF.parcoursIntervalle.value

/** Créneau de 201,4 ms en cours, calé sur le premier maître : c'est ce que l'oscilloscope affiche en boucle. */
export function fenetre(s: State): [number, number] {
  const e = emetteurs(s)[0]
  const phase = e ? (e.parcours?.debut ?? e.memStart) : 0
  const w0 = phase + Math.floor((s.sim.t - phase) / I) * I
  return [w0, w0 + I]
}

export interface Reseau {
  frames: BusFrame[]
  window: [number, number]
  lines: Record<CardId, Lines>
  zones: Record<CardId, ReturnType<typeof busZones>>
}

/** Signaux RS485 de chaque carte pendant le créneau en cours ; `parasite` : mode commun de démonstration (H35). */
export function reseau(s: State, parasite = false): Reseau {
  const [w0, w1] = fenetre(s)
  // Ce que donnerait ce créneau avec l'état actuel du pupitre (l'écran est rafraîchi en boucle)
  const frames = busRun(emetteurs(s), w0, w1, s.pupitre).frames
  const per = <T,>(f: (c: CardId) => T) => ({ c1: f('c1'), c2: f('c2') })
  return {
    frames,
    window: [w0, w1],
    lines: per((c) => rs485Lines(frames, c, w0, w1, { parasite, connected: s.wiring.db9[c], polarisation: s.reglages.polarisation })),
    zones: per((c) => busZones(frames, c, w0, w1, s.wiring.db9[c])),
  }
}

/** Trames vues par l'analyseur d'une carte : journal du bus, depuis `depuis`, jusqu'à l'instant courant. */
export function trafic(s: State, card: CardId, depuis = 0): BusFrame[] {
  if (!s.wiring.db9[card]) return []
  return s.journal.filter((f) => f.onBus && f.t0 >= depuis && f.t1 <= s.sim.t)
}

/** Adresses qui ont répondu à la fonction 07 du parcours de `card` */
export function detectes(s: State, card: CardId, debut: number): number[] {
  const reponses07 = trafic(s, card, debut).filter((f) => f.type === 'ESCLAVE' && f.crcOk && (f.bytes[1]! & 0x7f) === 7)
  return [...new Set(reponses07.map((f) => f.bytes[0]!))]
}

/** Programme qui émet réellement : lancé, et commutateur de la carte 1 sur « contrôle de flux » (H18). */
export const emitting = (s: State): Programme | null => (s.bus.active && s.wiring.flow.c1 ? programmeOf(s) : null)

/** Signal au point de test : TXD du programme SERIE (carte 1 seulement), TX+ / TX− / TX_EN du bus. */
export function signalAt(p: ProbePoint, s: State, r: Reseau): Waveform {
  const [card, tp] = p.split('.') as [CardId, string]
  const prog = card === 'c1' ? emitting(s) : null
  switch (tp) {
    case 'TXD_TTL':
      return prog ? programmeWave(prog, 'TTL') : constant(REF.ttlHigh.value)
    case 'TXD_RS232':
      return prog ? programmeWave(prog, 'RS232') : constant(REF.rs232Low.value)
    case 'TX+':
      return r.lines[card].txp
    case 'TX-':
      return r.lines[card].txm
    default:
      return r.lines[card].txen
  }
}
