import { describe, expect, it } from 'vitest'
import { compile, formatDiagnostic } from '../compiler'
import { generate } from '../mcc/generator'
import { addMssp, updateMssp, type MccConfig } from '../mcc/config'
import { tp1Config } from '../mcc/presets'
import { Vm } from '../vm/vm'
import type { TraceChange } from '../worker/protocol'
import { autoPeriod, decodeSpi, findTriggerTime, signalOf } from './scope'

const SEND = '#include "mcc_generated_files/mcc.h"\nvoid main(void)\n{\n    SYSTEM_Initialize();\n    SPI1_Open(SPI1_DEFAULT);\n    while (1)\n    {\n        SPI1_WriteByte(0x31);\n        __delay_ms(100);\n    }\n}\n'
const cfg = (mode: number, clockSource = 'FOSC/4', hfMHz = 4): MccConfig => updateMssp(addMssp({ ...tp1Config(), system: { ...tp1Config().system, hfMHz } }), { mode, clockSource })

/** Exécute SEND et renvoie les changements datés (s) de SCK (RB1) et MOSI (RB3), comme le Worker */
function capture(c: MccConfig, ms = 3) {
  const r = compile({ 'main.c': SEND, ...generate(c) })
  if (!r.ok) throw new Error(r.diagnostics.map(formatDiagnostic).join('\n'))
  const vm = new Vm()
  vm.load(r.program!)
  vm.runFor({ ms })
  const ch = (pin: string): TraceChange[] => [{ ch: pin, t: 0, level: 0 }, ...vm.gpio.trace.filter((x) => x.pin === pin).map((x) => ({ ch: pin, t: vm.toS(x.t), level: x.level }))]
  return { sck: ch('RB1'), mosi: ch('RB3'), tEnd: vm.timeS }
}
const near = (v: number, target: number, tol = 0.01) => expect(Math.abs(v - target) / target).toBeLessThanOrEqual(tol)

describe('oscilloscope (test 2 et décodage)', () => {
  it('signal logique 0 à 3,3 V, front de 20 ns (H40)', () => {
    const s = signalOf([
      { ch: 'x', t: 0, level: 0 },
      { ch: 'x', t: 1e-6, level: 1 },
    ])
    expect(s(0.5e-6)).toBe(0)
    expect(s(1e-6 + 10e-9)).toBeCloseTo(1.65, 6)
    expect(s(2e-6)).toBeCloseTo(3.3, 9)
  })
  it('période de SCK mesurée : 1,000 µs (4 MHz, Fosc/4), 16,00 µs (Fosc/64), 4,000 µs (1 MHz)', () => {
    for (const [c, period] of [
      [cfg(0), 1e-6],
      [cfg(0, 'FOSC/64'), 16e-6],
      [cfg(0, 'FOSC/4', 1), 4e-6],
    ] as const) {
      const { sck, tEnd } = capture(c)
      // Déclenchement sur le premier front montant de l'octet, fenêtre de 4 périodes centrée
      const span = 4 * period
      const first = sck.find((x, i) => i > 0 && x.level === 1)!.t
      const t = findTriggerTime(
        sck.filter((x) => x.t <= first + 2 * period),
        'rising',
        1.65,
        tEnd,
        span,
      )!
      near(autoPeriod(sck, t - span / 2, span), period)
    }
  })
  it('décodage SPI : 0x31 en modes 0 et 3', () => {
    for (const mode of [0, 3]) {
      const { sck, mosi, tEnd } = capture(cfg(mode))
      expect(decodeSpi(sck, mosi, mode, 0, tEnd).map((b) => b.value)).toEqual([0x31])
    }
  })
  it('déclenchement : aucun front → null (défilement)', () => {
    expect(findTriggerTime([{ ch: 'x', t: 0, level: 0 }], 'rising', 1.65, 1, 1e-3)).toBeNull()
  })
})
