/**
 * Page d'un TP (2, 3 ou 4) : énoncé, questions, banc, IDE, MCC, « Faire vérifier » de la question choisie.
 * Même poste de travail que le TP1 (Workbench) ; projet et progression sauvegardés dans localStorage.
 */
import { useState } from 'react'
import { Link } from 'react-router'
import ENONCE from '../../../docs/info3/enonce.md?raw'
import type { Project } from '../project/project'
import { loadPrefs, loadProgress, loadTp, savePrefs, saveProgress, saveTp, type Progress, type TpNumber } from '../project/storage'
import { runVerifyTp23, type Tp23QuestionId } from '../project/verify23'
import { enonceMissing, enonceSection } from '../tp1/content'
import Markdown from '../ui/Markdown'
import Workbench from '../ui/Workbench'
import TpQuestions from './TpQuestions'

export interface TpPageProps {
  tp: TpNumber
  title: string
  first: Tp23QuestionId
  analyzerChannels: string[]
  scopeProbes?: [string, string]
}

export default function TpPage({ tp, title, first, analyzerChannels, scopeProbes }: TpPageProps) {
  const full = `TP${tp} — ${title}`
  const [project, setProject] = useState<Project>(() => loadTp(tp, full))
  const [progress, setProgress] = useState<Progress>(() => loadProgress())
  const [selected, setSelected] = useState<Tp23QuestionId>(first)
  const [verifyErrors, setVerifyErrors] = useState<string[] | null>(null)
  const [dark, setDark] = useState(() => loadPrefs().dark)

  const update = (p: Project) => {
    setProject(p)
    saveTp(tp, p)
  }
  const result = (id: string, state: 'passed' | 'failed', answer?: string) =>
    setProgress((prev) => {
      const cur = prev[id]
      const next: Progress = { ...prev, [id]: { state: cur?.state === 'passed' ? 'passed' : state, attempts: (cur?.attempts ?? 0) + 1, answer: answer ?? cur?.answer } }
      saveProgress(next)
      return next
    })
  const verify = () => {
    const r = runVerifyTp23(project, selected)
    setVerifyErrors(r.errors)
    update(r.project)
  }
  const section = enonceMissing(ENONCE) ? null : enonceSection(ENONCE, tp)
  const numero = selected.replace(`tp${tp}-`, '').replace('-', '.')

  return (
    <main className="mx-auto max-w-[96rem] space-y-3 p-3 sm:p-4">
      <header className="flex flex-wrap items-baseline gap-x-3">
        <p className="text-xs text-muted">
          <Link to="/info3" className="underline">
            INFO3
          </Link>{' '}
          › TP{tp}
        </p>
        <h1 className="text-lg font-semibold">{full}</h1>
      </header>

      <details className="rounded-card bg-card p-3 ring-1 ring-line">
        <summary className="cursor-pointer text-sm font-semibold">Énoncé du TP{tp}</summary>
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
        analyzerChannels={analyzerChannels}
        scopeProbes={scopeProbes}
        sideLabel="Questions"
        side={({ sim }) => <TpQuestions tp={tp} project={project} sim={sim} enonce={ENONCE} progress={progress} onResult={result} selected={selected} onSelect={setSelected} />}
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
                  Configuration conforme pour la question {numero}.
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
