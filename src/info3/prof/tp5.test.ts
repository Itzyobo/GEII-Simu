import { describe, expect, it } from 'vitest'
import { generate } from '../mcc/generator'
import { tp51Config, tp53Config, tp54Config } from '../mcc/presets'
import { updateEusart, updatePwm, updateTimer, type MccConfig } from '../mcc/config'
import { blankProject, runGenerate } from '../project/project'
import { runVerifyTp23, verifyTp5 } from '../project/verify23'
import { prescalerFor4ms, pwmPeriodFields } from '../tp/content23'
import { SOLUTIONS } from '../solutions'
import { gradeTp5, type Tp5Challenge } from './tp5'

const files = (main: string, cfg: MccConfig) => ({ 'main.c': main, ...generate(cfg) })
const REF: Record<Tp5Challenge, [string, () => MccConfig]> = {
  'tp5-1': ['tp5/q1', tp51Config],
  'tp5-2': ['tp5/q2', tp51Config],
  'tp5-3': ['tp5/q3', tp53Config],
  'tp5-4': ['tp5/q4', tp54Config],
}
const grade = (id: Tp5Challenge, main = SOLUTIONS[REF[id][0]], cfg = REF[id][1](), slot: 'mikrobus1' | 'mikrobus2' | null = 'mikrobus2') => gradeTp5(id, files(main, cfg), slot)

describe('professeur virtuel TP5 (test 8)', () => {
  for (const id of Object.keys(REF) as Tp5Challenge[]) {
    it(`${id} : solution validée, verdict identique sur 20 exécutions`, () => {
      const first = grade(id)
      expect(first, first.messages.join(' | ')).toMatchObject({ ok: true })
      for (let k = 1; k < 20; k++) expect(grade(id)).toEqual(first)
    })
  }
})

describe('refus attendus', () => {
  it('Q2 sans le << 2 : « rapport cyclique au plus 25 % : couleur non convertie sur 10 bits »', () => {
    const raw = SOLUTIONS['tp5/q2'].replace(/ << 2\)/g, ')')
    expect(raw).not.toContain('<< 2')
    const v = grade('tp5-2', raw)
    expect(v.ok).toBe(false)
    expect(v.messages).toContain('rapport cyclique au plus 25 % : couleur non convertie sur 10 bits')
  })
  it('Q1 sans PPS de PWM6 (RD4 non affecté) : LED rouge éteinte, refusé', () => {
    const cfg = tp51Config()
    const noPps: MccConfig = { ...cfg, pwm: { ...cfg.pwm, PWM6: { ...cfg.pwm!.PWM6!, pin: null } } }
    const v = grade('tp5-1', undefined, noPps)
    expect(v.ok).toBe(false)
    expect(v.messages.join(' ')).toContain('Rouge (PWM6, RD4)')
  })
  it('Q1 sans redirection STDIO : rien sur TX', () => {
    const cfg = tp51Config()
    const v = grade('tp5-1', undefined, { ...cfg, eusart: { ...cfg.eusart!, redirectStdio: false } })
    expect(v.ok).toBe(false)
  })
  it('Q2 avec __delay_ms(1000) après un printf : intervalle hors des ± 2 % (le printf dure)', () => {
    const v = grade('tp5-2', SOLUTIONS['tp5/q2'].replace('__delay_ms(985);', '__delay_ms(1000); printf("..............");'))
    expect(v.ok).toBe(false)
    expect(v.messages.join(' ')).toContain('Intervalle entre deux lignes')
  })
  it('Q2 : struct différente de l’énoncé refusée', () => {
    const v = grade('tp5-2', SOLUTIONS['tp5/q2'].replace('uint8_t blue;', 'uint16_t blue;'))
    expect(v.ok).toBe(false)
    expect(v.messages.join(' ')).toContain('rgb_color_t')
  })
  it('Q3 : blocage à 255 aussi accepté, et le choix est indiqué', () => {
    const sat = SOLUTIONS['tp5/q3'].replace('couleur.red = couleur.red + 16;', 'couleur.red = (couleur.red > 239) ? 255 : couleur.red + 16;')
    const v = grade('tp5-3', sat, tp53Config())
    expect(v, v.messages.join(' | ')).toMatchObject({ ok: true })
    expect(v.messages.join(' ')).toContain('bloqué à 255')
    expect(grade('tp5-3').messages.join(' ')).toContain('repart de 0')
  })
  it('Q4 sans carte Rotary sur le mikroBUS 2 : refusé', () => {
    expect(grade('tp5-4', undefined, undefined, 'mikrobus1').ok).toBe(false)
  })
})

function project(mcc: MccConfig, bench: { usbWhite?: boolean; cover?: boolean; rotary?: boolean } = {}) {
  const p = blankProject('tp5', 'tp5', 'tp5')
  const slots = { mikrobus1: null, mikrobus2: bench.rotary ? ('rotary' as const) : null }
  return runGenerate({ ...p, mcc, bench: { ...p.bench, usbWhite: bench.usbWhite ?? true, cover: bench.cover ?? true, slots } }).project
}

describe('Faire vérifier TP5', () => {
  it('configurations de référence conformes ; rappels cache et USB noir sans blocage', () => {
    expect(verifyTp5(project(tp51Config()), 'tp5-1')).toEqual([])
    expect(verifyTp5(project(tp53Config()), 'tp5-3')).toEqual([])
    expect(verifyTp5(project(tp54Config(), { rotary: true }), 'tp5-4')).toEqual([])
    const r = runVerifyTp23(project(tp51Config(), { cover: false }), 'tp5-1')
    expect(r.errors).toEqual([])
    expect(r.project.verified).toBe(true)
    expect(r.warnings.join(' ')).toContain('cache')
    expect(r.warnings.join(' ')).toContain('USB noir')
  })
  it('USB blanc débranché, TMR2 en LFINTOSC, PWM6 sans broche, pas de redirection STDIO : signalés', () => {
    expect(verifyTp5(project(tp51Config(), { usbWhite: false }), 'tp5-1').join(' ')).toContain('USB blanc')
    expect(verifyTp5(project(updateTimer(tp51Config(), 'TMR2', { clockSource: 'LFINTOSC' })), 'tp5-1').join(' ')).toContain('FOSC/4')
    expect(verifyTp5(project(updatePwm(tp51Config(), 'PWM6', { pin: null })), 'tp5-1').join(' ')).toContain('PWM6 : sortie sur RD4')
    expect(verifyTp5(project(updateEusart(tp51Config(), { redirectStdio: false })), 'tp5-1').join(' ')).toContain('Redirect STDIO')
    expect(verifyTp5(project(tp51Config()), 'tp5-3').join(' ')).toContain('LED_D5')
    expect(verifyTp5(project(tp54Config()), 'tp5-4').join(' ')).toContain('ROTARY O click absente')
  })
  it('questions numériques : période attendue = 4,096 ms (1:16) ou 1,024 ms (1:4) ; prescaler pour ≈ 4 ms = 16 à 4 MHz', () => {
    expect(pwmPeriodFields(project(tp51Config()))![0].expected).toBeCloseTo(4.096, 6)
    expect(pwmPeriodFields(project(tp51Config(4)))![0].expected).toBeCloseTo(1.024, 6)
    expect(prescalerFor4ms(project(tp51Config()))).toBe(16)
    const one = tp51Config()
    expect(prescalerFor4ms(project({ ...one, system: { ...one.system, hfMHz: 1 } }))).toBe(4)
  })
})
