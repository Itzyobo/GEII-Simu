/** ADCC : MCC, adcc.c / adcc.h, modèle dans la VM, joystick, section critique (consigne étape 6, tests 1 à 7). */
import { describe, expect, it } from 'vitest'
import { INFO3 } from '../../data/reference'
import { compile, formatDiagnostic } from '../compiler'
import { codeOf, joystickRaw, resultRegisters } from '../models/adcc'
import { Vm } from '../vm/vm'
import { updateAdcc, type MccConfig } from './config'
import { adccConversionS, adccNotifications, adccTad, channelEnum } from './adcc'
import { generate } from './generator'
import { tp61Config } from './presets'

const DIR = INFO3.mcc.dir
const HEAD = '#include "mcc_generated_files/mcc.h"\n'
const TB = INFO3.clock.timeBaseHz

function boot(main: string, cfg: MccConfig = tp61Config()) {
  const r = compile({ 'main.c': main, ...generate(cfg) })
  if (!r.ok) throw new Error(r.diagnostics.map(formatDiagnostic).join('\n'))
  const vm = new Vm()
  vm.load(r.program!)
  return vm
}
/** Une conversion de `ch` dans `res` (attente bloquante) */
const single = (ch: string, extra = '') => `${HEAD}volatile adc_result_t res;\nvoid main(void)\n{\n    SYSTEM_Initialize();\n${extra}    res = ADCC_GetSingleConversion(${ch});\n    while (1) {}\n}\n`

describe('adcc.c / adcc.h (test 1)', () => {
  it('enum adcc_channel_t au format du cours p. 99 ; POT = 0x0, JOY_HORZ = 0x1D, JOY_VERT = 0x1E, voies internes', () => {
    const h = generate(tp61Config())[`${DIR}/adcc.h`]
    expect(h).toContain('typedef uint16_t adc_result_t;')
    expect(h).toContain(channelEnum(tp61Config()))
    expect(channelEnum(tp61Config())).toBe('typedef enum\n{\n    POT = 0x0,\n    JOY_HORZ = 0x1D,\n    JOY_VERT = 0x1E,\n    channel_VSS = 0x3C,\n    channel_Temp = 0x3D,\n    channel_DAC1 = 0x3E,\n    channel_FVR_buf1 = 0x3F\n} adcc_channel_t;')
    const c = generate(tp61Config())[`${DIR}/adcc.c`]
    for (const f of ['ADCC_Initialize(void)', 'ADCC_StartConversion(adcc_channel_t channel)', 'ADCC_IsConversionDone(void)', 'ADCC_GetConversionResult(void)', 'ADCC_GetSingleConversion(adcc_channel_t channel)', 'ADCC_SetADIInterruptHandler(', 'ADCC_ISR(void)']) expect(c, f).toContain(f)
    // Broches de l'ADCC en analogique (ANSEL = 1) et en entrée
    const pm = generate(tp61Config())[`${DIR}/pin_manager.c`]
    const reg = (r: string) => parseInt(new RegExp(`\\b${r} = (0x[0-9A-F]{2});`).exec(pm)![1], 16)
    expect(reg('ANSELA') & 1).toBe(1)
    expect(reg('ANSELD') & 0x60).toBe(0x60)
    expect(reg('TRISD') & 0x60).toBe(0x60)
  })
})

describe('conversion (test 2)', () => {
  it('Vin = 1,65 V → 512 ± 1 ; 3,3 V → 1023 ; 0 V → 0 ± 1 ; à gauche : ADRESH:ADRESL décalé de 6 bits', () => {
    expect(codeOf(1.65)).toBe(512)
    for (const [frac, want, tol] of [[0.5, 512, 1], [1, 1023, 0], [0, 0, 1]] as const) {
      const vm = boot(single('POT'))
      vm.setPot(frac)
      vm.runFor({ ms: 2 })
      expect(Math.abs((vm.peekVar('res') as number) - want), `${frac}`).toBeLessThanOrEqual(tol)
    }
    expect(resultRegisters(0x3ff, false)).toEqual({ ADRESH: 0xff, ADRESL: 0xc0 })
    const vm = boot(single('POT'), updateAdcc(tp61Config(), { alignment: 'left' }))
    vm.setPot(1)
    vm.runFor({ ms: 2 })
    expect(vm.peekVar('res')).toBe(0xffc0)
  })
})

describe('TAD et durée de conversion (test 3)', () => {
  it('4 MHz : FOSC/4 → 1,0 µs sans alerte ; FOSC/2 → 0,5 µs et alerte MCC ; durée = 11,5 TAD + acquisition (± 1 %)', () => {
    const c4 = tp61Config()
    expect(adccTad(c4, c4.adcc!)).toBeCloseTo(1e-6, 12)
    expect(adccNotifications(c4)).toEqual([])
    const c2 = updateAdcc(c4, { divider: 2 })
    expect(adccTad(c2, c2.adcc!)).toBeCloseTo(0.5e-6, 12)
    expect(adccNotifications(c2).join(' ')).toContain('inférieur à 1 us')
    for (const acq of [0, 10]) {
      const cfg = updateAdcc(c4, { acquisition: acq })
      const vm = boot(single('JOY_HORZ'), cfg)
      vm.runFor({ ms: 2 })
      const d = (vm.adcLog[0].t1 - vm.adcLog[0].t0) / TB
      expect(Math.abs(d - (11.5 + acq) * 1e-6) / ((11.5 + acq) * 1e-6)).toBeLessThanOrEqual(0.01)
      expect(adccConversionS(cfg, cfg.adcc!)).toBeCloseTo((11.5 + acq) * 1e-6, 12)
    }
  })
})

