import { INFO3 } from '../../data/reference'
import TpPage from '../../info3/tp/TpPage'

const RGB = INFO3.pins.rgb
const tp = (signal: string) => INFO3.scope.testPoints.find((p) => p.signal === signal)!.pin

/** TP5 — PWM, UART et LED RGB : analyseur sur R, G, B et TX ; oscilloscope sur TP10 (R) et TP11 (G) */
export default function Tp5Page() {
  return <TpPage tp={5} title="PWM, UART et LED RGB" first="tp5-1" analyzerChannels={[RGB.r, RGB.g, RGB.b, INFO3.pins.uart.tx]} scopeProbes={[tp(INFO3.rgb.signals.r), tp(INFO3.rgb.signals.g)]} />
}
