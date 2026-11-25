/**
 * MAQUETTE STATIQUE (phase 1) : face avant de l'oscilloscope « GEII DSO-2102 » et banc TP1 câblé, données factices.
 * Sert uniquement à valider la direction visuelle avant l'implémentation ; rien n'est branché au moteur.
 * Deux variantes de paillasse : stratifié clair / époxy sombre. Instruments : boîtier mat anthracite.
 */
import { useState, type CSSProperties, type ReactNode } from 'react'
import Layout from '../../modbus/pages/Layout'

type Variante = 'claire' | 'sombre'

const CH1 = '#f5d90a'
const CH2 = '#34d399'
const RUN = '#22c55e'
const AMBRE = '#f59e0b'
const INK = '#eceff2'

/** Jetons de matière (boîtier, sérigraphie, paillasse) selon la variante */
const THEMES: Record<Variante, CSSProperties> = {
  claire: {
    '--bench': '#d8d4cb',
    '--bench-2': '#cbc6bb',
    '--bench-grain': 'rgba(60,50,30,0.05)',
    '--case-1': '#34383d',
    '--case-2': '#24272b',
    '--bench-ink': '#2b2b2b',
    '--rim': 'rgba(255,255,255,0.04)',
    '--reel': '#2c2f33',
  } as CSSProperties,
  sombre: {
    '--bench': '#2c322f',
    '--bench-2': '#232825',
    '--bench-grain': 'rgba(255,255,255,0.035)',
    '--case-1': '#2e3236',
    '--case-2': '#1c1f22',
    '--bench-ink': '#e6e8e6',
    '--rim': 'rgba(255,255,255,0.16)',
    '--reel': '#3a3f44',
  } as CSSProperties,
}

export default function LaboMaquette() {
  const [v, setV] = useState<Variante>('claire')
  return (
    <Layout>
      <main className="labo mx-auto max-w-7xl px-4 py-8" style={THEMES[v]}>
        <style>{LABO_CSS}</style>
        <p className="text-xs font-semibold tracking-[0.2em] text-muted">RÉSEAUX · MAQUETTE VISUELLE (PHASE 1)</p>
        <h1 className="mt-1 text-2xl font-bold">Paillasse de TP : oscilloscope et banc TP1</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">Maquette statique, données factices : rien n’est encore branché au simulateur. Deux matières de paillasse à comparer.</p>
        <div role="group" aria-label="Variante de paillasse" className="mt-3 inline-flex overflow-hidden rounded-lg ring-1 ring-line">
          {(['claire', 'sombre'] as const).map((k) => (
            <button key={k} type="button" aria-pressed={v === k} onClick={() => setV(k)} className={`min-h-11 px-4 text-sm ${v === k ? 'bg-accent text-on-accent' : 'text-muted hover:text-ink'}`}>
              {k === 'claire' ? 'A · Stratifié clair' : 'B · Époxy sombre'}
            </button>
          ))}
        </div>

        <section className="bench mt-6 rounded-2xl p-3 sm:p-6">
          <ScopeFront />
        </section>

        <section className="bench mt-6 rounded-2xl p-3 sm:p-6">
          <h2 className="bench-title mb-2 text-sm font-semibold tracking-wide">BANC TP1 · montage 3.2.2 b (générateur → Té sur CH1 → câble → extrémité ouverte)</h2>
          <div className="overflow-x-auto pb-2" tabIndex={0} aria-label="Banc de TP (faites défiler horizontalement sur petit écran)">
            <BenchScene />
          </div>
          <p className="bench-title mt-1 text-xs opacity-75 sm:hidden">Faites glisser la paillasse pour la parcourir · plus confortable en paysage.</p>
        </section>
      </main>
    </Layout>
  )
}

/* ─────────────────────────── Oscilloscope : face avant ─────────────────────────── */

function ScopeFront() {
  return (
    <div className="case relative rounded-[22px] p-3 sm:p-5" aria-label="Oscilloscope GEII DSO-2102, face avant (maquette)">
      <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
        <span className="silk text-[13px] font-semibold tracking-[0.18em]">GEII DSO-2102</span>
        <span className="silk hidden text-[11px] tracking-[0.14em] opacity-80 sm:inline">DIGITAL STORAGE OSCILLOSCOPE · 100 MHz · 2 GSa/s</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Écran + touches contextuelles */}
        <div className="min-w-0">
          <div className="flex gap-2">
            <div className="bezel min-w-0 flex-1 rounded-xl p-2">
              <Screen />
            </div>
            <div className="hidden flex-col justify-around gap-1 sm:flex" aria-label="Touches contextuelles">
              {SOFTKEYS.map((k) => (
                <Key key={k} label="" small aria={`Touche contextuelle : ${k}`} />
              ))}
            </div>
          </div>
          <div className="mt-2 grid grid-cols-6 gap-1 sm:hidden" aria-label="Touches contextuelles">
            {SOFTKEYS.map((k) => (
              <Key key={k} label="" small aria={`Touche contextuelle : ${k}`} />
            ))}
          </div>
          <BncRow />
        </div>
        {/* Commandes : grille sur ordinateur, panneaux balayables sur mobile */}
        <Controls />
      </div>
    </div>
  )
}

