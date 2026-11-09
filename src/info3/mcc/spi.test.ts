import { describe, expect, it } from 'vitest'
import { INFO3 } from '../../data/reference'
import { compile, formatDiagnostic } from '../compiler'
import { intervals, pinEdges } from '../vm/trace'
import { Vm } from '../vm/vm'
import { addMssp, updateMssp, type MccConfig } from './config'
import { generate } from './generator'
import { tp1Config } from './presets'
import { sckFrequency, spiRegisters } from './spi'

const DIR = INFO3.mcc.dir
const spiCfg = (mode: number, clockSource = 'FOSC/4', hfMHz = 4): MccConfig => {
  const c = addMssp({ ...tp1Config(), system: { ...tp1Config().system, hfMHz } })
  return updateMssp(c, { mode, clockSource })
}
function boot(main: string, cfg: MccConfig) {
  const r = compile({ 'main.c': main, ...generate(cfg) })
  if (!r.ok) throw new Error(r.diagnostics.map(formatDiagnostic).join('\n'))
  const vm = new Vm()
  vm.load(r.program!)
  return vm
}
const HEAD = '#include "mcc_generated_files/mcc.h"\n'
const SEND = `${HEAD}void main(void)\n{\n    SYSTEM_Initialize();\n    SPI1_Open(SPI1_DEFAULT);\n    while (1)\n    {\n        SPI1_WriteByte(0x31);\n        __delay_ms(100);\n    }\n}\n`
const near = (v: number, target: number, tol = 0.01) => expect(Math.abs(v - target) / target).toBeLessThanOrEqual(tol)

describe('MSSP1 : MCC et code généré (test 1)', () => {
  it('mode 3, Fosc/4 : SSP1STAT = 0x00, SSP1CON1 = 0x10 avant Open, 0x30 après ; TRIS RB1 = RB3 = 0', () => {
    const cfg = spiCfg(3)
    expect(spiRegisters(cfg.mssp!)).toEqual({ STAT: 0x00, CON1: 0x10, ADD: 0 })
    const g = generate(cfg)
    expect(g[`${DIR}/spi1.c`]).toContain('    SSP1STAT = 0x00;\n    SSP1CON1 = 0x10;')
    expect(g[`${DIR}/mcc.c`]).toContain('SPI1_Initialize();')
    expect(g[`${DIR}/pin_manager.c`]).toContain('RB1PPS = 0x14;   //RB1->MSSP1:SCK1;')
    expect(g[`${DIR}/pin_manager.c`]).toContain('RB3PPS = 0x15;   //RB3->MSSP1:SDO1;')
    expect(g[`${DIR}/pin_manager.c`]).toContain('SSP1DATPPS = 0x0A;   //RB2->MSSP1:SDI1;')
    const vm = boot(`${HEAD}volatile uint8_t before, after, tris;\nvoid main(void)\n{\n    SYSTEM_Initialize();\n    before = SSP1CON1;\n    SPI1_Open(SPI1_DEFAULT);\n    after = SSP1CON1;\n    tris = TRISB;\n    while (1) {}\n}\n`, cfg)
    vm.runFor({ ms: 2 })
    expect(vm.peekVar('before')).toBe(0x10)
    expect(vm.peekVar('after')).toBe(0x30)
    expect((vm.peekVar('tris') as number) & 0b1010).toBe(0)
  })
  it('mode 0, Fosc/16 : SSP1STAT = 0x40, SSP1CON1 = 0x01', () => {
    expect(spiRegisters(spiCfg(0, 'FOSC/16').mssp!)).toEqual({ STAT: 0x40, CON1: 0x01, ADD: 0 })
  })
  it('fréquence de SCK affichée : 1 MHz à Fosc 4 MHz, Fosc/4', () => {
    const c = spiCfg(0)
    expect(sckFrequency(c, c.mssp!)).toBe(1e6)
  })
})

describe('mssp-spi (tests 2 à 4)', () => {
  const sckPeriod = (cfg: MccConfig) => {
    const vm = boot(SEND, cfg)
    vm.runFor({ ms: 3 })
    const iv = intervals(pinEdges(vm.gpio.trace, 'RB1', 1)).map((t) => vm.toS(t))
    return iv.slice(0, 7)
  }
  it('période de SCK : 1 µs (4 MHz, Fosc/4), 16 µs (Fosc/64), 4 µs (1 MHz, Fosc/4)', () => {
    for (const v of sckPeriod(spiCfg(0))) near(v, 1e-6)
    for (const v of sckPeriod(spiCfg(0, 'FOSC/64'))) near(v, 16e-6)
    for (const v of sckPeriod(spiCfg(0, 'FOSC/4', 1))) near(v, 4e-6)
  })
  it('0x31 : MOSI lu aux fronts de lecture = 0,0,1,1,0,0,0,1 ; un octet = 8 périodes', () => {
    for (const mode of [0, 3]) {
      const vm = boot(SEND, spiCfg(mode))
      vm.runFor({ ms: 3 })
      const md = INFO3.spi.modes[mode]
      // Lecture au front repos → actif si CKE = 1, actif → repos sinon : front montant pour les modes 0 et 3
      const readLevel = md.cke ? 1 - md.ckp : md.ckp
      const b = vm.mssp.bytes[0]
      // Fronts du premier octet (le passage de SCK au repos à l'Open en mode 3 n'en fait pas partie)
      const reads = pinEdges(vm.gpio.trace, 'RB1', readLevel as 0 | 1)
        .filter((t) => t > b.t0)
        .slice(0, 8)
      const at = (t: number) => {
        const before = vm.gpio.trace.filter((c) => c.pin === 'RB3' && c.t < t)
        return before.length ? before[before.length - 1].level : 0
      }
      expect(reads.map(at)).toEqual([0, 0, 1, 1, 0, 0, 0, 1])
      near(vm.toS(b.t1 - b.t0), 8e-6)
      expect(b.tx).toBe(0x31)
    }
  })
  it('deux SPI1_WriteByte sans délai : WCOL = 1, seul le premier octet sort', () => {
    const vm = boot(`${HEAD}void main(void)\n{\n    SYSTEM_Initialize();\n    SPI1_Open(SPI1_DEFAULT);\n    SPI1_WriteByte(0x31);\n    SPI1_WriteByte(0xC4);\n    while (1) {}\n}\n`, spiCfg(0))
    vm.runFor({ ms: 2 })
    expect(vm.readSfr('SSP1CON1') >> 7).toBe(1)
    expect(vm.mssp.bytes.map((b) => b.tx)).toEqual([0x31])
  })
})
