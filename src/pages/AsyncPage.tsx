import { useMemo, useState } from 'react'
import TpLayout from './TpLayout'
import AsyncQuestions from './AsyncQuestions'
import type { Tp } from './tps'
import WiringBoard, { type Terminal } from '../components/WiringBoard'
import Knob from '../components/Knob'
import Toggle from '../components/Toggle'
import Multimeter from '../components/Multimeter'
import Wattmeter from '../components/Wattmeter'
import Tachometer from '../components/Tachometer'
import TerminalBox from '../components/TerminalBox'
import { useLiveGuard } from '../components/LiveGuard'
import { BRUIT, MAS } from '../data/reference'
import type { Pair } from '../lib/wiring'
import { inverterVoltage, motorState, ohmmeter, readings, wattmeterPhases, type Barrettes, type OhmPair, type Source } from '../models/asyncMotor'

const TERMINALS: Terminal[] = [
  { id: 'L1', label: 'L1', color: 'brown', x: 65, y: 100 },
  { id: 'L2', label: 'L2', color: 'black', x: 65, y: 155 },
  { id: 'L3', label: 'L3', color: 'red', x: 65, y: 210 },
  { id: 'N', label: 'N', color: 'blue', x: 65, y: 282 },
  { id: 'a1i', label: 'I1 entrée', color: 'red', x: 235, y: 100 },
  { id: 'a1o', label: 'I1 sortie', color: 'black', x: 375, y: 100 },
  { id: 'a2i', label: 'I2 entrée', color: 'red', x: 235, y: 155 },
  { id: 'a2o', label: 'I2 sortie', color: 'black', x: 375, y: 155 },
  { id: 'a3i', label: 'I3 entrée', color: 'red', x: 235, y: 210 },
  { id: 'a3o', label: 'I3 sortie', color: 'black', x: 375, y: 210 },
  { id: 'wn', label: 'N wattmètre', color: 'blue', x: 305, y: 282 },
  { id: 'U1', label: 'U1', color: 'yellow', x: 560, y: 100 },
  { id: 'V1', label: 'V1', color: 'yellow', x: 560, y: 155 },
  { id: 'W1', label: 'W1', color: 'yellow', x: 560, y: 210 },
]
/** Circuits courant du wattmètre triphasé en série sur chaque phase, circuits tension référencés au neutre. */
const EXPECTED: Pair[] = [
  ['L1', 'a1i'],
  ['a1o', 'U1'],
  ['L2', 'a2i'],
  ['a2o', 'V1'],
  ['L3', 'a3i'],
  ['a3o', 'W1'],
  ['N', 'wn'],
]

function Schematic({ source }: { source: Source }) {
  const txt = { fill: 'var(--color-muted)', stroke: 'none', fontSize: 11, textAnchor: 'middle' as const }
  return (
    <>
      <rect x="20" y="40" width="90" height="265" rx="6" />
      <text x="65" y="58" {...txt}>{source === 'reseau' ? 'Réseau 400 V' : 'Variateur'}</text>
      <rect x="200" y="40" width="210" height="265" rx="6" />
      <text x="305" y="58" {...txt}>Wattmètre triphasé</text>
      <rect x="510" y="40" width="150" height="200" rx="8" />
      <text x="585" y="58" {...txt}>MAS — boîte à bornes</text>
      <circle cx="620" cy="155" r="28" />
      <text x="620" y="159" {...txt}>M 3~</text>
    </>
  )
}

/** Plaque signalétique du moteur, d'après reference.ts. */
function NamePlate() {
  const p = MAS.plaque
  const row = 'flex justify-between gap-4 border-b border-black/20 py-0.5'
  return (
    <div className="rounded-lg bg-gradient-to-br from-[#b9bdc2] to-[#8d9298] p-3 font-mono text-xs text-[#1b1d20] shadow-inner ring-1 ring-black/40">
      <div className="mb-1 text-center text-[11px] font-bold tracking-widest">MOTEUR ASYNCHRONE TRIPHASÉ</div>
      <div className={row}>
        <span>Δ {p.u[0]} V / Y {p.u[1]} V</span>
        <span>{MAS.fReseau} Hz</span>
      </div>
      <div className={row}>
        <span>{String(p.i[0]).replace('.', ',')} / {String(p.i[1]).replace('.', ',')} A</span>
        <span>{p.pn / 1000} kW</span>
      </div>
      <div className="flex justify-between gap-4 py-0.5">
        <span>{p.nn} tr/min</span>
        <span>cos φ {String(p.cosPhi).replace('.', ',')}</span>
      </div>
    </div>
  )
}