const SOFTKEYS = ['Couplage DC', 'Sonde 1:1', 'Limite BP', 'Inverser', 'Fin', 'Retour']

function Screen() {
  // Graticule 10 × 8 div de 50 px ; bandeau d'état en haut, échelles en bas, libellés des touches à droite
  const X0 = 0
  const Y0 = 24
  const D = 50
  const W = 10 * D
  const H = 8 * D
  const yCh1 = Y0 + 5 * D
  const yCh2 = Y0 + 7.5 * D
  // Impulsion incidente (40 ns à 100 ns/div), écho arrondi à 2τ, impulsion d'extrémité sur CH2 à τ
  const ch1 = `M0 ${yCh1} L48 ${yCh1} L50 ${yCh1 - 4 * D} L68 ${yCh1 - 4 * D} L70 ${yCh1} L446 ${yCh1} C452 ${yCh1} 452 ${yCh1 - 3.2 * D} 460 ${yCh1 - 3.2 * D} C468 ${yCh1 - 3.2 * D} 470 ${yCh1 - 0.4 * D} 478 ${yCh1} L500 ${yCh1}`
  const ch2 = `M0 ${yCh2} L246 ${yCh2} C250 ${yCh2} 250 ${yCh2 - 1.9 * D} 256 ${yCh2 - 1.9 * D} L268 ${yCh2 - 1.9 * D} C272 ${yCh2 - 1.9 * D} 273 ${yCh2} 278 ${yCh2} L500 ${yCh2}`
  return (
    <svg viewBox="0 0 600 448" className="block w-full" role="img" aria-label="Écran : CH1 impulsion incidente puis écho à 800 ns ; CH2 impulsion à l’extrémité à 400 ns">
      <defs>
        <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.09" />
          <stop offset="0.35" stopColor="#fff" stopOpacity="0.02" />
          <stop offset="0.36" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <filter id="glow" x="-5%" y="-20%" width="110%" height="140%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width="600" height="448" fill="#05080a" />
      {/* Bandeau d'état */}
      <g fontFamily="ui-monospace, 'JetBrains Mono', monospace" fontSize="13">
        <rect width="600" height="22" fill="#11161a" />
        <text x="8" y="16" fill={INK}>
          100 ns/
        </text>
        <text x="84" y="16" fill={INK}>
          Δ 400,0 ns
        </text>
        <rect x="186" y="4" width="84" height="15" rx="3" fill="#1d2a1f" />
        <text x="192" y="16" fill={RUN}>
          Trig’d
        </text>
        <text x="282" y="16" fill={CH1}>
          ↑ 1  2,00 V
        </text>
        <text x="390" y="16" fill={INK} opacity="0.75">
          Normal
        </text>
        <text x="470" y="16" fill={INK} opacity="0.75">
          2,00 GSa/s
        </text>
      </g>
      {/* Graticule pointillé */}
      <g stroke="rgba(200,212,222,0.22)" strokeWidth="1" strokeDasharray="1 4">
        {Array.from({ length: 11 }, (_, i) => (
          <line key={`v${i}`} x1={X0 + i * D + 0.5} y1={Y0} x2={X0 + i * D + 0.5} y2={Y0 + H} />
        ))}
        {Array.from({ length: 9 }, (_, j) => (
          <line key={`h${j}`} x1={X0} y1={Y0 + j * D + 0.5} x2={X0 + W} y2={Y0 + j * D + 0.5} />
        ))}
      </g>
      <g stroke="rgba(200,212,222,0.4)">
        {Array.from({ length: 51 }, (_, k) => (
          <line key={k} x1={k * 10 + 0.5} y1={Y0 + H / 2 - 3} x2={k * 10 + 0.5} y2={Y0 + H / 2 + 3} />
        ))}
        {Array.from({ length: 41 }, (_, k) => (
          <line key={k} x1={W / 2 - 3} y1={Y0 + k * 10 + 0.5} x2={W / 2 + 3} y2={Y0 + k * 10 + 0.5} />
        ))}
      </g>
      <rect x="0.5" y={Y0 + 0.5} width={W - 1} height={H - 1} fill="none" stroke="rgba(200,212,222,0.35)" />
      {/* Traces */}
      <g fill="none" strokeWidth="1.8" strokeLinejoin="round" filter="url(#glow)">
        <path d={ch1} stroke={CH1} />
        <path d={ch2} stroke={CH2} />
      </g>
      {/* Repères : masses, niveau et instant de déclenchement */}
      <path d={`M0 ${yCh1 - 7} L11 ${yCh1} L0 ${yCh1 + 7} Z`} fill={CH1} />
      <path d={`M0 ${yCh2 - 7} L11 ${yCh2} L0 ${yCh2 + 7} Z`} fill={CH2} />
      <path d={`M${W} ${yCh1 - 2 * D - 7} L${W - 11} ${yCh1 - 2 * D} L${W} ${yCh1 - 2 * D + 7} Z`} fill={CH1} />
      <path d={`M43 ${Y0} L57 ${Y0} L50 ${Y0 + 10} Z`} fill="#fb923c" />
      {/* Libellés des touches contextuelles */}
      <g fontFamily="system-ui, sans-serif">
        {SOFTKEYS.map((k, i) => {
          const [a, b] = k.split(' ')
          return (
            <g key={k} transform={`translate(506 ${Y0 + 4 + i * 66})`}>
              <rect width="90" height="58" rx="4" fill="#0f1418" stroke="rgba(200,212,222,0.25)" />
              <text x="45" y="24" textAnchor="middle" fontSize="12" fill={INK}>
                {a}
              </text>
              <text x="45" y="42" textAnchor="middle" fontSize="12" fill={i === 0 || i === 1 ? CH1 : INK} opacity={b ? 1 : 0}>
                {b ?? ''}
              </text>
            </g>
          )
        })}
      </g>
      {/* Échelles des voies */}
      <g fontFamily="ui-monospace, 'JetBrains Mono', monospace" fontSize="13">
        <rect y={Y0 + H} width="600" height={448 - Y0 - H} fill="#11161a" />
        <text x="8" y={Y0 + H + 17} fill={CH1}>
          1  1,00 V/  DC  1:1
        </text>
        <text x="190" y={Y0 + H + 17} fill={CH2}>
          2  2,00 V/  DC  1:1
        </text>
        <text x="372" y={Y0 + H + 17} fill={INK} opacity="0.75">
          Acq. Normal
        </text>
      </g>
      <rect width="600" height="448" fill="url(#glass)" pointerEvents="none" />
    </svg>
  )
}

