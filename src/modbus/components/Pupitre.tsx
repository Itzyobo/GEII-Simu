/**
 * Pupitre Modbus « PLATINE 6 » (PRD §5, reconstitué) : châssis bleu, 4 esclaves sur un bus RS485
 * à deux fils (TX+ bleu, TX− vert), panneau d'inverseurs et de potentiomètres devant le châssis.
 * Montre l'état du modèle : LED Q0–Q7 et I0–I11 de l'OTB, afficheurs du TDS, adresses actuelles des modules.
 */
import { REF } from '../data/reference'
import type { Wiring } from '../lib/store'
import { affichageTDS, joignable, ledsOTB, type ModuleId, type PupitreState } from '../models/slaves'

const MODULES: { id: ModuleId; x: number }[] = [
  { id: 'THT', x: 40 },
  { id: 'TDS', x: 150 },
  { id: 'TQS', x: 260 },
  { id: 'OTB', x: 360 },
]

/** Segments allumés (a à g) de chaque glyphe des afficheurs */
const SEGMENTS: Record<string, string> = {
  '0': 'abcdef', '1': 'bc', '2': 'abdeg', '3': 'abcdg', '4': 'bcfg', '5': 'acdfg', '6': 'acdefg', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg',
  A: 'abcefg', b: 'cdefg', C: 'adef', d: 'bcdeg', E: 'adefg', F: 'aefg', G: 'acdef', h: 'cefg', i: 'c', J: 'bcde', K: 'bcefg', L: 'def',
  M: 'aceg', n: 'ceg', o: 'cdeg', P: 'abefg', q: 'abcfg', r: 'eg', S: 'acdfg', t: 'defg', U: 'bcdef', v: 'cde', W: 'bdfg', X: 'bcefg',
  y: 'bcdfg', Z: 'abdeg', ' ': '',
}
/** Tracé de chaque segment dans une case de 14 × 24 */
const SEG_PATH: Record<string, string> = {
  a: 'M2 1h10', b: 'M13 2v9', c: 'M13 13v9', d: 'M2 23h10', e: 'M1 13v9', f: 'M1 2v9', g: 'M2 12h10',
}

interface Props {
  wiring: Wiring
  pupitre: PupitreState
  /** Instant de simulation (durée d'affichage du TDS) */
  t: number
  onInterrupteur: (k: number) => void
}

