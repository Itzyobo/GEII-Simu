/** Segments allumés par caractère (ordre a b c d e f g). */
const GLYPHS: Record<string, string> = {
  '0': 'abcdef', '1': 'bc', '2': 'abdeg', '3': 'abcdg', '4': 'bcfg',
  '5': 'acdfg', '6': 'acdefg', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg',
  '-': 'g', ' ': '', E: 'adefg', r: 'eg', L: 'def', O: 'abcdef', o: 'cdeg',
  P: 'abefg', A: 'abcefg', U: 'bcdef', H: 'bcefg', F: 'aefg', n: 'ceg',
}

/** Cellule 24×40 : segment horizontal/vertical en losange allongé, épaisseur 4. */
const hSeg = (cx: number, cy: number) => `${cx - 7},${cy} ${cx - 5},${cy - 2} ${cx + 5},${cy - 2} ${cx + 7},${cy} ${cx + 5},${cy + 2} ${cx - 5},${cy + 2}`
const vSeg = (cx: number, cy: number) => `${cx},${cy - 7} ${cx + 2},${cy - 5} ${cx + 2},${cy + 5} ${cx},${cy + 7} ${cx - 2},${cy + 5} ${cx - 2},${cy - 5}`
const SEGMENTS: [string, string][] = [
  ['a', hSeg(12, 3)], ['b', vSeg(20, 11.5)], ['c', vSeg(20, 28.5)], ['d', hSeg(12, 37)],
  ['e', vSeg(4, 28.5)], ['f', vSeg(4, 11.5)], ['g', hSeg(12, 20)],
]

interface Display7SegProps {
  /** Texte à afficher ; « . » ou « , » allume le point du chiffre précédent */
  value: string
  /** Nombre de chiffres (cadrage à droite) */
  digits?: number
  height?: number
}

/** Afficheur 7 segments vert, segments éteints visibles en fantôme. */
export default function Display7Seg({ value, digits = 4, height = 36 }: Display7SegProps) {
  const cells: { ch: string; dp: boolean }[] = []
  for (const ch of value) {
    if ((ch === '.' || ch === ',') && cells.length) cells[cells.length - 1].dp = true
    else cells.push({ ch, dp: false })
  }
  while (cells.length < digits) cells.unshift({ ch: ' ', dp: false })

  return (
    <svg height={height} viewBox={`0 0 ${cells.length * 28 + 4} 42`} role="img" aria-label={value} className="block">
      {cells.map(({ ch, dp }, i) => {
        const lit = GLYPHS[ch] ?? ''
        return (
          <g key={i} transform={`translate(${i * 28 + 6} 1) skewX(-6)`}>
            {SEGMENTS.map(([name, pts]) => (
              <polygon key={name} points={pts} fill={lit.includes(name) ? 'var(--color-seg)' : 'rgba(61,255,134,0.07)'} />
            ))}
            <circle cx="24" cy="37" r="2" fill={dp ? 'var(--color-seg)' : 'rgba(61,255,134,0.07)'} />
          </g>
        )
      })}
    </svg>
  )
}
