/**
 * Réseaux RES3 · TP3 Ethernet 10Base2 : banc de la salle (hub, coax 50 Ω bouchonné) observé à l'oscilloscope,
 * révélation des champs sur la trace et vue hexa, parcours guidé dans l'ordre du fascicule.
 * Moteurs : src/lib/reseaux/ethernet.ts, traffic.ts ; attendus : src/lib/reseaux/tp3.ts.
 */
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import QuestionCard from '../../components/QuestionCard'
import ScopeInstrument, { type ScopeZone } from '../../components/ScopeInstrument'
import { ETH10B2 } from '../../data/reference'
import { RES3_TP3_COURS, RES3_TP3_QUESTIONS } from '../../data/questions'
import { ExamContext, type ExamApi } from '../../lib/exam'
import { recordAttempt, useProgress } from '../../lib/progress'
import { BIT, wiresharkBytes, type FieldName, type TimedFrame } from '../../lib/reseaux/ethernet'
import { createPingExercise, framesOfSecond, salle, salleTraffic, type Scenario } from '../../lib/reseaux/traffic'
import { bonusExercise, checkScope31, CHRONOS, CONSEILS_TP3, halvesOf, tp3Attendus } from '../../lib/reseaux/tp3'
import type { ScopeSettings } from '../../lib/scope/types'
import Layout from '../../modbus/pages/Layout'
import { Link } from 'react-router'
import { Btn, Card } from './ui'

const SEED_KEY = 'tp-sim:res3-tp3:seed'
const L_MAX = 6000
const FIELD_COLORS: Record<FieldName, string> = {
  Préambule: '#94a3b8',
  SFD: '#f472b6',
  'MAC dest': '#38bdf8',
  'MAC src': '#818cf8',
  Type: '#fbbf24',
  IP: '#34d399',
  ICMP: '#a3e635',
  ARP: '#2dd4bf',
  UDP: '#2dd4bf',
  Données: '#fb923c',
  Bourrage: '#f87171',
  FCS: '#e879f9',
}
const newSeed = () => Math.floor(Math.random() * 1e6)
function loadSeed() {
  try {
    const s = Number(localStorage.getItem(SEED_KEY))
    if (Number.isInteger(s) && s > 0) return s
  } catch {
    /* stockage indisponible */
  }
  return newSeed()
}

type Mode = 'fond' | 'ping' | 'mystere'

