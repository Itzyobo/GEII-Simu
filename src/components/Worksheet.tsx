/** Briques communes des feuilles de calcul notées (tableaux de relevés, sections de calcul). */
import { useEffect, useState, type ReactNode } from 'react'
import { useExam } from '../lib/exam'
import { useQuestionFocus } from '../lib/focus'
import { isCorrect, parseAnswer } from '../lib/grading'
import { recordAttempt } from '../lib/progress'
import UnverifiedBadge from './UnverifiedBadge'

/** Tolérances : calculs vérifiés à ±3 % depuis les saisies, lectures à ±5 % du simulateur. */
export const TOL_CALC = 0.03
export const TOL_READ = 0.05

export const num = (s: string | undefined) => parseAnswer(s ?? '')

export interface Check {
  expected: number
  tol: number
}
export const cellOk = (value: string | undefined, c: Check) => Number.isFinite(c.expected) && isCorrect(num(value), c.expected, c.tol)

/**
 * Notation d'un tableau : en entraînement, coloration des cases + progression ;
 * en examen, la fraction de cases justes est enregistrée comme une question.
 */
export function useTableGrading(id: string, explanation: string) {
  const exam = useExam()
  const [checked, setChecked] = useState(false)
  const { active, register } = exam
  useEffect(() => {
    if (active) register(id, { expected: 'toutes les cases justes', explanation })
  }, [active, register, id, explanation])
  const submit = (cells: { value: string | undefined; check: Check }[]) => {
    const ok = cells.filter((c) => cellOk(c.value, c.check)).length
    recordAttempt(id, ok === cells.length)
    if (exam.active)
      exam.record({ id, given: `${ok}/${cells.length} cases justes`, expected: 'toutes les cases justes', score: ok / cells.length, explanation })
    else setChecked(true)
  }
  const saved = exam.active ? exam.answerOf(id) : undefined
  return { checked: checked && !exam.active, setChecked, submit, saved, exam: exam.active }
}

/** Champ de saisie ; une fois vérifié (hors examen), cadre vert/rouge selon `check`. */
export function Cell({ value, onChange, check, checked, label, calc }: { value: string; onChange: (v: string) => void; check?: Check; checked: boolean; label: string; calc?: boolean }) {
  const show = checked && check !== undefined && Number.isFinite(check.expected)
  const ok = show && cellOk(value, check)
  return (
    <input
      aria-label={label}
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      title={show && !ok ? `Attendu ≈ ${Number(check.expected.toPrecision(4))}` : undefined}
      className={`min-h-11 w-20 rounded-md px-1.5 py-1 text-right font-mono text-xs ring-1 outline-none focus:ring-accent ${calc ? 'bg-[#1d1a12]' : 'bg-[#17191c]'} ${show ? (ok ? 'ring-ok' : 'ring-err') : 'ring-line'}`}
    />
  )
}

export function GradeBar({ exam, saved, onSubmit, label, children }: { exam: boolean; saved?: { given: string }; onSubmit: () => void; label: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={onSubmit} className="min-h-11 rounded-lg bg-card-2 px-3 py-1.5 text-sm font-medium ring-1 ring-line hover:ring-accent">
        {exam ? 'Enregistrer le tableau' : label}
      </button>
      {children}
      {saved && <span className="text-xs text-muted">Tableau enregistré.</span>}
    </div>
  )
}

/** Section d'exercice : intitulé + contenu, ciblable par ?q=id. */
export function Exercise({ id, label, statement, children }: { id: string; label: string; statement: string; children: ReactNode }) {
  const { ref, focused } = useQuestionFocus<HTMLElement>(id)
  return (
    <section ref={ref} id={`q-${id}`} className={`scroll-mt-24 rounded-card bg-card p-4 ring-1 ${focused ? 'ring-2 ring-accent' : 'ring-line'}`}>
      <p className="mb-3 text-sm">
        <span className="mr-2 font-semibold text-accent">{label}</span>
        {statement}
        <UnverifiedBadge id={id} />
      </p>
      {children}
    </section>
  )
}
