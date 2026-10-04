import { useDeferredValue, useMemo, useState } from 'react'
import TpLayout from './TpLayout'
import StepperQuestions from './StepperQuestions'
import type { Tp } from './tps'
import WiringBoard, { type Terminal } from '../components/WiringBoard'
import Oscilloscope from '../components/Oscilloscope'
import Knob from '../components/Knob'
import Display7Seg from '../components/Display7Seg'
import DipSwitch from '../components/DipSwitch'
import StepperRotor from '../components/StepperRotor'
import { useLiveGuard } from '../components/LiveGuard'
import { useExam } from '../lib/exam'
import { PAP } from '../data/reference'
import type { Pair } from '../lib/wiring'
import type { Signal } from '../lib/scope'
import { clockAt, INVALID_SWITCHES_MSG, modeFromSwitches, sampleAt, simulate, type Dir } from '../models/stepper'

const TERMINALS: Terminal[] = [
  { id: 'a15p', label: '+', color: 'red', x: 50, y: 82 },
  { id: 'a15n', label: '−', color: 'black', x: 100, y: 82 },
  { id: 'a5p', label: '+', color: 'red', x: 50, y: 192 },
  { id: 'a5n', label: '−', color: 'black', x: 100, y: 192 },
  { id: 'gbfS', label: 'Sortie', color: 'yellow', x: 50, y: 307 },
  { id: 'gbfM', label: 'Masse', color: 'black', x: 100, y: 307 },
  { id: 'vcc', label: 'VCC', color: 'red', x: 255, y: 80 },
  { id: 'gnd', label: 'GND', color: 'black', x: 255, y: 120 },
  { id: 'pulp', label: 'PUL+', color: 'red', x: 255, y: 175 },
  { id: 'pulm', label: 'PUL−', color: 'black', x: 255, y: 215 },
  { id: 'dirp', label: 'DIR+', color: 'red', x: 255, y: 255 },
  { id: 'dirm', label: 'DIR−', color: 'black', x: 255, y: 295 },
  { id: 'ena', label: 'ENA', color: 'yellow', x: 255, y: 335 },
  { id: 'ap', label: 'A+', color: 'brown', x: 375, y: 175 },
  { id: 'am', label: 'A−', color: 'brown', x: 375, y: 215 },
  { id: 'bp', label: 'B+', color: 'brown', x: 375, y: 255 },
  { id: 'bm', label: 'B−', color: 'brown', x: 375, y: 295 },
  { id: 'noir', label: 'noir', color: 'black', x: 490, y: 160 },
  { id: 'vert', label: 'vert', color: 'green', x: 490, y: 200 },
  { id: 'rouge', label: 'rouge', color: 'red', x: 490, y: 260 },
  { id: 'bleu', label: 'bleu', color: 'blue', x: 490, y: 300 },
]

/** Alim 15 V → VCC/GND, alim 5 V → logique DIR, GBF → PUL, noir–vert = phase A, rouge–bleu = phase B (ENA libre = actif). */
const EXPECTED: Pair[] = [
  ['a15p', 'vcc'],
  ['a15n', 'gnd'],
  ['a5p', 'dirp'],
  ['a5n', 'dirm'],
  ['gbfS', 'pulp'],
  ['gbfM', 'pulm'],
  ['noir', 'ap'],
  ['vert', 'am'],
  ['rouge', 'bp'],
  ['bleu', 'bm'],
]

const SOURCES = {
  clock: { label: 'Horloge (PUL)', clamp: false },
  iA: { label: 'I_A (pince)', clamp: true },
  iB: { label: 'I_B (pince)', clamp: true },
  vA: { label: 'Tension phase A', clamp: false },
} as const
type Source = keyof typeof SOURCES

const MODE_TEXT = { entier: 'Pas entier', demi: 'Demi-pas', quart: '1/4 de pas' } as const

/** Dessin de la platine, sous les bornes. */
function Schematic() {
  const txt = { fill: 'var(--color-muted)', stroke: 'none', fontSize: 12, textAnchor: 'middle' as const }
  return (
    <>
      <rect x="20" y="20" width="110" height="82" rx="6" />
      <text x="75" y="40" {...txt}>Alim 15 V</text>
      <rect x="20" y="130" width="110" height="82" rx="6" />
      <text x="75" y="150" {...txt}>Alim 5 V</text>
      <rect x="20" y="240" width="110" height="90" rx="6" />
      <text x="75" y="260" {...txt}>GBF</text>
      <rect x="230" y="20" width="170" height="340" rx="8" />
      <text x="315" y="45" {...txt} fontSize={14}>TB6600</text>
      <circle cx="590" cy="230" r="55" />
      <circle cx="590" cy="230" r="18" />
      <text x="590" y="305" {...txt}>Moteur</text>
      {[160, 200, 260, 300].map((y) => (
        <line key={y} x1="499" y1={y} x2="545" y2={230 + (y - 230) * 0.45} />
      ))}
    </>
  )
}

