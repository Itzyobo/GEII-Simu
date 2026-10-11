import { useDeferredValue, useMemo, useState } from 'react'
import TpLayout from './TpLayout'
import StepperQuestions from './StepperQuestions'
import type { Tp } from './tps'
import WiringBoard, { Device, type Terminal } from '../components/WiringBoard'
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
import { useSpin } from '../lib/useSpin'
import { clockAt, INVALID_SWITCHES_MSG, modeFromSwitches, phaseShiftDeg, sampleAt, simulate, type Dir } from '../models/stepper'

type Phase = 'A' | 'B'

const TERMINALS: Terminal[] = [
  { id: 'a15p', label: '+', color: 'red', x: 50, y: 82 },
  { id: 'a15n', label: '−', color: 'black', x: 100, y: 82 },
  { id: 'a5p', label: '+', color: 'red', x: 50, y: 192 },
  { id: 'a5n', label: '−', color: 'black', x: 100, y: 192 },
  { id: 'gbfS', label: 'Sortie', color: 'yellow', x: 50, y: 307 },
  { id: 'gbfM', label: 'Masse', color: 'black', x: 100, y: 307 },
  // Platine : bornes « 30 » (puissance), bornes 5 V (logique), entrée horloge (emplacement supposé)
  { id: 'p30', label: '30 +', color: 'red', x: 200, y: 82 },
  { id: 'n30', label: '30 −', color: 'black', x: 250, y: 82 },
  { id: 'p5', label: '5 V +', color: 'red', x: 655, y: 82 },
  { id: 'n5', label: '5 V −', color: 'black', x: 710, y: 82 },
  { id: 'clkS', label: 'Horloge', color: 'yellow', x: 200, y: 392 },
  { id: 'clkM', label: 'Masse', color: 'black', x: 255, y: 392 },
]

/** Alim 15 V → bornes « 30 », alim 5 V → bornes 5 V, GBF → entrée horloge. Le bornier du driver est déjà câblé. */
const EXPECTED: Pair[] = [
  ['a15p', 'p30'],
  ['a15n', 'n30'],
  ['a5p', 'p5'],
  ['a5n', 'n5'],
  ['gbfS', 'clkS'],
  ['gbfM', 'clkM'],
]

/** Ce que chaque voie de l'oscilloscope reçoit : le GBF, une des deux pinces ou la sonde différentielle. */
const SOURCES = {
  gbf: { label: 'GBF (horloge PUL)', clamp: false },
  p1: { label: 'Pince 1', clamp: true },
  p2: { label: 'Pince 2', clamp: true },
  sonde: { label: 'Sonde différentielle', clamp: false },
} as const
type Source = keyof typeof SOURCES

const MODE_TEXT = { entier: 'Pas entier', demi: 'Demi-pas', quart: '1/4 de pas' } as const

const WOOD = '#6f4e2c'
const PHASE_COLOR: Record<Phase, string> = { A: '#22a05a', B: '#e5484d' }
type Pt = { x: number; y: number }
/** Repères de chaque bloc hacheur : haut du bloc, sommet de la boucle, bornes bleues de part et d'autre de la bobine. */
const BLOCK: Record<Phase, { y: number; loop: Pt; blue: [Pt, Pt]; motor: [Pt, Pt] }> = {
  A: { y: 70, loop: { x: 495, y: 108 }, blue: [{ x: 548, y: 180 }, { x: 604, y: 180 }], motor: [{ x: 657, y: 262 }, { x: 657, y: 278 }] },
  B: { y: 225, loop: { x: 495, y: 263 }, blue: [{ x: 548, y: 335 }, { x: 604, y: 335 }], motor: [{ x: 657, y: 312 }, { x: 657, y: 328 }] },
}
const PINS = ['VCC', 'GND', 'PUL+', 'PUL−', 'DIR+', 'DIR−', 'ENA', 'A+', 'A−', 'B+', 'B−']
const pinY = (name: string) => 145 + PINS.indexOf(name) * 18

