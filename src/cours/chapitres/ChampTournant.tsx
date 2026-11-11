import { useRef, useState } from 'react'
import { nSync } from '../physique'
import { fleche, fr, mono, REDUCE, secteur, TAU, useCanvas } from '../canvas'
import { Bouton, Choix, Cle, Curseur, Deux, Formules, Legende, Lecture, Ligne, Mesures, Panel, Pastille, Section, Toile } from '../ui'

export default function ChampTournant() {
  return (
    <>
      <Section
        eyebrow="Machines à courant alternatif"
        title="Faire tourner une boussole sans rien faire tourner"
        intro="Les machines alternatives fonctionnent par interaction d’un champ statorique et d’un champ rotorique. Pour qu’une boussole tourne, il suffirait de faire tourner l’aimant… mais il faudrait déjà faire tourner quelque chose. Solution : trois bobines fixes à 120°, alimentées successivement."
      >
        <TroisBobines />
      </Section>
      <Multipolaire />
      <Section eyebrow="Vocabulaire" title="Inducteur et induit">
        <Formules
          items={[
            ['Inducteur', 'crée le champ', 'Aimants permanents ou bobinages alimentés en continu.'],
            ['Induit', 'siège des f.é.m.', 'Bobinages soumis à un champ variable, donc siège de forces électromotrices induites.'],
            ['Selon la machine', 'synchrone ≠ asynchrone', 'Synchrone : inducteur au rotor, induit au stator. Asynchrone : les deux enroulements sont sièges de f.é.m., on ne parle ni d’induit ni d’inducteur.'],
          ]}
        />
        <Cle>
          Le stator d’une machine alternative est un empilage de tôles encochées. Chaque encoche reçoit des conducteurs isolés, maintenus par une cale ; les têtes de bobines relient les encoches entre elles
          aux deux extrémités.
        </Cle>
      </Section>
    </>
  )
}

