import { useMemo, useState, type ReactNode } from 'react'
import TpLayout from './TpLayout'
import WiringBoard, { type Terminal } from '../components/WiringBoard'
import Oscilloscope from '../components/Oscilloscope'
import Knob from '../components/Knob'
import Toggle from '../components/Toggle'
import Multimeter from '../components/Multimeter'
import QuestionCard from '../components/QuestionCard'
import { metaOf, tableMeta, type AnswerSpec, type QuestionMeta } from '../lib/exam'
import { BRUIT, FLYBACK } from '../data/reference'
import { acquire, measure, type Signal } from '../lib/scope'
import type { Pair } from '../lib/wiring'
import { discontinuityThreshold, etaIsVoltageRatio, flybackSignals, idleFraction, measureRatio, operatingPoint, releveChecks, type ReleveBench, type ReleveInput } from '../models/flyback'
import { Cell, Exercise, GradeBar, num, useTableGrading } from '../components/Worksheet'

const TERMINALS: Terminal[] = [
  { id: 'aliP', label: 'Alim +', color: 'red', x: 40, y: 200 },
  { id: 'aliN', label: 'Alim −', color: 'black', x: 90, y: 200 },
  { id: 'vinV', label: 'Ve V', color: 'red', x: 150, y: 72 },
  { id: 'vinC', label: 'Ve COM', color: 'black', x: 205, y: 72 },
  { id: 'ainA', label: 'Ie A', color: 'red', x: 150, y: 302 },
  { id: 'ainC', label: 'Ie COM', color: 'black', x: 205, y: 302 },
  { id: 'vin', label: 'VIN', color: 'red', x: 295, y: 150 },
  { id: 'pgnd', label: 'PGND', color: 'black', x: 295, y: 240 },
  { id: 'vout', label: 'VOUT', color: 'red', x: 405, y: 150 },
  { id: 'gnd0', label: 'GND0', color: 'black', x: 405, y: 240 },
  { id: 'voV', label: 'Vs V', color: 'red', x: 490, y: 72 },
  { id: 'voC', label: 'Vs COM', color: 'black', x: 545, y: 72 },
  { id: 'aoA', label: 'Is A', color: 'red', x: 490, y: 302 },
  { id: 'aoC', label: 'Is COM', color: 'black', x: 545, y: 302 },
  { id: 'rh1', label: 'Rh 1', color: 'brown', x: 640, y: 150 },
  { id: 'rh2', label: 'Rh 2', color: 'brown', x: 640, y: 240 },
  { id: 'm1', label: 'Masse CH1', color: 'black', x: 300, y: 340 },
  { id: 'm2', label: 'Masse CH2', color: 'black', x: 400, y: 340 },
]

/** Ampèremètres en série, voltmètres en parallèle, côté entrée puis côté sortie ; rhéostat en charge. */
const EXPECTED: Pair[] = [
  ['aliP', 'ainA'],
  ['ainC', 'vin'],
  ['aliN', 'pgnd'],
  ['vinV', 'vin'],
  ['vinC', 'pgnd'],
  ['vout', 'aoA'],
  ['aoC', 'rh1'],
  ['rh2', 'gnd0'],
  ['voV', 'vout'],
  ['voC', 'gnd0'],
]
/** Masses des sondes : sur l'un ou l'autre côté, non exigées par la vérification. */
const OPTIONAL: Pair[] = [
  ['m1', 'pgnd'],
  ['m1', 'gnd0'],
  ['m2', 'pgnd'],
  ['m2', 'gnd0'],
]

const fr = (x: number, digits = 3) => String(Number(x.toPrecision(digits))).replace('.', ',')
const noisy = (x: number) => x * (1 + (Math.random() * 2 - 1) * BRUIT.min)


