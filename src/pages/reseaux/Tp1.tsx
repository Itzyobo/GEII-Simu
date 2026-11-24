/**
 * Réseaux RES3 · TP1 câble coaxial : banc (générateur → Té CH1 → câble enroulé → extrémité) et parcours guidé
 * dans l'ordre du fascicule. Physique : src/lib/reseaux/coax.ts ; attendus : src/lib/reseaux/tp1.ts.
 */
import { useMemo, useState, type ReactNode } from 'react'
import Knob from '../../components/Knob'
import QuestionCard from '../../components/QuestionCard'
import ScopeInstrument from '../../components/ScopeInstrument'
import { OSCILLO, RES3 } from '../../data/reference'
import { RES3_TP1_COURS, RES3_TP1_QUESTIONS } from '../../data/questions'
import { mulberry32 } from '../../au3/sim/prng'
import { ExamContext, type ExamApi } from '../../lib/exam'
import { formatSI } from '../../lib/format'
import { useProgress } from '../../lib/progress'
import { alphaAt, coaxSources, generateCable, termsSource, type Waveform } from '../../lib/reseaux/coax'
import { gammasTheoriques, tp1Attendus, tp1Conseils, type Conseil } from '../../lib/reseaux/tp1'
import type { SignalSource } from '../../lib/scope/types'
import Layout from '../../modbus/pages/Layout'

type Extremite = 'ouverte' | 'cc' | 'pot' | 'b50' | 'b75' | 'ch2'
const EXTREMITES: [Extremite, string][] = [
  ['ouverte', 'Ouverte'],
  ['cc', 'Court-circuit'],
  ['pot', 'Potentiomètre 0–200 Ω'],
  ['b50', 'Bouchon 50 Ω'],
  ['b75', 'Bouchon 75 Ω'],
  ['ch2', 'Té vers CH2 + bouchon'],
]
const SEED_KEY = 'tp-sim:res3-tp1:seed'
const par = (a: number, b: number) => (a * b) / (a + b)
const fr = (v: number, unit: string, d = 3) => formatSI(v, unit, d)
const n3 = (v: number) => String(Number(v.toPrecision(3))).replace('.', ',')
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

