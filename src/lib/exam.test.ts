import { describe, expect, it } from 'vitest'
import { examNote, penaltyPoints, wiringAnswer, type ExamAnswer, type Penalty } from './exam'

const ans = (id: string, score: number): ExamAnswer => ({ id, given: '', expected: '', score, explanation: '' })

describe('barème d’examen', () => {
  it('répartition égale, non répondue = 0, tableau en fraction', () => {
    const r = examNote(['a', 'b', 'c', 'd'], { a: ans('a', 1), b: ans('b', 0), c: ans('c', 0.5) }, [])
    expect(r.per).toBe(5)
    expect(r.note).toBe(7.5)
  })

  it('pénalités : −0,5 par vérification échouée plafonné à −3, −1 par modification sous tension', () => {
    const checks: Penalty[] = Array.from({ length: 9 }, () => ({ kind: 'check', what: '' }))
    expect(penaltyPoints(checks)).toBe(3)
    expect(penaltyPoints([{ kind: 'check', what: '' }, { kind: 'live', what: '' }, { kind: 'live', what: '' }])).toBe(2.5)
  })

  it('plancher à 0', () => {
    expect(examNote(['a'], {}, [{ kind: 'live', what: '' }]).note).toBe(0)
  })
})

describe('ligne « Câblage » notée en examen', () => {
  const run = (results: boolean[]) => {
    let prev: ExamAnswer | undefined
    for (const ok of results) prev = wiringAnswer('cab', prev, ok) ?? prev
    return prev!
  }

  it('1 au premier essai, ½ au deuxième, 0 ensuite', () => {
    expect(run([true]).score).toBe(1)
    expect(run([false, true]).score).toBe(0.5)
    expect(run([false, false, true]).score).toBe(0)
    expect(run([false]).score).toBe(0)
  })

  it('une fois validé, le score est figé', () => {
    expect(run([true, false]).score).toBe(1)
    expect(run([false, true, false, false]).score).toBe(0.5)
  })

  it('vaut autant qu’une question, pénalités de câblage conservées', () => {
    const q: ExamAnswer = { id: 'q', given: '', expected: '', score: 1, explanation: '' }
    const r = examNote(['cab', 'q'], { cab: run([false, true]), q }, [{ kind: 'check', what: '' }])
    expect(r.per).toBe(10)
    expect(r.raw).toBe(15)
    expect(r.note).toBe(14.5)
  })
})