function Schematic() {
  const txt = { fill: 'var(--color-muted)', stroke: 'none', fontSize: 11, textAnchor: 'middle' as const }
  return (
    <>
      <rect x="15" y="140" width="100" height="80" rx="6" />
      <text x="65" y="165" {...txt}>Alim Ve</text>
      <rect x="125" y="20" width="105" height="70" rx="6" />
      <text x="177" y="40" {...txt}>Voltmètre entrée</text>
      <rect x="125" y="250" width="105" height="70" rx="6" />
      <text x="177" y="270" {...txt}>Ampèremètre entrée</text>
      <rect x="265" y="100" width="170" height="180" rx="8" />
      <text x="350" y="122" {...txt} fontSize={12}>MAX17691B</text>
      <line x1="350" y1="130" x2="350" y2="275" strokeDasharray="5 4" />
      <text x="350" y="205" {...txt} fontSize={9}>isolation</text>
      <rect x="465" y="20" width="105" height="70" rx="6" />
      <text x="517" y="40" {...txt}>Voltmètre sortie</text>
      <rect x="465" y="250" width="105" height="70" rx="6" />
      <text x="517" y="270" {...txt}>Ampèremètre sortie</text>
      <rect x="615" y="130" width="50" height="130" rx="6" />
      <text x="640" y="200" {...txt}>Rhéostat</text>
    </>
  )
}

/** Réponses de la partie 2, calculées sur les modèles. */
function computeAnswers() {
  const nominal = { ve: FLYBACK.veDefaut, is: 0.5 }
  const p = { ...nominal, linear: false }
  const T = 1 / FLYBACK.fDecoupage
  const { v1 } = flybackSignals(p)
  return {
    eta05: operatingPoint(p).eta * 100,
    etaLin: operatingPoint({ ...nominal, linear: true }).eta * 100,
    m: measureRatio(p),
    f: measure(acquire(v1, 0, 10 * T, 4000), (10 * T) / 4000).freq / 1e3,
    idleLow: idleFraction({ ve: nominal.ve, is: FLYBACK.isMin, linear: false }),
    idleHigh: idleFraction({ ve: nominal.ve, is: FLYBACK.isMax, linear: false }),
    dcmThreshold: discontinuityThreshold(nominal.ve),
  }
}

const ETA_RAPPEL = 'η = Ps/Pe = Vs·Is / (Ve·Ie). Le rapport Vs/Ve ne vaut le rendement que pour l’alim linéaire, où Ie = Is.'
const RELEVES_EXPLANATION = 'Pin = Ve·Ie, Pout = Vs·Is, η = Ps/Pe = Vs·Is/(Ve·Ie). Le rapport Vs/Ve ne vaut le rendement que pour l’alim linéaire.'

