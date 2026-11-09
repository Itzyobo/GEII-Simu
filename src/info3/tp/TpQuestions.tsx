/**
 * Questions des TP2 et TP3 : liste avec état, intitulé (ancre de l'énoncé, sinon résumé du PRD), badges Hx,
 * puis les parties de la question (content23.ts). La question est réussie quand toutes ses parties le sont.
 */
import { useState } from 'react'
import { INFO3_QUESTIONS, type Info3Question } from '../../data/questions'
import { INFO3 } from '../../data/reference'
import { projectFiles, type Project } from '../project/project'
import type { Progress, QuestionState } from '../project/storage'
import type { Tp23QuestionId } from '../project/verify23'
import { enonceMissing, parseRegisterAnswer, questionTitle as titleIn } from '../tp1/content'
import type { SimControls } from '../ui/useSim'
import { partsOf, type Choice, type NumField, type Part } from './content23'

export interface TpQuestionsProps {
  tp: number
  project: Project
  sim: SimControls
  enonce: string
  progress: Progress
  onResult(id: string, state: QuestionState, answer?: string): void
  selected: Tp23QuestionId
  onSelect(id: Tp23QuestionId): void
}

const icon = (s?: QuestionState) => (s === 'passed' ? '✓' : s === 'failed' ? '✗' : '○')
const iconColor = (s?: QuestionState) => (s === 'passed' ? 'text-ok' : s === 'failed' ? 'text-err' : 'text-muted')
const BTN = 'rounded-lg bg-accent px-3 py-1 text-sm font-semibold text-on-accent disabled:opacity-40'

function Badges({ q }: { q: Info3Question }) {
  return (
    <>
      {q.hyp.map((h) => {
        const hyp = INFO3.hypotheses.find((x) => x.id === h)
        return (
          <span key={h} className="ml-1 inline-block rounded bg-warn/10 px-1 text-[10px] font-semibold text-warn ring-1 ring-warn/30" title={hyp ? `${h} : ${hyp.texte}` : h}>
            valeur non vérifiée ({h})
          </span>
        )
      })}
    </>
  )
}

