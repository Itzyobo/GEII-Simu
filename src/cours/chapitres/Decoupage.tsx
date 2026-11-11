import { useRef, useState } from 'react'
import { flyback, flybackAt, type Flyback } from '../physique'
import { fr, mono, REDUCE, repere, useCanvas } from '../canvas'
import { Bouton, Cle, Curseur, Deux, Formules, Legende, Lecture, Ligne, Mesures, Panel, Quiz, Section, Toile } from '../ui'

const E = 24
const M = 0.5
const L1 = 200e-6
const VCONS = 12

/** α qui donne Vs = cible (Vs croît avec α) : ce que fait la boucle de régulation par optocoupleur. */
function alphaPour(p: Omit<Flyback, 'alpha'>, cible: number) {
  let lo = 0.02
  let hi = 0.9
  for (let k = 0; k < 40; k++) {
    const a = (lo + hi) / 2
    if (flyback({ ...p, alpha: a }).vs > cible) hi = a
    else lo = a
  }
  return lo
}

export default function Decoupage() {
  return (
    <>
      <Lineaire />
      <Section eyebrow="Électronique de commutation" title="Un transistor qui ne dissipe presque rien">
        <Formules
          items={[
            ['En linéaire', 'P = (Ve − Vs)·Is', 'L’écart entre entrée et sortie est supporté par le transistor : faible rendement, gros radiateur, transformateur 50 Hz lourd.'],
            ['En commutation', 'P = v·i ≈ 0', 'Fermé : v ≈ 0. Ouvert : i = 0. Le transistor transfère des « paquets d’énergie » ; seules les commutations coûtent.'],
            ['Haute fréquence', 'L, C, transfo ∝ 1/f', 'Découper vite réduit la taille des éléments réactifs. En contrepartie : complexité et perturbations CEM.'],
          ]}
        />
        <Quiz
          question="Une alimentation à découpage est un…"
          choix={['Convertisseur continu-continu', 'Convertisseur continu-alternatif', 'Convertisseur alternatif-continu']}
          bonne={0}
          pourquoi="Elle part du secteur redressé et filtré (continu) et délivre une tension continue : sa structure est celle d’un hacheur."
        />
      </Section>
      <FlybackSection />
      <Section eyebrow="Étude énergétique" title="Une énergie par période">
        <Formules
          items={[
            ['Stockée au primaire', 'Ep = ½·L1·Î² = ½·E²·(αT)²/L1', 'Î = E·αT/L1 en démagnétisation totale (départ à courant nul).'],
            ['Consommée au secondaire', 'Es = Vs·Is·T', 'Toute l’énergie stockée est rendue à la charge à chaque période.'],
            ['Conséquence', 'Vs·Is = ½·E²·α²·T/L1', 'Agir sur α permet de tenir Vs constante malgré les variations de Is et de E : c’est le rôle de la boucle par optocoupleur.'],
          ]}
        />
        <Quiz
          question="Pour diminuer les pertes par commutation, il vaut mieux…"
          choix={['Travailler en démagnétisation partielle', 'Travailler en démagnétisation totale', 'Augmenter la fréquence de fonctionnement']}
          bonne={1}
          pourquoi="En démagnétisation totale, i1 repart de zéro à chaque fermeture de K : le transistor commute à courant nul. Augmenter f, au contraire, multiplie les commutations."
        />
        <Quiz
          question="L’alimentation flyback est basée sur…"
          choix={['Le hacheur série', 'Le hacheur à accumulation (stockage inductif)', 'Le hacheur parallèle']}
          bonne={1}
          pourquoi="On remplace l’inductance du hacheur à stockage inductif par deux enroulements couplés : la même énergie magnétique, mais avec isolation galvanique et rapport m."
        />
      </Section>
    </>
  )
}

