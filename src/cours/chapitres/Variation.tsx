import { useMemo, useRef, useState } from 'react'
import { coupleMas, harmoniques, masVf, mli, nSync, pleineOnde, pointMas, porteuse, type Mas } from '../physique'
import { fr, mono, REDUCE, repere, TAU, useCanvas } from '../canvas'
import { Bouton, Choix, Cle, Curseur, Deux, Formules, Legende, Lecture, Ligne, Mesures, Panel, Section, Toile } from '../ui'

export default function Variation() {
  return (
    <>
      <Section
        eyebrow="Régulation d’une MAS"
        title="Pourquoi un variateur ?"
        intro="Dans une machine à courant continu, couple et vitesse sont presque indépendants. Dans une machine asynchrone, le couple dépend du flux et de la pulsation rotorique g·ω : pour bien la piloter, il faut agir sur la fréquence et la tension."
      >
        <Formules
          items={[
            ['MCC', 'N = E/(k·Φ), C = k·Φ·I', 'La tension règle la vitesse, le courant règle le couple.'],
            ['MAS', 'Ns = 60·f/p', 'Seule la fréquence déplace la vitesse de façon notable : il faut une source de fréquence variable.'],
            ['Onduleur', 'continu → alternatif', 'Vitesse variable des machines alternatives, ou onduleur de secours à fréquence fixe.'],
          ]}
        />
      </Section>
      <Structure />
      <Onduleur />
      <Vf />
      <Section eyebrow="Commande vectorielle" title="Découpler flux et couple">
        <Cle>
          Dans une MAS, le même courant crée le flux et donne le couple. Pour les séparer comme dans une MCC, on modélise la machine et on transforme mathématiquement ses grandeurs : c’est le contrôle
          vectoriel. Il donne de bien meilleures performances (couple à vitesse nulle, dynamique), au prix d’une commande plus lourde.
        </Cle>
        <div className="overflow-x-auto rounded-card ring-1 ring-line">
          <table className="w-full min-w-[480px] bg-card text-sm">
            <thead className="bg-card-2 text-left text-xs text-muted">
              <tr>
                <th className="px-3 py-2" />
                <th className="px-3 py-2">Scalaire (V/f)</th>
                <th className="px-3 py-2">Vectorielle</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Boucle', 'ouverte (estimation du couple)', 'fermée, modèle de la machine'],
                ['Couple à basse vitesse', 'faible', 'nominal, même à l’arrêt'],
                ['Précision de vitesse', 'dépend du glissement', 'élevée'],
                ['Usage', 'pompes, ventilateurs, convoyeurs', 'levage, machines-outils, traction'],
              ].map((r) => (
                <tr key={r[0]} className="border-t border-line">
                  {r.map((x, k) => (
                    <td key={k} className={`px-3 py-2 ${k ? '' : 'font-semibold'}`}>
                      {x}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  )
}

/* ---------- structure du variateur ---------- */

function Structure() {
  const [frein, setFrein] = useState(false)
  const bloc = (x: number, t: string, s: string, on = true) => (
    <g key={t}>
      <rect x={x} y="60" width="92" height="56" rx="8" fill="var(--color-card)" stroke={on ? 'var(--color-ink)' : 'var(--color-line)'} strokeWidth="1.6" />
      <text x={x + 46} y="84" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--color-ink)">
        {t}
      </text>
      <text x={x + 46} y="100" textAnchor="middle" fontSize="9.5" fill="var(--color-muted)">
        {s}
      </text>
    </g>
  )
  const chemin = frein ? 'M520,88 H435 M350,88 H330 V160' : 'M10,88 H560'
  return (
    <Section
      eyebrow="Structure d’un variateur"
      title="Redresser, filtrer, onduler"
      intro="Alimenté par le secteur (mono ou triphasé), le variateur contient l’électronique de puissance, la commande et les protections. Le redresseur en tête fournit une tension continue à l’onduleur, qui fixe la fréquence du champ tournant."
    >
      <Panel>
        <svg viewBox="0 0 580 190" role="img" aria-label="Structure d'un variateur de vitesse et sens de l'énergie" className="w-full">
          <path d="M10,88 H560" stroke="var(--color-muted)" strokeWidth="1.6" />
          <path d={chemin} fill="none" stroke={frein ? 'var(--color-north)' : 'var(--color-copper)'} strokeWidth="5" strokeDasharray="0.1 14" strokeLinecap="round" className={REDUCE ? '' : 'flux-anim'} />
          <text x="10" y="50" fontSize="11" fill="var(--color-ink)">
            réseau
          </text>
          {bloc(40, 'Redresseur', 'à diodes')}
          <g>
            <path d="M160,88 V112 M150,112 H170 M150,118 H170 M160,118 V130" stroke="var(--color-ink)" strokeWidth="1.8" />
            <text x="160" y="146" textAnchor="middle" fontSize="9.5" fill="var(--color-muted)">
              condensateur
            </text>
          </g>
          {bloc(190, 'Hacheur de', 'freinage', frein)}
          <rect x="318" y="140" width="24" height="40" fill={frein ? 'var(--color-north)' : 'var(--color-card)'} stroke="var(--color-ink)" strokeWidth="1.4" opacity={frein ? 0.8 : 1} />
          <path d="M236,116 V130 H330 V140" stroke="var(--color-ink)" strokeWidth="1.4" fill="none" />
          <text x="350" y="166" fontSize="9.5" fill="var(--color-muted)">
            R freinage
          </text>
          {bloc(350, 'Onduleur', 'MLI, f et V variables')}
          <circle cx="510" cy="88" r="26" fill="var(--color-card)" stroke="var(--color-ink)" strokeWidth="1.8" />
          <text x="510" y="86" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--color-ink)">
            M
          </text>
          <text x="510" y="100" textAnchor="middle" fontSize="10" fill="var(--color-ink)">
            3~
          </text>
        </svg>
        <Ligne>
          <Choix
            label="Régime"
            value={frein ? 'f' : 'm'}
            onChange={(v) => setFrein(v === 'f')}
            options={[
              ['m', 'Moteur : le réseau fournit'],
              ['f', 'Freinage : le moteur renvoie'],
            ]}
          />
        </Ligne>
        <p className="text-sm">
          {frein
            ? 'Au freinage, la machine fonctionne en génératrice (N > Ns) : l’onduleur renvoie l’énergie vers le bus continu. Le redresseur à diodes ne peut pas la rendre au réseau : la tension du condensateur monte, le hacheur de freinage la dissipe dans la résistance.'
            : 'En moteur, l’énergie va du réseau vers la machine : redressée, filtrée par le condensateur puis découpée par l’onduleur en un système triphasé de fréquence et d’amplitude réglables.'}
        </p>
      </Panel>
    </Section>
  )
}

/* ---------- onduleur : pleine onde contre MLI ---------- */

const F = 50
const NS = 2400

function Onduleur() {
  const [cmd, setCmd] = useState<'pleine' | 'mli'>('mli')
  const [ma, setMa] = useState(0.8)
  const [mf, setMf] = useState(15)
  const [play, setPlay] = useState(!REDUCE)
  const t = useRef(0)
  const fp = mf * F
  const v = useMemo(() => (cmd === 'mli' ? (x: number) => mli(x, 1, F, fp, ma) : (x: number) => pleineOnde(x, 1, F)), [cmd, fp, ma])
  // courant dans une charge R-L (τ = 1/ω) : quatre périodes pour s'établir, on garde la dernière
  const cour = useMemo(() => {
    const T = 1 / F
    const tau = 1 / (TAU * F)
    const dt = T / NS
    const out = new Float32Array(NS)
    let i = 0
    for (let k = 0; k < 5 * NS; k++) {
      i += ((v(k * dt) - i) / tau) * dt
      if (k >= 4 * NS) out[k - 4 * NS] = i
    }
    return out
  }, [v])
  const h = useMemo(() => harmoniques(v, F, 45, 4096), [v])

  const ondes = useCanvas(
    (ctx, w, hh, dt, c) => {
      t.current = (t.current + dt / 3) % 1
      const box = { x: 40, y: 14, w: w - 50, h: (hh - 30) / 2 - 6 }
      const traces = [{ f: (x: number) => v(x / F), col: c.ink, lw: 1.4, n: 2000 }]
      if (cmd === 'mli') {
        repere(
          ctx,
          c,
          box,
          { x0: 0, x1: 1, y0: -1.25, y1: 1.25 },
          [
            { f: (x) => porteuse(x / F, fp), col: c.muted, lw: 1, n: 2000 },
            { f: (x) => ma * Math.sin(TAU * x), col: c.north, lw: 2.5 },
          ],
          { label: 'référence et porteuse' },
        )
      } else repere(ctx, c, box, { x0: 0, x1: 1, y0: -1.25, y1: 1.25 }, [{ f: (x) => Math.sin(TAU * x), col: c.north, lw: 2 }], { label: 'sinusoïde souhaitée' })
      const b2 = { ...box, y: box.y + box.h + 22 }
      const { X } = repere(ctx, c, b2, { x0: 0, x1: 1, y0: -1.3, y1: 1.3 }, [...traces, { f: (x) => cour[Math.min(NS - 1, Math.floor(x * NS))] * 1.4, col: c.copper, lw: 2.5 }], {
        label: 'tension de sortie ±E (noir) et courant filtré (cuivre)',
      })
      const x = X(t.current)
      ctx.strokeStyle = c.accent
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(x, 14)
      ctx.lineTo(x, hh - 4)
      ctx.stroke()
    },
    play,
  )

  const spectre = useCanvas((ctx, w, hh, _dt, c) => {
    const L = 34
    const B = 22
    const pw = w - L - 8
    const ph = hh - B - 18
    const bw = pw / h.length
    ctx.font = mono(10)
    ctx.fillStyle = c.muted
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText('amplitude des harmoniques (× E)', L, 0)
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    for (const y of [0, 0.5, 1]) ctx.fillText(fr(y, 1), L - 4, 18 + ph - (y / 1.35) * ph)
    h.forEach((a, k) => {
      const y = (a / 1.35) * ph
      ctx.fillStyle = k === 0 ? c.north : c.copper
      ctx.fillRect(L + k * bw + 1, 18 + ph - y, Math.max(1, bw - 2), y)
    })
    ctx.fillStyle = c.muted
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    for (const k of [1, 5, 15, 25, 35, 45]) ctx.fillText(String(k), L + (k - 0.5) * bw, hh)
  })

  const thd = Math.sqrt(h.slice(1).reduce((s, a) => s + a * a, 0)) / h[0]
  return (
    <Section
      eyebrow="Onduleur monophasé"
      title="Pleine onde ou MLI"
      intro="Deux bras de pont, quatre interrupteurs bidirectionnels en courant. Les tensions de sortie ne sont pas sinusoïdales : la stratégie de commande décide de leur contenu harmonique."
    >
      <Panel>
        <Deux>
          <Toile cref={ondes} ratio="4/3" label="Référence, porteuse, tension de sortie et courant" />
          <div className="space-y-3">
            <Toile cref={spectre} ratio="16/10" label="Spectre de la tension de sortie" />
            <Mesures
              items={[
                ['Fondamental', fr(h[0], 2), '× E (crête)'],
                ['Harmonique 3', fr(h[2], 2), '× E'],
                ['Distorsion', `${fr(thd * 100, 0)} %`, 'THD de la tension'],
              ]}
            />
          </div>
        </Deux>
        <Ligne>
          <Choix
            label="Commande"
            value={cmd}
            onChange={setCmd}
            options={[
              ['pleine', 'Pleine onde'],
              ['mli', 'MLI sinus-triangle'],
            ]}
          />
          <Lecture play={play} setPlay={setPlay} />
        </Ligne>
        {cmd === 'mli' && (
          <Ligne>
            <Curseur label="Indice de modulation ma" value={ma} min={0.1} max={1} step={0.05} onChange={setMa} aff={fr(ma, 2)} />
            <Curseur label="Porteuse / fondamental" value={mf} min={3} max={41} step={2} onChange={setMf} aff={`${mf} (${fr(fp / 1000, 2)} kHz)`} />
          </Ligne>
        )}
        <Legende>
          Une seule période de {F} Hz. En pleine onde, les harmoniques 3, 5, 7… valent 1/3, 1/5, 1/7 du fondamental : filtrage difficile. En MLI, le fondamental vaut ma·E et les harmoniques sont rejetés autour
          de la fréquence de porteuse, faciles à filtrer par l’inductance de la charge.
        </Legende>
      </Panel>
      <Formules
        items={[
          ['Pleine onde', 'V1 = 4E/π', 'Commande facile, beaucoup d’harmoniques de basse fréquence, amplitude non réglable.'],
          ['MLI', 'V1 = ma·E', 'Un découpage judicieux supprime les harmoniques basse fréquence. Il reste du bruit HF, facile à filtrer : courants plus sinusoïdaux.'],
          ['Réglage', 'f par la référence, V par ma', 'L’onduleur MLI règle à la fois la fréquence et l’amplitude : tout ce qu’il faut pour la loi V/f.'],
        ]}
      />
    </Section>
  )
}

/* ---------- loi V/f ---------- */

const MOT: Mas = { f: 50, p: 2, cmax: 65, gm: 0.2 }
const VN = 230

/** Au-dessus de fn, la tension plafonne : le flux et Cmax baissent comme (fn/f)². */
const masA = (f: number): Mas => ({ ...masVf(MOT, f), cmax: MOT.cmax * Math.min(1, MOT.f / f) ** 2 })

function Vf() {
  const [f, setF] = useState(30)
  const [cr, setCr] = useState(30)
  const [comp, setComp] = useState(false)
  const charge = () => cr
  // compensation : on monte la fréquence jusqu'à ce que N retrouve 60·f/p
  const fr2 = useMemo(() => {
    if (!comp) return f
    const cible = nSync(f, MOT.p)
    let lo = f
    let hi = f * 1.6 + 5
    for (let k = 0; k < 50; k++) {
      const x = (lo + hi) / 2
      const pt = pointMas(masA(x), () => cr)
      if (pt && pt.n >= cible) hi = x
      else lo = x
    }
    return hi
  }, [comp, f, cr])
  const m = masA(fr2)
  const pt = pointMas(m, charge)
  const v = VN * Math.min(1, fr2 / MOT.f)
  const courbes = useCanvas((ctx, w, h, _dt, c) => {
    const nmax = nSync(80, MOT.p)
    const { X, Y } = repere(
      ctx,
      c,
      { x: 40, y: 18, w: w - 50, h: h - 42 },
      { x0: 0, x1: nmax, y0: 0, y1: 80 },
      [
        ...[10, 20, 30, 40, 50, 60, 70].map((ff) => ({ f: (n: number) => Math.max(0, coupleMas(masA(ff), n)), col: c.line, lw: 1.2 })),
        { f: (n: number) => Math.max(0, coupleMas(m, n)), col: c.copper, lw: 3 },
        { f: () => cr, col: c.ink, lw: 2 },
      ],
      { label: 'C (N·m) selon N', yTicks: [0, 20, 40, 60, 80] },
    )
    ctx.font = mono(10)
    ctx.fillStyle = c.muted
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    for (let n = 0; n <= nmax; n += 600) ctx.fillText(String(n), X(n), h - 4)
    if (pt) {
      ctx.beginPath()
      ctx.arc(X(pt.n), Y(pt.c), 6, 0, TAU)
      ctx.fillStyle = c.copper
      ctx.fill()
    }
    const ns = nSync(fr2, MOT.p)
    ctx.setLineDash([4, 4])
    ctx.strokeStyle = c.muted
    ctx.beginPath()
    ctx.moveTo(X(ns), 18)
    ctx.lineTo(X(ns), h - 24)
    ctx.stroke()
    ctx.setLineDash([])
  })
  return (
    <Section
      eyebrow="Loi V/f constant"
      title="Changer de vitesse sans changer de flux"
      intro="Si l’on baisse la fréquence sans baisser la tension, le flux augmente et la machine sature. D’après Boucherot V = 4,44·n·B·S·f : garder V/f constant garde le flux, donc le couple maximal. La courbe de couple glisse alors parallèlement à elle-même."
    >
      <Panel>
        <Deux>
          <Toile cref={courbes} ratio="4/3" label="Famille de courbes couple-vitesse pour plusieurs fréquences" />
          <div className="space-y-3">
            <Mesures
              items={[
                ['f onduleur', fr(fr2, 1), comp ? `Hz (consigne ${f} + ${fr(fr2 - f, 1)})` : 'Hz'],
                ['V', fr(v, 0), 'V (tension simple)'],
                ['V/f', fr(v / fr2, 2), 'V/Hz'],
                ['Flux', `${fr(Math.min(1, MOT.f / fr2) * 100, 0)} %`, 'du flux nominal'],
                ['Ns', fr(nSync(fr2, MOT.p), 0), 'tr/min'],
                ['N', pt ? fr(pt.n, 0) : 'calé', 'tr/min'],
              ]}
            />
            <Legende>
              Courbes grises : 10 à 70 Hz. Jusqu’à 50 Hz, V/f = {fr(VN / 50, 1)} V/Hz : même Cmax, même écart de vitesse. Au-delà, la tension plafonne à {VN} V : le flux baisse (défluxage) et Cmax avec lui.
            </Legende>
          </div>
        </Deux>
        <Ligne>
          <Curseur label="Fréquence de consigne" value={f} min={5} max={80} onChange={setF} aff={`${f} Hz`} />
          <Curseur label="Couple de charge" value={cr} min={0} max={60} onChange={setCr} aff={`${cr} N·m`} />
          <Bouton on={comp} onClick={() => setComp(!comp)}>
            Compensation du glissement
          </Bouton>
        </Ligne>
      </Panel>
      <Formules
        items={[
          ['Flux', 'Φ = B·S = V / (4,44·n·f)', 'V/f = constante ⇒ Φ = constante.'],
          ['Boucle ouverte', 'f impose Ns', 'La vitesse réelle baisse avec le couple (C = k·g) : sans capteur, on ne la connaît pas exactement.'],
          ['Compensation', 'f augmentée de g·f', 'La commande estime le couple (ou mesure la vitesse, en boucle fermée) et relève f pour retrouver la vitesse voulue.'],
        ]}
      />
      <Cle>
        La commande est numérique : MLI, surveillance des défauts, rampes d’accélération et de freinage, compensation du glissement. Le contenu harmonique plus faible de la MLI réduit l’échauffement du moteur.
      </Cle>
    </Section>
  )
}
