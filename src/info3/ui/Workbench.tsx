/**
 * Poste de travail INFO3 (TP et mode libre) : IDE ou MCC, banc, panneau latéral (questions ou Diagnostic).
 * Écran étroit : 4 onglets (Code, MCC, Banc, panneau latéral), sans défilement horizontal de la page.
 * Toutes les règles (Generate, verrouillage, programmation) viennent du modèle testé (project.ts).
 */
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { INFO3 } from '../../data/reference'
import Board from '../board/Board'
import RotaryControl from '../board/RotaryControl'
import InterruptInspector from './InterruptInspector'
import LogicAnalyzer from './LogicAnalyzer'
import Oscilloscope from './Oscilloscope'
import Terminal from './Terminal'
import Ide, { type Breakpoint } from '../ide/Ide'
import { programCheck, projectFiles, runGenerate, setCard, setUsbBlack, setUsbWhite, type Project, type Result, type SlotId } from '../project/project'
import { useSim, type SimControls } from './useSim'
import type { Speed } from '../worker/protocol'

const Mcc = lazy(() => import('../mcc/Mcc'))

type Tab = 'code' | 'mcc' | 'bench' | 'side'

export interface WorkbenchProps {
  project: Project
  onProject(p: Project): void
  /** Titre du panneau latéral (Questions, Diagnostic) */
  sideLabel: string
  side(ctx: { sim: SimControls }): ReactNode
  /** Contenu ajouté sous le banc (Faire vérifier…) */
  benchExtra?: ReactNode
  /** Voies proposées au départ par l'analyseur logique */
  analyzerChannels?: string[]
  /** Sondes de l'oscilloscope au départ (CH1, CH2) */
  scopeProbes?: [string, string]
  dark: boolean
  onDarkChange(dark: boolean): void
}

const SLOT_NAMES: Record<SlotId, string> = { mikrobus1: 'mikroBUS 1', mikrobus2: 'mikroBUS 2' }
const DEFAULT_CHANNELS = ['RA4', 'RB4', 'RC5', 'ISR']
/** TP17 (SCK) et TP16 (MOSI) */
const DEFAULT_PROBES: [string, string] = [INFO3.scope.testPoints[0].pin, INFO3.scope.testPoints[1].pin]

