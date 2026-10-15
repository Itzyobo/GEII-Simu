/** Ce que voit chaque point de test du banc, selon le programme lancé sur le PC n°1. */
import { REF } from '../data/reference'
import { programmeWave, serie1, serie2, serie3, type Programme } from '../models/serie'
import { constant, type Waveform } from '../models/uart'
import type { ProbePoint, State } from './store'

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
  }
}

/** Programme qui émet réellement : lancé, et commutateur de la carte 1 sur « contrôle de flux » (H18). */
export const emitting = (s: State): Programme | null => (s.bus.active && s.wiring.flow.c1 ? programmeOf(s) : null)

/** Signal au point de test ; seule la carte 1 (PC n°1) émet. */
export function signalAt(p: ProbePoint, s: State): Waveform {
  const [card, tp] = p.split('.')
  const prog = card === 'c1' ? emitting(s) : null
  switch (tp) {
    case 'TXD_TTL':
      return prog ? programmeWave(prog, 'TTL') : constant(REF.ttlHigh.value)
    case 'TXD_RS232':
      return prog ? programmeWave(prog, 'RS232') : constant(REF.rs232Low.value)
    case 'TX+':
    case 'TX-':
      return constant(REF.rs485Idle.value)
    default:
      return constant(0)
  }
}
