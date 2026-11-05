import { useEffect, useRef, useState } from 'react'
import { INFO3 } from '../../data/reference'
import { CR_FIXTURES, MCC_TP1 } from '../../info3/fixtures'
import { createSimClient, type SimClient } from '../../info3/worker/client'
import type { OutMsg, Speed } from '../../info3/worker/protocol'

type Output = Extract<OutMsg, { type: 'output' }>

const EMPTY = '#include "mcc_generated_files/mcc.h"\nvoid main(void)\n{\n    SYSTEM_Initialize();\n    while (1)\n    {\n    }\n}\n'
const LEDS = INFO3.pins.leds
const BUTTONS = INFO3.pins.buttons
const SPEEDS = INFO3.vm.speeds
const speedLabel = (s: number) => `×${String(s).replace('.', ',')}`

/** Page technique de l'étape 1 : compilateur + VM dans le Worker, 4 LED, S1/S2, Output. Sans lien public. */
export default function Info3Dev() {
  const [source, setSource] = useState(CR_FIXTURES['tp1/q3_3'] ?? EMPTY)
  const [fixture, setFixture] = useState('tp1/q3_3')
  const [output, setOutput] = useState<Output[]>([])
  const [duty, setDuty] = useState<Record<string, number>>({})
  const [tSim, setTSim] = useState(0)
  const [running, setRunning] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [speed, setSpeed] = useState<Speed>(1)
  const [bounce, setBounce] = useState(false)
  const [bpLine, setBpLine] = useState('')
  const client = useRef<SimClient | null>(null)
  const editor = useRef<HTMLTextAreaElement>(null)
  const outBox = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const c = createSimClient()
    client.current = c
    const off = c.onMessage((m) => {
      if (m.type === 'frame') {
        setTSim(m.tSim)
        if (Object.keys(m.ledDuty).length) setDuty((d) => ({ ...d, ...m.ledDuty }))
      } else if (m.type === 'output') {
        setOutput((o) => [...o, m])
        if (m.text.startsWith('BUILD SUCCESSFUL')) setLoaded(true)
        if (m.text.startsWith('BUILD FAILED')) setLoaded(false)
      } else if (m.type === 'halted') {
        setRunning(false)
        if (m.reason !== 'pause' && m.reason !== 'breakpoint') setOutput((o) => [...o, { type: 'output', level: 'error', text: `Arrêt : ${m.reason}` }])
      }
    })
    return () => {
      off()
      c.terminate()
      client.current = null
    }
  }, [])

  useEffect(() => {
    outBox.current?.scrollTo({ top: outBox.current.scrollHeight })
  }, [output])

  const send: SimClient['send'] = (msg) => client.current?.send(msg)

  const build = () => {
    setOutput([])
    setDuty({})
    setRunning(false)
    send({ type: 'load', files: { 'main.c': source, ...MCC_TP1 } })
  }

  const run = (s: Speed = speed) => {
    send({ type: 'run', speed: s })
    setRunning(true)
  }

  /** Clic sur une erreur : place le curseur à la ligne et à la colonne dans l'éditeur (main.c seulement) */
  const goTo = (o: Output) => {
    if (o.file !== 'main.c' || !o.line || !editor.current) return
    const lines = source.split('\n')
    let pos = 0
    for (let i = 0; i < o.line - 1 && i < lines.length; i++) pos += lines[i].length + 1
    pos += Math.max(0, (o.col ?? 1) - 1)
    const ta = editor.current
    ta.focus()
    ta.setSelectionRange(pos, pos + 1)
    const lineHeight = ta.scrollHeight / Math.max(1, lines.length)
    ta.scrollTop = Math.max(0, (o.line - 3) * lineHeight)
  }

  const btn = 'rounded-lg bg-card px-3 py-1.5 text-sm font-medium ring-1 ring-line hover:bg-card-2 disabled:opacity-40'

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6">
      <h1 className="text-lg font-semibold">INFO3 — moteur (page technique)</h1>
      <p className="mt-1 text-xs text-muted">
        Étape 1 : compilateur C, VM et Worker. Projet = <code>main.c</code> + fichiers MCC du TP1 (<code>mcc_generated_files/</code>).
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <section className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <label className="text-sm" htmlFor="fixture">
              Fixture
            </label>
            <select
              id="fixture"
              className="min-w-0 rounded-lg bg-field px-2 py-1.5 text-sm ring-1 ring-line"
              value={fixture}
              onChange={(e) => {
                setFixture(e.target.value)
                setSource(e.target.value === '' ? EMPTY : CR_FIXTURES[e.target.value])
              }}
            >
              <option value="">projet vide</option>
              {Object.keys(CR_FIXTURES)
                .sort()
                .map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
            </select>
            <button className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-on-accent hover:brightness-110" onClick={build}>
              Compile
            </button>
          </div>
          <textarea
            ref={editor}
            aria-label="main.c"
            spellCheck={false}
            className="h-80 w-full resize-y rounded-card bg-screen p-3 font-mono text-xs leading-5 text-[#d8e2dc] ring-1 ring-line"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          />
        </section>

        <section className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button className={btn} disabled={!loaded || running} onClick={() => run()}>
              Run
            </button>
            <button
              className={btn}
              disabled={!running}
              onClick={() => {
                send({ type: 'pause' })
                setRunning(false)
              }}
            >
              Pause
            </button>
            <button
              className={btn}
              disabled={!loaded}
              onClick={() => {
                send({ type: 'reset' })
                setRunning(false)
                setDuty({})
              }}
            >
              Reset
            </button>
            <button className={btn} disabled={!loaded || running} onClick={() => send({ type: 'step' })}>
              Step
            </button>
            <div className="flex overflow-hidden rounded-lg ring-1 ring-line" role="group" aria-label="Vitesse">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  className={`px-2 py-1.5 text-sm ${s === speed ? 'bg-accent text-on-accent' : 'bg-card hover:bg-card-2'}`}
                  onClick={() => {
                    setSpeed(s)
                    if (running) run(s)
                  }}
                >
                  {speedLabel(s)}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-card bg-screen p-4 text-[#d8e2dc] ring-1 ring-line">
            <div className="flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-wide text-[#8fa195]">Curiosity HPC</span>
              <span className="font-mono text-sm tabular-nums" aria-label="Temps simulé">
                t = {tSim.toFixed(3)} s
              </span>
            </div>
            <div className="mt-4 flex justify-around">
              {LEDS.map((l) => {
                const d = duty[l.name] ?? 0
                return (
                  <div key={l.name} className="flex flex-col items-center gap-1">
                    <span
                      aria-label={`LED ${l.name}`}
                      data-on={d > 0.5 ? '1' : '0'}
                      className="block h-6 w-6 rounded-full ring-1 ring-black/40"
                      style={{
                        background: `color-mix(in srgb, #ff3b30 ${Math.round(15 + 85 * d)}%, #2a1512)`,
                        boxShadow: d > 0 ? `0 0 ${Math.round(4 + 14 * d)}px rgba(255,59,48,${0.3 + 0.6 * d})` : 'none',
                      }}
                    />
                    <span className="text-xs">{l.name}</span>
                    <span className="font-mono text-[10px] text-[#8fa195]">{l.pin}</span>
                  </div>
                )
              })}
            </div>
            <div className="mt-4 flex items-center justify-around gap-3">
              {BUTTONS.map((b) => (
                <button
                  key={b.name}
                  className="h-11 w-11 touch-none select-none rounded-full bg-[#30383a] text-xs font-semibold ring-2 ring-[#59656a] active:bg-[#1c2224]"
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId)
                    send({ type: 'stimulus', action: 'press', button: b.name, bounce })
                  }}
                  onPointerUp={() => send({ type: 'stimulus', action: 'release', button: b.name, bounce })}
                  onPointerCancel={() => send({ type: 'stimulus', action: 'release', button: b.name, bounce })}
                >
                  {b.name}
                </button>
              ))}
              <label className="flex items-center gap-1.5 text-xs">
                <input type="checkbox" checked={bounce} onChange={(e) => setBounce(e.target.checked)} />
                rebonds (H3)
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label htmlFor="bp">Point d’arrêt main.c, ligne</label>
            <input id="bp" inputMode="numeric" className="w-16 rounded-lg bg-field px-2 py-1 ring-1 ring-line" value={bpLine} onChange={(e) => setBpLine(e.target.value.replace(/\D/g, ''))} />
            <button className={btn} disabled={!loaded || !bpLine} onClick={() => send({ type: 'breakpoint', file: 'main.c', line: Number(bpLine) })}>
              Poser
            </button>
            <button className={btn} disabled={!loaded} onClick={() => send({ type: 'breakpoint', file: 'main.c', line: null })}>
              Retirer
            </button>
          </div>

          <div>
            <h2 className="mb-1 text-sm font-semibold">Output</h2>
            <div ref={outBox} className="h-48 overflow-y-auto rounded-card bg-screen p-2 font-mono text-xs leading-5 ring-1 ring-line" aria-live="polite">
              {output.length === 0 && <p className="text-[#8fa195]">Compiler pour commencer.</p>}
              {output.map((o, i) =>
                o.line && o.file === 'main.c' ? (
                  <button
                    key={i}
                    className={`block w-full break-words text-left underline-offset-2 hover:underline ${o.level === 'error' ? 'text-[#ff8a80]' : o.level === 'warning' ? 'text-[#ffd180]' : 'text-[#c8e6c9]'}`}
                    onClick={() => goTo(o)}
                  >
                    {o.text}
                  </button>
                ) : (
                  <p key={i} className={`break-words ${o.level === 'error' ? 'text-[#ff8a80]' : o.level === 'warning' ? 'text-[#ffd180]' : 'text-[#c8e6c9]'}`}>
                    {o.text}
                  </p>
                ),
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
