import { useRef, useState } from 'react'
import { bilanMas, coupleMas, nSync, pointMas, type Mas } from '../physique'
import { conducteur, fleche, fr, mono, REDUCE, secteur, TAU, useCanvas } from '../canvas'
import { Bouton, Choix, Curseur, Deux, Formules, Legende, Lecture, Ligne, Mesures, Panel, Pastille, Section, Toile } from '../ui'

/** Machine d'étude : 4 kW environ, Cmax ≈ 2,5 × Cn. */
const BASE = { f: 50, cmax: 65, gm: 0.2 }
type Charge = 'constant' | 'ventilateur'
/** Encoches d'une paire de pôles : angle électrique (°), phase, sens */
const ENCOCHES = [
  [30, 1, -1],
  [90, 0, 1],
  [150, 2, -1],
  [210, 1, 1],
  [270, 0, -1],
  [330, 2, 1],
] as const
const pertesFixes = (c: number) => ({ pjs: 120 + 130 * (c / 25) ** 2, pfs: 150, pm: 60 })

export default function Asynchrone() {
  const [p, setP] = useState(2)
  const [charge, setCharge] = useState<Charge>('constant')
  const [cr0, setCr0] = useState(25)
  const [play, setPlay] = useState(!REDUCE)
  const [exag, setExag] = useState(true)
  const m: Mas = { ...BASE, p }
  const ns = nSync(m.f, p)
  const cr = (n: number) => (charge === 'constant' ? cr0 : cr0 * (n / ns) ** 2)
  const pt = pointMas(m, cr)
  const st = useRef({ n: pt?.n ?? 0, phi: 0, th: 0 })
  const [nAff, setNAff] = useState(pt?.n ?? 0)

  const avance = (dt: number) => {
    const s = st.current
    if (!dt) return
    s.n = Math.max(0, Math.min(ns * 1.02, s.n + 4 * ns * 0.002 * (coupleMas(m, s.n) - cr(s.n)) * dt))
    const g = 1 - s.n / ns
    s.phi += TAU * 0.6 * dt
    s.th += ((TAU * 0.6) / p) * (1 - Math.max(-1, Math.min(1, g * (exag ? 5 : 1)))) * dt
    if (Math.abs(s.n - nAff) > 0.5) setNAff(s.n)
  }

  const moteur = useCanvas(
    (ctx, w, h, dt, c) => {
      avance(dt)
      const s = st.current
      const cx = w / 2
      const cy = h / 2
      const S = Math.min(w, h)
      const Ro = S * 0.485
      const Ri = S * 0.36
      const Rr = S * 0.315
      const pt2 = (r: number, t: number): [number, number] => [cx + r * Math.cos(t), cy - r * Math.sin(t)]
      const g = 1 - s.n / ns
      const I = [Math.cos(s.phi), Math.cos(s.phi - TAU / 3), Math.cos(s.phi - (2 * TAU) / 3)]
      const PC = [c.l1, c.l2, c.l3]
      ctx.beginPath()
      ctx.arc(cx, cy, Ro, 0, TAU)
      ctx.arc(cx, cy, Ri, 0, TAU, true)
      ctx.fillStyle = c.steel
      ctx.fill()
      for (let i = 0; i < 240; i++) {
        const a0 = (i / 240) * TAU
        const a1 = ((i + 1.05) / 240) * TAU
        const B = Math.cos((p * (a0 + a1)) / 2 - s.phi)
        ctx.globalAlpha = 0.12 + 0.85 * Math.abs(B)
        ctx.fillStyle = B > 0 ? c.north : c.south
        secteur(ctx, cx, cy, Rr + 1, Ri, a0, a1)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      const rs = Ri + S * 0.045
      const sr = S * (0.021 * 2) / Math.max(2, p)
      for (let k = 0; k < p; k++)
        for (const [e, ph, sg] of ENCOCHES) {
          const [x, y] = pt2(rs, (e * Math.PI) / 180 / p + (k * TAU) / p)
          ctx.beginPath()
          ctx.arc(x, y, sr, 0, TAU)
          ctx.fillStyle = c.card
          ctx.fill()
          ctx.lineWidth = 2
          ctx.strokeStyle = PC[ph]
          ctx.stroke()
          conducteur(ctx, x, y, sr, sg * I[ph], PC[ph])
        }
      ctx.beginPath()
      ctx.arc(cx, cy, Rr, 0, TAU)
      ctx.fillStyle = c.rotor
      ctx.fill()
      const mag = Math.max(-1, Math.min(1, g / 0.05))
      for (let k = 0; k < 30; k++) {
        const t = s.th + (k * TAU) / 30
        const [x, y] = pt2(Rr * 0.86, t)
        const v = mag * Math.cos(p * t - s.phi)
        ctx.beginPath()
        ctx.arc(x, y, S * 0.017, 0, TAU)
        ctx.fillStyle = c.copper
        ctx.globalAlpha = 0.28 + 0.72 * Math.abs(v)
        ctx.fill()
        ctx.globalAlpha = 1
        conducteur(ctx, x, y, S * 0.017, v * 1.15, c.ink)
      }
      const [x0, y0] = pt2(Rr * 0.2, s.th)
      const [x1, y1] = pt2(Rr * 0.74, s.th)
      ctx.strokeStyle = c.copper
      ctx.lineWidth = 4
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y1)
      ctx.stroke()
      ctx.lineCap = 'butt'
      const [x2, y2] = pt2(Ri - 2, s.phi / p)
      ctx.setLineDash([5, 4])
      ctx.strokeStyle = c.north
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(x2, y2)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.arc(cx, cy, Rr * 0.17, 0, TAU)
      ctx.fillStyle = c['steel-2']
      ctx.fill()
    },
    play,
  )

  const courbe = useCanvas((ctx, w, h, _dt, c) => {
    const L = 46
    const T = 22
    const pw = w - L - 12
    const ph = h - T - 34
    const ymax = BASE.cmax * 1.2
    const X = (n: number) => L + (n / (ns * 1.08)) * pw
    const Y = (v: number) => T + ph - (v / ymax) * ph
    ctx.strokeStyle = c.line
    ctx.lineWidth = 1
    ctx.font = mono(10)
    ctx.fillStyle = c.muted
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    for (let v = 0; v <= ymax; v += 20) {
      ctx.beginPath()
      ctx.moveTo(L, Y(v))
      ctx.lineTo(L + pw, Y(v))
      ctx.stroke()
      ctx.fillText(String(v), L - 4, Y(v))
    }
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    for (let k = 0; k <= 4; k++) ctx.fillText(fr((ns * k) / 4, 0), X((ns * k) / 4), T + ph + 4)
    ctx.textAlign = 'left'
    ctx.fillText('C (N·m)', 4, 2)
    ctx.textAlign = 'right'
    ctx.fillText('N (tr/min)', L + pw, h - 12)
    // zone utile linéaire
    ctx.fillStyle = c.ok
    ctx.globalAlpha = 0.07
    ctx.fillRect(X(ns * (1 - BASE.gm)), T, X(ns) - X(ns * (1 - BASE.gm)), ph)
    ctx.globalAlpha = 1
    const trace = (f: (n: number) => number, col: string, lw: number) => {
      ctx.strokeStyle = col
      ctx.lineWidth = lw
      ctx.beginPath()
      for (let i = 0; i <= 300; i++) {
        const n = (ns * 1.08 * i) / 300
        const y = Math.max(T - 2, Math.min(T + ph + 2, Y(f(n))))
        if (i) ctx.lineTo(X(n), y)
        else ctx.moveTo(X(n), y)
      }
      ctx.stroke()
    }
    trace((n) => coupleMas(m, n), c.copper, 3)
    trace(cr, c.ink, 2)
    ctx.setLineDash([4, 4])
    ctx.strokeStyle = c.muted
    ctx.beginPath()
    ctx.moveTo(X(ns), T)
    ctx.lineTo(X(ns), T + ph)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = c.copper
    ctx.font = mono(11, 600)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText('Cmax', X(ns * (1 - BASE.gm)), Y(BASE.cmax) - 4)
    ctx.textAlign = 'left'
    ctx.fillText('Cdém', X(0) + 4, Y(coupleMas(m, 0)) - 4)
    ctx.fillStyle = c.muted
    ctx.font = mono(10)
    ctx.textAlign = 'right'
    ctx.fillText('Ns', X(ns) - 3, T + 12)
    const n = st.current.n
    const a = coupleMas(m, n)
    const r = cr(n)
    if (Math.abs(a - r) > 0.8) fleche(ctx, X(n), Y(r), X(n), Y(a), a > r ? c.copper : c.south, 2)
    ctx.beginPath()
    ctx.arc(X(n), Y(a), 6, 0, TAU)
    ctx.fillStyle = c.copper
    ctx.fill()
    if (pt) {
      ctx.strokeStyle = c.ok
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(X(pt.n), Y(pt.c), 9, 0, TAU)
      ctx.stroke()
    }
  })

  const g = 1 - nAff / ns
  const c = coupleMas(m, nAff)
  const bil = pt && bilanMas({ c: pt.c, n: pt.n, ns, ...pertesFixes(pt.c) })

  return (
    <>
      <Section
        eyebrow="Principe"
        title="Un champ qui tourne, un rotor qui court derrière"
        intro="Le stator crée un champ tournant à Ns. Les barres du rotor, en court-circuit, voient ce champ défiler : des courants y sont induits et, par la loi de Lenz, entraînent le rotor dans le sens du champ. S’il l’atteignait, plus rien ne serait induit : le rotor tourne toujours un peu moins vite."
      >
        <Panel>
          <Deux>
            <div className="space-y-2">
              <Toile cref={moteur} ratio="1" label="Coupe du moteur : stator, entrefer coloré par le champ, rotor à cage" />
              <div>
                <Pastille col="north">pôle N du champ</Pastille>
                <Pastille col="south">pôle S</Pastille>
                <Pastille col="copper">barres du rotor (⊙ sortant, ⊗ entrant)</Pastille>
              </div>
              <Legende>Pointillé rouge : axe du champ. Trait cuivre : repère collé au rotor. L’écart qui grandit entre les deux, c’est le glissement.</Legende>
            </div>
            <div className="space-y-2">
              <Toile cref={courbe} ratio="4/3" label="Couple moteur et couple résistant en fonction de la vitesse" />
              <Legende>
                Cuivre : couple moteur. Noir : couple de la charge. Tant que le moteur l’emporte, la flèche monte et le rotor accélère ; il se stabilise au croisement (cercle vert), dans la zone utile où C ≈ k·g.
              </Legende>
            </div>
          </Deux>
          <span className={`inline-flex w-fit rounded-full px-3 py-1 text-sm font-semibold ring-1 ${!pt ? 'text-err ring-err' : Math.abs(c - cr(nAff)) < 0.6 ? 'text-ok ring-ok' : 'text-copper ring-copper'}`}>
            {!pt ? 'Charge supérieure à Cmax : le moteur décroche et cale' : Math.abs(c - cr(nAff)) < 0.6 ? 'Régime établi : C = Cr' : c > cr(nAff) ? 'C > Cr : le moteur accélère' : 'C < Cr : le moteur ralentit'}
          </span>
          <Mesures
            items={[
              ['Ns champ', fr(ns, 0), 'tr/min = 60·f/p'],
              ['N rotor', fr(nAff, 0), 'tr/min'],
              ['Glissement', `${fr(g * 100, 1)} %`, '(Ns − N)/Ns'],
              ['Couple', fr(c, 1), 'N·m'],
              ['f rotor', fr(g * BASE.f, 1), 'Hz = g·f'],
              ['Pu', fr((c * TAU * nAff) / 60 / 1000, 2), 'kW = C·Ω'],
            ]}
          />
          <Ligne>
            <Choix label="Paires de pôles" value={p} onChange={setP} options={[1, 2, 3, 4].map((k) => [k, `p = ${k}`] as const)} />
            <Choix
              label="Type de charge"
              value={charge}
              onChange={setCharge}
              options={[
                ['constant', 'Couple constant (levage)'],
                ['ventilateur', 'Ventilateur (∝ N²)'],
              ]}
            />
          </Ligne>
          <Ligne>
            <Curseur label={charge === 'constant' ? 'Couple de charge' : 'Couple à Ns'} value={cr0} min={0} max={80} onChange={setCr0} aff={`${cr0} N·m`} />
            <Lecture play={play} setPlay={setPlay} />
            <Bouton on={exag} onClick={() => setExag(!exag)}>
              Glissement visuel ×5
            </Bouton>
          </Ligne>
          <Legende>
            Animation ralentie. Le glissement réel (quelques %) serait invisible : « ×5 » l’exagère dans le dessin seulement. Chargez au-delà de Cmax = {BASE.cmax} N·m : le point de fonctionnement disparaît.
          </Legende>
        </Panel>
        <Formules
          items={[
            ['Glissement', 'g = (Ωs − Ω)/Ωs', 'g = 1 à l’arrêt, g = 0 au synchronisme. Entre 0 et 10 % en fonctionnement normal.'],
            ['Courants rotoriques', 'ωr = p·(Ωs − Ω) = g·ω', 'Le rotor voit le champ défiler à Ωs − Ω : ses courants ont une fréquence g·f.'],
            ['Moteur ou génératrice', 'Ω < Ωs ou Ω > Ωs', 'Entraîné au-dessus de Ns, le couple devient résistant : la machine renvoie de l’énergie (génératrice).'],
          ]}
        />
      </Section>

      <PaireDePoles />
      <Couplage />

      <Section
        eyebrow="Diagramme des puissances"
        title="Ce que le réseau fournit, ce que l’arbre reçoit"
        intro="Au point de fonctionnement réglé plus haut. Le rotor reçoit Ptr = Cem·Ωs ; il en perd la fraction g en effet Joule, le reste devient mécanique."
      >
        {bil ? (
          <Panel>
            <div className="flex h-16 overflow-hidden rounded-lg font-mono text-xs ring-1 ring-line">
              {(
                [
                  ['Pu', bil.pu, 'bg-copper text-white'],
                  ['pméca', bil.pm, 'bg-steel-2'],
                  ['Pjr', bil.pjr, 'bg-north/70 text-white'],
                  ['Pfs', bil.pfs, 'bg-south/60 text-white'],
                  ['Pjs', bil.pjs, 'bg-north/40'],
                ] as const
              ).map(([n, v, cls]) => (
                <div key={n} className={`flex min-w-0 flex-col justify-center overflow-hidden px-2 whitespace-nowrap ${cls}`} style={{ flex: Math.max(v, 1) }}>
                  <b>{n}</b>
                  {fr(v, 0)} W
                </div>
              ))}
            </div>
            <Mesures
              items={[
                ['Pa absorbée', fr(bil.pa, 0), 'W = √3·U·I·cos φ'],
                ['Ptr transmise', fr(bil.ptr, 0), 'W = Cem·Ωs'],
                ['Pméca', fr(bil.pmeca, 0), 'W = Cem·Ω'],
                ['Pu utile', fr(bil.pu, 0), 'W = Cu·Ω'],
                ['Rendement', `${fr(bil.eta * 100, 1)} %`, 'Pu / Pa'],
              ]}
            />
            <Legende>Pertes Joule stator Pjs = 3·Rs·J², pertes fer stator Pfs, pertes Joule rotor Pjr = g·Ptr, pertes mécaniques pméca. Augmentez la charge : Pjr grandit avec g.</Legende>
          </Panel>
        ) : (
          <p className="text-err">Le moteur a décroché : réduisez la charge pour retrouver un point de fonctionnement.</p>
        )}
      </Section>

      <Section eyebrow="Modèle" title="Schéma équivalent par phase" intro="Il permet de prédéterminer courants et tensions. Il n’a qu’une valeur indicative : plus il se veut précis, plus il est complexe.">
        <Deux>
          <svg viewBox="0 0 420 200" role="img" aria-label="Schéma équivalent simplifié de la machine asynchrone" className="w-full rounded-card bg-card ring-1 ring-line">
            <g stroke="var(--color-ink)" strokeWidth="1.6" fill="none">
              <path d="M30,40 H170 M210,40 H260 M300,40 H360 V70 M360,130 V170 H30 M120,40 V75 M120,125 V170 M200,40 M190,40 H170" />
              <path d="M200,40 V75 M200,125 V170" />
              <circle cx="30" cy="105" r="16" />
              <path d="M30,40 V89 M30,121 V170" />
              <rect x="110" y="75" width="20" height="50" fill="var(--color-card)" />
              <path d="M200,75 a6,6 0 0 1 0,12 a6,6 0 0 1 0,12 a6,6 0 0 1 0,12 a6,6 0 0 1 0,12 v2" />
              <path d="M260,40 a6,6 0 0 1 10,0 a6,6 0 0 1 10,0 a6,6 0 0 1 10,0 a6,6 0 0 1 10,0" />
              <rect x="350" y="70" width="20" height="60" fill="var(--color-card)" stroke="var(--color-copper)" strokeWidth="2.2" />
            </g>
            <g fontSize="12" fill="var(--color-ink)" fontFamily="JetBrains Mono, monospace">
              <text x="30" y="109" textAnchor="middle">V1</text>
              <text x="100" y="104" textAnchor="end">Rf</text>
              <text x="214" y="104">Xm</text>
              <text x="280" y="28" textAnchor="middle">X′2</text>
              <text x="378" y="104">R′2/g</text>
            </g>
          </svg>
          <ul className="space-y-2 text-sm">
            <li>
              <b>R′2/g</b> représente la puissance transmise au rotor : pertes Joule rotor plus puissance mécanique. À vide g → 0 et cette branche s’ouvre.
            </li>
            <li>
              <b>Xm</b> : inductance de magnétisation, faible car l’entrefer est grand. Le courant magnétisant est élevé, d’où un cos φ médiocre.
            </li>
            <li>
              <b>Rf</b> : pertes fer, parfois négligées (Rf infinie). <b>X′2</b> : fuites stator et rotor ramenées au stator.
            </li>
            <li>Schéma simplifié : on néglige la résistance du stator et on ramène les impédances du rotor au stator (multipliées par m², m rapport stator/rotor).</li>
          </ul>
        </Deux>
        <Formules
          items={[
            ['Courant de démarrage', 'Id = 4 à 7 × In', 'À g = 1, R′2/g est petite : le moteur appelle un fort courant.'],
            ['Facteur de puissance', 'cos φ < 0,8', 'Fort courant de magnétisation à cause de l’entrefer.'],
            ['Rendement', 'croît avec Pn', 'Quelques dizaines de % en petite puissance, plus de 95 % pour les gros moteurs.'],
          ]}
        />
      </Section>
    </>
  )
}

