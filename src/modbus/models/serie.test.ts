import { describe, expect, it } from 'vitest'
import { valueAt } from './scope'
import { charDuration, formatFrame, uartDecode, uartFrame, uartWaveform, type Liaison } from './uart'
import { programmeWave, realtermDefaut, realtermReceive, realtermText, serie1, serie2, serie2Format, serie3, type RealtermSettings } from './serie'
import { exerciseGenerate, type Difficulte } from './exercise'
import { checkDebit, PIEGE_BASE_DE_TEMPS } from './answers'

const near = (x: number, target: number, tol: number) => expect(Math.abs(x / target - 1)).toBeLessThanOrEqual(tol)
const L8O1: Liaison = { baud: 2400, dataBits: 8, parity: 'odd', stopBits: 1 }
const L7E1: Liaison = { baud: 2400, dataBits: 7, parity: 'even', stopBits: 1 }

describe('uartDecode', () => {
  it.each([
    ['8O1', L8O1, 256],
    ['7E1', L7E1, 128],
  ])('uartDecode(uartWaveform(uartFrame(x))) = x pour chaque octet en %s, sans erreur', (_, l, max) => {
    for (let x = 0; x < max; x++) {
      const rx = uartDecode(uartWaveform(uartFrame(x, l), { baud: l.baud, level: 'TTL' }), l)
      expect(rx).toHaveLength(1)
      expect(rx[0]).toMatchObject({ byte: x, framingError: false, parityError: false })
    }
  })
  it('RS232 inversé décodé aussi', () => {
    const rx = uartDecode(uartWaveform(uartFrame(0xa7, L8O1), { baud: 2400, level: 'RS232' }), L8O1, { level: 'RS232' })
    expect(rx.map((r) => r.byte)).toEqual([0xa7])
  })
})

describe('SERIE_1', () => {
  it('55H, 00H, 01H → trames du PRD', () => {
    const f = (b: number) => formatFrame(uartFrame(b, serie1(b).liaison), serie1(b).liaison)
    expect([f(0x55), f(0x00), f(0x01)]).toEqual(['0·10101010·1·1', '0·00000000·1·1', '0·10000000·0·1'])
  })
  it('RS232 : polarité inversée, repos à −11,8 V ± 2 %', () => {
    const w = programmeWave(serie1(0x55), 'RS232')
    near(valueAt(w, 0.05), -11.8, 0.02) // au milieu du repos (H22)
    near(valueAt(w, 0.5 / 2400), 11.5, 0.02) // bit de start = 0 logique → niveau haut
  })
  it('caractère suivi de repos, période 100 ms (H22)', () => {
    expect(programmeWave(serie1(0x55), 'TTL').period).toBeCloseTo(0.1, 12)
  })
})

describe('SERIE_2', () => {
  it('format fixé par la graine, parmi les candidats ; décodable avec ce format', () => {
    expect(serie2Format(7)).toEqual(serie2Format(7))
    for (let g = 1; g <= 200; g++) {
      const p = serie2(g, 0x55)
      expect([1200, 2400, 4800, 9600]).toContain(p.liaison.baud)
      expect(uartDecode(programmeWave(p, 'TTL'), p.liaison).map((r) => r.byte)).toEqual([0x55])
    }
  })
  it('le vrai format saisi remplace le tirage', () => {
    const reel: Liaison = { baud: 9600, dataBits: 7, parity: 'even', stopBits: 1 }
    expect(serie2(3, 0xff, reel)).toMatchObject({ liaison: reel, bytes: [0x7f] })
  })
})

describe('SERIE_3', () => {
  const p = serie3()
  it('lignes exactes start · b0…b6 · parité · stop', () => {
    expect(p.bytes.map((b) => formatFrame(uartFrame(b, p.liaison), p.liaison))).toEqual([
      '0·0011011·1·1',
      '0·1001111·0·1',
      '0·1111011·1·1',
      '0·0111011·0·1',
      '0·0000010·0·1',
      '0·1000110·0·1',
    ])
    expect(String.fromCharCode(...p.bytes)).toBe('lyon 1')
  })
  it('caractère 2,083 ms, message 12,50 ms (± 0,1 %), période 111 ms', () => {
    near(charDuration(p.liaison), 2.083e-3, 0.001)
    near(6 * charDuration(p.liaison), 12.5e-3, 0.001)
    expect(p.period).toBe(0.111)
  })
})

