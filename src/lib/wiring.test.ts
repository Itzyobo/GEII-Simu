import { describe, expect, it } from 'vitest'
import { checkWiring, type Pair } from './wiring'

const expected: Pair[] = [
  ['gbf+', 'r1'],
  ['gbf-', 'gnd'],
]
const labels = { 'gbf+': 'GBF +', 'gbf-': 'GBF −', r1: 'R1', gnd: 'Masse' }

describe('checkWiring', () => {
  it('accepte un câblage correct', () => {
    expect(checkWiring(expected, expected, labels)).toEqual({ ok: true, errors: [] })
  })

  it('accepte des fils posés à l’envers (paires non orientées, ordre libre)', () => {
    const r = checkWiring([['gnd', 'gbf-'], ['r1', 'gbf+']], expected, labels)
    expect(r.ok).toBe(true)
  })

  it('refuse un fil manquant avec un message lisible', () => {
    const r = checkWiring([['gbf+', 'r1']], expected, labels)
    expect(r.ok).toBe(false)
    expect(r.errors).toEqual(['Fil manquant entre GBF − et Masse'])
  })

  it('refuse un fil en trop', () => {
    const r = checkWiring([...expected, ['r1', 'gnd']], expected, labels)
    expect(r.ok).toBe(false)
    expect(r.errors).toEqual(['Fil en trop entre R1 et Masse'])
  })

  it('refuse des bornes inversées (+ et − croisés)', () => {
    const r = checkWiring([['gbf-', 'r1'], ['gbf+', 'gnd']], expected, labels)
    expect(r.ok).toBe(false)
    expect(r.errors).toHaveLength(4)
  })
})

describe('checkWiring : fils optionnels', () => {
  it('un fil optionnel est accepté, présent ou absent, dans les deux sens', () => {
    const optional: Pair[] = [['sonde', 'gnd']]
    expect(checkWiring(expected, expected, labels, optional).ok).toBe(true)
    expect(checkWiring([...expected, ['gnd', 'sonde']], expected, labels, optional).ok).toBe(true)
    expect(checkWiring([...expected, ['sonde', 'r1']], expected, labels, optional).ok).toBe(false)
  })
})
