import { useState } from 'react'
import { Link } from 'react-router'
import ENONCE from '../../../docs/info3/enonce.md?raw'
import type { Project } from '../../info3/project/project'
import { loadPrefs, loadProgress, loadTp1, savePrefs, saveProgress, saveTp1, type Progress } from '../../info3/project/storage'
import { runVerify, type Tp1QuestionId } from '../../info3/project/verify'
import { enonceMissing, enonceSection } from '../../info3/tp1/content'
import QuestionsPanel from '../../info3/tp1/QuestionsPanel'
import Markdown from '../../info3/ui/Markdown'
import Workbench from '../../info3/ui/Workbench'

/** TP1 — Ports parallèles : énoncé, questions, banc, IDE, MCC */
export default function Tp1Page() {
  const [project, setProject] = useState<Project>(() => loadTp1())
  const [progress, setProgress] = useState<Progress>(() => loadProgress())
  const [selected, setSelected] = useState<Tp1QuestionId>('tp1-3-1')
  const [verifyErrors, setVerifyErrors] = useState<string[] | null>(null)
  const [dark, setDark] = useState(() => loadPrefs().dark)

  const update = (p: Project) => {
    setProject(p)
    saveTp1(p)
  }
  const result = (id: string, state: 'passed' | 'failed', answer?: string) =>
    setProgress((prev) => {
      const cur = prev[id]
      const next: Progress = { ...prev, [id]: { state: cur?.state === 'passed' ? 'passed' : state, attempts: (cur?.attempts ?? 0) + 1, answer: answer ?? cur?.answer } }
      saveProgress(next)
      return next
    })
  const verify = () => {
    const r = runVerify(project, selected)
    setVerifyErrors(r.errors)
    update(r.project)
  }
  const section = enonceMissing(ENONCE) ? null : enonceSection(ENONCE, 1)

  return (
    <main className="mx-auto max-w-[96rem] space-y-3 p-3 sm:p-4">
      <header className="flex flex-wrap items-baseline gap-x-3">
        <p className="text-xs text-muted">
          <Link to="/info3" className="underline">
            INFO3
          </Link>{' '}
          › TP1
        </p>
        <h1 className="text-lg font-semibold">TP1 — Ports parallèles</h1>
      </header>

      <details className="rounded-card bg-card p-3 ring-1 ring-line">
        <summary className="cursor-pointer text-sm font-semibold">Énoncé du TP1</summary>
        <div className="mt-2 max-h-96 overflow-y-auto">
          {section ? (
            <Markdown text={section} />
          ) : (
            <p className="text-sm text-muted">
              L’énoncé n’est pas encore transcrit : docs/sources/INFO3_TP.pdf est absent. Aucun texte n’est inventé ; les questions affichent le résumé du PRD en attendant.
            </p>
          )}
        </div>
      </details>

      <Workbench
        project={project}
        onProject={update}
        dark={dark}
        onDarkChange={(d) => {
          setDark(d)
          savePrefs({ dark: d })
        }}
        sideLabel="Questions"
        side={({ sim }) => <QuestionsPanel project={project} sim={sim} enonce={ENONCE} progress={progress} onResult={result} selected={selected} onSelect={setSelected} />}
        benchExtra={
          <div className="mt-2 space-y-2 rounded-card bg-card p-3 ring-1 ring-line">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={verify} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-on-accent">
                Faire vérifier
              </button>
              <span className="text-xs text-muted">{project.verified ? 'Montage vérifié : mise sous tension autorisée.' : 'Obligatoire avant la première mise sous tension (USB noir).'}</span>
            </div>
            {verifyErrors &&
              (verifyErrors.length === 0 ? (
                <p role="status" className="text-sm text-ok">
                  Configuration conforme pour la question {selected.replace('tp1-', '').replace('-', '.')}.
                </p>
              ) : (
                <ul role="status" className="list-disc pl-5 text-sm text-err">
                  {verifyErrors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              ))}
          </div>
        }
      />
    </main>
  )
}