function BncRow() {
  return (
    <div className="mt-3 flex flex-wrap items-end justify-between gap-3 px-1">
      <div className="flex items-end gap-3">
        <PowerKey />
        <span className="silk hidden text-[10px] tracking-[0.14em] opacity-70 md:inline">USB</span>
      </div>
      <div className="flex items-end gap-4 sm:gap-6">
        <Bnc label="CH1" ring={CH1} sub="1 MΩ ≈ 16 pF" />
        <Bnc label="CH2" ring={CH2} sub="300 V CAT I" />
        <Bnc label="EXT TRIG" />
      </div>
    </div>
  )
}

/** Commandes regroupées comme sur l'appareil ; sous 640 px : panneaux balayables */
function Controls() {
  const panels: [string, ReactNode][] = [
    [
      'Horizontal',
      <Group key="h" title="HORIZONTAL">
        <div className="flex items-end justify-around gap-3">
          <Knob size={72} label="s/div" sub="Appui : —" angle={-40} />
          <Knob size={52} label="Retard" sub="Appui : 0" angle={20} />
          <Key label="Zoom" />
        </div>
      </Group>,
    ],
    [
      'Vertical',
      <Group key="v" title="VERTICAL">
        <div className="grid grid-cols-2 gap-3">
          {[
            ['1', CH1, 10],
            ['2', CH2, -25],
          ].map(([n, c, a]) => (
            <div key={n as string} className="flex flex-col items-center gap-2">
              <Key label={n as string} lit={c as string} aria={`Voie ${n} (allumée)`} round />
              <Knob size={56} label="V/div" angle={a as number} tint={c as string} />
              <Knob size={40} label="Position" sub="Appui : 0" angle={0} />
            </div>
          ))}
        </div>
      </Group>,
    ],
    [
      'Trigger',
      <Group key="t" title="TRIGGER">
        <div className="flex items-end justify-around gap-3">
          <Knob size={56} label="Niveau" sub="Appui : 50 %" angle={-15} />
          <div className="flex flex-col gap-2">
            <Key label="Menu" />
            <Key label="Force" />
          </div>
        </div>
      </Group>,
    ],
    [
      'Run · Mesures',
      <div key="r" className="grid gap-3">
        <Group title="RUN CONTROL">
          <div className="flex justify-around gap-2">
            <Key label="Run/Stop" lit={RUN} wide />
            <Key label="Single" lit={AMBRE} dim wide />
          </div>
        </Group>
        <Group title="">
          <div className="grid grid-cols-2 gap-2">
            <Key label="Auto Scale" wide />
            <Key label="Default Setup" wide />
            <Key label="Acquire" wide />
            <Key label="Cursors" wide />
            <Key label="Meas" wide />
            <div className="flex justify-center">
              <Knob size={48} label="" sub="Universelle" angle={60} />
            </div>
          </div>
        </Group>
      </div>,
    ],
  ]
  return (
    <div className="min-w-0">
      <p className="silk mb-2 text-[11px] opacity-75 sm:hidden">Balayez les panneaux ←→ · plus confortable en paysage</p>
      <div className="panels -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-1">
        {panels.map(([name, p]) => (
          <div key={name} className="w-[82%] shrink-0 snap-center sm:w-auto" aria-label={`Panneau ${name}`}>
            {p}
          </div>
        ))}
      </div>
    </div>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="group-frame rounded-xl px-3 pb-3 pt-1">
      {title && <legend className="silk px-1 text-[11px] font-semibold tracking-[0.16em]">{title}</legend>}
      {children}
    </fieldset>
  )
}