function PaireDePoles() {
  const [n, setN] = useState(1440)
  const [f, setF] = useState(50)
  const pp = Math.floor((60 * f) / n)
  const ns = nSync(f, pp)
  const max = 3200 * (f / 50)
  return (
    <Section
      eyebrow="Lire une plaque signalétique"
      title="Retrouver p à partir de la vitesse nominale"
      intro="Ns = 60·f/p ne prend que quelques valeurs. Le rotor tourne toujours un peu moins vite que le champ : Ns est la première valeur juste au-dessus de la vitesse nominale."
    >
      <Panel>
        <div className="relative mx-1 mt-2 h-20">
          <div className="absolute inset-x-0 top-9 h-0.5 bg-line" />
          {[1, 2, 3, 4, 5, 6].map((k) => (
            <div key={k} className={`absolute top-3 flex -translate-x-1/2 flex-col items-center font-mono text-[0.7rem] ${k === pp ? 'font-semibold text-ink' : 'text-muted'}`} style={{ left: `${(nSync(f, k) / max) * 100}%` }}>
              <span>p={k}</span>
              <span className={`mt-0.5 size-3 rounded-full border-2 ${k === pp ? 'border-copper bg-copper' : 'border-muted bg-card'}`} />
            </div>
          ))}
          <div className="absolute top-10 flex -translate-x-1/2 flex-col items-center font-mono text-[0.7rem] text-north" style={{ left: `${(n / max) * 100}%` }}>
            <span className="h-2.5 w-0.5 bg-north" />
            <span>N={n}</span>
          </div>
        </div>
        <p>
          Ns = 60 × {f} / {pp} = <b className="font-mono">{fr(ns, 0)} tr/min</b>, glissement nominal g = ({fr(ns, 0)} − {n}) / {fr(ns, 0)} = <b className="font-mono">{fr(((ns - n) / ns) * 100, 1)} %</b>.
        </p>
        <Ligne>
          <Curseur label="Vitesse nominale (plaque)" value={n} min={400} max={2990} step={5} onChange={setN} aff={`${n} tr/min`} />
          <Choix label="Fréquence" value={f} onChange={setF} options={[[50, '50 Hz'], [60, '60 Hz']]} />
        </Ligne>
      </Panel>
    </Section>
  )
}

