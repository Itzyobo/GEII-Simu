import { INFO3 } from '../../data/reference'
import TpPage from '../../info3/tp/TpPage'

const S2 = INFO3.pins.buttons[1].pin

/** TP3 — Timer 2 */
export default function Tp3Page() {
  return <TpPage tp={3} title="Timer 2" first="tp3-1" analyzerChannels={[S2, 'TMR2IF', 'ISR', 'RA4']} />
}