describe('RealTerm sur SERIE_3', () => {
  const p = serie3()
  const rt = (o: Partial<RealtermSettings>): RealtermSettings => ({ ...realtermDefaut(), baud: 4800, dataBits: 7, parity: 'odd', stopBits: 1, ...o })
  it('même format → « lyon 1 » répété, 0 erreur', () => {
    const rx = realtermReceive(p, 'croisé', rt({}), 3)
    expect(realtermText(rx)).toBe('lyon 1lyon 1lyon 1')
    expect(rx.filter((r) => r.framingError || r.parityError)).toEqual([])
  })
  it('9 600 bauds → au moins 1 erreur de trame sur 6 caractères', () => {
    const rx = realtermReceive(p, 'croisé', rt({ baud: 9600 }))
    expect(rx.filter((r) => r.framingError).length).toBeGreaterThanOrEqual(1)
  })
  it('parité paire → 6 erreurs de parité sur 6 caractères', () => {
    const rx = realtermReceive(p, 'croisé', rt({ parity: 'even' }))
    expect(rx).toHaveLength(6)
    expect(rx.filter((r) => r.parityError)).toHaveLength(6)
  })
  it('8 bits sans parité, 1 stop → EC 79 EF 6E 20 31 (la parité lue comme 8e bit)', () => {
    const rx = realtermReceive(p, 'croisé', rt({ dataBits: 8, parity: 'none' }))
    expect(rx.map((r) => r.byte)).toEqual([0xec, 0x79, 0xef, 0x6e, 0x20, 0x31])
    expect(rx.some((r) => r.framingError)).toBe(false)
  })
  it('câble droit → 0 caractère reçu ; sans émission ou mauvais port → rien', () => {
    expect(realtermReceive(p, 'droit', rt({}), 3)).toEqual([])
    expect(realtermReceive(null, 'croisé', rt({}), 3)).toEqual([])
    expect(realtermReceive(p, 'croisé', rt({ port: 'COM2' }), 3)).toEqual([])
  })
})

describe('exerciseGenerate', () => {
  it('1 000 graines → décodage = message du corrigé, sans erreur', () => {
    for (let g = 1; g <= 1000; g++) {
      const ex = exerciseGenerate(g, ((g % 3) + 1) as Difficulte)
      const rx = uartDecode(ex.wave, ex.liaison, { level: ex.level })
      expect(rx.some((r) => r.framingError || r.parityError), `graine ${g}`).toBe(false)
      expect(String.fromCharCode(...rx.map((r) => r.byte)), `graine ${g}`).toBe(ex.corrige.message)
      expect(ex.corrige.message.length).toBeGreaterThanOrEqual(3)
      expect(ex.corrige.message.length).toBeLessThanOrEqual(8)
    }
  })
  it('même graine → même exercice', () => {
    expect(exerciseGenerate(123, 2)).toEqual(exerciseGenerate(123, 2))
  })
  it('un bit couvre au moins 1,5 div', () => {
    for (let g = 1; g <= 100; g++) {
      const ex = exerciseGenerate(g, 3)
      expect(1 / ex.liaison.baud / ex.tdiv).toBeGreaterThanOrEqual(1.5)
    }
  })
})

describe('correction du débit', () => {
  it('réponse égale à la base de temps → message de piège', () => {
    const ex = exerciseGenerate(5, 1)
    expect(checkDebit(`${ex.tdiv * 1e6} µs`, ex.liaison.baud, ex.tdiv).message).toBe(PIEGE_BASE_DE_TEMPS)
    expect(checkDebit(String(1 / ex.tdiv), ex.liaison.baud, ex.tdiv).message).toBe(PIEGE_BASE_DE_TEMPS)
  })
  it('débit ou durée de bit justes acceptés, 440 µs → 2 400 bauds à ± 10 %', () => {
    expect(checkDebit('2 400 bauds', 2400, 500e-6).ok).toBe(true)
    expect(checkDebit('440 µs', 2400, 500e-6).ok).toBe(true)
    expect(checkDebit('0,4167 ms', 2400, 500e-6).ok).toBe(true)
    expect(checkDebit('4800', 2400, 500e-6).ok).toBe(false)
  })
})
