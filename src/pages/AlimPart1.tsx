import { useDeferredValue, useMemo, useState, type ReactNode } from 'react'
import TpLayout from './TpLayout'
import WiringBoard, { type Terminal } from '../components/WiringBoard'
import Oscilloscope from '../components/Oscilloscope'
import Knob from '../components/Knob'
import Toggle from '../components/Toggle'
import { useLiveGuard } from '../components/LiveGuard'
import QuestionCard from '../components/QuestionCard'
import { metaOf, type AnswerSpec, type QuestionMeta } from '../lib/exam'
import { ALIM } from '../data/reference'
import { bufferSignal, type Signal } from '../lib/scope'
import type { Pair } from '../lib/wiring'
import { demagTime, peak, ripple, saturationOnset, simulatePulse } from '../models/pulseTransformer'

/** Bornes d'après l'annexe « schéma du montage » : alim 5 V, prise BNC, masses des sondes, GND1, GND2. */
const TERMINALS: Terminal[] = [
  { id: 'alimP', label: 'Alim +', color: 'red', x: 45, y: 82 },
  { id: 'alimN', label: 'Alim −', color: 'black', x: 105, y: 82 },
  { id: 'bncS', label: 'BNC', color: 'yellow', x: 45, y: 192 },
  { id: 'bncM', label: 'Masse BNC', color: 'black', x: 110, y: 192 },
  { id: 'm1', label: 'Masse CH1', color: 'black', x: 45, y: 300 },
  { id: 'm2', label: 'Masse CH2', color: 'black', x: 110, y: 300 },
  { id: 'vcc', label: 'Vcc', color: 'red', x: 245, y: 70 },
  { id: 'vimp', label: 'Vimp', color: 'yellow', x: 245, y: 185 },
  { id: 'gnd1', label: 'GND1', color: 'black', x: 245, y: 300 },
  { id: 'gnd2', label: 'GND2', color: 'black', x: 625, y: 300 },
]
const EXPECTED: Pair[] = [
  ['alimP', 'vcc'],
  ['alimN', 'gnd1'],
  ['bncS', 'vimp'],
  ['bncM', 'gnd1'],
  ['m1', 'gnd1'],
  ['m2', 'gnd2'],
]

const SOURCES = {
  i1: 'i1 (shunt 1 Ω)',
  v1: 'v1',
  v2: 'v2',
  vs: 'vs',
} as const
type Source = keyof typeof SOURCES

const fr = (x: number, digits = 3) => String(Number(x.toPrecision(digits))).replace('.', ',')

/** Maquette : générateur, transistor, D1 + Dz, transfo IT237, shunt, et D2 / C / Rs selon les interrupteurs. */
function Schematic({ d2, c }: { d2: boolean; c: boolean }) {
  const txt = { fill: 'var(--color-muted)', stroke: 'none', fontSize: 11, textAnchor: 'middle' as const }
  const on = (x: boolean) => (x ? undefined : '4 4')
  return (
    <>
      <rect x="15" y="20" width="125" height="82" rx="6" />
      <text x="77" y="40" {...txt}>Alim E = 5 V</text>
      <rect x="15" y="130" width="125" height="82" rx="6" />
      <text x="77" y="150" {...txt}>Géné d’impulsions</text>
      <rect x="15" y="240" width="125" height="82" rx="6" />
      <text x="77" y="260" {...txt}>Sondes oscillo</text>
      <rect x="220" y="20" width="430" height="305" rx="8" />
      <text x="435" y="40" {...txt} fontSize={13}>Maquette — transfo IT237, m = 1</text>
      {/* primaire : transistor + D1/Dz, enroulement, shunt */}
      <rect x="300" y="160" width="50" height="40" rx="4" />
      <text x="325" y="184" {...txt}>T</text>
      <text x="325" y="125" {...txt}>D1 + Dz</text>
      <path d="M380 110 q12 10 0 20 q12 10 0 20 q12 10 0 20 q12 10 0 20" />
      <path d="M420 110 q-12 10 0 20 q-12 10 0 20 q-12 10 0 20 q-12 10 0 20" />
      <line x1="398" y1="105" x2="398" y2="195" />
      <line x1="402" y1="105" x2="402" y2="195" />
      <text x="360" y="215" {...txt}>V1</text>
      <text x="440" y="215" {...txt}>V2</text>
      <rect x="340" y="250" width="40" height="14" rx="2" />
      <text x="360" y="285" {...txt}>shunt 1 Ω (i1)</text>
      {/* secondaire : D2, C, Rs */}
      <g strokeDasharray={on(d2)}>
        <line x1="420" y1="110" x2="480" y2="110" />
        <path d="M480 100 l0 20 l18 -10 z" />
        <line x1="498" y1="100" x2="498" y2="120" />
        <line x1="498" y1="110" x2="600" y2="110" />
        <rect x="592" y="150" width="16" height="60" rx="2" />
        <line x1="600" y1="110" x2="600" y2="150" />
        <line x1="600" y1="210" x2="600" y2="300" />
      </g>
      <text x="490" y="92" {...txt}>D2</text>
      <text x="630" y="185" {...txt}>Rs</text>
      <g strokeDasharray={on(c)}>
        <line x1="550" y1="110" x2="550" y2="170" />
        <line x1="535" y1="170" x2="565" y2="170" />
        <line x1="535" y1="178" x2="565" y2="178" />
        <line x1="550" y1="178" x2="550" y2="300" />
      </g>
      <text x="530" y="200" {...txt}>C</text>
    </>
  )
}

