import { expect, it } from 'vitest'
import { toHex } from '../models/crc'
import { detectes, trafic } from './bench'
import { initialState, reduce, type Action } from './store'

it('parcours terminé : l’analyseur et la grille gardent l’historique (4 exceptions, 4 esclaves)', () => {
  const actions: Action[] = [
    { type: 'db9', card: 'c1', on: true },
    { type: 'db9', card: 'c2', on: true },
    { type: 'role', card: 'c2', role: 'Analyseur' },
    { type: 'parcours', card: 'c1', on: true, wall: 0 },
    ...Array.from({ length: 53 }, (): Action => ({ type: 'tick', dt: 1 })),
  ]
  const s = actions.reduce(reduce, initialState())
  expect(s.software.c1.messages.at(-1)).toBe('Parcours réseau terminé')
  const ex = trafic(s, 'c2').filter((f) => f.type === 'ESCLAVE')
  expect(ex.map((f) => toHex(f.bytes))).toEqual(['17 87 01 63 F4', '1E 87 01 B3 F6', '23 87 03 A3 FB', '29 87 01 02 38'])
  expect(detectes(s, 'c1', s.parcours.c1!.debut)).toEqual([23, 30, 35, 41])
})
