import { describe, expect, it } from 'vitest'
import { INFO3 } from '../../data/reference'
import { compile, formatDiagnostic } from '../compiler'
import { CR_FIXTURES, MCC_TP1 } from '../fixtures'
import { intervals, pinEdges } from '../vm/trace'
import { Vm } from '../vm/vm'
import { configErrors, defaultMccConfig, toggleGridPin, type MccConfig } from './config'
import { generate, MAIN_TEMPLATE, XTAL_FILE, xtalOf } from './generator'
import { namedPin as named, tp1Config } from './presets'
// Fichiers MCC réels générés en TP (MCC 1.81.7, XC8 2.31, MPLAB X 5.45), CRLF d'origine
import REAL_MCC_C from '../../../docs/sources/mplab/tp1/mcc.c?raw'
import REAL_MCC_H from '../../../docs/sources/mplab/tp1/mcc.h?raw'
import REAL_PM_C from '../../../docs/sources/mplab/tp1/pin_manager.c?raw'
import REAL_PM_H from '../../../docs/sources/mplab/tp1/pin_manager.h?raw'
import REAL_DC_C from '../../../docs/sources/mplab/tp1/device_config.c?raw'
import REAL_DC_H from '../../../docs/sources/mplab/tp1/device_config.h?raw'

const DIR = INFO3.mcc.dir
const REAL: Record<string, string> = {
  'mcc.c': REAL_MCC_C,
  'mcc.h': REAL_MCC_H,
  'pin_manager.c': REAL_PM_C,
  'pin_manager.h': REAL_PM_H,
  'device_config.c': REAL_DC_C,
  'device_config.h': REAL_DC_H,
}
/** Seule normalisation permise : CRLF → LF */
const lf = (s: string) => s.replace(/\r\n/g, '\n')
const regValues = (text: string) => Object.fromEntries([...text.matchAll(/^ {4}(\w+) = (0x[0-9A-F]{2});$/gm)].map((m) => [m[1], m[2]]))

describe('Generate : configuration du cours p. 22 (valeurs, ordre des lignes ignoré)', () => {
  it('LED_D2 sur RA4 en sortie + BP_S1 sur RB4 en entrée numérique : valeurs de la section C', () => {
    let c = named(defaultMccConfig(), 'RA4', 'output', 'LED_D2')
    c = named(c, 'RB4', 'input', 'BP_S1', false)
    const v = regValues(generate(c)[`${DIR}/pin_manager.c`])
    expect(v).toMatchObject({
      LATA: '0x00', LATB: '0x00', LATC: '0x00', LATD: '0x00', LATE: '0x00',
      TRISA: '0xEF', TRISB: '0xFF', TRISC: '0xFF', TRISD: '0xFF', TRISE: '0x07',
      ANSELA: '0xEF', ANSELB: '0xEF', ANSELC: '0xFF', ANSELD: '0xFF', ANSELE: '0x07',
    })
  })

  it('macros d’une broche nommée : format du cours p. 20-21 au caractère près', () => {
    const h = generate(named(defaultMccConfig(), 'RA4', 'output', 'LED_D2'))[`${DIR}/pin_manager.h`]
    expect(h).toContain(`#define LED_D2_TRIS                 TRISAbits.TRISA4
#define LED_D2_LAT                  LATAbits.LATA4
#define LED_D2_PORT                 PORTAbits.RA4
#define LED_D2_WPU                  WPUAbits.WPUA4
#define LED_D2_OD                   ODCONAbits.ODCA4
#define LED_D2_ANS                  ANSELAbits.ANSA4
#define LED_D2_SetHigh()            do { LATAbits.LATA4 = 1; } while(0)
#define LED_D2_SetLow()             do { LATAbits.LATA4 = 0; } while(0)
#define LED_D2_Toggle()             do { LATAbits.LATA4 = ~LATAbits.LATA4; } while(0)
#define LED_D2_GetValue()           PORTAbits.RA4
#define LED_D2_SetDigitalInput()    do { TRISAbits.TRISA4 = 1; } while(0)
#define LED_D2_SetDigitalOutput()   do { TRISAbits.TRISA4 = 0; } while(0)
#define LED_D2_SetPullup()          do { WPUAbits.WPUA4 = 1; } while(0)
#define LED_D2_ResetPullup()        do { WPUAbits.WPUA4 = 0; } while(0)
#define LED_D2_SetPushPull()        do { ODCONAbits.ODCA4 = 0; } while(0)
#define LED_D2_SetOpenDrain()       do { ODCONAbits.ODCA4 = 1; } while(0)
#define LED_D2_SetAnalogMode()      do { ANSELAbits.ANSA4 = 1; } while(0)
#define LED_D2_SetDigitalMode()     do { ANSELAbits.ANSA4 = 0; } while(0)`)
  })
})