/** Réponses attendues et explications de la partie 2 : source unique des cartes et de la clé d'examen. */
function specs(): Record<string, AnswerSpec> {
  const a = computeAnswers()
  const ds = 'Valeur lue sur la datasheet MAX17691B.'
  const range = `${ds} Plage d’entrée : ${FLYBACK.veMin} à ${FLYBACK.veMax} V.`
  return {
    'alim2-q1-vemin': { expected: FLYBACK.veMin, unit: 'V', explanation: range },
    'alim2-q1-vemax': { expected: FLYBACK.veMax, unit: 'V', explanation: range },
    'alim2-q1-vs': { expected: FLYBACK.vs, unit: 'V', explanation: ds },
    'alim2-q1-is': { expected: FLYBACK.isNominal, unit: 'A', explanation: ds },
    'alim2-q1-f': { expected: FLYBACK.fDecoupage / 1e3, unit: 'kHz', explanation: ds },
    'alim2-q1-eta': { expected: FLYBACK.etaNominal * 100, unit: '%', explanation: `${ds} ${ETA_RAPPEL}` },
    'alim2-q1-iso': {
      kind: 'choix',
      choices: [
        'Aucune liaison conductrice entre entrée et sortie : l’énergie passe par le champ magnétique du transformateur, les masses PGND et GND0 sont séparées',
        'La sortie est protégée contre les courts-circuits',
        'L’entrée et la sortie partagent la même masse',
        'Le convertisseur ne produit pas de perturbations électromagnétiques',
      ],
      correct: 0,
      explanation:
        'Le transformateur transmet l’énergie par le flux magnétique, sans contact électrique : entrée et sortie n’ont pas de référence commune. Relier les deux masses (par exemple par les masses de l’oscilloscope) court-circuite cette isolation.',
    },
    'alim2-q2': { expected: a.eta05, unit: '%', explanation: `${ETA_RAPPEL} À 0,5 A : Ps = 5 × 0,5 = 2,5 W, d’où η ≈ ${fr(a.eta05)} %.` },
    'alim2-q3': {
      expected: a.etaLin,
      unit: '%',
      explanation: `Alim linéaire : Ie = Is, donc η = Vs·Is/(Ve·Is) = Vs/Ve = 5/30 ≈ ${fr(a.etaLin)} %, contre ≈ ${fr(a.eta05)} % pour le flyback. ${ETA_RAPPEL}`,
    },
    'alim2-q5-m': { expected: a.m, unit: '', explanation: `Pendant la conduction, V1 = Ve et V2 = −m·Ve : m = |V2_on| / Ve ≈ ${fr(a.m)}.` },
    'alim2-q5-f': { expected: a.f, unit: 'kHz', explanation: `f = 1/T, avec T lu sur V1(t) ≈ ${fr(1e3 / a.f)} µs, soit f ≈ ${fr(a.f)} kHz.` },
    'alim2-dcm-mode': {
      kind: 'choix',
      choices: [
        'Conduction discontinue : après la démagnétisation, V2 retombe sur un palier oscillant amorti autour de 0 avant la conduction suivante',
        'Conduction continue : V2 passe directement de −m·Ve à Vs + Vd, sans palier',
        'Le découpage s’arrête : V2 reste à 0',
        'La fréquence de découpage double',
      ],
      correct: a.idleLow > 0.05 && a.idleHigh < 0.03 ? 0 : 1,
      explanation: `À faible charge, l’énergie demandée par période ne suffit plus à maintenir le flux : le transformateur se démagnétise complètement avant la conduction suivante, d’où le palier oscillant autour de 0 sur V2 (≈ ${fr(a.idleLow * 100, 2)} % de la période à ${FLYBACK.isMin} A, ≈ 0 % à ${FLYBACK.isMax} A). Le rapport cyclique diminue alors avec Is.`,
    },
    'alim2-dcm-courant': {
      expected: a.dcmThreshold,
      unit: 'A',
      tolerance: 0.3,
      explanation: `Le palier disparaît vers Is ≈ ${fr(a.dcmThreshold)} A (Ve = ${FLYBACK.veDefaut} V) : au-dessus, conduction continue avec α = (Vs + Vd)/(Vs + Vd + m·Ve) ; en dessous, conduction discontinue et α ∝ √Is.`,
    },
  }
}

/** Clé de correction de la partie 2 (questions et tableau non affichés à la remise d'un examen). */
export function answerKey(): Record<string, QuestionMeta> {
  return { ...Object.fromEntries(Object.entries(specs()).map(([id, sp]) => [id, metaOf(sp)])), 'alim2-releves': tableMeta(RELEVES_EXPLANATION) }
}

