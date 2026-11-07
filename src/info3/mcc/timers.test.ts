import { describe, expect, it } from 'vitest'
import { INFO3 } from '../../data/reference'
import { compile, formatDiagnostic } from '../compiler'
import { CR_FIXTURES } from '../fixtures'
import { Vm } from '../vm/vm'
import { intervals, pinEdges } from '../vm/trace'
import { addTimer, updateTimer, type MccConfig } from './config'
import { generate } from './generator'
import { interruptManagerBody, moveInterrupt } from './interrupts'
import { tp1Config, tp21Config, tp31AConfig, tp31BConfig, tp31CConfig, tp32Config } from './presets'
import { cellState, clickCell, functionCount, gridRows } from './grid'
import { actualPeriod, displayedClock, formatFrequency, formatPeriod, parsePeriod, periodForRegister, periodRange, periodRegister, POSTSCALERS, PRESCALERS, setControlMode, timerGridRows } from './timers'

const DIR = INFO3.mcc.dir
/** Lignes sans espaces de fin (le format exact des espaces relève de H34) */
const trimLines = (s: string) => s.replace(/[ \t]+$/gm, '')

function boot(main: string, cfg: MccConfig) {
  const r = compile({ 'main.c': main, ...generate(cfg) })
  if (!r.ok) throw new Error(r.diagnostics.map(formatDiagnostic).join('\n'))
  const vm = new Vm()
  vm.load(r.program!)
  return vm
}
const lineOf = (src: string, text: string) => src.split('\n').findIndex((l) => l.includes(text)) + 1
const near = (v: number, target: number, tol: number) => expect(Math.abs(v - target) / target).toBeLessThanOrEqual(tol)
const TOL = 0.0005

/** Timer2 du cours p. 58 : 1 MHz, FOSC/4, 1:8, 1:4, PR2 = 77 */
function courseTmr2(): MccConfig {
  let c: MccConfig = { ...tp1Config(), system: { ...tp1Config().system, hfMHz: 1 } }
  c = updateTimer(addTimer(c, 'TMR2'), 'TMR2', { prescaler: 8, postscaler: 4 })
  return updateTimer(c, 'TMR2', { periodS: periodForRegister(c, c.timers!.TMR2!, 77) })
}

describe('interrupt_manager avec TMR2 (cours p. 59, H30)', () => {
  const tmr2Block = ['    if(INTCONbits.PEIE == 1)', '    {', '        if(PIE4bits.TMR2IE == 1 && PIR4bits.TMR2IF == 1)', '        {', '            TMR2_ISR();', '        }', '        else', '        {', '            //Unhandled Interrupt', '        }', '    }', '    else', '    {', '        //Unhandled Interrupt', '    }'].join('\n')
  it('TMR2 seul = structure p. 59', () => {
    const c = updateTimer(courseTmr2(), 'TMR2', { interrupt: true })
    expect(trimLines(interruptManagerBody(c))).toBe(`    // interrupt handler\n${tmr2Block}`)
  })
  it('IOC + TMR2 : premier niveau d’abord, puis « else if(INTCONbits.PEIE == 1) » (H30)', () => {
    const body = trimLines(interruptManagerBody(tp32Config()))
    expect(body).toContain('    if(PIE0bits.IOCIE == 1 && PIR0bits.IOCIF == 1)\n    {\n        PIN_MANAGER_IOC();\n    }\n    else if(INTCONbits.PEIE == 1)\n    {\n        if(PIE4bits.TMR2IE == 1 && PIR4bits.TMR2IF == 1)')
  })
  it('inverser la table inverse l’ordre des périphériques dans le fichier', () => {
    let c = updateTimer(courseTmr2(), 'TMR2', { interrupt: true })
    c = updateTimer(addTimer(c, 'TMR4'), 'TMR4', { interrupt: true })
    const pos = (s: string) => [s.indexOf('TMR2_ISR'), s.indexOf('TMR4_ISR')]
    const [a2, a4] = pos(interruptManagerBody(c))
    expect(a2).toBeLessThan(a4)
    expect(trimLines(interruptManagerBody(c))).toContain('        else if(PIE4bits.TMR4IE == 1 && PIR4bits.TMR4IF == 1)')
    const [b2, b4] = pos(interruptManagerBody(moveInterrupt(c, 'TMR4', -1)))
    expect(b4).toBeLessThan(b2)
  })
})

