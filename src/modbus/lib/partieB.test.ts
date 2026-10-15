import { describe, expect, it } from 'vitest'
import { points } from '../models/answers'
import { champsPartieB, TRACE_HZ } from './partieB'

const C = champsPartieB()
const champ = (q: string, k: string) => C[q]!.find((c) => c.key === k)!
const pts = (q: string, k: string, v: string) => points(champ(q, k).check(v))

describe('correction 3.1 par les modèles', () => {
  it('fonction 07, adresses et modules détectés, trames émises', () => {
    expect(pts('s31-capture', 'fonction', '07')).toBe(1)
    expect(pts('s31-capture', 'fonction', '7H')).toBe(1)
    expect(pts('s31-capture', 'fonction', '03')).toBe(0)
    expect(pts('s31-adresses', 'adresses', '41 23 30 35')).toBe(1)
    expect(pts('s31-adresses', 'adresses', '23 30 35')).toBe(0)
    expect(pts('s31-adresses', 'module-23', 'OTB')).toBe(1)
    expect(pts('s31-adresses', 'module-35', 'TDS')).toBe(0)
    expect(pts('s31-trames', 'trame01', '01 07 41 E2')).toBe(1)
    expect(pts('s31-exception', 'code', '01')).toBe(1)
  })
  it('haute impédance : clic juste entre la requête et la réponse, faux pendant la requête', () => {
    const c = champ('s31-haute-impedance', 'clic')
    expect(c.check(String(TRACE_HZ.from + 0.5e-3)).ok).toBe(true) // avant la requête
    expect(c.check(String(TRACE_HZ.from + 1.5e-3)).ok).toBe(false) // pendant la requête
    expect(c.check(String(TRACE_HZ.from + 3.5e-3)).ok).toBe(true) // entre requête et réponse
  })
  it('affirmations : toutes justes → points complets', () => {
    const constat = champ('s31-differentiel', 'constat')
    const juste = constat.affirmations!.map((a) => (a.vrai ? '1' : '0')).join('')
    expect(pts('s31-differentiel', 'constat', juste)).toBe(1)
    expect(pts('s31-differentiel', 'constat', '11111')).toBe(0)
  })
})
