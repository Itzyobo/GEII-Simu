import { useRef, useState } from 'react'
import { DEG, fr, mono, REDUCE, repere, secteur, TAU, useCanvas } from '../canvas'
import { Bouton, Cle, Curseur, Deux, Formules, Legende, Lecture, Ligne, Mesures, Panel, Pastille, Section, Toile } from '../ui'

/** Machine dessinée à 2 paires de pôles ; angles « électriques » (×p), couple rapporté à Cmax, inertie unité. */
const P = 2
const WS = Math.PI // pulsation électrique du champ, ralentie (0,25 tr/s mécanique)
const FROT = 0.02 // frottements à ωs, rapportés à Cmax
const AMORT = 0.5 // cage d'amortisseurs : couple ∝ écart de vitesse

export default function Synchrone() {
  const [cr, setCr] = useState(0.4)
  const [amort, setAmort] = useState(true)
  const [play, setPlay] = useState(!REDUCE)
  const st = useRef({ tf: 0, tr: -Math.asin(0.42), w: WS, glis: 0 })
  const [etat, setEtat] = useState<'sync' | 'decroche'>('sync')
  const delta = () => {
    const d = st.current.tf - st.current.tr
    return Math.atan2(Math.sin(d), Math.cos(d))
  }

  const machine = useCanvas(
    (ctx, w, h, dt, c) => {
      const s = st.current
      const n = Math.ceil(dt / 0.004)
      for (let k = 0; k < n; k++) {
        const h2 = dt / n
        // charge passive en moteur (elle freine, n'entraîne pas) ; une turbine (cr < 0) entraîne toujours
        const charge = cr > 0 ? cr * Math.tanh(s.w / (0.05 * WS)) : cr
        const acc = Math.sin(s.tf - s.tr) - charge - (FROT * s.w) / WS + (amort ? AMORT * (WS - s.w) : 0)
        s.w += acc * h2
        s.tr += s.w * h2
        s.tf += WS * h2
      }
      if (dt) {
        s.glis += (Math.abs(WS - s.w) / WS - s.glis) * Math.min(1, dt * 1.5)
        const e = s.glis < 0.03 ? 'sync' : 'decroche'
        if (e !== etat) setEtat(e)
      }
      const cx = w / 2
      const cy = h / 2
      const S = Math.min(w, h)
      const Ro = S * 0.48
      const Ri = S * 0.36
      const Rr = S * 0.33
      ctx.beginPath()
      ctx.arc(cx, cy, Ro, 0, TAU)
      ctx.arc(cx, cy, Ri, 0, TAU, true)
      ctx.fillStyle = c.steel
      ctx.fill()
      for (let i = 0; i < 180; i++) {
        const a0 = (i / 180) * TAU
        const a1 = ((i + 1.05) / 180) * TAU
        const B = Math.cos(P * (a0 + a1) * 0.5 - s.tf)
        ctx.globalAlpha = 0.12 + 0.8 * Math.abs(B)
        ctx.fillStyle = B > 0 ? c.north : c.south
        secteur(ctx, cx, cy, Ri - S * 0.035, Ri, a0, a1)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      // rotor à pôles saillants : 2p pôles, S en face du N du champ
      const rot = s.tr / P
      for (let k = 0; k < 2 * P; k++) {
        const a = rot + (k * Math.PI) / P
        secteur(ctx, cx, cy, S * 0.1, Rr, a - 0.42, a + 0.42)
        ctx.fillStyle = k % 2 ? c.north : c.south
        ctx.globalAlpha = 0.9
        ctx.fill()
        ctx.globalAlpha = 1
        ctx.fillStyle = '#fff'
        ctx.font = mono(Math.max(10, S * 0.035), 700)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(k % 2 ? 'N' : 'S', cx + Rr * 0.72 * Math.cos(a), cy - Rr * 0.72 * Math.sin(a))
      }
      ctx.beginPath()
      ctx.arc(cx, cy, S * 0.1, 0, TAU)
      ctx.fillStyle = c.rotor
      ctx.fill()
      // axes du champ et du rotor, angle δ
      const af = s.tf / P
      ctx.setLineDash([5, 4])
      ctx.strokeStyle = c.north
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Ri * Math.cos(af), cy - Ri * Math.sin(af))
      ctx.stroke()
      ctx.setLineDash([])
      ctx.strokeStyle = c.ink
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Rr * 0.95 * Math.cos(rot), cy - Rr * 0.95 * Math.sin(rot))
      ctx.stroke()
    },
    play,
  )

  const courbe = useCanvas((ctx, w, h, _dt, c) => {
    const { X, Y } = repere(ctx, c, { x: 40, y: 18, w: w - 50, h: h - 40 }, { x0: -180, x1: 180, y0: -1.3, y1: 1.3 }, [{ f: (x) => Math.sin(x * DEG), col: c.copper, lw: 2.5 }], {
      label: 'C / Cmax = sin δ',
      yTicks: [-1, 0, 1],
    })
    ctx.fillStyle = c.ok
    ctx.globalAlpha = 0.08
    ctx.fillRect(X(-90), 18, X(90) - X(-90), h - 40)
    ctx.globalAlpha = 1
    ctx.strokeStyle = c.ink
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(X(-180), Y(cr + FROT))
    ctx.lineTo(X(180), Y(cr + FROT))
    ctx.stroke()
    ctx.setLineDash([])
    ctx.font = mono(10)
    ctx.fillStyle = c.muted
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    for (const d of [-180, -90, 0, 90, 180]) ctx.fillText(`${d}°`, X(d), h - 4)
    ctx.textBaseline = 'top'
    ctx.fillText('alternateur', X(-90), 36)
    ctx.fillText('moteur', X(90), 36)
    const d = delta() / DEG
    ctx.beginPath()
    ctx.arc(X(d), Y(Math.sin(d * DEG)), 6, 0, TAU)
    ctx.fillStyle = etat === 'sync' ? c.copper : c.err
    ctx.fill()
  })

  const lancer = (w: number) => {
    const s = st.current
    s.w = w
    s.tr = s.tf - (w ? Math.asin(Math.max(-1, Math.min(1, cr + FROT))) : 0)
    s.glis = w ? 0 : 1
    setPlay(true)
  }
  const d = Math.asin(Math.max(-1, Math.min(1, cr + FROT))) / DEG

  return (
    <>
      <Section
        eyebrow="Constitution"
        title="Un rotor aimanté accroché au champ tournant"
        intro="Stator : enroulements triphasés parcourus par des courants triphasés, qui créent un champ tournant. Rotor : aimant permanent ou électro-aimant alimenté en continu par bagues et balais. Le rotor tourne exactement à la vitesse du champ."
      >
        <Panel>
          <Deux>
            <div className="space-y-2">
              <Toile cref={machine} ratio="1" label="Machine synchrone : champ tournant et rotor à pôles saillants" />
              <div>
                <Pastille col="north">pôle N</Pastille>
                <Pastille col="south">pôle S</Pastille>
              </div>
              <Legende>Pointillé rouge : axe du champ statorique. Trait noir : axe du rotor. L’écart entre les deux est l’angle interne δ.</Legende>
            </div>
            <div className="space-y-3">
              <Toile cref={courbe} ratio="16/10" label="Couple en fonction de l'angle interne" />
              <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ring-1 ${etat === 'sync' ? 'text-ok ring-ok' : 'text-err ring-err'}`}>
                {etat === 'sync' ? 'Accroché : N = Ns' : amort ? 'Décroché : la cage d’amortisseurs le fait tourner en asynchrone' : 'Décroché : le rotor ne suit pas le champ'}
              </span>
              <Mesures
                items={[
                  ['Angle interne δ', etat === 'sync' && Math.abs(cr + FROT) <= 1 ? `${fr(d, 0)}°` : '—', 'champ − rotor'],
                  ['Couple demandé', fr(cr, 2), '× Cmax (+ frottements)'],
                  ['Fonctionnement', cr >= 0 ? 'moteur' : 'alternateur', cr >= 0 ? 'δ > 0, le champ tire le rotor' : 'δ < 0, le rotor pousse le champ'],
                ]}
              />
            </div>
          </Deux>
          <Ligne>
            <Curseur label="Couple sur l’arbre" value={cr} min={-1.2} max={1.2} step={0.02} onChange={setCr} aff={`${fr(cr, 2)} × Cmax`} />
            <Bouton on={amort} onClick={() => setAmort(!amort)}>
              Cage d’amortisseurs
            </Bouton>
          </Ligne>
          <Ligne>
            <Bouton onClick={() => lancer(WS)}>Lancer à la vitesse de synchronisme</Bouton>
            <Bouton onClick={() => lancer(0)}>Démarrer à l’arrêt</Bouton>
            <Lecture play={play} setPlay={setPlay} />
          </Ligne>
          <Legende>
            Animation très ralentie (0,25 tr/s). Couple positif : la machine entraîne une charge (moteur). Couple négatif : une turbine entraîne l’arbre (alternateur). Au-delà de Cmax, δ dépasse 90° et la
            machine décroche.
          </Legende>
        </Panel>
        <Formules
          items={[
            ['Vitesse', 'f = p·n', 'f en Hz, n en tr/s : la vitesse est imposée par la fréquence, quelle que soit la charge.'],
            ['Couple', 'C = Cmax·sin δ', 'Stable tant que |δ| < 90°. Au-delà, plus de couple quand δ augmente : décrochage.'],
            ['Rotor', 'pôles saillants ou lisses', 'Saillants : nombreuses paires de pôles, basses vitesses (hydraulique). Lisses : turbo-alternateurs à 1 ou 2 paires.'],
          ]}
        />
      </Section>

      <Section eyebrow="Alternateur et moteur" title="Deux usages, un démarrage délicat">
        <Deux>
          <div className="rounded-card bg-card p-4 ring-1 ring-line">
            <h3 className="font-semibold">Alternateur</h3>
            <p className="mt-1 text-sm">
              Usage principal (centrales électriques). Une turbine entraîne l’arbre ; branché sur le réseau, l’alternateur produit des tensions triphasées dont la fréquence et l’amplitude sont imposées par
              le réseau.
            </p>
          </div>
          <div className="rounded-card bg-card p-4 ring-1 ring-line">
            <h3 className="font-semibold">Moteur</h3>
            <p className="mt-1 text-sm">
              Alimenté en triphasé, son arbre tourne à la vitesse de synchronisme. Il ne peut pas démarrer seul : à l’arrêt, le champ défile trop vite, le couple change de signe à chaque demi-tour et sa moyenne
              est nulle. Démarrage par un lanceur, ou en asynchrone grâce à la cage d’amortisseurs. Pour la vitesse variable, on l’associe à un onduleur.
            </p>
          </div>
        </Deux>
        <Cle>
          Essayez « Démarrer à l’arrêt » sans la cage d’amortisseurs : le rotor tremble sur place. Avec la cage, il accélère comme un moteur asynchrone, puis s’accroche au champ une fois proche de Ns.
        </Cle>
      </Section>
    </>
  )
}