describe('tmr2.c / tmr4.c (cours p. 58 et 65)', () => {
  it('cours p. 58 : 1 MHz, FOSC/4, 1:8, 1:4, PR 77', () => {
    const g = generate(courseTmr2())
    const c = g[`${DIR}/tmr2.c`]
    for (const l of ['T2CLKCON = 0x01;', 'T2HLT = 0x00;', 'T2RST = 0x00;', 'T2PR = 0x4D;', 'T2CON = 0xB3;', '// T2CKPS 1:8; T2OUTPS 1:4; TMR2ON on;']) expect(c).toContain(l)
    expect(g[`${DIR}/mcc.h`]).toContain('#include "tmr2.h"\n')
    expect(g[`${DIR}/mcc.c`]).toContain('    OSCILLATOR_Initialize();\n    TMR2_Initialize();\n')
  })
  it('période mesurée 9.984 ms ± 0,05 %', () => {
    const vm = boot('#include "mcc_generated_files/mcc.h"\nvoid main(void) {\n    SYSTEM_Initialize();\n    while (1) {\n        if (TMR2_HasPeriodElapsed()) LED_D2_Toggle();\n    }\n}\n', courseTmr2())
    vm.runFor({ ms: 120 })
    // Scrutation par TMR2_HasPeriodElapsed : chaque bascule peut retarder de quelques Tcy, la période est la moyenne
    const edges = pinEdges(vm.gpio.trace, 'RA4')
    expect(edges.length).toBeGreaterThan(5)
    near(vm.toS(edges[edges.length - 1] - edges[0]) / (edges.length - 1), 9.984e-3, TOL)
    expect(vm.timers[2].periods).toBe(Math.floor((120e-3 - vm.toS(edges[0]) + 9.984e-3) / 9.984e-3))
  })
  it('cours p. 65 : TMR4 LFINTOSC, Monostable front montant, 1:128, 1:1, PR 241', () => {
    let c = updateTimer(addTimer(tp1Config(), 'TMR4'), 'TMR4', { controlMode: 'Monostable', startOption: 'Starts on rising edge on {ers}', clockSource: 'LFINTOSC', prescaler: 128, postscaler: 1 })
    c = updateTimer(c, 'TMR4', { periodS: periodForRegister(c, c.timers!.TMR4!, 241) })
    const t = generate(c)[`${DIR}/tmr4.c`]
    for (const l of ['T4CLKCON = 0x04;', 'T4HLT = 0x11;', 'T4PR = 0xF1;', 'T4CON = 0xF0;']) expect(t).toContain(l)
  })
})

describe('TP3 §1 : tp3/q1 (code du CR inchangé)', () => {
  const measure = (cfg: MccConfig, ms: number) => {
    const vm = boot(CR_FIXTURES['tp3/q1'], cfg)
    vm.runFor({ ms })
    // Le premier front de RA4 est l'écriture PORTA = … | 0x30 de main : les périodes commencent au second
    return intervals(pinEdges(vm.gpio.trace, 'RA4').slice(1)).map((t) => vm.toS(t))
  }
  it('1A : 1.00762 s ± 0,05 % ; PR2 = 121 → 0.99942 s', () => {
    const iv = measure(tp31AConfig(), 3200)
    expect(iv.length).toBeGreaterThanOrEqual(2)
    for (const v of iv) near(v, 1.00762, TOL)
    for (const v of measure(tp31AConfig(121), 3200)) near(v, 0.99942, TOL)
  })
  it('1B : les 128 combinaisons donnent au plus 63,5 ms ; 1:128 1:16 → 63.488 ms ± 0,05 %', () => {
    for (const pre of PRESCALERS)
      for (const post of POSTSCALERS) {
        const c = tp31BConfig(pre, post)
        const t = c.timers!.TMR2!
        expect(periodRegister(c, t)).toBe(0x1e)
        expect(actualPeriod(c, t) * post).toBeLessThanOrEqual(63.5e-3)
      }
    expect(PRESCALERS.length * POSTSCALERS.length).toBe(128)
    for (const v of measure(tp31BConfig(), 400)) near(v, 63.488e-3, TOL)
  })
  it('1C : 0.99923 s ± 0,05 %', () => {
    const iv = measure(tp31CConfig(), 3200)
    expect(iv.length).toBeGreaterThanOrEqual(2)
    for (const v of iv) near(v, 0.99923, TOL)
  })
})

