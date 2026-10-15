/**
 * Carte d'interface série, dessinée d'après le schéma TP-10 (reconstituée, pas de photo de face) :
 * DB9 PC → MAX232 → DS3695 → bornier + DB9 RS485, DB9 vers l'autre carte, commutateur « contrôle de flux ».
 * Les points de test, la douille de masse, le commutateur et les DB9 sont cliquables.
 */
import type { CardId, ChId, TestPoint, Wiring } from '../lib/store'

const PROBE_COLOR: Record<ChId, string> = { ch1: '#eab308', ch2: '#22c55e' }

/** Position des points de test sur la carte */
const POINTS: { id: TestPoint; label: string; x: number; y: number }[] = [
  { id: 'TXD_RS232', label: 'TXD RS232', x: 74, y: 70 },
  { id: 'TXD_TTL', label: 'TXD TTL', x: 178, y: 70 },
  { id: 'TX_EN', label: 'TX_EN', x: 262, y: 54 },
  { id: 'TX+', label: 'TX+', x: 318, y: 110 },
  { id: 'TX-', label: 'TX−', x: 318, y: 146 },
]

interface Props {
  card: CardId
  wiring: Wiring
  onPoint: (p: TestPoint) => void
  onGround: () => void
  onFlow: () => void
  onSerial: () => void
  onDb9: () => void
}

export default function InterfaceCard({ card, wiring, onPoint, onGround, onFlow, onSerial, onDb9 }: Props) {
  const probesAt = (p: TestPoint) => (['ch1', 'ch2'] as const).filter((c) => wiring.probes[c].tip === `${card}.${p}`)
  const groundsHere = (['ch1', 'ch2'] as const).filter((c) => wiring.probes[c].ground === card)
  const flow = wiring.flow[card]
  const n = card === 'c1' ? 1 : 2

  return (
    <svg viewBox="0 0 400 250" className="block w-full" role="group" aria-label={`Carte d'interface ${n}`}>
      {/* Circuit imprimé blanc */}
      <rect x={4} y={4} width={392} height={242} rx={8} fill="#f4f4f0" stroke="#b9b9b0" strokeWidth={2} />
      {[14, 386].map((x) => [14, 236].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r={4} fill="#d6d6cc" stroke="#999" />))}
      <text x={200} y={22} textAnchor="middle" fontSize={11} fontWeight={700} fill="#555">
        CARTE INTERFACE SÉRIE {n}
      </text>

      {/* Pistes */}
      <g stroke="#c9a227" strokeWidth={2.5} fill="none" opacity={0.7}>
        <path d="M40 92 H110" />
        <path d="M150 92 H230" />
        <path d="M270 92 H300 V110 H330" />
        <path d="M270 100 H290 V146 H330" />
        <path d="M250 80 V54" />
        <path d="M350 128 H372" />
        <path d="M200 200 V180 H140 V110" />
      </g>

      {/* DB9 côté PC */}
      <Db9 x={10} y={70} vertical label="PC" />

      {/* MAX232 (DIP 16) */}
      <Dip x={110} y={74} pins={8} label="MAX232" />
      {/* DS3695 (DIP 8) */}
      <Dip x={230} y={78} pins={4} label="DS3695" />

      {/* Bornier RS485 + DB9 RS485 vers le pupitre */}
      <g>
        <rect x={330} y={98} width={22} height={60} fill="#2f7d4f" rx={2} />
        {[110, 128, 146].map((y) => (
          <circle key={y} cx={341} cy={y} r={5} fill="#cfd4d8" stroke="#555" />
        ))}
      </g>
      <g role="button" tabIndex={0} aria-label={`DB9 RS485 vers le pupitre : ${wiring.db9[card] ? 'branché' : 'débranché'}`} onClick={onDb9} onKeyDown={(e) => e.key === 'Enter' && onDb9()} className="cursor-pointer">
        <Db9 x={360} y={100} vertical label="RS485" active={wiring.db9[card]} />
        {wiring.db9[card] && <path d="M396 128 h10" stroke="#2563eb" strokeWidth={6} />}
      </g>

      {/* DB9 vers l'autre carte */}
      <g role="button" tabIndex={0} aria-label={`DB9 vers l'autre carte : ${wiring.serialCable ? 'câble branché' : 'débranché'}`} onClick={onSerial} onKeyDown={(e) => e.key === 'Enter' && onSerial()} className="cursor-pointer">
        <Db9 x={170} y={200} label="vers autre carte" active={wiring.serialCable} />
      </g>

      {/* Commutateur « contrôle de flux » (H18) */}
      <g role="switch" tabIndex={0} aria-checked={flow} aria-label="Commutateur contrôle de flux" onClick={onFlow} onKeyDown={(e) => e.key === 'Enter' && onFlow()} className="cursor-pointer">
        <rect x={40} y={168} width={70} height={56} fill="transparent" />
        <rect x={56} y={178} width={36} height={18} rx={3} fill="#222" />
        <rect x={flow ? 74 : 58} y={180} width={16} height={14} rx={2} fill="#ddd" />
        <text x={74} y={210} textAnchor="middle" fontSize={8.5} fill="#333">
          contrôle de flux
        </text>
        <text x={74} y={220} textAnchor="middle" fontSize={8} fill={flow ? '#15803d' : '#b91c1c'} fontWeight={700}>
          {flow ? 'ACTIF' : 'HORS'}
        </text>
      </g>

      {/* Douilles rouge (+5 V) et noire (masse) */}
      <circle cx={300} cy={214} r={9} fill="#c62828" stroke="#7f1d1d" strokeWidth={2} />
      <text x={300} y={238} textAnchor="middle" fontSize={8} fill="#333">
        +5 V
      </text>
      <g role="button" tabIndex={0} aria-label={`Douille de masse de la carte ${n}`} onClick={onGround} onKeyDown={(e) => e.key === 'Enter' && onGround()} className="cursor-pointer">
        <circle cx={340} cy={214} r={14} fill="transparent" />
        <circle cx={340} cy={214} r={9} fill="#111" stroke="#444" strokeWidth={2} />
        <text x={340} y={238} textAnchor="middle" fontSize={8} fill="#333">
          GND
        </text>
        {groundsHere.map((c, k) => (
          <path key={c} d={`M${336 + k * 8} 205 l-6 -16 h8 z`} fill={PROBE_COLOR[c]} stroke="#111" strokeWidth={0.8} />
        ))}
      </g>

      {/* Points de test */}
      {POINTS.map((p) => {
        const here = probesAt(p.id)
        return (
          <g key={p.id} role="button" tabIndex={0} aria-label={`Point de test ${p.label}`} onClick={() => onPoint(p.id)} onKeyDown={(e) => e.key === 'Enter' && onPoint(p.id)} className="cursor-pointer">
            <circle cx={p.x} cy={p.y} r={14} fill="transparent" />
            <circle cx={p.x} cy={p.y} r={5} fill="#e5e5e5" stroke="#555" strokeWidth={1.5} />
            <circle cx={p.x} cy={p.y} r={2} fill="#555" />
            <text x={p.x} y={p.y - 9} textAnchor="middle" fontSize={8.5} fontWeight={700} fill="#1f2937">
              {p.label}
            </text>
            {here.map((c, k) => (
              <g key={c} transform={`translate(${p.x + 4 + k * 10} ${p.y + 2})`}>
                <path d="M0 0 l4 14 h-8 z" fill={PROBE_COLOR[c]} stroke="#111" strokeWidth={0.8} />
                <text x={0} y={24} textAnchor="middle" fontSize={7.5} fontWeight={700} fill="#111">
                  {c === 'ch1' ? '1' : '2'}
                </text>
              </g>
            ))}
          </g>
        )
      })}
      <text x={392} y={244} textAnchor="end" fontSize={7} fill="#888">
        reconstituée d’après le schéma TP-10
      </text>
    </svg>
  )
}

