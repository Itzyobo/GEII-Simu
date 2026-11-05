import { describe, expect, it } from 'vitest'
import { INFO3 } from '../../data/reference'
import { crProject } from '../fixtures'
import { createSimState, handleMessage } from './handler'
import type { OutMsg } from './protocol'

const frames = (msgs: OutMsg[]) => msgs.filter((m): m is Extract<OutMsg, { type: 'frame' }> => m.type === 'frame')

describe('Worker : handleMessage', () => {
  it('au plus 30 images par seconde simulée à ×1, et seulement les différences', () => {
    let clock = 0
    const state = createSimState(() => clock)
    const loaded = handleMessage(state, { type: 'load', files: crProject('tp1/q3_3') })
    expect(loaded.some((m) => m.type === 'output' && m.text.startsWith('BUILD SUCCESSFUL'))).toBe(true)
    handleMessage(state, { type: 'run', speed: 1 })
    const out: OutMsg[] = []
    // 3 s de temps réel par ticks de 1 ms
    for (let k = 0; k < 3000; k++) {
      clock += 1
      out.push(...handleMessage(state, { type: 'tick', wallMs: 1 }))
    }
    const f = frames(out)
    expect(state.vm!.timeS).toBeGreaterThanOrEqual(3 - 0.01)
    expect(f.length).toBeLessThanOrEqual(INFO3.vm.frameRateHz * 3)
    expect(f.length).toBeGreaterThanOrEqual(INFO3.vm.frameRateHz * 3 - 1)
    // Par seconde simulée : au plus 30 images
    for (let s = 0; s < 3; s++) expect(f.filter((x) => x.tSim >= s && x.tSim < s + 1).length).toBeLessThanOrEqual(INFO3.vm.frameRateHz)
    // Différences seulement : RA4 n'apparaît que dans les images où D2 a changé (6 bascules en 3 s)
    const withRa4 = f.filter((x) => 'RA4' in x.pinsDiff)
    expect(withRa4.length).toBeGreaterThanOrEqual(5)
    expect(withRa4.length).toBeLessThanOrEqual(7)
    const allKeys = f.flatMap((x) => Object.keys(x.pinsDiff))
    expect(allKeys.every((k) => k === 'RA4')).toBe(true)
    // ledDuty : fraction du temps à 1 sur l'image (0, 1 ou entre les deux à la bascule)
    for (const x of f) for (const v of Object.values(x.ledDuty)) expect(v).toBeGreaterThanOrEqual(0)
    expect(f.some((x) => x.ledDuty.D2 === 1)).toBe(true)
    expect(f.some((x) => x.ledDuty.D2 === 0)).toBe(true)
  })

  it('×10 : 10 fois plus de temps simulé, toujours ≤ 30 images par seconde réelle', () => {
    let clock = 0
    const state = createSimState(() => clock)
    handleMessage(state, { type: 'load', files: crProject('tp1/q3_5') })
    handleMessage(state, { type: 'run', speed: 10 })
    const out: OutMsg[] = []
    for (let k = 0; k < 1000; k++) {
      clock += 1
      out.push(...handleMessage(state, { type: 'tick', wallMs: 1 }))
    }
    expect(state.vm!.timeS).toBeGreaterThanOrEqual(9.9)
    expect(frames(out).length).toBeLessThanOrEqual(INFO3.vm.frameRateHz)
  })

  it('erreur de compilation → messages output avec fichier, ligne, colonne', () => {
    const state = createSimState(() => 0)
    const out = handleMessage(state, { type: 'load', files: { 'main.c': 'void main(void) {\n    y = 2;\n}\n' } })
    const err = out.find((m) => m.type === 'output' && m.level === 'error' && m.line)
    expect(err).toMatchObject({ file: 'main.c', line: 2, col: 5 })
  })

  it('stimulus, pause, step, breakpoint (avertissement au 2e)', () => {
    let clock = 0
    const state = createSimState(() => clock)
    handleMessage(state, { type: 'load', files: crProject('tp1/q3_4') })
    handleMessage(state, { type: 'run', speed: 1 })
    handleMessage(state, { type: 'stimulus', action: 'press', button: 'S1', bounce: false })
    for (let k = 0; k < 50; k++) handleMessage(state, { type: 'tick', wallMs: (clock += 1, 1) })
    expect(state.vm!.getPin('RA4')).toBe(1)
    expect(handleMessage(state, { type: 'pause' })).toContainEqual({ type: 'halted', reason: 'pause' })
    expect(handleMessage(state, { type: 'breakpoint', file: 'main.c', line: 7 }).some((m) => m.type === 'output' && m.level === 'warning')).toBe(false)
    expect(handleMessage(state, { type: 'breakpoint', file: 'main.c', line: 9 }).some((m) => m.type === 'output' && m.level === 'warning')).toBe(true)
    const st = handleMessage(state, { type: 'step' })
    expect(st.find((m) => m.type === 'stopped')).toMatchObject({ type: 'stopped', file: expect.any(String), line: expect.any(Number) })
    const so = handleMessage(state, { type: 'stepOver' })
    expect(so.some((m) => m.type === 'stopped')).toBe(true)
  })

  it('build seul : BUILD SUCCESSFUL (total time: … ms), sans charger ; inspect : variables et SFR', () => {
    let clock = 0
    const state = createSimState(() => (clock += 3))
    const b = handleMessage(state, { type: 'build', files: crProject('tp1/q3_5') })
    expect(b.find((m) => m.type === 'output' && m.text.startsWith('BUILD'))).toMatchObject({ text: 'BUILD SUCCESSFUL (total time: 3 ms)' })
    expect(b).toContainEqual({ type: 'built', ok: true, ms: 3, loaded: false })
    expect(state.vm).toBeNull()
    handleMessage(state, { type: 'load', files: crProject('tp1/q3_5') })
    handleMessage(state, { type: 'stepOver' })
    handleMessage(state, { type: 'stepOver' })
    const snap = handleMessage(state, { type: 'inspect' }).find((m) => m.type === 'snapshot')
    expect(snap).toMatchObject({ type: 'snapshot', func: 'main' })
    if (snap?.type !== 'snapshot') throw new Error('snapshot absent')
    expect(snap.locals.map((l) => l.name)).toEqual(['Chenille'])
    expect(snap.sfrs.find((r) => r.name === 'TRISA')).toEqual({ name: 'TRISA', value: '0x0F' })
  })

  it('grade : verdict du professeur virtuel', () => {
    const state = createSimState(() => 0)
    const out = handleMessage(state, { type: 'grade', question: 'tp1-3-3', files: crProject('tp1/q3_3') })
    expect(out).toEqual([{ type: 'graded', question: 'tp1-3-3', ok: true, messages: [expect.stringMatching(/^Période de D2 : 1 000 ms/)] }])
  })
})