describe('TP3 §2 : MCC (captures du CR)', () => {
  it('PR = 154, Actual Period 10 ms, plage 64.516 us … 16.516129 ms, Clock Frequency 32.768 kHz', () => {
    const c = tp32Config()
    const t = c.timers!.TMR2!
    expect(periodRegister(c, t)).toBe(154)
    expect(formatPeriod(actualPeriod(c, t))).toBe('10 ms')
    const r = periodRange(c, t)
    expect(`${formatPeriod(r.min)} ≤ Timer Period ≤ ${formatPeriod(r.max)}`).toBe('64.516 us ≤ Timer Period ≤ 16.516129 ms')
    expect(formatFrequency(displayedClock(c, t))).toBe('32.768 kHz')
    const g = generate(c)
    expect(g[`${DIR}/tmr2.c`]).toContain('T2HLT = 0x12;')
    expect(g[`${DIR}/pin_manager.c`]).toContain('    T2INPPS = 0x15;   //RC5->TMR2:T2IN;')
  })
})

describe('TP3 §2 : tp3/q2, anti-rebond par monostable', () => {
  const SRC = CR_FIXTURES['tp3/q2']
  const cycle = (vm: Vm, name: string, bounce: boolean) => {
    vm.press(name, bounce)
    vm.runFor({ ms: 25 })
    vm.release(name, bounce)
    vm.runFor({ ms: 25 })
  }
  it('TMR2IF levé 10.00 ms ± 0,5 % après le front descendant de S2', () => {
    const vm = boot(SRC, tp32Config())
    vm.runFor({ ms: 5 })
    vm.setBreakpoint('main.c', lineOf(SRC, 'if (BP_S2_GetValue() == 0)'))
    const t0 = vm.t
    vm.press('S2', false)
    expect(vm.runFor({ ms: 50 })).toBe('breakpoint')
    near(vm.toS(vm.timers[2].lastFlagT - t0), INFO3.tp3.debounceS, INFO3.tp3.debounceTolerance)
    expect(vm.irqCalls.TMR2).toBe(1)
  })
  it('100 appuis sur S2 avec rebonds → exactement −100 ; S1 → au moins un +2', () => {
    const vm = boot(SRC, tp32Config())
    vm.runFor({ ms: 5 })
    let ok = 0
    for (let k = 0; k < 100; k++) {
      const before = vm.peekVar('cpt') as number
      cycle(vm, 'S2', true)
      if ((before - (vm.peekVar('cpt') as number)) % 16 === 1 || before - (vm.peekVar('cpt') as number) === -15) ok++
    }
    expect(ok).toBe(100)
    expect(vm.peekVar('cpt')).toBe(-100 & 0x0f)
    let jumps = 0
    for (let k = 0; k < 100; k++) {
      const before = vm.peekVar('cpt') as number
      cycle(vm, 'S1', true)
      if ((((vm.peekVar('cpt') as number) - before) & 0x0f) >= 2) jumps++
    }
    expect(jumps).toBeGreaterThanOrEqual(1)
  })
  it('PEIE en commentaire : TMR2IF = 1, aucun appel de l’ISR TMR2, l’IOC fonctionne', () => {
    const vm = boot(SRC.replace('    INTERRUPT_PeripheralInterruptEnable();', '    //INTERRUPT_PeripheralInterruptEnable();'), tp32Config())
    vm.runFor({ ms: 5 })
    cycle(vm, 'S2', false)
    expect(vm.bus.readBit('PIR4', 'TMR2IF')).toBe(1)
    expect(vm.irqCalls.TMR2 ?? 0).toBe(0)
    expect(vm.peekVar('cpt')).toBe(0)
    cycle(vm, 'S1', false)
    expect(vm.peekVar('cpt')).toBe(1)
  })
  it('débogueur : arrêt dans BP_S1_ISR au premier appui, puis dans IT_Timer2 10 ms après l’appui sur S2', () => {
    const vm = boot(SRC, tp32Config())
    vm.runFor({ ms: 5 })
    vm.setBreakpoint('main.c', lineOf(SRC, 'cpt = (cpt + 1) & 0x0F;'))
    vm.press('S1', false)
    expect(vm.runFor({ ms: 20 })).toBe('breakpoint')
    expect(vm.functionAt()?.name).toBe('BP_S1_ISR')
    vm.clearBreakpoint()
    vm.runFor({ ms: 20 })
    vm.release('S1', false)
    vm.runFor({ ms: 20 })
    vm.setBreakpoint('main.c', lineOf(SRC, 'if (BP_S2_GetValue() == 0)'))
    const t0 = vm.t
    vm.press('S2', false)
    expect(vm.runFor({ ms: 50 })).toBe('breakpoint')
    expect(vm.functionAt()?.name).toBe('IT_Timer2')
    // Arrêt après la levée de TMR2IF (10 ms après l'appui), le temps d'aiguiller l'interruption jusqu'à IT_Timer2
    near(vm.toS(vm.timers[2].lastFlagT - t0), INFO3.tp3.debounceS, INFO3.tp3.debounceTolerance)
    expect(vm.t).toBeGreaterThan(vm.timers[2].lastFlagT)
    expect(vm.toS(vm.t - vm.timers[2].lastFlagT)).toBeLessThan(INFO3.tp1.followMaxS)
  })
})

