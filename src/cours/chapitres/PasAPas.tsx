import { useMemo, useRef, useState, type PointerEvent } from 'react'
import { couplePas, dentRotor, equilibrePas, hacheurPhase, pasParTour, phasesPas, polesStator, remplissageCourant, type ModePas } from '../physique'
import { DEG, fr, mono, REDUCE, repere, TAU, useCanvas } from '../canvas'
import { Bouton, Choix, Cle, Curseur, Deux, Formules, Legende, Lecture, Ligne, Mesures, Panel, Pastille, Section, Toile } from '../ui'

const mod = (a: number, n: number) => ((a % n) + n) % n
const poly = (ctx: CanvasRenderingContext2D, pts: [number, number][]) => {
  ctx.beginPath()
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  ctx.closePath()
}

export default function PasAPas() {
  return (
    <>
      <Section
        eyebrow="Présentation"
        title="Un actionneur qui avance par crans"
        intro="Chaque impulsion de commande fait tourner l’arbre d’un angle fixe : on positionne sans capteur, en boucle ouverte (imprimantes, disques, machines-outils, bras de robot), ou l’on fait de la vitesse variable."
      >
        <div className="grid gap-3 md:grid-cols-3">
          {[
            ['À aimants permanents', 'Rotor aimanté (une ou plusieurs paires de pôles), stator à 2 ou 4 bobines.', 'Couple élevé, faible résolution.'],
            ['À réluctance variable', 'Rotor en fer doux denté, nombre de dents différent de celui du stator. Le rotor se place là où l’entrefer est minimal.', 'Bonne résolution, couple plus faible, aucun couple à l’arrêt.'],
            ['Hybride', 'Rotor denté monté sur un aimant axial : deux couronnes de dents, l’une N, l’autre S, décalées d’un demi-pas dentaire.', 'Couple élevé et bonne résolution : 50 dents = 25 paires de pôles, 200 pas par tour.'],
          ].map(([t, d, p]) => (
            <div key={t} className="rounded-card bg-card p-4 ring-1 ring-line">
              <h3 className="font-semibold">{t}</h3>
              <p className="mt-1 text-sm">{d}</p>
              <p className="mt-2 text-sm text-copper">{p}</p>
            </div>
          ))}
        </div>
      </Section>
      <Rotor />
      <Calcul />
      <Pont />
      <CoupleVitesse />
    </>
  )
}

/* ---------- rotor et séquences ---------- */

const MODES = [
  ['une-phase', 'Pas entier, 1 phase'],
  ['deux-phases', 'Pas entier, 2 phases'],
  ['demi-pas', 'Demi-pas'],
] as const

