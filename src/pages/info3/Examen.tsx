/**
 * Mode examen INFO3 (/info3/examen) : sujet tiré par graine (TP1 à TP6 ou aléatoire), chrono, variante avec MCC
 * ou registres seuls, « Faire vérifier » noté par essai, copies rendues sans verdict, remise (bouton ou chrono à 0),
 * feuille de notes et correction. Aucun Diagnostic ni infobulle d'aide pendant l'épreuve. Session dans sessionStorage.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import ENONCE from '../../../docs/info3/enonce.md?raw'
import { INFO3_QUESTIONS } from '../../data/questions'
import { INFO3 } from '../../data/reference'
import { clearSession, coursePageOf, drawSubject, examSheet, loadSession, recordCheck, recordHandIn, remainingS, saveSession, showCorrectionByDefault, startSession, submit, type ExamSession, type ExamTopic, type ExamVariant } from '../../info3/exam/exam'
import { examVerify } from '../../info3/exam/verify'
import { blankProject, projectFiles, type Project } from '../../info3/project/project'
import { questionTitle } from '../../info3/tp1/content'
import Markdown from '../../info3/ui/Markdown'
import Workbench from '../../info3/ui/Workbench'
import type { SimControls } from '../../info3/ui/useSim'

const E = INFO3.exam
/** Heure courante (gestionnaires d'événements et minuterie uniquement) */
const nowMs = () => Date.now()
const REGISTERS_MAIN = '#include <xc.h>\n\nvoid main(void)\n{\n    while (1)\n    {\n    }\n}\n'
const fmtClock = (s: number) => `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')} min ${String(Math.floor(s % 60)).padStart(2, '0')} s`
const pts = (x: number) => x.toFixed(2).replace('.', ',')
const BTN = 'rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-on-accent disabled:opacity-40'
const label = (id: string) => {
  const q = INFO3_QUESTIONS.find((x) => x.id === id)
  return q ? `TP${q.tp} ${q.numero}` : id
}

export default function ExamenPage() {
  const [session, setSession] = useState<ExamSession | null>(() => loadSession())
  const update = (s: ExamSession | null) => {
    setSession(s)
    if (s) saveSession(s)
    else clearSession()
  }
  return (
    <main className="mx-auto max-w-[96rem] space-y-3 p-3 sm:p-4">
      <header className="flex flex-wrap items-baseline gap-x-3">
        <p className="text-xs text-muted">
          <Link to="/info3" className="underline">
            INFO3
          </Link>{' '}
          › Examen
        </p>
        <h1 className="text-lg font-semibold">Mode examen</h1>
      </header>
      {!session ? <ExamStart onStart={update} /> : session.phase === 'done' ? <ExamResults session={session} onRestart={() => update(null)} /> : <ExamRunning session={session} onChange={update} />}
    </main>
  )
}

