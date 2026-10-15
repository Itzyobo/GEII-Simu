/**
 * Pupitre Modbus « PLATINE 6 » (PRD §5, reconstitué) : châssis bleu, 4 esclaves sur un bus RS485
 * à deux fils (TX+ bleu, TX− vert), panneau d'interrupteurs et de potentiomètres devant le châssis.
 * Étape 1 : vue statique ; les câbles DB9 des cartes arrivent à gauche.
 */
import { REF } from '../data/reference'
import type { Wiring } from '../lib/store'

const ADR = REF.esclaves.value
const MODULES = [
  { id: 'THT', x: 40 },
  { id: 'TDS', x: 150 },
  { id: 'TQS', x: 260 },
  { id: 'OTB', x: 360 },
] as const

export default function Pupitre({ wiring }: { wiring: Wiring }) {
  return (
    <svg viewBox="0 0 520 330" className="block w-full" role="img" aria-label="Pupitre Modbus PLATINE 6 : esclaves THT, TDS, TQS et OTB">
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

      {/* TDS : boîtier noir, 4 afficheurs 7 segments rouges (éteints) */}
      <g>
        <rect x={150} y={40} width={92} height={120} rx={4} fill="#151515" stroke="#000" />
        <rect x={158} y={70} width={76} height={34} rx={2} fill="#2a0505" />
        {Array.from({ length: 4 }, (_, k) => (
          <text key={k} x={168 + k * 18} y={97} textAnchor="middle" fontSize={26} fontFamily="monospace" fill="#5a1010">
            8
          </text>
        ))}
      </g>

      {/* TQS : boîtier blanc à grille d'aération */}
      <g>
        <rect x={260} y={40} width={80} height={120} rx={4} fill="#f5f5f2" stroke="#a3a3a3" />
        {Array.from({ length: 7 }, (_, k) => (
          <rect key={k} x={272} y={58 + k * 10} width={56} height={4} rx={2} fill="#cfcfca" />
        ))}
      </g>

      {/* OTB : base blanche, 2 extensions jaunes, RJ45 et LED */}
      <g>
        <rect x={360} y={40} width={70} height={120} rx={3} fill="#f8f8f6" stroke="#9ca3af" />
        <rect x={372} y={128} width={18} height={16} fill="#555" />
        {Array.from({ length: 8 }, (_, k) => (
          <circle key={k} cx={372 + (k % 4) * 13} cy={58 + Math.floor(k / 4) * 12} r={3} fill="#3b3b3b" />
        ))}
        <text x={398} y={100} textAnchor="middle" fontSize={8} fill="#555">
          Q0…Q7
        </text>
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

      {/* Étiquettes */}
      {MODULES.map((m) => (
        <g key={m.id}>
          <rect x={m.x} y={168} width={62} height={18} rx={2} fill="#fff" />
          <text x={m.x + 31} y={181} textAnchor="middle" fontSize={11} fontWeight={700} fill="#111">
            {m.id} {ADR[m.id]}
          </text>
        </g>
      ))}

      {/* Arrivée des câbles DB9/bleu-vert des cartes */}
      {(['c1', 'c2'] as const).map((c, k) => (
        <g key={c}>
          <rect x={8 + k * 2} y={188} width={10} height={36} rx={2} fill={wiring.db9[c] ? '#93c5fd' : 'transparent'} stroke={wiring.db9[c] ? '#2563eb' : 'none'} />
        </g>
      ))}
      <text x={14} y={240} fontSize={8} fill="#cfd8e3">
        bus : carte 1 {wiring.db9.c1 ? '●' : '○'} · carte 2 {wiring.db9.c2 ? '●' : '○'}
      </text>

      {/* Panneau séparé : 12 inverseurs noirs + 2 potentiomètres bleus */}
      <rect x={40} y={252} width={440} height={70} rx={6} fill="#e8e8e4" stroke="#a8a8a0" />
      {Array.from({ length: 12 }, (_, k) => (
        <g key={k}>
          <rect x={56 + k * 28} y={266} width={12} height={26} rx={2} fill="#222" />
          <rect x={58 + k * 28} y={268} width={8} height={10} rx={1} fill="#555" />
          <text x={62 + k * 28} y={306} textAnchor="middle" fontSize={8} fill="#333">
            I{k}
          </text>
        </g>
      ))}
      {[410, 448].map((x) => (
        <g key={x}>
          <circle cx={x} cy={282} r={13} fill="#2563eb" stroke="#1e3a8a" strokeWidth={2} />
          <path d={`M${x} 282 L${x} 271`} stroke="#fff" strokeWidth={2} />
        </g>
      ))}
      <text x={476} y={318} textAnchor="end" fontSize={7} fill="#888">
        reconstitué d’après le PRD
      </text>
    </svg>
  )
}
