/** Ce que voit chaque point de test du banc, selon l'état du store (étape 1 : signal de démonstration seul). */
import { REF } from '../data/reference'
import { constant, uartFrame, uartWaveform, type Level, type Waveform } from '../models/uart'
import type { ProbePoint, State } from './store'

const SERIE1 = { dataBits: REF.serie1DataBits.value, parity: REF.serie1Parity.value, stopBits: REF.serie1StopBits.value }

/** Octet du signal de démonstration (SERIE_1, relevé 2.1). */
export const DEMO_BYTE = 0x55

/** 55H en 8O1 au débit de SERIE_1, suivi de repos jusqu'à sa répétition (H22). */
export function demoWave(level: Level): Waveform {
  const bits = uartFrame(DEMO_BYTE, SERIE1)
  return uartWaveform(bits, { baud: REF.serie1Baud.value, level }, 0, REF.serie1Repetition.value - bits.length / REF.serie1Baud.value)
}

/** Signal au point de test ; la carte 1 n'émet que si une émission est lancée et le commutateur sur « contrôle de flux » (H18). */
export function signalAt(p: ProbePoint, s: State): Waveform {
  const [card, tp] = p.split('.')
  const emits = s.bus.active && card === 'c1' && s.wiring.flow.c1
  switch (tp) {
    case 'TXD_TTL':
      return emits ? demoWave('TTL') : constant(REF.ttlHigh.value)
    case 'TXD_RS232':
      return emits ? demoWave('RS232') : constant(REF.rs232Low.value)
    case 'TX+':
    case 'TX-':
      return constant(REF.rs485Idle.value)
    default:
      return constant(0)
  }
}
