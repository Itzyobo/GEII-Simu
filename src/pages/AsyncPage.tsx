import { useMemo, useState } from 'react'
import TpLayout from './TpLayout'
import AsyncQuestions from './AsyncQuestions'
import type { Tp } from './tps'
import WiringBoard, { type Terminal, type TerminalColor } from '../components/WiringBoard'
import Knob from '../components/Knob'
import Toggle from '../components/Toggle'
import Multimeter from '../components/Multimeter'
import Wattmeter from '../components/Wattmeter'
import Tachometer from '../components/Tachometer'
import TerminalBox, { TerminalBoxArt } from '../components/TerminalBox'
import UnverifiedBadge from '../components/UnverifiedBadge'
import { useLiveGuard } from '../components/LiveGuard'
import { BRUIT, MAS } from '../data/reference'
import type { Pair } from '../lib/wiring'
import { analyzeMasWiring, MAS_LABELS, type Objectif } from '../lib/masWiring'
import { useSpin } from '../lib/useSpin'
import { inverterVoltage, motorState, ohmmeter, readings, wattmeterPhases, type Barrettes, type OhmPair, type Source } from '../models/asyncMotor'

/** Bornes câblables du banc (vue de face). Libellés : MAS_LABELS (bornes du variateur selon MAS.bornesVariateur). */
const POS: Record<string, [number, number, TerminalColor]> = {
  L1: [45, 238, 'red'],
  L2: [95, 238, 'red'],
  L3: [145, 238, 'red'],
  N: [195, 238, 'black'],
  c1i: [295, 168, 'red'],
  c2i: [360, 168, 'red'],
  c3i: [425, 168, 'red'],
  c1o: [295, 250, 'green'],
  c2o: [360, 250, 'green'],
  c3o: [425, 250, 'green'],
  v1i: [532, 180, 'red'],
  v2i: [590, 180, 'red'],
  v3i: [648, 180, 'red'],
  v1o: [532, 262, 'blue'],
  v2o: [590, 262, 'blue'],
  v3o: [648, 262, 'blue'],
  cplB: [765, 262, 'blue'],
  cplR: [835, 262, 'red'],
  mV: [52, 568, 'red'],
  mC: [112, 568, 'black'],
  pince: [228, 470, 'yellow'],
  anV: [345, 568, 'red'],
  anC: [425, 568, 'black'],
  U1: [568, 373, 'yellow'],
  V1: [610, 373, 'yellow'],
  W1: [652, 373, 'yellow'],
}
/** Libellés courts sur les appareils (les messages de vérification gardent les noms complets de MAS_LABELS). */
const SHORT: Record<string, string> = { mV: 'V', mC: 'COM', anV: 'V', anC: 'COM', cplR: '+', cplB: '−' }
const TERMINALS: Terminal[] = Object.entries(POS).map(([id, [x, y, color]]) => ({ id, label: SHORT[id] ?? MAS_LABELS[id], color, x, y }))

interface BancProps {
  barrettes: Barrettes
  /** Vitesse affichée par le pilote de charge — tr/min */
  speed: number
  /** Fréquence affichée par le variateur — Hz, null = variateur à l'arrêt */
  freq: number | null
  /** Tension lue au voltmètre — V, null = éteint */
  volt: number | null
  pos1: boolean
  torque: number
  /** Sens de l'arbre en marche (0 = arrêté) */
  spin: 1 | -1 | 0
}

const ink = { stroke: 'none', className: 'select-none' }

