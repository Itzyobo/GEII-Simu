import { describe, expect, it } from 'vitest'
import { compile, formatDiagnostic } from '../compiler'
import { generate } from '../mcc/generator'
import { tp42Config } from '../mcc/presets'
import type { MccConfig } from '../mcc/config'
import { Vm, type RotarySlot } from '../vm/vm'
import { Hc595x2 } from './hc595x2'
import { createSimState, handleMessage } from '../worker/handler'
import type { OutMsg } from '../worker/protocol'

const HEAD = '#include "mcc_generated_files/mcc.h"\n'
/** Fonctions de l'anneau : octet de poids fort d'abord (il finit dans U3, LED 9 à 16), puis front de LATCH */
const RING = `void led_ring_display16(uint16_t s)
{
    SPI1_ExchangeByte(s >> 8);
    SPI1_ExchangeByte(s & 0xFF);
    LATCH_SetLow();
    LATCH_SetHigh();
}
`
function boot(main: string, cfg: MccConfig, slot: RotarySlot | null = 'mikrobus2') {
  const r = compile({ 'main.c': main, ...generate(cfg) })
  if (!r.ok) throw new Error(r.diagnostics.map(formatDiagnostic).join('\n'))
  const vm = new Vm()
  vm.setRotarySlot(slot)
  vm.load(r.program!)
  return vm
}
const lit = (vm: Vm) => Array.from({ length: 16 }, (_, k) => k + 1).filter((k) => vm.ring.led(k))
const once = (byte: string) => `${HEAD}void main(void)\n{\n    SYSTEM_Initialize();\n    RST_SetHigh();\n    SPI1_Open(SPI1_DEFAULT);\n    SPI1_ExchangeByte(${byte});\n    LATCH_SetHigh();\n    while (1) {}\n}\n`

describe('hc595x2 (modèle seul)', () => {
  it('décalage, MR, LATCH, Q7S', () => {
    const r = new Hc595x2()
    r.reset(1, 0)
    for (const b of [1, 0, 1]) r.clock(b as 0 | 1)
    expect(r.shift).toBe(0b101)
    expect(r.outputs).toBe(0)
    expect(r.setLatch(1)).toBe(true)
    expect([r.led(1), r.led(2), r.led(3)]).toEqual([true, false, true])
    r.setMr(0)
    expect(r.shift).toBe(0)
    expect(r.outputs).toBe(0b101)
  })
})

