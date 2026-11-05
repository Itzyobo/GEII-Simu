import { describe, expect, it } from 'vitest'
import { toggleGridPin, updatePin, type MccConfig } from '../mcc/config'
import { MAIN_TEMPLATE } from '../mcc/generator'
import { tp1Config } from '../mcc/presets'
import { blankProject, LOCK_MESSAGE, programCheck, runGenerate, setCard, setUsbBlack, type Project } from './project'
import { KEYS, loadLibre, loadProgress, loadTp1, saveLibre, saveTp1, importProject, exportProject, type KeyValueStore } from './storage'
import { runVerify, verifyTp1 } from './verify'

const withConfig = (mcc: MccConfig): Project => runGenerate({ ...blankProject('tp1', 'TP1', 'tp1'), mcc }).project
const rename = (c: MccConfig, pin: string, name: string) => updatePin(c, pin, { customName: name })

describe('Faire vérifier (TP1, §4)', () => {
  it('configuration TP1 complète : validée', () => {
    const r = runVerify(withConfig(tp1Config()), 'tp1-4-2')
    expect(r.errors).toEqual([])
    expect(r.project.verified).toBe(true)
  })

  const cases: [string, (c: MccConfig) => MccConfig, string][] = [
    ['LED_D2 sur RA3', (c) => rename(toggleGridPin(toggleGridPin(c, 'RA4', 'output'), 'RA3', 'output'), 'RA3', 'LED_D2'), 'LED_D2 est sur RA3 : attendue sur RA4'],
    ['nom « Led_D2 »', (c) => rename(c, 'RA4', 'Led_D2'), 'Nom « Led_D2 » sur RA4 : le nom exact attendu est « LED_D2 » (majuscules comprises)'],
    ['BP_S1 en sortie', (c) => toggleGridPin(c, 'RB4', 'output'), 'BP_S1 (RB4) doit être en entrée'],
    ['BP_S1 en Analog', (c) => updatePin(c, 'RB4', { analog: true }), 'BP_S1 (RB4) est en Analog : décocher Analog pour une entrée numérique (sinon la broche est lue à 0)'],
    ['LED_D5 absente', (c) => toggleGridPin(c, 'RA7', 'output'), 'LED_D5 absente : attendue sur RA7 en sortie'],
    ['BP_S2 sur RC4', (c) => rename(updatePin(toggleGridPin(toggleGridPin(c, 'RC5', 'input'), 'RC4', 'input'), 'RC4', { analog: false }), 'RC4', 'BP_S2'), 'BP_S2 est sur RC4 : attendu sur RC5'],
  ]
  it('6 cas couverts', () => expect(cases).toHaveLength(6))
  it.each(cases)('%s : détecté avec son message', (_, mutate, message) => {
    const p = withConfig(mutate(tp1Config()))
    const errors = verifyTp1(p, 'tp1-4-2')
    expect(errors).toEqual([message])
    expect(runVerify(p, 'tp1-4-2').project.verified).toBe(false)
  })

  it('exigences progressives : pour 3.3, LED_D2 seule suffit', () => {
    const c = rename(toggleGridPin({ ...tp1Config(), pins: [] }, 'RA4', 'output'), 'RA4', 'LED_D2')
    expect(verifyTp1(withConfig(c), 'tp1-3-3')).toEqual([])
    expect(verifyTp1(withConfig(c), 'tp1-3-4')).toEqual(['BP_S1 absente : attendue sur RB4 en entrée'])
  })

  it('Generate oublié après une modification, _XTAL_FREQ incohérent', () => {
    const p = withConfig(tp1Config())
    const stale = { ...p, mcc: { ...p.mcc, system: { ...p.mcc.system, divider: 2 } } }
    expect(verifyTp1(stale, 'tp1-3-3')).toEqual(['La configuration MCC a changé depuis le dernier Generate'])
    const edited = { ...p, generated: { ...p.generated!, 'mcc_generated_files/device_config.h': p.generated!['mcc_generated_files/device_config.h'].replace('4000000', '16000000') } }
    expect(verifyTp1(edited, 'tp1-3-3')).toEqual(['_XTAL_FREQ (16000000 Hz) différent du Fosc configuré dans le System Module (4000000 Hz)'])
    expect(verifyTp1(blankProject('tp1', 'TP1'), 'tp1-3-1')).toEqual(['LED_D2 absente : attendue sur RA4 en sortie', 'Generate n’a pas été fait : les fichiers MCC n’existent pas'])
  })
})

describe('Generate et main.c', () => {
  it('main.c créé au premier Generate seulement, jamais écrasé', () => {
    const p1 = runGenerate(blankProject('libre', 'L')).project
    expect(p1.files['main.c']).toBe(MAIN_TEMPLATE)
    const edited = { ...p1, files: { 'main.c': 'mon code' } }
    expect(runGenerate(edited).project.files['main.c']).toBe('mon code')
  })
  it('Custom Name invalide : Generate refusé', () => {
    const p = { ...blankProject('libre', 'L'), mcc: rename(toggleGridPin(tp1Config(), 'RD0', 'output'), 'RD0', 'int') }
    const r = runGenerate(p)
    expect(r.ok).toBe(false)
    expect(r.message).toBe('Generate refusé : RD0 : « int » est un mot-clé du C')
  })
})

