/** MAX7219 et matrice 8x8 R click dans la VM (consigne étape 6, tests 8 à 11). */
import { describe, expect, it } from 'vitest'
import { compile, formatDiagnostic } from '../compiler'
import { generate } from '../mcc/generator'
import { tp63Config } from '../mcc/presets'
import { SOLUTIONS } from '../solutions'
import { Vm, type RotarySlot } from '../vm/vm'
import { Max7219 } from './max7219'

const lib = { 'LED8x8.c': SOLUTIONS['tp6/LED8x8'], 'LED8x8.h': SOLUTIONS['tp6/LED8x8.h'] }
const HEAD = '#include "mcc_generated_files/mcc.h"\n#include "LED8x8.h"\n'
const prog = (body: string) => `${HEAD}void main(void)\n{\n    SYSTEM_Initialize();\n    SPI1_Open(SPI1_DEFAULT);\n${body}\n    while (1) {}\n}\n`

function boot(main: string, slot: RotarySlot | null = 'mikrobus1') {
  const r = compile({ 'main.c': main, ...lib, ...generate(tp63Config()) })
  if (!r.ok) throw new Error(r.diagnostics.map(formatDiagnostic).join('\n'))
  const vm = new Vm()
  vm.setMatrixSlot(slot)
  vm.load(r.program!)
  vm.runFor({ ms: 20 })
  return vm
}
const show = (vm: Vm) => vm.matrix.matrix().map((r) => r.map((b) => (b ? '#' : '.')).join(''))

describe('MAX7219 (test 8)', () => {
  it('mise sous tension : shutdown ; 10 écritures de digits sans initialisation → 0 LED', () => {
    const vm = boot(prog('    uint8_t i;\n    for (i = 0; i < 10; i++) LED8x8_Write(1 + (i & 7), 0xFF);'))
    // + 1 trame No-Op : LOAD monte quand pin_manager met RA3 en sortie à 1 (Start High)
    expect(vm.matrix.frames.filter((f) => f.addr >= 1 && f.addr <= 8)).toHaveLength(10)
    expect(vm.matrix.shutdown).toBe(true)
    expect(vm.matrix.litCount).toBe(0)
  })
  it('après LED8x8_Initialize(0), LED8x8_Write(0x01, 0x81) : LED du haut et du bas de la colonne de droite (H11)', () => {
    const vm = boot(prog('    LED8x8_Initialize(0);\n    LED8x8_Write(0x01, 0x81);'))
    expect(vm.matrix).toMatchObject({ shutdown: false, scanLimit: 7, decode: 0, test: false, intensity: 0 })
    expect(show(vm)).toEqual(['.......#', '........', '........', '........', '........', '........', '........', '.......#'])
    expect(vm.matrix.ledDuty).toBeCloseTo(1 / 32 / 8, 9)
  })
})

describe('trame mélangée (test 9)', () => {
  it('LOAD remonté entre les 2 octets : chaque 1er verrouillage mélange l’octet précédent et l’adresse, le motif attendu n’apparaît pas', () => {
    const mixed = lib['LED8x8.c'].replace('    SPI1_ExchangeByte(reg);    // adresse\n', '    SPI1_ExchangeByte(reg);    // adresse\n    LOAD_SetHigh();\n    LOAD_SetLow();\n')
    expect(mixed).not.toBe(lib['LED8x8.c'])
    const r = compile({ 'main.c': prog('    LED8x8_Initialize(0);\n    LED8x8_Write(0x01, 0x81);'), 'LED8x8.c': mixed, 'LED8x8.h': lib['LED8x8.h'], ...generate(tp63Config()) })
    if (!r.ok) throw new Error(r.diagnostics.map(formatDiagnostic).join('\n'))
    const vm = new Vm()
    vm.setMatrixSlot('mikrobus1')
    vm.load(r.program!)
    vm.runFor({ ms: 20 })
    // Écriture de l'intensité (0x0A) : 1er verrouillage = (donnée précédente 0x07, 0x0A) → Digit 6 = 0x0A
    expect(vm.matrix.frames).toContainEqual({ addr: 0x07, data: 0x0a })
    expect(show(vm)).not.toEqual(['.......#', '........', '........', '........', '........', '........', '........', '.......#'])
  })
})

describe('Display Test et Scan Limit (test 10)', () => {
  it('Display Test = 1 → 64 LED (même en shutdown) ; Scan Limit = 3 → seuls les digits 0 à 3', () => {
    const t = boot(prog('    LED8x8_Write(0x0F, 0x01);'))
    expect(t.matrix.shutdown).toBe(true)
    expect(t.matrix.litCount).toBe(64)
    const s = boot(prog('    uint8_t c;\n    LED8x8_Initialize(15);\n    for (c = 1; c <= 8; c++) LED8x8_Write(c, 0xFF);\n    LED8x8_Write(0x0B, 0x03);'))
    expect(s.matrix.litCount).toBe(32)
    expect(show(s)[0]).toBe('....####')
  })
  it('Code B : decode du digit 0, valeur 8 → segments A à G (DP éteint)', () => {
    const m = new Max7219()
    const send = (addr: number, data: number) => {
      const w = (addr << 8) | data
      for (let b = 15; b >= 0; b--) m.clock(((w >> b) & 1) as 0 | 1)
      m.load()
    }
    send(0x0c, 1)
    send(0x09, 0x01)
    send(0x01, 8)
    expect(m.segments(0)).toBe(0x7f)
    send(0x01, 0x80 | 1)
    expect(m.segments(0)).toBe(0x80 | 0x30)
  })
})

describe('carte sur le mauvais mikroBUS (test 11)', () => {
  it('8x8 R click sur le mikroBUS 2 (CS sur RD3 au lieu de RA3) : aucun front de LOAD, rien ne s’affiche', () => {
    const vm = boot(prog('    LED8x8_Initialize(0);\n    LED8x8_Write(0x01, 0xFF);'), 'mikrobus2')
    expect(vm.matrix.frames).toHaveLength(0)
    expect(vm.matrix.litCount).toBe(0)
  })
})