export default function Tp3() {
  const [seed, setSeedState] = useState(loadSeed)
  const setSeed = (s: number) => {
    setSeedState(s)
    setReveal(false)
    try {
      localStorage.setItem(SEED_KEY, String(s))
    } catch {
      /* graine en mémoire */
    }
  }
  const [mode, setMode] = useState<Mode>('fond')
  const [lText, setLText] = useState('50')
  const [bouchon, setBouchon] = useState(true)
  const [reveal, setReveal] = useState(false)
  const [scope, setScope] = useState<ScopeSettings | null>(null)
  const mystery = useMemo(() => createPingExercise(seed).L, [seed])
  const L = Math.min(L_MAX, Math.max(0, Math.round(Number(lText.replace(',', '.')) || 0)))
  const pingL = mode === 'fond' ? null : mode === 'mystere' ? mystery : L
  // Instant où le prof lance le ping : 1re requête précédée d'un échange ARP
  const [start, setStart] = useState(0)
  const relaunch = () => setStart(performance.now() / 1000)
  const scenario = useMemo((): Scenario => (pingL === null ? { kind: 'fond' } : { kind: 'ping', L: pingL, start }), [pingL, start])
  const traffic = useMemo(() => salleTraffic(seed, scenario, bouchon), [seed, scenario, bouchon])
  const sources = useMemo(() => [traffic.source, null] as const, [traffic])
  const annotate = useMemo(() => (reveal ? (a: number, b: number) => zonesOf(traffic.framesIn(a, b), a, b) : undefined), [reveal, traffic])
  const sample = useMemo(() => {
    const fr = framesOfSecond(seed, scenario, 0)
    return fr.find((f) => f.label === 'ping requête') ?? fr[0]
  }, [seed, scenario])

  const exam = useMemo<ExamApi>(() => ({ active: false, record: () => {}, answerOf: () => undefined, register: () => {}, penalize: () => {}, scope: `res3-tp3:${seed}` }), [seed])
  const progress = useProgress()
  const done = RES3_TP3_QUESTIONS.filter((q) => progress.questions[q.id]?.success).length
  const { pcs, tsx } = salle(seed)

  return (
    <Layout>
      <ExamContext.Provider value={exam}>
        <main className="mx-auto max-w-7xl px-4 py-8">
          <p className="text-xs font-semibold tracking-[0.2em] text-muted">RÉSEAUX · TP3</p>
          <h1 className="mt-1 text-2xl font-bold">Trames Ethernet 10Base2 à l’oscilloscope</h1>
          <p className="mt-1 text-sm text-muted">
            Questions réussies : {done} / {RES3_TP3_QUESTIONS.length}. L’oscilloscope démarre en Default Setup : à vous de le régler.
          </p>
          <p className="mt-2 flex flex-wrap gap-2 text-sm">
            <Link to="/modbus/partiel-reseaux?demo=pingCourt" className="inline-flex min-h-11 items-center rounded-lg px-3 ring-1 ring-line hover:ring-accent">
              Voir la démonstration (ping court, bourrage)
            </Link>
            <Link to="/modbus/partiel-reseaux?demo=pingLong" className="inline-flex min-h-11 items-center rounded-lg px-3 ring-1 ring-line hover:ring-accent">
              Démonstration ping long
            </Link>
          </p>

          <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
            <div className="grid content-start gap-4">
              <Card title="Salle du TP">
                <SchemaSalle bouchon={bouchon} />
                <p className="mt-2 text-xs text-muted">
                  PC {pcs[0].ip.join('.')} à {pcs[pcs.length - 1].ip.join('.')} · TSX 57 {tsx.ip.join('.')} · graine <span className="font-mono">{seed}</span>
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Btn onClick={() => setSeed(newSeed())}>Nouvelle salle</Btn>
                  <Btn onClick={() => setBouchon(!bouchon)} pressed={!bouchon}>
                    Bouchon 50 Ω {bouchon ? 'en place' : 'retiré'}
                  </Btn>
                </div>
              </Card>

              <Card title="Demander au prof">
                <fieldset className="grid gap-1">
                  <legend className="sr-only">Trafic sur le réseau</legend>
                  {(
                    [
                      ['fond', 'Trafic de fond seul (broadcasts)'],
                      ['ping', 'ping -l L -t vers le TSX'],
                      ['mystere', 'ping « valeur mystère » -t'],
                    ] as const
                  ).map(([k, label]) => (
                    <label key={k} className="flex min-h-11 items-center gap-2 text-sm">
                      <input type="radio" name="mode" checked={mode === k} onChange={() => {
                          setMode(k)
                          relaunch()
                        }} className="h-4 w-4" />
                      {label}
                    </label>
                  ))}
                </fieldset>
                {mode === 'ping' && (
                  <label className="mt-1 flex items-center gap-2 text-sm">
                    L =
                    <input inputMode="numeric" value={lText} onChange={(e) => {
                        setLText(e.target.value)
                        relaunch()
                      }} className="min-h-11 w-24 rounded-lg bg-field px-2 font-mono ring-1 ring-line" aria-label="Taille des données du ping (0 à 6000 octets)" />
                    octets (0 à {L_MAX})
                  </label>
                )}
                <p className="mt-2 font-mono text-xs text-muted">
                  {mode === 'fond' ? 'Aucun ping : ARP et UDP diffusés, 2 à 5 par seconde.' : `C:\\> ping -l ${mode === 'mystere' && !reveal ? '???' : pingL} -t ${tsx.ip.join('.')}`}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Btn onClick={() => setReveal(!reveal)} pressed={reveal}>
                    {reveal ? 'Masquer les champs' : 'Révéler les champs (après réponse)'}
                  </Btn>
                </div>
                {reveal && <Legend />}
              </Card>
            </div>
            <ScopeInstrument sources={sources} onStateChange={setScope} annotate={annotate} />
          </section>

          {reveal && sample && <HexView frame={sample} />}

          <Parcours seed={seed} scope={scope} mystery={mystery} />
        </main>
      </ExamContext.Provider>
    </Layout>
  )
}

/** Zones colorées des champs des trames visibles */
function zonesOf(frames: readonly TimedFrame[], a: number, b: number): ScopeZone[] {
  const out: ScopeZone[] = []
  for (const f of frames)
    for (const fd of f.frame.fields) {
      const from = f.t0 + fd.start * 8 * BIT
      const to = from + fd.len * 8 * BIT
      if (to >= a && from <= b) out.push({ from, to, label: fd.name, color: FIELD_COLORS[fd.name] })
    }
  return out
}

