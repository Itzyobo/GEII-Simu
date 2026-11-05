import { describe, expect, it } from 'vitest'
import { defaultMccConfig, packageOf, pinNumber, toggleGridPin } from './config'
import { cellState, clickCell, gridRows } from './grid'

describe('Pin Manager : Grid View (captures du CR)', () => {
  it('boîtier UQFN40 par défaut, numéros relevés sur les captures', () => {
    const c = defaultMccConfig()
    expect(packageOf(c)).toBe('UQFN40')
    const n = (pins: string[]) => pins.map((p) => pinNumber(c, p))
    expect(n(['RA0', 'RA1', 'RA2', 'RA3', 'RA4', 'RA5', 'RA6', 'RA7'])).toEqual([17, 18, 19, 20, 21, 22, 29, 28])
    expect(n(['RB0', 'RB1', 'RB2', 'RB3', 'RB4', 'RB5', 'RB6', 'RB7'])).toEqual([8, 9, 10, 11, 12, 13, 14, 15])
    expect(n(['RC0', 'RC1', 'RC2', 'RC3', 'RC4', 'RC5', 'RC6', 'RC7'])).toEqual([30, 31, 32, 33, 38, 39, 40, 1])
    expect(n(['RD0', 'RD1', 'RD2', 'RD3', 'RD4', 'RD5', 'RD6', 'RD7'])).toEqual([34, 35, 36, 37, 2, 3, 4, 5])
    expect(n(['RE0', 'RE1', 'RE2', 'RE3'])).toEqual([23, 24, 25, 16])
  })
  it('PDIP40 reste disponible dans le menu Package', () => {
    const c = { ...defaultMccConfig(), package: 'PDIP40' as const }
    expect([pinNumber(c, 'RE3'), pinNumber(c, 'RA4'), pinNumber(c, 'RB4')]).toEqual([1, 6, 37])
  })
  it('lignes : OSC CLKOUT (RA6), GPIO input, GPIO output, RESET MCLR (RE3 verrouillée)', () => {
    const rows = gridRows()
    expect(rows.map((r) => `${r.module}/${r.func}/${r.dir}`)).toEqual(['OSC/CLKOUT/output', 'Pin Module/GPIO input/input', 'Pin Module/GPIO output/output', 'RESET/MCLR/input'])
    const c = defaultMccConfig()
    const [clk, gin, gout, mclr] = rows
    expect(['RA5', 'RA6'].map((p) => cellState(c, rows, clk, p))).toEqual(['none', 'available'])
    expect(cellState(c, rows, mclr, 'RE3')).toBe('fixed')
    expect(cellState(c, rows, gin, 'RE3')).toBe('none')
    expect(clickCell(c, rows, mclr, 'RE3')).toBe(c)
    expect(cellState(c, rows, gout, 'RA4')).toBe('available')
  })
  it('vert = verrouillé, orange = déjà pris ; GPIO entrée ↔ sortie déplace le verrou', () => {
    const rows = gridRows()
    const [clk, gin, gout] = rows
    let c = clickCell(defaultMccConfig(), rows, gout, 'RA4')
    expect(cellState(c, rows, gout, 'RA4')).toBe('locked')
    expect(cellState(c, rows, gin, 'RA4')).toBe('taken')
    c = clickCell(c, rows, gin, 'RA4')
    expect(c.pins).toEqual([expect.objectContaining({ pin: 'RA4', direction: 'input' })])
    // RA6 en GPIO : la ligne CLKOUT devient orange
    c = toggleGridPin(c, 'RA6', 'output')
    expect(cellState(c, rows, clk, 'RA6')).toBe('taken')
  })
})
