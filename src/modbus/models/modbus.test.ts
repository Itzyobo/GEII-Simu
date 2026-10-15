import { describe, expect, it } from 'vitest'
import { buildRequest } from './modbus'
import { toHex } from './crc'

const hex = (r: ReturnType<typeof buildRequest>) => (r.ok ? toHex(r.bytes) : r.errors.join(' ; '))

describe('buildRequest', () => {
  it('F6, esclave 23 (déc), adresse 64 (hex), valeur 5A (hex)', () => {
    const r = buildRequest({ esclave: { text: '23', base: 'dec' }, fonction: 6, champs: { adresse: { text: '64', base: 'hex' }, valeur: { text: '5A', base: 'hex' } } })
    expect(hex(r)).toBe('17 06 00 64 00 5A 4A D8')
  })
  it('adresse « 100 » laissée en hexa → registre 0100H', () => {
    const r = buildRequest({ esclave: { text: '23', base: 'dec' }, fonction: 6, champs: { adresse: { text: '100', base: 'hex' }, valeur: { text: '5A', base: 'hex' } } })
    expect(hex(r)).toBe('17 06 01 00 00 5A 0A FB')
  })
  it('F4, esclave 35, adresse 1, nombre 1', () => {
    const r = buildRequest({ esclave: { text: '35', base: 'dec' }, fonction: 4, champs: { adresse: { text: '1', base: 'hex' }, nombre: { text: '1', base: 'dec' } } })
    expect(hex(r)).toBe('23 04 00 01 00 01 66 88')
  })
  it('F7 ; saisie hors base refusée', () => {
    expect(hex(buildRequest({ esclave: { text: '1', base: 'dec' }, fonction: 7, champs: {} }))).toBe('01 07 41 E2')
    expect(buildRequest({ esclave: { text: '5A', base: 'dec' }, fonction: 7, champs: {} }).ok).toBe(false)
  })
})