export default function Workbench({ project, onProject, sideLabel, side, benchExtra, analyzerChannels = DEFAULT_CHANNELS, scopeProbes = DEFAULT_PROBES, dark, onDarkChange }: WorkbenchProps) {
  const sim = useSim()
  const rotarySlot = (Object.keys(project.bench.slots) as SlotId[]).find((s) => project.bench.slots[s] === 'rotary') ?? null
  const { setBench } = sim
  const usbWhite = project.bench.usbWhite
  useEffect(() => {
    setBench(rotarySlot, usbWhite)
  }, [rotarySlot, usbWhite, setBench])
  const [tab, setTab] = useState<Tab>('code')
  const [main, setMain] = useState<'code' | 'mcc'>('code')
  const [benchMsg, setBenchMsg] = useState<string | null>(null)
  /** Rebonds des boutons (H3) : comme sur la carte réelle, activés par défaut */
  const [bounce, setBounce] = useState(true)
  /** Vitesse de simulation (×1 au lancement par Program / Debug) */
  const [speed, setSpeed] = useState<Speed>(1)
  const [genMsg, setGenMsg] = useState<{ ok: boolean; text: string } | null>(null)
  /** Programme en mémoire flash : redémarre à chaque mise sous tension */
  const flash = useRef<Record<string, string> | null>(null)

  const apply = (r: Result) => {
    onProject(r.project)
    setBenchMsg(r.ok ? null : (r.message ?? null))
    return r
  }

  const files = projectFiles(project)
  const generated = project.generated ?? {}

  const build = () => {
    if (!project.generated) {
      sim.log({ type: 'output', level: 'error', text: 'BUILD FAILED : les fichiers MCC n’existent pas (cliquer sur Generate dans MCC)' })
      return
    }
    void sim.build(files)
  }

  const guard = (): boolean => {
    if (!project.generated) {
      sim.log({ type: 'output', level: 'error', text: 'Generate n’a pas été fait : configurer MCC puis cliquer sur Generate' })
      return false
    }
    const err = programCheck(project)
    if (err) {
      sim.clearOutput()
      sim.log({ type: 'output', level: 'error', text: err })
      setBenchMsg(err)
      return false
    }
    return true
  }

  const program = async () => {
    if (!guard()) return
    if (await sim.program(files)) {
      flash.current = files
      // Program lance à ×1 : la vitesse choisie sur le banc est réappliquée
      if (speed !== 1) sim.run(speed)
    }
  }
  const debug = async (bp: Breakpoint | null) => {
    if (!guard()) return
    if (await sim.debug(files, bp)) flash.current = files
  }

  const usbBlack = (plugged: boolean) => {
    const r = apply(setUsbBlack(project, plugged))
    if (!r.ok) return
    if (!plugged) sim.powerOff()
    else if (flash.current) {
      // Le programme reste dans la mémoire flash du PIC : il redémarre à la mise sous tension
      void sim.program(flash.current)
    }
  }

  const generate = () => {
    const r = runGenerate(project)
    setGenMsg({ ok: r.ok, text: r.message ?? '' })
    if (r.ok) onProject(r.project)
  }

  const show = (t: Tab) => {
    setTab(t)
    if (t === 'code' || t === 'mcc') setMain(t)
  }
  const tabs: [Tab, string][] = [
    ['code', 'Code'],
    ['mcc', 'MCC'],
    ['bench', 'Banc'],
    ['side', sideLabel],
  ]
  const on = (t: Tab) => (tab === t ? '' : 'hidden lg:block')
  const powered = project.bench.usbBlack

  return (
    <div className="space-y-3">
      {/* Onglets (écran étroit) */}
      <div className="flex rounded-lg bg-card p-1 ring-1 ring-line lg:hidden" role="tablist" aria-label="Vues">
        {tabs.map(([t, label]) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => show(t)} className={`flex-1 rounded-md px-2 py-1.5 text-sm font-medium ${tab === t ? 'bg-accent text-on-accent' : 'text-ink'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="min-w-0 space-y-2">
          {/* Choix de la vue principale (écran large) */}
          <div className="hidden gap-1 lg:flex" role="tablist" aria-label="Vue principale">
            {(['code', 'mcc'] as const).map((m) => (
              <button key={m} type="button" role="tab" aria-selected={main === m} onClick={() => show(m)} className={`rounded-md px-3 py-1 text-sm font-medium ring-1 ${main === m ? 'bg-accent text-on-accent ring-accent' : 'bg-card ring-line hover:bg-card-2'}`}>
                {m === 'code' ? 'Projet (IDE)' : 'MCC'}
              </button>
            ))}
          </div>
          <div className={main === 'code' ? (tab === 'code' ? '' : 'hidden lg:block') : 'hidden'}>
            <Ide
              files={project.files}
              generated={generated}
              onFilesChange={(f) => onProject({ ...project, files: f })}
              sim={sim}
              onBuild={build}
              onProgram={() => void program()}
              onDebug={(bp) => void debug(bp)}
              dark={dark}
              onDarkChange={onDarkChange}
            />
          </div>
          {main === 'mcc' && (
            <div className={tab === 'mcc' ? '' : 'hidden lg:block'}>
              <Suspense fallback={<p className="p-3 text-sm text-muted">Chargement de MCC…</p>}>
                <Mcc config={project.mcc} onChange={(mcc) => onProject({ ...project, mcc })} onGenerate={generate} message={genMsg} />
              </Suspense>
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-3">
          <div className={on('bench')}>
            <Board
              duty={powered ? sim.view.duty : {}}
              bench={project.bench}
              message={benchMsg}
              onButton={(name, action) => sim.view.mode !== 'off' && sim.send({ type: 'stimulus', action, button: name, bounce })}
              onUsbBlack={usbBlack}
              onUsbWhite={(v) => apply(setUsbWhite(project, v))}
              onCover={(v) => onProject({ ...project, bench: { ...project.bench, cover: v } })}
              onCard={(slot, card) => apply(setCard(project, slot, card))}
            />
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
              <label className="flex items-center gap-1.5" title={INFO3.hypotheses.find((h) => h.id === 'H3')?.texte}>
                <input type="checkbox" checked={bounce} onChange={(e) => setBounce(e.target.checked)} /> Rebonds des boutons S1 et S2 (H3)
              </label>
              <label className="flex items-center gap-1.5">
                Vitesse
                <select
                  aria-label="Vitesse de simulation"
                  className="rounded border border-line bg-card px-1 py-0.5"
                  value={speed}
                  onChange={(e) => {
                    const s = Number(e.target.value) as Speed
                    setSpeed(s)
                    if (sim.view.mode === 'running' || sim.view.mode === 'debug-running') sim.run(s)
                  }}
                >
                  {INFO3.vm.speeds.map((s) => (
                    <option key={s} value={s}>
                      ×{String(s).replace('.', ',')}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {rotarySlot && (
              <div className="mt-2">
                <RotaryControl slotLabel={SLOT_NAMES[rotarySlot]} onTurn={(n) => sim.rotary({ action: 'turn', detents: n })} onSpin={(r) => sim.rotary({ action: 'spin', rate: r })} onSw={(p) => sim.rotary({ action: 'sw', pressed: p })} ring={powered ? sim.view.ring : []} />
              </div>
            )}
            {benchExtra}
            <div className="mt-2">
              <InterruptInspector irq={powered ? sim.view.irq : null} mcc={project.mcc} />
            </div>
            <div className="mt-2">
              <LogicAnalyzer sim={sim} defaults={analyzerChannels} />
            </div>
            <div className="mt-2">
              <Oscilloscope sim={sim} defaults={scopeProbes} />
            </div>
            <div className="mt-2">
              <Terminal sim={sim} connected={project.bench.usbWhite} />
            </div>
          </div>
          <div className={on('side')}>{side({ sim })}</div>
        </div>
      </div>
    </div>
  )
}