function Legend() {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
      {(Object.keys(FIELD_COLORS) as FieldName[]).map((k) => (
        <li key={k} className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: FIELD_COLORS[k] }} />
          {k}
        </li>
      ))}
    </ul>
  )
}

/** Vue hexa façon Wireshark (sans préambule, SFD, bourrage ni FCS) */
function HexView({ frame }: { frame: TimedFrame }) {
  const b = wiresharkBytes(frame.frame)
  const rows = Array.from({ length: Math.ceil(b.length / 16) }, (_, r) => b.subarray(16 * r, 16 * r + 16))
  const shown = rows.slice(0, 12)
  return (
    <section className="mt-6 rounded-card bg-card p-4 ring-1 ring-line">
      <h2 className="text-sm font-semibold">Vue Wireshark — {frame.label} ({b.length} octets capturés)</h2>
      <pre className="mt-2 overflow-x-auto font-mono text-[11px] leading-5">
        {shown
          .map((r, i) => {
            const hex = Array.from(r, (x) => x.toString(16).padStart(2, '0')).join(' ')
            const asc = Array.from(r, (x) => (x >= 0x20 && x < 0x7f ? String.fromCharCode(x) : '.')).join('')
            return `${(16 * i).toString(16).padStart(4, '0')}  ${hex.padEnd(47)}  ${asc}`
          })
          .join('\n')}
        {rows.length > shown.length ? `\n… ${rows.length - shown.length} lignes de plus` : ''}
      </pre>
      <p className="mt-2 rounded-lg bg-warn/10 p-2 text-xs text-warn ring-1 ring-warn/30" role="note">
        Bourrage masqué, convention du cours (corrigé du DS : ping -l 10 ⇒ 52 octets affichés = 14 + 20 + 8 + 10). Ni préambule, ni SFD, ni FCS non plus. Le vrai Wireshark montre souvent le
        bourrage : ne vous en étonnez pas en salle.
      </p>
    </section>
  )
}

/* ─────────── Parcours guidé ─────────── */

