/** CCP1 / PWM6 / PWM7 dans MCC : code généré, notifications, chaîne complète jusqu'à la VM (consigne étape 5). */
import { describe, expect, it } from 'vitest'
import { INFO3 } from '../../data/reference'
import { compile, formatDiagnostic } from '../compiler'
import { periodicOf } from '../vm/trace'
import { Vm } from '../vm/vm'
import { updatePwm, updateTimer, type MccConfig } from './config'
import { generate } from './generator'
import { tp51PwmConfig } from './presets'
import { dutyValue, PWM1_LOAD_DUTY_BODY, pwmNotifications, pwmRegisters, pwmxLoadDutyBody } from './pwm'
import { periodRegister } from './timers'

const DIR = INFO3.mcc.dir
const S = 1 / INFO3.clock.timeBaseHz
const HEAD = '#include "mcc_generated_files/mcc.h"\n'

/** Fonction C extraite d'un fichier : corps entre les accolades de sa définition */
function body(src: string, signature: string): string | null {
  const at = src.indexOf(`${signature}\n{\n`)
  if (at < 0) return null
  const start = at + signature.length + 3
  return src.slice(start, src.indexOf('\n}\n', start))
}

function boot(main: string, cfg: MccConfig) {
  const r = compile({ 'main.c': main, ...generate(cfg) })
  if (!r.ok) throw new Error(r.diagnostics.map(formatDiagnostic).join('\n'))
  const vm = new Vm()
  vm.load(r.program!)
  return vm
}

describe('code généré (test 1)', () => {
  it('ccp1.c : corps de PWM1_LoadDutyValue identique au cours p. 89 (dutyValue &= 0x03FF; puis la branche CCP1FMT)', () => {
    const g = generate(tp51PwmConfig())
    const b = body(g[`${DIR}/ccp1.c`], 'void PWM1_LoadDutyValue(uint16_t dutyValue)')
    expect(b).toBe(PWM1_LOAD_DUTY_BODY)
    expect(b!.split('\n')[0]).toBe('    dutyValue &= 0x03FF;')
    expect(b).toContain('if(CCP1CONbits.CCP1FMT)')
  })
  it('pwm6.c et pwm7.c : PWMx_LoadDutyValue écrit DCH (8 MSB) et DCL (2 LSB alignés à gauche) — cours p. 90', () => {
    const g = generate(tp51PwmConfig())
    for (const n of ['6', '7']) {
      expect(body(g[`${DIR}/pwm${n}.c`], `void PWM${n}_LoadDutyValue(uint16_t dutyValue)`)).toBe(pwmxLoadDutyBody(n))
      expect(g[`${DIR}/pwm${n}.c`]).toContain(`CCPTMRS1bits.P${n}TSEL = 1;`)
      expect(g[`${DIR}/mcc.h`]).toContain(`#include "pwm${n}.h"`)
      expect(g[`${DIR}/mcc.c`]).toContain(`PWM${n}_Initialize();`)
    }
    expect(g[`${DIR}/mcc.c`]).toContain('PWM1_Initialize();')
    expect(g[`${DIR}/ccp1.c`]).toContain('CCPTMRS0bits.C1TSEL = 0x1;')
  })
  it('PPS et port : RD4 ← PWM6, RC0 ← PWM7, RC1 ← CCP1, en sortie numérique', () => {
    const pm = generate(tp51PwmConfig())[`${DIR}/pin_manager.c`]
    expect(pm).toContain('RD4PPS = 0x0E;   //RD4->PWM6:PWM6OUT;')
    expect(pm).toContain('RC0PPS = 0x0F;   //RC0->PWM7:PWM7OUT;')
    expect(pm).toContain('RC1PPS = 0x09;   //RC1->CCP1:CCP1;')
    const reg = (r: string) => parseInt(new RegExp(`\\b${r} = (0x[0-9A-F]{2});`).exec(pm)![1], 16)
    expect(reg('TRISD') & (1 << 4)).toBe(0)
    expect(reg('TRISC') & 0b11).toBe(0)
    expect(reg('ANSELD') & (1 << 4)).toBe(0)
  })
  it('Duty Cycle (%) → seuil 10 bits avec PR2 = 0xFF : 50 % → 512, 100 % → 1023 ; registres CCP1 aligné à droite', () => {
    let c = tp51PwmConfig()
    expect(periodRegister(c, c.timers!.TMR2!)).toBe(0xff)
    c = updatePwm(c, 'CCP1', { dutyCycle: 50 })
    expect(dutyValue(c, c.pwm!.CCP1!)).toBe(512)
    expect(pwmRegisters(c, 'CCP1', c.pwm!.CCP1!)).toMatchObject({ CON: 0x8f, H: 0x02, L: 0x00 })
    expect(dutyValue(updatePwm(c, 'CCP1', { dutyCycle: 100 }), { ...c.pwm!.CCP1!, dutyCycle: 100 })).toBe(1023)
  })
})

describe('notifications MCC (test 9, H41)', () => {
  it('TMR2 de la PWM en LFINTOSC : notification ; FOSC/4 : aucune', () => {
    expect(pwmNotifications(tp51PwmConfig())).toEqual([])
    const lf = updateTimer(tp51PwmConfig(), 'TMR2', { clockSource: 'LFINTOSC' })
    const n = pwmNotifications(lf)
    expect(n).toHaveLength(3)
    expect(n[0]).toContain('FOSC/4')
    expect(n[0]).toContain('LFINTOSC')
    expect(n[0]).toContain('cours p. 85')
  })
})

describe('chaîne complète : MCC → code généré → VM', () => {
  it('PWM6_LoadDutyValue(1023), PWM7 = CCP1 = 0 : RD4 à 99,9 %, RC0 et RC1 à 0, période 4,096 ms', () => {
    const vm = boot(`${HEAD}void main(void)\n{\n    SYSTEM_Initialize();\n    PWM6_LoadDutyValue(1023);\n    PWM7_LoadDutyValue(0);\n    PWM1_LoadDutyValue(0);\n    while (1) {}\n}\n`, tp51PwmConfig())
    vm.runFor({ ms: 60 })
    const m = (pin: string) => periodicOf(vm.gpio.trace, pin, vm.msToTicks(20), vm.t)
    expect(m('RD4').duty).toBeGreaterThanOrEqual(0.99)
    expect(Math.abs(m('RD4').period! * S - 4.096e-3) / 4.096e-3).toBeLessThanOrEqual(0.005)
    expect(m('RC0').duty).toBe(0)
    expect(m('RC1').duty).toBe(0)
  })
})
