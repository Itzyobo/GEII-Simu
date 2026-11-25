import { describe, expect, it } from 'vitest'
import { parseSI } from './FrontKnob'

describe('saisie directe d’une valeur de molette', () => {
  it('nombres français ou anglais, préfixes SI, unité ignorée', () => {
    expect(parseSI('0,5')).toBe(0.5)
    expect(parseSI('2 ms')).toBeCloseTo(2e-3, 15)
    expect(parseSI('40n')).toBeCloseTo(40e-9, 18)
    expect(parseSI('40 ns')).toBeCloseTo(40e-9, 18)
    expect(parseSI('500 mV')).toBeCloseTo(0.5, 12)
    expect(parseSI('-0,1 V')).toBeCloseTo(-0.1, 12)
    expect(parseSI('2 µs')).toBeCloseTo(2e-6, 15)
    expect(parseSI('1,2 kHz')).toBeCloseTo(1200, 9)
    expect(parseSI('5 MHz')).toBeCloseTo(5e6, 3)
    expect(parseSI('8')).toBe(8)
  })
  it('texte illisible : NaN (la valeur ne change pas)', () => {
    expect(parseSI('')).toBeNaN()
    expect(parseSI('abc')).toBeNaN()
  })
})
