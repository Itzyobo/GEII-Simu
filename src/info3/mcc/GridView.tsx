/** Pin Manager : Grid View — cadenas par fonction et par broche, numéros du boîtier sélectionné (UQFN40). */
import { INFO3 } from '../../data/reference'
import { packageOf, pinNumber, type MccConfig, type PackageName } from './config'
import { cellState, clickCell, functionCount, gridRows, type CellState, type GridRow } from './grid'

const PORTS = Object.entries(INFO3.mcc.gridPorts) as [string, number][]
const PACKAGES = Object.keys(INFO3.mcc.packages) as PackageName[]

const CELL: Record<Exclude<CellState, 'none'>, string> = {
  available: 'text-[#1565c0] hover:bg-[#e3f2fd]',
  locked: 'bg-[#2e7d32] text-white',
  fixed: 'cursor-default bg-[#2e7d32] text-white',
  taken: 'bg-[#ffb74d] text-[#5d3a00]',
}
const LABEL: Record<Exclude<CellState, 'none'>, string> = { available: 'disponible', locked: 'verrouillée', fixed: 'verrouillée (fixe)', taken: 'prise par une autre fonction' }

export default function GridView({ config, onChange, extraRows = [] }: { config: MccConfig; onChange(cfg: MccConfig): void; extraRows?: GridRow[] }) {
  const rows = gridRows(extraRows)
  const pkg = packageOf(config)
  return (
    <div className="rounded-lg border border-[#c8c8c8] bg-white text-[#1e1e1e]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#c8c8c8] bg-[#e8e8e8] px-2 py-1 text-xs font-semibold">
        <span>Pin Manager: Grid View</span>
        <label className="flex items-center gap-1 font-normal">
          Package:
          <select value={pkg} onChange={(e) => onChange({ ...config, package: e.target.value as PackageName })} className="rounded border border-[#b8b8b8] bg-white px-1 py-0.5 text-xs">
            {PACKAGES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <span className="flex gap-2 font-normal" aria-hidden>
          <span className="rounded bg-[#e3f2fd] px-1 text-[#1565c0]">disponible</span>
          <span className="rounded bg-[#2e7d32] px-1 text-white">verrouillée</span>
          <span className="rounded bg-[#ffb74d] px-1 text-[#5d3a00]">prise</span>
        </span>
      </div>
      <div className="max-w-full overflow-x-auto">
        <table className="border-collapse text-[10px]">
          <thead>
            <tr>
              <th className="sticky left-0 bg-white px-2 text-left font-semibold" rowSpan={2}>
                Module
              </th>
              <th className="bg-white px-2 text-left font-semibold" rowSpan={2}>
                Function
              </th>
              <th className="bg-white px-2 text-left font-semibold" rowSpan={2}>
                Direction
              </th>
              {PORTS.map(([port, n]) => (
                <th key={port} colSpan={n} className="border border-[#ccc] bg-[#e8e8e8] px-1">
                  Port {port}
                </th>
              ))}
            </tr>
            <tr>
              {PORTS.flatMap(([port, n]) =>
                Array.from({ length: n }, (_, b) => {
                  const pin = `R${port}${b}`
                  return (
                    <th key={pin} className="w-6 border border-[#ccc] bg-[#f5f5f5] font-normal" title={`${pin} — broche ${pinNumber(config, pin) ?? '?'} (${pkg})`}>
                      {b}
                      <div className="text-[8px] text-[#888]">{pinNumber(config, pin)}</div>
                    </th>
                  )
                }),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="sticky left-0 bg-white px-2 font-semibold">{row.module}</td>
                <td className="bg-white px-2">{row.func}</td>
                <td className="bg-white px-2">{row.dir}</td>
                {PORTS.flatMap(([port, n]) =>
                  Array.from({ length: n }, (_, b) => {
                    const pin = `R${port}${b}`
                    const st = cellState(config, rows, row, pin)
                    if (st === 'none') return <td key={pin} className="border border-[#eee]" />
                    const double = st === 'locked' && functionCount(config, rows, pin) > 1
                    return (
                      <td key={pin} className="border border-[#ccc] p-0 text-center">
                        <button
                          type="button"
                          disabled={st === 'fixed' || !row.click}
                          aria-pressed={st === 'locked' || st === 'fixed'}
                          aria-label={`${pin} ${row.module} ${row.func} ${row.dir} : ${LABEL[st]}${double ? ', deux fonctions' : ''}`}
                          title={`${pin} (broche ${pinNumber(config, pin)}) — ${LABEL[st]}${double ? ' — deux fonctions sur la broche' : ''}`}
                          onClick={() => onChange(clickCell(config, rows, row, pin))}
                          className={`h-6 w-6 ${CELL[st]} ${!row.click && st === 'available' ? 'cursor-default' : ''}`}
                        >
                          {st === 'available' ? '🔓' : double ? '🔒²' : '🔒'}
                        </button>
                      </td>
                    )
                  }),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
