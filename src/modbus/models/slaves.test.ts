import { describe, expect, it } from 'vitest'
import { REF } from '../data/reference'
import { fromHex, toHex } from './crc'
import { busRun } from './bus'
import { affichageTDS, analyzerDecode, crcOk, ledsOTB, moduleAt, pointDeRosee, pupitreInitial, signed16, slaveRespond, withCrc, wordsToFloat, type PupitreState } from './slaves'

/** Envoie les requêtes l'une après l'autre ; renvoie les réponses (hexa, '' = aucune) et l'état final. */
function envoyer(hex: string[], e: PupitreState = pupitreInitial(), t = 0) {
  const reponses: string[] = []
  for (const h of hex) {
    const req = fromHex(h)
    expect(crcOk(req), `CRC de la requête ${h}`).toBe(true)
    const m = moduleAt(e, req[0]!)
    if (!m) {
      reponses.push('')
      continue
    }
    const r = slaveRespond(e, m, req, t)
    e = r.etat
    reponses.push(r.reponse ? toHex(r.reponse) : '')
  }
  return { reponses, etat: e }
}
const une = (h: string, e?: PupitreState) => envoyer([h], e).reponses[0]
const leds = (e: PupitreState) => ledsOTB(e).flatMap((on, k) => (on ? [`Q${k}`] : []))

describe('OTB (23)', () => {
  it('17 06 00 64 00 5A 4A D8 → écho ; LED Q1, Q3, Q4, Q6 seules allumées', () => {
    const { reponses, etat } = envoyer(['17 06 00 64 00 5A 4A D8'])
    expect(reponses).toEqual(['17 06 00 64 00 5A 4A D8'])
    expect(leds(etat)).toEqual(['Q1', 'Q3', 'Q4', 'Q6'])
    expect(leds(etat)).toEqual(REF.otbLedsAllumees.value)
  })
  it('relecture des sorties : 17 03 00 64 00 01 C7 23 → 17 03 02 00 5A 71 BC', () => {
    expect(envoyer(['17 06 00 64 00 5A 4A D8', '17 03 00 64 00 01 C7 23']).reponses[1]).toBe('17 03 02 00 5A 71 BC')
  })
  it('inverseurs I0–I3 et I8–I11 : 17 03 00 00 00 01 86 FC → 17 03 02 0F 0F B4 73, CRC affiché 73B4H', () => {
    const e = pupitreInitial()
    e.otb.entrees = 0x0f0f
    const r = une('17 03 00 00 00 01 86 FC', e)
    expect(r).toBe('17 03 02 0F 0F B4 73')
    expect(r).toBe(toHex(REF.otbReponseEntrees.value))
    expect(analyzerDecode(fromHex(r!))).toEqual([
      'Trame type ESCLAVE : 17 03 02 0F 0F B4 73',
      'adresse esclave : 17H',
      'fonction demandée : 03H',
      'nombre d’octets lus : 2',
      'valeur des mots (en hexadécimal) : 0F0F',
      'valeur du CRC16 : 73B4H',
    ])
  })
  it('17 06 00 64 00 81 0A 83 → écho ; seules Q0 et Q7 allumées', () => {
    const { reponses, etat } = envoyer(['17 06 00 64 00 81 0A 83'])
    expect(reponses).toEqual(['17 06 00 64 00 81 0A 83'])
    expect(leds(etat)).toEqual(['Q0', 'Q7'])
  })
  it('octet fort du registre 100 ignoré (H41)', () => {
    expect(leds(envoyer([toHex(withCrc([0x17, 6, 0, 0x64, 0xff, 0x81]))]).etat)).toEqual(['Q0', 'Q7'])
  })
  it('adresse 100 saisie en hexa : 17 06 01 00 00 5A 0A FB → 17 86 02 22 65 ; 17 03 01 00 00 01 87 00 → 17 83 02 21 35', () => {
    expect(une('17 06 01 00 00 5A 0A FB')).toBe('17 86 02 22 65')
    expect(une('17 03 01 00 00 01 87 00')).toBe('17 83 02 21 35')
  })
  it('code d’identification : 17 03 04 4E 00 01 E7 DB → 17 03 02 60 04 D8 44', () => {
    expect(une('17 03 04 4E 00 01 E7 DB')).toBe('17 03 02 60 04 D8 44')
  })
  it('06 sur le registre 0 → exception 02 ; 04 → exception 01', () => {
    expect(fromHex(une(toHex(withCrc([0x17, 6, 0, 0, 0, 1])))!).slice(1, 3)).toEqual([0x86, 2])
    expect(fromHex(une(toHex(withCrc([0x17, 4, 0, 0, 0, 1])))!).slice(1, 3)).toEqual([0x84, 1])
  })
})

