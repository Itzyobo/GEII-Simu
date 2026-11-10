import { describe, expect, it } from 'vitest'
import { generate } from '../mcc/generator'
import { tp61Config, tp62Config, tp63Config, tp64Config } from '../mcc/presets'
import type { MccConfig } from '../mcc/config'
import { SOLUTIONS } from '../solutions'
import { gradeTp6, JOY_POSITIONS, type Tp6Challenge } from './tp6'
import { blankProject, runGenerate } from '../project/project'
import { verifyTp6 } from '../project/verify23'

const LIB = { 'LED8x8.c': SOLUTIONS['tp6/LED8x8'], 'LED8x8.h': SOLUTIONS['tp6/LED8x8.h'] }
const REF: Record<Tp6Challenge, [string, () => MccConfig, boolean]> = {
  'tp6-1-1': ['tp6/q1_1', tp61Config, false],
  'tp6-1-3': ['tp6/q1_3', tp61Config, false],
  'tp6-2': ['tp6/q2', tp62Config, false],
  'tp6-3': ['tp6/q3', tp63Config, true],
  'tp6-4': ['tp6/q4', tp64Config, true],
}
const files = (id: Tp6Challenge, main = SOLUTIONS[REF[id][0]]) => ({ 'main.c': main, ...(REF[id][2] ? LIB : {}), ...generate(REF[id][1]()) })
const grade = (id: Tp6Challenge, main?: string, slot: 'mikrobus1' | 'mikrobus2' | null = 'mikrobus1') => gradeTp6(id, files(id, main), slot)

describe('professeur virtuel TP6 (test 12)', () => {
  for (const id of Object.keys(REF) as Tp6Challenge[]) {
    it(`${id} : solution validée, verdict identique sur 20 exécutions`, () => {
      const first = grade(id)
      expect(first, first.messages.join(' | ')).toMatchObject({ ok: true })
      for (let k = 1; k < 20; k++) expect(grade(id)).toEqual(first)
    })
  }
  it('tp6-2 sans section critique : refusée, « accès concurrent non protégé »', () => {
    const raw = SOLUTIONS['tp6/q2'].replace('        INTERRUPT_GlobalInterruptDisable();\n        x = JoyX;\n        y = JoyY;\n        INTERRUPT_GlobalInterruptEnable();', '        x = JoyX;\n        y = JoyY;')
    expect(raw).not.toBe(SOLUTIONS['tp6/q2'])
    const v = grade('tp6-2', raw)
    expect(v.ok).toBe(false)
    expect(v.messages.join(' ')).toContain('accès concurrent non protégé')
  })
})

describe('refus attendus', () => {
  it('tp6-1-1 avec un pourcentage calculé sur 16 bits : « dépassement sur 16 bits »', () => {
    const v = grade('tp6-1-1', SOLUTIONS['tp6/q1_1'].replaceAll('(uint16_t)((uint32_t)pot * 100 / 1023)', '(uint16_t)(pot * 100 / 1023)'))
    expect(v.ok).toBe(false)
    expect(v.messages).toContain('calcul du pourcentage : dépassement sur 16 bits, utilisez un calcul en 32 bits')
  })
  it('tp6-1-3 sans inverser Y : refusé, H48 rappelée', () => {
    const v = grade('tp6-1-3', SOLUTIONS['tp6/q1_3'].replace('return ReposY - (int16_t)NumY;', 'return (int16_t)NumY - ReposY;'))
    expect(v.ok).toBe(false)
    expect(v.messages.join(' ')).toContain('inverser l’axe')
  })
  it('tp6-2 avec ADCC_GetSingleConversion : refusé (fonctions bloquantes)', () => {
    const v = grade('tp6-2', SOLUTIONS['tp6/q2'].replace('    TMR2_SetInterruptHandler(IT_Timer2);', '    ADCC_GetSingleConversion(POT);\n    TMR2_SetInterruptHandler(IT_Timer2);'))
    expect(v.messages.join(' ')).toContain('fonctions bloquantes')
  })
  it('tp6-3 sur le mikroBUS 2 : refusé', () => {
    expect(grade('tp6-3', undefined, 'mikrobus2').ok).toBe(false)
  })
})

describe('tp6-4 (test 13)', () => {
  it(`${JOY_POSITIONS.length} positions du joystick → carré attendu, toujours exactement 4 LED`, () => {
    const v = grade('tp6-4')
    expect(v, v.messages.join(' | ')).toMatchObject({ ok: true })
    expect(JOY_POSITIONS).toHaveLength(9)
  })
  it('un carré de 9 LED (3x3) est refusé', () => {
    const big = SOLUTIONS['tp6/q4'].replace('        Tab[col - 2] = Tab[col - 1];', '        Tab[col - 1] |= 0x80 >> lig;\n        Tab[col - 2] = Tab[col - 1];')
    const v = grade('tp6-4', big)
    expect(v.ok).toBe(false)
    expect(v.messages.join(' ')).toContain('exactement 4 LED')
  })
})

function project(mcc: MccConfig, main = '', matrix: 'mikrobus1' | 'mikrobus2' | null = 'mikrobus1') {
  const p = blankProject('tp6', 'tp6', 'tp6')
  const slots = { mikrobus1: null, mikrobus2: null, ...(matrix ? { [matrix]: 'matrix8x8' as const } : {}) }
  const g = runGenerate({ ...p, mcc, bench: { ...p.bench, usbWhite: true, slots } }).project
  return main ? { ...g, files: { ...g.files, 'main.c': main } } : g
}

describe('Faire vérifier TP6', () => {
  it('configurations de référence conformes', () => {
    expect(verifyTp6(project(tp61Config()), 'tp6-1-1')).toEqual([])
    expect(verifyTp6(project(tp62Config(), SOLUTIONS['tp6/q2']), 'tp6-2')).toEqual([])
    expect(verifyTp6(project(tp63Config()), 'tp6-3')).toEqual([])
    expect(verifyTp6(project(tp64Config()), 'tp6-4')).toEqual([])
  })
  it('carte sur le mikroBUS 2, LOAD sans Start High, PEIE absent, voie mal nommée : signalés', () => {
    expect(verifyTp6(project(tp63Config(), '', 'mikrobus2'), 'tp6-3').join(' ')).toContain('mikroBUS 2')
    const noHigh = tp63Config()
    expect(verifyTp6(project({ ...noHigh, pins: noHigh.pins.map((p) => ({ ...p, startHigh: false })) }), 'tp6-3').join(' ')).toContain('Start High')
    expect(verifyTp6(project(tp62Config(), SOLUTIONS['tp6/q2'].replace('    INTERRUPT_PeripheralInterruptEnable();\n', '')), 'tp6-2').join(' ')).toContain('PEIE')
    const c = tp61Config()
    expect(verifyTp6(project({ ...c, pins: c.pins.map((p) => (p.pin === 'RA0' ? { ...p, customName: 'channel_ANA0' } : p)) }), 'tp6-1-1').join(' ')).toContain('Custom Name « POT »')
  })
})
