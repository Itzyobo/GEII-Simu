/**
 * MCC Classic (étape 2) : Project Resources (System Module, Pin Module), Device Resources, Generate,
 * Easy Setup du System Module, table Pin Module et Pin Manager: Grid View. Chargé à l'ouverture de MCC.
 * Les données viennent du modèle testé (config.ts) ; Generate est confié au parent (runGenerate).
 */
import { useState } from 'react'
import { INFO3 } from '../../data/reference'
import { addEusart, addMssp, addPwm, addTimer, PWM_IDS, removeEusart, removePwm, type PwmId, customNameError, DIVIDERS, IOC_EDGES, iocAvailable, iocOf, packageOf, pinOrder, removeMssp, removeTimer, setIoc, systemFosc, TIMER_IDS, toggleGridPin, updatePin, type IocEdge, type MccConfig, type Oscillator, type TimerId } from './config'
import GridView from './GridView'
import { interruptTable, moveInterrupt, setInterruptEnabled } from './interrupts'
import TimerPanel from './TimerPanel'
import { timerGridRows } from './timers'
import { spiGridRows } from './spi'
import MsspPanel from './MsspPanel'
import PwmPanel from './PwmPanel'
import { pwmGridRows, pwmNotifications } from './pwm'
import EusartPanel from './EusartPanel'
import { eusartGridRows, eusartNotifications } from './eusart'

export interface MccProps {
  config: MccConfig
  onChange(cfg: MccConfig): void
  onGenerate(): void
  /** Dernier message de Generate (réussite ou refus) */
  message: { ok: boolean; text: string } | null
  dark?: boolean
}

type Resource = 'system' | 'pins' | 'interrupts' | 'MSSP1' | 'EUSART' | TimerId | PwmId

