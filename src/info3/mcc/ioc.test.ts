import { describe, expect, it } from 'vitest'
import { INFO3 } from '../../data/reference'
import { compile, formatDiagnostic } from '../compiler'
import { iocEdges, iocSummary } from '../models/ioc'
import { Vm } from '../vm/vm'
import { setIoc } from './config'
import { generate } from './generator'
import { namedPin, tp1Config } from './presets'

const DIR = INFO3.mcc.dir
const withIoc = () => setIoc(setIoc(tp1Config(), 'RB4', 'negative'), 'RC5', 'negative')

describe('modèle ioc (pur)', () => {
  it('fronts montants (IOCxP), descendants (IOCxN), ignorés en analogique', () => {
    expect(iocEdges(0b0000, 0b0001, 0b0001, 0, 0)).toBe(0b0001)
    expect(iocEdges(0b0001, 0b0000, 0b0001, 0, 0)).toBe(0)
    expect(iocEdges(0b0001, 0b0000, 0, 0b0001, 0)).toBe(0b0001)
    expect(iocEdges(0b0001, 0b0000, 0, 0b0001, 0b0001)).toBe(0)
    expect(iocSummary([0, 0, 0x10, 0])).toBe(1)
    expect(iocSummary([0, 0, 0, 0])).toBe(0)
  })
})

describe('Generate : IOC (cours p. 38 à 40)', () => {
  it('RB4 negative : registres, handler par défaut, IOCIE, PIN_MANAGER_IOC, ISR', () => {
    const g = generate(withIoc())
    const c = g[`${DIR}/pin_manager.c`]
    for (const line of [
      '    //interrupt on change for group IOCBF - flag\n    IOCBFbits.IOCBF4 = 0;',
      '    //interrupt on change for group IOCBN - negative\n    IOCBNbits.IOCBN4 = 1;',
      '    //interrupt on change for group IOCBP - positive\n    IOCBPbits.IOCBP4 = 0;',
      '    IOCBF4_SetInterruptHandler(IOCBF4_DefaultInterruptHandler);',
      '    // Enable IOCI interrupt \n    PIE0bits.IOCIE = 1; ',
      '    if(IOCBFbits.IOCBF4 == 1)\n    {\n        IOCBF4_ISR();  \n    }',
      'void (*IOCBF4_InterruptHandler)(void);',
      'void IOCBF4_ISR(void) {',
      '    if(IOCBF4_InterruptHandler)\n    {\n        IOCBF4_InterruptHandler();\n    }\n    IOCBFbits.IOCBF4 = 0;\n}',
      'void IOCBF4_SetInterruptHandler(void (* InterruptHandler)(void)){\n    IOCBF4_InterruptHandler = InterruptHandler;\n}',
      'void IOCBF4_DefaultInterruptHandler(void){',
    ]) {
      expect(c).toContain(line)
    }
    const h = g[`${DIR}/pin_manager.h`]
    for (const d of ['void IOCBF4_ISR(void);', 'void IOCBF4_SetInterruptHandler(void (* InterruptHandler)(void));', 'extern void (*IOCBF4_InterruptHandler)(void);', 'void IOCBF4_DefaultInterruptHandler(void);', 'void IOCCF5_ISR(void);']) {
      expect(h).toContain(d)
    }
  })
  it('sans IOC : fichiers inchangés (TP1 identique aux fichiers réels)', () => {
    const c = generate(tp1Config())[`${DIR}/pin_manager.c`]
    expect(c).not.toMatch(/IOC[A-E][FNP]/)
    expect(c).not.toContain('PIE0bits.IOCIE')
  })
  it('IOC sur le port D : refusée par MCC et absente du code généré', () => {
    let c = namedPin(tp1Config(), 'RD1', 'input', 'ENCA', false)
    c = setIoc(c, 'RD1', 'any')
    expect(c.pins.find((p) => p.pin === 'RD1')!.ioc).toBeUndefined()
    const forced = { ...c, pins: c.pins.map((p) => (p.pin === 'RD1' ? { ...p, ioc: 'any' as const } : p)) }
    const g = generate(forced)[`${DIR}/pin_manager.c`]
    expect(g).not.toContain('IOCD')
    expect(g).not.toContain('PIE0bits.IOCIE')
  })
})

describe('VM : IOC et IOCIF', () => {
  it('front descendant sur RB4 → IOCBF4 = 1, IOCIF = 1 (lecture seule) ; effacement de IOCBF4 → IOCIF = 0', () => {
    const files = { 'main.c': '#include "mcc_generated_files/mcc.h"\nvoid main(void) { SYSTEM_Initialize(); while (1) { } }\n', ...generate(withIoc()) }
    const r = compile(files)
    if (!r.ok) throw new Error(r.diagnostics.map(formatDiagnostic).join('\n'))
    const vm = new Vm()
    vm.load(r.program!)
    vm.runFor({ ms: 2 })
    expect(vm.bus.readBit('PIE0', 'IOCIE')).toBe(1)
    vm.writeSfr('PIR0', 0xff)
    expect(vm.bus.readBit('PIR0', 'IOCIF')).toBe(0)
    vm.press('S1')
    vm.runFor({ ms: 1 })
    expect(vm.bus.readBit('IOCBF', 'IOCBF4')).toBe(1)
    expect(vm.bus.readBit('PIR0', 'IOCIF')).toBe(1)
    vm.bus.writeBit('IOCBF', 'IOCBF4', 0)
    expect(vm.bus.readBit('PIR0', 'IOCIF')).toBe(0)
    vm.release('S1')
    vm.runFor({ ms: 1 })
    expect(vm.bus.readBit('IOCBF', 'IOCBF4')).toBe(0)
  })
})