/** Molette moletée : couronne striée, capuchon, repère ; rotation animée */
function Knob({ size, label, sub, angle, tint }: { size: number; label: string; sub?: string; angle: number; tint?: string }) {
  const r = size / 2
  const teeth = Math.round(size * 0.9)
  return (
    <div className="flex flex-col items-center gap-1">
      <button type="button" className="knob rounded-full" style={{ width: Math.max(48, size), height: Math.max(48, size) }} aria-label={`${label || 'Molette universelle'} (maquette)`}>
        <svg width={size} height={size} viewBox={`${-r} ${-r} ${size} ${size}`} className="block">
          <defs>
            <radialGradient id={`kc${size}`} cx="35%" cy="30%" r="80%">
              <stop offset="0" stopColor="#5b6168" />
              <stop offset="0.55" stopColor="#30343a" />
              <stop offset="1" stopColor="#17191c" />
            </radialGradient>
          </defs>
          <circle r={r - 0.5} fill="#121417" />
          <g stroke="#4a4f55" strokeWidth="1.2">
            {Array.from({ length: teeth }, (_, i) => {
              const a = (i / teeth) * 2 * Math.PI
              return <line key={i} x1={Math.cos(a) * (r - 1)} y1={Math.sin(a) * (r - 1)} x2={Math.cos(a) * (r - 4)} y2={Math.sin(a) * (r - 4)} />
            })}
          </g>
          <circle r={r - 5} fill={`url(#kc${size})`} />
          {tint && <circle r={r - 5} fill="none" stroke={tint} strokeOpacity="0.55" strokeWidth="1.5" />}
          <g className="knob-rot" style={{ transform: `rotate(${angle}deg)` }}>
            <line x1="0" y1={-(r - 7)} x2="0" y2={-(r * 0.35)} stroke={INK} strokeWidth="2" strokeLinecap="round" />
          </g>
        </svg>
      </button>
      {label && <span className="silk text-[11px] tracking-wide">{label}</span>}
      {sub && <span className="silk text-[10px] opacity-60">{sub}</span>}
    </div>
  )
}

/** Touche : caoutchouc gris, éventuellement lumineuse avec halo */
function Key({ label, lit, dim, wide, small, round, aria }: { label: string; lit?: string; dim?: boolean; wide?: boolean; small?: boolean; round?: boolean; aria?: string }) {
  const on = lit && !dim
  return (
    <button
      type="button"
      aria-label={aria ?? `${label} (maquette)`}
      aria-pressed={lit ? !dim : undefined}
      className={`key ${round ? 'rounded-full' : 'rounded-lg'} ${small ? 'h-11 min-w-11 sm:h-12 sm:w-9 sm:min-w-0' : wide ? 'min-h-11 px-3' : 'min-h-11 min-w-12 px-2'} text-[12px] font-semibold`}
      style={
        lit
          ? ({
              background: on ? lit : `color-mix(in srgb, ${lit} 30%, #2a2d31)`,
              color: on ? '#101214' : INK,
              boxShadow: on ? `0 0 14px 1px ${lit}88, inset 0 1px 0 rgba(255,255,255,.35)` : undefined,
            } as CSSProperties)
          : undefined
      }
    >
      {label}
    </button>
  )
}

function PowerKey() {
  return (
    <button type="button" aria-label="Interrupteur (maquette)" className="key flex h-11 w-11 items-center justify-center rounded-full">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={RUN} strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <path d="M12 3v8" />
        <path d="M6.3 7a8 8 0 1 0 11.4 0" />
      </svg>
    </button>
  )
}

