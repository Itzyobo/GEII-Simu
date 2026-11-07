import { describe, expect, it } from 'vitest'
import { CR_FIXTURES } from '../fixtures'
import { generate } from '../mcc/generator'
import { tp21Config, tp22Config, tp23Config, tp31AConfig, tp31BConfig, tp31CConfig, tp32Config } from '../mcc/presets'
import type { MccConfig } from '../mcc/config'
import { blankProject, runGenerate, type SlotId } from '../project/project'
import { verifyTp2, verifyTp3 } from '../project/verify23'
import { SOLUTIONS } from '../solutions'
import { maxPeriodFosc4, partsOf, tmr2Fields } from '../tp/content23'
import { fmtMsFr, gradeTp23 } from './tp23'

const files = (main: string, cfg: MccConfig) => ({ 'main.c': main, ...generate(cfg) })

describe('fmtMsFr', () => {
  it('3 chiffres significatifs, virgule décimale, espace des milliers', () => {
    expect(fmtMsFr(1)).toBe('1 000 ms')
    expect(fmtMsFr(0.063488)).toBe('63,5 ms')
    expect(fmtMsFr(0.01)).toBe('10 ms')
  })
})

describe('professeur virtuel TP2', () => {
  it('1.1 : code du CR validé ; GIE en commentaire → refus qui le signale', () => {
    expect(gradeTp23('tp2-1-1', files(CR_FIXTURES['tp2/q1_1'], tp21Config()), null)).toMatchObject({ ok: true })
    const v = gradeTp23('tp2-1-1', files(CR_FIXTURES['tp2/q1_1'].replace('    INTERRUPT_GlobalInterruptEnable();', '    //INTERRUPT_GlobalInterruptEnable();'), tp21Config()), null)
    expect(v.ok).toBe(false)
    expect(v.messages.join(' ')).toContain('décommenter INTERRUPT_GlobalInterruptEnable()')
  })
  it('2.2 : code du CR validé avec la Rotary sur le mikroBUS 2 ; carte absente → refus', () => {
    expect(gradeTp23('tp2-2-2', files(CR_FIXTURES['tp2/q2_2'], tp22Config()), 'mikrobus2')).toMatchObject({ ok: true })
    expect(gradeTp23('tp2-2-2', files(CR_FIXTURES['tp2/q2_2'], tp22Config()), null).messages[0]).toContain('absente')
  })
  it('2.3 : D3 suit le sens sur le mikroBUS 2 ; refusé sur le mikroBUS 1', () => {
    expect(gradeTp23('tp2-2-3', files(CR_FIXTURES['tp2/q2_3'], tp23Config()), 'mikrobus2')).toMatchObject({ ok: true })
    const v = gradeTp23('tp2-2-3', files(CR_FIXTURES['tp2/q2_3'], tp23Config()), 'mikrobus1')
    expect(v.ok).toBe(false)
    expect(v.messages.join(' ')).toContain('mikroBUS 1')
  })
  it('2.4 : solution validée ; le code de 2.3 est refusé', () => {
    expect(gradeTp23('tp2-2-4', files(SOLUTIONS['tp2/q2_4'], tp23Config()), 'mikrobus2')).toMatchObject({ ok: true })
    expect(gradeTp23('tp2-2-4', files(CR_FIXTURES['tp2/q2_3'], tp23Config()), 'mikrobus2').ok).toBe(false)
  })
})