export default function Tp1() {
  const [seed, setSeedState] = useState(loadSeed)
  const setSeed = (s: number) => {
    setSeedState(s)
    setReveal(false)
    try {
      localStorage.setItem(SEED_KEY, String(s))
    } catch {
      /* stockage indisponible : graine en mémoire */
    }
  }
  const [reveal, setReveal] = useState(false)
  const cable = useMemo(() => generateCable(seed), [seed])
  const [gen, setGen] = useState<{ on: boolean; mode: 'pulse' | 'sine'; eg: number; width: number; period: number; f: number }>({
    on: true,
    mode: 'pulse',
    eg: RES3.genInitial.eg,
    width: RES3.genInitial.largeur,
    period: RES3.genInitial.periode,
    f: RES3.genInitial.f,
  })
  const [ext, setExt] = useState<Extremite>('ouverte')
  const [bouchonCh2, setBouchonCh2] = useState<50 | 75>(50)
  const [pot, setPot] = useState({ R: 120, connecte: true })
  const [aVide, setAVide] = useState(false)

  const ZL = { ouverte: Infinity, cc: 0, pot: pot.connecte ? pot.R : Infinity, b50: 50, b75: 75, ch2: par(bouchonCh2, OSCILLO.rEntree) }[ext]
  const sources = useMemo((): [SignalSource | null, SignalSource | null] => {
    const wave: Waveform = gen.mode === 'pulse' ? { kind: 'pulse', width: Math.min(gen.width, gen.period / 2), period: gen.period } : { kind: 'sine', f: gen.f }
    if (!gen.on) return [termsSource([], wave), ext === 'ch2' && !aVide ? termsSource([], wave) : null]
    if (aVide) return [coaxSources({ Eg: gen.eg, Zc: RES3.cables.RG58.zc, l: RES3.lCordon, ZL: OSCILLO.rEntree, alpha: 0, wave }).ch1, null]
    const c = RES3.cables[cable.type]
    const alpha = gen.mode === 'pulse' ? c.alpha10M : alphaAt(c, gen.f)
    const s = coaxSources({ Eg: gen.eg, Zc: cable.Zc, l: cable.l, ZL, alpha, wave })
    return [s.ch1, ext === 'ch2' ? s.end : null]
  }, [gen, aVide, cable, ZL, ext])

  // Ohmmètre : lisible seulement potentiomètre débranché, ±0,5 % (écart propre à la valeur réglée)
  const ohm = pot.connecte ? null : pot.R * (1 + (2 * mulberry32(seed + Math.round(pot.R * 10))() - 1) * RES3.ohmmetreTol)

  const exam = useMemo<ExamApi>(() => ({ active: false, record: () => {}, answerOf: () => undefined, register: () => {}, penalize: () => {}, scope: `res3-tp1:${seed}` }), [seed])
  const progress = useProgress()
  const done = RES3_TP1_QUESTIONS.filter((q) => progress.questions[q.id]?.success).length

  return (
    <Layout>
    <ExamContext.Provider value={exam}>
      <main className="mx-auto max-w-7xl px-4 py-8">
        <p className="text-xs font-semibold tracking-[0.2em] text-muted">RÉSEAUX · TP1</p>
        <h1 className="mt-1 text-2xl font-bold">Câble coaxial : réflexions, impédance caractéristique, atténuation</h1>
        <p className="mt-1 text-sm text-muted">
          Questions réussies : {done} / {RES3_TP1_QUESTIONS.length}. Tout se règle à la main : générateur et oscilloscope démarrent sur leurs réglages par défaut.
        </p>

        <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          <div className="grid content-start gap-4">
            <Card title="Câble mystère">
              <p className="text-sm">
                Graine <span className="font-mono">{seed}</span> · enroulement de <b>{cable.N} spires</b>, diamètre <b>{fr(cable.D, 'm')}</b>
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Btn onClick={() => setSeed(newSeed())}>Nouveau câble</Btn>
                <Btn onClick={() => setReveal(!reveal)} pressed={reveal}>
                  {reveal ? 'Masquer' : 'Révéler (entraînement)'}
                </Btn>
              </div>
              {reveal && (
                <p className="mt-2 text-sm text-warn">
                  {cable.type} · Zc = {cable.Zc} Ω · l = {cable.l} m
                </p>
              )}
            </Card>

            <Card title="Générateur d’impulsions (Zg = 50 Ω)">
              <div className="flex flex-wrap items-center gap-2">
                <Btn onClick={() => setGen({ ...gen, on: !gen.on })} pressed={gen.on}>
                  Sortie {gen.on ? 'ON' : 'OFF'}
                </Btn>
                <Btn onClick={() => setGen({ ...gen, mode: 'pulse' })} pressed={gen.mode === 'pulse'}>
                  Impulsions
                </Btn>
                <Btn onClick={() => setGen({ ...gen, mode: 'sine' })} pressed={gen.mode === 'sine'}>
                  Sinus
                </Btn>
              </div>
              <div className="mt-2 flex flex-wrap gap-3">
                <Knob label="Amplitude à vide" value={gen.eg} onChange={(eg) => setGen({ ...gen, eg })} unit="V" min={0} max={10} step={0.05} />
                {gen.mode === 'pulse' ? (
                  <>
                    <Knob label="Largeur" value={gen.width} onChange={(width) => setGen({ ...gen, width })} unit="s" min={10e-9} max={1e-3} step={1e-9} log />
                    <Knob label="Période" value={gen.period} onChange={(period) => setGen({ ...gen, period })} unit="s" min={1e-6} max={1} step={1e-7} log />
                  </>
                ) : (
                  <Knob label="Fréquence" value={gen.f} onChange={(f) => setGen({ ...gen, f })} unit="Hz" min={1e3} max={20e6} step={1e3} log />
                )}
              </div>
            </Card>

            <Card title="Montage">
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" checked={aVide} onChange={(e) => setAVide(e.target.checked)} className="h-4 w-4" />
                Générateur à vide (cordon court de 1 m direct sur CH1, sans le câble)
              </label>
              <Schema cable={cable} ext={ext} aVide={aVide} />
              <fieldset disabled={aVide} className="mt-2 grid gap-1 disabled:opacity-40">
                <legend className="text-xs text-muted">Extrémité du câble</legend>
                {EXTREMITES.map(([k, label]) => (
                  <label key={k} className="flex min-h-11 items-center gap-2 text-sm">
                    <input type="radio" name="ext" checked={ext === k} onChange={() => setExt(k)} className="h-4 w-4" />
                    {label}
                  </label>
                ))}
              </fieldset>
              {ext === 'ch2' && !aVide && (
                <div className="mt-1 flex gap-2">
                  {([50, 75] as const).map((b) => (
                    <Btn key={b} onClick={() => setBouchonCh2(b)} pressed={bouchonCh2 === b}>
                      Bouchon {b} Ω
                    </Btn>
                  ))}
                </div>
              )}
              {ext === 'pot' && !aVide && (
                <div className="mt-2 flex flex-wrap items-end gap-3 rounded-lg bg-card-2 p-2">
                  <Knob label="Potentiomètre" value={pot.R} onChange={(R) => setPot({ ...pot, R })} unit="Ω" min={0} max={RES3.potMax} step={0.5} />
                  <Btn onClick={() => setPot({ ...pot, connecte: !pot.connecte })} pressed={pot.connecte}>
                    {pot.connecte ? 'Branché sur le câble' : 'Débranché'}
                  </Btn>
                  <div className="font-mono text-sm">
                    Ohmmètre : {ohm === null ? <span className="text-muted">débranchez le potentiomètre</span> : `${ohm.toFixed(1).replace('.', ',')} Ω`}
                  </div>
                </div>
              )}
            </Card>
          </div>
          <ScopeInstrument sources={sources} />
        </section>

        <Parcours seed={seed} />
      </main>
    </ExamContext.Provider>
    </Layout>
  )
}

