import { describe, expect, it } from 'vitest'
import { RES3_SERIE } from '../../data/reference'
import { uartFrame } from '../../modbus/models/uart'
import { createSerialExercise, gradeSerial, lineBits, serialSource, type SerialLine } from './serial'

/** Relit la ligne au milieu de chaque bit (comme un récepteur UART) */
function decode(l: SerialLine) {
  const s = serialSource(l)
  const tb = 1 / l.baud
  const seuil = l.level === 'TTL' ? 2.5 : 0
  const bit = (t: number) => (l.level === 'TTL' ? s.value(t) > seuil : s.value(t) < seuil) ? 1 : 0
  return lineBits(l).map((_, k) => bit((k + 0.5) * tb))
}

describe('exercice V28 de l’ancien DS : 4Eh, 7 bits, parité impaire', () => {
  const base: SerialLine = { bytes: [0x4e], format: { dataBits: 7, parity: 'odd', stopBits: 1 }, baud: 9600, level: 'TTL', amplitude: 10, gaps: [0], period: 0.2 }
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
  it('en RS-232 : logique inversée, P = 1 à −10 V, start à +10 V, repos à −10 V', () => {
    const l = { ...base, level: 'RS232' as const }
    const s = serialSource(l)
    expect(s.value((8 + 0.5) / 9600)).toBe(-10)
    expect(s.value(0.5 / 9600)).toBe(10)
    expect(s.value(0.1)).toBe(-10)
    expect(decode(l)).toEqual(lineBits(l))
  })
  it('fronts : TTL 20 ns, RS-232 à 30 V/µs (≈ 0,67 µs pour 20 V)', () => {
    const e = serialSource(base).edges(0, 1e-4)
    expect(e[1] - e[0]).toBeCloseTo(20e-9, 15)
    const r = serialSource({ ...base, level: 'RS232' }).edges(0, 1e-4)
    expect(r[1] - r[0]).toBeCloseTo(20 / 30e6, 12)
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
      if (line.level === 'RS232') expect(Math.abs(line.amplitude - 10)).toBeLessThanOrEqual(1)
      expect(ex.enonce).toEqual({ dataBits: line.format.dataBits, stopBits: line.format.stopBits })
      expect(decode(line)).toEqual(lineBits(line))
    }
    expect(levels.size).toBe(2)
    expect(parities.size).toBe(3)
  })
})

describe('gradeSerial', () => {
  const ex = createSerialExercise(11)
  const e = ex.expected
  it('tout juste', () => {
    const g = gradeSerial(ex, { ...e })
    expect([g.baud.ok, g.parity, g.level, g.message]).toEqual([true, true, true, true])
    expect(g.chars.every((c) => c.ok)).toBe(true)
  })
  it('débit mesuré à ±3 % accepté avec la valeur normalisée en correction ; au-delà refusé', () => {
    const ok = gradeSerial(ex, { baud: e.baud * 1.029 })
    expect(ok.baud.ok).toBe(true)
    expect(ok.baud.note).toContain(`${e.baud}`)
    expect(gradeSerial(ex, { baud: e.baud * 1.031 }).baud.ok).toBe(false)
  })
  it('message : casse comprise, détail par caractère', () => {
    const wrong = e.message[0] === e.message[0].toUpperCase() ? e.message[0].toLowerCase() : e.message[0].toUpperCase()
    const g = gradeSerial(ex, { message: wrong + e.message.slice(1) })
    if (wrong !== e.message[0]) {
      expect(g.message).toBe(false)
      expect(g.chars[0].ok).toBe(false)
      expect(g.chars[0].bitsGiven).not.toBe(g.chars[0].bitsExpected)
    }
    expect(g.chars[0].parityNote).toMatch(/h : /)
  })
})