/** Réponses de la partie 1, calculées sur le modèle (réglages de l'énoncé). */
function computeAnswers() {
  const q1 = { f: 5000, width: 100e-6 }
  const sim = simulatePulse({ ...q1, d2: false, c: false })
  const i1max = peak(sim.i1)
  const rippleAt = (f: number, cap?: number) => ripple(simulatePulse({ f, width: 100e-6, d2: true, c: true, cap }).vs)
  return {
    period: 1e6 / q1.f,
    duty: q1.width * q1.f * 100,
    vz: -sim.v2.reduce((m, x) => Math.min(m, x), 0),
    i1max,
    demag: demagTime(sim),
    lm: (ALIM.E * q1.width) / i1max,
    aire: ALIM.E * saturationOnset(2000) * 1e6,
    // ΔV baisse si f augmente ou si C augmente
    q6: rippleAt(5000) < rippleAt(1000) && rippleAt(1000, 2 * ALIM.c) < rippleAt(1000),
  }
}

/** Réponses attendues et explications de la partie 1 : source unique des cartes et de la clé d'examen. */
function specs(): Record<string, AnswerSpec> {
  const a = computeAnswers()
  const ecart = ((a.lm - ALIM.lmConstructeur) / ALIM.lmConstructeur) * 100
  return {
    'alim1-q1-periode': { expected: a.period, unit: 'µs', explanation: `T = 1/f = 1/5 kHz = ${fr(a.period)} µs.` },
    'alim1-q1-alpha': { expected: a.duty, unit: '%', explanation: `α = t_impulsion / T = 100 µs / ${fr(a.period)} µs = ${fr(a.duty)} %.` },
    'alim1-q3': {
      expected: a.vz,
      unit: 'V',
      explanation: `Pendant la démagnétisation, D1 et Dz conduisent : v1 = v2 = −(Vd1 + Vz) ≈ −Vz, d’où Vz ≈ ${fr(a.vz)} V. Égalité des surfaces : E·t1 = Vz·(t2 − t1), soit t2 − t1 = ${fr(a.demag * 1e6)} µs.`,
    },
    'alim1-q4': {
      expected: a.lm * 1e3,
      unit: 'mH',
      tolerance: 0.1,
      explanation: `La rampe vaut i1 = E·t/Lm, donc Lm = E·t1/I1max = 5 V × 100 µs / ${fr(a.i1max * 1e3)} mA ≈ ${fr(a.lm * 1e3)} mH. Constructeur : ${fr(ALIM.lmConstructeur * 1e3)} mH, soit un écart de ${fr(ecart, 2)} %.`,
    },
    'alim1-q5': {
      expected: a.aire,
      unit: 'V·µs',
      tolerance: 0.15,
      explanation: `Le flux vaut φ = (1/n)·∫v1·dt : c’est l’aire E·t de l’impulsion qui fixe l’induction B = φ/S. Quand B atteint Bsat, Lm s’effondre et i1 s’emballe. La limite vient donc du circuit magnétique, pas du transistor. Ici aire ≈ 5 V × ${fr(a.aire / 5)} µs ≈ ${fr(a.aire)} V·µs (constructeur : ${fr(ALIM.aireSaturationConstructeur * 1e6)} V·µs).`,
    },
    'alim1-q6': {
      kind: 'choix',
      choices: ['Diminuer la fréquence des impulsions', 'Augmenter la fréquence des impulsions ou la capacité C', 'Diminuer la capacité C', 'Diminuer la tension E'],
      correct: a.q6 ? 1 : 0,
      explanation: `Entre deux impulsions, C se décharge dans Rs avec τ = Rs·C = ${fr(ALIM.rCharge * ALIM.c * 1e3)} ms : ΔV ≈ Vs·(T − t_imp)/τ. On diminue ΔV en raccourcissant T (fréquence plus élevée) ou en augmentant τ (capacité plus grande).`,
    },
  }
}