function ExamStart({ onStart }: { onStart(s: ExamSession): void }) {
  const [topic, setTopic] = useState<ExamTopic>(1)
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e6))
  const [minutes, setMinutes] = useState<number>(E.defaultMinutes)
  const [variant, setVariant] = useState<ExamVariant>('mcc')
  const preview = drawSubject(topic, seed, variant, minutes)
  const start = () => {
    const base = blankProject('examen', 'Examen', 'examen')
    const project: Project = variant === 'registres' ? { ...base, files: { 'main.c': REGISTERS_MAIN }, generated: {} } : base
    onStart(startSession(preview, project, nowMs()))
  }
  const field = 'rounded border border-line bg-card px-2 py-1 text-sm'
  return (
    <section className="max-w-xl space-y-3 rounded-card bg-card p-4 ring-1 ring-line" aria-label="Préparer l’épreuve">
      <label className="flex flex-wrap items-center gap-2 text-sm">
        Sujet
        <select aria-label="Sujet" className={field} value={String(topic)} onChange={(e) => setTopic(e.target.value === 'random' ? 'random' : Number(e.target.value))}>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>
              TP{n}
            </option>
          ))}
          <option value="random">Aléatoire</option>
        </select>
      </label>
      <label className="flex flex-wrap items-center gap-2 text-sm">
        Graine
        <input aria-label="Graine" type="number" className={`${field} w-32`} value={seed} onChange={(e) => setSeed(Math.max(0, Math.round(Number(e.target.value) || 0)))} />
      </label>
      <label className="flex flex-wrap items-center gap-2 text-sm">
        Durée (min)
        <input aria-label="Durée en minutes" type="number" min={5} className={`${field} w-24`} value={minutes} onChange={(e) => setMinutes(Math.max(5, Math.round(Number(e.target.value) || E.defaultMinutes)))} />
      </label>
      <fieldset className="flex flex-wrap gap-4 text-sm">
        <legend className="mb-1">Variante</legend>
        {(
          [
            ['mcc', 'Avec MCC'],
            ['registres', 'Registres seuls'],
          ] as const
        ).map(([v, l]) => (
          <label key={v} className="flex items-center gap-1.5">
            <input type="radio" name="variante" checked={variant === v} onChange={() => setVariant(v)} /> {l}
          </label>
        ))}
      </fieldset>
      <p className="text-sm text-muted">
        Sujet (graine {seed}) : {preview.questions.map(label).join(', ')}
      </p>
      <button type="button" className={BTN} onClick={start}>
        Commencer l’épreuve
      </button>
    </section>
  )
}

export function ExamRunning({ session, onChange }: { session: ExamSession; onChange(s: ExamSession): void }) {
  const [now, setNow] = useState(() => Date.now())
  const [selected, setSelected] = useState(session.subject.questions[0])
  const [status, setStatus] = useState<string | null>(null)
  const [dark, setDark] = useState(false)
  const left = remainingS(session, now)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  // Chrono à 0 : remise automatique de la copie
  useEffect(() => {
    if (left <= 0) onChange(submit(session, Date.now()))
  }, [left, session, onChange])
  const setProject = (p: Project) => onChange({ ...session, project: p })
  const verify = () => {
    const errors = examVerify(session.project, selected, session.subject.variant)
    const ok = errors.length === 0
    const s = recordCheck(session, selected, ok)
    onChange(ok ? { ...s, project: { ...s.project, verified: true } } : s)
    setStatus(ok ? 'Configuration conforme.' : `Configuration non conforme : ${errors.length} erreur${errors.length > 1 ? 's' : ''}.`)
  }
  const handIn = async (sim: SimControls) => {
    const files = projectFiles(session.project)
    const v = await sim.grade(selected, files)
    onChange(recordHandIn(session, selected, { ok: v.ok, messages: v.messages, files }))
    setStatus(`Copie de ${label(selected)} enregistrée.`)
  }
  const title = questionTitle(ENONCE, selected)
  const q = INFO3_QUESTIONS.find((x) => x.id === selected)
  return (
    <>
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-card bg-card p-3 ring-1 ring-line">
        <p className="font-mono text-lg font-semibold tabular-nums" role="timer" aria-label="Temps restant">
          {fmtClock(left)}
        </p>
        <p className="text-xs text-muted">
          Graine {session.subject.seed} · {session.subject.variant === 'mcc' ? 'avec MCC' : 'registres seuls'} · {session.subject.questions.length} questions
        </p>
        <button type="button" className={`${BTN} ml-auto`} onClick={() => onChange(submit(session, Date.now()))}>
          Remettre la copie
        </button>
      </div>
      <Workbench
        project={session.project}
        onProject={setProject}
        dark={dark}
        onDarkChange={setDark}
        mccDisabled={session.subject.variant === 'registres'}
        exam
        sideLabel="Sujet"
        side={({ sim }) => (
          <section className="space-y-3 rounded-card bg-card p-3 ring-1 ring-line" aria-label="Sujet">
            <ol className="space-y-0.5">
              {session.subject.questions.map((id) => (
                <li key={id}>
                  <button type="button" onClick={() => setSelected(id)} aria-current={id === selected} className={`w-full rounded px-2 py-1 text-left text-sm ${id === selected ? 'bg-card-2 font-semibold' : 'hover:bg-card-2'}`}>
                    {label(id)}
                    {session.handIns[id] ? ' · copie rendue' : ''}
                  </button>
                </li>
              ))}
            </ol>
            <article className="space-y-2 border-t border-line pt-3">
              <h2 className="text-sm font-semibold">
                {label(selected)}
                {q?.hyp.map((h) => (
                  <span key={h} className="ml-1 inline-block rounded bg-warn/10 px-1 text-[10px] font-semibold text-warn ring-1 ring-warn/30">
                    valeur non vérifiée ({h})
                  </span>
                ))}
              </h2>
              {title && <Markdown text={title} />}
              <div className="flex flex-wrap gap-2">
                <button type="button" className={BTN} onClick={verify}>
                  Faire vérifier
                </button>
                <button type="button" className={BTN} onClick={() => void handIn(sim)}>
                  Rendre la question
                </button>
              </div>
              {status && (
                <p role="status" className="text-sm">
                  {status}
                </p>
              )}
            </article>
          </section>
        )}
      />
    </>
  )
}