function Rotor() {
  const [nr, setNr] = useState<2 | 6>(6)
  const [mode, setMode] = useState<ModePas>('une-phase')
  const [fh, setFh] = useState(4)
  const [play, setPlay] = useState(!REDUCE)
  const [lent, setLent] = useState(true)
  const [dir, setDir] = useState<1 | -1>(1)
  const sm = useRef({ k: 0, frac: 0, th: 0, vel: 0, cible: 0, cle: '' })
  const [k, setK] = useState(0)
  const np = (2 * nr) * (mode === 'demi-pas' ? 2 : 1)
  const pas = 360 / np

  const moteur = useCanvas((ctx, w, h, dt, c) => {
    const s = sm.current
    if (play) {
      s.frac += dt * fh * (lent ? 0.25 : 1)
      while (s.frac >= 1) {
        s.frac -= 1
        s.k += dir
        setK(s.k)
      }
    }
    const [ia, ib] = phasesPas(mode, s.k)
    const cle = `${nr}/${mode}/${s.k}`
    if (cle !== s.cle) {
      s.cle = cle
      s.cible = equilibrePas(nr, ia, ib, s.cible)
    }
    if (REDUCE) s.th = s.cible
    else {
      const T = dt * (lent ? 0.25 : 1)
      const n = Math.max(1, Math.ceil(T / 0.001))
      const w0 = TAU * 14
      for (let i = 0; i < n; i++) {
        s.vel += (-w0 * w0 * (s.th - s.cible) - 2 * 0.3 * w0 * s.vel) * (T / n)
        s.th += s.vel * (T / n)
      }
    }
    const cx = w / 2
    const cy = h / 2
    const S = Math.min(w, h)
    const Ro = S * 0.48
    const Ry = S * 0.37
    const Rt = S * 0.215
    const hw = S * 0.06
    ctx.beginPath()
    ctx.arc(cx, cy, Ro, 0, TAU)
    ctx.arc(cx, cy, Ry, 0, TAU, true)
    ctx.fillStyle = c.steel
    ctx.fill()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const noms: Record<number, string> = { 90: 'A', 270: 'A′', 0: 'B', 180: 'B′' }
    for (const [ang, p] of polesStator(ia, ib)) {
      const a = ang * DEG
      const ux = Math.cos(a)
      const uy = -Math.sin(a)
      const P = (r: number, o: number): [number, number] => [cx + ux * r - uy * o, cy + uy * r + ux * o]
      poly(ctx, [P(Ry + 2, -hw), P(Ry + 2, hw), P(Rt, hw), P(Rt, -hw)])
      ctx.fillStyle = c.steel
      ctx.fill()
      ctx.strokeStyle = c.line
      ctx.stroke()
      poly(ctx, [P(Rt + S * 0.03, -hw), P(Rt + S * 0.03, hw), P(Rt, hw), P(Rt, -hw)])
      ctx.fillStyle = p > 0 ? c.north : p < 0 ? c.south : c['steel-2']
      ctx.fill()
      for (const sd of [-1, 1]) {
        const o0 = sd * (hw + S * 0.005)
        const o1 = sd * (hw + S * 0.036)
        poly(ctx, [P(Rt + S * 0.045, o0), P(Ry - S * 0.01, o0), P(Ry - S * 0.01, o1), P(Rt + S * 0.045, o1)])
        ctx.globalAlpha = p ? 1 : 0.28
        ctx.fillStyle = c.copper
        ctx.fill()
        ctx.globalAlpha = 1
      }
      const [lx, ly] = P((Ro + Ry) / 2, 0)
      ctx.fillStyle = c.ink
      ctx.font = mono(Math.max(11, S * 0.034), 600)
      ctx.fillText(noms[ang], lx, ly)
    }
    // rotor : nr dents alternées S, N…
    const Rr = Rt - S * 0.014
    const hw2 = Math.min(S * 0.05, Rr * Math.sin(Math.PI / nr) * 0.7)
    for (let j = 0; j < nr; j++) {
      const a = dentRotor(nr, j, s.th) * DEG
      const ux = Math.cos(a)
      const uy = -Math.sin(a)
      const P = (r: number, o: number): [number, number] => [cx + ux * r - uy * o, cy + uy * r + ux * o]
      poly(ctx, [P(0, -hw2), P(Rr, -hw2), P(Rr, hw2), P(0, hw2)])
      ctx.fillStyle = j % 2 ? c.north : c.south
      ctx.globalAlpha = 0.9
      ctx.fill()
      ctx.globalAlpha = 1
      const [tx, ty] = P(Rr - S * 0.03, 0)
      ctx.fillStyle = '#fff'
      ctx.font = mono(Math.max(9, S * 0.026), 700)
      ctx.fillText(j % 2 ? 'N' : 'S', tx, ty)
      if (j === 0) {
        const [nx, ny] = P(S * 0.125, 0)
        ctx.font = mono(Math.max(10, S * 0.032), 800)
        ctx.fillText('1', nx, ny)
      }
    }
    ctx.beginPath()
    ctx.arc(cx, cy, S * 0.09, 0, TAU)
    ctx.fillStyle = c.rotor
    ctx.fill()
  }, true)

  const seq = useCanvas((ctx, w, h, _dt, c) => {
    const s = sm.current
    const L = 58
    const T = 22
    const B = 40
    const pw = w - L - 10
    const rh = (h - T - B) / 3
    const sw = pw / 8
    const ci = mod(s.k, 8)
    ctx.fillStyle = c.copper
    ctx.globalAlpha = 0.1
    ctx.fillRect(L + ci * sw, T, sw, h - T - B)
    ctx.globalAlpha = 1
    ctx.font = mono(11)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    const base = s.k - ci
    for (let i = 0; i < 8; i++) {
      const [a, b] = phasesPas(mode, base + i)
      const nom = [a ? (a > 0 ? 'A+' : 'A−') : '', b ? (b > 0 ? 'B+' : 'B−') : ''].filter(Boolean).join('')
      ctx.fillStyle = i === ci ? c.ink : c.muted
      ctx.fillText(nom, L + i * sw + sw / 2, h - B + 6)
    }
    const rows: [string, string, number][] = [
      ['Horloge', c.ink, -1],
      ['IA', c.copper, 0],
      ['IB', c.south, 1],
    ]
    for (const [nom, col, ph] of rows) {
      const r = rows.findIndex((x) => x[0] === nom)
      const y0 = T + rh * r + rh / 2
      const amp = rh * 0.3
      ctx.fillStyle = c.ink
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.font = mono(12, 600)
      ctx.fillText(nom, 4, y0)
      ctx.strokeStyle = col
      ctx.lineWidth = 2.2
      ctx.beginPath()
      if (ph < 0) {
        ctx.moveTo(L, y0 + amp)
        for (let i = 0; i < 8; i++) {
          const x = L + i * sw
          ctx.lineTo(x, y0 + amp)
          ctx.lineTo(x, y0 - amp)
          ctx.lineTo(x + sw * 0.12, y0 - amp)
          ctx.lineTo(x + sw * 0.12, y0 + amp)
        }
        ctx.lineTo(L + pw, y0 + amp)
      } else {
        let prev = 0
        for (let i = 0; i < 8; i++) {
          const y = y0 - phasesPas(mode, base + i)[ph] * amp
          if (!i) ctx.moveTo(L, y)
          else {
            ctx.lineTo(L + i * sw, prev)
            ctx.lineTo(L + i * sw, y)
          }
          prev = y
        }
        ctx.lineTo(L + pw, prev)
      }
      ctx.stroke()
      ctx.lineWidth = 1
    }
    const xc = L + (ci + (play ? s.frac : 0)) * sw
    ctx.strokeStyle = c.copper
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(xc, T)
    ctx.lineTo(xc, h - B)
    ctx.stroke()
  })

  const couple = useCanvas((ctx, w, h, _dt, c) => {
    const s = sm.current
    const [ia, ib] = phasesPas(mode, s.k)
    const span = 360 / nr
    const cmax = Math.max(1e-9, ...Array.from({ length: 61 }, (_, i) => Math.abs(couplePas(nr, ia, ib, s.cible - span + (i * span) / 30))))
    const { X, Y } = repere(ctx, c, { x: 30, y: 16, w: w - 40, h: h - 36 }, { x0: -span, x1: span, y0: -1.15, y1: 1.15 }, [{ f: (x) => couplePas(nr, ia, ib, s.cible + x) / cmax, col: c.copper, lw: 2.5 }], {
      label: 'couple de rappel selon l’écart à l’équilibre',
    })
    ctx.fillStyle = c.muted
    ctx.font = mono(10)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText(`±${fr(span, 0)}°`, X(span) - 18, h - 2)
    ctx.fillText('0', X(0), h - 2)
    const e = Math.max(-span, Math.min(span, s.th - s.cible))
    ctx.beginPath()
    ctx.arc(X(e), Y(couplePas(nr, ia, ib, s.th) / cmax), 6, 0, TAU)
    ctx.fillStyle = c.ink
    ctx.fill()
  })

  return (
    <Section
      eyebrow="Fonctionnement"
      title="Une impulsion, un pas"
      intro="L’horloge ne fait pas tourner le moteur en continu : chaque front change les phases alimentées et le rotor saute d’un cran pour aligner une dent de polarité opposée sur le pôle actif."
    >
      <Panel>
        <Deux>
          <div className="space-y-2">
            <Toile cref={moteur} ratio="1" label="Moteur pas à pas : stator à 4 pôles, rotor denté" />
            <div>
              <Pastille col="north">pôle N</Pastille>
              <Pastille col="south">pôle S</Pastille>
              <Pastille col="copper">bobine alimentée</Pastille>
            </div>
            <Legende>
              Suivez la dent « 1 ». Sur un vrai hybride, les dents N et S sont sur deux couronnes décalées de part et d’autre de l’aimant : on les superpose ici.
            </Legende>
          </div>
          <div className="space-y-3">
            <Toile cref={seq} ratio="4/3" label="Chronogramme horloge, courant phase A, courant phase B" />
            <Toile cref={couple} ratio="16/7" label="Couple de rappel en fonction de la position" />
            <Legende>Écartez le rotor de son équilibre : un couple quasi sinusoïdal le ramène. La succession des pas rend le couple moyen non nul.</Legende>
          </div>
        </Deux>
        <Mesures
          items={[
            ['Pas envoyés', String(k), '1 impulsion = 1 pas'],
            ['Angle de pas', `${fr(pas, 1)}°`, `360° / ${np}`],
            ['Pas par tour', String(np), mode === 'demi-pas' ? '2 × pas entier' : 'pas entier'],
            ['Vitesse', fr((60 * fh) / np, 1), 'tr/min = 60·fh/Np'],
          ]}
        />
        <Ligne>
          <Choix label="Rotor" value={nr} onChange={setNr} options={[[2, 'Aimant, 1 paire de pôles'], [6, 'Hybride, 6 dents']]} />
          <Choix label="Mode" value={mode} onChange={setMode} options={MODES} />
        </Ligne>
        <Ligne>
          <Curseur label="Fréquence d’horloge fh" value={fh} min={1} max={16} onChange={setFh} aff={`${fh} Hz`} />
          <Lecture play={play} setPlay={setPlay} />
          <Bouton
            onClick={() => {
              setPlay(false)
              sm.current.frac = 0
              sm.current.k += dir
              setK(sm.current.k)
            }}
          >
            1 impulsion
          </Bouton>
          <Bouton on={dir < 0} onClick={() => setDir(dir > 0 ? -1 : 1)}>
            Inverser DIR
          </Bouton>
          <Bouton on={lent} onClick={() => setLent(!lent)}>
            Ralenti ×4
          </Bouton>
        </Ligne>
      </Panel>
      <Formules
        items={[
          ['Pas entier, 1 phase', 'A+ → B+ → A− → B−', 'Une seule phase à la fois. Le rotor s’aligne sur le pôle actif.'],
          ['Pas entier, 2 phases', 'A+B+ → B+A− → A−B− → B−A+', 'Même nombre de pas, rotor décalé d’un demi-pas, couple plus fort (deux phases).'],
          ['Demi-pas', 'A+ → A+B+ → B+ → …', 'Alterner les deux modes double le nombre de pas par tour.'],
        ]}
      />
      <Cle>
        Le sens dépend de l’ordre de la séquence (entrée DIR). Pour plus de pas par tour : multiplier les pôles du rotor ou les phases du stator. Avec l’aimant à une paire de pôles, 4 pas par tour ; avec 6
        dents, 12 ; avec 50 dents, 200.
      </Cle>
    </Section>
  )
}

