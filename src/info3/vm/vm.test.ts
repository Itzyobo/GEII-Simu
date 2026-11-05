import { describe, expect, it } from 'vitest'
import { INFO3 } from '../../data/reference'
import { compile, formatDiagnostic } from '../compiler'
import { crProject } from '../fixtures'
import { Vm } from './vm'

function boot(src: string | Record<string, string>) {
  const r = compile(typeof src === 'string' ? { 'main.c': src } : src)
  if (!r.ok) throw new Error(r.diagnostics.map(formatDiagnostic).join('\n'))
  const vm = new Vm()
  vm.load(r.program!)
  return vm
}

describe('temps simulé', () => {
  it('__delay_ms(n) avance exactement n × Fosc/4/1000 Tcy', () => {
    const src = '#define _XTAL_FREQ 1000000\n#include <xc.h>\nuint8_t done = 0;\nvoid main(void) { __delay_ms(250); done = 1; while (1) { } }\n'
    const r = compile({ 'main.c': src })
    const code = r.program!.code
    // _XTAL_FREQ = 1 MHz, sans OSCILLATOR_Initialize : le PIC tourne à l'horloge de reset (1 MHz, RSTOSC = HFINT1)
    const xtal = 1e6
    const expectedTcy = (250 * xtal) / INFO3.clock.foscPerTcy / INFO3.units.msPerS
    // Le delay est la première instruction de main : un seul DELAY de 62 500 Tcy
    const main = r.program!.funcs[r.program!.mainIndex]
    expect(code[main.entry + 2]).toBe(expectedTcy)
    const vm = boot(src)
    vm.runFor({ tcy: expectedTcy })
    expect(vm.peekVar('done')).toBe(0)
    const r2 = vm.runFor({ tcy: INFO3.cpu.cost.op16 })
    expect([r2, vm.t / vm.ticksPerTcy, vm.output]).toEqual(['time', expectedTcy + INFO3.cpu.cost.op16, []])
    expect(vm.peekVar('done')).toBe(1)
  })
})

const ISR_PROG = `#include <xc.h>
volatile uint16_t calls = 0;
volatile uint8_t gieInIsr = 0xFF;
void __interrupt() isr(void) {
    gieInIsr = INTCONbits.GIE;
    if (PIE0bits.TMR0IE && PIR0bits.TMR0IF) { PIR0bits.TMR0IF = 0; calls++; }
    else if (PIE4bits.TMR2IE && PIR4bits.TMR2IF) { PIR4bits.TMR2IF = 0; calls++; }
}
void main(void) { while (1) { NOP(); } }
`