function TroisBobines() {
  const [play, setPlay] = useState(!REDUCE)
  const [inv, setInv] = useState(false)
  const [vit, setVit] = useState(0.5)
  const phi = useRef(0)
  const aiguille = useRef(0)
  const cour = (p: number) => {
    const i = [Math.cos(p), Math.cos(p - TAU / 3), Math.cos(p - (2 * TAU) / 3)]
    return inv ? [i[0], i[2], i[1]] : i
  }

  const bob = useCanvas(
    (ctx, w, h, dt, c) => {
      phi.current += TAU * vit * dt
      const I = cour(phi.current)
      const col = [c.l1, c.l2, c.l3]
      const cx = w / 2
      const cy = h / 2
      const R = Math.min(w, h) * 0.4
      const u = R / 1.6
      // bobines fixes
      for (let k = 0; k < 3; k++) {
        const a = (k * TAU) / 3
        const x = cx + R * Math.cos(a)
        const y = cy - R * Math.sin(a)
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(-a)
        ctx.fillStyle = c.copper
        ctx.globalAlpha = 0.25 + 0.75 * Math.abs(I[k])
        ctx.fillRect(-10, -20, 20, 40)
        ctx.globalAlpha = 1
        ctx.strokeStyle = col[k]
        ctx.lineWidth = 2
        ctx.strokeRect(-10, -20, 20, 40)
        ctx.restore()
        ctx.fillStyle = col[k]
        ctx.font = mono(12, 600)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(`${k + 1}`, cx + (R + 26) * Math.cos(a), cy - (R + 26) * Math.sin(a))
        // axe et champ de la bobine
        ctx.strokeStyle = c.line
        ctx.setLineDash([3, 4])
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(cx - u * Math.cos(a), cy + u * Math.sin(a))
        ctx.lineTo(cx + u * Math.cos(a), cy - u * Math.sin(a))
        ctx.stroke()
        ctx.setLineDash([])
        fleche(ctx, cx, cy, cx + u * I[k] * Math.cos(a), cy - u * I[k] * Math.sin(a), col[k], 2.5)
      }
      // champ résultant
      const bx = I.reduce((s, i, k) => s + i * Math.cos((k * TAU) / 3), 0)
      const by = I.reduce((s, i, k) => s + i * Math.sin((k * TAU) / 3), 0)
      const ang = Math.atan2(by, bx)
      // la boussole suit le champ avec un peu d'inertie
      let d = ang - aiguille.current
      d = Math.atan2(Math.sin(d), Math.cos(d))
      aiguille.current += dt ? d * Math.min(1, dt * 8) : d
      ctx.strokeStyle = c.line
      ctx.setLineDash([3, 4])
      ctx.beginPath()
      ctx.arc(cx, cy, u * 1.5, 0, TAU)
      ctx.stroke()
      ctx.setLineDash([])
      fleche(ctx, cx, cy, cx + u * bx, cy - u * by, c.north, 4)
      // aiguille
      const na = aiguille.current
      const ln = u * 0.55
      ctx.lineWidth = 6
      ctx.lineCap = 'round'
      ctx.strokeStyle = c.north
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + ln * Math.cos(na), cy - ln * Math.sin(na))
      ctx.stroke()
      ctx.strokeStyle = c.south
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx - ln * Math.cos(na), cy + ln * Math.sin(na))
      ctx.stroke()
      ctx.lineCap = 'butt'
      ctx.beginPath()
      ctx.arc(cx, cy, 5, 0, TAU)
      ctx.fillStyle = c.ink
      ctx.fill()
    },
    play,
  )

  const ondes = useCanvas((ctx, w, h, _dt, c) => {
    const col = [c.l1, c.l2, c.l3]
    const x0 = 34
    const x1 = w - 10
    const ym = h / 2
    const amp = h / 2 - 22
    ctx.strokeStyle = c.line
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x0, ym)
    ctx.lineTo(x1, ym)
    ctx.stroke()
    ctx.fillStyle = c.muted
    ctx.font = mono(11)
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillText('+Î', x0 - 4, ym - amp)
    ctx.fillText('−Î', x0 - 4, ym + amp)
    for (let k = 0; k < 3; k++) {
      ctx.strokeStyle = col[k]
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let i = 0; i <= 160; i++) {
        const y = ym - amp * cour((i / 160) * TAU)[k]
        const x = x0 + ((x1 - x0) * i) / 160
        if (i) ctx.lineTo(x, y)
        else ctx.moveTo(x, y)
      }
      ctx.stroke()
    }
    const p = ((phi.current % TAU) + TAU) % TAU
    const xc = x0 + ((x1 - x0) * p) / TAU
    ctx.strokeStyle = c.muted
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(xc, 8)
    ctx.lineTo(xc, h - 8)
    ctx.stroke()
    ctx.setLineDash([])
    cour(p).forEach((i, k) => {
      ctx.beginPath()
      ctx.arc(xc, ym - amp * i, 4, 0, TAU)
      ctx.fillStyle = col[k]
      ctx.fill()
    })
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillStyle = c.muted
    ctx.fillText('i1, i2, i3 sur une période', x0 + 4, 4)
  })

  return (
    <Panel>
      <Deux>
        <div className="space-y-2">
          <Toile cref={bob} ratio="1" label="Trois bobines à 120°, leurs champs et le champ résultant" />
          <div>
            <Pastille col="l1">bobine 1</Pastille>
            <Pastille col="l2">bobine 2</Pastille>
            <Pastille col="l3">bobine 3</Pastille>
            <Pastille col="north">champ résultant</Pastille>
          </div>
        </div>
        <div className="space-y-3">
          <Toile cref={ondes} ratio="16/9" label="Courants des trois phases" />
          <Legende>
            Chaque bobine crée un champ qui pulse sur place, le long de son axe. La somme garde une longueur constante, 3/2 de l’amplitude d’une bobine, et tourne d’un tour par période : l’aiguille de la
            boussole la suit.
          </Legende>
          <Mesures
            items={[
              ['Vitesse affichée', fr(vit, 2), 'tours/s'],
              ['Sens', inv ? 'horaire' : 'trigo', inv ? 'phases 2 et 3 croisées' : 'ordre 1, 2, 3'],
            ]}
          />
        </div>
      </Deux>
      <Ligne>
        <Curseur label="Fréquence (ralentie)" value={vit} min={0.1} max={1.5} step={0.05} onChange={setVit} aff={`${fr(vit, 2)} Hz`} />
        <Bouton on={inv} onClick={() => setInv(!inv)}>
          Croiser deux phases
        </Bouton>
        <Lecture play={play} setPlay={setPlay} />
      </Ligne>
      <Cle>Croiser deux fils d’alimentation inverse l’ordre des phases, donc le sens du champ tournant : c’est ainsi qu’on inverse le sens d’un moteur triphasé.</Cle>
    </Panel>
  )
}