/* ---------- nombre de pas ---------- */

function Calcul() {
  const [ns, setNs] = useState(40)
  const [nr, setNr] = useState(50)
  const ts = 360 / ns
  const tr = 360 / nr
  const ok = ns !== nr
  return (
    <Section
      eyebrow="Réluctance variable et hybride"
      title="Combien de pas par tour ?"
      intro="Le rotor tourne pour mettre ses dents en face des pôles alimentés : le flux est maximal quand l’entrefer est minimal. À chaque pas, il ne parcourt que la différence entre les deux pas dentaires."
    >
      <Panel>
        <Mesures
          items={[
            ['Pas dentaire stator', `${fr(ts, 2)}°`, 'θs = 360°/ns'],
            ['Pas dentaire rotor', `${fr(tr, 2)}°`, 'θr = 360°/nr'],
            ['Pas', ok ? `${fr(Math.abs(ts - tr), 2)}°` : '—', 'θp = |θs − θr|'],
            ['Pas par tour', ok ? fr(pasParTour(ns, nr), 1) : '—', 'Np = ns·nr/|nr − ns|'],
          ]}
        />
        <Ligne>
          <Curseur label="Dents du stator ns" value={ns} min={4} max={60} step={2} onChange={setNs} aff={String(ns)} />
          <Curseur label="Dents du rotor nr" value={nr} min={4} max={60} step={2} onChange={setNr} aff={String(nr)} />
        </Ligne>
        <Ligne>
          <Bouton onClick={() => (setNs(40), setNr(50))}>4 pôles × 10 dents, rotor 50 dents</Bouton>
          <Bouton onClick={() => (setNs(4), setNr(6))}>Stator 4 dents, rotor 6 dents</Bouton>
          <Bouton onClick={() => (setNs(6), setNr(4))}>Stator 6, rotor 4</Bouton>
        </Ligne>
      </Panel>
      <Formules
        items={[
          ['Équation d’une phase', 'v = R·i + dψ/dt, ψ = L(θ)·i', 'L’inductance dépend de la position du rotor : elle est maximale dents en face.'],
          ['Bilan de puissance', 'v·i = d(½·L·i²)/dt + ½·i²·dL/dθ·Ω', 'Une partie fait varier l’énergie magnétique, l’autre devient mécanique.'],
          ['Couple', 'C = ½·i²·dL/dθ', 'Pas de variation de réluctance, pas de couple. Le signe de i n’importe pas : aucun couple à l’arrêt hors tension.'],
        ]}
      />
    </Section>
  )
}

