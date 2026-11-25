/**
 * Partiel pratique Réseaux (RES3) : 1 h 30, fascicule seul, sans Modbus. Trois parties en onglets (câble coaxial,
 * trame série, ping Ethernet), chacune avec son banc et un oscilloscope en Default Setup. Session en sessionStorage
 * (reprise après rechargement, chrono qui continue), historique en localStorage. Logique : src/lib/reseaux/partiel.ts.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import ScopeInstrument from '../../components/ScopeInstrument'
import { RES3_PARTIEL } from '../../data/reference'
import { formatSI } from '../../lib/format'
import {
  addHistory,
  gradePartiel,
  levelFr,
  loadHistory,
  loadSession,
  METHODES,
  montageIssue,
  withMontageIssue,
  newSession,
  PARTIES,
  remainingS,
  saveSession,
  subjectOf,
  submit,
  switchTab,
  type HistoryEntry,
  type PartielAnswers,
  type PartielSession,
  type PartIndex,
} from '../../lib/reseaux/partiel'
import { parityFr, type Level, type Parity } from '../../lib/reseaux/serial'
import { salleTraffic } from '../../lib/reseaux/traffic'
import Layout from '../../modbus/pages/Layout'
import CoaxBench, { type BenchHandle } from './CoaxBench'
import DemoPlayer from './demo/DemoPlayer'
import { createLiveLab } from './demo/liveLab'
import type { Zone } from '../../lib/demo/lab'
import type { ScopeHandle } from '../../components/scope/useScope'
import { COMPLETE, demoSeedFor, PART_INDEX, partOf, scriptFor, VARIANTS, type Variant } from '../../lib/demo/scripts'

type ScopeRef = ScopeHandle & { setView(v: 'face' | 'compact'): void }
/** Démonstration en cours : variantes à jouer, partie courante, récapitulatif de fin de partie, vitesse */
interface DemoState {
  variants: Variant[]
  i: number
  recap: string[] | null
  speed: number
}

