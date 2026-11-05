/**
 * Questions du TP1 : liste avec leur état, intitulé lu dans l'énoncé (ancre), badges Hx, vérification.
 * Défis de code et contrôles statiques : professeur virtuel dans le Worker (sim.grade).
 * QCM, questions numériques et mise en ordre : réponses calculées (content.ts).
 */
import { useState } from 'react'
import { INFO3_QUESTIONS, type Info3Question } from '../../data/questions'
import { INFO3 } from '../../data/reference'
import { projectFiles, type Project } from '../project/project'
import type { Progress, QuestionState } from '../project/storage'
import { verifyTp1, type Tp1QuestionId } from '../project/verify'
import type { SimControls } from '../ui/useSim'
import { enonceMissing, orderIsCorrect, parseRegisterAnswer, qcm31, qcm32, qcm34, questionTitle as titleIn, registersOf, shuffledBlocks, type Qcm } from './content'

const TP1 = INFO3_QUESTIONS.filter((q) => q.tp === 1)

export interface QuestionsPanelProps {
  project: Project
  sim: SimControls
  enonce: string
  progress: Progress
  onResult(id: string, state: QuestionState, answer?: string): void
  selected: Tp1QuestionId
  onSelect(id: Tp1QuestionId): void
}

const icon = (s?: QuestionState) => (s === 'passed' ? '✓' : s === 'failed' ? '✗' : '○')
const iconColor = (s?: QuestionState) => (s === 'passed' ? 'text-ok' : s === 'failed' ? 'text-err' : 'text-muted')

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