/** Embase BNC femelle : écrou chromé, ergots de baïonnette, isolant, âme */
function Bnc({ label, ring, sub, size = 48 }: { label: string; ring?: string; sub?: string; size?: number }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox="-24 -24 48 48" role="img" aria-label={`Embase BNC ${label}`}>
        <BncShape ring={ring} />
      </svg>
      <span className="silk text-[11px] font-semibold tracking-wide">{label}</span>
      {sub && <span className="silk hidden text-[9px] opacity-60 sm:inline">{sub}</span>}
    </div>
  )
}

function BncShape({ ring }: { ring?: string }) {
  return (
    <g>
      <defs>
        <radialGradient id="chrome" cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#f4f6f8" />
          <stop offset="0.5" stopColor="#a9b1b9" />
          <stop offset="1" stopColor="#5d646b" />
        </radialGradient>
      </defs>
      {ring && <circle r="22" fill="none" stroke={ring} strokeWidth="2.5" opacity="0.9" />}
      <polygon points="18,0 9,15.6 -9,15.6 -18,0 -9,-15.6 9,-15.6" fill="url(#chrome)" stroke="#3b4046" strokeWidth="0.8" />
      <circle r="11" fill="url(#chrome)" stroke="#3b4046" strokeWidth="0.8" />
      <rect x="-13.5" y="-2" width="4" height="4" rx="1" fill="#c9ced3" stroke="#555" strokeWidth="0.5" />
      <rect x="9.5" y="-2" width="4" height="4" rx="1" fill="#c9ced3" stroke="#555" strokeWidth="0.5" />
      <circle r="7" fill="#e9e4d6" />
      <circle r="2" fill="#c8a24a" />
    </g>
  )
}

/* ─────────────────────────── Banc TP1 câblé ─────────────────────────── */

