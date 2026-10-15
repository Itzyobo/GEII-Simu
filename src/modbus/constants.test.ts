import { expect, it } from 'vitest'

// Toute constante du TP vit dans data/reference.ts : on la cherche partout ailleurs dans src/modbus/.
const FILES = import.meta.glob(['./**/*.{ts,tsx}', '!./data/reference.ts', '!./**/*.test.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const FORBIDDEN = ['38400', '2400', '4800', '416.7', '26.04', '0xA001', '0xFFFF', '11.5', '23.3', '1.75']

it('aucun littéral de reference.ts recopié hors de ce fichier', () => {
  expect(Object.keys(FILES).length).toBeGreaterThan(5)
  const hits: string[] = []
  for (const [file, src] of Object.entries(FILES))
    for (const lit of FORBIDDEN) {
      const re = new RegExp(`(?<![\\w.])${lit.replace('.', '\\.')}(?![\\w])`, 'i')
      if (re.test(src)) hits.push(`${file} : ${lit}`)
    }
  expect(hits).toEqual([])
})