export default function Pupitre({ wiring, pupitre, t, onInterrupteur }: Props) {
  const leds = ledsOTB(pupitre)
  const tds = affichageTDS(pupitre, t)
  const eclat = tds.luminosite / REF.tdsLuminositeMax.value
  const entrees = pupitre.otb.entrees
  return (
    <svg viewBox="0 0 520 330" className="block w-full" role="group" aria-label="Pupitre Modbus PLATINE 6 : esclaves THT, TDS, TQS et OTB">
      {/* Châssis bleu */}
      <rect x={4} y={4} width={512} height={226} rx={6} fill="#1e4f9c" stroke="#123468" strokeWidth={3} />
      <text x={500} y={24} textAnchor="end" fontSize={13} fontWeight={800} fill="#e0ecff" letterSpacing={2}>
        PLATINE 6
      </text>
      {/* Rail DIN */}
      <rect x={30} y={58} width={470} height={10} fill="#b8bec6" />

      {/* THT : boîtier gris à bornier */}
      <g>
        <rect x={40} y={40} width={86} height={120} rx={4} fill="#9aa0a6" stroke="#5f656b" />
        {Array.from({ length: 6 }, (_, k) => (
          <circle key={k} cx={52 + k * 13} cy={52} r={4} fill="#d8dcdf" stroke="#555" />
        ))}
        <rect x={52} y={80} width={62} height={30} rx={2} fill="#80868c" />
        <text x={83} y={99} textAnchor="middle" fontSize={9} fill="#eee">
          T° / HR
        </text>
      </g>

      {/* TDS : boîtier noir, 4 afficheurs 7 segments rouges, luminosité 0 (éteint) à 4 */}
      <g role="img" aria-label={`Afficheurs du TDS : « ${tds.luminosite ? tds.glyphes : 'éteints'} », luminosité ${tds.luminosite}`}>
        <rect x={150} y={40} width={92} height={120} rx={4} fill="#151515" stroke="#000" />
        <rect x={156} y={70} width={80} height={36} rx={2} fill="#2a0505" />
        {[...tds.glyphes.padEnd(4)].slice(0, 4).map((g, k) => {
          const on = SEGMENTS[g] ?? ''
          return (
            <g key={k} transform={`translate(${161 + k * 18} 76)`} strokeWidth={2.6} strokeLinecap="round">
              {Object.entries(SEG_PATH).map(([seg, d]) => (
                <path key={seg} d={d} stroke={on.includes(seg) && eclat > 0 ? '#ff2b2b' : '#4a0d0d'} strokeOpacity={on.includes(seg) && eclat > 0 ? 0.35 + 0.65 * eclat : 1} />
              ))}
            </g>
          )
        })}
      </g>

      {/* TQS : boîtier blanc à grille d'aération */}
      <g>
        <rect x={260} y={40} width={80} height={120} rx={4} fill="#f5f5f2" stroke="#a3a3a3" />
        {Array.from({ length: 7 }, (_, k) => (
          <rect key={k} x={272} y={58 + k * 10} width={56} height={4} rx={2} fill="#cfcfca" />
        ))}
      </g>

      {/* OTB : base blanche, LED des entrées I0–I11 et des sorties Q0–Q7, RJ45, 2 extensions jaunes */}
      <g>
        <rect x={360} y={40} width={70} height={120} rx={3} fill="#f8f8f6" stroke="#9ca3af" />
        <g role="img" aria-label={`LED des entrées OTB allumées : ${Array.from({ length: 12 }, (_, k) => ((entrees >> k) & 1 ? `I${k}` : '')).filter(Boolean).join(' ') || 'aucune'}`}>
          {Array.from({ length: 12 }, (_, k) => (
            <circle key={k} cx={368 + (k % 6) * 11} cy={50 + Math.floor(k / 6) * 9} r={2.8} fill={(entrees >> k) & 1 ? '#22c55e' : '#3b3b3b'} />
          ))}
        </g>
        <text x={395} y={77} textAnchor="middle" fontSize={7} fill="#555">
          I0…I11
        </text>
        <g role="img" aria-label={`LED des sorties OTB allumées : ${leds.flatMap((on, k) => (on ? [`Q${k}`] : [])).join(' ') || 'aucune'}`}>
          {leds.map((on, k) => (
            <g key={k}>
              <circle cx={370 + (k % 4) * 15} cy={88 + Math.floor(k / 4) * 16} r={4} fill={on ? '#22c55e' : '#3b3b3b'} />
              <text x={370 + (k % 4) * 15} y={99 + Math.floor(k / 4) * 16} textAnchor="middle" fontSize={5.5} fill="#555">
                Q{k}
              </text>
            </g>
          ))}
        </g>
        <rect x={372} y={130} width={18} height={16} fill="#555" />
        <rect x={434} y={40} width={30} height={120} rx={3} fill="#f2c200" stroke="#a88600" />
        <rect x={468} y={40} width={30} height={120} rx={3} fill="#f2c200" stroke="#a88600" />
      </g>

      {/* Bus RS485 : TX+ bleu, TX− vert, vers chaque module */}
      <path d="M20 204 H470" stroke="#2563eb" strokeWidth={3} />
      <path d="M20 214 H470" stroke="#16a34a" strokeWidth={3} />
      {MODULES.map((m) => (
        <g key={m.id}>
          <path d={`M${m.x + 20} 204 V160`} stroke="#2563eb" strokeWidth={2} />
          <path d={`M${m.x + 30} 214 V160`} stroke="#16a34a" strokeWidth={2} />
        </g>
      ))}
      <text x={474} y={208} fontSize={9} fill="#cfe0ff">
        TX+
      </text>
      <text x={474} y={218} fontSize={9} fill="#c7f5d3">
        TX−
      </text>

      {/* Étiquettes : adresse actuelle, en rouge si elle a changé ou si le module ne comprend plus le bus */}
      {MODULES.map((m) => {
        const adr = pupitre.adresses[m.id]
        const change = adr !== REF.esclaves.value[m.id]
        const muet = !joignable(pupitre, m.id)
        return (
          <g key={m.id}>
            <rect x={m.x} y={168} width={66} height={18} rx={2} fill={change || muet ? '#fee2e2' : '#fff'} stroke={change || muet ? '#dc2626' : 'none'} />
            <text x={m.x + 33} y={181} textAnchor="middle" fontSize={11} fontWeight={700} fill={change || muet ? '#b91c1c' : '#111'}>
              {m.id} {adr}
              {muet ? ' ✕' : ''}
            </text>
          </g>
        )
      })}

      {/* Arrivée des câbles DB9/bleu-vert des cartes */}
      {(['c1', 'c2'] as const).map((c, k) => (
        <g key={c}>
          <rect x={8 + k * 2} y={188} width={10} height={36} rx={2} fill={wiring.db9[c] ? '#93c5fd' : 'transparent'} stroke={wiring.db9[c] ? '#2563eb' : 'none'} />
        </g>
      ))}
      <text x={14} y={240} fontSize={8} fill="#cfd8e3">
        bus : carte 1 {wiring.db9.c1 ? '●' : '○'} · carte 2 {wiring.db9.c2 ? '●' : '○'}
      </text>

      {/* Panneau séparé : 12 inverseurs noirs (cliquables) + 2 potentiomètres bleus */}
      <rect x={40} y={252} width={440} height={70} rx={6} fill="#e8e8e4" stroke="#a8a8a0" />
      {Array.from({ length: 12 }, (_, k) => {
        const haut = ((entrees >> k) & 1) === 1
        return (
          <g
            key={k}
            role="switch"
            tabIndex={0}
            aria-checked={haut}
            aria-label={`Inverseur I${k}`}
            onClick={() => onInterrupteur(k)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onInterrupteur(k))}
            className="cursor-pointer"
          >
            <rect x={52 + k * 28} y={260} width={20} height={40} fill="transparent" />
            <rect x={56 + k * 28} y={266} width={12} height={26} rx={2} fill="#222" />
            <rect x={58 + k * 28} y={haut ? 268 : 280} width={8} height={10} rx={1} fill={haut ? '#e5e5e5' : '#555'} />
            <text x={62 + k * 28} y={306} textAnchor="middle" fontSize={8} fill="#333">
              I{k}
            </text>
          </g>
        )
      })}
      {pupitre.otb.pots.map((p, k) => {
        const x = 410 + k * 38
        const a = (-135 + 270 * p) * (Math.PI / 180)
        return (
          <g key={k} aria-hidden>
            <circle cx={x} cy={282} r={13} fill="#2563eb" stroke="#1e3a8a" strokeWidth={2} />
            <path d={`M${x} 282 L${x + 11 * Math.sin(a)} ${282 - 11 * Math.cos(a)}`} stroke="#fff" strokeWidth={2} />
            <text x={x} y={306} textAnchor="middle" fontSize={7} fill="#333">
              IN{k}
            </text>
          </g>
        )
      })}
      <text x={476} y={318} textAnchor="end" fontSize={7} fill="#888">
        reconstitué d’après le PRD
      </text>
    </svg>
  )
}