function BenchScene() {
  const silk = { fill: '#e9ecef', fontFamily: 'system-ui, sans-serif' }
  const mono = { fontFamily: "ui-monospace, 'JetBrains Mono', monospace" }
  // Points de branchement
  const out = { x: 318, y: 318 }
  const teeL = { x: 846, y: 300 }
  const teeR = { x: 902, y: 300 }
  const ch1 = { x: 874, y: 330 }
  return (
    <svg viewBox="0 0 1200 600" className="block w-full min-w-[760px]" role="img" aria-label="Banc TP1 : générateur PG-50 relié par un cordon court à un Té monté sur CH1 de l’oscilloscope ; le câble coaxial du touret part de l’autre bras du Té, son extrémité est ouverte ; plateau d’accessoires en bas">
      <defs>
        <linearGradient id="case" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--case-1)" />
          <stop offset="1" stopColor="var(--case-2)" />
        </linearGradient>
        <linearGradient id="rubber" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3d41" />
          <stop offset="1" stopColor="#141517" />
        </linearGradient>
        <radialGradient id="chromeB" cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#f4f6f8" />
          <stop offset="0.5" stopColor="#a9b1b9" />
          <stop offset="1" stopColor="#5d646b" />
        </radialGradient>
        <filter id="soft" x="-10%" y="-10%" width="120%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="#000" floodOpacity="0.28" />
        </filter>
        <filter id="glowB">
          <feGaussianBlur stdDeviation="1.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Générateur PG-50 */}
      <g filter="url(#soft)">
        <rect x="40" y="150" width="320" height="200" rx="16" fill="url(#case)" stroke="var(--rim)" />
      </g>
      <text x="60" y="178" fontSize="13" fontWeight="600" letterSpacing="2.4" {...silk}>
        GEII PG-50
      </text>
      <text x="232" y="178" fontSize="9" letterSpacing="1.4" opacity="0.7" {...silk}>
        PULSE GENERATOR
      </text>
      <rect x="60" y="192" width="200" height="64" rx="6" fill="#0a0f0c" stroke="#000" />
      <g {...mono} fill="#7dffa8" filter="url(#glowB)">
        <text x="72" y="216" fontSize="18">
          8,00 V
        </text>
        <text x="160" y="216" fontSize="18">
          40 ns
        </text>
        <text x="72" y="244" fontSize="14" opacity="0.85">
          T 1,000 ms · Imp.
        </text>
      </g>
      {[
        [92, 'Amplitude'],
        [162, 'Largeur'],
        [232, 'Période'],
      ].map(([x, l]) => (
        <g key={l as string} transform={`translate(${x} 292)`}>
          <circle r="21" fill="#121417" />
          <g stroke="#4a4f55" strokeWidth="1.1">
            {Array.from({ length: 36 }, (_, i) => {
              const a = (i / 36) * 2 * Math.PI
              return <line key={i} x1={Math.cos(a) * 20} y1={Math.sin(a) * 20} x2={Math.cos(a) * 17} y2={Math.sin(a) * 17} />
            })}
          </g>
          <circle r="16" fill="#30343a" />
          <line x1="0" y1="-14" x2="0" y2="-6" stroke="#eceff2" strokeWidth="2" strokeLinecap="round" transform="rotate(25)" />
          <text y="38" textAnchor="middle" fontSize="10" {...silk}>
            {l}
          </text>
        </g>
      ))}
      <g transform="translate(282 200)">
        {[
          ['Impulsion', true],
          ['Sinus', false],
        ].map(([l, on], i) => (
          <g key={l as string} transform={`translate(0 ${i * 30})`}>
            <rect width="62" height="22" rx="5" fill={on ? CH1 : '#3a3f45'} style={on ? { filter: `drop-shadow(0 0 6px ${CH1})` } : undefined} />
            <text x="31" y="15" textAnchor="middle" fontSize="10" fontWeight="600" fill={on ? '#111' : '#e9ecef'} fontFamily="system-ui, sans-serif">
              {l}
            </text>
          </g>
        ))}
      </g>
      <g transform={`translate(${out.x} ${out.y})`}>
        <BncShape ring={RUN} />
      </g>
      <text x={out.x} y={out.y - 28} textAnchor="middle" fontSize="10" fontWeight="600" {...silk}>
        OUTPUT 50 Ω
      </text>

      {/* Oscilloscope DSO-2102 (vue de paillasse) */}
      <g filter="url(#soft)">
        <rect x="760" y="70" width="400" height="300" rx="18" fill="url(#case)" stroke="var(--rim)" />
      </g>
      <text x="782" y="98" fontSize="13" fontWeight="600" letterSpacing="2.4" {...silk}>
        GEII DSO-2102
      </text>
      <rect x="780" y="110" width="250" height="180" rx="8" fill="#05080a" stroke="#000" />
      <g stroke="rgba(200,212,222,0.2)" strokeDasharray="1 3">
        {Array.from({ length: 9 }, (_, i) => (
          <line key={i} x1={790 + i * 28.75} y1="118" x2={790 + i * 28.75} y2="282" />
        ))}
        {Array.from({ length: 7 }, (_, j) => (
          <line key={j} x1="790" y1={118 + j * 27.3} x2="1020" y2={118 + j * 27.3} />
        ))}
      </g>
      <path d="M790 240 L812 240 L813 160 L822 160 L823 240 L960 240 C964 240 965 178 970 178 C975 178 976 236 981 240 L1020 240" fill="none" stroke={CH1} strokeWidth="1.6" filter="url(#glowB)" />
      <rect x="780" y="110" width="250" height="60" rx="8" fill="#fff" opacity="0.04" />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <circle cx={1066} cy={130 + i * 44} r="16" fill="#121417" />
          <circle cx={1066} cy={130 + i * 44} r="12" fill="#30343a" />
        </g>
      ))}
      <rect x="1100" y="116" width="40" height="20" rx="4" fill={RUN} style={{ filter: `drop-shadow(0 0 6px ${RUN})` }} />
      <rect x="1100" y="144" width="40" height="20" rx="4" fill="#4a3a16" />
      <g transform={`translate(${ch1.x} ${ch1.y})`}>
        <BncShape ring={CH1} />
      </g>
      <text x={ch1.x} y="363" textAnchor="middle" fontSize="10" fontWeight="600" {...silk}>
        CH1
      </text>
      <g transform="translate(954 330)">
        <BncShape ring={CH2} />
      </g>
      <text x="954" y="363" textAnchor="middle" fontSize="10" fontWeight="600" {...silk}>
        CH2
      </text>
      {/* Cible de branchement libre (CH2) : anneau d'aimantation */}
      <circle cx="954" cy="330" r="27" fill="none" stroke={CH2} strokeWidth="2" strokeDasharray="4 5" className="snap-ring" />

      {/* Té BNC monté sur CH1 */}
      <g>
        <rect x={ch1.x - 8} y={teeL.y} width="16" height="22" fill="url(#chromeB)" stroke="#4b5157" strokeWidth="0.8" />
        <rect x={teeL.x - 6} y={teeL.y - 9} width={teeR.x - teeL.x + 12} height="18" rx="4" fill="url(#chromeB)" stroke="#4b5157" strokeWidth="0.8" />
        <circle cx={teeL.x - 2} cy={teeL.y} r="7" fill="#e9e4d6" stroke="#8a9097" />
        <circle cx={teeR.x + 2} cy={teeR.y} r="7" fill="#e9e4d6" stroke="#8a9097" />
      </g>

      {/* Cordon court : sortie générateur → bras gauche du Té (léger affaissement) */}
      <Cable d={`M${out.x + 14} ${out.y} C 470 ${out.y + 150}, 760 ${teeL.y + 120}, ${teeL.x - 22} ${teeL.y}`} />
      <Plug x={out.x + 14} y={out.y} angle={20} />
      <Plug x={teeL.x - 22} y={teeL.y} angle={-30} />

      {/* Touret de câble coaxial */}
      <g transform="translate(560 200)" filter="url(#soft)">
        <circle r="118" fill="var(--reel)" stroke="var(--rim)" />
        {Array.from({ length: 13 }, (_, i) => (
          <circle key={i} r={110 - i * 5.2} fill="none" stroke={i % 2 ? '#1b1d20' : '#26292d'} strokeWidth="5" />
        ))}
        <circle r="40" fill="#3b4046" stroke="#1d2023" strokeWidth="2" />
        <circle r="10" fill="#1a1c1f" />
        <text y="-56" textAnchor="middle" fontSize="11" fill="#e9ecef" fontFamily="system-ui, sans-serif">
          70 spires
        </text>
        <text y="70" textAnchor="middle" fontSize="11" fill="#e9ecef" fontFamily="system-ui, sans-serif">
          Ø 0,25 m
        </text>
      </g>
      <text x="560" y="342" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--bench-ink)" fontFamily="system-ui, sans-serif">
        Câble coaxial (Zc et l inconnus)
      </text>
      {/* Extrémité A du câble → bras droit du Té ; extrémité B posée, ouverte */}
      <Cable d={`M672 246 C 740 470, 1010 470, ${teeR.x + 24} ${teeR.y}`} />
      <Plug x={teeR.x + 24} y={teeR.y} angle={210} />
      <Cable d="M462 262 C 420 330, 420 380, 452 408" />
      <Plug x={452} y={408} angle={60} />
      <text x="474" y="428" fontSize="11" fill="var(--bench-ink)" fontFamily="system-ui, sans-serif">
        extrémité ouverte
      </text>

      {/* Plateau d'accessoires */}
      <rect x="30" y="448" width="1140" height="140" rx="16" fill="rgba(0,0,0,0.10)" stroke="rgba(0,0,0,0.12)" />
      <text x="48" y="470" fontSize="11" fontWeight="600" letterSpacing="1.6" fill="var(--bench-ink)" fontFamily="system-ui, sans-serif">
        ACCESSOIRES
      </text>
      <Tray x={110} label="Té BNC">
        <rect x="-4" y="-2" width="8" height="16" fill="url(#chromeB)" />
        <rect x="-24" y="-12" width="48" height="14" rx="4" fill="url(#chromeB)" stroke="#4b5157" strokeWidth="0.8" />
      </Tray>
      <Tray x={230} label="Bouchon 50 Ω">
        <Terminator text="50Ω" />
      </Tray>
      <Tray x={350} label="Bouchon 75 Ω">
        <Terminator text="75Ω" />
      </Tray>
      <Tray x={470} label="Court-circuit">
        <Terminator text="CC" />
      </Tray>
      <Tray x={610} label="Potentiomètre 0–200 Ω">
        <rect x="-38" y="-22" width="76" height="44" rx="7" fill="url(#case)" />
        <circle cx="-10" r="12" fill="#121417" />
        <circle cx="-10" r="9" fill="#30343a" />
        <line x1="-10" y1="-8" x2="-10" y2="-3" stroke="#eceff2" strokeWidth="2" strokeLinecap="round" />
        <g transform="translate(22 0) scale(0.5)">
          <BncShape />
        </g>
      </Tray>
      <Tray x={780} label="Multimètre">
        <rect x="-34" y="-34" width="68" height="62" rx="9" fill="#2b2f33" stroke="#111" />
        <rect x="-26" y="-27" width="52" height="20" rx="3" fill="#b9c6a8" />
        <text x="0" y="-12" textAnchor="middle" fontSize="12" fill="#1d2416" {...mono}>
          OL Ω
        </text>
        <circle cy="12" r="10" fill="#121417" />
        <path d="M-30 26 C -50 40, -60 30, -64 18" fill="none" stroke="#c0392b" strokeWidth="3" />
        <path d="M30 26 C 50 40, 60 30, 64 18" fill="none" stroke="#111" strokeWidth="3" />
      </Tray>
      <Tray x={940} label="Cordon BNC 1 m">
        <circle r="22" fill="none" stroke="#1b1c1f" strokeWidth="6" />
        <circle r="14" fill="none" stroke="#2a2c30" strokeWidth="5" />
        <rect x="16" y="-4" width="18" height="8" rx="2" fill="url(#chromeB)" />
      </Tray>
      <Tray x={1080} label="Té BNC">
        <rect x="-4" y="-2" width="8" height="16" fill="url(#chromeB)" />
        <rect x="-24" y="-12" width="48" height="14" rx="4" fill="url(#chromeB)" stroke="#4b5157" strokeWidth="0.8" />
      </Tray>
    </svg>
  )
}