describe('verrouillage et programmation', () => {
  const verified = () => runVerify(withConfig(tp1Config()), 'tp1-4-2').project

  it('enficher ou retirer une carte avec l’USB branché : refusé et compté', () => {
    let p = verified()
    p = setCard(p, 'mikrobus2', 'rotary').project
    p = setUsbBlack(p, true).project
    const a = setCard(p, 'mikrobus1', 'matrix8x8')
    expect(a).toMatchObject({ ok: false, message: LOCK_MESSAGE })
    expect(a.project.bench.lockAttempts).toBe(1)
    const b = setCard(a.project, 'mikrobus2', null)
    expect(b).toMatchObject({ ok: false, message: LOCK_MESSAGE })
    expect(b.project.bench.lockAttempts).toBe(2)
    expect(b.project.bench.slots).toEqual({ mikrobus1: null, mikrobus2: 'rotary' })
    const c = setCard(setUsbBlack(b.project, false).project, 'mikrobus2', null)
    expect(c.ok).toBe(true)
    expect(c.project.bench.slots.mikrobus2).toBeNull()
  })

  it('Program sans USB noir : message d’erreur', () => {
    expect(programCheck(verified())).toBe('Programmation impossible : brancher l’USB noir (PKOB), la carte n’est pas alimentée')
  })

  it('Program sans Faire vérifier : bloqué (USB refusé avant vérification, programmation bloquée)', () => {
    const p = withConfig(tp1Config())
    expect(setUsbBlack(p, true)).toMatchObject({ ok: false, message: 'Faire vérifier avant la première mise sous tension' })
    const forced = { ...p, bench: { ...p.bench, usbBlack: true } }
    expect(programCheck(forced)).toBe('Programmation bloquée : faire vérifier la configuration avant la première mise sous tension')
    expect(programCheck(setUsbBlack(verified(), true).project)).toBeNull()
  })

  it('mode libre : pas de Faire vérifier exigé', () => {
    const p = setUsbBlack(blankProject('libre', 'L'), true)
    expect(p.ok).toBe(true)
    expect(programCheck(p.project)).toBeNull()
  })
})

/** Stockage en mémoire, comme localStorage */
function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) }
}

describe('persistance (tpsim.info3.v1.*)', () => {
  it('un rechargement restaure les fichiers et la configuration MCC', () => {
    const s = memoryStore()
    const p = { ...withConfig(tp1Config()), files: { 'main.c': 'code de l’étudiant', 'util.h': '#define X 1' } }
    saveTp1(p, s)
    expect([...s.data.keys()]).toEqual([KEYS.tp1])
    const back = loadTp1(s)
    expect(back.files).toEqual(p.files)
    expect(back.mcc).toEqual(p.mcc)
    expect(back.generated).toEqual(p.generated)
  })

  it('JSON corrompu → projet vierge, sans exception', () => {
    for (const bad of ['{pas du json', '"texte"', '{"version":1}', '{"version":2,"id":"x"}', JSON.stringify({ version: 1, id: 'tp1', name: 'x', kind: 'tp1', files: { 'main.c': 3 } }), 'null']) {
      const s = memoryStore()
      s.setItem(KEYS.tp1, bad)
      s.setItem(KEYS.libre, bad)
      s.setItem(KEYS.progress, bad)
      expect(() => loadTp1(s)).not.toThrow()
      expect(loadTp1(s)).toMatchObject({ kind: 'tp1', files: {}, generated: null })
      expect(loadLibre(s).projects).toHaveLength(1)
      expect(loadProgress(s)).toEqual({})
    }
  })

  it('stockage indisponible (exception) : projet vierge', () => {
    const throwing: KeyValueStore = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceeded')
      },
      removeItem: () => {},
    }
    expect(loadTp1(throwing).files).toEqual({})
    expect(() => saveTp1(blankProject('tp1', 'x'), throwing)).not.toThrow()
  })

  it('mode libre : plusieurs projets, export puis import JSON', () => {
    const s = memoryStore()
    const st = loadLibre(s)
    const p2 = { ...blankProject('libre', 'Projet 2', 'libre-2'), files: { 'main.c': 'x' } }
    saveLibre({ ...st, projects: [...st.projects, p2], currentId: 'libre-2' }, s)
    const back = loadLibre(s)
    expect(back.projects.map((p) => p.name)).toEqual(['Projet 1', 'Projet 2'])
    expect(back.currentId).toBe('libre-2')
    const imported = importProject(exportProject(p2), 'libre-3')
    expect(imported).toMatchObject({ id: 'libre-3', name: 'Projet 2', files: { 'main.c': 'x' } })
    expect(importProject('{"oups"', 'z')).toBeNull()
  })
})
