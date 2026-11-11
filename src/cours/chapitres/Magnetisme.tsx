import { useRef, useState } from 'react'
import { bOfH, induction, MU0, reluctance } from '../physique'
import { fr, mono, REDUCE, repere, TAU, useCanvas } from '../canvas'
import { Choix, Cle, Curseur, Deux, Formules, Legende, Lecture, Ligne, Mesures, Panel, Quiz, Section, Toile } from '../ui'

/** Circuit d'étude : 200 spires sur un noyau de 20 cm de longueur moyenne et 4 cm² de section. */
const N = 200
const L = 0.2
const S = 4e-4
const MATERIAUX = {
  tole: { nom: 'Tôles de fer', mur: 4000, bsat: 1.6 },
  ferrite: { nom: 'Ferrite', mur: 2000, bsat: 0.4 },
  air: { nom: 'Air (bobine sans noyau)', mur: 1, bsat: 1e6 },
} as const
type Mat = keyof typeof MATERIAUX

export default function Magnetisme() {
  const [mat, setMat] = useState<Mat>('tole')
  const [i, setI] = useState(0.5)
  const [emm, setEmm] = useState(0.2)
  const m = MATERIAUX[mat]
  const air = mat === 'air'
  const c = { n: N, i, l: L, s: S, mur: m.mur, e: emm / 1000, bsat: m.bsat }
  const b = induction(c)
  const hFer = (N * i - (b * c.e) / MU0) / L
  const r = reluctance(c)
  const sat = air ? 0 : b / m.bsat
  const phase = useRef(0)

  const noyau = useCanvas((ctx, w, h, dt, k) => {
    const s = { b, sat, emm, i }
    const t = Math.min(w, h) * 0.18
    const ox = w * 0.1
    const oy = h * 0.08
    const W = w * 0.8
    const H = h * 0.84
    if (!air) {
      ctx.fillStyle = k.steel
      ctx.fillRect(ox, oy, W, H)
      ctx.fillStyle = k.north
      ctx.globalAlpha = 0.45 * Math.max(0, (s.sat - 0.6) / 0.4)
      ctx.fillRect(ox, oy, W, H)
      ctx.globalAlpha = 1
      ctx.fillStyle = k.card
      ctx.fillRect(ox + t, oy + t, W - 2 * t, H - 2 * t)
      const g = (s.emm / 2) * t * 0.9
      ctx.fillRect(ox + W - t - 1, oy + H / 2 - g / 2, t + 2, g)
      ctx.strokeStyle = k.line
      ctx.strokeRect(ox, oy, W, H)
      if (g > 2) {
        ctx.fillStyle = k.muted
        ctx.font = mono(11)
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText('e', ox + W + 6, oy + H / 2)
      }
    }
    // bobine sur la jambe gauche
    ctx.fillStyle = k.copper
    for (let j = 0; j < 9; j++) ctx.fillRect(ox - 8, oy + H * 0.28 + j * H * 0.05, t + 16, H * 0.028)
    ctx.fillStyle = k.ink
    ctx.font = mono(12, 600)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(`n·i = ${fr(N * s.i, 0)} A·t`, ox + t + 14, oy + H / 2)
    // lignes de flux : vitesse et épaisseur proportionnelles à B
    const bn = Math.min(1, Math.abs(s.b) / (air ? 0.002 : 1.6))
    if (!REDUCE) phase.current += dt * 60 * bn
    ctx.setLineDash([10, 9])
    ctx.lineDashOffset = -phase.current
    ctx.strokeStyle = k.north
    ctx.lineWidth = 1 + 4 * bn
    ctx.globalAlpha = 0.25 + 0.75 * bn
    ctx.strokeRect(ox + t / 2, oy + t / 2, W - t, H - t)
    ctx.setLineDash([])
    ctx.globalAlpha = 1
    ctx.fillStyle = k.north
    ctx.textAlign = 'center'
    ctx.fillText('Φ', ox + W / 2, oy + t / 2 - 12 < oy ? oy + t + 12 : oy + t / 2 - 12)
  })

  const courbe = useCanvas((ctx, w, h, _dt, k) => {
    const s = { b, sat, emm, i }
    const x1 = air ? Math.max(1000, (hFer || 1) * 1.5) : (3 * m.bsat) / (MU0 * m.mur)
    const y1 = air ? MU0 * x1 * 1.1 : m.bsat * 1.15
    const { X, Y } = repere(
      ctx,
      k,
      { x: 46, y: 14, w: w - 60, h: h - 44 },
      { x0: 0, x1, y0: 0, y1 },
      [
        { f: (x) => MU0 * m.mur * x, col: k.muted, lw: 1 },
        { f: (x) => bOfH(x, m.mur, m.bsat), col: k.north, lw: 2.5 },
      ],
      { label: 'B (T)', yTicks: air ? [] : [0, m.bsat / 2, m.bsat], yFmt: (v) => fr(v, 1) },
    )
    ctx.fillStyle = k.muted
    ctx.font = mono(10)
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    ctx.fillText('H fer (A/m)', w - 14, h - 4)
    if (!air) {
      ctx.textAlign = 'left'
      ctx.fillText('µ0·µr·H (sans saturation)', X(x1 * 0.22), Y(Math.min(y1 * 0.95, MU0 * m.mur * x1 * 0.22)) - 4)
    }
    const px = X(Math.min(x1, Math.abs(hFer)))
    const py = Y(Math.abs(s.b))
    ctx.beginPath()
    ctx.arc(px, py, 6, 0, TAU)
    ctx.fillStyle = s.sat > 0.85 ? k.err : k.copper
    ctx.fill()
  })

  // Loi de Faraday
  const [f, setF] = useState(50)
  const [bm, setBm] = useState(1)
  const [play, setPlay] = useState(!REDUCE)
  const tf = useRef(0)
  const faraday = useCanvas((ctx, w, h, dt, k) => {
    tf.current += dt * 0.05 // ralenti ×20
    const t0 = tf.current
    const em = N * TAU * f * bm * S
    const box = { x: 46, y: 12, w: w - 56, h: (h - 36) / 2 - 6 }
    repere(ctx, k, box, { x0: 0, x1: 0.04, y0: -1.6, y1: 1.6 }, [{ f: (x) => bm * Math.sin(TAU * f * (x + t0)), col: k.north, lw: 2.5 }], { label: 'Φ / (B·S) : B (T)', yTicks: [-1.5, 0, 1.5], yFmt: (v) => fr(v, 1) })
    const emax = N * TAU * 100 * 1.5 * S
    repere(ctx, k, { ...box, y: box.y + box.h + 18 }, { x0: 0, x1: 0.04, y0: -emax, y1: emax }, [{ f: (x) => -N * TAU * f * bm * S * Math.cos(TAU * f * (x + t0)), col: k.copper, lw: 2.5 }], {
      label: `e = −n·dΦ/dt (crête ${fr(em, 0)} V)`,
      yTicks: [-50, 0, 50],
    })
    ctx.fillStyle = k.muted
    ctx.font = mono(10)
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    ctx.fillText('fenêtre 40 ms', w - 10, h - 2)
  }, play)

  return (
    <>
      <Section eyebrow="Rappel des lois" title="Un courant crée un champ, le champ crée une induction" intro="Le circuit magnétique canalise le flux créé par une bobine, comme un fil canalise le courant.">
        <Formules
          items={[
            ['Théorème d’Ampère', 'H·l = n·i', 'n·i est l’excitation magnétique, en ampères-tours (A·t).'],
            ['Induction', 'B = µ·H = µ0·µr·H', 'Dans l’air µr = 1, µ0 = 4π·10⁻⁷. Dans le fer µr se compte en milliers… jusqu’à la saturation.'],
            ['Flux', 'Φ = B·S  (Wb)', 'S : section du circuit magnétique traversée par l’induction.'],
          ]}
        />
      </Section>

      <Section
        eyebrow="Réluctance et entrefer"
        title="Ce qui freine le flux"
        intro="Faites varier le courant, l’entrefer et le matériau. Le flux défile d’autant plus vite et épais que B est grand ; le fer rougit en approchant de la saturation."
      >
        <Panel>
          <Deux>
            <div className="space-y-2">
              <Toile cref={noyau} ratio="4/3" label="Circuit magnétique avec bobine et entrefer" />
              <Legende>Bobine en cuivre sur la jambe gauche, entrefer e dans la jambe droite. Trait rouge : ligne de flux moyenne.</Legende>
            </div>
            <div className="space-y-2">
              <Toile cref={courbe} ratio="4/3" label="Courbe d'aimantation B(H) et point de fonctionnement" />
              <Legende>Courbe d’aimantation du matériau. Le point suit l’état du fer : au-delà du coude, doubler H ne double plus B.</Legende>
            </div>
          </Deux>
          <Mesures
            items={[
              ['Réluctance', fr(r / 1e6, 2), 'MH⁻¹ (linéaire)'],
              ['Induction B', fr(b, air ? 4 : 2), 'T'],
              ['Flux Φ', fr(b * S * 1e6, 0), 'µWb'],
              ['H dans le fer', fr(hFer, 0), 'A/m'],
              ['Inductance', fr((N * N) / r * 1000, 1), 'mH = n²/R'],
              ['Saturation', air ? '—' : `${fr(sat * 100, 0)} %`, 'B / Bsat'],
            ]}
          />
          <Ligne>
            <Choix label="Matériau" value={mat} onChange={setMat} options={Object.entries(MATERIAUX).map(([k, v]) => [k as Mat, v.nom] as const)} />
            <Curseur label="Courant i" value={i} min={0} max={3} step={0.05} onChange={setI} aff={`${fr(i, 2)} A`} />
            <Curseur label="Entrefer e" value={emm} min={0} max={2} step={0.05} onChange={setEmm} aff={`${fr(emm, 2)} mm`} />
          </Ligne>
        </Panel>
        <Formules
          items={[
            ['Loi d’Hopkinson', 'n·i = R·Φ', 'L’équivalent de la loi d’Ohm U = R·I.'],
            ['Réluctance', 'R = l/(µ0·µr·S) + e/(µ0·S)', 'Avec µr ≈ 4000, un entrefer de 0,2 mm pèse déjà plus lourd que 20 cm de fer.'],
            ['Inductance', 'L = n² / R', 'L’entrefer abaisse L mais retarde la saturation : c’est là que l’énergie ½·L·i² se stocke.'],
          ]}
        />
        <Cle>
          Sans entrefer, la réluctance est faible et quelques ampères suffisent à saturer le fer. L’entrefer rend la réluctance presque indépendante du matériau : R ≈ e/(µ0·S). C’est pour cela que les
          inductances de lissage et les transformateurs de flyback ont un entrefer.
        </Cle>
      </Section>

      <Section eyebrow="Analogie" title="Électricité et magnétisme">
        <div className="overflow-x-auto rounded-card ring-1 ring-line">
          <table className="w-full min-w-[520px] bg-card text-sm">
            <thead className="bg-card-2 text-left text-xs text-muted">
              <tr>
                <th className="px-3 py-2">Magnétique</th>
                <th className="px-3 py-2">Notation</th>
                <th className="px-3 py-2">Électrique</th>
                <th className="px-3 py-2">Notation</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Force magnétomotrice', 'n·i (A·t)', 'Force électromotrice', 'E (V)'],
                ['Flux : induction à travers une section', 'Φ (Wb)', 'Intensité : électrons à travers une section', 'I (A)'],
                ['Réluctance : freine le passage du flux', 'R (H⁻¹)', 'Résistance : freine le passage du courant', 'R (Ω)'],
              ].map((r) => (
                <tr key={r[0]} className="border-t border-line">
                  {r.map((x, k) => (
                    <td key={k} className={`px-3 py-2 ${k % 2 ? 'font-mono' : ''}`}>
                      {x}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Quiz
          question="Quel est l’équivalent électrique de l’excitation magnétique ?"
          choix={['Le courant', 'La tension', 'La puissance active', 'La puissance réactive']}
          bonne={1}
          pourquoi="n·i « pousse » le flux à travers la réluctance comme une tension pousse le courant à travers une résistance : c’est une force magnétomotrice."
        />
      </Section>

      <Section
        eyebrow="Loi de Faraday"
        title="Un flux qui varie induit une tension"
        intro="Le flux alternatif d’un transformateur induit e = −n·dΦ/dt dans chaque enroulement. L’amplitude de e croît avec la fréquence : à tension donnée, plus f est grand, plus B est petit."
      >
        <Panel>
          <Toile cref={faraday} ratio="16/7" label="Flux sinusoïdal et tension induite" />
          <Mesures
            items={[
              ['f', fr(f, 0), 'Hz'],
              ['Bmax', fr(bm, 2), 'T'],
              ['E efficace', fr(4.44 * N * f * bm * S, 1), 'V = 4,44·n·f·Bmax·S'],
            ]}
          />
          <Ligne>
            <Curseur label="Fréquence" value={f} min={10} max={100} onChange={setF} aff={`${f} Hz`} />
            <Curseur label="Induction maximale" value={bm} min={0.1} max={1.5} step={0.05} onChange={setBm} aff={`${fr(bm, 2)} T`} />
            <Lecture play={play} setPlay={setPlay} />
          </Ligne>
          <Legende>Animation ralentie 20 fois. e est en quadrature avec Φ : maximale quand Φ passe par zéro, là où il varie le plus vite.</Legende>
        </Panel>
        <Formules
          items={[
            ['Faraday', 'e = −n·dΦ/dt', 'Le signe moins (Lenz) : e s’oppose à la variation qui lui donne naissance.'],
            ['Formule de Boucherot', 'E = 4,44·n·f·Bmax·S', 'Valable en sinusoïdal. Bmax = E/(4,44·n·f·S) : on la retrouvera avec la loi V/f constant.'],
            ['Tension en créneaux', 'V·Δt = n·S·ΔB', 'Sous tension constante, B monte en rampe : le produit tension × durée d’impulsion est limité par Bsat.'],
          ]}
        />
      </Section>

      <Section eyebrow="Matériaux" title="Air, tôles, ferrites">
        <div className="grid gap-3 md:grid-cols-3">
          {[
            ['L’air', 'Très hautes fréquences et faibles puissances. Aucune saturation, aucune perte fer, mais µr = 1 : il faut beaucoup de spires.'],
            ['Les tôles de fer', 'Fréquences industrielles (16 ⅔, 50, 60 et 400 Hz). Feuilletées et isolées pour limiter les courants de Foucault.'],
            ['Les ferrites', 'Céramiques magnétiques moulées pour les hautes fréquences : isolantes, donc presque sans courants de Foucault, mais Bsat ≈ 0,3 à 0,4 T.'],
          ].map(([t, d]) => (
            <div key={t} className="rounded-card bg-card p-4 ring-1 ring-line">
              <h3 className="font-semibold">{t}</h3>
              <p className="mt-1 text-sm text-muted">{d}</p>
            </div>
          ))}
        </div>
        <Cle>Les matériaux canalisent le flux et stockent l’énergie électromagnétique. Le tore canalise mieux le flux qu’un circuit en E ou en U et réduit les flux de fuite.</Cle>
      </Section>
    </>
  )
}