/** Interrupt Module : table « Interrupt Vector » (Order, Module, Interrupt, Enabled) */
function InterruptPanel({ config, onChange, head }: { config: MccConfig; onChange(cfg: MccConfig): void; head: string }) {
  const rows = interruptTable(config)
  const [sel, setSel] = useState<string | null>(null)
  const current = rows.find((r) => r.id === sel) ?? null
  return (
    <>
      <div className={head}>Interrupt Module — Interrupt Vector</div>
      <div className="space-y-2 p-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={!current || current.order === 1} onClick={() => current && onChange(moveInterrupt(config, current.id, -1))} className="rounded border border-[#8a8a8a] bg-[#fafafa] px-2 py-0.5 disabled:opacity-40">
            Order Up
          </button>
          <button type="button" disabled={!current || current.order === rows.length} onClick={() => current && onChange(moveInterrupt(config, current.id, 1))} className="rounded border border-[#8a8a8a] bg-[#fafafa] px-2 py-0.5 disabled:opacity-40">
            Order Down
          </button>
          <label className="ml-auto flex items-center gap-1.5">
            <input type="checkbox" checked={config.singleIsr ?? true} onChange={(e) => onChange({ ...config, singleIsr: e.target.checked })} /> Single ISR per interrupt
          </label>
        </div>
        <div className="max-w-full overflow-x-auto">
          <table className="w-full min-w-[24rem] text-left">
            <thead className="bg-[#f5f5f5]">
              <tr>
                {['Order', 'Module', 'Interrupt', 'Enabled'].map((h) => (
                  <th key={h} className="border-b border-[#ddd] px-2 py-1 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-2 py-2 text-[#777]">
                    Aucune interruption : activer une IOC (Pin Module) ou « Enable Timer Interrupt » (TMRx).
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} onClick={() => setSel(r.id)} aria-selected={sel === r.id} className={`cursor-pointer border-b border-[#eee] ${sel === r.id ? 'bg-[#cfe2fb]' : ''}`}>
                  <td className="px-2 py-1 tabular-nums">{r.order}</td>
                  <td className="px-2 py-1">{r.module}</td>
                  <td className="px-2 py-1">{r.interrupt}</td>
                  <td className="px-2 py-1">
                    <input type="checkbox" aria-label={`Enabled ${r.module} ${r.interrupt}`} checked={r.enabled} onChange={(e) => onChange(setInterruptEnabled(config, r.id, e.target.checked))} onClick={(e) => e.stopPropagation()} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[#777]">Le gestionnaire teste d’abord les sources de premier niveau (IOC), puis, si PEIE = 1, les périphériques dans l’ordre de la table (H30).</p>
      </div>
    </>
  )
}
const fmtHz = (hz: number) => (hz >= 1e6 ? `${hz / 1e6} MHz` : hz >= 1e3 ? `${(hz / 1e3).toLocaleString('fr-FR')} kHz` : `${hz} Hz`)

function Badge({ id }: { id: string }) {
  const h = INFO3.hypotheses.find((x) => x.id === id)
  return (
    <span className="ml-1 inline-block rounded bg-warn/10 px-1 text-[10px] font-semibold text-warn ring-1 ring-warn/30" title={h ? `${h.id} : ${h.texte}` : id}>
      valeur non vérifiée ({id})
    </span>
  )
}

export default function Mcc({ config, onChange, onGenerate, message }: MccProps) {
  const [res, setRes] = useState<Resource>('pins')
  const s = config.system
  const setSys = (patch: Partial<MccConfig['system']>) => onChange({ ...config, system: { ...s, ...patch } })
  const pins = [...config.pins].sort((a, b) => pinOrder(a.pin, b.pin))
  const added: (TimerId | 'MSSP1' | 'EUSART' | PwmId)[] = [...(config.eusart ? (['EUSART'] as const) : []), ...(config.mssp ? (['MSSP1'] as const) : []), ...TIMER_IDS.filter((id) => config.timers?.[id]), ...PWM_IDS.filter((id) => config.pwm?.[id])]
  const notifications = [...pwmNotifications(config), ...eusartNotifications(config)]
  const isPwm = (r: string): r is PwmId => (PWM_IDS as readonly string[]).includes(r)

  const panel = 'rounded-lg border border-[#c8c8c8] bg-white text-[#1e1e1e]'
  const head = 'border-b border-[#c8c8c8] bg-[#e8e8e8] px-2 py-1 text-xs font-semibold'
  const field = 'rounded border border-[#b8b8b8] bg-white px-1.5 py-0.5 text-xs disabled:bg-[#eee] disabled:text-[#888]'

  return (
    <section className="space-y-2 rounded-card bg-[#f2f2f2] p-2 text-[#1e1e1e] ring-1 ring-[#c8c8c8]" aria-label="MCC">
      <div className="grid gap-2 md:grid-cols-[13rem_minmax(0,1fr)]">
        {/* Ressources */}
        <div className="space-y-2">
          <div className={panel}>
            <div className={`${head} flex items-center justify-between`}>
              <span>Project Resources</span>
              <button type="button" onClick={onGenerate} className="rounded border border-[#8a8a8a] bg-[#fafafa] px-2 py-0.5 text-xs font-semibold hover:bg-white">
                Generate
              </button>
            </div>
            <ul className="p-1 text-xs">
              <li className="px-1 font-semibold">System</li>
              {(
                [
                  ['interrupts', 'Interrupt Module'],
                  ['pins', 'Pin Module'],
                  ['system', 'System Module'],
                ] as const
              ).map(([id, label]) => (
                <li key={id}>
                  <button type="button" onClick={() => setRes(id)} aria-pressed={res === id} className={`w-full rounded px-3 py-0.5 text-left ${res === id ? 'bg-[#cfe2fb] font-semibold' : 'hover:bg-[#eef3fa]'}`}>
                    {label}
                  </button>
                </li>
              ))}
              {added.length > 0 && <li className="px-1 pt-1 font-semibold">Peripherals</li>}
              {added.map((id) => (
                <li key={id} className="flex items-center">
                  <button type="button" onClick={() => setRes(id)} aria-pressed={res === id} className={`flex-1 rounded px-3 py-0.5 text-left ${res === id ? 'bg-[#cfe2fb] font-semibold' : 'hover:bg-[#eef3fa]'}`}>
                    {id}
                  </button>
                  <button
                    type="button"
                    aria-label={`Retirer ${id} du projet`}
                    title={`Retirer ${id}`}
                    onClick={() => {
                      onChange(id === 'MSSP1' ? removeMssp(config) : id === 'EUSART' ? removeEusart(config) : isPwm(id) ? removePwm(config, id) : removeTimer(config, id))
                      if (res === id) setRes('pins')
                    }}
                    className="px-1.5 text-[#b71c1c] hover:bg-[#ffebee]"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className={panel}>
            <div className={head}>Device Resources</div>
            <ul className="p-1 text-xs">
              <li className="px-1 font-semibold">EUSART</li>
              <li className="flex items-center justify-between px-3 py-0.5">
                <span>EUSART</span>
                <button
                  type="button"
                  aria-label="Ajouter EUSART au projet"
                  disabled={!!config.eusart}
                  onClick={() => {
                    onChange(addEusart(config))
                    setRes('EUSART')
                  }}
                  className="rounded border border-[#8a8a8a] bg-[#fafafa] px-1.5 font-semibold text-[#1b5e20] disabled:opacity-40"
                >
                  +
                </button>
              </li>
              <li className="px-1 font-semibold">MSSP</li>
              <li className="flex items-center justify-between px-3 py-0.5">
                <span>MSSP1</span>
                <button
                  type="button"
                  aria-label="Ajouter MSSP1 au projet"
                  disabled={!!config.mssp}
                  onClick={() => {
                    onChange(addMssp(config))
                    setRes('MSSP1')
                  }}
                  className="rounded border border-[#8a8a8a] bg-[#fafafa] px-1.5 font-semibold text-[#1b5e20] disabled:opacity-40"
                >
                  +
                </button>
              </li>
              <li className="px-1 font-semibold">Timer</li>
              {TIMER_IDS.map((id) => (
                <li key={id} className="flex items-center justify-between px-3 py-0.5">
                  <span>{id}</span>
                  <button
                    type="button"
                    aria-label={`Ajouter ${id} au projet`}
                    disabled={!!config.timers?.[id]}
                    onClick={() => {
                      onChange(addTimer(config, id))
                      setRes(id)
                    }}
                    className="rounded border border-[#8a8a8a] bg-[#fafafa] px-1.5 font-semibold text-[#1b5e20] disabled:opacity-40"
                  >
                    +
                  </button>
                </li>
              ))}
              {(
                [
                  ['CCP', ['CCP1']],
                  ['PWM', ['PWM6', 'PWM7']],
                ] as const
              ).map(([group, ids]) => (
                <li key={group}>
                  <span className="block px-1 font-semibold">{group}</span>
                  <ul>
                    {ids.map((id) => (
                      <li key={id} className="flex items-center justify-between px-3 py-0.5">
                        <span>{id}</span>
                        <button
                          type="button"
                          aria-label={`Ajouter ${id} au projet`}
                          disabled={!!config.pwm?.[id]}
                          onClick={() => {
                            onChange(addPwm(config, id))
                            setRes(id)
                          }}
                          className="rounded border border-[#8a8a8a] bg-[#fafafa] px-1.5 font-semibold text-[#1b5e20] disabled:opacity-40"
                        >
                          +
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
          <div className={panel} aria-label="Notifications [MCC]">
            <div className={head}>Notifications [MCC]</div>
            {notifications.length ? (
              <ul className="space-y-1 p-2 text-xs text-[#8a4b00]">
                {notifications.map((n) => (
                  <li key={n}>⚠ {n}</li>
                ))}
              </ul>
            ) : (
              <p className="p-2 text-xs text-[#777]">Aucune notification.</p>
            )}
          </div>
          {message && (
            <p role="status" className={`rounded px-2 py-1 text-xs ring-1 ${message.ok ? 'bg-[#e8f5e9] text-[#1b5e20] ring-[#a5d6a7]' : 'bg-[#ffebee] text-[#b71c1c] ring-[#ef9a9a]'}`}>
              {message.text}
            </p>
          )}
        </div>

        {/* Panneau de la ressource */}
        <div className={`${panel} min-w-0`}>
          {res === 'interrupts' ? (
            <InterruptPanel config={config} onChange={onChange} head={head} />
          ) : res === 'MSSP1' ? (
            <MsspPanel config={config} onChange={onChange} head={head} field={field} />
          ) : res === 'EUSART' ? (
            <EusartPanel config={config} onChange={onChange} head={head} field={field} />
          ) : isPwm(res) ? (
            <PwmPanel key={res} id={res} config={config} onChange={onChange} head={head} field={field} />
          ) : res.startsWith('TMR') ? (
            <TimerPanel key={res} id={res as TimerId} config={config} onChange={onChange} head={head} field={field} />
          ) : res === 'system' ? (
            <>
              <div className={head}>System Module — Easy Setup</div>
              <div className="grid gap-x-4 gap-y-2 p-3 text-xs sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
                <label htmlFor="mcc-osc">Oscillator Select</label>
                <select id="mcc-osc" className={field} value={s.oscillator} onChange={(e) => setSys({ oscillator: e.target.value as Oscillator })}>
                  <option value="HFINTOSC">HFINTOSC</option>
                  <option value="LFINTOSC">LFINTOSC</option>
                </select>
                <label htmlFor="mcc-hf">HF Internal Clock</label>
                <select id="mcc-hf" className={field} value={s.hfMHz} disabled={s.oscillator !== 'HFINTOSC'} onChange={(e) => setSys({ hfMHz: Number(e.target.value) })}>
                  {INFO3.clock.hfintoscMHz.map((m) => (
                    <option key={m} value={m}>
                      {m}_MHz
                    </option>
                  ))}
                </select>
                <label htmlFor="mcc-div">Clock Divider</label>
                <select id="mcc-div" className={field} value={s.divider} onChange={(e) => setSys({ divider: Number(e.target.value) })}>
                  {DIVIDERS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <label htmlFor="mcc-ext">External Clock</label>
                <input id="mcc-ext" className={field} disabled value={`${INFO3.clock.mccGreyedClockField} Hz`} title="Champ grisé : affiché par MCC mais non utilisé" readOnly />
                <span>Current System clock</span>
                <output className="font-mono font-semibold">{fmtHz(systemFosc(s))}</output>
                <span>Programming</span>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={s.lvp} onChange={(e) => setSys({ lvp: e.target.checked })} /> Low-voltage programming enable
                </label>
              </div>
            </>
          ) : (
            <>
              <div className={`${head} flex flex-wrap justify-between gap-2`}>
                <span>Pin Module</span>
                <span className="font-normal">Selected Package : {packageOf(config)}</span>
              </div>
              <div className="max-w-full overflow-x-auto">
                <table className="w-full min-w-[46rem] text-left text-xs">
                  <thead className="bg-[#f5f5f5]">
                    <tr>
                      {['Pin Name', 'Module', 'Function', 'Custom Name', 'Start High'].map((h) => (
                        <th key={h} className="border-b border-[#ddd] px-2 py-1 font-semibold">
                          {h}
                        </th>
                      ))}
                      <th className="border-b border-[#ddd] px-2 py-1 font-semibold">
                        Analog
                        <Badge id="H23" />
                      </th>
                      {['Output', 'WPU', 'OD', 'IOC'].map((h) => (
                        <th key={h} className="border-b border-[#ddd] px-2 py-1 font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pins.length === 0 && (
                      <tr>
                        <td colSpan={10} className="px-2 py-2 text-[#777]">
                          Cliquer sur un cadenas du Pin Manager: Grid View pour ajouter une broche.
                        </td>
                      </tr>
                    )}
                    {pins.map((p) => {
                      const err = customNameError(config, p)
                      const set = (patch: Parameters<typeof updatePin>[2]) => onChange(updatePin(config, p.pin, patch))
                      return (
                        <tr key={p.pin} className="border-b border-[#eee]">
                          <td className="px-2 py-1 font-mono">{p.pin}</td>
                          <td className="px-2 py-1">Pin Module</td>
                          <td className="px-2 py-1">GPIO</td>
                          <td className="px-2 py-1">
                            <input
                              aria-label={`Custom Name de ${p.pin}`}
                              aria-invalid={!!err}
                              title={err ?? ''}
                              className={`w-32 rounded border px-1 py-0.5 font-mono ${err ? 'border-[#d32f2f] bg-[#ffebee] text-[#b71c1c]' : 'border-[#b8b8b8]'}`}
                              value={p.customName}
                              onChange={(e) => set({ customName: e.target.value })}
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input type="checkbox" aria-label={`Start High ${p.pin}`} checked={p.startHigh} disabled={p.direction !== 'output'} onChange={(e) => set({ startHigh: e.target.checked })} />
                          </td>
                          <td className="px-2 py-1">
                            <input type="checkbox" aria-label={`Analog ${p.pin}`} checked={p.analog} onChange={(e) => set({ analog: e.target.checked })} />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="checkbox"
                              aria-label={`Output ${p.pin}`}
                              checked={p.direction === 'output'}
                              disabled={(INFO3.mcc.inputOnly as readonly string[]).includes(p.pin)}
                              onChange={(e) => onChange(toggleGridPin(config, p.pin, e.target.checked ? 'output' : 'input'))}
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input type="checkbox" aria-label={`WPU ${p.pin}`} checked={p.wpu} onChange={(e) => set({ wpu: e.target.checked })} />
                          </td>
                          <td className="px-2 py-1">
                            <input type="checkbox" aria-label={`OD ${p.pin}`} checked={p.od} onChange={(e) => set({ od: e.target.checked })} />
                          </td>
                          <td className="px-2 py-1">
                            {iocAvailable(p.pin) ? (
                              <select aria-label={`IOC ${p.pin}`} className="rounded border border-[#b8b8b8] bg-white px-1" value={iocOf(p)} onChange={(e) => onChange(setIoc(config, p.pin, e.target.value as IocEdge))}>
                                {IOC_EDGES.map((x) => (
                                  <option key={x} value={x}>
                                    {x}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <select disabled aria-label={`IOC ${p.pin} (non disponible)`} title={p.pin[1] === 'D' ? 'IOC non disponible sur le port D' : 'IOC non disponible sur cette broche'} className="rounded border border-[#ccc] bg-[#eee] px-1 text-[#888]" value="none">
                                <option value="none">none</option>
                              </select>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Pin Manager: Grid View */}
      <GridView config={config} onChange={onChange} extraRows={[...eusartGridRows(config), ...spiGridRows(config), ...pwmGridRows(config), ...timerGridRows(config)]} />
    </section>
  )
}