export default function TpQuestions({ tp, project, sim, enonce, progress, onResult, selected, onSelect }: TpQuestionsProps) {
  const list = INFO3_QUESTIONS.filter((q) => q.tp === tp)
  const title = (id: string) => (enonceMissing(enonce) ? null : titleIn(enonce, id))
  const q = list.find((x) => x.id === selected) ?? list[0]
  const t = title(q.id)
  return (
    <section className="space-y-3 rounded-card bg-card p-3 ring-1 ring-line" aria-label={`Questions du TP${tp}`}>
      <h2 className="text-sm font-semibold">Questions</h2>
      <ol className="space-y-0.5">
        {list.map((x) => (
          <li key={x.id}>
            <button type="button" onClick={() => onSelect(x.id as Tp23QuestionId)} aria-current={x.id === selected} className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm ${x.id === selected ? 'bg-card-2 font-semibold' : 'hover:bg-card-2'}`}>
              <span className={`w-4 text-center ${iconColor(progress[x.id]?.state)}`} aria-label={progress[x.id]?.state ?? 'à faire'}>
                {icon(progress[x.id]?.state)}
              </span>
              <span className="tabular-nums">{x.numero}</span>
              <span className="truncate text-muted">{title(x.id)?.split('\n')[0] ?? x.resume}</span>
            </button>
          </li>
        ))}
      </ol>
      <article className="space-y-3 border-t border-line pt-3" id={q.id}>
        <h3 className="text-sm font-semibold">
          TP{tp} {q.numero}
          <Badges q={q} />
        </h3>
        {t ? (
          <p className="whitespace-pre-line text-sm">{t}</p>
        ) : (
          <p className="text-sm">
            <span className="text-muted">Intitulé à transcrire depuis l’énoncé (PDF absent) — résumé du PRD : </span>
            {q.resume}
          </p>
        )}
        <Parts key={q.id} id={q.id as Tp23QuestionId} project={project} sim={sim} onResult={onResult} />
      </article>
    </section>
  )
}

type Verdict = { ok: boolean; messages: string[] }

function VerdictBox({ v }: { v: Verdict | null }) {
  if (!v) return null
  return (
    <div role="status" className={`rounded-lg px-3 py-2 text-sm ring-1 ${v.ok ? 'bg-ok/10 text-ok ring-ok/30' : 'bg-err/10 text-err ring-err/30'}`}>
      <p className="font-semibold">{v.ok ? 'Validé' : 'Refusé'}</p>
      <ul className="list-disc pl-5">
        {v.messages.map((m, i) => (
          <li key={i}>{m}</li>
        ))}
      </ul>
    </div>
  )
}

function Parts({ id, project, sim, onResult }: { id: Tp23QuestionId; project: Project; sim: SimControls; onResult: TpQuestionsProps['onResult'] }) {
  const parts = partsOf(id, project)
  const [results, setResults] = useState<(boolean | null)[]>(() => parts.map(() => null))
  const report = (i: number, ok: boolean) => {
    const next = results.map((x, j) => (j === i ? ok : x))
    setResults(next)
    if (next.every((x) => x === true)) onResult(id, 'passed')
    else if (!ok) onResult(id, 'failed')
  }
  return (
    <div className="space-y-3">
      {parts.map((part, i) => (
        <div key={i} className={i ? 'border-t border-line pt-3' : ''}>
          <PartView part={part} id={id} project={project} sim={sim} onDone={(ok) => report(i, ok)} />
        </div>
      ))}
    </div>
  )
}

function PartView({ part, id, project, sim, onDone }: { part: Part; id: Tp23QuestionId; project: Project; sim: SimControls; onDone(ok: boolean): void }) {
  switch (part.kind) {
    case 'grade':
      return <GradeBlock id={id} project={project} sim={sim} onDone={onDone} />
    case 'qcm':
      return <ChoiceBlock qcm={part.qcm} onDone={onDone} />
    case 'numeric':
      return part.fields ? <NumericBlock prompt={part.prompt} fields={part.fields} onDone={onDone} /> : <p className="text-sm text-muted">{part.missing}</p>
    case 'order':
      return <OrderBlock prompt={part.prompt} correct={part.correct} shuffled={part.shuffled} onDone={onDone} />
    case 'checklist':
      return <ChecklistBlock items={part.items} onDone={onDone} />
  }
}

function GradeBlock({ id, project, sim, onDone }: { id: string; project: Project; sim: SimControls; onDone(ok: boolean): void }) {
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [busy, setBusy] = useState(false)
  const grade = async () => {
    if (!project.generated) {
      setVerdict({ ok: false, messages: ['Generate n’a pas été fait : configurer MCC puis cliquer sur Generate'] })
      return
    }
    setBusy(true)
    const v = await sim.grade(id, projectFiles(project))
    setBusy(false)
    setVerdict(v)
    onDone(v.ok)
  }
  return (
    <div className="space-y-2">
      <button type="button" disabled={busy} onClick={() => void grade()} className={BTN}>
        {busy ? 'Vérification…' : 'Vérifier mon programme'}
      </button>
      <VerdictBox v={verdict} />
    </div>
  )
}

function ChoiceBlock({ qcm, onDone }: { qcm: Choice; onDone(ok: boolean): void }) {
  const [chosen, setChosen] = useState<string[]>([])
  const [shown, setShown] = useState<boolean | null>(null)
  const toggle = (o: string) => setChosen((c) => (qcm.multi ? (c.includes(o) ? c.filter((x) => x !== o) : [...c, o]) : [o]))
  return (
    <fieldset className="space-y-1">
      <legend className="text-sm">
        {qcm.prompt}
        {qcm.multi && <span className="text-muted"> (une ou plusieurs réponses)</span>}
      </legend>
      {qcm.options.map((o) => (
        <label key={o} className="flex items-start gap-2 text-sm">
          <input type={qcm.multi ? 'checkbox' : 'radio'} name={qcm.prompt} checked={chosen.includes(o)} onChange={() => toggle(o)} className="mt-1" />
          <span className="leading-5">{o}</span>
        </label>
      ))}
      <button
        type="button"
        disabled={!chosen.length}
        onClick={() => {
          const ok = chosen.length === qcm.answers.length && qcm.answers.every((a) => chosen.includes(a))
          setShown(ok)
          onDone(ok)
        }}
        className={BTN}
      >
        Valider
      </button>
      {shown !== null && <VerdictBox v={{ ok: shown, messages: [shown ? qcm.explanation : 'Réponse incorrecte, réessayer.'] }} />}
    </fieldset>
  )
}

function NumericBlock({ prompt, fields, onDone }: { prompt: string; fields: NumField[]; onDone(ok: boolean): void }) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [checked, setChecked] = useState(false)
  const value = (f: NumField) => {
    const s = answers[f.label] ?? ''
    if (f.register) return parseRegisterAnswer(s)
    if (f.tolerance !== undefined) return /^\s*\d+(?:[.,]\d+)?\s*$/.test(s) ? Number(s.replace(',', '.')) : null
    return /^\s*\d+\s*$/.test(s) ? Number(s) : null
  }
  /** Valeur exacte, ou mesure dans la tolérance */
  const correct = (f: NumField) => {
    const v = value(f)
    if (v === null) return false
    return f.tolerance !== undefined ? Math.abs(v - f.expected) / f.expected <= f.tolerance : v === f.expected
  }
  return (
    <div className="space-y-1">
      <p className="text-sm">{prompt}</p>
      {fields.map((f) => {
        const ok = correct(f)
        return (
          <label key={f.label} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="min-w-0 font-mono">{f.label}</span>
            <input value={answers[f.label] ?? ''} onChange={(e) => setAnswers((a) => ({ ...a, [f.label]: e.target.value }))} placeholder={f.register ? '0x..' : ''} className="w-24 rounded border border-line bg-field px-2 py-0.5 font-mono" />
            {checked && <span className={ok ? 'text-ok' : 'text-err'}>{ok ? '✓' : '✗'}</span>}
          </label>
        )
      })}
      <button
        type="button"
        onClick={() => {
          setChecked(true)
          onDone(fields.every(correct))
        }}
        className="rounded-lg bg-card px-3 py-1 text-sm ring-1 ring-line hover:bg-card-2"
      >
        Vérifier les valeurs
      </button>
    </div>
  )
}

function OrderBlock({ prompt, correct, shuffled, onDone }: { prompt: string; correct: string[]; shuffled: string[]; onDone(ok: boolean): void }) {
  const [order, setOrder] = useState(shuffled)
  const [result, setResult] = useState<boolean | null>(null)
  const move = (i: number, d: -1 | 1) =>
    setOrder((o) => {
      const n = [...o]
      const j = i + d
      if (j < 0 || j >= n.length) return o
      ;[n[i], n[j]] = [n[j], n[i]]
      return n
    })
  return (
    <div className="space-y-2">
      <p className="text-sm">{prompt}</p>
      <ol className="space-y-1">
        {order.map((b, i) => (
          <li key={b} className="flex items-center gap-2 rounded bg-field px-2 py-1 text-sm ring-1 ring-line">
            <span className="w-4 tabular-nums text-muted">{i + 1}</span>
            <span className="min-w-0 flex-1 break-words font-mono text-xs">{b}</span>
            <button type="button" aria-label={`Monter « ${b} »`} onClick={() => move(i, -1)} className="px-1">
              ↑
            </button>
            <button type="button" aria-label={`Descendre « ${b} »`} onClick={() => move(i, 1)} className="px-1">
              ↓
            </button>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={() => {
          const ok = order.every((x, i) => x === correct[i])
          setResult(ok)
          onDone(ok)
        }}
        className={BTN}
      >
        Valider l’ordre
      </button>
      {result !== null && <VerdictBox v={{ ok: result, messages: [result ? 'Chaîne d’appel correcte.' : 'Ordre incorrect.'] }} />}
    </div>
  )
}

function ChecklistBlock({ items, onDone }: { items: string[]; onDone(ok: boolean): void }) {
  const [done, setDone] = useState<boolean[]>(() => items.map(() => false))
  return (
    <div className="space-y-1">
      <p className="text-sm">Liste de contrôle du débogage (cocher chaque étape réalisée sur le banc) :</p>
      {items.map((it, i) => (
        <label key={it} className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={done[i]}
            onChange={(e) => {
              const next = done.map((x, j) => (j === i ? e.target.checked : x))
              setDone(next)
              if (next.every(Boolean)) onDone(true)
            }}
          />
          <span>{it}</span>
        </label>
      ))}
    </div>
  )
}
