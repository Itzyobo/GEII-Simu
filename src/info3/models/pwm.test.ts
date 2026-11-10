/**
 * Modèle pwm dans la VM, piloté uniquement par les registres (CCP1, PWM6, PWM7, TMR2, PPS).
 * Consigne étape 5, tests 2, 3 et 10.
 */
import { describe, expect, it } from 'vitest'
import { INFO3 } from '../../data/reference'
import { compile, formatDiagnostic } from '../compiler'
import { periodicOf } from '../vm/trace'
import { Vm } from '../vm/vm'
import { dutyRatio } from './pwm'

const S = 1 / INFO3.clock.timeBaseHz
/** Code CKPS de T2CON pour un prescaler 1:2^n */
const ckps = (pre: number) => Math.log2(pre) << 4

/** PWM6 → RD4, PWM7 → RC0, CCP1 → RC1 (PPS), TMR2 en FOSC/4, PR2 = 0xFF ; Fosc et rapports cycliques au choix */
function program(o: { mhz?: number; pre?: number; duty?: number; pps?: boolean; tsel?: number; clk?: number; pol?: boolean } = {}) {
  const duty = o.duty ?? 512
  const frq = (INFO3.clock.hfintoscMHz as readonly number[]).indexOf(o.mhz ?? 4)
  const pps = o.pps ?? true
  return `#include <xc.h>
void main(void)
{
    OSCCON1 = 0x60; OSCFRQ = ${frq};
    TRISD = 0x00; TRISC = 0x00; ANSELD = 0x00; ANSELC = 0x00;
    ${pps ? 'RD4PPS = 0x0E; RC0PPS = 0x0F; RC1PPS = 0x09;' : ''}
    PWM6CON = ${o.pol ? '0x90' : '0x80'}; PWM6DCH = ${duty >> 2}; PWM6DCL = ${(duty & 3) << 6};
    PWM7CON = 0x80; PWM7DCH = ${duty >> 2}; PWM7DCL = ${(duty & 3) << 6};
    CCP1CON = 0x8F; CCPR1H = ${duty >> 8}; CCPR1L = ${duty & 0xff};
    CCPTMRS0 = ${o.tsel ?? 1}; CCPTMRS1 = ${(o.tsel ?? 1) * 0x15};
    T2CLKCON = ${o.clk ?? 1}; T2PR = 0xFF; T2CON = ${0x80 | ckps(o.pre ?? 16)};
    while (1) { }
}
`
}

function run(src: string, ms = 50) {
  const r = compile({ 'main.c': src })
  if (!r.ok) throw new Error(r.diagnostics.map(formatDiagnostic).join('\n'))
  const vm = new Vm()
  vm.load(r.program!)
  vm.runFor({ ms })
  return vm
}

const measure = (vm: Vm, pin: string, fromMs = 20) => {
  const t1 = vm.t
  const m = periodicOf(vm.gpio.trace, pin, vm.msToTicks(fromMs), t1)
  return { periodS: m.period === null ? null : m.period * S, duty: m.duty }
}
const rel = (a: number, b: number) => Math.abs(a - b) / b
const PINS = { PWM6: 'RD4', PWM7: 'RC0', CCP1: 'RC1' }

describe('période PWM = (PR2 + 1) · 4 · Tosc · prescaler (test 2)', () => {
  it('Fosc 4 MHz, PR2 = 0xFF : 1:16 → 4,096 ms ; 1:4 → 1,024 ms ; Fosc 1 MHz, 1:4 → 4,096 ms (± 0,5 %)', () => {
    for (const [mhz, pre, target] of [[4, 16, 4.096e-3], [4, 4, 1.024e-3], [1, 4, 4.096e-3]] as const) {
      const vm = run(program({ mhz, pre }), 60)
      for (const pin of Object.values(PINS)) {
        const p = measure(vm, pin).periodS
        expect(p, `${mhz} MHz 1:${pre} ${pin}`).not.toBeNull()
        expect(rel(p!, target), `${mhz} MHz 1:${pre} ${pin} : ${p}`).toBeLessThanOrEqual(0.005)
      }
    }
  })
})