describe('interruptions (via raiseFlag)', () => {
  const setBit = (vm: Vm, sfr: string, bit: string, v: 0 | 1) => vm.bus.writeBit(sfr, bit, v)

  it('TMR0IF + TMR0IE + GIE → ISR appelée 1 fois par flag ; GIE remis à 1 au retour', () => {
    const vm = boot(ISR_PROG)
    setBit(vm, 'PIE0', 'TMR0IE', 1)
    setBit(vm, 'INTCON', 'GIE', 1)
    for (let k = 1; k <= 5; k++) {
      vm.raiseFlag('PIR0', 'TMR0IF')
      vm.runFor({ ms: 1 })
      expect(vm.peekVar('calls')).toBe(k)
    }
    expect(vm.peekVar('gieInIsr')).toBe(0)
    expect(vm.bus.readBit('INTCON', 'GIE')).toBe(1)
    expect(vm.bus.readBit('PIR0', 'TMR0IF')).toBe(0)
  })

  it('GIE = 0 → 0 appel (le flag reste à 1)', () => {
    const vm = boot(ISR_PROG)
    setBit(vm, 'PIE0', 'TMR0IE', 1)
    vm.raiseFlag('PIR0', 'TMR0IF')
    vm.runFor({ ms: 5 })
    expect(vm.peekVar('calls')).toBe(0)
    expect(vm.bus.readBit('PIR0', 'TMR0IF')).toBe(1)
  })

  it('TMR2IF + TMR2IE sans PEIE → 0 appel ; avec PEIE → 1 appel', () => {
    const vm = boot(ISR_PROG)
    setBit(vm, 'PIE4', 'TMR2IE', 1)
    setBit(vm, 'INTCON', 'GIE', 1)
    vm.raiseFlag('PIR4', 'TMR2IF')
    vm.runFor({ ms: 5 })
    expect(vm.peekVar('calls')).toBe(0)
    setBit(vm, 'INTCON', 'PEIE', 1)
    vm.runFor({ ms: 5 })
    expect(vm.peekVar('calls')).toBe(1)
    expect(vm.bus.readBit('INTCON', 'GIE')).toBe(1)
  })

  it('latence d’entrée dans [3, 5] Tcy', () => {
    const vm = boot(ISR_PROG)
    setBit(vm, 'PIE0', 'TMR0IE', 1)
    setBit(vm, 'INTCON', 'GIE', 1)
    vm.runFor({ ms: 1 })
    const pcBefore = vm.pc
    const t0 = vm.t
    vm.raiseFlag('PIR0', 'TMR0IF')
    vm.runFor({ tcy: 1 })
    const lat = (vm.t - t0) / vm.ticksPerTcy
    expect(vm.stackDepth).toBe(1)
    expect(pcBefore).not.toBe(vm.pc)
    expect(lat).toBeGreaterThanOrEqual(INFO3.cpu.interruptLatencyTcy.min)
    expect(lat).toBeLessThanOrEqual(INFO3.cpu.interruptLatencyTcy.max + INFO3.cpu.cost.op32)
  })
})

describe('variable volatile 16 bits lue en deux accès de 8 bits', () => {
  const prog = (critical: boolean) => `#include <xc.h>
volatile uint16_t v = 0xFFFF;
uint16_t reads = 0, bad = 0;
void __interrupt() isr(void) {
    PIR0bits.TMR0IF = 0;
    v = (v == 0xFFFF) ? 0x0000 : 0xFFFF;
}
void main(void) {
    uint16_t c;
    PIE0bits.TMR0IE = 1;
    INTCONbits.GIE = 1;
    while (reads < 10000) {
        ${critical ? 'INTCONbits.GIE = 0; c = v; INTCONbits.GIE = 1;' : 'c = v;'}
        if (c != 0xFFFF && c != 0x0000) bad++;
        reads++;
    }
    while (1) { }
}
`
  const drive = (vm: Vm) => {
    let k = 0
    // Flags levés à des instants variés pour tomber partout dans la boucle
    // Écart entre deux flags (Tcy) supérieur à la durée de l'ISR, décalage variable (nombres premiers)
    while ((vm.peekVar('reads') as number) < 10000 && k < 200000) {
      vm.runFor({ tcy: 97 + (k % 53) })
      vm.raiseFlag('PIR0', 'TMR0IF')
      k++
    }
  }
  it('sans section critique : au moins une lecture incohérente (0xFF00 ou 0x00FF) sur 10 000', () => {
    const vm = boot(prog(false))
    drive(vm)
    expect(vm.peekVar('reads')).toBe(10000)
    expect(vm.peekVar('bad') as number).toBeGreaterThanOrEqual(1)
  })
  it('avec GIE = 0 autour de la copie : 0 lecture incohérente', () => {
    const vm = boot(prog(true))
    drive(vm)
    expect(vm.peekVar('reads')).toBe(10000)
    expect(vm.peekVar('bad')).toBe(0)
  })
})

