/**
 * Réseaux RES3 · TP1 câble coaxial : banc (générateur → Té CH1 → câble enroulé → extrémité) et parcours guidé
 * dans l'ordre du fascicule. Physique : src/lib/reseaux/coax.ts ; attendus : src/lib/reseaux/tp1.ts.
 */
import { useMemo, useState, type ReactNode } from 'react'
import QuestionCard from '../../components/QuestionCard'
import { RES3 } from '../../data/reference'
import { RES3_TP1_COURS, RES3_TP1_QUESTIONS } from '../../data/questions'
import { ExamContext, type ExamApi } from '../../lib/exam'
import { formatSI } from '../../lib/format'
import { parseAnswer } from '../../lib/grading'
import { useProgress } from '../../lib/progress'
import { generateCable } from '../../lib/reseaux/coax'
import { gammasTheoriques, tp1Attendus, tp1Conseils, type Conseil } from '../../lib/reseaux/tp1'
import Layout from '../../modbus/pages/Layout'
import { Link } from 'react-router'
import CoaxBench from './CoaxBench'
import { checkMontage, topology, type ExpectedMontage, type Topology } from '../../lib/reseaux/benchTopology'
import { Btn, Card } from './ui'

const SEED_KEY = 'tp-sim:res3-tp1:seed'
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
  // Montage réalisé sur le banc, vérifié à chaque étape du parcours
  const [topo, setTopo] = useState<Topology>(() => topology({}))
  const cable = useMemo(() => generateCable(seed), [seed])
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
        <p className="mt-2 flex flex-wrap gap-2 text-sm">
          <Link to="/modbus/partiel-reseaux?demo=cable50" className="inline-flex min-h-11 items-center rounded-lg px-3 ring-1 ring-line hover:ring-accent">
            Voir la démonstration (câble 50 Ω)
          </Link>
          <Link to="/modbus/partiel-reseaux?demo=cable75" className="inline-flex min-h-11 items-center rounded-lg px-3 ring-1 ring-line hover:ring-accent">
            Démonstration câble 75 Ω
          </Link>
        </p>

        <CoaxBench
          cable={cable}
          seed={seed}
          onTopology={setTopo}
          top={
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
          }
        />

        <Parcours seed={seed} topo={topo} />
      </main>
    </ExamContext.Provider>
    </Layout>
  )
}

/* ─────────── Parcours guidé ─────────── */