const fr = (v: number, d = 4) => String(Number(v.toPrecision(d))).replace('.', ',')
const clock = (s: number) => {
  const t = Math.max(0, Math.floor(s))
  return `${Math.floor(t / 3600)}:${String(Math.floor((t % 3600) / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}
const minutes = (ms: number) => `${Math.round(ms / 60000)} min`

/** Couleur d'accent de chaque partie (pastilles, barres, liserés) */
const PART_COLORS = ['#f59e0b', '#0ea5e9', '#8b5cf6'] as const
const PART_POINTS = [7, 6, 7] as const
const PART_HINTS = ['Zc, longueur, Γ ouvert et court-circuit', 'Débit, parité, norme, message', 'L, bourrage, durée, MAC destination'] as const
const PART_ICONS: ReactNode[] = [
  // Touret de câble
  <svg key="c" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.6" />
  </svg>,
  // Trame série
  <svg key="s" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 8h4v8h4V8h3v8h3V8h6" />
  </svg>,
  // Réseau
  <svg key="p" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <path d="M3 16h18" />
    <rect x="4" y="5" width="6" height="5" rx="1" />
    <rect x="14" y="5" width="6" height="5" rx="1" />
    <path d="M7 10v6M17 10v6" />
  </svg>,
]

/** Nombre de réponses saisies dans une partie */
function filled(a: PartielAnswers, part: PartIndex): [number, number] {
  const vals = Object.values(part === 0 ? a.cable : part === 1 ? a.serie : a.ping) as string[]
  return [vals.filter((v) => v.trim() !== '').length, vals.length]
}

export default function PartielReseaux() {
  const [session, setSession] = useState<PartielSession | null>(() => loadSession())
  const [now, setNow] = useState(() => Date.now())
  // Rendu hors des fonctions de mise à jour d'état : l'historique n'est écrit qu'une fois
  const current = useRef(session)
  current.current = session
  const finish = () => {
    const s = current.current
    if (s && !s.submittedAt) setSession(finalize(s))
  }
  const finishRef = useRef(finish)
  finishRef.current = finish
  useEffect(() => {
    const id = window.setInterval(() => {
      const t = Date.now()
      setNow(t)
      // Fin du chrono : rendu automatique
      const s = current.current
      if (s && s.mode === 'exam' && !s.submittedAt && remainingS(s, t) <= 0) finishRef.current()
    }, 1000)
    return () => window.clearInterval(id)
  }, [])
  const [demo, setDemo] = useState<DemoState | null>(null)
  // Pendant la démo : ni sauvegarde de session, ni historique, ni note
  useEffect(() => {
    if (!demo) saveSession(session)
  }, [session, demo])
  const startDemo = (variants: Variant[], speed = 1) => {
    const seed = demoSeedFor(variants)
    setSession({ ...newSession(seed, 'train', Date.now()), tab: PART_INDEX[partOf(variants[0]!)] })
    setDemo({ variants, i: 0, recap: null, speed })
  }
  // Lien direct depuis TP1 / TP3 : ?demo=cable50 | serie | pingLong… ou ?demo=complet (&vitesse=…)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const d = q.get('demo')
    if (!d) return
    const vs = d === 'complet' ? COMPLETE : VARIANTS.some((v) => v.id === d) ? [d as Variant] : null
    if (vs) startDemo(vs, Number(q.get('vitesse')) || 1)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const update = (f: (s: PartielSession) => PartielSession) => setSession((s) => (s ? f(s) : s))

  return (
    <Layout>
      <style>{PARTIEL_CSS}</style>
      <main className="partiel mx-auto max-w-7xl px-4 py-6 sm:py-8">
        {!session && <Start onStart={(seed, mode) => setSession(newSession(seed, mode, Date.now()))} onDemo={startDemo} />}
        {session && !session.submittedAt && (
          <Running
            s={session}
            now={now}
            update={update}
            finish={finish}
            demo={demo}
            onDemoEnd={(recap) => setDemo((d) => (d ? { ...d, recap } : d))}
            onDemoNext={() => {
              if (!demo) return
              const i = demo.i + 1
              update((x) => switchTab(x, PART_INDEX[partOf(demo.variants[i]!)], Date.now()))
              setDemo({ ...demo, i, recap: null })
            }}
            onMine={(part) => {
              setDemo(null)
              setSession({ ...newSession(Math.floor(Math.random() * 1e6), 'train', Date.now()), tab: part })
              window.scrollTo({ top: 0 })
            }}
            onQuitDemo={() => {
              setDemo(null)
              setSession(null)
            }}
          />
        )}
        {session?.submittedAt && <Result s={session} onNew={() => setSession(null)} />}
      </main>
    </Layout>
  )
}

/** Rendu de la copie : arrêt du chrono, note inscrite à l'historique */
function finalize(s: PartielSession): PartielSession {
  const done = submit(s, Date.now())
  const r = gradePartiel(subjectOf(s.seed), s.answers)
  addHistory({ date: new Date(done.submittedAt ?? Date.now()).toISOString(), seed: s.seed, mode: s.mode, note: r.note, parts: r.parts.map((p) => p.pts) })
  return done
}

/* ─────────── Démarrage et historique ─────────── */

function Hero({ children }: { children?: ReactNode }) {
  return (
    <header className="hero relative overflow-hidden rounded-3xl p-5 sm:p-8">
      <div className="relative">
        <p className="text-[11px] font-semibold tracking-[0.25em] text-muted">RÉSEAUX · PARTIEL PRATIQUE</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Partiel Réseaux</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">Trois manipulations à l’oscilloscope, en conditions d’examen : seul le fascicule est autorisé, pas de Modbus.</p>
        <ul className="mt-5 flex flex-wrap gap-2 text-sm">
          {[
            ['1 h 30', 'durée'],
            ['3', 'parties'],
            ['20', 'points'],
            ['Fascicule', 'seul document'],
          ].map(([v, l]) => (
            <li key={l} className="chip rounded-xl px-3 py-2">
              <span className="font-semibold">{v}</span> <span className="text-muted">{l}</span>
            </li>
          ))}
        </ul>
        {children}
      </div>
    </header>
  )
}

function Start({ onStart, onDemo }: { onStart: (seed: number, mode: PartielSession['mode']) => void; onDemo: (vs: Variant[]) => void }) {
  const [seedText, setSeedText] = useState(() => String(Math.floor(Math.random() * 1e6)))
  const [mode, setMode] = useState<PartielSession['mode']>('exam')
  const seed = Number(seedText)
  const valid = Number.isInteger(seed) && seed > 0
  const history = useMemo(() => loadHistory(), [])
  const modes = [
    ['exam', 'Examen chronométré 1 h 30', 'Chrono qui continue même si vous rechargez la page, rendu automatique à la fin.'],
    ['train', 'Entraînement sans chrono', 'Même sujet, à votre rythme ; la correction s’affiche au rendu.'],
  ] as const
  return (
    <div className="grid gap-6">
      <Hero />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <section className="panel rounded-3xl p-5 sm:p-6" aria-labelledby="nouveau-sujet">
          <h2 id="nouveau-sujet" className="text-lg font-semibold">
            Nouveau sujet
          </h2>
          <ol className="mt-4 grid gap-2 sm:grid-cols-3">
            {PARTIES.map((p, i) => (
              <li key={p} className="part-card rounded-2xl p-3" style={{ '--part': PART_COLORS[i] } as CSSProperties}>
                <div className="flex items-center gap-2">
                  <span className="part-icon flex h-9 w-9 items-center justify-center rounded-xl">{PART_ICONS[i]}</span>
                  <span className="ml-auto rounded-full px-2 py-0.5 text-xs font-semibold part-pill">{PART_POINTS[i]} pts</span>
                </div>
                <p className="mt-2 text-sm font-semibold">
                  {i + 1}. {p}
                </p>
                <p className="mt-0.5 text-xs text-muted">{PART_HINTS[i]}</p>
              </li>
            ))}
          </ol>

          <fieldset className="mt-5 grid gap-2 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-medium">Mode</legend>
            {modes.map(([k, label, hint]) => (
              <label key={k} className={`mode-card flex min-h-11 cursor-pointer gap-3 rounded-2xl p-3 ${mode === k ? 'is-on' : ''}`}>
                <input type="radio" name="partiel-mode" checked={mode === k} onChange={() => setMode(k)} className="mt-1 h-4 w-4 accent-[var(--color-accent)]" />
                <span>
                  <span className="block text-sm font-semibold">{label}</span>
                  <span className="mt-0.5 block text-xs text-muted">{hint}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <div className="mt-5 flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-sm font-medium">
              Graine
              <span className="flex items-center gap-2">
                <input
                  value={seedText}
                  onChange={(e) => setSeedText(e.target.value.trim())}
                  inputMode="numeric"
                  className="field min-h-11 w-36 rounded-xl px-3 font-mono"
                  aria-label="Graine du sujet"
                  aria-describedby="graine-aide"
                />
                <button type="button" onClick={() => setSeedText(String(Math.floor(Math.random() * 1e6)))} className="ghost-btn min-h-11 rounded-xl px-3 text-sm" aria-label="Tirer une autre graine">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <rect x="4" y="4" width="16" height="16" rx="3" />
                    <circle cx="9" cy="9" r="1.2" fill="currentColor" />
                    <circle cx="15" cy="15" r="1.2" fill="currentColor" />
                    <circle cx="15" cy="9" r="1.2" fill="currentColor" />
                    <circle cx="9" cy="15" r="1.2" fill="currentColor" />
                  </svg>
                </button>
              </span>
            </label>
            <button type="button" onClick={() => valid && onStart(seed, mode)} disabled={!valid} className="primary-btn ml-auto min-h-12 rounded-2xl px-6 text-base font-semibold">
              Démarrer
            </button>
          </div>
          <p id="graine-aide" className="mt-2 text-xs text-muted">
            Même graine = même sujet : partagez-la pour comparer vos résultats.
          </p>
        </section>

        <section className="panel rounded-3xl p-5 sm:p-6 lg:col-span-2" aria-labelledby="demo-titre">
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 id="demo-titre" className="text-lg font-semibold">
              Démonstration
            </h2>
            <p className="text-sm text-muted">Le simulateur fait le partiel devant toi, lentement : chaque geste, chaque valeur lue, chaque calcul. Rien n’est noté.</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {VARIANTS.map((v) => (
              <button key={v.id} type="button" onClick={() => onDemo([v.id])} className="ghost-btn min-h-11 rounded-xl px-3 text-sm">
                {v.label}
              </button>
            ))}
            <button type="button" onClick={() => onDemo(COMPLETE)} className="primary-btn min-h-11 rounded-xl px-4 text-sm font-semibold">
              Démonstration complète
            </button>
          </div>
        </section>

        <section className="panel rounded-3xl p-5 sm:p-6" aria-labelledby="tentatives">
          <h2 id="tentatives" className="text-lg font-semibold">
            Mes tentatives
          </h2>
          <History h={history} />
        </section>
      </div>
    </div>
  )
}

function History({ h }: { h: HistoryEntry[] }) {
  if (h.length === 0)
    return (
      <div className="empty mt-4 grid place-items-center rounded-2xl px-4 py-10 text-center">
        <svg viewBox="0 0 48 32" className="h-10 w-16 text-muted" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M2 24 L12 24 L14 8 L18 8 L20 24 L30 24 C33 24 33 14 36 14 C39 14 39 24 42 24 L46 24" strokeLinejoin="round" />
        </svg>
        <p className="mt-3 text-sm font-medium">Aucune tentative pour l’instant</p>
        <p className="mt-1 text-xs text-muted">Vos notes et votre progression apparaîtront ici.</p>
      </div>
    )
  const notes = h.map((e) => e.note)
  const best = Math.max(...notes)
  const avg = notes.reduce((a, b) => a + b, 0) / notes.length
  const W = 320
  const H = 120
  const x = (i: number) => (h.length === 1 ? W / 2 : 12 + (i * (W - 24)) / (h.length - 1))
  const y = (n: number) => H - 12 - (n / 20) * (H - 24)
  const line = h.map((e, i) => `${x(i)},${y(e.note)}`).join(' ')
  return (
    <div className="mt-4">
      <dl className="grid grid-cols-3 gap-2">
        {[
          ['Meilleure', `${fr(best, 3)}`],
          ['Moyenne', `${fr(avg, 3)}`],
          ['Tentatives', String(h.length)],
        ].map(([k, v]) => (
          <div key={k} className="stat rounded-2xl p-3">
            <dt className="text-xs text-muted">{k}</dt>
            <dd className="mt-0.5 text-xl font-semibold">
              {v}
              {k !== 'Tentatives' && <span className="text-sm font-normal text-muted"> /20</span>}
            </dd>
          </div>
        ))}
      </dl>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full text-ink" role="img" aria-label={`Progression des notes : ${notes.map((n) => fr(n, 3)).join(', ')} sur 20`}>
        <defs>
          <linearGradient id="hist-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="currentColor" stopOpacity="0.18" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 5, 10, 15, 20].map((n) => (
          <g key={n}>
            <line x1="12" x2={W - 12} y1={y(n)} y2={y(n)} stroke="var(--color-line)" strokeDasharray={n === 10 ? '0' : '3 4'} />
          </g>
        ))}
        {h.length > 1 && <polygon points={`${x(0)},${y(0)} ${line} ${x(h.length - 1)},${y(0)}`} fill="url(#hist-fill)" />}
        <polyline points={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {h.map((e, i) => (
          <circle key={i} cx={x(i)} cy={y(e.note)} r="3.5" fill="var(--color-card)" stroke="currentColor" strokeWidth="2" />
        ))}
      </svg>
      <ul className="mt-4 grid gap-2">
        {[...h]
          .reverse()
          .slice(0, 6)
          .map((e) => (
            <li key={e.date} className="stat flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl px-3 py-2 text-sm">
              <span className="font-semibold tabular-nums">{fr(e.note, 3)}/20</span>
              <span className="text-xs text-muted">{new Date(e.date).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span>
              <span className="rounded-full px-2 py-0.5 text-[11px] ring-1 ring-line">{e.mode === 'exam' ? 'examen' : 'entraînement'}</span>
              <span className="ml-auto flex items-center gap-1 text-xs text-muted">
                graine <span className="font-mono">{e.seed}</span>
              </span>
              <span className="flex w-full gap-1" aria-label={`Parties : ${e.parts.map((p) => fr(p, 3)).join(', ')}`}>
                {e.parts.map((p, i) => (
                  <span key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-card-2">
                    <span className="block h-full rounded-full" style={{ width: `${(p / PART_POINTS[i]!) * 100}%`, background: PART_COLORS[i] }} />
                  </span>
                ))}
              </span>
            </li>
          ))}
      </ul>
    </div>
  )
}

/* ─────────── Épreuve en cours ─────────── */

function Running({
  s,
  now,
  update,
  finish,
  demo,
  onDemoEnd,
  onDemoNext,
  onMine,
  onQuitDemo,
}: {
  s: PartielSession
  now: number
  update: (f: (s: PartielSession) => PartielSession) => void
  finish: () => void
  demo: DemoState | null
  onDemoEnd: (recap: string[]) => void
  onDemoNext: () => void
  onMine: (part: PartIndex) => void
  onQuitDemo: () => void
}) {
  const subject = useMemo(() => subjectOf(s.seed), [s.seed])
  // Mode démonstration : les instruments exposent leurs setters, le LiveLab les relie
  const scopeRefs = [useRef<ScopeRef>(null), useRef<ScopeRef>(null), useRef<ScopeRef>(null)] as const
  const benchRef = useRef<BenchHandle>(null)
  const sRef = useRef(s)
  sRef.current = s
  const [zonesVersion, setZonesVersion] = useState(0)
  const zonesRef = useRef<Zone[]>([])
  const setZones = (z: Zone[]) => {
    zonesRef.current = z
    setZonesVersion((v) => v + 1)
  }
  const lab = useMemo(
    () =>
      createLiveLab({
        scope: () => scopeRefs[sRef.current.tab].current,
        bench: () => benchRef.current,
        answers: () => sRef.current.answers,
        setAnswer: (k, p) => update((x) => ({ ...x, answers: { ...x.answers, [k]: { ...x.answers[k], ...p } } })),
        setAllAnswers: (a) => update((x) => ({ ...x, answers: a })),
        setTab: (i) => {
          sRef.current = { ...sRef.current, tab: i }
          update((x) => switchTab(x, i, Date.now()))
        },
        tab: () => sRef.current.tab,
        zones: () => zonesRef.current,
        setZones,
        reveal: async () => {
          const el = document.querySelector(`[data-demo-part="${sRef.current.tab}"] [data-demo="screen"]`)
          const r = el?.getBoundingClientRect()
          if (el && r && (r.bottom < 80 || r.top > window.innerHeight - 40)) {
            el.scrollIntoView({ block: 'center' })
            await new Promise((ok) => window.setTimeout(ok, 120))
          }
        },
      }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const annotate = useMemo(() => (demo ? (a: number, b: number) => zonesRef.current.filter((z) => z.to >= a && z.from <= b) : undefined), [demo])
  useEffect(() => {
    // Les molettes et touches de la face avant sont les cibles du pointeur
    if (demo) for (const r of scopeRefs) r.current?.setView('face')
  }, [demo]) // eslint-disable-line react-hooks/exhaustive-deps
  const demoVariant = demo ? demo.variants[demo.i]! : null
  const demoPart = demoVariant ? PART_INDEX[partOf(demoVariant)] : 0
  const [fascicule, setFascicule] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const setAns = <K extends keyof PartielAnswers>(k: K, patch: Partial<PartielAnswers[K]>) => update((x) => ({ ...x, answers: { ...x.answers, [k]: { ...x.answers[k], ...patch } } }))
  const a = s.answers
  const serieSources = useMemo(() => [subject.serie.source, null] as const, [subject])
  const ping = subject.ping
  const pingSources = useMemo(() => [salleTraffic(s.seed, { kind: 'ping', L: ping.L, from: ping.from, to: ping.to }, true).source, null] as const, [s.seed, ping])
  const remaining = remainingS(s, now)
  const urgent = s.mode === 'exam' && remaining < 600
  const total = PARTIES.reduce((n, _, i) => n + filled(a, i as PartIndex)[0], 0)
  const totalMax = PARTIES.reduce((n, _, i) => n + filled(a, i as PartIndex)[1], 0)

  return (
    <div>
      {/* Barre d'épreuve */}
      <div className="exam-bar sticky top-0 z-20 -mx-4 px-4 py-2">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex min-w-0 items-center gap-3">
            {demo ? (
              <span className="chip rounded-xl px-3 py-1.5 text-sm font-semibold">Démonstration</span>
            ) : s.mode === 'exam' ? (
              <Timer remaining={remaining} urgent={urgent} />
            ) : (
              <span className="chip rounded-xl px-3 py-1.5 text-sm font-semibold">Entraînement</span>
            )}
            <div className="min-w-0 text-xs leading-tight">
              <p className="font-semibold">Partiel Réseaux</p>
              <p className="text-muted">
                graine <span className="font-mono">{s.seed}</span> · {total}/{totalMax} réponses
              </p>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setFascicule(!fascicule)} aria-pressed={fascicule} className={`ghost-btn min-h-11 rounded-xl px-3 text-sm ${fascicule ? 'is-on' : ''}`}>
              Fascicule
            </button>
            {demo ? null : confirm ? (
              <span className="confirm flex flex-wrap items-center gap-2 rounded-xl px-2 py-1">
                <span className="text-sm font-medium">Rendre la copie ?</span>
                <button type="button" onClick={finish} className="primary-btn min-h-11 rounded-xl px-3 text-sm font-semibold">
                  Oui, rendre
                </button>
                <button type="button" onClick={() => setConfirm(false)} className="ghost-btn min-h-11 rounded-xl px-3 text-sm">
                  Non
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirm(true)} className="primary-btn min-h-11 rounded-xl px-4 text-sm font-semibold">
                Rendre
              </button>
            )}
          </div>
        </div>
      </div>

      {fascicule && <Fascicule onClose={() => setFascicule(false)} />}

      {/* Onglets des parties */}
      <div role="tablist" aria-label="Parties du partiel" className="mt-5 grid grid-cols-3 gap-2">
        {PARTIES.map((p, i) => {
          const [n, m] = filled(a, i as PartIndex)
          const on = s.tab === i
          return (
            <button
              key={p}
              type="button"
              role="tab"
              data-demo={`tab-${i}`}
              aria-selected={on}
              onClick={() => {
                update((x) => switchTab(x, i as PartIndex, Date.now()))
                // Nouvel onglet : on remonte à son énoncé
                window.scrollTo({ top: 0 })
              }}
              className={`tab-card min-h-11 rounded-2xl p-2 text-left sm:p-3 ${on ? 'is-on' : ''}`}
              style={{ '--part': PART_COLORS[i] } as CSSProperties}
            >
              <span className="flex items-center gap-2">
                <span className="part-icon hidden h-8 w-8 shrink-0 items-center justify-center rounded-xl sm:flex">{PART_ICONS[i]}</span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold sm:text-sm">
                    {i + 1}. {p}
                  </span>
                  <span className="block text-[11px] text-muted">
                    {PART_POINTS[i]} pts · {n}/{m}
                  </span>
                </span>
              </span>
              <span className="mt-2 block h-1 overflow-hidden rounded-full bg-card-2" aria-hidden="true">
                <span className="block h-full rounded-full transition-[width] duration-300" style={{ width: `${(n / m) * 100}%`, background: PART_COLORS[i] }} />
              </span>
            </button>
          )
        })}
      </div>

      {/* Les trois bancs restent montés : leurs réglages survivent au changement d'onglet */}
      <div hidden={s.tab !== 0} data-demo-part="0">
        <CoaxBench
          cable={subject.coax.cable}
          seed={s.seed}
          apiRef={benchRef}
          scopeRef={scopeRefs[0]}
          annotate={demoPart === 0 ? annotate : undefined}
          annotateVersion={zonesVersion}
          onTopology={(t) => update((x) => withMontageIssue(x, montageIssue(t)))}
          top={
            <Brief part={0} title="Câble coaxial">
              Câble inconnu enroulé : <b>{subject.coax.cable.N} spires</b> de diamètre <b>{formatSI(subject.coax.cable.D, 'm')}</b>. Déterminez son impédance caractéristique, sa longueur et les coefficients de réflexion en bout ouvert et en court-circuit. Générateur : Zg = 50 Ω ; v = 2·10⁸ m/s.
            </Brief>
          }
        />
        <Answers part={0}>
          <Field demo="ans-cable-zc" n={1} label="Zc (Ω)" value={a.cable.zc} onChange={(v) => setAns('cable', { zc: v })} />
          <Field demo="ans-cable-l" n={2} label="Longueur l (m)" value={a.cable.l} onChange={(v) => setAns('cable', { l: v })} />
          <Field demo="ans-cable-gammaOpen" n={3} label="Γ en circuit ouvert" value={a.cable.gammaOpen} onChange={(v) => setAns('cable', { gammaOpen: v })} />
          <Field demo="ans-cable-gammaShort" n={4} label="Γ en court-circuit" value={a.cable.gammaShort} onChange={(v) => setAns('cable', { gammaShort: v })} />
          <Select demo="ans-cable-methode" n={5} label="Méthode utilisée pour Zc" value={a.cable.methode} onChange={(v) => setAns('cable', { methode: v as PartielAnswers['cable']['methode'] })} options={METHODES} wide />
        </Answers>
      </div>

      <div hidden={s.tab !== 1} data-demo-part="1">
        <section className="mt-6 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          <Brief part={1} title="Trame série" demo="brief-serie">
            La sonde est branchée sur la ligne TXD d’une liaison série asynchrone qui émet un court message en boucle (toutes les ≈ 200 ms). Format des caractères : <b>{subject.serie.enonce.dataBits} bits de données</b>,{' '}
            <b>
              {subject.serie.enonce.stopBits} bit{subject.serie.enonce.stopBits > 1 ? 's' : ''} de stop
            </b>
            , poids faible en premier. Trouvez le débit, le type de parité, la norme électrique et le message.
          </Brief>
          <ScopeInstrument sources={serieSources} apiRef={scopeRefs[1]} annotate={demoPart === 1 ? annotate : undefined} annotateVersion={zonesVersion} />
        </section>
        <Answers part={1}>
          <Field demo="ans-serie-baud" n={1} label="Débit (bauds)" value={a.serie.baud} onChange={(v) => setAns('serie', { baud: v })} />
          <Select demo="ans-serie-parity" n={2} label="Parité" value={a.serie.parity} onChange={(v) => setAns('serie', { parity: v as Parity | '' })} options={(['none', 'even', 'odd'] as const).map((p) => [p, parityFr(p)])} />
          <Select demo="ans-serie-level" n={3} label="Norme" value={a.serie.level} onChange={(v) => setAns('serie', { level: v as Level | '' })} options={(['TTL', 'RS232'] as const).map((l) => [l, levelFr(l)])} />
          <Field demo="ans-serie-message" n={4} label="Message (casse comprise)" value={a.serie.message} onChange={(v) => setAns('serie', { message: v })} mono text />
        </Answers>
      </div>

      <div hidden={s.tab !== 2} data-demo-part="2">
        <section className="mt-6 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          <Brief part={2} title="Ping Ethernet 10Base2" demo="brief-ping">
            Réseau 10Base2 de la salle (coax bouchonné aux deux bouts), avec son trafic de fond. Le poste {ping.from.ip.join('.')} lance <span className="font-mono">ping -l ? -t {ping.to.ip.join('.')}</span>. Retrouvez L, le bourrage, la durée d’une trame de requête sur le câble et le 1er octet de la MAC destination.
          </Brief>
          <ScopeInstrument sources={pingSources} apiRef={scopeRefs[2]} annotate={demoPart === 2 ? annotate : undefined} annotateVersion={zonesVersion} />
        </section>
        <Answers part={2}>
          <Field demo="ans-ping-L" n={1} label="L (octets) : ping -l L" value={a.ping.L} onChange={(v) => setAns('ping', { L: v })} />
          <Field demo="ans-ping-padding" n={2} label="Octets de bourrage" value={a.ping.padding} onChange={(v) => setAns('ping', { padding: v })} />
          <Field demo="ans-ping-durationUs" n={3} label="Durée de la trame sur le câble (µs)" value={a.ping.durationUs} onChange={(v) => setAns('ping', { durationUs: v })} />
          <Field demo="ans-ping-macByte" n={4} label="1er octet de la MAC destination (hexa)" value={a.ping.macByte} onChange={(v) => setAns('ping', { macByte: v })} mono text />
        </Answers>
      </div>
      <p className="mt-6 flex items-center gap-2 text-xs text-muted">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M5 13l4 4L19 7" />
        </svg>
        Réponses enregistrées au fil de la saisie. Aucune correction pendant l’épreuve.
      </p>

      {demo && demoVariant && !demo.recap && (
        <DemoPlayer
          key={demo.i}
          script={scriptFor(partOf(demoVariant), subject)}
          lab={lab}
          subject={subject}
          part={demoPart}
          initialSpeed={demo.speed}
          onEnd={onDemoEnd}
          onQuit={onQuitDemo}
        />
      )}
      {demo?.recap && demoVariant && (
        <div className="demo-recap fixed inset-x-3 bottom-3 z-[75] rounded-3xl p-4 md:inset-x-auto md:right-5 md:bottom-5 md:w-[26rem]" role="dialog" aria-label="Récapitulatif de la démonstration">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-muted">FIN DE LA PARTIE {demoPart + 1}</p>
          <h2 className="mt-1 text-lg font-semibold">Ce qu’on a déduit</h2>
          <ul className="mt-2 grid gap-1.5 text-sm" data-testid="demo-recap">
            {demo.recap.map((r) => (
              <li key={r} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: PART_COLORS[demoPart] }} aria-hidden="true" />
                {r}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            {demo.i < demo.variants.length - 1 && (
              <button type="button" onClick={onDemoNext} className="primary-btn min-h-11 rounded-xl px-4 text-sm font-semibold">
                Partie suivante
              </button>
            )}
            <button type="button" onClick={() => onMine(demoPart)} className={`${demo.i < demo.variants.length - 1 ? 'ghost-btn' : 'primary-btn'} min-h-11 rounded-xl px-4 text-sm font-semibold`}>
              À moi
            </button>
            <button type="button" onClick={onQuitDemo} className="ghost-btn min-h-11 rounded-xl px-3 text-sm">
              Quitter la démo
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">« À moi » : même partie, nouveau sujet, en entraînement, sans aide.</p>
        </div>
      )}
    </div>
  )
}

/** Chrono circulaire : l'anneau se vide avec le temps, rouge sous 10 minutes */
function Timer({ remaining, urgent }: { remaining: number; urgent: boolean }) {
  const frac = Math.max(0, Math.min(1, remaining / RES3_PARTIEL.dureeS))
  const R = 16
  const C = 2 * Math.PI * R
  return (
    <span className={`timer flex items-center gap-2 rounded-2xl py-1 pl-1 pr-3 ${urgent ? 'is-urgent' : ''}`} role="timer" aria-label={`Temps restant ${clock(remaining)}`}>
      <svg viewBox="0 0 40 40" className="h-9 w-9 -rotate-90" aria-hidden="true">
        <circle cx="20" cy="20" r={R} fill="none" stroke="var(--color-line)" strokeWidth="4" />
        <circle cx="20" cy="20" r={R} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} className="timer-ring" />
      </svg>
      <span className="font-mono text-lg font-semibold tabular-nums">{clock(remaining)}</span>
    </span>
  )
}

/** Énoncé d'une partie */
function Brief({ part, title, children, demo }: { part: PartIndex; title: string; children: ReactNode; demo?: string }) {
  return (
    <div data-demo={demo} className="brief rounded-3xl p-4 sm:p-5" style={{ '--part': PART_COLORS[part] } as CSSProperties}>
      <div className="flex items-center gap-3">
        <span className="part-icon flex h-10 w-10 items-center justify-center rounded-2xl">{PART_ICONS[part]}</span>
        <div>
          <p className="text-[11px] font-semibold tracking-[0.2em] text-muted">PARTIE {part + 1}</p>
          <h2 className="text-lg font-semibold leading-tight">{title}</h2>
        </div>
        <span className="part-pill ml-auto rounded-full px-2.5 py-1 text-xs font-semibold">{PART_POINTS[part]} pts</span>
      </div>
      <p className="mt-3 text-sm leading-relaxed">{children}</p>
    </div>
  )
}

function Answers({ part, children }: { part: PartIndex; children: ReactNode }) {
  return (
    <section className="answers mt-5 rounded-3xl p-4 sm:p-5" style={{ '--part': PART_COLORS[part] } as CSSProperties} aria-label={`Réponses — partie ${part + 1}`}>
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: PART_COLORS[part] }} aria-hidden="true" />
        Votre copie — partie {part + 1}
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  )
}

function Num({ n, done }: { n: number; done: boolean }) {
  return (
    <span className={`num flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${done ? 'is-done' : ''}`} aria-hidden="true">
      {done ? (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        n
      )}
    </span>
  )
}

function Field({ n, label, value, onChange, mono, text, demo }: { n: number; label: string; value: string; onChange: (v: string) => void; mono?: boolean; text?: boolean; demo?: string }) {
  return (
    <div className="flex gap-2">
      <Num n={n} done={value.trim() !== ''} />
      <label className="grid min-w-0 flex-1 gap-1 text-sm">
        {label}
        <input data-demo={demo} value={value} onChange={(e) => onChange(e.target.value)} inputMode={text ? 'text' : 'decimal'} autoComplete="off" className={`field min-h-11 rounded-xl px-3 ${mono ? 'font-mono' : ''}`} />
      </label>
    </div>
  )
}

function Select({ n, label, value, onChange, options, wide, demo }: { n: number; label: string; value: string; onChange: (v: string) => void; options: readonly (readonly [string, string])[]; wide?: boolean; demo?: string }) {
  return (
    <div className={`flex gap-2 ${wide ? 'sm:col-span-2' : ''}`}>
      <Num n={n} done={value !== ''} />
      <label className="grid min-w-0 flex-1 gap-1 text-sm">
        {label}
        <select data-demo={demo} value={value} onChange={(e) => onChange(e.target.value)} className="field min-h-11 w-full min-w-0 rounded-xl px-3">
          <option value="">— choisir —</option>
          {options.map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

/* ─────────── Résultat ─────────── */

const mention = (n: number) => (n >= 16 ? 'Très bien' : n >= 14 ? 'Bien' : n >= 12 ? 'Assez bien' : n >= 10 ? 'Passable' : 'Insuffisant')

function Result({ s, onNew }: { s: PartielSession; onNew: () => void }) {
  const r = useMemo(() => gradePartiel(subjectOf(s.seed), s.answers), [s])
  // La note s'affiche en haut de page, pas au milieu de la copie
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [])
  const used = ((s.submittedAt ?? s.startAt) - s.startAt) / 1000
  const R = 52
  const C = 2 * Math.PI * R
  const tone = r.note >= 10 ? 'var(--color-ok)' : 'var(--color-err)'
  return (
    <div className="grid gap-6">
      <section className="hero relative overflow-hidden rounded-3xl p-5 sm:p-8">
        <div className="relative grid items-center gap-6 sm:grid-cols-[auto_minmax(0,1fr)]">
          <div className="relative mx-auto h-36 w-36">
            <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90" aria-hidden="true">
              <circle cx="64" cy="64" r={R} fill="none" stroke="var(--color-line)" strokeWidth="10" />
              <circle cx="64" cy="64" r={R} fill="none" stroke={tone} strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - r.note / 20)} className="score-ring" />
            </svg>
            <div className="absolute inset-0 grid place-items-center text-center">
              <div>
                <p className="text-3xl font-bold tabular-nums" data-testid="note-partiel">
                  {fr(r.note, 3)} / 20
                </p>
                <p className="text-xs font-medium" style={{ color: tone }}>
                  {mention(r.note)}
                </p>
              </div>
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.25em] text-muted">COPIE RENDUE</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Résultat du partiel</h1>
            <p className="mt-1 text-sm text-muted">
              Graine <span className="font-mono">{s.seed}</span> · {s.mode === 'exam' ? 'examen' : 'entraînement'} · durée {clock(used)}
            </p>
            <ul className="mt-4 grid gap-3">
              {r.parts.map((p, i) => (
                <li key={p.name}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium">
                      {i + 1}. {p.name}
                    </span>
                    <span className="tabular-nums">
                      <b>{fr(p.pts, 3)}</b> / {p.max} <span className="text-xs text-muted">· {minutes(s.partMs[i] ?? 0)}</span>
                    </span>
                  </div>
                  <span className="mt-1 block h-2 overflow-hidden rounded-full bg-card-2">
                    <span className="score-bar block h-full rounded-full" style={{ width: `${(p.pts / p.max) * 100}%`, background: PART_COLORS[i] }} />
                  </span>
                </li>
              ))}
            </ul>
            <button type="button" onClick={onNew} className="primary-btn mt-5 min-h-11 rounded-xl px-5 text-sm font-semibold">
              Nouveau partiel
            </button>
          </div>
        </div>
      </section>

      {r.parts.map((p, i) => (
        <section key={p.name} className="panel rounded-3xl p-4 sm:p-6" style={{ '--part': PART_COLORS[i] } as CSSProperties}>
          <div className="flex items-center gap-3">
            <span className="part-icon flex h-10 w-10 items-center justify-center rounded-2xl">{PART_ICONS[i]}</span>
            <h2 className="text-lg font-semibold">
              {i + 1}. {p.name}
            </h2>
            <span className="part-pill ml-auto rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums">
              {fr(p.pts, 3)} / {p.max}
            </span>
          </div>
          <ul className="mt-4 grid gap-2">
            {r.lines
              .filter((l) => l.part === i)
              .map((l) => {
                const state = l.ok ? 'ok' : l.score > 0 ? 'mid' : 'ko'
                return (
                  <li key={l.label} className={`line rounded-2xl p-3 is-${state}`}>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="status flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold" aria-label={l.ok ? 'juste' : l.score > 0 ? 'en partie juste' : 'faux'}>
                        {l.ok ? '✓' : l.score > 0 ? '½' : '✗'}
                      </span>
                      <span className="text-sm font-semibold">{l.label}</span>
                      <span className="ml-auto text-sm tabular-nums">
                        {fr(l.pts, 3)}/{l.max}
                      </span>
                    </div>
                    <div className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                      <p>
                        <span className="text-muted">Votre réponse : </span>
                        <span className="font-mono">{l.given}</span>
                      </p>
                      <p>
                        <span className="text-muted">Attendu : </span>
                        <span className="font-mono">{l.expected}</span>
                      </p>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-muted">{l.calcul}</p>
                  </li>
                )
              })}
          </ul>
          {i === 0 && (
            <div className={`line mt-4 rounded-2xl p-3 text-sm ${(s.montage ?? []).length ? 'is-mid' : 'is-ok'}`}>
              <p className="font-semibold">Montage sur le banc</p>
              {(s.montage ?? []).length === 0 ? (
                <p className="mt-1 text-xs text-muted">Aucune erreur de montage relevée.</p>
              ) : (
                <ul className="mt-1 list-disc pl-5 text-xs text-muted">
                  {(s.montage ?? []).map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              )}
              <p className="mt-1 text-xs text-muted">Montage attendu : générateur → cordon → Té sur CH1 → câble → extrémité (ouverte, puis court-circuit, puis potentiomètre).</p>
            </div>
          )}
          <div className="tip mt-4 flex gap-3 rounded-2xl p-3 text-xs leading-relaxed">
            <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="5" width="18" height="12" rx="2" />
              <path d="M6 13l3-4 3 3 3-5 3 6" />
            </svg>
            <p>
              <b>Réglages d’oscilloscope conseillés : </b>
              {p.conseil}
            </p>
          </div>
        </section>
      ))}
    </div>
  )
}

/* ─────────── Fascicule (rappels de cours, aucune valeur du sujet) ─────────── */

function Fascicule({ onClose }: { onClose: () => void }) {
  const blocs: [string, ReactNode][] = [
    [
      'Lignes de transmission',
      <>
        <p>Γ = (ZL − Zc)/(ZL + Zc) : ouvert → +1, court-circuit → −1, adapté (ZL = Zc) → 0. À t = 0⁺ la ligne vue de l’entrée vaut Zc : Ei = Eg·Zc/(Zg + Zc) ⇒ Zc = Zg·Ei/(Eg − Ei).</p>
        <p>Retard aller-retour Δt = 2l/v ⇒ l = v·Δt/2. Longueur d’un enroulement : N·π·D. Atténuation A(dB) = 20·log(Ve/Vs), ramenée à 100 m : α = A·100/l. Déphasage φ = 360·f·l/v (mod 360).</p>
      </>,
    ],
    [
      'Liaison série asynchrone',
      <>
        <p>Repos au 1 logique ; start = 0 ; 7 ou 8 bits de données, poids faible en premier ; parité éventuelle (paire : nombre total de 1 pair ; impaire : impair) ; 1 ou 2 stops à 1. Débit = 1/durée d’un bit.</p>
        <p>TTL : 0 V = 0, 5 V = 1, repos haut. RS-232 / V28 : logique inversée, 1 ≈ −3 à −15 V, 0 ≈ +3 à +15 V, repos négatif.</p>
      </>,
    ],
    [
      'Trame Ethernet II',
      <>
        <p>Préambule 7 × 55h, SFD D5h, MAC destination (6), MAC source (6), Type (2 : 0800h IPv4, 0806h ARP), données 46 à 1500 octets (bourrage sous 46), FCS CRC-32 (4). 10 Mbit/s : 100 ns par bit, 0,8 µs par octet ; espace inter-trame 9,6 µs.</p>
        <p>Octets émis poids faible en premier. Manchester IEEE 802.3 : 0 = front descendant au milieu du bit, 1 = front montant. 10Base2 : repos 0 V, la carte tire 40 ± 30 mA dans 25 Ω.</p>
      </>,
    ],
    [
      'IPv4 et ICMP',
      <>
        <p>En-tête IPv4 sans option : 20 octets (45h, TOS, longueur totale, identification, drapeaux/décalage, TTL, protocole 01h = ICMP, somme de contrôle, IP source, IP destination). Fragments de 1480 octets de données au plus.</p>
        <p>ICMP Echo : 8 octets d’en-tête (type 8 requête / 0 réponse, code, somme, identifiant, séquence) puis les données de ping (« abcdef… » sous Windows).</p>
      </>,
    ],
  ]
  return (
    <section className="fascicule mt-4 rounded-3xl p-4 sm:p-6" aria-label="Fascicule : rappels de cours">
      <div className="flex items-center gap-3">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z" />
          <path d="M8 7h6M8 11h6" />
        </svg>
        <h2 className="text-lg font-semibold">Fascicule — rappels de cours</h2>
        <button type="button" onClick={onClose} className="ghost-btn ml-auto min-h-11 rounded-xl px-3 text-sm">
          Fermer
        </button>
      </div>
      <div className="mt-4 grid gap-3 text-sm leading-relaxed md:grid-cols-2">
        {blocs.map(([t, c]) => (
          <div key={t} className="stat grid gap-2 rounded-2xl p-4">
            <h3 className="font-semibold">{t}</h3>
            {c}
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">
        Barème : câble 7, série 6, ping 7 (sur 20) ; épreuve de {RES3_PARTIEL.dureeS / 60} min ; Zc et l à ±5 % (moitié à ±10 %), durées à ±2 % (moitié à ±5 %), le reste exact.
      </p>
    </section>
  )
}

/** Habillage de la page : surfaces douces, liserés de couleur par partie, mouvements sobres */
const PARTIEL_CSS = `
.partiel .hero {
  background:
    linear-gradient(rgba(127,127,127,0.07) 1px, transparent 1px) 0 0 / 28px 28px,
    linear-gradient(90deg, rgba(127,127,127,0.07) 1px, transparent 1px) 0 0 / 28px 28px,
    radial-gradient(600px 260px at 100% 0%, rgba(14,165,233,0.14), transparent 70%),
    radial-gradient(520px 240px at 0% 100%, rgba(245,158,11,0.12), transparent 70%),
    var(--color-card);
  box-shadow: 0 1px 0 rgba(255,255,255,0.04) inset, 0 0 0 1px var(--color-line), 0 18px 40px -28px rgba(0,0,0,0.35);
}
.partiel .panel, .partiel .answers, .partiel .brief, .partiel .fascicule {
  background: var(--color-card);
  box-shadow: 0 0 0 1px var(--color-line), 0 12px 32px -24px rgba(0,0,0,0.3);
}
.partiel .brief, .partiel .answers { border-top: 3px solid var(--part); }
.partiel .chip, .partiel .stat, .partiel .empty { background: var(--color-card-2); box-shadow: 0 0 0 1px var(--color-line); }
.partiel .part-card { background: var(--color-card-2); box-shadow: 0 0 0 1px var(--color-line); border-left: 3px solid var(--part); }
.partiel .part-icon { color: var(--part, currentColor); background: color-mix(in srgb, var(--part, #888) 14%, transparent); }
.partiel .part-pill { color: var(--color-ink); background: color-mix(in srgb, var(--part, #888) 18%, transparent); }
.partiel .mode-card { background: var(--color-card-2); box-shadow: 0 0 0 1px var(--color-line); transition: box-shadow 180ms ease, transform 180ms ease; }
.partiel .mode-card.is-on { box-shadow: 0 0 0 2px var(--color-accent); }
.partiel .mode-card:hover { transform: translateY(-1px); }
.partiel .field { background: var(--color-field); box-shadow: 0 0 0 1px var(--color-line); transition: box-shadow 160ms ease; }
.partiel .field:focus { outline: none; box-shadow: 0 0 0 2px var(--part, var(--color-accent)); }
.partiel .primary-btn { background: var(--color-accent); color: var(--color-on-accent); transition: transform 160ms ease, opacity 160ms ease; }
.partiel .primary-btn:hover { transform: translateY(-1px); }
.partiel .primary-btn:disabled { opacity: 0.4; transform: none; }
.partiel .ghost-btn { background: var(--color-card); box-shadow: 0 0 0 1px var(--color-line); transition: box-shadow 160ms ease; }
.partiel .ghost-btn:hover, .partiel .ghost-btn.is-on { box-shadow: 0 0 0 2px var(--color-accent); }
.partiel .primary-btn:focus-visible, .partiel .ghost-btn:focus-visible, .partiel .tab-card:focus-visible { outline: 2px solid var(--color-link); outline-offset: 2px; }
.partiel .exam-bar { background: color-mix(in srgb, var(--color-bg) 88%, transparent); backdrop-filter: blur(10px); box-shadow: 0 1px 0 var(--color-line); }
.partiel .timer { background: var(--color-card); box-shadow: 0 0 0 1px var(--color-line); color: var(--color-ink); }
.partiel .timer.is-urgent { color: var(--color-err); box-shadow: 0 0 0 2px var(--color-err); }
.partiel .timer-ring { transition: stroke-dashoffset 900ms linear; }
.partiel .confirm { background: var(--color-card); box-shadow: 0 0 0 2px var(--color-warn); }
.partiel .tab-card { background: var(--color-card); box-shadow: 0 0 0 1px var(--color-line); transition: box-shadow 180ms ease, transform 180ms ease; }
.partiel .tab-card:hover { transform: translateY(-1px); }
.partiel .tab-card.is-on { box-shadow: 0 0 0 2px var(--part), 0 10px 24px -18px var(--part); }
.partiel .num { background: var(--color-card-2); box-shadow: 0 0 0 1px var(--color-line); color: var(--color-muted); transition: background 200ms ease; }
.partiel .num.is-done { background: var(--part, var(--color-ok)); color: #111; box-shadow: none; }
.partiel .line { background: var(--color-card-2); box-shadow: 0 0 0 1px var(--color-line); }
.partiel .line .status { color: #fff; }
.partiel .line.is-ok .status { background: var(--color-ok); }
.partiel .line.is-mid .status { background: var(--color-warn); }
.partiel .line.is-ko .status { background: var(--color-err); }
.partiel .line.is-ko { box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-err) 35%, var(--color-line)); }
.partiel .demo-recap { background: var(--color-card); box-shadow: 0 0 0 1px var(--color-line), 0 20px 40px -18px rgba(0,0,0,.45); }
.partiel .tip { background: color-mix(in srgb, var(--part) 10%, var(--color-card-2)); }
.partiel .score-ring { transition: stroke-dashoffset 900ms cubic-bezier(.2,.7,.2,1); }
.partiel .score-bar { animation: partiel-grow 700ms cubic-bezier(.2,.7,.2,1) both; transform-origin: left; }
@keyframes partiel-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@media (prefers-reduced-motion: reduce) {
  .partiel *, .partiel *::before { transition: none !important; animation: none !important; }
}
`
