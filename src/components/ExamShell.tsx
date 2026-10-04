import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { LABEL_OF, QUESTIONS, type TpSlug } from '../data/questions'
import { ExamContext, examNote, penaltyPoints, type ExamAnswer, type ExamApi, type Penalty, type PenaltyKind, type QuestionMeta } from '../lib/exam'
import { recordExam } from '../lib/progress'
import { loadAnswerKey } from '../lib/answerKeys'
import { clearExamSession, loadExamSession, saveExamSession } from '../lib/examSession'

interface ShellTp {
  slug: TpSlug
  title: string
}

interface ExamShellProps {
  /** TP de la session (un seul en entraînement, trois pour l'examen blanc) */
  tps: ShellTp[]
  minutes: number
  /** « blanc » ou slug du TP, pour l'historique */
  kind: string
  /** Démarre directement en examen (examen blanc) */
  autoStart?: boolean
  render: (tp: ShellTp) => ReactNode
}

type Phase = 'training' | 'exam' | 'results'

const fr = (x: number, d = 1) => x.toFixed(d).replace('.', ',')
const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(sec).padStart(2, '0')}`
}

/**
 * Coquille d'une page TP : bandeau entraînement / examen, chrono, remise et résultats.
 * Fournit le contexte d'examen lu par QuestionCard, les tableaux et le câblage.
 */
export default function ExamShell({ tps, minutes, kind, autoStart, render }: ExamShellProps) {
  // Reprise après rechargement : examen en cours ou résultats sauvegardés dans sessionStorage
  const [saved] = useState(() => loadExamSession(kind))
  const [phase, setPhase] = useState<Phase>(saved?.phase ?? (autoStart ? 'exam' : 'training'))
  const [examId, setExamId] = useState(saved?.examId ?? 0)
  const [index, setIndex] = useState(saved?.index ?? 0)
  const [answers, setAnswers] = useState<Record<string, ExamAnswer>>(saved?.answers ?? {})
  const [meta, setMeta] = useState<Record<string, QuestionMeta>>(saved?.meta ?? {})
  const [penalties, setPenalties] = useState<Partial<Record<TpSlug, Penalty[]>>>(saved?.penalties ?? {})
  const [endAt, setEndAt] = useState(() => saved?.endAt ?? Date.now() + minutes * 60_000)
  const [now, setNow] = useState(() => Date.now())
  const [confirmHand, setConfirmHand] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const tp = tps[index]

  useEffect(() => {
    if (phase === 'training') clearExamSession(kind)
    else saveExamSession(kind, { phase, examId, index, endAt, answers, meta, penalties, order: tps.map((t) => t.slug) })
  }, [kind, phase, examId, index, endAt, answers, meta, penalties, tps])

  const start = () => {
    setExamId((k) => k + 1)
    setIndex(0)
    setAnswers({})
    setMeta({})
    setPenalties({})
    setEndAt(Date.now() + minutes * 60_000)
    setNow(Date.now())
    setConfirmHand(false)
    setPhase('exam')
    window.scrollTo(0, 0)
  }

  const results = useMemo(
    () =>
      tps.map((t) => {
        const ids = QUESTIONS[t.slug].map((q) => q.id)
        const pen = penalties[t.slug] ?? []
        return { tp: t, ids, pen, ...examNote(ids, answers, pen) }
      }),
    [tps, answers, penalties],
  )
  const overall = results.reduce((s, r) => s + r.note, 0) / results.length

  const overallRef = useRef(overall)
  overallRef.current = overall
  /**
   * Remise (bouton ou chrono écoulé) : les réponses attendues des questions jamais affichées sont calculées
   * depuis les clés de correction, puis la note est enregistrée une fois dans l'historique.
   */
  const finish = useCallback(async () => {
    setFinishing(true)
    setConfirmHand(false)
    try {
      const keys = await Promise.all(tps.map((t) => loadAnswerKey(t.slug)))
      setMeta((prev) => ({ ...Object.assign({}, ...keys), ...prev }))
    } catch {
      /* clé indisponible : les questions non affichées restent sans réponse attendue */
    }
    recordExam({ date: new Date().toISOString(), kind, note: Math.round(overallRef.current * 100) / 100 })
    setPhase('results')
    setFinishing(false)
    window.scrollTo(0, 0)
  }, [kind, tps])

  useEffect(() => {
    if (phase !== 'exam') return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [phase])
  const remaining = endAt - now
  useEffect(() => {
    if (phase === 'exam' && remaining <= 0 && !finishing) void finish()
  }, [phase, remaining, finish, finishing])

  const record = useCallback((a: ExamAnswer) => setAnswers((prev) => ({ ...prev, [a.id]: a })), [])
  const register = useCallback(
    (id: string, m: QuestionMeta) =>
      setMeta((prev) => (prev[id]?.expected === m.expected && prev[id]?.explanation === m.explanation ? prev : { ...prev, [id]: m })),
    [],
  )
  const penalize = useCallback(
    (k: PenaltyKind, what: string) => setPenalties((prev) => ({ ...prev, [tp.slug]: [...(prev[tp.slug] ?? []), { kind: k, what }] })),
    [tp.slug],
  )
  const api = useMemo<ExamApi>(
    () => ({ active: phase === 'exam', record, answerOf: (id) => answers[id], register, penalize }),
    [phase, record, answers, register, penalize],
  )

  /** Quitter les résultats : retour à l'entraînement et session d'examen effacée. */
  const leave = () => {
    clearExamSession(kind)
    setPhase('training')
  }

  const bar = 'sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur'
  const btn = 'min-h-11 rounded-lg px-4 py-2 text-sm font-semibold ring-1 ring-line'

  if (phase === 'results')
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-xs font-semibold tracking-[0.2em] text-accent">RÉSULTATS D’EXAMEN</p>
        <h1 className="mt-2 text-3xl font-bold">
          Note : <span className="font-mono">{fr(overall, 2)} / 20</span>
        </h1>
        {tps.length > 1 && <p className="mt-1 text-sm text-muted">Moyenne des {tps.length} TP, chacun noté sur 20.</p>}
        {results.map((r) => (
          <section key={r.tp.slug} className="mt-8 space-y-3">
            <h2 className="text-xl font-semibold">
              {r.tp.title} — <span className="font-mono">{fr(r.note, 2)} / 20</span>
              <span className="ml-2 text-sm font-normal text-muted">
                ({fr(r.raw, 2)} − {fr(r.minus, 1)} de pénalités ; {fr(r.per, 2)} pt par question)
              </span>
            </h2>
            <div className="overflow-x-auto rounded-card ring-1 ring-line">
              <table className="w-full text-sm">
                <thead className="bg-card-2 text-left text-xs text-muted">
                  <tr>
                    <th className="px-3 py-2 font-normal">Question</th>
                    <th className="px-3 py-2 font-normal">Ta réponse</th>
                    <th className="px-3 py-2 font-normal">Attendu</th>
                    <th className="px-3 py-2 font-normal">Écart</th>
                    <th className="px-3 py-2 text-right font-normal">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {r.ids.map((id) => {
                    const a = answers[id]
                    const m = meta[id]
                    const score = a?.score ?? 0
                    return (
                      <tr key={id} className="border-t border-line align-top">
                        <td className="px-3 py-2">
                          <div>{LABEL_OF[id]}</div>
                          {(a?.explanation ?? m?.explanation) && <div className="mt-1 text-xs text-muted">{a?.explanation ?? m?.explanation}</div>}
                          {score < 1 && (
                            <Link to={`/tp/${r.tp.slug}?q=${id}`} onClick={leave} className="mt-1 inline-block text-xs text-accent underline">
                              Revoir en entraînement →
                            </Link>
                          )}
                        </td>
                        <td className={`px-3 py-2 font-mono text-xs ${score >= 1 ? 'text-ok' : 'text-err'}`}>{a ? a.given : 'non traitée'}</td>
                        <td className="px-3 py-2 font-mono text-xs">{a?.expected ?? m?.expected ?? '—'}</td>
                        <td className="px-3 py-2 font-mono text-xs">{a?.gap ?? '—'}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs">{fr(score * r.per, 2)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="rounded-card bg-card shadow-sm shadow-black/[0.03] p-3 text-sm ring-1 ring-line">
              <div className="mb-1 font-semibold">Pénalités : −{fr(penaltyPoints(r.pen), 1)}</div>
              {r.pen.length === 0 ? (
                <p className="text-muted">Aucune.</p>
              ) : (
                <ul className="list-disc pl-5 text-muted">
                  {r.pen.map((p, k) => (
                    <li key={k}>
                      {p.what} ({p.kind === 'check' ? '−0,5, plafonné à −3 au total' : '−1'})
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        ))}
        <div className="mt-8 flex gap-3">
          {tps.length === 1 ? (
            <button type="button" onClick={() => setPhase('training')} className={`${btn} bg-card-2`}>
              Retour à l’entraînement
            </button>
          ) : null}
          <Link to="/" onClick={leave} className={`${btn} inline-flex items-center bg-accent text-on-accent`}>
            Accueil
          </Link>
        </div>
      </div>
    )

  return (
    <ExamContext.Provider value={api}>
      <div className={bar}>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2">
          {phase === 'training' ? (
            <>
              <span className="text-sm text-muted">Mode entraînement : verdicts et explications affichés.</span>
              <button type="button" onClick={start} className={`${btn} ml-auto bg-accent text-on-accent`}>
                Examen {minutes} min
              </button>
            </>
          ) : (
            <>
              <span className="text-sm font-semibold text-accent">EXAMEN</span>
              {tps.length > 1 && (
                <span className="text-sm text-muted">
                  TP {index + 1}/{tps.length} : {tp.title}
                </span>
              )}
              <span className={`font-mono text-xl ${remaining < 5 * 60_000 ? 'text-err' : 'text-ink'}`} aria-live="polite">
                {clock(remaining)}
              </span>
              <span className="text-xs text-muted">Réponses enregistrées sans correction. Pénalités : câblage refusé −0,5 (max −3), modification sous tension −1.</span>
              <div className="ml-auto flex gap-2">
                {tps.length > 1 && index > 0 && (
                  <button type="button" onClick={() => (setIndex(index - 1), window.scrollTo(0, 0))} className={`${btn} bg-card-2`}>
                    ← TP précédent
                  </button>
                )}
                {tps.length > 1 && index < tps.length - 1 && (
                  <button type="button" onClick={() => (setIndex(index + 1), window.scrollTo(0, 0))} className={`${btn} bg-card-2`}>
                    TP suivant →
                  </button>
                )}
                {confirmHand ? (
                  <>
                    <button type="button" disabled={finishing} onClick={() => void finish()} className={`${btn} bg-err text-white disabled:opacity-50`}>
                      Confirmer la remise
                    </button>
                    <button type="button" onClick={() => setConfirmHand(false)} className={`${btn} bg-card-2`}>
                      Annuler
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => setConfirmHand(true)} className={`${btn} bg-accent text-on-accent`}>
                    Rendre
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      <div key={`${phase}-${examId}-${tp.slug}`}>{render(tp)}</div>
    </ExamContext.Provider>
  )
}