describe('TDS (30)', () => {
  it('1E 06 00 71 04 D2 59 23 → écho ; affichage « 1234 »', () => {
    const { reponses, etat } = envoyer(['1E 06 00 71 04 D2 59 23'])
    expect(reponses).toEqual(['1E 06 00 71 04 D2 59 23'])
    expect(affichageTDS(etat).glyphes).toBe('1234')
  })
  it('1234 en BCD : 1E 06 00 71 12 34 D6 C9 → écho ; affichage « 4660 »', () => {
    const { reponses, etat } = envoyer(['1E 06 00 71 12 34 D6 C9'])
    expect(reponses).toEqual(['1E 06 00 71 12 34 D6 C9'])
    expect(affichageTDS(etat).glyphes).toBe('4660')
  })
  it('10 000 : 1E 06 00 71 27 10 C1 82 → 1E 86 03 33 A7', () => {
    expect(une('1E 06 00 71 27 10 C1 82')).toBe('1E 86 03 33 A7')
  })
  it('« abcd » en 4 trames → affichage « AbCd » (photo)', () => {
    const trames = ['1E 06 00 64 00 61 0B 92', '1E 06 00 65 00 62 1A 53', '1E 06 00 66 00 63 2B 93', '1E 06 00 67 00 64 3B 91']
    const { reponses, etat } = envoyer(trames)
    expect(reponses).toEqual(trames)
    expect(affichageTDS(etat).glyphes).toBe(REF.tdsRenduAbcd.value)
  })
  it('entier aligné à droite sans zéros ; le dernier registre écrit fixe le mode (H44)', () => {
    const e = envoyer([toHex(withCrc([0x1e, 6, 0, 0x71, 0, 42]))]).etat
    expect(affichageTDS(e).glyphes).toBe('  42')
    expect(affichageTDS(envoyer(['1E 06 00 64 00 61 0B 92'], e).etat).glyphes).toBe('A   ')
  })
  it('luminosité : 1E 06 00 6E 00 04 EB BB → écho ; luminosité maximale', () => {
    const { reponses, etat } = envoyer(['1E 06 00 6E 00 04 EB BB'])
    expect(reponses).toEqual(['1E 06 00 6E 00 04 EB BB'])
    expect(affichageTDS(etat).luminosite).toBe(REF.tdsLuminositeMax.value)
  })
  it('fonction 16 : 1E 10 00 64 00 02 04 00 61 00 62 40 97 → 1E 90 01 BC 06', () => {
    expect(une('1E 10 00 64 00 02 04 00 61 00 62 40 97')).toBe('1E 90 01 BC 06')
  })
  it('durée d’affichage : éteint une fois la durée écoulée', () => {
    const { etat } = envoyer([toHex(withCrc([0x1e, 6, 0, 0x6f, 0, 5]))], pupitreInitial(), 10)
    expect(affichageTDS(etat, 12).luminosite).toBeGreaterThan(0)
    expect(affichageTDS(etat, 15).luminosite).toBe(0)
  })
})

describe('TQS (35)', () => {
  it('23 04 00 01 00 01 66 88 → 23 04 02 00 F3 01 72 → 24,3 °C', () => {
    const r = fromHex(une('23 04 00 01 00 01 66 88')!)
    expect(toHex(r)).toBe('23 04 02 00 F3 01 72')
    expect(signed16((r[3]! << 8) | r[4]!) / 10).toBe(24.3)
  })
  it('23 04 00 00 00 02 77 49 → 23 04 04 00 00 00 F3 B9 C3', () => {
    expect(une('23 04 00 00 00 02 77 49')).toBe('23 04 04 00 00 00 F3 B9 C3')
  })
  it('piège 03 au lieu de 04 : 23 03 00 01 00 01 D3 48 → 23 03 02 00 23 01 9A (l’adresse est lue)', () => {
    expect(une('23 03 00 01 00 01 D3 48')).toBe('23 03 02 00 23 01 9A')
  })
})

