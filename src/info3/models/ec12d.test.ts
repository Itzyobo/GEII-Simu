import { describe, expect, it } from 'vitest'
import { INFO3 } from '../../data/reference'
import { compile, formatDiagnostic } from '../compiler'
import { CR_FIXTURES, SOLUTIONS } from '../fixtures'
import { generate } from '../mcc/generator'
import { tp23Config } from '../mcc/presets'
import { Vm, type RotarySlot } from '../vm/vm'
import { Ec12d } from './ec12d'

describe('ec12d', () => {
  it('30 crans par tour, 15 impulsions par voie, A = B aux crans, A en avance en sens horaire (H9)', () => {
    const e = new Ec12d()
    let rises = 0
    for (let i = 0; i < INFO3.rotary.detentsPerTurn; i++) {
      const edges = e.step(1)
      expect(edges.map((x) => x.channel)).toEqual(['A', 'B'])
      expect(e.a).toBe(e.b)
      if (edges[0].level === 1) rises++
    }
    expect(rises).toBe(INFO3.rotary.pulsesPerTurn)
    expect(e.step(-1).map((x) => x.channel)).toEqual(['B', 'A'])
  })
  it('broches selon le mikroBUS : 2 → ENCA RD1, ENCB RA2, SW RB0 ; 1 → ENCA RC2, ENCB RA1', () => {
    expect(Vm.rotaryPinsOf('mikrobus2')).toEqual({ A: 'RD1', B: 'RA2', SW: 'RB0' })
    expect(Vm.rotaryPinsOf('mikrobus1')).toMatchObject({ A: 'RC2', B: 'RA1' })
  })
})

function boot(main: string, slot: RotarySlot | null) {
  const r = compile({ 'main.c': main, ...generate(tp23Config()) })
  if (!r.ok) throw new Error(r.diagnostics.map(formatDiagnostic).join('\n'))
  const vm = new Vm()
  vm.setRotarySlot(slot)
  vm.load(r.program!)
  vm.runFor({ ms: 5 })
  return vm
}
const STEP_MS = 20

describe('TP2 §2.3 : tp2/q2_3 (code du CR), D3 suit le sens', () => {
  it('mikroBUS 2 : 30 crans horaires → D3 = 1 après chaque cran ; 30 antihoraires → D3 = 0', () => {
    const vm = boot(CR_FIXTURES['tp2/q2_3'], 'mikrobus2')
    let cw = 0
    for (let i = 0; i < 30; i++) {
      vm.turn(1)
      vm.runFor({ ms: STEP_MS })
      if (vm.getPin('RA5') === 1) cw++
    }
    expect(cw).toBe(30)
    let ccw = 0
    for (let i = 0; i < 30; i++) {
      vm.turn(-1)
      vm.runFor({ ms: STEP_MS })
      if (vm.getPin('RA5') === 0) ccw++
    }
    expect(ccw).toBe(30)
  })
  it('mikroBUS 1 : RD1 et RA2 flottent (H20), D2 et D3 ne bougent jamais', () => {
    const vm = boot(CR_FIXTURES['tp2/q2_3'], 'mikrobus1')
    const before = vm.gpio.trace.filter((c) => c.pin === 'RA4' || c.pin === 'RA5').length
    for (let i = 0; i < 30; i++) {
      vm.turn(i < 15 ? 1 : -1)
      vm.runFor({ ms: STEP_MS })
    }
    expect(vm.gpio.trace.filter((c) => c.pin === 'RA4' || c.pin === 'RA5').length).toBe(before)
    expect(vm.irqCalls.IOC ?? 0).toBe(0)
  })
})

describe('TP2 §2.4 : compteur 4 bits (solution de référence)', () => {
  it('+30 crans → 30 & 0x0F sur D5…D2 ; −30 → 0', () => {
    const vm = boot(SOLUTIONS['tp2/q2_4'], 'mikrobus2')
    vm.turn(30)
    vm.runFor({ ms: 30 * 5 + 20 })
    expect(vm.peekVar('cpt')).toBe(30 & 0x0f)
    expect(vm.readSfr('LATA') >> 4).toBe(30 & 0x0f)
    vm.turn(-30)
    vm.runFor({ ms: 30 * 5 + 20 })
    expect(vm.peekVar('cpt')).toBe(0)
  })
  it('rotation continue à 10 crans/s pendant 1 s : +10', () => {
    const vm = boot(SOLUTIONS['tp2/q2_4'], 'mikrobus2')
    vm.spin(INFO3.rotary.spinRate.max)
    vm.runFor({ ms: 1000 - 1 })
    vm.spin(0)
    vm.runFor({ ms: 50 })
    expect(vm.encoder.position).toBe(INFO3.rotary.spinRate.max)
    expect(vm.peekVar('cpt')).toBe(INFO3.rotary.spinRate.max)
  })
})