export default function QuestionsPanel({ project, sim, enonce, progress, onResult, selected, onSelect }: QuestionsPanelProps) {
  // Énoncé non transcrit : aucun intitulé n'est lu dans le fichier d'attente
  const questionTitle = (md: string, id: string) => (enonceMissing(md) ? null : titleIn(md, id))
  const q = TP1.find((x) => x.id === selected) ?? TP1[0]
  const title = questionTitle(enonce, q.id)
  return (
    <section className="space-y-3 rounded-card bg-card p-3 ring-1 ring-line" aria-label="Questions du TP1">
      <h2 className="text-sm font-semibold">Questions</h2>
      <ol className="space-y-0.5">
        {TP1.map((x) => (
          <li key={x.id}>
            <button type="button" onClick={() => onSelect(x.id as Tp1QuestionId)} aria-current={x.id === selected} className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm ${x.id === selected ? 'bg-card-2 font-semibold' : 'hover:bg-card-2'}`}>
              <span className={`w-4 text-center ${iconColor(progress[x.id]?.state)}`} aria-label={progress[x.id]?.state ?? 'à faire'}>
                {icon(progress[x.id]?.state)}
              </span>
              <span className="tabular-nums">{x.numero}</span>
              <span className="truncate text-muted">{questionTitle(enonce, x.id)?.split('\n')[0] ?? x.resume}</span>
              {x.bonus && <span className="ml-auto text-[10px] text-muted">bonus</span>}
            </button>
          </li>
        ))}
      </ol>

      <article className="space-y-2 border-t border-line pt-3" id={q.id}>
        <h3 className="text-sm font-semibold">
          TP1 {q.numero}
          <Badges q={q} />
        </h3>
        {title ? (
          <p className="whitespace-pre-line text-sm">{title}</p>
        ) : (
          <p className="text-sm">
            <span className="text-muted">Intitulé à transcrire depuis l’énoncé (PDF absent) — résumé du PRD : </span>
            {q.resume}
          </p>
        )}
        <QuestionBody key={q.id} q={q} project={project} sim={sim} onResult={onResult} saved={progress[q.id]?.answer} />
      </article>
    </section>
  )
}

function Verdict({ v }: { v: { ok: boolean; messages: string[] } | null }) {
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

function QcmBlock({ qcm, onDone, saved }: { qcm: Qcm; onDone(ok: boolean, answer: string): void; saved?: string }) {
  const [choice, setChoice] = useState<string | null>(saved ?? null)
  const [shown, setShown] = useState<boolean | null>(null)
  return (
    <fieldset className="space-y-1">
      <legend className="text-sm">{qcm.prompt}</legend>
      {qcm.options.map((o) => (
        <label key={o} className="flex items-start gap-2 text-sm">
          <input type="radio" name={qcm.prompt} checked={choice === o} onChange={() => setChoice(o)} className="mt-1" />
          <span className="font-mono text-xs leading-5">{o}</span>
        </label>
      ))}
      <button
        type="button"
        disabled={!choice}
        onClick={() => {
          const ok = choice === qcm.answer
          setShown(ok)
          onDone(ok, choice!)
        }}
        className="rounded-lg bg-accent px-3 py-1 text-sm font-semibold text-on-accent disabled:opacity-40"
      >
        Valider
      </button>
      {shown !== null && <Verdict v={{ ok: shown, messages: [shown ? qcm.explanation : 'Réponse incorrecte, réessayer.'] }} />}
    </fieldset>
  )
}

function QuestionBody({ q, project, sim, onResult, saved }: { q: Info3Question; project: Project; sim: SimControls; onResult: QuestionsPanelProps['onResult']; saved?: string }) {
  const [verdict, setVerdict] = useState<{ ok: boolean; messages: string[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const done = (ok: boolean, answer?: string) => onResult(q.id, ok ? 'passed' : 'failed', answer)

  const grade = async () => {
    if (!project.generated) {
      setVerdict({ ok: false, messages: ['Generate n’a pas été fait : configurer MCC puis cliquer sur Generate'] })
      return
    }
    setBusy(true)
    const v = await sim.grade(q.id, projectFiles(project))
    setBusy(false)
    setVerdict(v)
    done(v.ok)
  }
  const gradeButton = (
    <button type="button" disabled={busy} onClick={() => void grade()} className="rounded-lg bg-accent px-3 py-1 text-sm font-semibold text-on-accent disabled:opacity-40">
      {busy ? 'Vérification…' : 'Vérifier mon programme'}
    </button>
  )

  switch (q.kind) {
    case 'qcm':
      return <QcmBlock qcm={qcm31()} saved={saved} onDone={(ok, a) => done(ok, a)} />
    case 'config-qcm': {
      const errors = verifyTp1(project, q.id as Tp1QuestionId)
      const qcm = qcm32(project)
      return (
        <div className="space-y-2">
          <p className="text-sm font-medium">Configuration</p>
          {errors.length ? (
            <ul className="list-disc pl-5 text-sm text-err">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ok">Configuration MCC conforme.</p>
          )}
          {qcm ? <QcmBlock qcm={qcm} saved={saved} onDone={(ok, a) => done(ok && errors.length === 0, a)} /> : <p className="text-sm text-muted">Le QCM apparaît après Generate (il lit votre pin_manager.h).</p>}
        </div>
      )
    }
    case 'challenge':
    case 'static':
      return (
        <div className="space-y-2">
          {gradeButton}
          <Verdict v={verdict} />
        </div>
      )
    case 'challenge-numeric':
      return (
        <div className="space-y-3">
          {gradeButton}
          <Verdict v={verdict} />
          <NumericRegisters project={project} />
          <QcmBlock qcm={qcm34()} saved={saved} onDone={(ok, a) => done(ok && verdict?.ok === true, a)} />
        </div>
      )
    case 'order':
      return <OrderBlock onDone={(ok) => done(ok)} />
  }
}

/** 3.4 : valeurs de TRISB et ANSELB lues dans le pin_manager.c généré de l'étudiant */
function NumericRegisters({ project }: { project: Project }) {
  const regs = ['TRISB', 'ANSELB']
  const expected = registersOf(project, regs)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [checked, setChecked] = useState(false)
  if (!expected) return <p className="text-sm text-muted">Les valeurs de TRISB et ANSELB se lisent dans pin_manager.c après Generate.</p>
  return (
    <div className="space-y-1">
      <p className="text-sm">Valeurs écrites par votre pin_manager.c :</p>
      {regs.map((r) => {
        const v = parseRegisterAnswer(answers[r] ?? '')
        const ok = v !== null && v === expected[r]
        return (
          <label key={r} className="flex items-center gap-2 text-sm">
            <span className="w-16 font-mono">{r} =</span>
            <input value={answers[r] ?? ''} onChange={(e) => setAnswers((a) => ({ ...a, [r]: e.target.value }))} placeholder="0x.." className="w-24 rounded border border-line bg-field px-2 py-0.5 font-mono" />
            {checked && <span className={ok ? 'text-ok' : 'text-err'}>{ok ? '✓' : `✗ attendu 0x${expected[r].toString(16).toUpperCase().padStart(2, '0')}`}</span>}
          </label>
        )
      })}
      <button type="button" onClick={() => setChecked(true)} className="rounded-lg bg-card px-3 py-1 text-sm ring-1 ring-line hover:bg-card-2">
        Vérifier les valeurs
      </button>
    </div>
  )
}

/** 4.1 : mise en ordre des blocs de l'architecture */
function OrderBlock({ onDone }: { onDone(ok: boolean): void }) {
  const [order, setOrder] = useState(shuffledBlocks)
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
      <p className="text-sm">Remettre les blocs dans l’ordre d’exécution :</p>
      <ol className="space-y-1">
        {order.map((b, i) => (
          <li key={b} className="flex items-center gap-2 rounded bg-field px-2 py-1 text-sm ring-1 ring-line">
            <span className="w-4 tabular-nums text-muted">{i + 1}</span>
            <span className="flex-1">{b}</span>
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
          const ok = orderIsCorrect(order)
          setResult(ok)
          onDone(ok)
        }}
        className="rounded-lg bg-accent px-3 py-1 text-sm font-semibold text-on-accent"
      >
        Valider l’ordre
      </button>
      {result !== null && <Verdict v={{ ok: result, messages: [result ? 'Architecture correcte.' : 'Ordre incorrect.'] }} />}
    </div>
  )
}