/* ---------- pont en H ---------- */

const XL = 150
const XR = 310
const CHEMINS: Record<number, number[][]> = {
  1: [[50, 150], [50, 40], [150, 40], [150, 60], [134, 60], [134, 130], [150, 130], [150, 150], [310, 150], [310, 170], [294, 170], [294, 240], [310, 240], [310, 260], [50, 260], [50, 150]],
  3: [[150, 150], [310, 150], [310, 130], [326, 130], [326, 60], [310, 60], [310, 40], [150, 40], [150, 60], [134, 60], [134, 130], [150, 130], [150, 150]],
  4: [[50, 260], [150, 260], [150, 240], [166, 240], [166, 170], [150, 170], [150, 150], [310, 150], [310, 130], [326, 130], [326, 60], [310, 60], [310, 40], [50, 40], [50, 260]],
  5: [[50, 150], [50, 40], [310, 40], [310, 60], [294, 60], [294, 130], [310, 130], [310, 150], [150, 150], [150, 170], [134, 170], [134, 240], [150, 240], [150, 260], [50, 260], [50, 150]],
  6: [[310, 150], [150, 150], [150, 130], [166, 130], [166, 60], [150, 60], [150, 40], [310, 40], [310, 60], [294, 60], [294, 130], [310, 130], [310, 150]],
  7: [[50, 260], [310, 260], [310, 240], [326, 240], [326, 170], [310, 170], [310, 150], [150, 150], [150, 130], [166, 130], [166, 60], [150, 60], [150, 40], [50, 40], [50, 260]],
}
CHEMINS[2] = CHEMINS[1]
const PASSANTS: Record<number, string[]> = { 0: [], 1: ['T1', 'T4'], 2: ['T1', 'T4'], 3: ['T1', 'D3'], 4: ['D2', 'D3'], 5: ['T3', 'T2'], 6: ['T3', 'D1'], 7: ['D1', 'D4'] }
const INFO: Record<number, [string, string, string, string, string]> = {
  0: ['Phase au repos', 'aucun', '0', '0', 'Pendant ce pas, c’est l’autre phase qui est alimentée, par son propre pont.'],
  1: ['Magnétisation', 'T1 et T4', '+U', 'monte vers +Iref', 'T1 relie la gauche de la bobine au +U, T4 la droite à la masse : VA = +U. Le courant monte en rampe de pente U/L.'],
  2: ['Relance du hachage', 'T1 et T4', '+U', 'remonte vers +Iref', 'Le courant est redescendu au seuil bas : la régulation referme le transistor ouvert. VA = +U, le courant remonte.'],
  3: ['Roue libre', 'T1 et D3 (ou T4 et D2)', '0', 'décroît lentement', 'Iref est atteint, la régulation ouvre T4. Le courant de la bobine ne peut pas s’arrêter : il remonte par D3 et revient par T1. Les deux bornes sont au +U, VA = 0.'],
  4: ['Démagnétisation rapide', 'D2 et D3', '−U', 'chute vite vers 0', 'Fin du pas : T1 et T4 s’ouvrent. Le courant, toujours positif, passe par D2 et D3 : la bobine voit −U et rend son énergie à la source.'],
  5: ['Magnétisation inverse', 'T3 et T2', '−U', 'descend vers −Iref', 'Deux pas plus tard, on inverse les pôles : T3 met la droite au +U, T2 la gauche à la masse. VA = −U.'],
  6: ['Roue libre (sens négatif)', 'T3 et D1 (ou T2 et D4)', '0', '|IA| décroît lentement', 'Régulation à −Iref : on ouvre T2. Le courant boucle par D1 et T3 en haut du pont, VA = 0.'],
  7: ['Démagnétisation (sens négatif)', 'D1 et D4', '+U', 'remonte vite vers 0', 'Fin du pas : T3 et T2 s’ouvrent, le courant négatif passe par D4 et D1, la bobine voit +U jusqu’à IA = 0.'],
}
const NPTS = 4000

