import { describe, expect, it } from 'vitest'
import { isCorrect, parseAnswer } from './grading'

describe('tolérance des QuestionCard', () => {
  it('±5 % par défaut, bornes incluses', () => {
    expect(isCorrect(6, 6)).toBe(true)
    expect(isCorrect(6.3, 6)).toBe(true)
    expect(isCorrect(5.7, 6)).toBe(true)
    expect(isCorrect(6.31, 6)).toBe(false)
    expect(isCorrect(5.69, 6)).toBe(false)
  })

  it('valeurs attendues négatives', () => {
    expect(isCorrect(-1.04, -1)).toBe(true)
    expect(isCorrect(1, -1)).toBe(false)
  })

  it('tolérance personnalisée', () => {
    expect(isCorrect(10.8, 10, 0.1)).toBe(true)
    expect(isCorrect(11.2, 10, 0.1)).toBe(false)
  })

  it('réponse illisible = fausse ; virgule décimale acceptée', () => {
    expect(isCorrect(parseAnswer(''), 0)).toBe(false)
    expect(isCorrect(parseAnswer('abc'), 1)).toBe(false)
    expect(parseAnswer(' 22,7 ')).toBe(22.7)
  })
})