function Dip({ x, y, pins, label }: { x: number; y: number; pins: number; label: string }) {
  const w = pins * 10 + 6
  return (
    <g>
      {Array.from({ length: pins }, (_, k) => (
        <g key={k}>
          <rect x={x + 6 + k * 10} y={y - 6} width={4} height={6} fill="#bbb" />
          <rect x={x + 6 + k * 10} y={y + 36} width={4} height={6} fill="#bbb" />
        </g>
      ))}
      <rect x={x} y={y} width={w} height={36} rx={2} fill="#1d1d1f" />
      <circle cx={x + 6} cy={y + 6} r={2} fill="#444" />
      <text x={x + w / 2} y={y + 22} textAnchor="middle" fontSize={8} fill="#ddd">
        {label}
      </text>
    </g>
  )
}

function Db9({ x, y, vertical, label, active }: { x: number; y: number; vertical?: boolean; label: string; active?: boolean }) {
  const [w, h] = vertical ? [26, 56] : [60, 26]
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={4} fill={active ? '#93c5fd' : '#c7cbd1'} stroke={active ? '#2563eb' : '#6b7280'} strokeWidth={active ? 2.5 : 1.5} />
      <rect x={x + 5} y={y + 5} width={w - 10} height={h - 10} rx={5} fill="#3f444a" />
      {Array.from({ length: 5 }, (_, k) => (
        <circle key={k} cx={vertical ? x + w / 2 : x + 12 + k * 9} cy={vertical ? y + 10 + k * 9 : y + h / 2} r={1.6} fill="#d4d4d4" />
      ))}
      <text x={vertical ? x + w / 2 : x + w / 2} y={vertical ? y + h + 10 : y - 4} textAnchor="middle" fontSize={8} fill="#333">
        DB9 {label}
      </text>
    </g>
  )
}