function Parcours({ seed, scope, mystery }: { seed: number; scope: ScopeSettings | null; mystery: number }) {
  const a = tp3Attendus()
  const hyp = ['ETH10B2.front', 'ETH10B2.reponseMin']
  const qcm = (id: string) => <QuestionCard id={id} kind="choix" statement={RES3_TP3_COURS[id].statement} choices={RES3_TP3_COURS[id].choices} correct={RES3_TP3_COURS[id].correct} explanation={RES3_TP3_COURS[id].explanation} />
  const num = (id: string, statement: string, expected: number, unit: string, explanation: string, tolerance: number, unverified?: string[]) => (
    <QuestionCard id={id} statement={statement} expected={expected} unit={unit} explanation={explanation} tolerance={tolerance} unverified={unverified} />
  )
  const dur = ETH10B2.tolDuree
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold">Parcours guidé</h2>
      <p className="mt-1 text-sm text-muted">Dans l’ordre du fascicule. Durées à ±2 %, nombres d’octets exacts.</p>

      <Step title="2.1 — Niveaux électriques sur le coax">
        <p>La carte réseau tire un courant de 40 ± 30 mA sur le câble, bouchonné à 50 Ω aux deux extrémités.</p>
        {num('res3-tp3-21-z', 'Impédance vue par la carte (Ω)', a.z, 'Ω', 'Les deux demi-câbles, chacun terminé par 50 Ω, sont en parallèle : 50 // 50 = 25 Ω.', 0)}
        {num('res3-tp3-21-vmin', 'Tension la plus faible en valeur absolue (V)', a.vMin, 'V', '25 Ω × (40 − 30) mA = 0,25 V.', 0.02)}
        {num('res3-tp3-21-vmax', 'Tension la plus forte en valeur absolue (V)', a.vMax, 'V', '25 Ω × (40 + 30) mA = 1,75 V.', 0.02)}
        {qcm('res3-tp3-21-signe')}
      </Step>

      <Step title="2.2 a — Champs de la trame">{qcm('res3-tp3-22a-ordre')}</Step>

      <Step title="2.2 b — Codage Manchester (chronogrammes)">
        <p>Cliquez sur chaque demi-bit pour le mettre en haut ou en bas. Rappel : octets émis poids faible en premier ; 0 = haut puis bas, 1 = bas puis haut.</p>
        {CHRONOS.map((c) => (
          <Chrono key={c.id} id={c.id} titre={c.titre} bytes={c.bytes} />
        ))}
        {num('res3-tp3-22b-fpre', 'Fréquence du signal pendant le préambule (MHz)', a.fPre / 1e6, 'MHz', '55h donne 1,0,1,0… : un front montant tous les 2 bits, période 200 ns ⇒ 5 MHz.', 0)}
        {num('res3-tp3-22b-fff', 'Fréquence pendant une suite d’octets FFh (MHz)', a.fFF / 1e6, 'MHz', 'Suite de 1 : bas→haut à chaque bit, période 100 ns ⇒ 10 MHz.', 0)}
      </Step>

      <Step title="3.1 — Réglage de l’oscilloscope" conseil="DC · 0,5 V/div · 0 V centré · 2 µs/div · front descendant sur CH1 · Normal · déclenchement au centre · seuil −0,1 V">
        <p>Réglez l’oscilloscope comme la consigne, puis faites vérifier.</p>
        <ScopeCheck scope={scope} />
      </Step>

      <Step title="3.2 — Trame de broadcast" conseil={CONSEILS_TP3.broadcast}>
        <p>Trafic de fond seul. Capturez une trame de broadcast (Single) et repérez préambule, SFD et MAC destination.</p>
        {num('res3-tp3-32-pre', 'Durée du préambule + SFD (µs)', a.preSfdUs, 'µs', '8 octets × 8 bits × 100 ns = 6,4 µs.', dur, hyp)}
        {qcm('res3-tp3-32-11')}
        {num('res3-tp3-32-mac', 'Durée de la MAC destination (µs)', a.macUs, 'µs', '6 octets × 0,8 µs = 4,8 µs.', dur)}
        {qcm('res3-tp3-32-ff00')}
      </Step>

      <Step title="3.3 — Trames de ping" conseil={`ping 50 : ${CONSEILS_TP3.ping50}. ping 5 : ${CONSEILS_TP3.ping5}. ping 5000 : ${CONSEILS_TP3.ping5000}.`}>
        <p>Demandez au prof un ping -l 50 -t, puis -l 5, puis -l 5000. Mesurez la durée du préambule à la fin de chaque trame de requête.</p>
        {num('res3-tp3-33-50-us', 'ping -l 50 : durée de la trame (µs)', a.ping50.us, 'µs', '8 (préambule + SFD) + 14 (Ethernet) + 20 (IP) + 8 (ICMP) + 50 + 4 (FCS) = 104 octets × 0,8 µs = 83,2 µs.', dur)}
        {num('res3-tp3-33-50-oct', 'ping -l 50 : nombre d’octets sur le câble (préambule compris)', a.ping50.octets, 'octets', 'L = T/0,8 µs − 54 ⇔ T/0,8 = L + 54 = 104.', 0)}
        {num('res3-tp3-33-5-pad', 'ping -l 5 : nombre d’octets de bourrage', a.ping5.bourrage, 'octets', 'Charge = 20 + 8 + 5 = 33 < 46 : bourrage de 46 − 33 = 13 octets.', 0)}
        {qcm('res3-tp3-33-5-val')}
        {num('res3-tp3-33-5-min', 'Taille minimale d’une trame, hors préambule et SFD (octets)', a.ping5.trameMin, 'octets', '14 + 46 + 4 = 64 octets (72 avec préambule et SFD, soit 57,6 µs).', 0)}
        {num('res3-tp3-33-5000-n', 'ping -l 5000 : nombre de trames de requête', a.ping5000.n, '', '8 + 5000 = 5008 octets ICMP > 1480 : fragments de 1480, 1480, 1480 et 568 octets ⇒ 4 trames.', 0)}
        {num('res3-tp3-33-5000-last', 'ping -l 5000 : longueur de la dernière trame sur le câble (octets)', a.ping5000.dernier, 'octets', '568 + 20 (IP) = 588 ; 8 + 14 + 588 + 4 = 614 octets (491,2 µs). Les trois premières font 1526 octets (1220,8 µs).', 0)}
        {num('res3-tp3-33-5000-ifg', 'ping -l 5000 : espace entre deux trames (µs)', a.ping5000.ifgUs, 'µs', 'Espace inter-trame de 96 temps bit = 9,6 µs.', dur)}
        {num('res3-tp3-33-5000-total', 'ping -l 5000 : durée totale, début du 1er préambule → fin de la 4e trame (µs)', a.ping5000.totalUs, 'µs', '3 × 1220,8 + 491,2 + 3 × 9,6 = 4182,4 µs.', dur)}
        {num('res3-tp3-33-mystere', 'ping « valeur mystère » : L (octets)', mystery, 'octets', mystery < 18 ? `Trame minimale (57,6 µs) : on compte les octets de bourrage n, L = 18 − n = ${mystery}.` : `L = T/0,8 µs − 54 = ${mystery}.`, 0)}
        {qcm('res3-tp3-33-nb')}
      </Step>

      <Step title="Exercice bonus (ancien DS) — décoder la MAC destination">
        <Bonus seed={seed} />
      </Step>
    </section>
  )
}