function Pont() {
  const [u, setU] = useState(50)
  const [lm, setLm] = useState(22)
  const [iref, setIref] = useState(3)
  const [play, setPlay] = useState(!REDUCE)
  const [ins, setIns] = useState(1)
  const t = useRef(0)
  const drag = useRef(false)
  const sim = useMemo(() => {
    const l = lm / 1000
    const tp = (2.9 * l * iref) / u
    const s = hacheurPhase({ u, l, ih: iref, il: 0.8 * iref, tp }, (4 * tp) / NPTS)
    const runs: { ins: number; i0: number; i1: number }[] = []
    for (let i = 0; i < s.n; i++) {
      const r = runs.at(-1)
      if (r && r.ins === s.inst[i]) r.i1 = i
      else runs.push({ ins: s.inst[i], i0: i, i1: i })
    }
    const pick: Record<number, { i0: number; i1: number }> = {}
    for (let k = 1; k <= 7; k++) {
      const l2 = runs.filter((r) => r.ins === k)
      pick[k] = (k === 2 && l2[1]) || l2[0]
    }
    return { ...s, tp, pick }
  }, [u, lm, iref])

  const chrono = useCanvas(
    (ctx, w, h, dt, c) => {
      if (!drag.current) t.current = (t.current + dt / 12) % 1
      const i = Math.min(sim.n - 1, Math.floor(t.current * sim.n))
      if (sim.inst[i] !== ins) setIns(sim.inst[i])
      const L = 56
      const T = 20
      const B = 30
      const pw = w - L - 10
      const H = h - T - B
      const X = (k: number) => L + (k / sim.n) * pw
      const yV = (v: number) => T + H * 0.3 - (v / u) * H * 0.16
      const yI = (a: number) => T + H * 0.78 - (a / iref) * H * 0.18
      ctx.font = mono(11, 600)
      ctx.fillStyle = c.ink
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText('VA', 4, yV(0))
      ctx.fillText('IA', 4, yI(0))
      ctx.font = mono(10)
      ctx.fillStyle = c.muted
      ctx.textAlign = 'right'
      ctx.fillText('+U', L - 4, yV(u))
      ctx.fillText('−U', L - 4, yV(-u))
      ctx.fillText('+Iref', L - 4, yI(iref))
      ctx.fillText('−Iref', L - 4, yI(-iref))
      ctx.strokeStyle = c.line
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(L, yV(0))
      ctx.lineTo(L + pw, yV(0))
      ctx.moveTo(L, yI(0))
      ctx.lineTo(L + pw, yI(0))
      for (let k = 0; k <= 4; k++) {
        ctx.moveTo(L + (k * pw) / 4, T)
        ctx.lineTo(L + (k * pw) / 4, h - B)
      }
      ctx.stroke()
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ;['A+', 'repos', 'A−', 'repos'].forEach((n, k) => ctx.fillText(n, L + (k * pw) / 4 + 4, 2))
      ctx.strokeStyle = c.ink
      ctx.lineWidth = 1.8
      ctx.beginPath()
      ctx.moveTo(X(0), yV(sim.va[0]))
      for (let k = 1; k < sim.n; k++)
        if (sim.va[k] !== sim.va[k - 1]) {
          ctx.lineTo(X(k), yV(sim.va[k - 1]))
          ctx.lineTo(X(k), yV(sim.va[k]))
        }
      ctx.lineTo(X(sim.n), yV(sim.va[sim.n - 1]))
      ctx.stroke()
      ctx.strokeStyle = c.copper
      ctx.lineWidth = 2.4
      ctx.beginPath()
      for (let k = 0; k < sim.n; k += 4) (k ? ctx.lineTo : ctx.moveTo).call(ctx, X(k), yI(sim.ia[k]))
      ctx.stroke()
      for (let k = 1; k <= 7; k++) {
        const r = sim.pick[k]
        if (!r) continue
        const x = X((r.i0 + r.i1) / 2)
        const y = h - B + 14
        const on = sim.inst[i] === k
        ctx.beginPath()
        ctx.arc(x, y, 8, 0, TAU)
        ctx.fillStyle = on ? c.copper : c.card
        ctx.fill()
        ctx.strokeStyle = on ? c.copper : c.muted
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.fillStyle = on ? '#fff' : c.ink
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.font = mono(10, 600)
        ctx.fillText(String(k), x, y + 0.5)
      }
      const xc = X(i)
      ctx.strokeStyle = c.accent
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(xc, T)
      ctx.lineTo(xc, h - B)
      ctx.stroke()
    },
    play,
  )
  const versT = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    t.current = Math.max(0, Math.min(0.9999, (e.clientX - r.left - 56) / (r.width - 66)))
  }
  const aller = (k: number) => {
    const r = sim.pick[k]
    if (!r) return
    setPlay(false)
    t.current = (r.i0 + r.i1) / 2 / sim.n
  }
  const [titre, dev, va, ia, txt] = INFO[ins]
  const ch = CHEMINS[ins]
  const d = ch ? 'M' + ch.map((p) => p.join(',')).join(' L') : ''
  const on = PASSANTS[ins]
  const ln = (a: number, b: number, c2: number, d2: number) => <line x1={a} y1={b} x2={c2} y2={d2} />
  const tr = (id: string, x: number, m: number) => (
    <g key={id} className={on.includes(id) ? 'text-copper' : 'text-ink'}>
      <rect x={x - 11} y={m - 14} width="22" height="28" rx="3" fill={on.includes(id) ? 'currentColor' : 'var(--color-card)'} stroke="currentColor" strokeWidth="1.5" />
      <text x={x} y={m + 4} textAnchor="middle" fontSize="10" fontWeight="600" fill={on.includes(id) ? '#fff' : 'currentColor'}>
        {id}
      </text>
    </g>
  )
  const di = (id: string, x: number, m: number) => (
    <g key={id} className={on.includes(id) ? 'text-copper' : 'text-ink'}>
      <path d={`M${x - 8},${m + 7} L${x + 8},${m + 7} L${x},${m - 7} Z`} fill={on.includes(id) ? 'currentColor' : 'var(--color-card)'} stroke="currentColor" strokeWidth="1.5" />
      <line x1={x - 8} y1={m - 7} x2={x + 8} y2={m - 7} stroke="currentColor" strokeWidth="1.8" />
      <text x={x + 12} y={m + 4} fontSize="10" fontWeight="600" fill="currentColor">
        {id}
      </text>
    </g>
  )
  return (
    <Section
      eyebrow="Commande"
      title="Le pont en H, instant par instant"
      intro="Il faut établir le courant le plus vite possible, puis l’annuler ou l’inverser rapidement : chaque phase est alimentée par un hacheur 4 quadrants, réversible en tension et en courant, régulé en courant."
    >
      <Panel>
        <canvas
          ref={chrono}
          role="img"
          aria-label="Chronogramme de la tension VA et du courant IA d'une phase"
          className="block w-full cursor-ew-resize touch-pan-y"
          style={{ aspectRatio: '16/7' }}
          onPointerDown={(e) => {
            drag.current = true
            setPlay(false)
            versT(e)
            e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => drag.current && versT(e)}
          onPointerUp={() => (drag.current = false)}
        />
        <Ligne>
          <Lecture play={play} setPlay={setPlay} />
          <span className="text-sm text-muted">Instants :</span>
          {[1, 2, 3, 4, 5, 6, 7].map((k) => (
            <Bouton key={k} on={ins === k} onClick={() => aller(k)}>
              {k}
            </Bouton>
          ))}
        </Ligne>
        <Deux>
          <svg viewBox="0 0 380 290" role="img" aria-label="Pont en H alimentant la phase" className="w-full">
            <g stroke="var(--color-muted)" strokeWidth="1.6" fill="none">
              {ln(50, 40, 50, 130)}
              {ln(50, 170, 50, 260)}
              {ln(50, 40, XR, 40)}
              {ln(50, 260, XR, 260)}
              {[XL, XR].map((x) => (
                <g key={x}>
                  {ln(x, 40, x, 60)}
                  {ln(x, 130, x, 170)}
                  {ln(x, 240, x, 260)}
                  {[
                    [60, 130],
                    [170, 240],
                  ].map(([y0, y1]) => (
                    <g key={y0}>
                      {ln(x - 16, y0, x + 16, y0)}
                      {ln(x - 16, y1, x + 16, y1)}
                      {ln(x - 16, y0, x - 16, y1)}
                      {ln(x + 16, y0, x + 16, y1)}
                    </g>
                  ))}
                </g>
              ))}
              {ln(XL, 150, 200, 150)}
              {ln(260, 150, XR, 150)}
              <path d="M200,150 a7.5,7.5 0 0 1 15,0 a7.5,7.5 0 0 1 15,0 a7.5,7.5 0 0 1 15,0 a7.5,7.5 0 0 1 15,0" stroke="var(--color-ink)" strokeWidth="2" />
            </g>
            {d && (
              <>
                <path d={d} fill="none" stroke="var(--color-copper)" strokeWidth="9" opacity=".18" strokeLinejoin="round" />
                <path d={d} fill="none" stroke="var(--color-copper)" strokeWidth="4" strokeDasharray="0.1 14" strokeLinecap="round" className={REDUCE ? '' : 'flux-anim'} />
              </>
            )}
            <circle cx="50" cy="150" r="20" fill="var(--color-card)" stroke="var(--color-ink)" strokeWidth="1.6" />
            <text x="50" y="154" textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--color-ink)">
              U
            </text>
            <text x="230" y="132" textAnchor="middle" fontSize="10" fill="var(--color-muted)">
              L = {lm} mH
            </text>
            {tr('T1', XL - 16, 95)}
            {di('D1', XL + 16, 95)}
            {tr('T2', XL - 16, 205)}
            {di('D2', XL + 16, 205)}
            {tr('T3', XR - 16, 95)}
            {di('D3', XR + 16, 95)}
            {tr('T4', XR - 16, 205)}
            {di('D4', XR + 16, 205)}
            <text x="230" y="200" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--color-ink)">
              VA = {va}
            </text>
          </svg>
          <div className="flex gap-3">
            <span className={`grid size-11 flex-none place-items-center rounded-full text-xl font-bold ${ins ? 'bg-copper text-white' : 'bg-card-2'}`}>{ins || '–'}</span>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">{titre}</h3>
              <p className="text-sm">
                Passants : <b className="font-mono">{dev}</b> · VA = <b className="font-mono">{va}</b> · IA {ia}
              </p>
              <p className="text-sm">{txt}</p>
            </div>
          </div>
        </Deux>
        <Mesures
          items={[
            ['Pente de montée', fr(u / (lm / 1000), 0), 'A/s = U/L'],
            ['Temps de montée', fr(((lm / 1000) * iref) / u * 1000, 2), 'ms = L·Iref/U'],
          ]}
        />
        <Ligne>
          <Curseur label="Tension U" value={u} min={12} max={100} onChange={setU} aff={`${u} V`} />
          <Curseur label="Inductance L" value={lm} min={5} max={50} onChange={setLm} aff={`${lm} mH`} />
          <Curseur label="Consigne Iref" value={iref} min={1} max={5} step={0.5} onChange={setIref} aff={`${fr(iref, 1)} A`} />
        </Ligne>
        <Legende>Échelle de temps dilatée : on ne dessine que quelques hachages par pas. Faites glisser le curseur sur le chronogramme.</Legende>
      </Panel>
      <Formules
        items={[
          ['Mode courant', 'IA régulé à ±Iref', 'Une commande en tension laisserait le courant monter jusqu’à U/R, très grand puisque R est petite : on hache pour le tenir.'],
          ['Équation de la phase', 'VA = L·dIA/dt', 'Résistance négligée : sous VA constante, IA monte en droite.'],
          ['Inductance', 'L = VA·Δt / ΔIA', 'Se lit sur la rampe de magnétisation du relevé.'],
        ]}
      />
      <Cle>
        Le courant dans une bobine ne peut pas s’arrêter net. Quand on ouvre un transistor, le courant continue dans le même sens et force une diode à conduire. Selon les diodes qui prennent le relais, la bobine voit
        0 V (roue libre, le courant baisse lentement) ou −U (démagnétisation, il s’annule vite).
      </Cle>
    </Section>
  )
}