function Part2Questions() {
  const s = useMemo(specs, [])
  const q1 =
    '1. A partir de la datasheet, trouver les principales caractéristiques de la platine, plage de tension d’entrée, tension et courant de sortie, fréquence de découpage, rendement pour le courant nominal. Que veut dire isolation galvanique ?'
  const q5 =
    '5. Visualiser les tensions V1(t) et V2(t) de l’alimentation isolée, attention aux masses. Régler le courant à 0,5A environ. Calculer le rapport de transformation m = n2/n1. Retrouver la fréquence de découpage.'
  return (
    <>
      <QuestionCard id="alim2-q1-vemin" label="Q1" statement={`${q1} — Ici : tension d’entrée minimale.`} {...s['alim2-q1-vemin']} />
      <QuestionCard id="alim2-q1-vemax" label="Q1" statement={`${q1} — Ici : tension d’entrée maximale.`} {...s['alim2-q1-vemax']} />
      <QuestionCard id="alim2-q1-vs" label="Q1" statement={`${q1} — Ici : tension de sortie.`} {...s['alim2-q1-vs']} />
      <QuestionCard id="alim2-q1-is" label="Q1" statement={`${q1} — Ici : courant de sortie nominal.`} {...s['alim2-q1-is']} />
      <QuestionCard id="alim2-q1-f" label="Q1" statement={`${q1} — Ici : fréquence de découpage.`} {...s['alim2-q1-f']} />
      <QuestionCard id="alim2-q1-eta" label="Q1" statement={`${q1} — Ici : rendement au courant nominal.`} {...s['alim2-q1-eta']} />
      <QuestionCard id="alim2-q1-iso" label="Q1" statement={`${q1} — Ici : que veut dire isolation galvanique ?`} {...s['alim2-q1-iso']} />
      <QuestionCard
        id="alim2-q2"
        label="Q2"
        statement="2. Proposer un schéma de câblage permettant de mesurer le rendement global de l’alimentation. On utilisera avec un rhéostat comme charge. Au départ le rhéostat sera réglé à sa valeur maximum. Faire varier le courant de sa valeur mini à 0,5A. Faire cinq points de mesures. — Ici : rendement au point 0,5 A (Ve = 30 V)."
        {...s['alim2-q2']}
      />
      <QuestionCard
        id="alim2-q3"
        label="Q3"
        statement="3. Quel serait le rendement si on remplaçait ce convertisseur par une alimentation type linéaire ? Calculer ce rendement théorique pour un courant de 0,5A (dans une alimentation linéaire le courant en entrée et le même qu’en sortie). Conclure"
        {...s['alim2-q3']}
      />
      <QuestionCard id="alim2-q5-m" label="Q5" statement={`${q5} — Ici : rapport de transformation m.`} {...s['alim2-q5-m']} />
      <QuestionCard id="alim2-q5-f" label="Q5" statement={`${q5} — Ici : fréquence de découpage.`} {...s['alim2-q5-f']} />
      <QuestionCard
        id="alim2-dcm-mode"
        label="Complément"
        statement="Conduction continue / discontinue : Ve = 30 V, observer V2(t) en baissant la charge (rhéostat vers sa valeur maximum, Is diminue). Quel fonctionnement apparaît à faible courant ?"
        {...s['alim2-dcm-mode']}
      />
      <QuestionCard
        id="alim2-dcm-courant"
        label="Complément"
        statement="Conduction continue / discontinue : à Ve = 30 V, à partir de quel courant de sortie Is approximatif le fonctionnement bascule-t-il entre conduction continue et discontinue ?"
        {...s['alim2-dcm-courant']}
      />
    </>
  )
}

const RELEVE_COLS = [
  { key: 've', label: 'Ve (V)', calc: false },
  { key: 'ie', label: 'Ie (A)', calc: false },
  { key: 'vs', label: 'Vs (V)', calc: false },
  { key: 'is', label: 'Is (A)', calc: false },
  { key: 'pin', label: 'Pin (W)', calc: true },
  { key: 'pout', label: 'Pout (W)', calc: true },
  { key: 'eta', label: 'η (%)', calc: true },
] as const
type ReleveRow = { bench?: ReleveBench; linear?: boolean; vals: Record<string, string> }

/**
 * Tableau des 5 relevés (Q2), noté comme les tableaux de la MAS : lectures à ±5 % du banc
 * (valeurs figées au moment du relevé), Pin, Pout et η à ±3 % des mesures saisies.
 */
