/**
 * IDE façon MPLAB X : arborescence du projet, onglets, éditeur CodeMirror (chargé à la demande),
 * barre d'outils et raccourcis, fenêtres Output, Variables et SFR. Thème clair par défaut, sombre en option.
 * Les actions Program et Debug passent par le parent (vérifications du banc : USB noir, Faire vérifier).
 */
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { INFO3 } from '../../data/reference'
import type { SimControls, Output } from '../ui/useSim'
import type { CodeEditorHandle } from './CodeEditor'
import { completionNames, findDefinition } from './symbols'

const CodeEditor = lazy(() => import('./CodeEditor'))

export interface Breakpoint {
  file: string
  line: number
}

export interface IdeProps {
  /** Fichiers de l'étudiant (modifiables) */
  files: Record<string, string>
  /** Fichiers générés par MCC (lecture seule) */
  generated: Record<string, string>
  onFilesChange(files: Record<string, string>): void
  sim: SimControls
  /** Make and Program Device (vérifications du banc côté parent) */
  onProgram(): void
  /** Debug Main Project */
  onDebug(breakpoint: Breakpoint | null): void
  /** Build (F11) */
  onBuild(): void
  dark: boolean
  onDarkChange(dark: boolean): void
}

const MCC_DIR = INFO3.mcc.dir
const isHeader = (f: string) => f.endsWith('.h')
const base = (f: string) => f.split('/').pop() ?? f
const levelColor = (l: Output['level'], dark: boolean) => (l === 'error' ? (dark ? 'text-[#ff8a80]' : 'text-[#c62828]') : l === 'warning' ? (dark ? 'text-[#ffd180]' : 'text-[#b26a00]') : dark ? 'text-[#c8e6c9]' : 'text-[#1b5e20]')

