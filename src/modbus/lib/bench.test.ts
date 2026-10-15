import { expect, it } from 'vitest'
import { fromHex, toHex } from '../models/crc'
import { ledsOTB, moduleAt, withCrc } from '../models/slaves'
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

it('trames mémorisées envoyées périodiquement, tour à tour : LED, lecture, changement d’adresse puis réinitialisation', () => {
  const memo = (h: string, periode = 1): Action => ({ type: 'memorize', card: 'c1', bytes: fromHex(h), periode, wall: 0 })
  const ticks = (n: number) => Array.from({ length: n }, (): Action => ({ type: 'tick', dt: 0.1 }))
  let s = [
    { type: 'db9', card: 'c1', on: true } as Action,
    { type: 'db9', card: 'c2', on: true } as Action,
    { type: 'role', card: 'c2', role: 'Analyseur' } as Action,
    memo('17 06 00 64 00 5A 4A D8'),
    memo('17 03 00 64 00 01 C7 23'),
    ...ticks(25),
  ].reduce(reduce, initialState())
  expect(ledsOTB(s.pupitre).flatMap((on, k) => (on ? [k] : []))).toEqual([1, 3, 4, 6])
  const vus = trafic(s, 'c2').map((f) => toHex(f.bytes))
  expect(vus.slice(0, 4)).toEqual(['17 06 00 64 00 5A 4A D8', '17 06 00 64 00 5A 4A D8', '17 03 00 64 00 01 C7 23', '17 03 02 00 5A 71 BC'])
  // Cycle de 1 s, les deux trames tour à tour à 201,4 ms d'écart : cycles à t = 0, 1 et 2 s → 6 requêtes, 6 réponses
  expect(vus).toHaveLength(12)

  // Registre de configuration du TDS écrit par erreur : le module passe à l'adresse 100
  s = [{ type: 'clearMemorized', card: 'c1' } as Action, memo(toHex(withCrc([0x1e, 6, 0, 1, 0, 100]))), ...ticks(5)].reduce(reduce, s)
  expect(moduleAt(s.pupitre, 100)).toBe('TDS')
  expect(moduleAt(s.pupitre, 30)).toBeNull()
  s = reduce(s, { type: 'resetPupitre' })
  expect(moduleAt(s.pupitre, 30)).toBe('TDS')
})