/* ─────────── Parcours guidé ─────────── */

function Parcours({ seed }: { seed: number }) {
  const cable = generateCable(seed)
  const a = tp1Attendus(cable)
  const k = tp1Conseils(cable)
  const g = gammasTheoriques(cable.Zc)
  const gg = (RES3.zg - cable.Zc) / (RES3.zg + cable.Zc)
  const alpha10 = RES3.cables[cable.type].alpha10M
  const hypV = ['RES3.v']
  const hypAlpha = ['RES3.cables']
  const qcm = (id: string) => <QuestionCard id={id} kind="choix" statement={RES3_TP1_COURS[id].statement} choices={RES3_TP1_COURS[id].choices} correct={RES3_TP1_COURS[id].correct} explanation={RES3_TP1_COURS[id].explanation} />
  const num = (id: string, statement: string, expected: number, unit: string, explanation: string, extra?: { tolerance?: number; unverified?: string[] }) => (
    <QuestionCard id={id} statement={statement} expected={expected} unit={unit} explanation={explanation} tolerance={extra?.tolerance ?? RES3.tolMesure} unverified={extra?.unverified} />
  )

  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold">Parcours guidé</h2>
      <p className="mt-1 text-sm text-muted">Dans l’ordre du fascicule. Les réponses attendues sont calculées pour le câble tiré (graine {seed}).</p>

      <Step title="3.2.2 a — Générateur à vide" conseil={k.a}>
        <p>Cochez « générateur à vide ». Réglez le générateur : impulsions de 8 V à vide, 40 ns, période 1 ms. Mesurez Eg sur CH1.</p>
        {num('res3-tp1-a-eg', 'Eg lue à vide sur CH1 (V)', a.egVide, 'V', `Eg·1 MΩ/(1 MΩ + 50 Ω) = ${n3(a.egVide)} V. Le petit palier de ≈ 10 ns au début est l’aller-retour dans le cordon de 1 m (2·1 m / v).`)}
        {qcm('res3-tp1-a-rin')}
      </Step>

      <Step title="3.2.2 b — Extrémité ouverte" conseil={k.b}>
        <p>Branchez le câble, extrémité ouverte. Relevez l’impulsion incidente et l’écho ; mesurez leurs amplitudes et le retard entre eux.</p>
        {qcm('res3-tp1-b-gamma')}
        {num('res3-tp1-b-ei', 'Amplitude incidente Ei sur CH1 (V)', a.Ei, 'V', `Pont diviseur Zg / Zc à l’instant 0 : Ei = Eg·Zc/(Zg + Zc) = 8·${cable.Zc}/(50 + ${cable.Zc}) = ${n3(a.Ei)} V.`)}
        {num(
          'res3-tp1-b-ratio',
          'Rapport V_écho / V_incident mesuré sur CH1',
          a.ratioOpen,
          '',
          `Écho = Ei·(1 + Γg)·ΓL·A² avec ΓL = +1, Γg = ${n3(gg)}, A² = 10^(−2·α·l/100/20) (α ≈ ${alpha10} dB/100 m à 10 MHz) : rapport = ${n3(a.ratioOpen)}. Il est < 1 à cause des pertes${gg ? ' et du facteur (1 + Γg)' : ''}, mais de même signe que l’incident : Γ = +1.`,
          { unverified: hypAlpha },
        )}
        {num('res3-tp1-b-dt', 'Retard de l’écho sur l’incident Δt (s)', a.dt, 's', `Δt = 2τ = 2l/v = ${fr(a.dt, 's')}.`, { unverified: hypV })}
        {num('res3-tp1-b-l', 'Longueur du câble l = v·Δt/2 (m)', cable.l, 'm', `l = 2·10⁸ × ${fr(a.dt, 's')} / 2 = ${cable.l} m.`, { unverified: hypV })}
        {num('res3-tp1-b-spires', 'Longueur estimée par les spires N·π·D (m)', a.lSpires, 'm', `N·π·D = ${cable.N}·π·${n3(cable.D)} = ${n3(a.lSpires)} m : cohérent avec la mesure à ±8 % près (enroulement irrégulier).`, { tolerance: RES3.tolSpires })}
        {num(
          'res3-tp1-b-zc',
          'Zc, méthode 1 : Zc = Zg·Ei/(Eg − Ei) (Ω)',
          cable.Zc,
          'Ω',
          `Schéma équivalent à t = 0⁺ : le câble se comporte comme une résistance Zc en série avec Zg. Zc = 50·${n3(a.Ei)}/(8 − ${n3(a.Ei)}) = ${cable.Zc} Ω.`,
        )}
      </Step>

      <Step title="3.2.2 c — Court-circuit" conseil={k.c}>
        <p>Mettez l’extrémité en court-circuit (ou le potentiomètre branché, réglé à 0 Ω). Relevez l’écho.</p>
        {qcm('res3-tp1-c-gamma')}
        {num('res3-tp1-c-ratio', 'Rapport V_écho / V_incident mesuré sur CH1 (court-circuit)', a.ratioShort, '', `ΓL = −1 : écho inversé, rapport = −(1 + Γg)·A² = ${n3(a.ratioShort)}.`, { unverified: hypAlpha })}
      </Step>

      <Step title="3.2.2 d — Ligne adaptée" conseil={k.d}>
        <p>
          Branchez le potentiomètre et tournez-le jusqu’à la disparition de l’écho. Débranchez-le et lisez sa valeur à l’ohmmètre : c’est Zc (méthode 2). Si l’écart avec la méthode 1 dépasse 10 %, refaites les
          mesures. Remplacez ensuite le potentiomètre par le bouchon de même valeur, puis vérifiez avec le Té vers CH2.
        </p>
        {num('res3-tp1-d-zc', 'Zc, méthode 2 : valeur du potentiomètre à l’adaptation (Ω)', cable.Zc, 'Ω', `ΓL = (R − Zc)/(R + Zc) = 0 ⇔ R = Zc = ${cable.Zc} Ω (Γ adapté = ${g.adapte}).`)}
        {qcm('res3-tp1-d-ch2')}
      </Step>

      <Step title="3.2.2 e — Régime sinusoïdal à 5 MHz" conseil={k.e} conseilTexte="CH1 et CH2 au même calibre ; mesures Vpp sur les deux voies et Retard 1→2.">
        <p>Ligne adaptée (Té vers CH2 + bouchon Zc). Générateur en sinus, 5 MHz. Mesurez Ve (CH1) et Vs (CH2), puis le déphasage. Prévoyez le déphasage avant de le mesurer.</p>
        {qcm('res3-tp1-e-sinus')}
        {num(
          'res3-tp1-e-alpha',
          'Atténuation du câble à 5 MHz (dB/100 m)',
          a.alphaSinus,
          'dB/100 m',
          `A = 20·log(Ve/Vs) sur ${cable.l} m, ramené à 100 m : α = A·100/l ≈ ${n3(a.alphaSinus)} dB/100 m (${cable.type}). Précision limitée par la lecture des Vpp (CAN 8 bits, bruit).`,
          { tolerance: RES3.tolSpires, unverified: hypAlpha },
        )}
        {num('res3-tp1-e-phase', 'Déphasage de Vs sur Ve, dans [0 ; 360[ (°)', a.phase, '°', `φ = 360·f·l/v mod 360 = 360 × 5·10⁶ × ${cable.l} / 2·10⁸ mod 360 = ${n3(a.phase)}°. L’oscillo mesure Δt modulo la période (200 ns).`, { unverified: hypV })}
      </Step>

      <Step title="3.2.3 — Étude basse fréquence" conseil={k.bfLent} conseilTexte={`Puis base rapide : ${conseilTxt(k.bfRapide)}`}>
        <p>Impulsions de 100 µs (période 1 ms). Observez d’abord à base de temps lente, puis rapide autour du front montant, en court-circuit, en ouvert et adapté.</p>
        {num('res3-tp1-bf-open', 'Tension finale sur CH1, extrémité ouverte (V)', a.bfOpen, 'V', `Escalier convergeant vers Eg·ZL/(Zg + ZL) → Eg = ${n3(a.bfOpen)} V (ZL → ∞).`)}
        {num('res3-tp1-bf-short', 'Tension finale sur CH1, court-circuit (V)', a.bfShort, 'V', `Eg·0/(Zg + 0) = 0 V.`, { tolerance: RES3.tolMesure })}
        {num('res3-tp1-bf-adapte', 'Tension sur CH1, ligne adaptée (V)', a.bfAdapte, 'V', `Eg·Zc/(Zg + Zc) = ${n3(a.bfAdapte)} V, constante dès le début : aucune réflexion.`)}
        {num('res3-tp1-bf-2tau', 'En court-circuit, durée pendant laquelle CH1 ≠ 0 au début de l’impulsion (s)', a.dt, 's', `Le câble n’est pas équipotentiel pendant 2τ = ${fr(a.dt, 's')} : CH1 vaut Ei jusqu’au retour de l’onde réfléchie.`, { unverified: hypV })}
        {qcm('res3-tp1-bf-conclusion')}
      </Step>
    </section>
  )
}

