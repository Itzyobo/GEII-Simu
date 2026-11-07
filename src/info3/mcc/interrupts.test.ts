import { describe, expect, it } from 'vitest'
import { INFO3 } from '../../data/reference'
import { compile, formatDiagnostic } from '../compiler'
import { CR_FIXTURES } from '../fixtures'
import { Vm } from '../vm/vm'
import { generate } from './generator'
import { interruptManagerBody, interruptTable, setInterruptEnabled } from './interrupts'
import { tp1Config, tp21Config } from './presets'

const DIR = INFO3.mcc.dir

describe('Interrupt Module : interrupt_manager (cours p. 39)', () => {
  it('IOC seul : un test de premier niveau, puis « Unhandled Interrupt »', () => {
    expect(interruptManagerBody(tp21Config())).toBe(
      ['    // interrupt handler', '    if(PIE0bits.IOCIE == 1 && PIR0bits.IOCIF == 1)', '    {', '        PIN_MANAGER_IOC();', '    }', '    else', '    {', '        //Unhandled Interrupt', '    }'].join('\n'),
    )
    const g = generate(tp21Config())
    expect(g[`${DIR}/interrupt_manager.c`]).toContain('void __interrupt() INTERRUPT_InterruptManager (void)\n{\n    // interrupt handler\n')
    const h = g[`${DIR}/interrupt_manager.h`]
    for (const m of ['#define INTERRUPT_GlobalInterruptEnable() (INTCONbits.GIE = 1)', '#define INTERRUPT_GlobalInterruptDisable() (INTCONbits.GIE = 0)', '#define INTERRUPT_PeripheralInterruptEnable() (INTCONbits.PEIE = 1)', '#define INTERRUPT_PeripheralInterruptDisable() (INTCONbits.PEIE = 0)']) {
      expect(h).toContain(m)
    }
    expect(g[`${DIR}/mcc.h`]).toContain('#include <conio.h>\n#include "interrupt_manager.h"\n')
  })
  it('table Interrupt Vector : Pin Module IOCI, ordre 1, activée ; décochée → plus d’interrupt_manager ni d’IOCIE', () => {
    expect(interruptTable(tp21Config()).map((r) => [r.order, r.module, r.interrupt, r.enabled])).toEqual([[1, 'Pin Module', 'IOCI', true]])
    const off = setInterruptEnabled(tp21Config(), 'IOC', false)
    const g = generate(off)
    expect(g[`${DIR}/interrupt_manager.c`]).toBeUndefined()
    expect(g[`${DIR}/pin_manager.c`]).not.toContain('PIE0bits.IOCIE')
  })
  it('sans interruption (TP1) : pas d’interrupt_manager', () => {
    expect(Object.keys(generate(tp1Config())).some((f) => f.includes('interrupt_manager'))).toBe(false)
  })
})

function boot(main: string) {
  const r = compile({ 'main.c': main, ...generate(tp21Config()) })
  if (!r.ok) throw new Error(r.diagnostics.map(formatDiagnostic).join('\n'))
  const vm = new Vm()
  vm.load(r.program!)
  vm.runFor({ ms: 5 })
  return vm
}
const cycle = (vm: Vm, bounce: boolean) => {
  vm.press('S1', bounce)
  vm.runFor({ ms: 20 })
  vm.release('S1', bounce)
  vm.runFor({ ms: 20 })
}

describe('TP2 1.1 : compteur sous IOC (fixture du CR)', () => {
  it('20 appuis propres sur S1 → cpt = 20 & 0x0F', () => {
    const vm = boot(CR_FIXTURES['tp2/q1_1'])
    for (let k = 0; k < 20; k++) cycle(vm, false)
    expect(vm.peekVar('cpt')).toBe(20 & 0x0f)
    expect(vm.readSfr('LATA') >> 4).toBe(20 & 0x0f)
    expect(vm.irqCalls.IOC).toBe(20)
  })
  it('avec rebonds (graine fixe) : au moins un saut de +2 sur 100 appuis (constat du CR)', () => {
    const vm = boot(CR_FIXTURES['tp2/q1_1'])
    let jumps = 0
    for (let k = 0; k < 100; k++) {
      const before = vm.peekVar('cpt') as number
      cycle(vm, true)
      if ((((vm.peekVar('cpt') as number) - before) & 0x0f) >= 2) jumps++
    }
    expect(jumps).toBeGreaterThanOrEqual(1)
  })
  it('INTERRUPT_GlobalInterruptEnable() en commentaire → 0 interruption', () => {
    const vm = boot(CR_FIXTURES['tp2/q1_1'].replace('    INTERRUPT_GlobalInterruptEnable();', '    //INTERRUPT_GlobalInterruptEnable();'))
    for (let k = 0; k < 10; k++) cycle(vm, false)
    expect(vm.peekVar('cpt')).toBe(0)
    expect(vm.irqCalls.IOC ?? 0).toBe(0)
    expect(vm.bus.readBit('PIR0', 'IOCIF')).toBe(1)
  })
})