/** Clé de correction de la partie 1 (questions non affichées à la remise d'un examen). */
export function answerKey(): Record<string, QuestionMeta> {
  return Object.fromEntries(Object.entries(specs()).map(([id, sp]) => [id, metaOf(sp)]))
}

function Part1Questions() {
  const s = useMemo(specs, [])
  const q1 =
    '1 − Visualiser les impulsions du générateur d’impulsions (boitier noir) à l’oscillo, et régler la fréquence d’impulsions à 5kHz avec une largeur d’impulsions de 100μs, rapport cyclique 50%.'
  return (
    <>
      <QuestionCard id="alim1-q1-periode" label="Q1" statement={`${q1} — Ici : période des impulsions.`} {...s['alim1-q1-periode']} />
      <QuestionCard id="alim1-q1-alpha" label="Q1" statement={`${q1} — Ici : rapport cyclique.`} {...s['alim1-q1-alpha']} />
      <QuestionCard
        id="alim1-q3"
        label="Q3"
        statement="3 – Visualiser à l’oscillo la tension v2(t) et le courant i1(t) en utilisant le shunt d’1Ω. Relever v2(t) et i1(t). Retrouver la valeur de Vz."
        {...s['alim1-q3']}
      />
      <QuestionCard
        id="alim1-q4"
        label="Q4"
        statement="4 – Déterminer à partir de ces expérimentations, l’inductance magnétisante Lm du transformateur d’impulsions (également appelée inductance principale Lp), et comparer aux données constructeur en annexe."
        {...s['alim1-q4']}
      />
      <QuestionCard
        id="alim1-q5"
        label="Q5"
        statement="5 – Régler la fréquence des impulsions à 2kHz puis augmenter progressivement la durée de l’impulsion (en partant de 0). Qu’observe-t-on sur l’allure du courant lorsque la durée de l’impulsion augmente ? Observer la saturation du circuit magnétique sur l’allure du courant.Déduire approximativement l’aire maxi de l’impulsion transmissible sans saturation (Aire = tension * la durée de l’impulsion en µs)"
        {...s['alim1-q5']}
      />
      <QuestionCard
        id="alim1-q6"
        label="Q6"
        statement="6.– Relier au secondaire du transfo la partie diode D2 avec la résistance de charge Rs, visualiser la tension de sortie vs(t) pour des impulsions f=2kHz et α=30%. Commenter les résultats obtenus. Ajouter le condensateur C puis visualiser la tension de sortie. Faire varier la fréquence du GBF ainsi que le rapport cyclique (en partant de f=1kHz). Qu’on observe-t-on ? Sur quelle grandeur peut-on agir pour diminuer le ΔV ?"
        {...s['alim1-q6']}
      />
    </>
  )
}

