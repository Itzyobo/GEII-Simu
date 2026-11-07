/** Inspecteur d'interruptions : GIE, PEIE, puis par source IE, IF, ordre dans l'Interrupt Module et nombre d'appels. */
import { interruptTable } from '../mcc/interrupts'
import type { MccConfig } from '../mcc/config'
import type { IrqView } from './useSim'

const Bit = ({ v }: { v: number }) => <span className={`inline-block w-4 text-center font-mono font-semibold ${v ? 'text-ok' : 'text-muted'}`}>{v}</span>

export default function InterruptInspector({ irq, mcc }: { irq: IrqView | null; mcc: MccConfig }) {
  const order = new Map(interruptTable(mcc).map((r) => [r.id, r.order]))
  const sources = irq?.sources ?? []
  return (
    <details className="rounded-card bg-card p-3 ring-1 ring-line" open>
      <summary className="cursor-pointer text-sm font-semibold">Inspecteur d’interruptions</summary>
      {!irq ? (
        <p className="mt-2 text-xs text-muted">Disponible quand un programme tourne sur la carte.</p>
      ) : (
        <div className="mt-2 space-y-2 text-xs">
          <p className="flex gap-4">
            <span>
              GIE <Bit v={irq.gie} />
            </span>
            <span>
              PEIE <Bit v={irq.peie} />
            </span>
          </p>
          <table className="w-full text-left">
            <thead className="text-muted">
              <tr>
                <th className="font-normal">Source</th>
                <th className="font-normal">IE</th>
                <th className="font-normal">IF</th>
                <th className="font-normal">Ordre</th>
                <th className="text-right font-normal">Appels</th>
              </tr>
            </thead>
            <tbody>
              {sources.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-muted">
                    Aucune source activée.
                  </td>
                </tr>
              )}
              {sources.map((s) => (
                <tr key={s.name}>
                  <td className="font-mono">{s.name}</td>
                  <td>
                    <Bit v={s.ie} />
                  </td>
                  <td>
                    <Bit v={s.flag} />
                  </td>
                  <td className="tabular-nums">{order.get(s.name) ?? '—'}</td>
                  <td className="text-right tabular-nums">{s.calls}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  )
}
