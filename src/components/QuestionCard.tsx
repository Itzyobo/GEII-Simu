import { useEffect, useId, useState, type FormEvent } from 'react'
import { isCorrect, parseAnswer } from '../lib/grading'
import { expectedTextOf, useExam } from '../lib/exam'
import { useQuestionFocus } from '../lib/focus'
import { recordAttempt } from '../lib/progress'
import UnverifiedBadge from './UnverifiedBadge'

type QuestionCardProps = {
  /** Identifiant stable (registre src/data/questions.ts) : progression, examen, liens « revoir » */
  id: string
  /** Numéro affiché (ex. « Q4 ») */
  label?: string
  statement: string
  explanation: string
  /** Constantes « hypothèse » dont dépend la réponse dans le contexte courant (en plus du registre) */
  unverified?: string[]
} & (
  | {
      /** Réponse numérique (type par défaut) */
      kind?: 'numerique'
      expected: number
      unit: string
      /** Tolérance relative, ±5 % par défaut */
      tolerance?: number
    }
  | {
      /** QCM : une seule bonne réponse */
      kind: 'choix'
      choices: readonly string[]
      /** Index de la bonne réponse dans `choices` */
      correct: number
    }
)

const fr = (x: number) => String(Number(x.toPrecision(4))).replace('.', ',')

/**
 * Question corrigée (numérique à ±tolérance ou QCM).
 * Entraînement : verdict + explication. Examen : réponse enregistrée sans verdict.
 */
export default function QuestionCard(props: QuestionCardProps) {
  const { id: qid, label, statement, explanation } = props
  const inputId = useId()
  const exam = useExam()
  const { ref, focused } = useQuestionFocus<HTMLFormElement>(qid)
  const [input, setInput] = useState('')
  const [picked, setPicked] = useState<number | null>(null)
  const [result, setResult] = useState<'ok' | 'ko' | 'nan' | null>(null)
  const saved = exam.active ? exam.answerOf(qid) : undefined

  const expectedText = expectedTextOf(props)

  const { active, register } = exam
  useEffect(() => {
    if (active) register(qid, { expected: expectedText, explanation })
  }, [active, register, qid, expectedText, explanation])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    let ok: boolean
    let given: string
    let gap: string | undefined
    if (props.kind === 'choix') {
      if (picked === null) return setResult('nan')
      ok = picked === props.correct
      given = props.choices[picked]
    } else {
      const v = parseAnswer(input)
      if (Number.isNaN(v)) return setResult('nan')
      ok = isCorrect(v, props.expected, props.tolerance ?? 0.05)
      given = `${fr(v)} ${props.unit}`.trim()
      if (props.expected !== 0) {
        const pct = Math.round(((v - props.expected) / Math.abs(props.expected)) * 1000) / 10 // évite « -0,0 % »
        gap = `${pct > 0 ? '+' : ''}${(pct === 0 ? 0 : pct).toFixed(1).replace('.', ',')} %`
      }
    }
    recordAttempt(qid, ok)
    if (exam.active) exam.record({ id: qid, given, expected: expectedText, gap, score: ok ? 1 : 0, explanation })
    setResult(ok ? 'ok' : 'ko')
  }

  const reset = () => setResult(null)

  return (
    <form
      ref={ref}
      id={`q-${qid}`}
      onSubmit={submit}
      className={`scroll-mt-24 rounded-card bg-card shadow-sm shadow-black/[0.03] p-4 ring-1 ${focused ? 'ring-2 ring-accent' : 'ring-line'}`}
    >
      {props.kind === 'choix' ? (
        <fieldset>
          <legend className="text-sm">
            {label && <span className="mr-2 font-semibold text-accent">{label}</span>}
            {statement}
            <UnverifiedBadge id={qid} extra={props.unverified} />
          </legend>
          <div className="mt-3 grid gap-1.5">
            {props.choices.map((c, i) => (
              <label key={c} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-card-2">
                <input
                  type="radio"
                  name={inputId}
                  checked={picked === i}
                  onChange={() => {
                    setPicked(i)
                    reset()
                  }}
                  className="h-4 w-4 accent-[var(--color-accent)]"
                />
                {c}
              </label>
            ))}
          </div>
          <button type="submit" className="mt-3 min-h-11 rounded-lg bg-card-2 px-4 py-1.5 text-sm font-medium ring-1 ring-line hover:ring-accent">
            {exam.active ? 'Enregistrer' : 'Valider'}
          </button>
        </fieldset>
      ) : (
        <>
          <label htmlFor={inputId} className="block text-sm">
            {label && <span className="mr-2 font-semibold text-accent">{label}</span>}
            {statement}
            <UnverifiedBadge id={qid} extra={props.unverified} />
          </label>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              id={inputId}
              inputMode="decimal"
              autoComplete="off"
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                reset()
              }}
              className="min-h-11 w-36 rounded-lg bg-field px-3 py-1.5 font-mono text-sm ring-1 ring-line outline-none focus:ring-accent"
            />
            <span className="font-mono text-sm text-muted">{props.unit}</span>
            <button type="submit" className="min-h-11 rounded-lg bg-card-2 px-4 py-1.5 text-sm font-medium ring-1 ring-line hover:ring-accent">
              {exam.active ? 'Enregistrer' : 'Valider'}
            </button>
            {!exam.active && <span className="text-xs text-muted">tolérance ±{Math.round((props.tolerance ?? 0.05) * 100)} %</span>}
          </div>
        </>
      )}
      {result === 'nan' && (
        <p className="mt-2 text-sm text-err">{props.kind === 'choix' ? 'Choisissez une réponse.' : 'Entrez une valeur numérique (ex. 22,7).'}</p>
      )}
      {exam.active
        ? saved && <p className="mt-2 text-sm text-muted">Réponse enregistrée : <span className="font-mono text-ink">{saved.given}</span></p>
        : (result === 'ok' || result === 'ko') && (
            <div className="mt-3 rounded-lg bg-card-2 px-3 py-2 text-sm" role="status">
              <p className={`font-semibold ${result === 'ok' ? 'text-ok' : 'text-err'}`}>
                {result === 'ok' ? 'Correct' : `Faux — ${props.kind === 'choix' ? 'bonne réponse' : 'valeur attendue'} : ${expectedText}`}
              </p>
              <p className="mt-1 text-muted">{explanation}</p>
            </div>
          )}
    </form>
  )
}