const conseilTxt = (c: Conseil) => `${fr(c.vdiv, 'V')}/div · ${fr(c.sdiv, 's')}/div · retard ${fr(c.delay, 's')} · ${c.mode}, front montant CH1 à ${fr(c.niveau, 'V')}`

function Step({ title, conseil, conseilTexte, children }: { title: string; conseil: Conseil; conseilTexte?: string; children: ReactNode }) {
  return (
    <div className="mt-6 grid gap-3">
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="grid gap-3 text-sm">{children}</div>
      <details className="rounded-lg bg-card-2 p-3 text-sm ring-1 ring-line">
        <summary className="min-h-11 cursor-pointer font-medium">Réglages d’oscilloscope conseillés</summary>
        <p className="mt-1 font-mono text-xs">{conseilTxt(conseil)}</p>
        {conseilTexte && <p className="mt-1 text-xs text-muted">{conseilTexte}</p>}
      </details>
    </div>
  )
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-card bg-card p-4 ring-1 ring-line">
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      {children}
    </div>
  )
}

function Btn({ onClick, pressed, children }: { onClick: () => void; pressed?: boolean; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={pressed} className={`min-h-11 rounded-lg px-3 text-sm ring-1 ring-line ${pressed ? 'bg-accent text-on-accent' : 'hover:ring-accent'}`}>
      {children}
    </button>
  )
}