/** Partie 1 : transformateur d'impulsions IT237. */
export default function AlimPart1({ title, tabs }: { title: string; tabs: ReactNode }) {
  const [powered, setPowered] = useState(false)
  const [f, setF] = useState(5000)
  const [width, setWidth] = useState(100e-6)
  const [d2, setD2] = useState(false)
  const [c, setC] = useState(false)
  const { guard, alert: liveAlert } = useLiveGuard(powered)
  const [src, setSrc] = useState<[Source, Source]>(['v2', 'i1'])

  const fSim = useDeferredValue(f)
  const wSim = useDeferredValue(Math.min(width, 0.95 / f))
  const sim = useMemo(() => simulatePulse({ f: fSim, width: wSim, d2, c: d2 && c }), [fSim, wSim, d2, c])
  const signals = useMemo<Record<Source, Signal>>(() => {
    const read = (arr: Float32Array, k = 1): Signal => {
      if (!powered) return () => 0
      const s = bufferSignal(arr, sim.dt)
      return (t) => k * s(t)
    }
    return { i1: read(sim.i1, ALIM.rShunt), v1: read(sim.v1), v2: read(sim.v2), vs: read(sim.vs) }
  }, [sim, powered])
  const duty = Math.min(width, 0.95 / f) * f

  return (
    <TpLayout
      title={title}
      tabs={tabs}
      schematic={
        <>
          <WiringBoard
            progressId="alim1-cablage" terminals={TERMINALS} expected={EXPECTED} width={670} height={340} onPowerChange={setPowered}>
            <Schematic d2={d2} c={d2 && c} />
          </WiringBoard>
          <div className="rounded-card bg-card p-3 ring-1 ring-line">
            <div className="mb-2 text-xs font-semibold tracking-wide text-muted">GÉNÉRATEUR D’IMPULSIONS · SECONDAIRE</div>
            <div className="flex flex-wrap items-center gap-5">
              <Knob label="Fréquence" value={f} onChange={setF} min={500} max={10000} step={10} unit="Hz" log />
              <Knob label="Largeur" value={width} onChange={setWidth} min={1e-6} max={1e-3} step={1e-6} unit="s" log />
              <div className="font-mono text-sm">
                <div className="text-muted">Rapport cyclique</div>
                <div className="text-lg text-ink">{(duty * 100).toFixed(1).replace('.', ',')} %</div>
              </div>
              <div className="flex flex-col gap-2">
                <Toggle on={d2} onChange={(v) => guard('Branchement de D2 + Rs', () => setD2(v))} label="Brancher D2 + Rs" />
                <Toggle on={c} onChange={(v) => guard('Condensateur C', () => setC(v))} label="Ajouter C" disabled={!d2} />
              </div>
            </div>
            {liveAlert && <div className="mt-3">{liveAlert}</div>}
            {powered && sim.accumulates && (
              <p className="mt-3 rounded-lg bg-err/10 px-3 py-2 text-sm text-err ring-1 ring-err/30" role="alert">
                ⚠ Démagnétisation incomplète : i1 n’a pas le temps de revenir à 0 avant l’impulsion suivante, le courant s’accumule de période en période. Réduire la largeur ou la fréquence.
              </p>
            )}
            {powered && sim.saturates && !sim.accumulates && (
              <p className="mt-3 rounded-lg bg-accent/15 px-3 py-2 text-sm text-accent ring-1 ring-accent/40">
                Saturation du circuit magnétique : l’aire E·t dépasse la valeur admissible.
              </p>
            )}
          </div>
        </>
      }
      instruments={
        <>
          <div className="flex flex-wrap gap-3 rounded-card bg-card px-3 py-2 text-xs ring-1 ring-line">
            {([0, 1] as const).map((k) => (
              <label key={k} className="flex items-center gap-2">
                <span className="font-mono font-semibold" style={{ color: `var(--color-ch${k + 1})` }}>
                  CH{k + 1}
                </span>
                <select
                  value={src[k]}
                  onChange={(e) => setSrc(k === 0 ? [e.target.value as Source, src[1]] : [src[0], e.target.value as Source])}
                  className="min-h-11 rounded-md bg-[#17191c] px-2 py-1 text-ink ring-1 ring-line"
                >
                  {Object.entries(SOURCES).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <span className="self-center text-muted">i1 lu aux bornes du shunt : 1 mV ↔ 1 mA</span>
          </div>
          <Oscilloscope ch1={signals[src[0]]} ch2={signals[src[1]]} voltsPerDiv={[5, 0.01]} secPerDiv={50e-6} triggerLevel={2.5} />
        </>
      }
      questions={<Part1Questions />}
    />
  )
}