function ReleveSheet({ bench, powered, linear }: { bench: ReleveBench; powered: boolean; linear: boolean }) {
  const [rows, setRows] = useState<ReleveRow[]>(() => Array.from({ length: 5 }, () => ({ vals: {} })))
  const g = useTableGrading('alim2-releves', RELEVES_EXPLANATION)
  const input = (r: ReleveRow) => Object.fromEntries(RELEVE_COLS.map((c) => [c.key, num(r.vals[c.key])])) as unknown as ReleveInput
  const checksOf = (r: ReleveRow) => (r.bench ? releveChecks(r.bench, input(r)) : null)
  const update = (k: number, next: ReleveRow) => {
    setRows(rows.map((r, i) => (i === k ? next : r)))
    g.setChecked(false)
  }
  const submit = () =>
    g.submit(rows.flatMap((r) => RELEVE_COLS.map((c) => ({ value: r.vals[c.key], check: checksOf(r)?.[c.key] ?? { expected: NaN, tol: 0 } }))))
  const confused = g.checked ? rows.map((r, k) => (r.bench && etaIsVoltageRatio(input(r)) ? k + 1 : 0)).filter(Boolean) : []
  return (
    <Exercise
      id="alim2-releves"
      label="Q2"
      statement="Faire varier le courant de sa valeur mini à 0,5A. Faire cinq points de mesures. — Ici : notez chaque point (réglages figés), puis saisissez vos lectures et vos calculs."
    >
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-muted">
            <tr>
              <th className="px-1 py-1 font-normal">Point</th>
              {RELEVE_COLS.map((c) => (
                <th key={c.key} className={`px-1 py-1 font-normal ${c.calc ? 'text-accent' : ''}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, k) => (
              <tr key={k} className="border-t border-line">
                <td className="px-1 py-1">
                  <button
                    type="button"
                    disabled={!powered}
                    onClick={() => update(k, { ...r, bench, linear })}
                    className="min-h-11 rounded-md bg-card-2 px-2 font-mono ring-1 ring-line disabled:opacity-40"
                    title="Fige les réglages actuels du banc pour ce point"
                  >
                    {r.bench ? `#${k + 1} ✓` : `Noter #${k + 1}`}
                  </button>
                  {r.linear && <span className="ml-1 text-muted">lin.</span>}
                </td>
                {RELEVE_COLS.map((c) => (
                  <td key={c.key} className="px-1 py-1 text-center">
                    <Cell
                      label={`Point ${k + 1} ${c.label}`}
                      value={r.vals[c.key] ?? ''}
                      onChange={(v) => update(k, { ...r, vals: { ...r.vals, [c.key]: v } })}
                      check={checksOf(r)?.[c.key]}
                      checked={g.checked}
                      calc={c.calc}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3">
        <GradeBar exam={g.exam} saved={g.saved} onSubmit={submit} label="Vérifier le tableau">
          {!g.exam && <span className="text-xs text-muted">Lectures à ±5 % du banc au moment du relevé ; Pin, Pout, η à ±3 % de vos mesures.</span>}
        </GradeBar>
      </div>
      {confused.length > 0 && (
        <p className="mt-2 rounded-lg bg-err/10 px-3 py-2 text-sm text-err ring-1 ring-err/30" role="alert">
          Point{confused.length > 1 ? 's' : ''} {confused.join(', ')} : ceci est Vs/Ve, pas Ps/Pe.
        </p>
      )}
    </Exercise>
  )
}

/** Partie 2 : platine flyback MAX17691B. */
export default function AlimPart2({ title, tabs }: { title: string; tabs: ReactNode }) {
  const [powered, setPowered] = useState(false)
  const [wires, setWires] = useState<Pair[]>([])
  const [ve, setVe] = useState<number>(FLYBACK.veDefaut)
  const [rh, setRh] = useState(FLYBACK.vs / FLYBACK.isMin) // rhéostat au maximum au départ
  const [linear, setLinear] = useState(false)

  const is = Math.min(FLYBACK.isMax, Math.max(FLYBACK.isMin, FLYBACK.vs / rh))
  const op = useMemo(() => operatingPoint({ ve, is, linear }), [ve, is, linear])
  // Lectures bruitées (±1 %), figées tant que le réglage ne change pas
  const readings = useMemo(() => ({ ve: noisy(ve), ie: noisy(op.ie), vs: noisy(op.vs), is: noisy(is) }), [ve, op, is])

  // Masses de l'oscilloscope : toutes reliées entre elles dans l'appareil.
  const grounds = new Set(
    wires.filter(([a, b]) => [a, b].some((x) => x === 'm1' || x === 'm2')).flatMap(([a, b]) => [a, b].filter((x) => x === 'pgnd' || x === 'gnd0')),
  )
  const refPrimary = grounds.has('pgnd')
  const refSecondary = grounds.has('gnd0')
  const signals = useMemo(() => {
    const s = flybackSignals({ ve, is, linear })
    const zero: Signal = () => 0
    return { v1: powered && refPrimary ? s.v1 : zero, v2: powered && refSecondary ? s.v2 : zero }
  }, [ve, is, linear, powered, refPrimary, refSecondary])

  return (
    <TpLayout
      title={title}
      tabs={tabs}
      schematic={
        <>
          <WiringBoard
            progressId="alim2-cablage"
            terminals={TERMINALS}
            expected={EXPECTED}
            optional={OPTIONAL}
            width={690}
            height={360}
            onPowerChange={setPowered}
            onWiresChange={setWires}
          >
            <Schematic />
          </WiringBoard>
          <div className="rounded-card bg-card p-3 ring-1 ring-line">
            <div className="mb-2 text-xs font-semibold tracking-wide text-muted">RÉGLAGES</div>
            <div className="flex flex-wrap items-center gap-5">
              <Knob label="Ve" value={ve} onChange={setVe} min={FLYBACK.veMin} max={FLYBACK.veMax} step={0.1} unit="V" />
              <Knob label="Rhéostat" value={rh} onChange={setRh} min={FLYBACK.vs / FLYBACK.isMax} max={FLYBACK.vs / FLYBACK.isMin} step={0.1} unit="Ω" log />
              <Toggle on={linear} onChange={setLinear} label="Alim linéaire" />
              <span className="text-xs text-muted">{op.discontinuous && !linear ? 'Conduction discontinue' : linear ? 'Pas de découpage' : 'Conduction continue'}</span>
            </div>
          </div>
        </>
      }
      instruments={
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Multimeter label="VOLTMÈTRE ENTRÉE" value={powered ? readings.ve : null} unit="V" />
            <Multimeter label="AMPÈREMÈTRE ENTRÉE" value={powered ? readings.ie : null} unit="A" decimals={3} />
            <Multimeter label="VOLTMÈTRE SORTIE" value={powered ? readings.vs : null} unit="V" />
            <Multimeter label="AMPÈREMÈTRE SORTIE" value={powered ? readings.is : null} unit="A" decimals={3} />
          </div>
          {powered && refPrimary && refSecondary && (
            <p className="rounded-lg bg-accent/15 px-3 py-2 text-sm text-accent ring-1 ring-accent/40" role="alert">
              ⚠ Masses de l’oscilloscope reliées : l’isolation galvanique est court-circuitée.
            </p>
          )}
          {powered && (!refPrimary || !refSecondary) && (
            <p className="text-xs text-muted">
              {!refPrimary && 'CH1 (V1) : aucune masse de sonde sur PGND. '}
              {!refSecondary && 'CH2 (V2) : aucune masse de sonde sur GND0.'}
            </p>
          )}
          <Oscilloscope ch1={signals.v1} ch2={signals.v2} voltsPerDiv={[10, 5]} secPerDiv={2e-6} triggerLevel={10} />
          <ReleveSheet bench={{ ve, ie: op.ie, vs: op.vs, is }} powered={powered} linear={linear} />
        </>
      }
      questions={<Part2Questions />}
    />
  )
}