describe('pile matérielle de 16 niveaux', () => {
  const chain = (depth: number) => {
    const lines = ['#include <xc.h>', 'uint8_t done = 0;']
    for (let i = depth; i >= 1; i--) lines.push(`void f${i}(void) { ${i === depth ? 'done = 1;' : `f${i + 1}();`} }`)
    lines.push('void main(void) { f1(); while (1) { } }')
    return lines.join('\n') + '\n'
  }
  it('16 appels imbriqués : OK', () => {
    const vm = boot(chain(INFO3.cpu.hwStackDepth))
    vm.runFor({ ms: 5 })
    expect(vm.peekVar('done')).toBe(1)
    expect(vm.bus.readBit('PCON0', 'STKOVF')).toBe(0)
    expect(vm.output.filter((o) => o.text.includes('Stack overflow'))).toEqual([])
  })
  it('17e appel : STKOVF = 1, reset, message dans la sortie', () => {
    const vm = boot(chain(INFO3.cpu.hwStackDepth + 1))
    vm.runFor({ ms: 5 })
    expect(vm.peekVar('done')).toBe(0)
    expect(vm.bus.readBit('PCON0', 'STKOVF')).toBe(1)
    expect(vm.output.some((o) => o.text === 'Stack overflow reset')).toBe(true)
  })
  it('F13 : STVREN = OFF → STKOVF = 1 sans reset (H29)', () => {
    const vm = boot('#pragma config STVREN = OFF\n' + chain(INFO3.cpu.hwStackDepth + 1))
    vm.runFor({ ms: 5 })
    expect(vm.peekVar('done')).toBe(1)
    expect(vm.bus.readBit('PCON0', 'STKOVF')).toBe(1)
    expect(vm.output.filter((o) => o.text.includes('Stack overflow'))).toEqual([])
  })
  it('F13 : STVREN = ON explicite → reset au 17e appel', () => {
    const vm = boot('#pragma config STVREN = ON\n' + chain(INFO3.cpu.hwStackDepth + 1))
    vm.runFor({ ms: 5 })
    expect(vm.peekVar('done')).toBe(0)
    expect(vm.bus.readBit('PCON0', 'STKOVF')).toBe(1)
    expect(vm.output.some((o) => o.text === 'Stack overflow reset')).toBe(true)
  })
  it('l’ISR compte dans la pile : 16 niveaux en main + interruption → débordement', () => {
    const lines = ['#include <xc.h>', 'void __interrupt() isr(void) { PIR0bits.TMR0IF = 0; }']
    const depth = INFO3.cpu.hwStackDepth
    for (let i = depth; i >= 1; i--) lines.push(`void f${i}(void) { ${i === depth ? 'PIE0bits.TMR0IE = 1; INTCONbits.GIE = 1; PIR0bits.TMR0IF = 1; while (1) { }' : `f${i + 1}();`} }`)
    lines.push('void main(void) { f1(); }')
    const vm = boot(lines.join('\n') + '\n')
    vm.runFor({ ms: 2 })
    expect(vm.bus.readBit('PCON0', 'STKOVF')).toBe(1)
  })
})