function ExamResults({ session, onRestart }: { session: ExamSession; onRestart(): void }) {
  const sheet = examSheet(session)
  const [corr, setCorr] = useState<typeof import('../../info3/exam/corrections') | null>(null)
  useEffect(() => {
    void import('../../info3/exam/corrections').then(setCorr)
  }, [])
  return (
    <section className="space-y-3" aria-label="Feuille de notes">
      <div className="rounded-card bg-card p-4 ring-1 ring-line">
        <p className="text-2xl font-semibold tabular-nums">
          {pts(sheet.note)} / {E.scale}
        </p>
        <p className="text-sm text-muted">
          Graine {session.subject.seed} · temps utilisé {fmtClock(sheet.usedS)} · points {pts(sheet.raw)} − pénalités {pts(sheet.penalties.points)} ({sheet.penalties.count} manipulation{sheet.penalties.count > 1 ? 's' : ''} sous tension)
        </p>
        <div className="mt-3 max-w-full overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead>
              <tr>
                {['Question', 'Configuration', 'Défi', 'Points'].map((h) => (
                  <th key={h} className="border-b border-line px-2 py-1">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sheet.lines.map((l) => (
                <tr key={l.id}>
                  <td className="border-b border-line px-2 py-1">{label(l.id)}</td>
                  <td className="border-b border-line px-2 py-1">
                    {l.config.ok ? `conforme au ${l.config.attempts === 1 ? '1er' : `${l.config.attempts}e`} essai` : l.config.attempts ? `${l.config.attempts} essai(s), non conforme` : 'non vérifiée'} · {pts(l.config.points)}
                  </td>
                  <td className="border-b border-line px-2 py-1">
                    {l.question.status} · {pts(l.question.points)}
                  </td>
                  <td className="border-b border-line px-2 py-1 tabular-nums">{pts(l.points)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" className={`${BTN} mt-3`} onClick={onRestart}>
          Nouvelle épreuve
        </button>
      </div>
      {sheet.lines.map((l) => (
        <details key={l.id} open={showCorrectionByDefault(l)} className="rounded-card bg-card p-3 ring-1 ring-line">
          <summary className="cursor-pointer text-sm font-semibold">
            Correction — {label(l.id)} ({l.question.status})
          </summary>
          <div className="mt-2 space-y-2 text-sm">
            {session.handIns[l.id] && (
              <div>
                <p className="font-semibold">Verdict du professeur sur la copie remise :</p>
                <ul className="list-disc pl-5">
                  {session.handIns[l.id].messages.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            )}
            {corr?.explanations(l.id, session.project).map((x) => (
              <p key={x}>{x}</p>
            ))}
            <p className="text-muted">Voir {coursePageOf(l.id)}.</p>
            <pre className="max-h-80 overflow-auto rounded bg-screen p-2 text-xs text-[#d8e2dc]">{corr ? corr.referenceCode(l.id) : 'Chargement…'}</pre>
          </div>
        </details>
      ))}
    </section>
  )
}