function Parcours({ seed, topo }: { seed: number; topo: Topology }) {
  const cable = generateCable(seed)
  const M = (title: string, e: ExpectedMontage) => <MontageCheck title={title} errors={checkMontage(topo, e, cable.Zc)} />
  const a = tp1Attendus(cable)
  const k = tp1Conseils(cable)
  const g = gammasTheoriques(cable.Zc)
  const gg = (RES3.zg - cable.Zc) / (RES3.zg + cable.Zc)
  const hypV = ['RES3.v']
  const hypAlpha = ['RES3.cables']
  const hypPeau = ['RES3.ECHO_RATIO_100M']
  const qcm = (id: string) => <QuestionCard id={id} kind="choix" statement={RES3_TP1_COURS[id].statement} choices={RES3_TP1_COURS[id].choices} correct={RES3_TP1_COURS[id].correct} explanation={RES3_TP1_COURS[id].explanation} />
  const num = (
    id: string,
    statement: string,
    expected: number,
    unit: string,
    explanation: string,
    extra?: { tolerance?: number; unverified?: string[]; check?: (v: number) => boolean; toleranceLabel?: string },
  ) => (
    <QuestionCard
      id={id}
      statement={statement}
      expected={expected}
      unit={unit}
      explanation={explanation}
      tolerance={extra?.tolerance ?? RES3.tolMesure}
      unverified={extra?.unverified}
      check={extra?.check}
      toleranceLabel={extra?.toleranceLabel}
    />
  )

  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold">Parcours guidé</h2>
      <p className="mt-1 text-sm text-muted">Dans l’ordre du fascicule. Les réponses attendues sont calculées pour le câble tiré (graine {seed}).</p>

      <Step title="3.2.2 a — Générateur à vide" conseil={k.a}>
        <p>Branchez le cordon de 1 m de la sortie du générateur directement sur CH1, sans le câble long. Réglez le générateur : impulsions de 8 V à vide, 40 ns, période 1 ms. Mesurez Eg sur CH1.</p>
        {M('générateur → cordon → CH1', { kind: 'vide' })}
        {num('res3-tp1-a-eg', 'Eg lue à vide sur CH1 (V)', a.egVide, 'V', `Eg·1 MΩ/(1 MΩ + 50 Ω) = ${n3(a.egVide)} V. Le petit palier de ≈ 10 ns au début est l’aller-retour dans le cordon de 1 m (2·1 m / v).`)}
        {qcm('res3-tp1-a-rin')}
      </Step>

      <Step title="3.2.2 b — Extrémité ouverte" conseil={k.b}>
        <p>Montez un Té sur CH1. Reliez la sortie du générateur à un bras du Té par le cordon, et le câble long à l’autre bras ; laissez l’autre bout du câble ouvert. Relevez l’impulsion incidente et l’écho ; mesurez leurs amplitudes et le retard entre eux.</p>
        {M('générateur → Té sur CH1 → câble → extrémité ouverte', { kind: 'ligne', end: 'ouverte' })}
        {qcm('res3-tp1-b-gamma')}
        {num('res3-tp1-b-ei', 'Amplitude incidente Ei sur CH1 (V)', a.Ei, 'V', `Pont diviseur Zg / Zc à l’instant 0 : Ei = Eg·Zc/(Zg + Zc) = 8·${cable.Zc}/(50 + ${cable.Zc}) = ${n3(a.Ei)} V.`)}
        {num(
          'res3-tp1-b-ratio',
          'Rapport V_écho / V_incident mesuré sur CH1',
          a.ratioOpen,
          '',
          `Écho = Ei·(1 + Γg)·ΓL × (crête après 2l de câble) avec ΓL = +1, Γg = ${n3(gg)}. L’effet de peau arrondit et écrase l’impulsion de 40 ns d’autant plus que le câble est long (temps de montée ∝ l²) : rapport = ${n3(a.ratioOpen)}. Il est < 1 à cause des pertes${gg ? ' et du facteur (1 + Γg)' : ''}, mais de même signe que l’incident : Γ = +1.`,
          { unverified: hypPeau },
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
        <p>Mettez l’extrémité en court-circuit : un Té au bout du câble avec le bouchon court-circuit (ou le potentiomètre branché au bout, réglé à 0 Ω). Relevez l’écho.</p>
        {M('… → câble → court-circuit', { kind: 'ligne', end: 'cc' })}
        {qcm('res3-tp1-c-gamma')}
        {num('res3-tp1-c-ratio', 'Rapport V_écho / V_incident mesuré sur CH1 (court-circuit)', a.ratioShort, '', `ΓL = −1 : écho inversé, rapport = −(1 + Γg) × crête après 2l = ${n3(a.ratioShort)}.`, { unverified: hypPeau })}
      </Step>

      <Step title="3.2.2 d — Ligne adaptée" conseil={k.d}>
        <p>
          Branchez le potentiomètre et tournez-le jusqu’à la disparition de l’écho. Débranchez-le et lisez sa valeur à l’ohmmètre : c’est Zc (méthode 2). Si l’écart avec la méthode 1 dépasse 10 %, refaites les
          mesures. Remplacez ensuite le potentiomètre par le bouchon de même valeur, puis vérifiez avec le Té vers CH2.
        </p>
        {M('1. … → câble → potentiomètre', { kind: 'ligne', end: 'pot' })}
        {M(`2. … → câble → Té avec bouchon ${cable.Zc} Ω et CH2`, { kind: 'ligne', end: 'zc+ch2' })}
        {num('res3-tp1-d-zc', 'Zc, méthode 2 : valeur du potentiomètre à l’adaptation (Ω)', cable.Zc, 'Ω', `ΓL = (R − Zc)/(R + Zc) = 0 ⇔ R = Zc = ${cable.Zc} Ω (Γ adapté = ${g.adapte}).`)}
        <EcartZc seed={seed} />
        {qcm('res3-tp1-d-ch2')}
      </Step>

      <Step title="3.2.2 e — Régime sinusoïdal à 5 MHz" conseil={k.e} conseilTexte="CH1 et CH2 au même calibre ; mesures Vpp sur les deux voies et Retard 1→2.">
        <p>Ligne adaptée (Té vers CH2 + bouchon Zc). Générateur en sinus, 5 MHz. Mesurez Ve (CH1) et Vs (CH2), puis le déphasage. Prévoyez le déphasage avant de le mesurer.</p>
        {M(`… → câble → Té avec bouchon ${cable.Zc} Ω et CH2`, { kind: 'ligne', end: 'zc+ch2' })}
        {qcm('res3-tp1-e-sinus')}
        {num(
          'res3-tp1-e-alpha',
          'Atténuation du câble à 5 MHz (dB/100 m)',
          a.alphaSinus,
          'dB/100 m',
          `A = 20·log(Ve/Vs) sur ${cable.l} m, ramené à 100 m : α = A·100/l ≈ ${n3(a.alphaSinus)} dB/100 m (${cable.type}). Précision limitée par la lecture des Vpp (CAN 8 bits, bruit).`,
          { tolerance: RES3.tolSpires, unverified: hypAlpha },
        )}
        {num('res3-tp1-e-phase', 'Déphasage de Vs sur Ve, dans [0 ; 360[ (°)', a.phase, '°', `φ = 360·f·l/v mod 360 = 360 × 5·10⁶ × ${cable.l} / 2·10⁸ mod 360 = ${n3(a.phase)}°. L’oscillo mesure Δt modulo la période (200 ns).`, {
          unverified: hypV,
          // ±5° en absolu, modulo 360° (2° et 358° sont à 4° l'un de l'autre)
          check: (v) => Math.abs(((v - a.phase + 540) % 360) - 180) <= RES3.tolPhaseDeg,
          toleranceLabel: `tolérance ±${RES3.tolPhaseDeg}°`,
        })}
      </Step>

      <Step title="3.2.3 — Étude basse fréquence" conseil={k.bfLent} conseilTexte={`Puis base rapide : ${conseilTxt(k.bfRapide)}`}>
        <p>Impulsions de 100 µs (période 1 ms). Observez d’abord à base de temps lente, puis rapide autour du front montant, en court-circuit, en ouvert et adapté.</p>
        {M('… → câble → extrémité ouverte (puis court-circuit, puis bouchon Zc)', { kind: 'ligne', end: 'ouverte' })}
        {num('res3-tp1-bf-open', 'Tension finale sur CH1, extrémité ouverte (V)', a.bfOpen, 'V', `Escalier convergeant vers Eg·ZL/(Zg + ZL) → Eg = ${n3(a.bfOpen)} V (ZL → ∞).`)}
        {num('res3-tp1-bf-short', 'Tension finale sur CH1, court-circuit (V)', a.bfShort, 'V', `Eg·0/(Zg + 0) = 0 V.`, { tolerance: RES3.tolMesure })}
        {num('res3-tp1-bf-adapte', 'Tension sur CH1, ligne adaptée (V)', a.bfAdapte, 'V', `Eg·Zc/(Zg + Zc) = ${n3(a.bfAdapte)} V, constante dès le début : aucune réflexion.`)}
        {num('res3-tp1-bf-2tau', 'En court-circuit, durée pendant laquelle CH1 ≠ 0 au début de l’impulsion (s)', a.dt, 's', `Le câble n’est pas équipotentiel pendant 2τ = ${fr(a.dt, 's')} : CH1 vaut Ei jusqu’au retour de l’onde réfléchie.`, { unverified: hypV })}
        {qcm('res3-tp1-bf-conclusion')}
      </Step>
    </section>
  )
}

/** Montage attendu d'une étape, comparé au banc : ✓ ou liste des écarts */
function MontageCheck({ title, errors }: { title: string; errors: string[] }) {
  const ok = errors.length === 0
  return (
    <div className={`flex gap-3 rounded-card p-3 text-sm ring-1 ${ok ? 'bg-ok/10 ring-ok/30' : 'bg-card ring-line'}`} role="status" aria-live="polite">
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${ok ? 'bg-ok' : 'bg-err'}`} aria-hidden="true">
        {ok ? '✓' : '✗'}
      </span>
      <div className="min-w-0">
        <p>
          <span className="text-muted">Montage attendu : </span>
          <b>{title}</b> {ok ? <span className="text-ok">— conforme</span> : <span className="sr-only">— non conforme</span>}
        </p>
        {!ok && (
          <ul className="mt-1 list-disc pl-5 text-xs text-muted">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/** Écart entre les deux méthodes de Zc, lu dans les réponses saisies (étapes b et d) */
function EcartZc({ seed }: { seed: number }) {
  const [res, setRes] = useState<number | null | 'vide'>(null)
  const read = (id: string) => {
    try {
      const raw = localStorage.getItem(`tp-sim:state:res3-tp1:${seed}:${id}:input`)
      return raw === null ? NaN : parseAnswer(JSON.parse(raw) as string)
    } catch {
      return NaN
    }
  }
  const compare = () => {
    const [z1, z2] = [read('res3-tp1-b-zc'), read('res3-tp1-d-zc')]
    setRes(Number.isFinite(z1) && Number.isFinite(z2) && z1 > 0 ? Math.abs(z2 - z1) / z1 : 'vide')
  }
  return (
    <div className="rounded-card bg-card p-4 text-sm ring-1 ring-line">
      <div className="flex flex-wrap items-center gap-3">
        <span>Écart entre la méthode 1 (amplitude) et la méthode 2 (potentiomètre)</span>
        <Btn onClick={compare}>Comparer mes deux valeurs</Btn>
      </div>
      {res === 'vide' && <p className="mt-2 text-muted">Saisissez d’abord Zc par les deux méthodes (3.2.2 b et ci-dessus).</p>}
      {typeof res === 'number' && (
        <p className={`mt-2 ${res > RES3.ecartMethodes ? 'text-err' : 'text-ok'}`}>
          Écart {(res * 100).toFixed(1).replace('.', ',')} %
          {res > RES3.ecartMethodes
            ? ' : plus de 10 %, refaire la mesure. Causes fréquentes : potentiomètre mal réglé (un petit écho subsiste, de signe donné par R − Zc), curseurs mal placés sur Ei ou sur Eg, Eg pas réellement à 8 V à vide.'
            : ' : moins de 10 %, les deux méthodes concordent.'}
        </p>
      )}
    </div>
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