describe('interruption ADI (test 4)', () => {
  const prog = (peie: boolean) => `${HEAD}volatile uint8_t n = 0;\nvoid fin(void) { n++; }\nvoid main(void)\n{\n    SYSTEM_Initialize();\n    ADCC_SetADIInterruptHandler(fin);\n    INTERRUPT_GlobalInterruptEnable();\n${peie ? '    INTERRUPT_PeripheralInterruptEnable();\n' : ''}    ADCC_StartConversion(POT);\n    while (1) {}\n}\n`
  it('sans PEIE : ADIF = 1 et 0 appel de l’ISR ; avec PEIE : 1 appel', () => {
    const cfg = updateAdcc(tp61Config(), { interrupt: true })
    const off = boot(prog(false), cfg)
    off.runFor({ ms: 2 })
    expect(off.bus.readBit('PIR1', 'ADIF')).toBe(1)
    expect(off.peekVar('n')).toBe(0)
    expect(off.irqCalls.AD ?? 0).toBe(0)
    const on = boot(prog(true), cfg)
    on.runFor({ ms: 2 })
    expect(on.peekVar('n')).toBe(1)
  })
})

describe('pourcentage sur 16 bits (test 5)', () => {
  it('uint16_t p = r*100/1023 avec r = 1023 → 35 (débordement réel) ; (uint32_t)r*100/1023 → 100', () => {
    const vm = boot(`${HEAD}volatile uint16_t p16, p32;\nvoid main(void)\n{\n    adc_result_t r = 1023;\n    p16 = r*100/1023;\n    p32 = (uint32_t)r*100/1023;\n    while (1) {}\n}\n`)
    vm.runFor({ ms: 1 })
    expect(vm.peekVar('p16')).toBe(35)
    expect(vm.peekVar('p32')).toBe(100)
  })
})

describe('joystick (test 6, H4 et H48)', () => {
  it('repos : 498 et 530 ± 1 ; butée droite → X = 1023 ; butée haute → Y = 0', () => {
    expect(joystickRaw(0, 0)).toEqual({ x: 498, y: 530 })
    expect(joystickRaw(1, 0).x).toBe(1023)
    expect(joystickRaw(0, 1).y).toBe(0)
    expect(joystickRaw(0, -1).y).toBe(1023)
    for (const [x, y, ch, want, tol] of [[0, 0, 'JOY_HORZ', 498, 1], [0, 0, 'JOY_VERT', 530, 1], [1, 0, 'JOY_HORZ', 1023, 1], [0, 1, 'JOY_VERT', 0, 1]] as const) {
      const vm = boot(single(ch))
      vm.setJoystick(x, y)
      vm.runFor({ ms: 2 })
      expect(Math.abs((vm.peekVar('res') as number) - want), `${ch} (${x}, ${y})`).toBeLessThanOrEqual(tol)
    }
  })
})

describe('section critique (test 7)', () => {
  // L'ISR du timer écrit alternativement 0x00FF et 0x0100 ; main copie la variable 16 bits en continu
  const prog = (protect: boolean) => `${HEAD}volatile uint16_t partage = 0x00FF;
volatile uint16_t bad = 0;
volatile uint16_t lectures = 0;
void tic(void) { partage = (partage == 0x00FF) ? 0x0100 : 0x00FF; }
void main(void)
{
    uint16_t copie;
    SYSTEM_Initialize();
    TMR2_SetInterruptHandler(tic);
    INTERRUPT_GlobalInterruptEnable();
    INTERRUPT_PeripheralInterruptEnable();
    while (lectures < 10000)
    {
${protect ? '        INTERRUPT_GlobalInterruptDisable();\n        copie = partage;\n        INTERRUPT_GlobalInterruptEnable();' : '        copie = partage;'}
        if (copie != 0x00FF && copie != 0x0100) bad++;
        lectures++;
    }
    while (1) {}
}
`
  // TMR2 rapide (période de 200 µs) : beaucoup d'interruptions pendant les 10 000 lectures
  const cfg = (): MccConfig => {
    const c = tp61Config()
    return { ...c, timers: { TMR2: { ...INFO3.timers.mccDefault, clockSource: 'FOSC/4', prescaler: 1, postscaler: 1, periodS: 200e-6, interrupt: true } } }
  }
  it('sans protection : au moins 1 valeur aberrante sur 10 000 lectures ; avec GIE = 0 autour de la copie : 0', () => {
    const raw = boot(prog(false), cfg())
    raw.runUntil((v) => v.peekVar('lectures') === 10000, 5000)
    expect(raw.peekVar('lectures')).toBe(10000)
    expect(raw.peekVar('bad') as number).toBeGreaterThanOrEqual(1)
    const safe = boot(prog(true), cfg())
    safe.runUntil((v) => v.peekVar('lectures') === 10000, 5000)
    expect(safe.peekVar('lectures')).toBe(10000)
    expect(safe.peekVar('bad')).toBe(0)
  })
})
