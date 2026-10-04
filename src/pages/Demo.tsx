import { useState } from 'react'
import TpLayout from './TpLayout'
import { demoSine, demoSquare } from './demoSignals'
import Oscilloscope from '../components/Oscilloscope'
import Knob from '../components/Knob'
import Multimeter from '../components/Multimeter'
import Wattmeter from '../components/Wattmeter'
import WiringBoard, { type Terminal } from '../components/WiringBoard'
import QuestionCard from '../components/QuestionCard'
import type { Pair } from '../lib/wiring'

const TERMINALS: Terminal[] = [
  { id: 'gbf+', label: 'GBF +', color: 'red', x: 90, y: 70 },
  { id: 'gbf-', label: 'GBF −', color: 'black', x: 90, y: 160 },
  { id: 'r+', label: 'R +', color: 'yellow', x: 330, y: 70 },
  { id: 'r-', label: 'R −', color: 'blue', x: 330, y: 160 },
]
const EXPECTED: Pair[] = [
  ['gbf+', 'r+'],
  ['gbf-', 'r-'],
]

/** Banc d'essai des composants du socle (pas un TP). */
export default function Demo() {
  const [powered, setPowered] = useState(false)
  const [volts, setVolts] = useState(5)
  const [freq, setFreq] = useState(1000)

  return (
    <TpLayout
      title="Démo des composants"
      schematic={
        <WiringBoard terminals={TERMINALS} expected={EXPECTED} width={420} height={230} onPowerChange={setPowered}>
          <rect x="30" y="40" width="40" height="150" rx="6" />
          <text x="50" y="120" textAnchor="middle" fontSize="12" fill="var(--color-muted)" stroke="none">GBF</text>
          <rect x="350" y="85" width="22" height="60" rx="3" />
          <text x="385" y="120" fontSize="12" fill="var(--color-muted)" stroke="none">R</text>
        </WiringBoard>
      }
      instruments={
        <>
          <Oscilloscope ch1={demoSine} ch2={demoSquare} voltsPerDiv={[1, 2]} secPerDiv={0.2e-3} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Multimeter label="VOLTMÈTRE" value={powered ? volts : null} unit="V" />
            <Wattmeter p={powered ? 1060 : null} q={powered ? 1373 : null} s={powered ? 1735 : null} />
          </div>
          <div className="flex justify-around rounded-card bg-card shadow-sm shadow-black/[0.03] p-3 ring-1 ring-line">
            <Knob label="Tension" value={volts} onChange={setVolts} min={0} max={20} step={0.1} unit="V" />
            <Knob label="Fréquence (log)" value={freq} onChange={setFreq} min={10} max={10000} step={1} unit="Hz" log />
          </div>
          <p className="text-xs text-muted">Les afficheurs ne s’allument qu’une fois le câblage vérifié et la platine sous tension.</p>
        </>
      }
      questions={
        <QuestionCard id="demo-q1"
          label="Q1"
          statement="Mesurer la fréquence du signal carré affiché sur CH2."
          expected={1000}
          unit="Hz"
          explanation="Une période occupe 5 divisions à 0,2 ms/div : T = 1 ms, donc f = 1/T = 1 kHz. La mesure auto de l’oscilloscope le confirme."
        />
      }
    />
  )
}