/** Câble coaxial : gaine caoutchouc avec reflet */
function Cable({ d }: { d: string }) {
  return (
    <g fill="none" strokeLinecap="round">
      <path d={d} stroke="#0d0e10" strokeWidth="9" />
      <path d={d} stroke="#26282c" strokeWidth="6.5" />
      <path d={d} stroke="rgba(255,255,255,0.14)" strokeWidth="1.6" transform="translate(-1 -2)" />
    </g>
  )
}

/** Fiche BNC mâle : manchon moleté chromé */
function Plug({ x, y, angle }: { x: number; y: number; angle: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <rect x="-12" y="-8" width="24" height="16" rx="3" fill="url(#chromeB)" stroke="#4b5157" strokeWidth="0.8" />
      {[-7, -3, 1, 5].map((k) => (
        <line key={k} x1={k} y1="-8" x2={k} y2="8" stroke="#6b737b" strokeWidth="0.8" />
      ))}
    </g>
  )
}

function Terminator({ text }: { text: string }) {
  return (
    <g>
      <rect x="-18" y="-11" width="22" height="22" rx="4" fill="url(#chromeB)" stroke="#4b5157" strokeWidth="0.8" />
      <rect x="4" y="-9" width="16" height="18" rx="5" fill={text === 'CC' ? '#3b3f44' : '#1f2328'} />
      <text x="12" y="4" textAnchor="middle" fontSize="7" fontWeight="700" fill="#e9ecef" fontFamily="system-ui, sans-serif">
        {text}
      </text>
    </g>
  )
}