function Couplage() {
  const [plaque, setPlaque] = useState<230 | 400>(230)
  const [reseau, setReseau] = useState<230 | 400>(400)
  const [coup, setCoup] = useState<'Y' | 'D'>('Y')
  const ve = coup === 'Y' ? reseau / Math.sqrt(3) : reseau
  const ecart = ve / plaque
  const ok = Math.abs(ecart - 1) < 0.05
  const bon = reseau === plaque ? 'triangle' : Math.abs(reseau / Math.sqrt(3) - plaque) < 5 ? 'étoile' : null
  const A = [200, 120]
  const B = [110, 250]
  const C = [290, 250]
  const O = [200, 207]
  const col = ok ? 'var(--color-ok)' : 'var(--color-err)'
  const enroulement = (p: number[], q: number[]) => {
    const mx = (p[0] + q[0]) / 2
    const my = (p[1] + q[1]) / 2
    const ang = (Math.atan2(q[1] - p[1], q[0] - p[0]) * 180) / Math.PI
    return (
      <g key={`${p}${q}`}>
        <line x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke="var(--color-ink)" strokeWidth="1.6" />
        <rect x={mx - 22} y={my - 8} width="44" height="16" rx="3" fill="var(--color-card)" stroke="var(--color-copper)" strokeWidth="2.2" transform={`rotate(${ang} ${mx} ${my})`} />
      </g>
    )
  }
  return (
    <Section
      eyebrow="Couplage"
      title="Étoile ou triangle ?"
      intro="« 230/400 V » sur la plaque : chaque enroulement supporte la plus petite des deux tensions. Le couplage choisit la tension que reçoit chaque enroulement."
    >
      <Panel>
        <Deux>
          <svg viewBox="0 0 400 290" role="img" aria-label="Schéma de couplage des trois enroulements" className="w-full">
            {(
              [
                ['L1', 24, 'l1'],
                ['L2', 46, 'l2'],
                ['L3', 68, 'l3'],
              ] as const
            ).map(([n, y, c]) => (
              <g key={n}>
                <line x1="40" y1={y} x2="385" y2={y} stroke={`var(--color-${c})`} strokeWidth="2.5" />
                <text x="12" y={y + 4} fontSize="12" fontWeight="600" fill="var(--color-ink)">
                  {n}
                </text>
              </g>
            ))}
            <text x="385" y="90" textAnchor="end" fontSize="11" fill="var(--color-muted)">
              U = {reseau} V entre phases
            </text>
            {(
              [
                [200, 24, A],
                [110, 46, B],
                [290, 68, C],
              ] as const
            ).map(([x, y, v]) => (
              <g key={x}>
                <line x1={x} y1={y} x2={v[0]} y2={v[1]} stroke="var(--color-ink)" strokeWidth="1.6" />
                <circle cx={x} cy={y} r="3.5" fill="var(--color-ink)" />
              </g>
            ))}
            {coup === 'Y' ? [enroulement(O, A), enroulement(O, B), enroulement(O, C), <circle key="o" cx={O[0]} cy={O[1]} r="4" fill="var(--color-ink)" />] : [enroulement(A, B), enroulement(B, C), enroulement(C, A)]}
            {[A, B, C].map((v) => (
              <circle key={String(v)} cx={v[0]} cy={v[1]} r="4" fill="var(--color-ink)" />
            ))}
            <text x="200" y="283" textAnchor="middle" fontSize="13" fontWeight="600" fill={col}>
              {fr(ve, 0)} V par enroulement
            </text>
          </svg>
          <div className="space-y-4">
            <Choix label="Plaque" value={plaque} onChange={setPlaque} options={[[230, 'Plaque 230/400 V'], [400, 'Plaque 400/690 V']]} />
            <Choix label="Réseau" value={reseau} onChange={setReseau} options={[[230, 'Réseau 230 V'], [400, 'Réseau 400 V']]} />
            <Choix label="Couplage" value={coup} onChange={setCoup} options={[['Y', 'Étoile Y'], ['D', 'Triangle Δ']]} />
            <p className={`font-semibold ${ok ? 'text-ok' : 'text-err'}`}>
              {ok ? 'Bon couplage.' : ecart > 1 ? `Surtension : ${fr(ecart, 2)} × la tension prévue. Courant excessif, isolant détruit.` : `Sous-tension : ${fr(ecart, 2)} × la tension prévue. Couple divisé par ${fr(1 / ecart ** 2, 1)}.`}
            </p>
            <p className="text-sm text-muted">
              Étoile : chaque enroulement est entre une phase et le neutre, il reçoit V = U/√3. Triangle : entre deux phases, il reçoit U. {bon ? `Ici, il faut le couplage ${bon}.` : 'Aucun couplage ne convient : moteur inadapté à ce réseau.'}
            </p>
          </div>
        </Deux>
      </Panel>
    </Section>
  )
}