/** Schéma du banc : générateur → Té CH1 → câble enroulé → extrémité */
function Schema({ cable, ext, aVide }: { cable: { N: number; D: number }; ext: Extremite; aVide: boolean }) {
  const label = aVide ? 'cordon 1 m' : `${cable.N} spires · D = ${n3(cable.D)} m`
  const end = aVide ? '' : (EXTREMITES.find(([k]) => k === ext)?.[1] ?? '')
  return (
    <svg viewBox="0 0 340 110" className="mt-2 w-full" role="img" aria-label={`Schéma : générateur, Té vers CH1, ${label}, extrémité ${end}`}>
      <g fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink">
        <rect x="4" y="30" width="56" height="40" rx="4" />
        <circle cx="24" cy="50" r="9" />
        <path d="M18 50 h4 v-5 h4 v10 h4" />
        <path d="M60 50 h30" />
        <path d="M90 42 v16 M90 50 h14" />
        <path d="M90 42 v-22 h-10" />
        {aVide ? (
          <path d="M104 50 h40" />
        ) : (
          <>
            <path d="M104 50 h20" />
            {Array.from({ length: 6 }, (_, i) => (
              <ellipse key={i} cx={140 + i * 16} cy="50" rx="10" ry="22" />
            ))}
            <path d="M230 50 h40" />
          </>
        )}
      </g>
      <text x="4" y="86" className="fill-current text-[10px]">
        Gén. Zg = 50 Ω
      </text>
      <text x="62" y="16" className="fill-current text-[10px]">
        CH1 (1 MΩ)
      </text>
      <text x="110" y="100" className="fill-current text-[10px]">
        {label}
      </text>
      {!aVide && (
        <text x="272" y="54" className="fill-current text-[10px]">
          {end.replace('Potentiomètre 0–200 Ω', 'Pot.').replace('Té vers CH2 + bouchon', 'Té CH2')}
        </text>
      )}
    </svg>
  )
}