/** Vue de face du banc : alim générale, commutateur 3 wattmètres, variateur, pilote de charge, appareils, MAS + MS. */
function Banc({ barrettes, speed, freq, volt, pos1, torque, spin }: BancProps) {
  const shaft = useSpin(spin !== 0 ? 0.6 : 0, spin === -1 ? -1 : 1)
  const title = (x: number, y: number, t: string, fill = '#1e2a22') => (
    <text x={x} y={y} fontSize="11" fontWeight="800" textAnchor="middle" fill={fill} letterSpacing="0.5" {...ink}>
      {t}
    </text>
  )
  const small = (x: number, y: number, t: string, fill = '#4b5563') => (
    <text x={x} y={y} fontSize="9" textAnchor="middle" fill={fill} {...ink}>
      {t}
    </text>
  )
  return (
    <>
      <defs>
        <linearGradient id="mas-alu" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f1f3f5" />
          <stop offset="1" stopColor="#bcc3ca" />
        </linearGradient>
        <linearGradient id="mas-table" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9d8bb" />
          <stop offset="1" stopColor="#d9c29d" />
        </linearGradient>
        <linearGradient id="mas-motor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6d8aa8" />
          <stop offset="0.5" stopColor="#4a6582" />
          <stop offset="1" stopColor="#2f455c" />
        </linearGradient>
      </defs>
      {/* plan de travail */}
      <rect x="0" y="318" width="900" height="352" fill="url(#mas-table)" stroke="none" />
      <line x1="0" y1="318" x2="900" y2="318" stroke="#b39a74" strokeWidth="3" />

      {/* alim générale : prise rouge et arrêt d'urgence en décor */}
      <rect x="12" y="14" width="210" height="282" rx="8" fill="#eef0f2" stroke="#9aa3ab" strokeWidth="1.5" filter="url(#wb-shadow)" />
      {title(117, 36, 'ALIM GÉNÉRALE')}
      <circle cx="62" cy="100" r="28" fill="#d63a3a" stroke="#8f1f1f" strokeWidth="2" />
      <circle cx="62" cy="100" r="18" fill="#b52b2b" stroke="#7a1a1a" />
      {[-7, 7].map((dx) => (
        <circle key={dx} cx={62 + dx} cy="100" r="3" fill="#2b0b0b" stroke="none" />
      ))}
      {small(62, 145, 'prise 400 V')}
      <rect x="138" y="70" width="60" height="60" rx="6" fill="#f2c200" stroke="#8a6d00" />
      <circle cx="168" cy="100" r="21" fill="#d61f1f" stroke="#7a1010" strokeWidth="2" />
      <circle cx="162" cy="94" r="6" fill="#ff8080" opacity="0.6" stroke="none" />
      {small(168, 145, 'arrêt d’urgence')}
      {small(120, 205, 'phases 400 V          neutre')}

      {/* commutateur 3 wattmètres : boîtier alu, entrées rouges, sorties vertes */}
      <rect x="245" y="14" width="230" height="282" rx="8" fill="url(#mas-alu)" stroke="#8b949c" strokeWidth="1.5" filter="url(#wb-shadow)" />
      {title(360, 36, 'COMMUTATEUR 3 WATTMÈTRES')}
      <circle cx="360" cy="74" r="22" fill="#2d3236" stroke="#111" />
      <rect x="357" y="54" width="6" height="20" rx="2" fill="#e8ecef" stroke="none" />
      {['Ph1', 'Ph2', 'Ph3', 'Σ'].map((t, i) => (
        <g key={t}>{small(310 + i * 33, 112, t)}</g>
      ))}
      <text x="250" y="134" fontSize="9.5" fontWeight="700" fill="#b91c1c" {...ink}>entrées</text>
      <text x="250" y="209" fontSize="9.5" fontWeight="700" fill="#15803d" {...ink}>sorties</text>
      {[295, 360, 425].map((x) => (
        <path key={x} d={`M${x} 182 V196 l-5 4 l10 4 l-10 4 l10 4 l-5 4 V236`} stroke="#6b737b" strokeWidth="1.2" fill="none" />
      ))}

      {/* variateur Schneider : bandeau vert, écran, boutons vert / jaune */}
      <rect x="500" y="14" width="180" height="294" rx="8" fill="#e4e8eb" stroke="#8b949c" strokeWidth="1.5" filter="url(#wb-shadow)" />
      <rect x="500" y="14" width="180" height="26" rx="8" fill="#3dcd58" stroke="none" />
      <rect x="500" y="30" width="180" height="10" fill="#3dcd58" stroke="none" />
      {title(590, 32, 'VARIATEUR (Schneider)', '#0b3d16')}
      <rect x="520" y="50" width="140" height="34" rx="4" fill="#0f2a12" stroke="#000" />
      <text x="590" y="73" fontSize="15" fontWeight="700" textAnchor="middle" fill="#57f27a" className="font-mono select-none" stroke="none">
        {freq === null ? 'rdY' : `${freq.toFixed(1)} Hz`}
      </text>
      <circle cx="555" cy="110" r="10" fill="#22a05a" stroke="#14532d" />
      <circle cx="590" cy="110" r="10" fill="#facc15" stroke="#854d0e" />
      <circle cx="625" cy="110" r="10" fill="#9aa3ab" stroke="#4b5563" />
      <text x="510" y="146" fontSize="9.5" fontWeight="700" fill="#b91c1c" {...ink}>entrée</text>
      <text x="510" y="228" fontSize="9.5" fontWeight="700" fill="#1d4ed8" {...ink}>sortie</text>

      {/* pilote de charge Leroy-Somer : écran de vitesse, commutateur 0/1, bouton k, bornes couple */}
      <rect x="705" y="14" width="183" height="294" rx="8" fill="#33475b" stroke="#1d2a36" strokeWidth="1.5" filter="url(#wb-shadow)" />
      {title(796, 34, 'PILOTE DE CHARGE', '#f1f5f9')}
      {small(796, 47, 'Leroy-Somer', '#cbd5e1')}
      <rect x="725" y="58" width="142" height="36" rx="4" fill="#0b120d" stroke="#000" />
      <text x="796" y="82" fontSize="15" fontWeight="700" textAnchor="middle" fill="#3dff86" className="font-mono select-none" stroke="none">
        {`${String(Math.round(speed)).padStart(4, ' ')} tr/min`}
      </text>
      <circle cx="755" cy="148" r="20" fill="#1d2a36" stroke="#94a3b8" />
      <rect x="752" y="130" width="6" height="18" rx="2" fill="#f1f5f9" transform={`rotate(${pos1 ? 45 : -45} 755 148)`} stroke="none" />
      {small(733, 176, '0', '#e2e8f0')}
      {small(777, 176, '1', '#e2e8f0')}
      <circle cx="838" cy="148" r="20" fill="#cbd5e1" stroke="#475569" />
      <line x1="838" y1="148" x2="838" y2="132" stroke="#1d2a36" strokeWidth="3" strokeLinecap="round" transform={`rotate(${-135 + (torque / 11) * 270} 838 148)`} />
      {small(838, 186, 'k', '#e2e8f0')}
      {small(800, 222, 'couple', '#e2e8f0')}
      {/* pré-câblé : cordon secteur du pilote */}
      <path d="M888 60 C 896 60 896 30 900 22" stroke="#111" strokeWidth="5" fill="none" pointerEvents="none" />
      {small(858, 302, 'secteur ↗', '#cbd5e1')}

      {/* multimètre orange en voltmètre */}
      <rect x="15" y="345" width="135" height="255" rx="14" fill="#f07c1e" stroke="#9a4a00" strokeWidth="1.5" filter="url(#wb-shadow)" />
      <rect x="25" y="355" width="115" height="232" rx="8" fill="#2a2e33" stroke="none" />
      <rect x="33" y="364" width="99" height="40" rx="4" fill="#a9c2a1" stroke="#15191c" />
      <text x="126" y="391" fontSize="16" fontWeight="700" textAnchor="end" fill="#1d2a1d" className="font-mono select-none" stroke="none">
        {volt === null ? '0.000' : volt.toFixed(3)}
      </text>
      {small(82, 418, 'VOLTMÈTRE', '#e2e8f0')}
      <circle cx="82" cy="472" r="30" fill="#3a4047" stroke="#111" />
      <rect x="79" y="444" width="6" height="26" rx="2" fill="#f07c1e" stroke="none" />
      {small(82, 516, 'V⎓', '#e2e8f0')}

      {/* analyseur jaune + pince ampèremétrique */}
      <rect x="300" y="345" width="170" height="255" rx="14" fill="#f2c200" stroke="#8a6d00" strokeWidth="1.5" filter="url(#wb-shadow)" />
      <rect x="312" y="356" width="146" height="232" rx="8" fill="#2a2e33" stroke="none" />
      <rect x="322" y="366" width="126" height="86" rx="4" fill="#163246" stroke="#0b1620" />
      <path d="M330 420 q12 -30 24 0 t24 0 t24 0 t24 0" stroke="#facc15" strokeWidth="2" fill="none" />
      <text x="330" y="385" fontSize="10" fill="#e2e8f0" className="font-mono select-none" stroke="none">P  Q  S  cos φ</text>
      {small(385, 470, 'ANALYSEUR', '#e2e8f0')}
      {small(345, 530, 'tension', '#cbd5e1')}
      {small(425, 530, 'référence', '#cbd5e1')}
      <path d="M245 482 C 270 520, 290 470, 312 470" stroke="#111" strokeWidth="4" fill="none" pointerEvents="none" />
      <circle cx="228" cy="470" r="20" fill="none" stroke="#1d2023" strokeWidth="8" strokeDasharray="100 26" transform="rotate(-50 228 470)" />
      <rect x="236" y="480" width="34" height="18" rx="5" fill="#f2c200" stroke="#7a6200" transform="rotate(30 236 480)" />

      {/* MAS : carcasse à ailettes, boîte à bornes (même dessin que la boîte à bornes ci-dessous) */}
      <rect x="520" y="448" width="180" height="138" rx="16" fill="url(#mas-motor)" stroke="#1f2f40" strokeWidth="1.5" filter="url(#wb-shadow)" />
      {Array.from({ length: 8 }, (_, i) => (
        <line key={i} x1={540 + i * 20} y1="458" x2={540 + i * 20} y2="576" stroke="#2f455c" strokeWidth="3" opacity="0.6" />
      ))}
      <text x="610" y="560" fontSize="13" fontWeight="800" textAnchor="middle" fill="#f1f5f9" {...ink}>
        MAS 3~
      </text>
      <g transform="translate(540 345) scale(0.7)" pointerEvents="none">
        <TerminalBoxArt value={barrettes} topLabels={false} />
      </g>
      {/* arbre + accouplement (pré-câblé) */}
      <rect x="700" y="508" width="62" height="14" fill="#9aa3ab" stroke="#4b5563" />
      <g transform="translate(731 515)">
        <g ref={shaft}>
          <circle r="16" fill="#cbd5e1" stroke="#4b5563" />
          <rect x="-2" y="-16" width="4" height="12" fill="#d9480f" stroke="none" />
        </g>
      </g>
      {spin !== 0 && small(731, 604, spin === 1 ? '↻ sens normal' : '↺ sens inverse', '#1e2a22')}
      {/* MS (machine de charge) + liaison de puissance pré-câblée depuis le pilote */}
      <rect x="762" y="456" width="126" height="122" rx="14" fill="#3f5e4a" stroke="#22362a" strokeWidth="1.5" filter="url(#wb-shadow)" />
      <text x="825" y="522" fontSize="13" fontWeight="800" textAnchor="middle" fill="#f1f5f9" {...ink}>
        MS
      </text>
      {small(825, 540, 'charge', '#d1fae5')}
      <path d="M870 308 C 870 380, 860 400, 860 456" stroke="#1d2023" strokeWidth="7" fill="none" pointerEvents="none" />
      <path d="M870 308 C 870 380, 860 400, 860 456" stroke="#5b6570" strokeWidth="2" fill="none" strokeDasharray="6 6" pointerEvents="none" />
      {small(830, 400, 'pré-câblé', '#4b5563')}
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
  const [objectif, setObjectif] = useState<Objectif>('reseau')
  const [wires, setWires] = useState<Pair[]>([])
  const { guard, alert: liveAlert } = useLiveGuard(powered)
  const [f, setF] = useState(50)
  const [pos1, setPos1] = useState(false)
  const [torque, setTorque] = useState(0)
  const [wattMode, setWattMode] = useState<'rms' | 'fondamental'>('rms')
  const [phase, setPhase] = useState<0 | 1 | 2 | 3>(3)
  const [ohmPair, setOhmPair] = useState<OhmPair>('U1-U2')
  const [tripped, setTripped] = useState<string | null>(null)

  // Le câblage décide de l'alimentation réelle ; l'objectif ne sert qu'à la vérification
  const bench = useMemo(() => analyzeMasWiring(wires, objectif, barrettes), [wires, objectif, barrettes])
  const source: Source = bench.supply === 'variateur' ? 'variateur' : 'reseau'
  const couple = pos1 ? torque : 0 // la charge active n'applique le couple qu'en position 1
  const couplage = barrettes === 'etoile' ? 'etoile' : 'triangle'
  const params = { couple, couplage, source, f } as const
  const st = useMemo(() => motorState({ couple, couplage, source, f }), [couple, couplage, source, f])
  const read = useMemo(() => readings(st), [st]) // bruit figé tant que le réglage ne change pas
  const running = powered && !tripped && barrettes !== 'aucune' && bench.rotation !== 0
  const stalled = powered && !tripped && barrettes !== 'aucune' && bench.rotation === 0

  // Disjoncteur : déclenche dès que la protection voit un dépassement en marche
  if (running && st.trip && tripped === null) setTripped(st.trip)

  const k = (BRUIT.min + BRUIT.max) / 2
  const uRead = useMemo(() => inverterVoltage(f, wattMode) * (1 + (Math.random() * 2 - 1) * k), [f, wattMode, k])
  const watt = wattmeterPhases(read.pa, read.qa)
  const shown = phase === 3 ? watt.total : watt.phases[phase]
  const ohm = ohmmeter(barrettes, ohmPair, powered)

  return (
    <TpLayout
      title={tp.title}
      wideSchematic
      schematic={
        <>
          <WiringBoard
            progressId="mas-cablage"
            terminals={TERMINALS}
            assess={(w) => analyzeMasWiring(w, objectif, barrettes)}
            width={900}
            height={670}
            onPowerChange={setPowered}
            onWiresChange={setWires}
            revision={`${barrettes}|${objectif}`}
          >
            <Banc
              barrettes={barrettes}
              speed={running ? read.n : 0}
              freq={powered && source === 'variateur' && !tripped ? f : null}
              volt={running ? read.sensor : null}
              pos1={pos1}
              torque={torque}
              spin={running ? bench.rotation : 0}
            />
          </WiringBoard>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3 rounded-card bg-card shadow-sm shadow-black/[0.03] p-3 ring-1 ring-line">
              <div className="text-xs font-semibold tracking-wide text-muted">BOÎTE À BORNES {powered && '· verrouillée sous tension'}</div>
              <TerminalBox value={barrettes} onChange={(b) => guard('Barrettes de la boîte à bornes', () => setBarrettes(b))} />
              <NamePlate />
            </div>
            <div className="space-y-3 rounded-card bg-card shadow-sm shadow-black/[0.03] p-3 ring-1 ring-line">
              <div className="text-xs font-semibold tracking-wide text-muted">
                OBJECTIF DE CÂBLAGE
                <UnverifiedBadge id="mas-cablage" />
              </div>
              <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Objectif de câblage">
                {(
                  [
                    ['reseau', 'Montage 1 (réseau)'],
                    ['variateur', 'Montage 2 (variateur)'],
                  ] as const
                ).map(([o, l]) => (
                  <button
                    key={o}
                    type="button"
                    role="radio"
                    aria-checked={objectif === o}
                    onClick={() => setObjectif(o)}
                    className={`min-h-11 rounded-md px-3 py-1 text-xs ring-1 ring-line ${objectif === o ? 'bg-accent font-semibold text-on-accent' : ''}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted">
                L’objectif ne pose ni ne retire aucun fil : il fixe le montage attendu à « Faire vérifier ». Pour changer de montage, décâblez hors tension puis recâblez.
              </p>
              <p className="text-xs">
                Alimentation câblée :{' '}
                <span className="font-semibold">{bench.supply === 'commutateur' ? 'réseau via le commutateur' : bench.supply === 'variateur' ? 'variateur' : 'aucune'}</span>
              </p>
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
          {stalled && (
            <p className="rounded-lg bg-err/10 px-3 py-2 text-sm text-err ring-1 ring-err/30" role="alert">
              ⛔ La MAS ne démarre pas : elle ronfle, l’arbre reste immobile. Coupez l’alimentation et vérifiez les phases.
            </p>
          )}
          {running && bench.rotation === -1 && (
            <p className="rounded-lg bg-warn/10 px-3 py-2 text-sm text-warn ring-1 ring-warn/30" role="alert">
              ↺ La MAS tourne en sens inverse.
            </p>
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