/* ---------- couple et vitesse ---------- */

const PE = 24
const PR = 2
const PL = 5e-3
const PI0 = 2

function CoupleVitesse() {
  const [lf, setLf] = useState(2)
  const fh = 10 ** lf
  const remp = remplissageCourant(fh, PE, PR, PL, PI0)
  const courant = useCanvas((ctx, w, h, _dt, c) => {
    const tp = 1 / fh
    const tau = PL / PR
    const i = (t: number) => Math.min(PI0, (PE / PR) * (1 - Math.exp(-t / tau)))
    repere(
      ctx,
      c,
      { x: 40, y: 16, w: w - 50, h: h - 36 },
      { x0: 0, x1: 2, y0: -2.4, y1: 2.4 },
      [{ f: (x) => (x < 1 ? i(x * tp) : -i((x - 1) * tp)), col: c.copper, lw: 2.5, n: 400 }],
      { label: 'courant d’une phase sur deux pas', yTicks: [-2, 0, 2], yFmt: (v) => `${fr(v)} A` },
    )
  })
  const courbe = useCanvas((ctx, w, h, _dt, c) => {
    const { X, Y } = repere(ctx, c, { x: 40, y: 16, w: w - 50, h: h - 36 }, { x0: 1, x1: 4, y0: 0, y1: 1.1 }, [{ f: (x) => remplissageCourant(10 ** x, PE, PR, PL, PI0), col: c.south, lw: 2.5 }], {
      label: 'couple disponible / couple à basse vitesse',
      yTicks: [0, 0.5, 1],
      yFmt: (v) => fr(v, 1),
    })
    ctx.fillStyle = c.muted
    ctx.font = mono(10)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    for (const x of [1, 2, 3, 4]) ctx.fillText(`${10 ** x} Hz`, X(x), h - 2)
    ctx.beginPath()
    ctx.arc(X(lf), Y(remp), 6, 0, TAU)
    ctx.fillStyle = c.copper
    ctx.fill()
  })
  return (
    <Section
      eyebrow="Performances"
      title="Pourquoi le couple chute avec la vitesse"
      intro="Le courant met un temps τ = L/R à s’établir. Quand la durée d’un pas devient comparable, il n’atteint plus sa consigne : le couple moyen baisse."
    >
      <Panel>
        <Deux>
          <Toile cref={courant} ratio="16/9" label="Courant d'une phase pendant deux pas" />
          <Toile cref={courbe} ratio="16/9" label="Couple disponible selon la fréquence des pas" />
        </Deux>
        <Mesures
          items={[
            ['fh', fr(fh, 0), 'Hz'],
            ['Durée d’un pas', fr(1000 / fh, 2), 'ms'],
            ['τ = L/R', fr((PL / PR) * 1000, 1), 'ms'],
            ['Couple disponible', `${fr(remp * 100, 0)} %`, 'du couple à basse vitesse'],
          ]}
        />
        <Curseur label="Fréquence des pas" value={lf} min={1} max={4} step={0.02} onChange={setLf} aff={`${fr(fh, 0)} Hz`} />
        <Legende>
          Phase de {PL * 1000} mH et {PR} Ω sous {PE} V, régulée à {PI0} A. La courbe du constructeur distingue la zone de démarrage (démarrer et s’arrêter sans perdre de pas) de la plage d’accélération,
          accessible seulement en montant progressivement en fréquence.
        </Legende>
      </Panel>
      <Cle>Plus la tension d’alimentation est grande devant R·Iref, plus le courant s’établit vite : c’est pourquoi on alimente sous une tension élevée et qu’on limite le courant par hachage.</Cle>
    </Section>
  )
}