function Tray({ x, label, children }: { x: number; label: string; children: ReactNode }) {
  return (
    <g transform={`translate(${x} 525)`} className="tray-item">
      <rect x="-56" y="-46" width="112" height="92" rx="12" fill="rgba(255,255,255,0.05)" stroke="rgba(0,0,0,0.10)" />
      {children}
      <text y="40" textAnchor="middle" fontSize="11" fill="var(--bench-ink)" fontFamily="system-ui, sans-serif">
        {label}
      </text>
    </g>
  )
}

const LABO_CSS = `
.labo .bench {
  background-color: var(--bench);
  background-image:
    radial-gradient(1200px 400px at 20% -10%, rgba(255,255,255,0.10), transparent 60%),
    repeating-linear-gradient(115deg, var(--bench-grain) 0 2px, transparent 2px 7px),
    linear-gradient(180deg, var(--bench), var(--bench-2));
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), 0 1px 2px rgba(0,0,0,0.08);
}
.labo .bench-title { color: var(--bench-ink); }
.labo .case {
  background: linear-gradient(180deg, var(--case-1), var(--case-2));
  box-shadow: 0 22px 40px -18px rgba(0,0,0,0.55), 0 0 0 1px var(--rim), 0 2px 0 rgba(255,255,255,0.06) inset, 0 -2px 0 rgba(0,0,0,0.4) inset;
}
.labo .silk { color: #eceff2; }
.labo .bezel { background: #0b0d0f; box-shadow: inset 0 2px 6px rgba(0,0,0,0.8), 0 1px 0 rgba(255,255,255,0.06); }
.labo .group-frame { border: 1px solid rgba(236,239,242,0.22); }
.labo .key {
  color: #eceff2;
  background: linear-gradient(180deg, #474c53, #33373c);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.18), 0 2px 0 #141619, 0 3px 6px rgba(0,0,0,0.35);
  transition: transform 160ms ease, box-shadow 160ms ease, background 200ms ease;
}
.labo .key:active { transform: translateY(1px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.1), 0 1px 0 #141619; }
.labo .key:focus-visible, .labo .knob:focus-visible { outline: 2px solid #93c5fd; outline-offset: 3px; }
.labo .knob { display: inline-flex; align-items: center; justify-content: center; filter: drop-shadow(0 4px 5px rgba(0,0,0,0.45)); }
.labo .knob .knob-rot { transition: transform 200ms ease; transform-box: view-box; transform-origin: 0 0; }
.labo .knob:hover .knob-rot { transform: rotate(45deg) !important; }
.labo .snap-ring { animation: labo-pulse 1.6s ease-in-out infinite; transform-origin: 954px 330px; }
@keyframes labo-pulse { 0%, 100% { opacity: 0.35; } 50% { opacity: 1; } }
.labo .panels { scrollbar-width: thin; }
@media (prefers-reduced-motion: reduce) {
  .labo .key, .labo .knob .knob-rot { transition: none; }
  .labo .snap-ring { animation: none; opacity: 0.8; }
}
`