describe('professeur virtuel TP3 (test 9)', () => {
  const q1 = CR_FIXTURES['tp3/q1']
  it('1A validé (1,008 s dans ± 1 %)', () => {
    expect(gradeTp23('tp3-1', files(q1, tp31AConfig()), null)).toMatchObject({ ok: true })
  })
  it('1B refusé : « Période : 1 000 ms attendue, 63,5 ms mesurée »', () => {
    expect(gradeTp23('tp3-1', files(q1, tp31BConfig()), null)).toEqual({ ok: false, messages: ['Période : 1 000 ms attendue, 63,5 ms mesurée'] })
  })
  it('1C validé (solution : code du CR inchangé, configuration tp3-1C)', () => {
    expect(gradeTp23('tp3-1', files(q1, tp31CConfig()), null)).toMatchObject({ ok: true })
  })
  it('2 : code du CR validé avec tp3-2 ; Roll over à la place du monostable → refus', () => {
    expect(gradeTp23('tp3-2', files(CR_FIXTURES['tp3/q2'], tp32Config()), null)).toMatchObject({ ok: true })
    const roll = { ...tp32Config(), timers: { TMR2: { ...tp32Config().timers!.TMR2!, controlMode: 'Roll over pulse', startOption: 'Software control' } } }
    expect(gradeTp23('tp3-2', files(CR_FIXTURES['tp3/q2'], roll), null).ok).toBe(false)
  })
})

function project(kind: 'tp2' | 'tp3', mcc: MccConfig, rotary: SlotId | null = null) {
  const p = blankProject(kind, kind, kind)
  const slots = { mikrobus1: null, mikrobus2: null, ...(rotary ? { [rotary]: 'rotary' as const } : {}) }
  return runGenerate({ ...p, mcc, bench: { ...p.bench, slots } }).project
}

describe('Faire vérifier TP2 / TP3 (test 14)', () => {
  it('TP2 §2 : Rotary absente ou sur le mikroBUS 1 → refus avec message ; mikroBUS 2 → conforme', () => {
    expect(verifyTp2(project('tp2', tp23Config()), 'tp2-2-3').join(' ')).toContain('absente : l’enficher sur le mikroBUS 2')
    expect(verifyTp2(project('tp2', tp23Config(), 'mikrobus1'), 'tp2-2-3').join(' ')).toContain('sur le mikroBUS 1 (MODULE 1) : ENCA et ENCB n’arrivent pas sur RD1 et RA2')
    expect(verifyTp2(project('tp2', tp23Config(), 'mikrobus2'), 'tp2-2-3')).toEqual([])
  })
  it('TP2 §1 n’exige pas la Rotary ; 2.3 exige l’IOC « any » sur ENCB', () => {
    expect(verifyTp2(project('tp2', tp21Config()), 'tp2-1-1')).toEqual([])
    expect(verifyTp2(project('tp2', tp22Config(), 'mikrobus2'), 'tp2-2-3').join(' ')).toContain('ENCB (RA2) : IOC « any » attendue')
  })
  it('TP3 : configurations tp3-1C et tp3-2 conformes ; Monostable manquant signalé', () => {
    expect(verifyTp3(project('tp3', tp31CConfig()), 'tp3-1')).toEqual([])
    expect(verifyTp3(project('tp3', tp32Config()), 'tp3-2')).toEqual([])
    expect(verifyTp3(project('tp3', tp31CConfig()), 'tp3-2').join(' ')).toContain('Control Mode « Monostable » attendu')
  })
})

describe('questions calculées', () => {
  it('valeurs de tmr2.c lues dans le projet (tp3-1C : T2PR 241, LFINTOSC 0x04, 1:128)', () => {
    expect(tmr2Fields(project('tp3', tp31CConfig()))?.map((f) => f.expected)).toEqual([241, 0x04, 128])
  })
  it('période maximale à FOSC/4, 4 MHz : 524,288 ms', () => {
    expect(maxPeriodFosc4()).toBeCloseTo(0.524288, 9)
  })
  it('chaque question a au moins une partie', () => {
    for (const id of ['tp2-1-1', 'tp2-1-2', 'tp2-2-1', 'tp2-2-2', 'tp2-2-3', 'tp2-2-4', 'tp3-1', 'tp3-2', 'tp3-3'] as const) expect(partsOf(id, project(id.startsWith('tp2') ? 'tp2' : 'tp3', tp32Config())).length).toBeGreaterThan(0)
  })
})
