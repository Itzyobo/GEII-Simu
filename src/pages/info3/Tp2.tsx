import { INFO3 } from '../../data/reference'
import TpPage from '../../info3/tp/TpPage'

const R = INFO3.pins.rotary

/** TP2 — Interruptions IOC et codeur rotatif */
export default function Tp2Page() {
  return <TpPage tp={2} title="Interruptions IOC et codeur" first="tp2-1-1" analyzerChannels={[R.ENCA, R.ENCB, 'RA5', 'ISR']} />
}
