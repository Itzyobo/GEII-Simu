import { INFO3 } from '../../data/reference'
import TpPage from '../../info3/tp/TpPage'

const B = INFO3.pins.mikrobus1
const [TP17, TP16] = INFO3.scope.testPoints

/** TP6 — CAN, joystick et matrice 8x8 : analyseur CLK / DIN / LOAD / TX, oscilloscope TP17 et TP16 */
export default function Tp6Page() {
  return <TpPage tp={6} title="CAN, joystick et matrice 8x8" first="tp6-1-1" analyzerChannels={[B.SCK, B.MOSI, B.CS, INFO3.pins.uart.tx]} scopeProbes={[TP17.pin, TP16.pin]} />
}
