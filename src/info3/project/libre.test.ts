/** Mode libre : projets de départ, export / import, Diagnostic R5 à R12 (consigne étape 7, tests 10 et 11). */
import { describe, expect, it } from 'vitest'
import { compile } from '../compiler'
import { updatePwm, updateTimer, updateAdcc, updateMssp, type MccConfig } from '../mcc/config'
import { tp1Config, tp21Config, tp42Config, tp51Config, tp61Config } from '../mcc/presets'
import { diagnose, type RuntimeDiag } from './diagnostic'
import { blankProject, projectFiles, runGenerate, type Project } from './project'
import { starterProject, STARTERS } from './starters'
import { exportProject, importProject } from './storage'

describe('projets de départ (test 10)', () => {
  it('les 8 projets se compilent sans erreur ni warning', () => {
    expect(STARTERS).toHaveLength(8)
    for (const s of STARTERS) {
      const p = starterProject(s, `id-${s.id}`)
      const r = compile(projectFiles(p))
      expect(r.ok, s.id).toBe(true)
      expect(r.diagnostics.map((d) => `${d.file}:${d.line} ${d.message}`), s.id).toEqual([])
      expect(!!p.registersOnly, s.id).toBe(s.id === 'registres')
    }
  })
  it('export puis import : fichiers, MCC, cartes et câbles identiques, octet pour octet sur les fichiers', () => {
    const p0 = starterProject(STARTERS[4], 'x')
    const p = { ...p0, files: { ...p0.files, 'main.c': 'é\r\n\tint x;  \n' }, bench: { ...p0.bench, usbWhite: true, cover: true, slots: { mikrobus1: null, mikrobus2: 'rotary' as const } } }
    const back = importProject(exportProject(p), 'y')!
    expect(back.files).toEqual(p.files)
    expect(back.files['main.c']).toBe(p.files['main.c'])
    expect(back.generated).toEqual(p.generated)
    expect(back.mcc).toEqual(p.mcc)
    expect(back.bench).toEqual(p.bench)
    const r = importProject(exportProject(starterProject(STARTERS[7], 'r')), 'z')!
    expect(r.registersOnly).toBe(true)
  })
})

const proj = (mcc: MccConfig, bench: Partial<Project['bench']> = {}): Project => {
  const p = runGenerate({ ...blankProject('libre', 'p', 'p'), mcc }).project
  return { ...p, bench: { ...p.bench, ...bench } }
}
const rt = (x: Partial<RuntimeDiag> = {}): RuntimeDiag => ({ analogReads: [], inputWrites: [], fosc: 4e6, irq: { gie: 1, peie: 1, sources: [] }, uart: { sent: 0, baud: 9615, termBaud: 9600, usbWhite: true }, shared: [], ...x })
const rules = (p: Project, r: RuntimeDiag | null = rt()) => diagnose(p, r).map((f) => f.rule)

describe('Diagnostic R5 à R12 (test 11)', () => {
  it('cas sain : aucun diagnostic', () => {
    expect(diagnose(proj(tp1Config()), rt())).toEqual([])
  })
  it('R5 : TMR2IE à 1 avec PEIE = 0', () => {
    expect(rules(proj(tp1Config()), rt({ irq: { gie: 1, peie: 0, sources: [{ name: 'TMR2', ie: 1 }] } }))).toContain('R5')
    expect(rules(proj(tp1Config()), rt({ irq: { gie: 1, peie: 0, sources: [{ name: 'IOC', ie: 1 }] } }))).not.toContain('R5')
  })
  it('R6 : IOC configurée, GIE resté à 0', () => {
    expect(rules(proj(tp21Config()), rt({ irq: { gie: 0, peie: 0, sources: [{ name: 'IOC', ie: 1 }] } }))).toContain('R6')
  })
  it('R7 : carte Rotary sur le mikroBUS 1, code configuré pour les broches du mikroBUS 2', () => {
    expect(rules(proj(tp42Config(0), { slots: { mikrobus1: 'rotary', mikrobus2: null } }))).toContain('R7')
    expect(rules(proj(tp42Config(0), { slots: { mikrobus1: null, mikrobus2: 'rotary' } }))).not.toContain('R7')
  })
  it('R8 : PWM sur un TMR2 en LFINTOSC', () => {
    expect(rules(proj(updateTimer(tp51Config(), 'TMR2', { clockSource: 'LFINTOSC' }), { usbWhite: true }))).toContain('R8')
    expect(rules(proj(updatePwm(tp51Config(), 'PWM6', {}), { usbWhite: true }))).not.toContain('R8')
  })
  it('R9 : SPI en mode 1 avec la carte Rotary', () => {
    expect(rules(proj(updateMssp(tp42Config(0), { mode: 1 }), { slots: { mikrobus1: null, mikrobus2: 'rotary' } }))).toContain('R9')
  })
  it('R10 : printf sans USB blanc ; terminal à 19 200 bauds pour un PIC à 9615', () => {
    expect(rules(proj(tp1Config()), rt({ uart: { sent: 20, baud: 9615, termBaud: 9600, usbWhite: false } }))).toContain('R10')
    expect(rules(proj(tp1Config()), rt({ uart: { sent: 20, baud: 9615, termBaud: 19200, usbWhite: true } }))).toContain('R10')
    expect(rules(proj(tp1Config()), rt({ uart: { sent: 20, baud: 9615, termBaud: 9600, usbWhite: true } }))).not.toContain('R10')
  })
  it('R11 : variable 16 bits partagée lue sans section critique', () => {
    expect(rules(proj(tp1Config()), rt({ shared: ['JoyX'] }))).toContain('R11')
  })
  it('R12 : TAD = 0,5 µs (FOSC/2 à 4 MHz)', () => {
    expect(rules(proj(updateAdcc(tp61Config(), { divider: 2 })))).toContain('R12')
    expect(rules(proj(tp61Config()))).not.toContain('R12')
  })
})