interface PlatineProps {
  clamps: [Phase | null, Phase | null]
  probe: Phase | null
  pending: { phase: Phase; pin: 0 | 1 } | null
  onLoop: (p: Phase) => void
  onBlue: (p: Phase, pin: 0 | 1) => void
  /** Durée d'un tour de l'axe (s), 0 = arrêté */
  turn: number
  dir: Dir
}

/** Fil fixe (bornier pré-câblé) : ombre + couleur, non cliquable. */
function FixedWire({ d, color }: { d: string; color: string }) {
  return (
    <g pointerEvents="none" fill="none" strokeLinecap="round">
      <path d={d} stroke="rgba(0,0,0,0.18)" strokeWidth="4" transform="translate(0 1.5)" />
      <path d={d} stroke={color} strokeWidth="2.5" />
    </g>
  )
}

/** Platine réelle : fond bois, driver pré-câblé, 2 hacheurs 4Q avec boucle de mesure, moteur. */
function Platine({ clamps, probe, pending, onLoop, onBlue, turn, dir }: PlatineProps) {
  const shaft = useSpin(turn, dir)
  const engraved = { fill: WOOD, stroke: 'none', textAnchor: 'middle' as const, className: 'select-none' }
  return (
    <>
      <Device x={20} y={20} w={110} h={82} title="Alim 15 V" />
      <Device x={20} y={130} w={110} h={82} title="Alim 5 V" />
      <Device x={20} y={240} w={110} h={90} title="GBF" />

      <defs>
        <linearGradient id="pap-wood" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e2c193" />
          <stop offset="1" stopColor="#c99d68" />
        </linearGradient>
      </defs>
      <rect x="150" y="8" width="620" height="424" rx="12" fill="url(#pap-wood)" stroke="#9c7546" strokeWidth="1.5" filter="url(#wb-shadow)" />
      {[[162, 20], [758, 20], [162, 420], [758, 420]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="4" fill="#b8bec4" stroke="#7d868f" />
      ))}
      <text x="455" y="34" {...engraved} fontSize="15" fontWeight="800" letterSpacing="2">MOTEUR PAS-A-PAS</text>
      <text x="172" y="87" {...engraved} fontSize="13" fontWeight="700">30</text>
      <text x="747" y="87" {...engraved} fontSize="13" fontWeight="700">5 V</text>
      <rect x="176" y="362" width="104" height="52" rx="6" fill="none" stroke={WOOD} strokeDasharray="4 3" opacity="0.7" />
      <text x="228" y="426" {...engraved} fontSize="9" fontStyle="italic">entrée horloge (hypothèse)</text>

      {/* câblage fixe bornier → bornes de la platine (passe sous le driver) */}
      <FixedWire d={`M352,${pinY('VCC')} C392,${pinY('VCC')} 200,128 200,94`} color="#e5484d" />
      <FixedWire d={`M352,${pinY('GND')} C380,${pinY('GND')} 250,140 250,94`} color="#16181b" />
      <FixedWire d={`M352,${pinY('PUL+')} C392,${pinY('PUL+')} 200,340 200,380`} color="#facc15" />
      <FixedWire d={`M352,${pinY('PUL−')} C380,${pinY('PUL−')} 255,340 255,380`} color="#16181b" />
      <FixedWire d={`M352,${pinY('DIR+')} C372,${pinY('DIR+')} 372,48 470,48 S655,48 655,70`} color="#e5484d" />
      <FixedWire d={`M352,${pinY('DIR−')} C380,${pinY('DIR−')} 380,56 480,56 S710,52 710,70`} color="#16181b" />

      {/* driver TB6600 : boîtier noir à ailettes, bornier vert */}
      <rect x="176" y="125" width="160" height="220" rx="5" fill="#1d2023" stroke="#000" filter="url(#wb-shadow)" />
      {Array.from({ length: 10 }, (_, k) => (
        <rect key={k} x="182" y={133 + k * 20.5} width="60" height="9" rx="2" fill="#2d3236" />
      ))}
      <text x="252" y="140" fill="#e8ecef" stroke="none" fontSize="10" fontWeight="700" className="select-none">TB6600</text>
      <rect x="333" y="133" width="22" height="204" rx="3" fill="#2f9e58" stroke="#1d6b3a" />
      {PINS.map((n) => (
        <g key={n}>
          <text x="328" y={pinY(n) + 3} fill="#cfd5da" stroke="none" fontSize="7.5" textAnchor="end" className="font-mono select-none">
            {n}
          </text>
          <circle cx="344" cy={pinY(n)} r="4" fill="#c9ced3" stroke="#555" />
          <line x1="341.5" y1={pinY(n)} x2="346.5" y2={pinY(n)} stroke="#555" />
        </g>
      ))}

      {(['A', 'B'] as const).map((ph) => {
        const { y, loop, blue, motor } = BLOCK[ph]
        const c = PHASE_COLOR[ph]
        const wy = y + 72 // niveau du fil de phase dans le bloc
        const plus = pinY(`${ph}+`)
        const minus = pinY(`${ph}−`)
        const mid = (blue[0].x + blue[1].x) / 2
        const loopPath = `M${loop.x - 30},${wy} C${loop.x - 30},${loop.y - 8} ${loop.x + 30},${loop.y - 8} ${loop.x + 30},${wy}`
        const clampIdx = clamps.indexOf(ph)
        return (
          <g key={ph}>
            <rect x="388" y={y} width="234" height="140" rx="8" fill="rgba(255,255,255,0.12)" stroke={WOOD} strokeWidth="1.2" />
            <text x="400" y={y + 18} {...engraved} textAnchor="start" fontSize="11" fontWeight="800">HACHEUR 4Q</text>
            <text x="610" y={y + 18} {...engraved} textAnchor="end" fontSize="11" fontWeight="700">phase {ph}</text>
            {/* pictogramme gravé du hacheur */}
            <g stroke={WOOD} fill="none" opacity="0.75">
              <rect x="400" y={y + 30} width="40" height="30" />
              <path d={`M406 ${y + 45} h28 M412 ${y + 40} l-6 5 l6 5 M428 ${y + 40} l6 5 l-6 5`} />
            </g>
            {/* fil de phase : bornier → boucle → bobine → moteur ; retour en bas du bloc */}
            <FixedWire d={`M352,${plus} C372,${plus} 372,${wy} 395,${wy} H${loop.x - 30}`} color={c} />
            <FixedWire d={`M352,${minus} C368,${minus} 372,${y + 128} 395,${y + 128} H630 C${motor[1].x - 20},${y + 128} ${motor[1].x - 20},${motor[1].y} ${motor[1].x},${motor[1].y}`} color="#16181b" />
            <FixedWire d={`${loopPath} H${blue[0].x}`} color={c} />
            <path d={`M${blue[0].x} ${wy} q7 -10 14 0 q7 -10 14 0 q7 -10 14 0 q7 -10 14 0`} stroke={WOOD} strokeWidth="1.8" fill="none" />
            <path d={`M${blue[0].x} ${wy} V${blue[0].y - 12} M${blue[1].x} ${wy} V${blue[1].y - 12}`} stroke={WOOD} />
            <FixedWire d={`M${blue[1].x},${wy} H630 C${motor[0].x - 20},${wy} ${motor[0].x - 20},${motor[0].y} ${motor[0].x},${motor[0].y}`} color={c} />
            {/* boucle cliquable : pose / retrait d'une pince */}
            <path d={loopPath} stroke="transparent" strokeWidth="22" fill="none" className="cursor-pointer" onClick={() => onLoop(ph)}>
              <title>{`Boucle phase ${ph} : clic pour poser ou retirer une pince ampèremétrique`}</title>
            </path>
            {clampIdx < 0 ? (
              <text x={loop.x} y={loop.y + 28} {...engraved} fontSize="8.5" fontStyle="italic" pointerEvents="none">
                pince ici
              </text>
            ) : (
              <g pointerEvents="none">
                <g transform={`rotate(-20 ${loop.x + 8} ${loop.y - 14})`}>
                  <rect x={loop.x + 8} y={loop.y - 34} width="44" height="20" rx="5" fill="#f2c200" stroke="#7a6200" />
                  <text x={loop.x + 30} y={loop.y - 20} fill="#1d2023" stroke="none" fontSize="10" fontWeight="800" textAnchor="middle" className="select-none">
                    P{clampIdx + 1}
                  </text>
                </g>
                <circle cx={loop.x} cy={loop.y + 4} r="13" fill="none" stroke="#1d2023" strokeWidth="6" strokeDasharray="66 16" transform={`rotate(-60 ${loop.x} ${loop.y + 4})`} />
              </g>
            )}
            {/* bornes bleues : tension de phase (sonde différentielle) */}
            {blue.map((b, k) => (
              <g key={k} className="group cursor-pointer" onClick={() => onBlue(ph, k as 0 | 1)}>
                <title>{`Borne bleue ${k + 1}, phase ${ph} : clic sur les 2 bornes pour poser la sonde différentielle`}</title>
                <circle cx={b.x} cy={b.y} r="16" fill="#3b82f6" opacity="0" className="transition-opacity group-hover:opacity-20" />
                {pending?.phase === ph && pending.pin === k && (
                  <circle cx={b.x} cy={b.y} r="15" fill="none" stroke="#f07800" strokeWidth="2.5" className="animate-pulse" />
                )}
                <circle cx={b.x} cy={b.y} r="11" fill="url(#wb-metal)" stroke="#7d887f" />
                <circle cx={b.x} cy={b.y} r="8" fill="#3b82f6" stroke="rgba(0,0,0,0.35)" />
                <circle cx={b.x} cy={b.y} r="3" fill="#0c0d0e" />
              </g>
            ))}
            {probe === ph && (
              <g pointerEvents="none" fill="none" strokeWidth="3" strokeLinecap="round">
                <path d={`M${blue[0].x},${blue[0].y} C${blue[0].x},${blue[0].y + 16} ${mid - 12},${blue[0].y + 12} ${mid - 10},${blue[0].y + 18}`} stroke="#d9480f" />
                <path d={`M${blue[1].x},${blue[1].y} C${blue[1].x},${blue[1].y + 16} ${mid + 12},${blue[1].y + 12} ${mid + 10},${blue[1].y + 18}`} stroke="#16181b" />
                <rect x={mid - 22} y={blue[0].y + 14} width="44" height="14" rx="4" fill="#f07800" stroke="#9a4a00" strokeWidth="1" />
                <text x={mid} y={blue[0].y + 24.5} fill="#fff" stroke="none" fontSize="8.5" fontWeight="800" textAnchor="middle" className="select-none">
                  SONDE
                </text>
              </g>
            )}
          </g>
        )
      })}

      {/* moteur 42BYGH40 : carcasse carrée, axe qui tourne */}
      <rect x="655" y="245" width="100" height="100" rx="10" fill="#2a2e33" stroke="#000" filter="url(#wb-shadow)" />
      <rect x="663" y="253" width="84" height="84" rx="8" fill="#c7ccd1" stroke="#7d868f" />
      {[[669, 259], [741, 259], [669, 331], [741, 331]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="3" fill="#555" stroke="none" />
      ))}
      <circle cx="705" cy="295" r="22" fill="#9aa3ab" stroke="#6b737b" />
      <g transform="translate(705 295)">
        <g ref={shaft}>
          <circle r="9" fill="#e9ecef" stroke="#555" />
          <rect x="-1.5" y="-9" width="3" height="9" fill="#d9480f" stroke="none" />
        </g>
      </g>
      <text x="705" y="362" {...engraved} fontSize="10" fontWeight="700">moteur 42BYGH40</text>
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
  const [src, setSrc] = useState<[Source, Source]>(['p1', 'p2'])
  // Mesures posées sur la platine : 2 pinces (boucle d'une phase), 1 sonde différentielle (2 bornes bleues d'une phase)
  const [clamps, setClamps] = useState<[Phase | null, Phase | null]>([null, null])
  const [probe, setProbe] = useState<Phase | null>(null)
  const [pending, setPending] = useState<{ phase: Phase; pin: 0 | 1 } | null>(null)

  const mode = modeFromSwitches([switches[0], switches[1], switches[2]])
  const fSim = useDeferredValue(f) // la simulation suit le bouton sans bloquer l'interface
  const sim = useMemo(() => (mode ? simulate({ f: fSim, mode, dir }) : null), [fSim, mode, dir])
  const active = powered && sim !== null

  const signals = useMemo<Record<Source, Signal>>(() => {
    const zero: Signal = () => 0
    if (!active) return { gbf: (t) => clockAt(fSim, t), p1: zero, p2: zero, sonde: zero }
    const current = (p: Phase | null): Signal => (p ? (t) => sampleAt(sim, p === 'A' ? sim.iA : sim.iB, t) : zero)
    // Le modèle ne calcule que vA : vB s'en déduit par le déphasage I_B / I_A (phases symétriques)
    const lead = phaseShiftDeg(sim)
    const shift = ((Number.isNaN(lead) ? 90 * dir : lead) / 360) * sim.period
    const voltage: Signal = probe === 'A' ? (t) => sampleAt(sim, sim.vA, t) : probe === 'B' ? (t) => sampleAt(sim, sim.vA, t + shift) : zero
    return { gbf: (t) => clockAt(fSim, t), p1: current(clamps[0]), p2: current(clamps[1]), sonde: voltage }
  }, [active, sim, fSim, clamps, probe, dir])

  const onLoop = (p: Phase) => {
    const k = clamps.indexOf(p)
    if (k >= 0) setClamps(k === 0 ? [null, clamps[1]] : [clamps[0], null])
    else if (clamps[0] === null) setClamps([p, clamps[1]])
    else if (clamps[1] === null) setClamps([clamps[0], p])
  }
  const onBlue = (p: Phase, pin: 0 | 1) => {
    if (probe === p) return setProbe(null)
    if (pending?.phase === p && pending.pin !== pin) {
      setProbe(p)
      return setPending(null)
    }
    setPending(pending?.phase === p ? null : { phase: p, pin })
  }
  const where = (p: Phase | null) => (p ? `phase ${p}` : 'non posée')

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
            progressId="pap-cablage" terminals={TERMINALS} expected={EXPECTED} width={780} height={440} onPowerChange={setPowered}>
            <Platine
              clamps={clamps}
              probe={probe}
              pending={pending}
              onLoop={onLoop}
              onBlue={onBlue}
              turn={active && sim.rpm > 0 ? 60 / sim.rpm : 0}
              dir={dir}
            />
          </WiringBoard>

          <div className="rounded-card bg-card shadow-sm shadow-black/[0.03] p-3 text-sm ring-1 ring-line">
            <div className="mb-1 text-xs font-semibold tracking-wide text-muted">MESURES SUR LA PLATINE</div>
            <p className="text-xs text-muted">
              Pince ampèremétrique : cliquez la boucle d’une phase (re-clic pour retirer). Sonde différentielle : cliquez les 2 bornes bleues d’une même phase.
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {[`Pince 1 : ${where(clamps[0])}`, `Pince 2 : ${where(clamps[1])}`, `Sonde : ${pending ? `1re pointe sur phase ${pending.phase}…` : where(probe)}`].map((t) => (
                <span key={t} className="rounded-md bg-card-2 px-2 py-1 font-mono ring-1 ring-line">
                  {t}
                </span>
              ))}
            </div>
          </div>

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
            <span className="self-center text-muted">Trigger : front montant, voie au choix sur l’oscillo</span>
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