describe('rapport cyclique = seuil / (4 · (PR2 + 1)) (test 3)', () => {
  it('512 / 1023 / 1024 / 0 → 50 % / 99,9 % / 100 % / 0 % sur PWM6, PWM7 et CCP1', () => {
    for (const [duty, target] of [[512, 0.5], [1023, 1023 / 1024], [1024, 1], [0, 0]] as const) {
      // 1024 ne tient pas sur 10 bits : seuil ≥ 4·(PR2+1) → toujours 1 n'est atteignable qu'avec PR2 < 0xFF
      const src = duty === 1024 ? program({ duty: 1023 }).replace('T2PR = 0xFF', 'T2PR = 0xFE') : program({ duty })
      const vm = run(src, 60)
      for (const [mod, pin] of Object.entries(PINS)) {
        const d = measure(vm, pin).duty
        const want = duty === 1024 ? 1 : target
        expect(Math.abs(d - want), `${mod} seuil ${duty} : ${d}`).toBeLessThanOrEqual(0.005)
        expect(vm.pwm[mod].ratio(), mod).toBeCloseTo(want, 3)
      }
    }
    expect(dutyRatio(1024, 256)).toBe(1)
    expect(dutyRatio(1023, 256)).toBeCloseTo(0.999, 3)
  })
  it('PWM6POL = 1 : sortie complémentée ; CCP1 cadencé par TMR4 (CCPTMRS0 = 2) sans TMR4 en marche : sortie à 0', () => {
    expect(measure(run(program({ duty: 256, pol: true }), 60), 'RD4').duty).toBeCloseTo(0.75, 2)
    const vm = run(program({ tsel: 2 }), 60)
    expect(measure(vm, 'RC1').duty).toBe(0)
  })
})

describe('PPS (test 10)', () => {
  it('sans RD4PPS = PWM6 : RD4 reste à LATD4 = 0, la LED rouge reste éteinte', () => {
    const vm = run(program({ pps: false }), 60)
    for (const pin of Object.values(PINS)) expect(measure(vm, pin).duty, pin).toBe(0)
    expect(vm.pwm.PWM6.level === 0 || vm.pwm.PWM6.level === 1).toBe(true)
    expect(vm.ppsPinsOf(0x0e)).toEqual([])
  })
  it('avec PPS mais broche en entrée (TRISD4 = 1) : rien sur RD4', () => {
    const vm = run(program().replace('TRISD = 0x00;', 'TRISD = 0xFF;'), 60)
    expect(measure(vm, 'RD4').duty).toBe(0)
    expect(vm.ppsPinsOf(0x0e)).toEqual(['RD4'])
  })
})

describe('double tampon et source d’horloge (H41)', () => {
  it('le nouveau seuil ne s’applique qu’au début de la période suivante', () => {
    const vm = run(program({ duty: 0 }), 20)
    vm.writeSfr('PWM6DCH', 0xff)
    vm.writeSfr('PWM6DCL', 0xc0)
    expect(vm.getPin('RD4')).toBe(0)
    vm.runFor({ ms: 30 })
    expect(measure(vm, 'RD4', 30).duty).toBeGreaterThan(0.99)
  })
  it('TMR2 en LFINTOSC (31 kHz), 1:1 : période = 256 / 31 kHz (le modèle suit l’horloge choisie)', () => {
    const lf = INFO3.timers.clockSources.find((c) => c.label === 'LFINTOSC')!.cs
    const vm = run(program({ clk: lf, pre: 1 }), 120)
    const p = measure(vm, 'RD4', 40).periodS!
    expect(rel(p, 256 / INFO3.clock.lfintosc)).toBeLessThanOrEqual(0.005)
  })
})