describe('anneau de 16 LED (tests 5 à 10)', () => {
  it('test 5 : 0x31 une fois en mode 0 puis LATCH → LED 1, 5, 6 ; répété toutes les 100 ms → LED 9, 13, 14 en plus', () => {
    const vm = boot(once('0x31'), tp42Config(0))
    vm.runFor({ ms: 5 })
    expect(lit(vm)).toEqual([1, 5, 6])
    const rep = boot(`${HEAD}void main(void)\n{\n    SYSTEM_Initialize();\n    RST_SetHigh();\n    SPI1_Open(SPI1_DEFAULT);\n    while (1)\n    {\n        SPI1_ExchangeByte(0x31);\n        LATCH_SetHigh();\n        __delay_ms(1);\n        LATCH_SetLow();\n        __delay_ms(99);\n    }\n}\n`, tp42Config(0))
    rep.runFor({ ms: 50 })
    expect(lit(rep)).toEqual([1, 5, 6])
    rep.runFor({ ms: 100 })
    expect(lit(rep)).toEqual([1, 5, 6, 9, 13, 14])
  })
  it('test 6 : modes 1 et 2 → motif décalé d’un rang (H14) ; mode 3 identique au mode 0', () => {
    const outputs = (mode: number) => {
      const vm = boot(once('0x31'), tp42Config(mode))
      vm.runFor({ ms: 5 })
      return vm.ring.outputs
    }
    expect(outputs(0)).toBe(0x31)
    expect(outputs(3)).toBe(0x31)
    expect(outputs(1)).toBe(0x31 >> 1)
    expect(outputs(2)).toBe(0x31 >> 1)
  })
  it('test 7 : RST laissé en entrée → anneau éteint 10 s ; RST à 1 → fonctionne ; LATCH jamais basculé → inchangé', () => {
    const loop = `${HEAD}${RING}void main(void)\n{\n    SYSTEM_Initialize();\n    SPI1_Open(SPI1_DEFAULT);\n    while (1)\n    {\n        led_ring_display16(0xFFFF);\n        __delay_ms(100);\n    }\n}\n`
    // Configuration sans RST : RD2 reste une entrée en l'air (H36)
    const noRst = { ...tp42Config(0), pins: tp42Config(0).pins.filter((p) => p.customName !== 'RST') }
    const vm = boot(loop, noRst)
    let ever = 0
    vm.onRing((_, o) => (ever |= o))
    vm.runFor({ ms: 10_000 })
    expect(ever).toBe(0)
    const ok = boot(loop.replace('SPI1_Open(SPI1_DEFAULT);', 'RST_SetHigh();\n    SPI1_Open(SPI1_DEFAULT);'), tp42Config(0))
    ok.runFor({ ms: 50 })
    expect(lit(ok)).toHaveLength(16)
    const noLatch = boot(`${HEAD}void main(void)\n{\n    SYSTEM_Initialize();\n    RST_SetHigh();\n    SPI1_Open(SPI1_DEFAULT);\n    while (1)\n    {\n        SPI1_ExchangeByte(0xFF);\n        __delay_ms(10);\n    }\n}\n`, tp42Config(0))
    noLatch.runFor({ ms: 200 })
    expect(noLatch.ring.outputs).toBe(0)
  })
  it('test 8 : display16(0x8001) → LED 1 et 16 ; octets inversés → LED 8 et 9', () => {
    const main = (fn: string) => `${HEAD}${fn}void main(void)\n{\n    SYSTEM_Initialize();\n    RST_SetHigh();\n    SPI1_Open(SPI1_DEFAULT);\n    led_ring_display16(0x8001);\n    while (1) {}\n}\n`
    const vm = boot(main(RING), tp42Config(0))
    vm.runFor({ ms: 5 })
    expect(lit(vm)).toEqual([1, 16])
    const swapped = RING.replace('SPI1_ExchangeByte(s >> 8);\n    SPI1_ExchangeByte(s & 0xFF);', 'SPI1_ExchangeByte(s & 0xFF);\n    SPI1_ExchangeByte(s >> 8);')
    const bad = boot(main(swapped), tp42Config(0))
    bad.runFor({ ms: 5 })
    expect(lit(bad)).toEqual([8, 9])
  })
  it('test 9 : après display16(0xABCD), ExchangeByte(0x00) renvoie 0xAB (Q7S de U3)', () => {
    const vm = boot(`${HEAD}${RING}volatile uint8_t back;\nvoid main(void)\n{\n    SYSTEM_Initialize();\n    RST_SetHigh();\n    SPI1_Open(SPI1_DEFAULT);\n    led_ring_display16(0xABCD);\n    back = SPI1_ExchangeByte(0x00);\n    while (1) {}\n}\n`, tp42Config(0))
    vm.runFor({ ms: 5 })
    expect(vm.peekVar('back')).toBe(0xab)
  })
  it('test 10 : carte Rotary sur le mikroBUS 1 → aucune LED de l’anneau', () => {
    const vm = boot(`${HEAD}${RING}void main(void)\n{\n    SYSTEM_Initialize();\n    RST_SetHigh();\n    SPI1_Open(SPI1_DEFAULT);\n    uint8_t i = 0;\n    while (1)\n    {\n        led_ring_display16((uint16_t)1 << i);\n        i = (i + 1) & 0x0F;\n        __delay_ms(100);\n    }\n}\n`, tp42Config(0), 'mikrobus1')
    let ever = 0
    vm.onRing((_, o) => (ever |= o))
    vm.runFor({ ms: 2000 })
    expect(ever).toBe(0)
  })
  it('Worker : l’image transmet la lueur des LED 1, 5 et 6', () => {
    const state = createSimState(() => 0)
    handleMessage(state, { type: 'bench', rotary: 'mikrobus2' })
    handleMessage(state, { type: 'load', files: { 'main.c': once('0x31'), ...generate(tp42Config(0)) } })
    handleMessage(state, { type: 'run', speed: 1 })
    const out: OutMsg[] = []
    for (let i = 0; i < 6; i++) out.push(...handleMessage(state, { type: 'tick', wallMs: 10 }))
    const frames = out.filter((m): m is Extract<OutMsg, { type: 'frame' }> => m.type === 'frame' && !!m.ringDuty)
    const last = frames[frames.length - 1].ringDuty!
    expect(last.map((d, k) => (d > 0.5 ? k + 1 : 0)).filter(Boolean)).toEqual([1, 5, 6])
  })
  it('sans carte Rotary : SPI sans effet, aucune erreur', () => {
    const vm = boot(once('0x31'), tp42Config(3), null)
    vm.runFor({ ms: 5 })
    expect(vm.ring.outputs).toBe(0)
  })
})