function Multipolaire() {
  const [p, setP] = useState(2)
  const [f, setF] = useState(50)
  const [play, setPlay] = useState(!REDUCE)
  const t = useRef(0)
  const ring = useCanvas(
    (ctx, w, h, dt, c) => {
      t.current += dt
      const cx = w / 2
      const cy = h / 2
      const R = Math.min(w, h) * 0.46
      const r = R * 0.62
      const rot = (t.current * TAU * 0.6 * (f / 50)) / p // même fréquence électrique, 1/p tour par période
      for (let k = 0; k < 2 * p; k++) {
        const a0 = rot + (k * Math.PI) / p
        const a1 = a0 + Math.PI / p
        secteur(ctx, cx, cy, r, R, a0, a1)
        ctx.fillStyle = k % 2 ? c.south : c.north
        ctx.globalAlpha = 0.85
        ctx.fill()
        ctx.globalAlpha = 1
        const am = (a0 + a1) / 2
        ctx.fillStyle = '#fff'
        ctx.font = mono(12, 600)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(k % 2 ? 'S' : 'N', cx + ((r + R) / 2) * Math.cos(am), cy - ((r + R) / 2) * Math.sin(am))
      }
      ctx.beginPath()
      ctx.arc(cx, cy, r - 4, 0, TAU)
      ctx.fillStyle = c.rotor
      ctx.fill()
      ctx.fillStyle = c.ink
      ctx.font = mono(14, 600)
      ctx.fillText(`${2 * p} pôles`, cx, cy - 9)
      ctx.font = mono(12)
      ctx.fillText(`${fr(nSync(f, p), 0)} tr/min`, cx, cy + 10)
    },
    play,
  )
  return (
    <Section
      eyebrow="Champs multipolaires"
      title="Plus il y a de pôles, moins le champ tourne vite"
      intro="En répétant p fois le motif des trois bobines autour du stator, on obtient p paires de pôles. Pendant une période des courants, le champ n’avance que d’une paire de pôles : 1/p de tour."
    >
      <Panel>
        <div className="grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_260px]">
          <div className="space-y-4">
            <Choix label="Paires de pôles" value={p} onChange={setP} options={[1, 2, 3, 4, 5, 6].map((k) => [k, `p = ${k}`] as const)} />
            <Curseur label="Fréquence des courants" value={f} min={10} max={100} onChange={setF} aff={`${f} Hz`} />
            <div className="overflow-x-auto rounded-lg ring-1 ring-line">
              <table className="w-full text-center font-mono text-sm">
                <tbody>
                  <tr className="bg-card-2 text-xs text-muted">
                    <th className="px-2 py-1.5 text-left font-sans">p</th>
                    {[1, 2, 3, 4, 5, 6].map((k) => (
                      <td key={k} className={k === p ? 'font-bold text-copper' : ''}>
                        {k}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t border-line">
                    <th className="px-2 py-1.5 text-left font-sans text-xs text-muted">Ns (tr/min) à {f} Hz</th>
                    {[1, 2, 3, 4, 5, 6].map((k) => (
                      <td key={k} className={k === p ? 'font-bold text-copper' : ''}>
                        {fr(nSync(f, k), 0)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <Lecture play={play} setPlay={setPlay} />
          </div>
          <Toile cref={ring} ratio="1" label="Pôles du champ tournant" />
        </div>
      </Panel>
      <Formules
        items={[
          ['Vitesse du champ', 'f = p·ns', 'f en Hz, ns en tr/s. Soit Ns = 60·f/p en tr/min.'],
          ['En rad/s', 'Ωs = ω/p = 2π·f/p', 'ω : pulsation des courants statoriques.'],
          ['À 50 Hz', '3000, 1500, 1000, 750…', 'Une machine à 50 Hz ne peut tourner qu’au voisinage de ces vitesses (« culture technique »).'],
        ]}
      />
    </Section>
  )
}