/** TP machine asynchrone : réseau ou variateur, wattmètre 3 phases, charge active, boîte à bornes, ohmmètre. */
export default function AsyncPage({ tp }: { tp: Tp }) {
  const [powered, setPowered] = useState(false)
  const [barrettes, setBarrettes] = useState<Barrettes>('aucune')
  const [source, setSource] = useState<Source>('reseau')
  const { guard, alert: liveAlert } = useLiveGuard(powered)
  const [f, setF] = useState(50)
  const [pos1, setPos1] = useState(false)
  const [torque, setTorque] = useState(0)
  const [wattMode, setWattMode] = useState<'rms' | 'fondamental'>('rms')
  const [phase, setPhase] = useState<0 | 1 | 2 | 3>(3)
  const [ohmPair, setOhmPair] = useState<OhmPair>('U1-U2')
  const [tripped, setTripped] = useState<string | null>(null)

  const couple = pos1 ? torque : 0 // la charge active n'applique le couple qu'en position 1
  const couplage = barrettes === 'etoile' ? 'etoile' : 'triangle'
  const params = { couple, couplage, source, f } as const
  const st = useMemo(() => motorState({ couple, couplage, source, f }), [couple, couplage, source, f])
  const read = useMemo(() => readings(st), [st]) // bruit figé tant que le réglage ne change pas
  const running = powered && !tripped && barrettes !== 'aucune'

  // Disjoncteur : déclenche dès que la protection voit un dépassement en marche
  if (running && st.trip && tripped === null) setTripped(st.trip)

  const k = (BRUIT.min + BRUIT.max) / 2
  const uRead = useMemo(() => inverterVoltage(f, wattMode) * (1 + (Math.random() * 2 - 1) * k), [f, wattMode, k])
  const watt = wattmeterPhases(read.pa, read.qa)
  const shown = phase === 3 ? watt.total : watt.phases[phase]
  const ohm = ohmmeter(barrettes, ohmPair, powered)

  const validate = () => {
    const errors: string[] = []
    if (barrettes === 'aucune') errors.push('Boîte à bornes : barrettes absentes, le moteur n’est pas couplé.')
    if (source === 'variateur' && barrettes === 'etoile') errors.push('Variateur : le moteur doit être couplé en triangle, l’étoile est refusée.')
    return errors
  }

  return (
    <TpLayout
      title={tp.title}
      schematic={
        <>
          <WiringBoard
            progressId="mas-cablage"
            terminals={TERMINALS}
            expected={EXPECTED}
            width={680}
            height={320}
            onPowerChange={setPowered}
            validate={validate}
            revision={`${barrettes}|${source}`}
          >
            <Schematic source={source} />
          </WiringBoard>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3 rounded-card bg-card shadow-sm shadow-black/[0.03] p-3 ring-1 ring-line">
              <div className="text-xs font-semibold tracking-wide text-muted">BOÎTE À BORNES {powered && '· verrouillée sous tension'}</div>
              <TerminalBox value={barrettes} onChange={(b) => guard('Barrettes de la boîte à bornes', () => setBarrettes(b))} />
              <NamePlate />
            </div>
            <div className="space-y-3 rounded-card bg-card shadow-sm shadow-black/[0.03] p-3 ring-1 ring-line">
              <div className="text-xs font-semibold tracking-wide text-muted">ALIMENTATION</div>
              <Toggle on={source === 'variateur'} onChange={(v) => guard('Sélecteur réseau / variateur', () => setSource(v ? 'variateur' : 'reseau'))} label={source === 'variateur' ? 'Variateur de vitesse' : 'Réseau 400 V – 50 Hz'} />
              {source === 'variateur' && <Knob label="Fréquence variateur" value={f} onChange={setF} min={15} max={50} step={1} unit="Hz" />}
              <div className="text-xs font-semibold tracking-wide text-muted">OHMMÈTRE</div>
              <div className="flex gap-1">
                {(['U1-U2', 'U1-V1'] as const).map((pr) => (
                  <button
                    key={pr}
                    type="button"
                    onClick={() => setOhmPair(pr)}
                    aria-pressed={ohmPair === pr}
                    className={`min-h-11 rounded-md px-3 py-1 font-mono text-xs ring-1 ring-line ${ohmPair === pr ? 'bg-accent font-semibold text-on-accent' : ''}`}
                  >
                    {pr.replace('-', '–')}
                  </button>
                ))}
              </div>
              <Multimeter label={`OHMMÈTRE ${ohmPair.replace('-', '–')}`} value={ohm === null ? null : ohm === Infinity ? 1e9 : ohm} unit="Ω" decimals={1} />
              {ohm === null && <p className="text-xs text-err">Mesure impossible sous tension : coupez l’alimentation.</p>}
            </div>
          </div>
        </>
      }
      instruments={
        <>
          {liveAlert}
          {tripped && (
            <div className="flex items-start gap-3 rounded-lg bg-err/15 px-3 py-2 text-sm text-err ring-1 ring-err/50" role="alert">
              <span className="flex-1">⛔ {tripped} Alimentation coupée.</span>
              <button
                type="button"
                disabled={st.trip !== null}
                onClick={() => setTripped(null)}
                title={st.trip ? 'Réduisez d’abord le couple' : undefined}
                className="rounded-md px-2 py-0.5 text-xs ring-1 ring-err/50 disabled:opacity-40"
              >
                Réarmer
              </button>
            </div>
          )}
          {running && st.alerts.map((a) => (
            <p key={a} className="rounded-lg bg-warn/10 px-3 py-2 text-sm text-warn ring-1 ring-warn/30" role="alert">
              ⚠ {a}
            </p>
          ))}
          <div className="rounded-card bg-card shadow-sm shadow-black/[0.03] p-3 ring-1 ring-line">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold tracking-wide text-muted">WATTMÈTRE · 3 WATTMÈTRES</span>
              {(['Ph 1', 'Ph 2', 'Ph 3', 'Σ'] as const).map((l, i) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setPhase(i as 0 | 1 | 2 | 3)}
                  aria-pressed={phase === i}
                  className={`min-h-11 min-w-11 rounded-md px-2 py-0.5 font-mono text-xs ring-1 ring-line ${phase === i ? 'bg-accent font-semibold text-on-accent' : ''}`}
                >
                  {l}
                </button>
              ))}
              <Toggle on={wattMode === 'fondamental'} onChange={(v) => setWattMode(v ? 'fondamental' : 'rms')} label={wattMode === 'fondamental' ? 'Harmonique : fondamental' : 'RMS vrai'} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Wattmeter label={phase === 3 ? 'TOTAL (BOUCHEROT)' : `PHASE ${phase + 1}`} p={running ? shown.p : null} q={running ? shown.q : null} s={running ? shown.s : null} />
              <div className="space-y-3">
                {source === 'reseau' ? (
                  <Multimeter label="V SIMPLE" value={running ? read.v : null} unit="V" decimals={1} />
                ) : (
                  <Multimeter label={`U COMPOSÉE · ${wattMode === 'rms' ? 'RMS' : 'FONDAMENTAL'}`} value={running ? uRead : null} unit="V" decimals={1} />
                )}
                <Multimeter label="Is LIGNE" value={running ? read.is : null} unit="A" />
              </div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3 rounded-card bg-card shadow-sm shadow-black/[0.03] p-3 ring-1 ring-line">
              <div className="text-xs font-semibold tracking-wide text-muted">CHARGE ACTIVE</div>
              <div className="flex items-center gap-4">
                <Toggle on={pos1} onChange={setPos1} label={`Commutateur : position ${pos1 ? 1 : 0}`} />
                <Knob label="Couple" value={torque} onChange={setTorque} min={0} max={11} step={0.1} unit="N·m" format={(v) => `${v.toFixed(1).replace('.', ',')} N·m`} />
              </div>
              <Multimeter label="CAPTEUR DE COUPLE (0,3 V/N·m)" value={running ? read.sensor : null} unit="V" />
              <Multimeter label="VITESSE (VARIATEUR CHARGE)" value={running ? read.n : null} unit="tr/min" decimals={0} />
            </div>
            <div className="flex flex-col items-center justify-center rounded-card bg-card shadow-sm shadow-black/[0.03] p-3 ring-1 ring-line">
              <Tachometer rpm={running ? read.n : 0} />
              <span className="mt-1 text-xs text-muted">
                {running ? `Ns = ${Math.round(st.ns)} tr/min` : 'Moteur arrêté'} · {params.couplage === 'triangle' ? 'Δ' : 'Y'}
              </span>
            </div>
          </div>
        </>
      }
      questions={<AsyncQuestions />}
    />
  )
}
