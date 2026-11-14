import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { diagnose } from '../../info3/project/diagnostic'
import type { Project } from '../../info3/project/project'
import { starterProject, STARTERS } from '../../info3/project/starters'
import type { SimControls } from '../../info3/ui/useSim'
import { exportProject, importProject, loadLibre, loadPrefs, saveLibre, savePrefs, type LibreState } from '../../info3/project/storage'
import Workbench from '../../info3/ui/Workbench'

const newId = () => `libre-${Date.now().toString(36)}`

/** Mode libre : projet vierge (MCC par défaut + main.c du cours), plusieurs projets, export/import JSON, Diagnostic */
export default function LibrePage() {
  const [state, setState] = useState<LibreState>(() => loadLibre())
  const [dark, setDark] = useState(() => loadPrefs().dark)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const project = state.projects.find((p) => p.id === state.currentId) ?? state.projects[0]

  const commit = (st: LibreState) => {
    setState(st)
    saveLibre(st)
  }
  const update = (p: Project) => commit({ ...state, projects: state.projects.map((x) => (x.id === p.id ? p : x)) })
  const add = (p: Project) => commit({ ...state, projects: [...state.projects, p], currentId: p.id })

  const [starter, setStarter] = useState(STARTERS[0].id)
  const create = () => add(starterProject(STARTERS.find((x) => x.id === starter) ?? STARTERS[0], newId()))
  const remove = () => {
    if (state.projects.length < 2) return
    const rest = state.projects.filter((p) => p.id !== project.id)
    commit({ ...state, projects: rest, currentId: rest[0].id })
  }
  const exportJson = () => {
    const blob = new Blob([exportProject(project)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project.name.replace(/[^\w-]+/g, '_')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  const importJson = async (f: File) => {
    const p = importProject(await f.text(), newId())
    if (!p) {
      setImportMsg('Fichier invalide : ce n’est pas un projet INFO3 exporté.')
      return
    }
    setImportMsg(`Projet « ${p.name} » importé.`)
    add(p)
  }

  return (
    <main className="w-full space-y-3 p-3 sm:p-4">
      <header className="flex flex-wrap items-baseline gap-x-3">
        <p className="text-xs text-muted">
          <Link to="/info3" className="underline">
            INFO3
          </Link>{' '}
          › Mode libre
        </p>
        <h1 className="text-lg font-semibold">Mode libre</h1>
      </header>

      <div className="flex flex-wrap items-center gap-2 rounded-card bg-card p-2 ring-1 ring-line">
        <label className="flex min-w-0 items-center gap-1.5 text-sm">
          Projet
          <select value={project.id} onChange={(e) => commit({ ...state, currentId: e.target.value })} className="min-w-0 rounded border border-line bg-field px-2 py-1 text-sm">
            {state.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <input aria-label="Nom du projet" value={project.name} onChange={(e) => update({ ...project, name: e.target.value })} className="w-36 min-w-0 rounded border border-line bg-field px-2 py-1 text-sm" />
        <select aria-label="Projet de départ" value={starter} onChange={(e) => setStarter(e.target.value)} className="min-w-0 rounded border border-line bg-field px-2 py-1 text-sm">
          {STARTERS.map((x) => (
            <option key={x.id} value={x.id}>
              {x.label}
            </option>
          ))}
        </select>
        <button type="button" onClick={create} className="rounded-lg bg-card px-2.5 py-1 text-sm ring-1 ring-line hover:bg-card-2">
          Nouveau
        </button>
        <button type="button" onClick={remove} disabled={state.projects.length < 2} className="rounded-lg bg-card px-2.5 py-1 text-sm ring-1 ring-line hover:bg-card-2 disabled:opacity-40">
          Supprimer
        </button>
        <button type="button" onClick={exportJson} className="rounded-lg bg-card px-2.5 py-1 text-sm ring-1 ring-line hover:bg-card-2">
          Exporter (JSON)
        </button>
        <button type="button" onClick={() => fileInput.current?.click()} className="rounded-lg bg-card px-2.5 py-1 text-sm ring-1 ring-line hover:bg-card-2">
          Importer…
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void importJson(f)
            e.target.value = ''
          }}
        />
        {importMsg && <span className="text-xs text-muted">{importMsg}</span>}
      </div>

      <Workbench
        key={project.id}
        project={project}
        onProject={update}
        dark={dark}
        onDarkChange={(d) => {
          setDark(d)
          savePrefs({ dark: d })
        }}
        mccDisabled={!!project.registersOnly}
        sideLabel="Diagnostic"
        side={({ sim }) => <DiagnosticPanel sim={sim} project={project} />}
      />
    </main>
  )
}

/** Diagnostic étendu (R1 à R12) : registres et exécution, sans jamais modifier le code. Jamais en examen. */
function DiagnosticPanel({ sim, project }: { sim: SimControls; project: Project }) {
  const programmed = sim.view.programmed
  const { send } = sim
  // Relève des accès concurrents (R11) dès qu'un programme tourne
  useEffect(() => {
    if (programmed) send({ type: 'diagWatch', on: true })
  }, [programmed, send])
  const d = sim.view.diag
  const findings = diagnose(project, d ? { analogReads: d.analogReads, inputWrites: d.inputWrites, fosc: d.fosc, irq: sim.view.irq, uart: d.uart, shared: d.shared } : null)
  return (
            <section className="space-y-2 rounded-card bg-card p-3 ring-1 ring-line" aria-label="Diagnostic">
              <h2 className="text-sm font-semibold">Diagnostic</h2>
              <p className="text-xs text-muted">Lu dans les registres et pendant l’exécution ; le code n’est jamais modifié.</p>
              {findings.length === 0 ? (
                <p className="text-sm text-ok">Aucune incohérence détectée.</p>
              ) : (
                <ul className="space-y-1">
                  {findings.map((f, i) => (
                    <li key={i} className="rounded bg-warn/10 px-2 py-1 text-sm text-warn ring-1 ring-warn/30">
                      <span className="font-semibold">{f.rule}</span> {f.text}
                    </li>
                  ))}
                </ul>
              )}
            </section>
  )
}