/** TP moteur pas à pas : TB6600 + GBF + oscilloscope à pinces + rotor. */
export default function StepperPage({ tp }: { tp: Tp }) {
  const [powered, setPowered] = useState(false)
  const [switches, setSwitches] = useState<boolean[]>([true, true, false])
  const [dir, setDir] = useState<Dir>(1)
  const [dirAlert, setDirAlert] = useState(false)
  const exam = useExam()
  const { guard, alert: liveAlert } = useLiveGuard(powered)
  const [f, setF] = useState(200)
  const [src, setSrc] = useState<[Source, Source]>(['iA', 'iB'])

  const mode = modeFromSwitches([switches[0], switches[1], switches[2]])
  const fSim = useDeferredValue(f) // la simulation suit le bouton sans bloquer l'interface
  const sim = useMemo(() => (mode ? simulate({ f: fSim, mode, dir }) : null), [fSim, mode, dir])
  const active = powered && sim !== null

  const signals = useMemo<Record<Source, Signal>>(() => {
    const read = (key: 'iA' | 'iB' | 'vA'): Signal => (active ? (t) => sampleAt(sim, sim[key], t) : () => 0)
    return { clock: (t) => clockAt(fSim, t), iA: read('iA'), iB: read('iB'), vA: read('vA') }
  }, [active, sim, fSim])

  const toggleDir = () => {
    if (powered) {
      exam.penalize('live', 'Interrupteur DIR basculé sous tension')
      setDirAlert(true)
    }
    else setDir(dir === 1 ? -1 : 1)
  }

  return (
    <TpLayout
      title={tp.title}
      schematic={
        <>
          <WiringBoard
            progressId="pap-cablage" terminals={TERMINALS} expected={EXPECTED} width={660} height={370} onPowerChange={setPowered}>
            <Schematic />
          </WiringBoard>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-card bg-card shadow-sm shadow-black/[0.03] p-3 ring-1 ring-line">
              <div className="mb-2 text-xs font-semibold tracking-wide text-muted">GBF · HORLOGE PUL</div>
              <div className="flex items-center gap-3">
                <Knob label="Fréquence" value={f} onChange={setF} min={10} max={10000} step={1} unit="Hz" log />
                <div className="space-y-2">
                  <div className="flex items-end gap-2 rounded-lg bg-[#0b120d] px-3 py-2 ring-1 ring-black">
                    <Display7Seg value={String(f)} digits={5} height={30} />
                    <span className="pb-0.5 font-mono text-sm text-seg">Hz</span>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-muted">
                    Saisie
                    <input
                      type="number"
                      min={10}
                      max={10000}
                      value={f}
                      onChange={(e) => {
                        const v = Math.round(Number(e.target.value))
                        if (v >= 10 && v <= 10000) setF(v)
                      }}
                      className="min-h-11 w-24 rounded-md bg-field px-2 py-1 font-mono text-ink ring-1 ring-line outline-none focus:ring-accent"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="rounded-card bg-card shadow-sm shadow-black/[0.03] p-3 ring-1 ring-line">
              <div className="mb-2 text-xs font-semibold tracking-wide text-muted">DRIVER TB6600</div>
              <div className="flex items-start gap-4">
                <DipSwitch values={switches} onChange={(v) => guard('Micro-switches S1–S3', () => setSwitches(v))} />
                <div className="space-y-2 text-sm">
                  {mode ? (
                    <p>
                      <span className="font-semibold">{MODE_TEXT[mode]}</span>
                      <span className="text-muted"> · {PAP.pasParTour[mode]} pas/tour</span>
                    </p>
                  ) : (
                    <p className="text-err">{INVALID_SWITCHES_MSG}</p>
                  )}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={dir === -1}
                    onClick={toggleDir}
                    className="flex min-h-11 items-center gap-2 rounded-lg bg-card-2 px-2 py-1.5 ring-1 ring-line"
                  >
                    <span className={`relative h-5 w-9 rounded-full ring-1 ring-line ${dir === -1 ? 'bg-accent' : 'bg-line'}`}>
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-ink transition-all ${dir === -1 ? 'left-[18px]' : 'left-0.5'}`} />
                    </span>
                    <span className="font-mono text-xs">DIR {dir === 1 ? '0 (horaire)' : '1 (anti-horaire)'}</span>
                  </button>
                  {mode && powered && sim && sim.rpm === 0 && (
                    <p className="text-warn">Décrochage : le rotor ne suit plus au-delà de {PAP.fDecrochage} Hz.</p>
                  )}
                </div>
              </div>
              {liveAlert && <div className="mt-3">{liveAlert}</div>}
              {dirAlert && (
                <div className="mt-3 flex items-start gap-3 rounded-lg bg-warn/10 px-3 py-2 text-sm text-warn ring-1 ring-warn/30" role="alert">
                  <span className="flex-1">⚠ Énoncé : on ne change le sens (DIR) que moteur arrêté. Coupez l’alimentation avant de basculer DIR.</span>
                  <button type="button" onClick={() => setDirAlert(false)} className="text-xs underline">
                    OK
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      }
      instruments={
        <>
          <div className="flex flex-wrap gap-3 rounded-card bg-card shadow-sm shadow-black/[0.03] px-3 py-2 text-xs ring-1 ring-line">
            {([0, 1] as const).map((c) => (
              <label key={c} className="flex items-center gap-2">
                <span className="font-mono font-semibold" style={{ color: `var(--color-ch${c + 1})` }}>
                  CH{c + 1}
                </span>
                <select
                  value={src[c]}
                  onChange={(e) => setSrc(c === 0 ? [e.target.value as Source, src[1]] : [src[0], e.target.value as Source])}
                  className="min-h-11 rounded-md bg-field px-2 py-1 text-ink ring-1 ring-line"
                >
                  {Object.entries(SOURCES).map(([k, s]) => (
                    <option key={k} value={k}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <span className="self-center text-muted">Trigger : front montant de CH1</span>
          </div>
          <Oscilloscope
            ch1={signals[src[0]]}
            ch2={signals[src[1]]}
            clamp={[SOURCES[src[0]].clamp, SOURCES[src[1]].clamp]}
            voltsPerDiv={[0.5, 0.5]}
            secPerDiv={5e-3}
            triggerLevel={0.5}
          />
          <StepperRotor stepRate={active && sim.rpm > 0 ? fSim : 0} stepsPerTurn={PAP.pasParTour[mode ?? 'entier']} dir={dir} />
        </>
      }
      questions={<StepperQuestions mode={mode ?? 'entier'} />}
    />
  )
}