describe('THT (41)', () => {
  it('29 04 00 01 00 01 66 22 → 29 04 02 00 F0 D9 72 → 24,0 °C', () => {
    expect(une('29 04 00 01 00 01 66 22')).toBe('29 04 02 00 F0 D9 72')
  })
  it('29 04 00 05 00 01 27 E3 → 29 04 02 00 EF 98 BA → 23,9 %HR', () => {
    expect(une('29 04 00 05 00 01 27 E3')).toBe('29 04 02 00 EF 98 BA')
  })
  it('29 04 00 00 00 06 76 20 → 29 04 0C 00 00 00 F0 41 C0 00 00 00 00 00 EF FD D1', () => {
    expect(une('29 04 00 00 00 06 76 20')).toBe('29 04 0C 00 00 00 F0 41 C0 00 00 00 00 00 EF FD D1')
  })
  it('29 04 00 02 00 02 D6 23 → 29 04 04 41 C0 00 00 47 86 ; IEEE 754 = 24,0', () => {
    const r = fromHex(une('29 04 00 02 00 02 D6 23')!)
    expect(toHex(r)).toBe('29 04 04 41 C0 00 00 47 86')
    expect(wordsToFloat((r[3]! << 8) | r[4]!, (r[5]! << 8) | r[6]!)).toBe(24)
  })
  it('registres 6–7 = 436F0000H (239,0) ; FFCEH signé = −50 → −5,0 °C', () => {
    const r = fromHex(une(toHex(withCrc([0x29, 4, 0, 6, 0, 2])))!)
    expect(toHex(r.slice(3, 7))).toBe('43 6F 00 00')
    expect(wordsToFloat(0x436f, 0)).toBe(239)
    expect(signed16(0xffce)).toBe(-50)
    expect(signed16(0xffce) / 10).toBe(-5)
  })
  it('point de rosée (Magnus, H13) : registre 9 ≈ 21 (2,1 °C) ; registre 1 lu en 03 = 0029H', () => {
    expect(pointDeRosee(24, 23.9)).toBeCloseTo(REF.thtPointRosee.value, 1)
    const r = fromHex(une(toHex(withCrc([0x29, 4, 0, 9, 0, 1])))!)
    expect((r[3]! << 8) | r[4]!).toBe(Math.round(REF.thtPointRosee.value * 10))
    expect(fromHex(une(toHex(withCrc([0x29, 3, 0, 1, 0, 1])))!).slice(3, 5)).toEqual([0x00, 0x29])
  })
})

describe('configuration et réinitialisation (H43)', () => {
  it('nouvelle adresse prise aussitôt ; réinitialisé, le module répond de nouveau à son adresse d’origine', () => {
    const ecrire = toHex(withCrc([0x1e, 6, 0, 1, 0, 0x64]))
    const { reponses, etat } = envoyer([ecrire, '1E 06 00 6E 00 04 EB BB'])
    expect(reponses).toEqual([ecrire, ''])
    expect(moduleAt(etat, 0x64)).toBe('TDS')
    expect(moduleAt(etat, 30)).toBeNull()
    expect(moduleAt(pupitreInitial(), 30)).toBe('TDS')
  })
  it('vitesse modifiée : écho, puis le module ne comprend plus le bus', () => {
    const ecrire = toHex(withCrc([0x23, 6, 0, 2, 0, 3]))
    const { reponses } = envoyer([ecrire, '23 04 00 01 00 01 66 88'])
    expect(reponses).toEqual([ecrire, ''])
  })
  it('diffusion (adresse 0) : exécutée, aucune réponse, vue sur le bus', () => {
    const { frames, etat } = busRun([{ card: 'c1', connected: true, parcours: null, memorized: [{ bytes: withCrc([0, 6, 0, 0x64, 0, 0x5a]), periode: 1 }], memStart: 0 }], 0, 0.5)
    expect(frames.filter((x) => x.type === 'ESCLAVE')).toHaveLength(0)
    expect(frames.filter((x) => x.type === 'MAITRE')).toHaveLength(1)
    expect(leds(etat)).toEqual(['Q1', 'Q3', 'Q4', 'Q6'])
  })
})
