import { describe, expect, it } from 'vitest'
import { analyzeMasWiring } from './masWiring'
import type { Pair } from './wiring'

const VOLTMETRE: Pair[] = [
  ['mV', 'cplR'],
  ['mC', 'cplB'],
]
/** Montage 1 : réseau → commutateur → MAS, pince sur S2, tension phase 2 – N. */
const MONTAGE1: Pair[] = [
  ['L1', 'c1i'],
  ['L2', 'c2i'],
  ['L3', 'c3i'],
  ['c1o', 'U1'],
  ['c2o', 'V1'],
  ['c3o', 'W1'],
  ['pince', 'c2o'],
  ['anV', 'c2o'],
  ['anC', 'N'],
  ...VOLTMETRE,
]
/** Montage 2 : réseau → variateur → MAS, pince sur U/T1, tension entre U/T1 et V/T2. */
const MONTAGE2: Pair[] = [
  ['L1', 'v1i'],
  ['L2', 'v2i'],
  ['L3', 'v3i'],
  ['v1o', 'U1'],
  ['v2o', 'V1'],
  ['v3o', 'W1'],
  ['pince', 'v1o'],
  ['anV', 'v1o'],
  ['anC', 'v2o'],
  ...VOLTMETRE,
]
const without = (wires: Pair[], drop: Pair) => wires.filter(([a, b]) => !(a === drop[0] && b === drop[1]))

describe('câblage du banc MAS', () => {
  it('montage 1 correct : accepté, alimenté par le commutateur, sens normal', () => {
    expect(analyzeMasWiring(MONTAGE1, 'reseau', 'triangle')).toEqual({ errors: [], faults: [], supply: 'commutateur', rotation: 1 })
  })

  it('montage 2 correct : accepté, alimenté par le variateur, sens normal', () => {
    expect(analyzeMasWiring(MONTAGE2, 'variateur', 'triangle')).toEqual({ errors: [], faults: [], supply: 'variateur', rotation: 1 })
  })

  it('montage correct mais mauvais objectif : refusé', () => {
    expect(analyzeMasWiring(MONTAGE1, 'variateur', 'triangle').errors.length).toBeGreaterThan(0)
    expect(analyzeMasWiring(MONTAGE2, 'reseau', 'triangle').errors.length).toBeGreaterThan(0)
  })

  it('phase manquante : accepté mais non conforme, la MAS ne démarre pas', () => {
    const r1 = analyzeMasWiring(without(MONTAGE1, ['L3', 'c3i']), 'reseau', 'triangle')
    expect(r1).toMatchObject({ errors: [], rotation: 0 })
    expect(r1.faults).toHaveLength(1)
    // Variateur privé d'une phase d'entrée : plus aucune sortie
    const r2 = analyzeMasWiring(without(MONTAGE2, ['L2', 'v2i']), 'variateur', 'triangle')
    expect(r2).toMatchObject({ errors: [], rotation: 0 })
  })

  it('deux phases inversées : accepté mais non conforme, la MAS tourne en sens inverse', () => {
    const swapped = MONTAGE1.map(([a, b]): Pair => (a === 'c1o' ? ['c1o', 'V1'] : a === 'c2o' && b === 'V1' ? ['c2o', 'U1'] : [a, b]))
    const r = analyzeMasWiring(swapped, 'reseau', 'triangle')
    expect(r).toMatchObject({ errors: [], rotation: -1 })
    expect(r.faults).toHaveLength(1)
    // Côté variateur, permuter deux sorties a le même effet
    const r2 = analyzeMasWiring(
      MONTAGE2.map(([a, b]): Pair => (a === 'v2o' && b === 'V1' ? ['v2o', 'W1'] : a === 'v3o' ? ['v3o', 'V1'] : [a, b])),
      'variateur',
      'triangle',
    )
    expect(r2.rotation).toBe(-1)
  })

  it('commutateur et variateur câblés ensemble : double alimentation refusée', () => {
    const both: Pair[] = [...MONTAGE1, ['L1', 'v1i'], ['L2', 'v2i'], ['L3', 'v3i']]
    const r = analyzeMasWiring(both, 'reseau', 'triangle')
    expect(r.errors).toContain('Commutateur et variateur câblés en même temps : double alimentation refusée.')
    expect(r.supply).toBeNull()
  })

  it('étoile sur le réseau acceptée (alerte en marche), refusée sur le variateur', () => {
    expect(analyzeMasWiring(MONTAGE1, 'reseau', 'etoile').errors).toEqual([])
    expect(analyzeMasWiring(MONTAGE2, 'variateur', 'etoile').errors.length).toBe(1)
  })

  it('mesures mal placées : refusées', () => {
    const r = analyzeMasWiring(
      MONTAGE1.map(([a, b]): Pair => (a === 'anV' ? ['anV', 'c1o'] : a === 'mC' ? ['mC', 'N'] : [a, b])),
      'reseau',
      'triangle',
    )
    expect(r.errors).toEqual(['Fil rouge de l’analyseur : sur la même phase que la pince.', 'Voltmètre : rouge sur la borne couple rouge, noir sur la borne couple bleue du pilote.'])
  })

  it('court-circuit entre deux phases : refusé', () => {
    expect(analyzeMasWiring([...MONTAGE1, ['L1', 'L2']], 'reseau', 'triangle').errors).toContain('Court-circuit : L1 et L2 sont reliés.')
  })
})
