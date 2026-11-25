import { describe, expect, it } from 'vitest'
import { RES3_SERIE } from '../../data/reference'
import { uartFrame } from '../../modbus/models/uart'
import { REF } from '../../modbus/data/reference'
import { createSerialExercise, gradeSerial, lineBits, parityDecidable, serialSource, type SerialLine } from './serial'

/** Relit la ligne au milieu de chaque bit (comme un récepteur UART) */
function decode(l: SerialLine) {
  const s = serialSource(l)
  const tb = 1 / l.baud
  const seuil = l.level === 'TTL' ? 2.5 : 0
  const bit = (t: number) => (l.level === 'TTL' ? s.value(t) > seuil : s.value(t) < seuil) ? 1 : 0
  return lineBits(l).map((_, k) => bit((k + 0.5) * tb))
}

describe('exercice V28 de l’ancien DS : 4Eh, 7 bits, parité impaire', () => {
  const base: SerialLine = { bytes: [0x4e], format: { dataBits: 7, parity: 'odd', stopBits: 1 }, baud: 9600, level: 'TTL', gaps: [0], period: 0.2 }
  it('trame start·0111001·P=1·stop', () => {
    expect(uartFrame(0x4e, base.format)).toEqual([0, 0, 1, 1, 1, 0, 0, 1, 1, 1])
  })
  it('en TTL : P = 1 au niveau haut (5 V), repos à 5 V', () => {
    const s = serialSource(base)
    expect(s.value((8 + 0.5) / 9600)).toBe(5)
    expect(s.value(0.1)).toBe(5)
    expect(s.value(0.5 / 9600)).toBe(0)
    expect(decode(base)).toEqual(lineBits(base))
  })
  it('en RS-232 : niveaux mesurés au TP2, logique inversée (P = 1 et repos à ≈ −11,8 V, start à +11,5 V)', () => {
    const l = { ...base, level: 'RS232' as const }
    const s = serialSource(l)
    expect(s.value((8 + 0.5) / 9600)).toBe(REF.rs232Low.value)
    expect(s.value(0.5 / 9600)).toBe(REF.rs232High.value)
    expect(s.value(0.1)).toBe(REF.rs232Low.value)
    expect(REF.rs232High.value).toBeCloseTo(11.5, 9)
    expect(decode(l)).toEqual(lineBits(l))
  })
  it('fronts : TTL 20 ns, RS-232 à 30 V/µs (≈ 0,67 µs pour 20 V)', () => {
    const e = serialSource(base).edges(0, 1e-4)
    expect(e[1] - e[0]).toBeCloseTo(20e-9, 15)
    const r = serialSource({ ...base, level: 'RS232' }).edges(0, 1e-4)
    expect(r[1] - r[0]).toBeCloseTo((REF.rs232High.value - REF.rs232Low.value) / 30e6, 12)
  })
})

describe('sujet tiré par graine', () => {
  it('déterministe, dans les plages demandées', () => {
    expect(JSON.stringify(createSerialExercise(5).line)).toBe(JSON.stringify(createSerialExercise(5).line))
    const levels = new Set<string>()
    const parities = new Set<string>()
    for (let s = 1; s <= 300; s++) {
      const ex = createSerialExercise(s)
      const { line, expected } = ex
      levels.add(line.level)
      parities.add(line.format.parity)
      expect(expected.message.length).toBeGreaterThanOrEqual(2)
      expect(expected.message.length).toBeLessThanOrEqual(4)
      expect([...expected.message].every((c) => c.charCodeAt(0) >= 0x20 && c.charCodeAt(0) < 0x7f)).toBe(true)
      expect(RES3_SERIE.debits).toContain(line.baud)
      for (const g of line.gaps) expect(g).toBeLessThanOrEqual(3)
      expect(ex.enonce).toEqual({ dataBits: line.format.dataBits, stopBits: line.format.stopBits })
      expect(decode(line)).toEqual(lineBits(line))
    }
    expect(levels.size).toBe(2)
    for (let s = 1; s <= 300; s++) expect(parityDecidable(createSerialExercise(s).line), `graine ${s}`).toBe(true)
    expect('amplitude' in createSerialExercise(1).line).toBe(false)
    expect(parities.size).toBe(3)
  })
})

describe('tirage pondéré du débit', () => {
  it('≈ 85 % entre 1200 et 19200 bauds', () => {
    const n = 2000
    let lents = 0
    for (let s = 1; s <= n; s++) if (createSerialExercise(s).line.baud <= RES3_SERIE.debitLentMax) lents++
    expect(lents / n).toBeGreaterThan(0.81)
    expect(lents / n).toBeLessThan(0.89)
  })
})

describe('gradeSerial', () => {
  const ex = createSerialExercise(11)
  const e = ex.expected
  it('tout juste', () => {
    const g = gradeSerial(ex, { ...e })
    expect([g.baud.score, g.parity, g.level, g.message.score]).toEqual([1, true, true, 1])
    expect(g.chars.every((c) => c.ok)).toBe(true)
  })
  it('débit : plein à ±3 % (valeur normalisée rappelée), moitié à ±10 %, 0 au-delà', () => {
    const at = (k: number) => gradeSerial(ex, { baud: e.baud * k }).baud
    expect(at(1.03).score).toBe(1)
    expect(at(1.03).note).toContain(`${e.baud}`)
    expect(at(0.97).score).toBe(1)
    expect(at(1.031).score).toBe(0.5)
    expect(at(1.1).score).toBe(0.5)
    expect(at(0.899).score).toBe(0)
  })
  it('message : prorata des caractères justes, bit fautif montré, casse comprise', () => {
    const ex2 = { ...ex, expected: { ...e, message: 'AB' } }
    // 'B' = 42h, 'C' = 43h : seul D0 diffère
    const g = gradeSerial(ex2, { message: 'AC' })
    expect(g.message.score).toBe(0.5)
    expect(g.chars[1].ok).toBe(false)
    expect(g.chars[1].wrongBits).toContain('D0 : attendu 0, lu 1')
    expect(gradeSerial(ex2, { message: 'A' }).chars[1].wrongBits).toBe('caractère absent')
    expect(gradeSerial(ex2, { message: 'ABCD' }).message.score).toBe(0.5)
    expect(gradeSerial(ex2, { message: 'ab' }).message.score).toBe(0)
    expect(g.chars[0].parityNote).toMatch(/41h : /)
  })
})