describe('Generate : configuration TP1 = fichiers MCC réels, octet pour octet (CRLF → LF)', () => {
  const gen = generate(tp1Config())
  it.each(Object.keys(REAL))('%s identique', (file) => {
    expect(gen[`${DIR}/${file}`]).toBe(lf(REAL[file]))
  })
  it('fixtures mcc-tp1 = fichiers réels (CRLF → LF)', () => {
    for (const f of Object.keys(REAL)) expect(MCC_TP1[`${DIR}/${f}`]).toBe(lf(REAL[f]))
  })
  it('pin_manager.c : SLRCONx et INLVLx toujours écrits, PIN_MANAGER_IOC() vide', () => {
    const v = regValues(gen[`${DIR}/pin_manager.c`])
    expect([v.SLRCONA, v.SLRCONE, v.INLVLA, v.INLVLE]).toEqual(['0xFF', '0x07', '0xFF', '0x07'])
    expect(gen[`${DIR}/pin_manager.c`]).toContain('void PIN_MANAGER_IOC(void)\n{   \n}')
  })
  it('main.c du premier Generate = modèle du cours p. 15', () => {
    expect(MAIN_TEMPLATE.startsWith('#include "mcc_generated_files/mcc.h"\n\n/*\n                         Main application\n */\nvoid main(void)\n{')).toBe(true)
    expect(MAIN_TEMPLATE).toContain('    //INTERRUPT_GlobalInterruptEnable();\n')
  })
})

/** Projet : main.c + fichiers générés (avec modification éventuelle) */
function run(cfg: MccConfig, main: string, patch?: (files: Record<string, string>) => void) {
  const files: Record<string, string> = { 'main.c': main, ...generate(cfg) }
  patch?.(files)
  const r = compile(files)
  if (!r.ok) throw new Error(r.diagnostics.map(formatDiagnostic).join('\n'))
  const vm = new Vm()
  vm.load(r.program!)
  return vm
}
const d2Periods = (vm: Vm) => intervals(pinEdges(vm.gpio.trace, 'RA4', 1).map((t) => vm.toS(t))).slice(0, 5)
const sys = (hfMHz: number, divider: number) => ({ ...tp1Config(), system: { oscillator: 'HFINTOSC' as const, hfMHz, divider, lvp: true } })
const osc = (g: Record<string, string>) => regValues(g[`${DIR}/mcc.c`])

