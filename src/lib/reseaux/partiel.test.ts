import { describe, expect, it } from 'vitest'
import { RES3_PARTIEL } from '../../data/reference'
import { addHistory, correctAnswers, emptyAnswers, gradePartiel, loadHistory, loadSession, newSession, parseHexByte, remainingS, saveSession, subjectOf, submit, switchTab } from './partiel'

const mem = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
}

describe('barème', () => {
  it('totalise 20 : câble 7, série 6, ping 7', () => {
    const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0)
    const B = RES3_PARTIEL.PARTIEL_BAREME
    expect([sum(B.cable), sum(B.serie), sum(B.ping)]).toEqual([7, 6, 7])
  })
})

describe('sujet', () => {
  it('rejoué au même seed : identique', () => {
    const a = subjectOf(1234)
    const b = subjectOf(1234)
    expect(JSON.stringify({ ...a, serie: a.serie.line })).toBe(JSON.stringify({ ...b, serie: b.serie.line }))
    expect(JSON.stringify(subjectOf(1235).coax)).not.toBe(JSON.stringify(a.coax))
  })
})

describe('correction', () => {
  for (const seed of [1, 7, 42, 999]) {
    it(`graine ${seed} : réponses justes ⇒ 20/20 ; feuille vide ⇒ 0`, () => {
      const s = subjectOf(seed)
      const r = gradePartiel(s, correctAnswers(s))
      expect(r.lines.filter((l) => !l.ok).map((l) => l.label)).toEqual([])
      expect(r.note).toBe(20)
      expect(r.parts.map((p) => p.max)).toEqual([7, 6, 7])
      expect(gradePartiel(s, emptyAnswers()).note).toBe(0)
    })
  }
  it('points partiels : Zc et l ½ à 10 %, durée ½ à 5 %, débit ½ à 10 %, message au prorata ; le reste exact', () => {
    const s = subjectOf(3)
    const ok = correctAnswers(s)
    const with_ = (patch: (a: typeof ok) => void) => {
      const a = structuredClone(ok)
      patch(a)
      return gradePartiel(s, a)
    }
    const zc = s.coax.expected.Zc
    expect(with_((a) => (a.cable.zc = String(zc * 1.049))).note).toBe(20)
    expect(with_((a) => (a.cable.zc = String(zc * 1.051))).note).toBe(19)
    expect(with_((a) => (a.cable.zc = String(zc * 1.101))).note).toBe(18)
    expect(with_((a) => (a.cable.l = String(s.coax.expected.l * 0.92))).note).toBe(19)
    const d = s.ping.expected.durationUs
    expect(with_((a) => (a.ping.durationUs = String(d * 1.019))).note).toBe(20)
    expect(with_((a) => (a.ping.durationUs = String(d * 1.021))).note).toBe(19)
    expect(with_((a) => (a.ping.durationUs = String(d * 1.051))).note).toBe(18)
    const b = s.serie.expected.baud
    expect(with_((a) => (a.serie.baud = String(b * 1.05))).note).toBe(19.25)
    expect(with_((a) => (a.ping.padding = String(s.ping.expected.paddingBytes + 1))).note).toBe(18.5)
    expect(with_((a) => (a.ping.L = String(s.ping.expected.L + 1))).note).toBe(18)
    expect(with_((a) => (a.cable.gammaOpen = '0,9')).note).toBe(19)
    expect(with_((a) => (a.cable.methode = 'ohmmetre')).note).toBe(19)
    // Un caractère faux sur n : 2 × (n − 1)/n points pour le message, bit fautif dans le calcul
    const m = s.serie.expected.message
    const n = m.length
    const wrong = m.slice(0, -1) + (m.at(-1) === '#' ? '%' : '#')
    const r = with_((a) => (a.serie.message = wrong))
    expect(r.note).toBeCloseTo(18 + (2 * (n - 1)) / n, 9)
    expect(r.lines.find((l) => l.label.startsWith('Message'))!.calcul).toMatch(/attendu \d, lu \d/)
  })
  it('octet hexadécimal : A4, a4h, 0xA4', () => {
    expect([parseHexByte('A4'), parseHexByte('a4h'), parseHexByte('0xA4'), parseHexByte('G1')]).toEqual([0xa4, 0xa4, 0xa4, NaN])
  })
})

describe('session et historique', () => {
  it('reprise, temps par partie, chrono plafonné au rendu', () => {
    const st = mem()
    let s = newSession(5, 'exam', 0)
    s = switchTab(s, 1, 60_000)
    s = switchTab(s, 2, 90_000)
    saveSession(s, st)
    expect(loadSession(st)).toEqual(s)
    expect(remainingS(s, 600_000)).toBe(RES3_PARTIEL.dureeS - 600)
    const done = submit(s, 10 * 3600_000)
    expect(done.submittedAt).toBe(RES3_PARTIEL.dureeS * 1000)
    expect(done.partMs[0]).toBe(60_000)
    expect(done.partMs[1]).toBe(30_000)
    saveSession(null, st)
    expect(loadSession(st)).toBeNull()
  })
  it('historique cumulé', () => {
    const st = mem()
    addHistory({ date: 'd1', seed: 1, mode: 'train', note: 12, parts: [5, 3, 4] }, st)
    addHistory({ date: 'd2', seed: 2, mode: 'exam', note: 15, parts: [6, 4, 5] }, st)
    expect(loadHistory(st).map((h) => h.note)).toEqual([12, 15])
  })
})