function Lineaire() {
  const [ve, setVe] = useState(15)
  const [is, setIs] = useState(2)
  const vs = 5
  const pu = vs * is
  const etaL = vs / ve
  const etaD = 0.85
  const barres: [string, number, string][] = [
    ['Linéaire', etaL, 'bg-muted'],
    ['Découpage', etaD, 'bg-accent'],
  ]
  return (
    <Section
      eyebrow="Principe"
      title="Linéaire contre découpage"
      intro="Une alimentation délivre une tension continue à partir du secteur redressé. Comparez les deux solutions pour une sortie 5 V : à 500 W, la linéaire pèse 2,5 kg pour 50 % de rendement, la découpage 230 g pour 85 %."
    >
      <Panel>
        <div className="space-y-3">
          {barres.map(([n, eta, cls]) => (
            <div key={n}>
              <div className="flex justify-between text-sm">
                <span className="font-semibold">{n}</span>
                <span className="font-mono">
                  η = {fr(eta * 100, 0)} % · pertes {fr(pu / eta - pu, 1)} W
                </span>
              </div>
              <div className="mt-1 flex h-7 overflow-hidden rounded-md ring-1 ring-line">
                <div className={`${cls} grid place-items-center text-xs text-white`} style={{ width: `${eta * 100}%` }}>
                  Pu = {fr(pu, 0)} W
                </div>
                <div className="flex-1 bg-north/25" />
              </div>
            </div>
          ))}
        </div>
        <Ligne>
          <Curseur label="Tension d’entrée Ve" value={ve} min={6} max={30} step={0.5} onChange={setVe} aff={`${fr(ve, 1)} V`} />
          <Curseur label="Courant de sortie Is" value={is} min={0.2} max={4} step={0.1} onChange={setIs} aff={`${fr(is, 1)} A`} />
        </Ligne>
        <Legende>Rouge : la puissance perdue en chaleur. En linéaire, η = Vs/Ve ne dépend que de l’écart de tension ; le découpage garde 85 % quel que soit Ve.</Legende>
      </Panel>
      <div className="overflow-x-auto rounded-card ring-1 ring-line">
        <table className="w-full min-w-[420px] bg-card text-sm">
          <thead className="bg-card-2 text-left text-xs text-muted">
            <tr>
              <th className="px-3 py-2">Caractéristique</th>
              <th className="px-3 py-2">Découpage</th>
              <th className="px-3 py-2">Linéaire</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {[
              ['Rendement', '65 à 90 %', '35 à 55 %'],
              ['Puissance massique', '30 à 300 W/kg', '10 à 30 W/kg'],
              ['Ondulation', '1 %', '0,1 %'],
              ['Perturbations CEM', 'importantes', 'négligeables'],
            ].map((r) => (
              <tr key={r[0]} className="border-t border-line">
                {r.map((x, k) => (
                  <td key={k} className={`px-3 py-2 ${k ? '' : 'font-sans'}`}>
                    {x}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Quiz
        question="Utiliser une alimentation à découpage permet de…"
        choix={['Diminuer le poids de l’alimentation', 'Augmenter la stabilité de la tension de sortie', 'Diminuer le rayonnement électromagnétique']}
        bonne={0}
        pourquoi="Transformateur HF minuscule et radiateur réduit. L’ondulation (1 % contre 0,1 %) et la CEM sont au contraire moins bonnes qu’en linéaire."
      />
    </Section>
  )
}

const PRIM = 'M40,128 V40 H150 V200 H40 Z'
const SEC = 'M205,200 V40 H385 V200 Z'
const CAP = 'M325,40 H385 V200 H325 Z'

function FlybackSection() {
  const [alpha, setAlpha] = useState(0.4)
  const [lr, setLr] = useState(1)
  const [fk, setFk] = useState(50)
  const [regul, setRegul] = useState(false)
  const [play, setPlay] = useState(!REDUCE)
  const r = 10 ** lr
  const base = { e: E, m: M, l1: L1, f: fk * 1e3, r }
  const a = regul ? alphaPour(base, VCONS) : alpha
  const p: Flyback = { ...base, alpha: a }
  const pt = flyback(p)
  const T = 1 / p.f
  const tc = useRef(0)
  const [etat, setEtat] = useState<'k' | 'd' | 'repos'>('k')

  const ondes = useCanvas(
    (ctx, w, h, dt, k) => {
      tc.current = (tc.current + dt / 2.5) % 2 // 1 période en 2,5 s
      const at = (x: number) => flybackAt(p, pt, x * T)
      const imax = Math.max(0.5, pt.i1max, pt.i1max / M) * 1.15
      const box = { x: 46, y: 14, w: w - 58, h: (h - 40) * 0.55 }
      const { X } = repere(
        ctx,
        k,
        box,
        { x0: 0, x1: 2, y0: 0, y1: imax },
        [
          { f: (x) => at(x).i1, col: k.copper, lw: 2.5, n: 800 },
          { f: (x) => at(x).i2, col: k.south, lw: 2.5, n: 800 },
        ],
        { label: 'i1 (cuivre), i2 (bleu) — A', yTicks: [0, imax / 1.15], yFmt: (v) => fr(v, 1) },
      )
      const vmax = E + pt.vs / M
      repere(ctx, k, { x: box.x, y: box.y + box.h + 16, w: box.w, h: (h - 40) * 0.45 - 16 }, { x0: 0, x1: 2, y0: -2, y1: vmax * 1.1 }, [{ f: (x) => at(x).vk, col: k.ink, lw: 2, n: 800 }], {
        label: 'vK aux bornes du transistor — V',
        yTicks: [0, E, vmax],
      })
      // phases
      ctx.font = mono(10)
      ctx.fillStyle = k.muted
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      for (const x0 of [0, 1]) ctx.fillText('K fermé', X(x0 + a / 2), h - 2)
      const x = X(tc.current)
      ctx.strokeStyle = k.accent
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x, box.y)
      ctx.lineTo(x, h - 16)
      ctx.stroke()
      const s = at(tc.current)
      const e2 = s.k ? 'k' : s.i2 > 1e-6 ? 'd' : 'repos'
      if (e2 !== etat) setEtat(e2)
    },
    play,
  )

  const actifs = etat === 'k' ? [PRIM, CAP] : etat === 'd' ? [SEC] : [CAP]
  const txt = {
    k: 'K fermé : v1 = E, i1 croît en rampe (pente E/L1). v2 = −m·E < 0 bloque D : le condensateur seul alimente la charge. L’énergie magnétique augmente au primaire.',
    d: 'K ouvert : le flux ne peut pas s’arrêter, la conduction passe au secondaire. D conduit, v2 = Vs, i2 décroît (pente Vs/L2) : l’énergie magnétique passe à la charge et au condensateur.',
    repos: 'Démagnétisation totale : i2 s’est annulé avant la fin de la période. Plus d’énergie dans le transformateur, v1 = v2 = 0 : le condensateur alimente la charge.',
  }[etat]

  return (
    <Section
      eyebrow="Alimentation flyback"
      title="Stocker au primaire, rendre au secondaire"
      intro="Tirée du hacheur à stockage inductif : la self s’est divisée en deux enroulements bobinés en sens inverse sur le même noyau. Isolation galvanique, adaptation de tension par m, < 100 W. Simple et bon marché, c’est l’alimentation à découpage la plus répandue."
    >
      <Panel>
        <Deux>
          <div className="space-y-2">
            <svg viewBox="0 0 420 230" role="img" aria-label="Schéma du flyback, maille active surlignée" className="w-full">
              <g fill="none" stroke="var(--color-muted)" strokeWidth="1.6">
                <path d={PRIM} />
                <path d={SEC} />
                <path d="M325,40 V200" />
              </g>
              {actifs.map((d) => (
                <g key={d}>
                  <path d={d} fill="none" stroke="var(--color-copper)" strokeWidth="9" opacity=".18" strokeLinejoin="round" />
                  <path d={d} fill="none" stroke="var(--color-copper)" strokeWidth="4" strokeDasharray="0.1 14" strokeLinecap="round" className={REDUCE ? '' : 'flux-anim'} />
                </g>
              ))}
              <circle cx="40" cy="110" r="18" fill="var(--color-card)" stroke="var(--color-ink)" strokeWidth="1.6" />
              <text x="40" y="114" textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--color-ink)">
                E
              </text>
              {/* enroulements et noyau */}
              {[150, 205].map((x) => (
                <g key={x}>
                  <rect x={x - 9} y="70" width="18" height="80" rx="4" fill="var(--color-card)" stroke="var(--color-copper)" strokeWidth="2.4" />
                  <circle cx={x === 150 ? x - 14 : x + 14} cy={x === 150 ? 66 : 154} r="3" fill="var(--color-ink)" />
                </g>
              ))}
              <path d="M174,62 V158 M181,62 V158" stroke="var(--color-ink)" strokeWidth="2" />
              <text x="150" y="168" textAnchor="middle" fontSize="11" fill="var(--color-muted)">
                L1
              </text>
              <text x="205" y="168" textAnchor="middle" fontSize="11" fill="var(--color-muted)">
                L2
              </text>
              {/* interrupteur K */}
              <rect x="80" y="190" width="30" height="20" rx="3" fill={etat === 'k' ? 'var(--color-copper)' : 'var(--color-card)'} stroke="var(--color-ink)" />
              <text x="95" y="204" textAnchor="middle" fontSize="11" fontWeight="600" fill={etat === 'k' ? '#fff' : 'var(--color-ink)'}>
                K
              </text>
              {/* diode D */}
              <path d="M258,31 L258,49 L274,40 Z" fill={etat === 'd' ? 'var(--color-copper)' : 'var(--color-card)'} stroke="var(--color-ink)" strokeWidth="1.5" />
              <path d="M275,30 V50" stroke="var(--color-ink)" strokeWidth="2" />
              <text x="266" y="24" textAnchor="middle" fontSize="11" fill="var(--color-ink)">
                D
              </text>
              {/* C et R */}
              <rect x="312" y="112" width="26" height="8" fill="var(--color-card)" stroke="var(--color-ink)" />
              <path d="M312,124 H338" stroke="var(--color-ink)" strokeWidth="3" />
              <text x="300" y="122" textAnchor="end" fontSize="11" fill="var(--color-ink)">
                C
              </text>
              <rect x="377" y="95" width="16" height="40" fill="var(--color-card)" stroke="var(--color-ink)" />
              <text x="400" y="118" fontSize="11" fill="var(--color-ink)">
                R
              </text>
              <text x="355" y="222" textAnchor="middle" fontSize="11" fill="var(--color-ink)" fontWeight="600">
                Vs = {fr(pt.vs, 1)} V
              </text>
            </svg>
            <p className="text-sm">{txt}</p>
          </div>
          <div className="space-y-2">
            <Toile cref={ondes} ratio="4/3" label="Formes d'onde i1, i2 et vK sur deux périodes" />
            <Legende>Le curseur vert parcourt deux périodes de découpage (ralenti environ 100 000 fois). Le schéma surligne la maille parcourue par le courant à cet instant.</Legende>
          </div>
        </Deux>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${pt.continu ? 'text-copper ring-copper' : 'text-south ring-south'}`}>
            {pt.continu ? 'Démagnétisation partielle (conduction continue)' : 'Démagnétisation totale (conduction discontinue)'}
          </span>
        </div>
        <Mesures
          items={[
            ['α', fr(a, 2), regul ? 'imposé par la régulation' : 'rapport cyclique'],
            ['Vs', fr(pt.vs, 2), 'V'],
            ['Is', fr(pt.is * 1000, 0), 'mA'],
            ['Î1', fr(pt.i1max, 2), 'A'],
            ['Démagnétisation', fr((pt.t2 / T) * 100, 0), '% de T'],
            ['vK max', fr(E + pt.vs / M, 1), 'V = E + Vs/m'],
          ]}
        />
        <Ligne>
          <Curseur label="Rapport cyclique α" value={regul ? a : alpha} min={0.1} max={0.8} step={0.01} onChange={(v) => setAlpha(v)} aff={fr(regul ? a : alpha, 2)} />
          <Curseur label="Charge R" value={lr} min={0.6} max={2.8} step={0.02} onChange={setLr} aff={`${fr(r, 0)} Ω`} />
          <Curseur label="Fréquence" value={fk} min={20} max={200} step={5} onChange={setFk} aff={`${fk} kHz`} />
        </Ligne>
        <Ligne>
          <Bouton on={regul} onClick={() => setRegul(!regul)}>
            Régulation Vs = {VCONS} V
          </Bouton>
          <Lecture play={play} setPlay={setPlay} />
        </Ligne>
        <Legende>
          E = {E} V, m = n2/n1 = {fr(M, 1)}, L1 = {L1 * 1e6} µH. Augmentez R (charge plus légère) : l’énergie demandée baisse, i2 s’annule avant la fin de la période. Activez la régulation : α se règle seul pour
          tenir Vs, quels que soient R et f.
        </Legende>
      </Panel>
      <Formules
        items={[
          ['Démagnétisation partielle', 'Vs = m·α·E / (1 − α)', 'De l’énergie reste toujours dans le transformateur. Vs ne dépend pas de la charge.'],
          ['Pendant αT', 'v1 = E = L1·di1/dt', 'i1(t) = E·t/L1 + i1(0). v2 = −m·E < 0 : D bloquée, i2 = 0.'],
          ['Pendant (1 − α)T', 'v2 = Vs, v1 = −Vs/m', 'i2 décroît ; vK = E + Vs/m : le transistor doit tenir plus que E.'],
        ]}
      />
      <Cle>
        Démagnétisation partielle ou totale, c’est la charge qui décide. À vide, toute l’énergie ½·L1·Î² stockée doit partir dans une charge qui n’en veut presque pas : sans régulation, Vs s’envole.
      </Cle>
    </Section>
  )
}