describe('débogueur : un seul point d’arrêt, pas à pas', () => {
  it('un 2e setBreakpoint remplace le 1er et renvoie un avertissement', () => {
    const vm = boot(crProject('tp1/q3_3'))
    const a = vm.setBreakpoint('main.c', 7)
    expect(a.ok).toBe(true)
    expect(a.warning).toBeUndefined()
    const b = vm.setBreakpoint('main.c', 8)
    expect(b.ok).toBe(true)
    expect(b.warning).toMatch(/Un seul point d'arrêt/)
    expect(vm.getBreakpoint()).toEqual({ file: 'main.c', line: 8 })
    expect(vm.runFor({ ms: 2000 })).toBe('breakpoint')
    expect(vm.sourcePos(vm.pc)).toEqual({ file: 'main.c', line: 8 })
  })
  it('step() avance d’une ligne source', () => {
    const vm = boot(crProject('tp1/q3_3'))
    vm.setBreakpoint('main.c', 7)
    expect(vm.runFor({ ms: 2000 })).toBe('breakpoint')
    expect(vm.sourcePos(vm.pc).line).toBe(7)
    expect(vm.step()).toBe('step')
    expect(vm.sourcePos(vm.pc)).toEqual({ file: 'main.c', line: 8 })
    const t0 = vm.timeS
    expect(vm.step()).toBe('step')
    expect(vm.sourcePos(vm.pc).line).toBe(7)
    // La ligne 8 est __delay_ms(500) : le pas a duré 500 ms
    expect(vm.timeS - t0).toBeGreaterThanOrEqual(0.5)
    expect(vm.timeS - t0).toBeLessThan(0.501)
  })
  it('step() entre dans une fonction appelée (SYSTEM_Initialize → mcc.c)', () => {
    const vm = boot(crProject('tp1/q3_3'))
    expect(vm.sourcePos(vm.pc)).toEqual({ file: 'main.c', line: 4 })
    vm.step()
    expect(vm.sourcePos(vm.pc).file).toBe('mcc_generated_files/mcc.c')
  })
})

describe('Step Over / Step Out (C7)', () => {
  const SRC = `#include <xc.h>
uint8_t n = 0;
void inner(void) {
    n++;
    n++;
}
void outer(void) {
    inner();
    n += 10;
}
void main(void) {
    outer();
    n = 100;
    while (1) { }
}
`
  it('stepOver ne s’arrête pas dans la fonction appelée', () => {
    const vm = boot(SRC)
    expect(vm.sourcePos(vm.pc).line).toBe(12)
    expect(vm.stepOver()).toBe('step')
    expect(vm.sourcePos(vm.pc)).toEqual({ file: 'main.c', line: 13 })
    expect(vm.peekVar('n')).toBe(12)
  })
  it('step entre, stepOut ressort dans l’appelant', () => {
    const vm = boot(SRC)
    vm.step()
    expect(vm.sourcePos(vm.pc).line).toBe(8)
    vm.step()
    expect(vm.sourcePos(vm.pc).line).toBe(4)
    expect(vm.stepOut()).toBe('step')
    expect(vm.stackDepth).toBe(1)
    expect(vm.peekVar('n')).toBe(2)
    // `inner();` n'a plus rien à exécuter sur la ligne 8 : arrêt sur la ligne suivante de l'appelant
    expect(vm.sourcePos(vm.pc).line).toBe(9)
    vm.stepOut()
    expect(vm.stackDepth).toBe(0)
    expect(vm.peekVar('n')).toBe(12)
  })
})

describe('appel unitaire (invoke) et horloge pilotée par les registres', () => {
  it('invoke : variable globale préparée par pokeVar, fonction à pointeur', () => {
    const vm = boot(`#include <xc.h>
uint8_t g = 0;
void dbl(void) { g = g * 2; }
uint8_t inc(uint8_t *p) { (*p)++; return *p + 1; }
void main(void) { while (1) { } }
`)
    vm.pokeVar('g', 21)
    expect(vm.invoke('dbl')).toEqual({ ok: true, value: 0 })
    expect(vm.peekVar('g')).toBe(42)
    const addr = INFO3.vm.memory.size - 1
    vm.pokeByte(addr, 7)
    expect(vm.invoke('inc', [addr])).toEqual({ ok: true, value: 9 })
    expect(vm.peekByte(addr)).toBe(8)
    expect(vm.invoke('absente')).toEqual({ ok: false, error: 'fonction absente introuvable' })
  })
  it('Fosc suit OSCCON1 / OSCFRQ (HFINTOSC 32 MHz / 1)', () => {
    const vm = boot('#include <xc.h>\nvoid main(void) { OSCFRQ = 0x06; OSCCON1 = 0x60; while (1) { } }\n')
    // Horloge de reset : RSTOSC = HFINT1 (1 MHz) jusqu'à l'écriture d'OSCCON1
    expect(vm.fosc).toBe(1e6)
    vm.runFor({ ms: 1 })
    expect(vm.fosc).toBe(32e6)
    expect(vm.ticksPerTcy).toBe((INFO3.clock.timeBaseHz * INFO3.clock.foscPerTcy) / 32e6)
  })
})

describe('peekVar, readSfr, writeSfr, getPin', () => {
  it('variable locale de main, SFR par nom, broche', () => {
    const vm = boot(crProject('tp1/q3_5'))
    vm.runFor({ ms: 1500 })
    expect(vm.peekVar('main:Chenille')).toBe(2)
    expect(vm.readSfr('TRISA')).toBe(0x0f)
    expect(vm.getPin('RA5')).toBe(1)
    vm.writeSfr('LATA', 0x80)
    expect(vm.getPin('RA7')).toBe(1)
    expect(vm.getPin('RA5')).toBe(0)
  })
})