describe('Grid View et saisie de Timer Period', () => {
  it('TMR2 T2IN : ports A et C, RC5 = GPIO BP_S2 + T2IN (icône double), écrit T2INPPS', () => {
    const c = tp32Config()
    const rows = gridRows(timerGridRows(c))
    const t2in = rows.find((r) => r.id === 'TMR2-in')!
    expect([t2in.module, t2in.func, t2in.dir]).toEqual(['TMR2', 'T2IN', 'input'])
    expect(cellState(c, rows, t2in, 'RC5')).toBe('locked')
    expect(functionCount(c, rows, 'RC5')).toBe(2)
    expect(cellState(c, rows, t2in, 'RB4')).toBe('none')
    expect(cellState(c, rows, t2in, 'RA4')).toBe('available')
    const moved = clickCell(clickCell(c, rows, t2in, 'RC5'), rows, t2in, 'RA0')
    expect(moved.timers!.TMR2!.ersPin).toBe('RA0')
    expect(generate(moved)[`${DIR}/pin_manager.c`]).toContain('T2INPPS = 0x00;   //RA0->TMR2:T2IN;')
  })
  it('parsePeriod : 10 ms, 64.516 us, 1 s ; illisible → null', () => {
    expect(parsePeriod('10 ms')).toBeCloseTo(0.01, 12)
    expect(parsePeriod('64.516 us')).toBeCloseTo(64.516e-6, 12)
    expect(parsePeriod('1 s')).toBe(1)
    expect(parsePeriod('dix')).toBeNull()
  })
  it('Monostable impose le postscaler 1:1', () => {
    const c = setControlMode(updateTimer(addTimer(tp1Config(), 'TMR2'), 'TMR2', { postscaler: 4 }), 'TMR2', 'Monostable')
    expect(c.timers!.TMR2!.postscaler).toBe(1)
    expect(c.timers!.TMR2!.startOption).toBe('Starts on rising edge on {ers}')
  })
})

describe('sans timer : TP1 et TP2 inchangés', () => {
  it('pas de tmr2.c, pas de PPS', () => {
    for (const c of [tp1Config(), tp21Config()]) {
      const g = generate(c)
      expect(Object.keys(g).some((f) => f.includes('tmr'))).toBe(false)
      expect(g[`${DIR}/pin_manager.c`]).not.toContain('INPPS')
    }
  })
})