/** Éditeur de chronogramme Manchester par demi-bits, vérifié automatiquement */
function Chrono({ id, titre, bytes }: { id: string; titre: string; bytes: readonly number[] }) {
  const target = halvesOf(bytes)
  const [cells, setCells] = useState<number[]>(() => Array.from(target, () => 0))
  const [res, setRes] = useState<number | null>(null)
  const check = () => {
    const wrong = cells.filter((c, i) => c !== target[i]).length
    recordAttempt(id, wrong === 0)
    setRes(wrong)
  }
  const bits = Array.from({ length: target.length / 2 }, (_, i) => target[2 * i + 1])
  return (
    <div className="rounded-card bg-card p-4 ring-1 ring-line">
      <p className="text-sm font-medium">{titre}</p>
      <div className="mt-2 grid gap-2">
        {Array.from({ length: bytes.length }, (_, byte) => (
          <div key={byte} className="flex flex-wrap" role="group" aria-label={`Octet ${byte + 1}, 16 demi-bits`}>
            {cells.slice(16 * byte, 16 * byte + 16).map((c, k) => {
              const i = 16 * byte + k
              return (
                <button
                  key={i}
                  type="button"
                  aria-pressed={c === 1}
                  aria-label={`Demi-bit ${i + 1} : ${c ? 'haut' : 'bas'}`}
                  onClick={() => {
                    setCells(cells.map((x, j) => (j === i ? 1 - x : x)))
                    setRes(null)
                  }}
                  className={`relative h-11 w-[18px] border-line ${k % 2 === 0 ? 'border-l' : 'border-l border-dashed'} ${res !== null && c !== target[i] ? 'bg-err/15' : ''}`}
                >
                  <span className={`absolute inset-x-0 h-0.5 bg-ink ${c ? 'top-1' : 'bottom-1'}`} />
                </button>
              )
            })}
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Btn onClick={check}>Vérifier</Btn>
        {res === 0 && <span className="text-sm text-ok">Juste.</span>}
        {res !== null && res > 0 && <span className="text-sm text-err">{res} demi-bit(s) faux (surlignés).</span>}
      </div>
      {res !== null && (
        <p className="mt-2 font-mono text-xs text-muted">
          Bits émis (poids faible en premier) : {bits.join('')} ⇒ demi-bits {Array.from(target).join('')}
        </p>
      )}
    </div>
  )
}

/** Vérification des réglages de 3.1 à partir de l'état de l'oscilloscope */
function ScopeCheck({ scope }: { scope: ScopeSettings | null }) {
  const [res, setRes] = useState<string[] | null>(null)
  const check = () => {
    if (!scope) return
    const ko = checkScope31(scope)
    recordAttempt('res3-tp3-31', ko.length === 0)
    setRes(ko)
  }
  return (
    <div className="rounded-card bg-card p-4 ring-1 ring-line">
      <Btn onClick={check}>Faire vérifier mes réglages</Btn>
      {res && res.length === 0 && <p className="mt-2 text-sm text-ok">Réglages conformes à la consigne.</p>}
      {res && res.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-sm text-err">
          {res.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Bonus : chronogramme commençant dans le préambule, saisir le 1er octet de la MAC destination en hexadécimal */
function Bonus({ seed }: { seed: number }) {
  const { halves, macByte } = bonusExercise(seed)
  const [input, setInput] = useState('')
  const [res, setRes] = useState<boolean | null>(null)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const v = parseInt(input.trim().replace(/h$/i, '').replace(/^0x/i, ''), 16)
    const ok = v === macByte
    recordAttempt('res3-tp3-bonus', ok)
    setRes(ok)
  }
  const w = 6
  const pts = Array.from(halves, (h, i) => `${i * w},${h ? 6 : 34} ${(i + 1) * w},${h ? 6 : 34}`).join(' ')
  return (
    <form onSubmit={submit} className="rounded-card bg-card p-4 text-sm ring-1 ring-line">
      <p>Relevé sur le coax (haut = −0,25 V, bas = −1,75 V, 50 ns par demi-bit). Il commence quelque part dans le préambule. Donnez le 1er octet de la MAC destination.</p>
      <div className="mt-2 overflow-x-auto">
        <svg width={halves.length * w} height="40" className="text-ink" role="img" aria-label="Chronogramme Manchester à décoder">
          <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="ex. A4" className="min-h-11 w-24 rounded-lg bg-field px-2 font-mono ring-1 ring-line" aria-label="Premier octet de la MAC destination, en hexadécimal" />
        <span className="font-mono text-muted">h</span>
        <button type="submit" className="min-h-11 rounded-lg bg-card-2 px-4 text-sm ring-1 ring-line hover:ring-accent">
          Valider
        </button>
        {res !== null && <span className={res ? 'text-ok' : 'text-err'}>{res ? 'Juste.' : 'Faux.'}</span>}
      </div>
      {res !== null && (
        <p className="mt-2 text-xs text-muted">
          Repérez le « 11 » qui termine le SFD ; les 8 bits suivants (lus au milieu de chaque bit : front montant = 1) sont émis poids faible en premier. Réponse : {macByte.toString(16).toUpperCase().padStart(2, '0')}h ={' '}
          {macByte.toString(2).padStart(8, '0')} (bits sur le câble : {macByte.toString(2).padStart(8, '0').split('').reverse().join('')}).
        </p>
      )}
    </form>
  )
}

function Step({ title, conseil, children }: { title: string; conseil?: string; children: ReactNode }) {
  return (
    <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-3">
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 text-sm">{children}</div>
      {conseil && (
        <details className="rounded-lg bg-card-2 p-3 text-sm ring-1 ring-line">
          <summary className="min-h-11 cursor-pointer font-medium">Réglages d’oscilloscope conseillés</summary>
          <p className="mt-1 font-mono text-xs">{conseil}</p>
        </details>
      )}
    </div>
  )
}

/** Schéma simplifié : PC et TSX en dérivation sur le coax (Té), bouchons 50 Ω aux extrémités, oscillo sur un Té */
function SchemaSalle({ bouchon }: { bouchon: boolean }) {
  const taps = [40, 90, 140, 190, 240]
  return (
    <svg viewBox="0 0 320 100" className="w-full text-ink" role="img" aria-label={`Bus coaxial 10Base2 avec PC, TSX 57 et oscilloscope ; bouchon droit ${bouchon ? 'en place' : 'retiré'}`}>
      <g fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M14 60 H306" />
        <rect x="4" y="54" width="10" height="12" />
        {bouchon ? <rect x="306" y="54" width="10" height="12" /> : <path d="M306 54 v12" strokeDasharray="2 2" />}
        {taps.map((x) => (
          <path key={x} d={`M${x} 60 V40`} />
        ))}
        {taps.slice(0, 4).map((x) => (
          <rect key={x} x={x - 14} y="22" width="28" height="18" rx="2" />
        ))}
        <rect x="226" y="22" width="28" height="18" rx="2" />
      </g>
      {['PC', 'PC', 'PC', 'TSX'].map((t, i) => (
        <text key={i} x={taps[i] - 10} y="35" className="fill-current text-[9px]">
          {t}
        </text>
      ))}
      <text x="228" y="35" className="fill-current text-[9px]">
        Oscillo
      </text>
      <text x="4" y="86" className="fill-current text-[9px]">
        50 Ω
      </text>
      <text x="270" y="86" className="fill-current text-[9px]">
        {bouchon ? '50 Ω' : 'ouvert (15 m)'}
      </text>
      <text x="110" y="86" className="fill-current text-[9px]">
        coax RG58 ≈ {ETH10B2.lSalle} m
      </text>
    </svg>
  )
}

