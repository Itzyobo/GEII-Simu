import { describe, expect, it } from 'vitest'
import { generate } from '../mcc/generator'
import { tp1Config, tp41Config, tp42Config, tp45Config } from '../mcc/presets'
import { updateMssp, type MccConfig } from '../mcc/config'
import { blankProject, runGenerate } from '../project/project'
import { verifyTp4 } from '../project/verify23'
import { sckFields } from '../tp/content23'
import { SOLUTIONS } from '../solutions'
import { gradeTp4, type Tp4Challenge } from './tp4'

const files = (main: string, cfg: MccConfig) => ({ 'main.c': main, ...generate(cfg) })
/** Solution et configuration de référence de chaque question */
const REF: Record<Tp4Challenge, [string, MccConfig]> = {
  'tp4-1': ['tp4/q1', tp41Config(3)],
  'tp4-2': ['tp4/q2', tp42Config(0)],
  'tp4-3': ['tp4/q3', tp42Config(0)],
  'tp4-4': ['tp4/q4', tp42Config(0)],
  'tp4-5': ['tp4/q5', tp45Config(0)],
  'tp4-6': ['tp4/q6', tp42Config(0)],
}
const grade = (id: Tp4Challenge, main = SOLUTIONS[REF[id][0]], cfg = REF[id][1], slot: 'mikrobus1' | 'mikrobus2' | null = 'mikrobus2') => gradeTp4(id, files(main, cfg), slot)

describe('professeur virtuel TP4 (test 11)', () => {
  for (const id of Object.keys(REF) as Tp4Challenge[]) {
    it(`${id} : solution validée, verdict identique sur 20 exécutions`, () => {
      const first = grade(id)
      expect(first, first.messages.join(' | ')).toMatchObject({ ok: true })
      for (let k = 1; k < 20; k++) expect(grade(id)).toEqual(first)
    })
  }
})

function project(mcc: MccConfig, rotary: 'mikrobus1' | 'mikrobus2' | null = 'mikrobus2') {
  const p = blankProject('tp4', 'tp4', 'tp4')
  const slots = { mikrobus1: null, mikrobus2: null, ...(rotary ? { [rotary]: 'rotary' as const } : {}) }
  return runGenerate({ ...p, mcc, bench: { ...p.bench, slots } }).project
}

describe('Faire vérifier TP4', () => {
  it('configurations de référence conformes ; Rotary absente, MSSP1 absent, RST en entrée signalés', () => {
    expect(verifyTp4(project(tp41Config(3)), 'tp4-1')).toEqual([])
    expect(verifyTp4(project(tp42Config(0)), 'tp4-4')).toEqual([])
    expect(verifyTp4(project(tp45Config(0)), 'tp4-5')).toEqual([])
    expect(verifyTp4(project(tp42Config(0), null), 'tp4-2').join(' ')).toContain('absente : l’enficher sur le mikroBUS 2')
    expect(verifyTp4(project(tp1Config()), 'tp4-1').join(' ')).toContain('MSSP1 absent')
    expect(verifyTp4(project(tp41Config(0)), 'tp4-2').join(' ')).toContain('RST (RD2) : sortie numérique attendue')
    expect(verifyTp4(project(tp42Config(0)), 'tp4-5').join(' ')).toContain('ENCA absente')
  })
  it('période de SCK attendue : calculée depuis la configuration (1 µs en Fosc/4, 16 µs en Fosc/64)', () => {
    expect(sckFields(project(tp41Config(3)))?.[0].expected).toBeCloseTo(1, 9)
    expect(sckFields(project(updateMssp(tp41Config(3), { clockSource: 'FOSC/64' })))?.[0].expected).toBeCloseTo(16, 9)
  })
})

describe('refus attendus', () => {
  it('Q1 en mode 0 : refusé (mode 3 demandé)', () => {
    expect(grade('tp4-1', undefined, tp41Config(0)).messages.join(' ')).toContain('Mode SPI : 3 attendu, 0 configuré')
  })
  it('Q2 en mode 1 : motif décalé d’un rang, explication H14', () => {
    const v = grade('tp4-2', undefined, tp42Config(1))
    expect(v.ok).toBe(false)
    expect(v.messages.join(' ')).toContain('décalé d’un rang')
  })
  it('Q2 : LED 9, 13, 14 signalées sans refus', () => {
    const v = grade('tp4-2')
    expect(v.ok).toBe(true)
    expect(v.messages.join(' ')).toContain('LED 9, 13, 14 aussi allumées')
  })
  it('Q3 : octets inversés détectés', () => {
    const swapped = SOLUTIONS['tp4/q3'].replace('    SPI1_ExchangeByte(led_state >> 8);      // part en premier, finit dans U3 (LED 9 a 16)\n    SPI1_ExchangeByte(led_state & 0xFF);    // U2 (LED 1 a 8)', '    SPI1_ExchangeByte(led_state & 0xFF);\n    SPI1_ExchangeByte(led_state >> 8);')
    const v = grade('tp4-3', swapped)
    expect(v.ok).toBe(false)
    expect(v.messages.join(' ')).toContain('octets sont inversés')
  })
  it('Q6 (R2) : deux animations enchaînées sans bouton → validé, déclenchement « sans action »', () => {
    const chained = `#include "mcc_generated_files/mcc.h"
void led_ring_display16(uint16_t led_state)
{
    SPI1_ExchangeByte(led_state >> 8);
    SPI1_ExchangeByte(led_state & 0xFF);
    LATCH_SetHigh();
    LATCH_SetLow();
}
void main(void)
{
    uint16_t motif;
    uint8_t i;
    SYSTEM_Initialize();
    RST_SetHigh();
    SPI1_Open(SPI1_DEFAULT);
    while (1)
    {
        motif = 0xF0F0;
        for (i = 0; i < 32; i++) { led_ring_display16(motif); motif = (motif << 1) | (motif >> 15); __delay_ms(100); }
        motif = 0x0001;
        for (i = 0; i < 16; i++) { led_ring_display16(motif); motif = motif << 1; __delay_ms(100); }
    }
}
`
    const v = grade('tp4-6', chained)
    expect(v, v.messages.join(' | ')).toMatchObject({ ok: true })
    expect(v.messages.join(' ')).toContain('sans action')
    // La solution de référence (S1) reste validée, avec l'appui indiqué
    expect(grade('tp4-6').messages.join(' ')).toContain('après un appui sur S1')
  })
  it('Q6 : une seule animation (0xF0F0 qui tourne) → refusé', () => {
    const only = SOLUTIONS['tp4/q6'].replace('animation = 2;', 'animation = 1;')
    const v = grade('tp4-6', only)
    expect(v.ok).toBe(false)
    expect(v.messages.join(' ')).toContain('Animation 2 : aucune autre animation')
  })
  it('Q4 sur le mikroBUS 1 : refusé, anneau éteint', () => {
    expect(grade('tp4-4', undefined, undefined, 'mikrobus1').ok).toBe(false)
  })
})