export default function Ide({ files, generated, onFilesChange, sim, onProgram, onDebug, onBuild, dark, onDarkChange }: IdeProps) {
  const all = useMemo(() => ({ ...files, ...generated }), [files, generated])
  const [tabs, setTabs] = useState<string[]>(() => ('main.c' in files ? ['main.c'] : []))
  const [active, setActive] = useState<string | null>(() => ('main.c' in files ? 'main.c' : null))
  const [bp, setBp] = useState<Breakpoint | null>(null)
  const [pendingGoto, setPendingGoto] = useState<{ file: string; line: number; col: number } | null>(null)
  const [newName, setNewName] = useState('')
  const [bottom, setBottom] = useState<'output' | 'variables' | 'sfr'>('output')
  const editor = useRef<CodeEditorHandle>(null)
  const v = sim.view
  const debugging = v.mode === 'debug-running' || v.mode === 'debug-stopped'
  const stopped = v.mode === 'debug-stopped'

  // État ajusté pendant le rendu (et non dans un effet) : main.c apparaît au premier Generate → on l'ouvre
  if (!active && 'main.c' in files) {
    setTabs((t) => (t.includes('main.c') ? t : [...t, 'main.c']))
    setActive('main.c')
  }
  // À chaque arrêt du débogueur : ouvrir le fichier de la ligne courante, afficher les Variables
  const [seenStop, setSeenStop] = useState(v.stoppedAt)
  if (v.stoppedAt !== seenStop) {
    setSeenStop(v.stoppedAt)
    const f = v.stoppedAt?.file
    if (stopped && f && f in all) {
      setTabs((t) => (t.includes(f) ? t : [...t, f]))
      setActive(f)
    }
    if (stopped && bottom === 'output') setBottom('variables')
  }

  const completions = useMemo(() => completionNames(all), [all])

  const open = (f: string, line?: number, col?: number) => {
    if (!(f in all)) return
    setTabs((t) => (t.includes(f) ? t : [...t, f]))
    setActive(f)
    if (line) setPendingGoto({ file: f, line, col: col ?? 1 })
  }
  useEffect(() => {
    if (pendingGoto && pendingGoto.file === active) {
      // L'éditeur peut être encore en cours de chargement : on réessaie à l'image suivante
      const id = requestAnimationFrame(() => {
        if (editor.current) {
          editor.current.goTo(pendingGoto.line, pendingGoto.col)
          setPendingGoto(null)
        }
      })
      return () => cancelAnimationFrame(id)
    }
  })
  const close = (f: string) => {
    setTabs((t) => {
      const n = t.filter((x) => x !== f)
      if (active === f) setActive(n[n.length - 1] ?? null)
      return n
    })
  }

  const toggleBreakpoint = (file: string, line: number) => {
    if (bp && bp.file === file && bp.line === line) {
      setBp(null)
      if (debugging) sim.send({ type: 'breakpoint', file, line: null })
      return
    }
    if (bp) sim.log({ type: 'output', level: 'warning', text: `Un seul point d'arrêt est disponible : ${file}:${line} remplace ${bp.file}:${bp.line}`, file, line })
    setBp({ file, line })
    if (debugging) sim.send({ type: 'breakpoint', file, line })
  }

  const gotoDefinition = (name: string) => {
    const d = findDefinition(all, name)
    if (d) open(d.file, d.line, d.col)
    else sim.log({ type: 'output', level: 'warning', text: `Définition de « ${name} » introuvable dans le projet` })
  }

  const addFile = () => {
    const n = newName.trim()
    if (!/^[A-Za-z_][\w-]*\.(c|h)$/.test(n) || n in all) return
    onFilesChange({ ...files, [n]: isHeader(n) ? `#ifndef ${n.replace(/\W/g, '_').toUpperCase()}\n#define ${n.replace(/\W/g, '_').toUpperCase()}\n\n#endif\n` : '#include "mcc_generated_files/mcc.h"\n' })
    setNewName('')
    open(n)
  }

  // Raccourcis de MPLAB X (CR TP1) : F11 Build, Ctrl+F5 Debug, F5 Continue, F7/F8 pas à pas, Ctrl+F7 Step Out
  const actions = useRef({ onBuild, onDebug: () => onDebug(bp), continue: () => sim.run(1), step: sim.step, stopped, debugging })
  useEffect(() => {
    actions.current = { onBuild, onDebug: () => onDebug(bp), continue: () => sim.run(1), step: sim.step, stopped, debugging }
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const a = actions.current
      if (e.key === 'F11') {
        e.preventDefault()
        a.onBuild()
      } else if (e.key === 'F5' && e.ctrlKey) {
        e.preventDefault()
        a.onDebug()
      } else if (e.key === 'F5' && a.stopped) {
        e.preventDefault()
        a.continue()
      } else if (e.key === 'F8' && a.stopped) {
        e.preventDefault()
        a.step('stepOver')
      } else if (e.key === 'F7' && a.stopped) {
        e.preventDefault()
        a.step(e.ctrlKey ? 'stepOut' : 'step')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const userFiles = Object.keys(files)
  const sources = userFiles.filter((f) => !isHeader(f)).sort()
  const headers = userFiles.filter(isHeader).sort()
  const mcc = Object.keys(generated).sort()
  const readOnly = !!active && active.startsWith(`${MCC_DIR}/`)
  const currentLine = stopped && v.stoppedAt?.file === active ? (v.stoppedAt.line ?? null) : null

  const th = dark
    ? { pane: 'bg-[#2b2d30] text-[#dfe1e5]', bar: 'bg-[#3c3f41] border-[#2b2b2b]', btn: 'bg-[#4e5254] hover:bg-[#5a5e60] text-[#e0e0e0] border-[#2b2b2b]', tab: 'bg-[#3c3f41]', tabOn: 'bg-[#1e1f22] text-white', out: 'bg-[#1e1f22]' }
    : { pane: 'bg-[#f2f2f2] text-[#1e1e1e]', bar: 'bg-[#e4e4e4] border-[#c8c8c8]', btn: 'bg-[#fafafa] hover:bg-white text-[#1e1e1e] border-[#b8b8b8]', tab: 'bg-[#dcdcdc]', tabOn: 'bg-white text-black', out: 'bg-white' }
  const tb = `inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium disabled:opacity-40 ${th.btn}`

  const treeItem = (f: string, label = base(f)) => (
    <li key={f}>
      <button type="button" onClick={() => open(f)} className={`w-full truncate rounded px-1.5 py-0.5 text-left text-xs hover:bg-black/10 ${active === f ? 'font-semibold underline' : ''}`} title={f}>
        {f.startsWith(`${MCC_DIR}/`) ? '🔒 ' : ''}
        {label}
      </button>
    </li>
  )

  return (
    <section className={`flex min-w-0 flex-col overflow-hidden rounded-card border ${dark ? 'border-[#2b2b2b]' : 'border-[#c8c8c8]'} ${th.pane}`} aria-label="IDE MPLAB X">
      {/* Barre d'outils */}
      <div className={`flex flex-wrap items-center gap-1 border-b px-2 py-1.5 ${th.bar}`} role="toolbar" aria-label="Barre d'outils">
        <button type="button" className={tb} onClick={onBuild} title="Build Main Project (F11)">
          🔨 Build
        </button>
        <button type="button" className={tb} onClick={onProgram} title="Make and Program Device Main Project">
          ⬇ Make and Program Device
        </button>
        <button type="button" className={tb} onClick={() => onDebug(bp)} title="Debug Main Project (Ctrl+F5)">
          🐞 Debug
        </button>
        <span className="mx-1 h-5 w-px bg-black/20" aria-hidden />
        <button type="button" className={tb} disabled={!debugging || stopped} onClick={sim.pause} title="Pause">
          ⏸ Pause
        </button>
        <button type="button" className={tb} disabled={!stopped} onClick={() => sim.run(1)} title="Continue (F5)">
          ▶ Continue
        </button>
        <button type="button" className={tb} disabled={!stopped} onClick={() => sim.step('stepOver')} title="Step Over (F8)">
          Step Over
        </button>
        <button type="button" className={tb} disabled={!stopped} onClick={() => sim.step('step')} title="Step Into (F7)">
          Step Into
        </button>
        <button type="button" className={tb} disabled={!stopped} onClick={() => sim.step('stepOut')} title="Step Out (Ctrl+F7)">
          Step Out
        </button>
        <button type="button" className={tb} disabled={v.mode === 'off'} onClick={() => sim.send({ type: 'reset' })} title="Reset">
          ⟲ Reset
        </button>
        <span className="mx-1 h-5 w-px bg-black/20" aria-hidden />
        <button type="button" className={tb} disabled={!active || readOnly} onClick={() => editor.current?.format()} title="Source > Format (Alt+Maj+F)">
          Source › Format
        </button>
        <label className="ml-auto flex items-center gap-1 text-xs">
          <input type="checkbox" checked={dark} onChange={(e) => onDarkChange(e.target.checked)} /> Thème sombre
        </label>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[11rem_minmax(0,1fr)]">
        {/* Projects */}
        <nav className={`border-b p-2 md:border-b-0 md:border-r ${dark ? 'border-[#2b2b2b]' : 'border-[#c8c8c8]'}`} aria-label="Projects">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide opacity-70">Projects</p>
          <p className="text-xs font-semibold">Source Files</p>
          <ul className="mb-1 pl-2">{sources.map((f) => treeItem(f))}</ul>
          <p className="text-xs font-semibold">Header Files</p>
          <ul className="mb-1 pl-2">{headers.length ? headers.map((f) => treeItem(f)) : <li className="px-1.5 text-xs opacity-50">—</li>}</ul>
          <p className="text-xs font-semibold">{MCC_DIR}</p>
          <ul className="mb-2 pl-2">{mcc.length ? mcc.map((f) => treeItem(f)) : <li className="px-1.5 text-xs opacity-50">Generate dans MCC</li>}</ul>
          <div className="flex gap-1">
            <input
              aria-label="Nouveau fichier (.c ou .h)"
              placeholder="LED8x8.c"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addFile()}
              className={`min-w-0 flex-1 rounded border px-1.5 py-0.5 text-xs ${dark ? 'border-[#555] bg-[#1e1f22]' : 'border-[#bbb] bg-white'}`}
            />
            <button type="button" className={tb} onClick={addFile} title="Nouveau fichier">
              +
            </button>
          </div>
        </nav>

        {/* Onglets et éditeur */}
        <div className="flex min-w-0 flex-col">
          <div className={`flex overflow-x-auto border-b ${th.bar}`} role="tablist" aria-label="Fichiers ouverts">
            {tabs.map((f) => (
              <div key={f} role="tab" aria-selected={active === f} className={`flex shrink-0 items-center gap-1 border-r px-2 py-1 text-xs ${dark ? 'border-[#2b2b2b]' : 'border-[#c8c8c8]'} ${active === f ? th.tabOn : th.tab}`}>
                <button type="button" onClick={() => setActive(f)} title={f}>
                  {base(f)}
                  {f.startsWith(`${MCC_DIR}/`) ? ' (lecture seule)' : ''}
                </button>
                <button type="button" aria-label={`Fermer ${base(f)}`} onClick={() => close(f)} className="opacity-60 hover:opacity-100">
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="h-80 min-h-0 md:h-[26rem]">
            {active && active in all ? (
              <Suspense fallback={<p className="p-3 text-xs opacity-70">Chargement de l’éditeur…</p>}>
                <CodeEditor
                  ref={editor}
                  path={active}
                  value={all[active]}
                  readOnly={readOnly}
                  dark={dark}
                  breakpointLine={bp && bp.file === active ? bp.line : null}
                  currentLine={currentLine}
                  completions={completions}
                  onChange={(text) => {
                    if (!readOnly) onFilesChange({ ...files, [active]: text })
                  }}
                  onToggleBreakpoint={(line) => toggleBreakpoint(active, line)}
                  onGotoDefinition={gotoDefinition}
                />
              </Suspense>
            ) : (
              <p className="p-3 text-xs opacity-70">Aucun fichier ouvert. Configurer MCC puis cliquer sur Generate : main.c est créé au premier Generate.</p>
            )}
          </div>
        </div>
      </div>

      {/* Fenêtres du bas */}
      <div className={`border-t ${dark ? 'border-[#2b2b2b]' : 'border-[#c8c8c8]'}`}>
        <div className={`flex border-b text-xs ${th.bar}`} role="tablist" aria-label="Fenêtres">
          {(['output', 'variables', 'sfr'] as const).map((w) => (
            <button key={w} type="button" role="tab" aria-selected={bottom === w} onClick={() => setBottom(w)} className={`px-3 py-1 ${bottom === w ? th.tabOn : ''}`}>
              {w === 'output' ? 'Output' : w === 'variables' ? 'Variables' : 'SFR'}
            </button>
          ))}
          {v.mode !== 'off' && <span className="ml-auto self-center px-2 font-mono tabular-nums opacity-80">t = {v.tSim.toFixed(3)} s</span>}
        </div>
        <div className={`h-40 overflow-y-auto p-2 font-mono text-xs leading-5 ${th.out}`} aria-live="polite">
          {bottom === 'output' &&
            (v.output.length === 0 ? (
              <p className="opacity-60">Output vide.</p>
            ) : (
              v.output.map((o, i) =>
                o.file && o.line && o.file in all ? (
                  <button key={i} type="button" onClick={() => open(o.file!, o.line, o.col)} className={`block w-full break-words text-left hover:underline ${levelColor(o.level, dark)}`}>
                    {o.text}
                  </button>
                ) : (
                  <p key={i} className={`break-words ${levelColor(o.level, dark)}`}>
                    {o.text}
                  </p>
                ),
              )
            ))}
          {bottom !== 'output' &&
            (!stopped || !v.snapshot ? (
              <p className="opacity-60">Disponible quand le débogueur est arrêté (point d’arrêt, Pause ou pas à pas).</p>
            ) : bottom === 'variables' ? (
              <table className="w-full text-left">
                <thead>
                  <tr className="opacity-70">
                    <th className="pr-3 font-normal">Nom</th>
                    <th className="font-normal">Valeur</th>
                  </tr>
                </thead>
                <tbody>
                  {v.snapshot.locals.map((r) => (
                    <tr key={`l-${r.name}`}>
                      <td className="pr-3">
                        {r.name} <span className="opacity-50">({v.snapshot!.func})</span>
                      </td>
                      <td className="break-all">{r.value}</td>
                    </tr>
                  ))}
                  {v.snapshot.globals.map((r) => (
                    <tr key={`g-${r.name}`}>
                      <td className="pr-3">
                        {r.name} <span className="opacity-50">(globale)</span>
                      </td>
                      <td className="break-all">{r.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left">
                <tbody>
                  {v.snapshot.sfrs.map((r) => (
                    <tr key={r.name}>
                      <td className="pr-3">{r.name}</td>
                      <td>{r.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
        </div>
      </div>
    </section>
  )
}