describe('System Module', () => {
  it.each([
    ['par défaut (4 MHz / 1)', tp1Config(), '0x60', '0x02', 4e6],
    ['4 MHz / 4', sys(4, 4), '0x62', '0x02', 1e6],
    ['32 MHz / 1', sys(32, 1), '0x60', '0x06', 32e6],
  ] as const)('%s → OSCCON1, OSCFRQ, _XTAL_FREQ dans device_config.h ; q3_3 donne 1,000 s ± 0,5 %%', (_, cfg, osccon1, oscfrq, fosc) => {
    const g = generate(cfg)
    expect(osc(g)).toMatchObject({ OSCCON1: osccon1, OSCFRQ: oscfrq })
    expect(xtalOf(g[XTAL_FILE])).toBe(fosc)
    expect(g[XTAL_FILE]).toContain(`#define _XTAL_FREQ ${fosc}`)
    expect(g[`${DIR}/mcc.h`]).not.toContain('_XTAL_FREQ')
    const vm = run(cfg, CR_FIXTURES['tp1/q3_3'])
    vm.runFor({ ms: 6000 })
    expect(vm.fosc).toBe(fosc)
    const p = d2Periods(vm)
    expect(p).toHaveLength(5)
    for (const x of p) expect(Math.abs(x - 1)).toBeLessThanOrEqual(INFO3.tp1.tolerance)
  })
  it('_XTAL_FREQ modifié à la main (16000000) avec Fosc = 4 MHz → q3_3 donne 4,000 s ± 0,5 % (comportement réel)', () => {
    const vm = run(tp1Config(), CR_FIXTURES['tp1/q3_3'], (f) => {
      f[XTAL_FILE] = f[XTAL_FILE].replace('#define _XTAL_FREQ 4000000', '#define _XTAL_FREQ 16000000')
    })
    vm.runFor({ ms: 22000 })
    expect(vm.fosc).toBe(4e6)
    const p = d2Periods(vm)
    expect(p).toHaveLength(5)
    for (const x of p) expect(Math.abs(x - 4) / 4).toBeLessThanOrEqual(INFO3.tp1.tolerance)
  })
  it('LFINTOSC / 1 → 31 kHz ; LVP décoché → LVP = OFF', () => {
    const c = { ...defaultMccConfig(), system: { oscillator: 'LFINTOSC' as const, hfMHz: 4, divider: 1, lvp: false } }
    const g = generate(c)
    expect(xtalOf(g[XTAL_FILE])).toBe(INFO3.clock.lfintosc)
    expect(g[`${DIR}/device_config.c`]).toContain('#pragma config LVP = OFF    //')
  })
})

describe('Pin Module', () => {
  it('H23 : une nouvelle entrée a Analog coché, une sortie non', () => {
    const c = toggleGridPin(toggleGridPin(defaultMccConfig(), 'RB4', 'input'), 'RA4', 'output')
    expect(c.pins.find((p) => p.pin === 'RB4')!.analog).toBe(true)
    expect(c.pins.find((p) => p.pin === 'RA4')!.analog).toBe(false)
  })
  it('H23 : BP_S1 laissé en Analog → q3_4 garde D2 allumée sur 100 appuis sur 100', () => {
    let c = named(defaultMccConfig(), 'RA4', 'output', 'LED_D2')
    c = named(c, 'RB4', 'input', 'BP_S1')
    expect(c.pins.find((p) => p.pin === 'RB4')!.analog).toBe(true)
    const vm = run(c, CR_FIXTURES['tp1/q3_4'])
    vm.runFor({ ms: 10 })
    let on = 0
    for (let k = 0; k < 100; k++) {
      vm.press('S1')
      vm.runFor({ ms: 5 })
      const a = vm.getPin('RA4')
      vm.release('S1')
      vm.runFor({ ms: 5 })
      if (a === 1 && vm.getPin('RA4') === 1) on++
    }
    expect(on).toBe(100)
  })
  it('une broche ne peut pas être à la fois en entrée et en sortie ; RE3 en entrée seulement', () => {
    let c = toggleGridPin(defaultMccConfig(), 'RA4', 'input')
    c = toggleGridPin(c, 'RA4', 'output')
    expect(c.pins).toHaveLength(1)
    expect(c.pins[0].direction).toBe('output')
    expect(toggleGridPin(c, 'RE3', 'output').pins).toHaveLength(1)
  })
  it('Custom Name invalide → Generate refusé', () => {
    const c = named(defaultMccConfig(), 'RA4', 'output', '2LED')
    expect(configErrors(c)).toEqual(['RA4 : « 2LED » n\'est pas un identifiant C valide'])
    expect(configErrors(named(defaultMccConfig(), 'RA4', 'output', 'LED_D2'))).toEqual([])
  })
})
