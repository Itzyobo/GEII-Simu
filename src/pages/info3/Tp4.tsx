import { INFO3 } from '../../data/reference'
import TpPage from '../../info3/tp/TpPage'

const B = INFO3.pins.mikrobus2
const R = INFO3.pins.rotary
const [TP17, TP16] = INFO3.scope.testPoints

/** TP4 — SPI et anneau de 16 LED */
export default function Tp4Page() {
  return <TpPage tp={4} title="SPI et anneau de 16 LED" first="tp4-1" analyzerChannels={[B.SCK, B.MOSI, R.LATCH, R.RST]} scopeProbes={[TP17.pin, TP16.pin]} />
}
