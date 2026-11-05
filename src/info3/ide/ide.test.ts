import { describe, expect, it } from 'vitest'
import { crProject, MCC_TP1 } from '../fixtures'
import { tp1Config } from '../mcc/presets'
import { diagnose } from '../project/diagnostic'
import { blankProject, runGenerate, setCard } from '../project/project'
import { EditorState } from '@codemirror/state'
import { indentRange, indentUnit } from '@codemirror/language'
import { cLanguage, INDENT } from './cLanguage'
import { completionNames, findDefinition } from './symbols'

describe('symboles du projet (Ctrl+Espace, Ctrl+clic)', () => {
  const files = crProject('tp1/q3_6')
  it('aller à la définition : fonction (corps, pas le prototype), macro MCC, globale', () => {
    expect(findDefinition(files, 'Decale_Gauche')).toMatchObject({ file: 'main.c', line: 5, kind: 'function' })
    expect(findDefinition(files, 'LED_D2_Toggle')).toMatchObject({ file: 'mcc_generated_files/pin_manager.h', kind: 'macro' })
    expect(findDefinition(files, 'SYSTEM_Initialize')).toMatchObject({ file: 'mcc_generated_files/mcc.c', kind: 'function' })
    expect(findDefinition(files, 'Chenille')).toMatchObject({ file: 'main.c', line: 2, col: 9, kind: 'variable' })
    expect(findDefinition(files, 'inconnu')).toBeNull()
  })
  it('complétion : symboles du projet et macros MCC', () => {
    const names = completionNames(files).map((c) => c.label)
    for (const n of ['BP_S1_GetValue', 'LED_D2_Toggle', 'Decale_Droite', 'Chenille', 'SYSTEM_Initialize', '_XTAL_FREQ']) expect(names).toContain(n)
    expect(Object.keys(MCC_TP1).length).toBeGreaterThan(0)
  })
})

describe('Diagnostic du mode libre (R1 à R4)', () => {
  const p = runGenerate({ ...blankProject('libre', 'L'), mcc: tp1Config() }).project
  it('aucune remarque sur une configuration saine', () => {
    expect(diagnose(p, { analogReads: [], inputWrites: [], fosc: 4e6 })).toEqual([])
  })
  it('R1 et R2 depuis l’exécution, R3 depuis l’horloge, R4 depuis le banc', () => {
    const q = { ...p, generated: { ...p.generated!, 'mcc_generated_files/device_config.h': p.generated!['mcc_generated_files/device_config.h'].replace('4000000', '16000000') } }
    const withCards = setCard(setCard(q, 'mikrobus1', 'rotary').project, 'mikrobus2', 'matrix8x8').project
    const f = diagnose(withCards, { analogReads: ['RB4'], inputWrites: ['RC5'], fosc: 4e6 })
    expect(f.map((x) => x.rule)).toEqual(['R1', 'R2', 'R3', 'R4', 'R4'])
    expect(f[0].text).toBe('RB4 lue en numérique alors que ANSB4 = 1 (Analog) : la lecture renvoie toujours 0')
    expect(f[3].text).toBe('Carte ROTARY O click sur le mikroBUS 1 : elle est prévue sur le mikroBUS 2')
  })
  it('R4 : carte au bon emplacement mais inutilisée', () => {
    const f = diagnose(setCard(p, 'mikrobus2', 'rotary').project, null)
    expect(f).toEqual([{ rule: 'R4', text: 'Carte ROTARY O click sur le mikroBUS 2 : aucune de ses broches n’est configurée dans MCC' }])
  })
})

describe('Source > Format (mode C léger)', () => {
  it('réindente selon les accolades, 4 espaces par niveau', () => {
    const src = 'void main(void)\n{\nSYSTEM_Initialize();\nwhile (1)\n{\nLED_D2_Toggle(); /* { */\n}\n}\n'
    const state = EditorState.create({ doc: src, extensions: [cLanguage, indentUnit.of(INDENT)] })
    const out = state.update({ changes: indentRange(state, 0, state.doc.length) }).state.doc.toString()
    expect(out).toBe('void main(void)\n{\n    SYSTEM_Initialize();\n    while (1)\n    {\n        LED_D2_Toggle(); /* { */\n    }\n}\n')
  })
})