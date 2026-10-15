import { describe, expect, it } from 'vitest'
import { crc16Modbus, fromHex } from './crc'

// 30 trames du CR + 23 87 03 A3 FB : CRC calculé sur les octets sans CRC = 2 derniers octets
const TRAMES = `01 07 41 E2 | 02 07 41 12 | 03 07 40 82 | 04 07 42 B2 | 05 07 43 22 | 06 07 43 D2 | 17 87 01 63 F4 | 1E 87 01 B3 F6 | 23 87 01 22 3A | 23 87 03 A3 FB | 29 87 01 02 38 | 17 06 00 64 00 5A 4A D8 | 17 06 01 00 00 5A 0A FB | 17 03 00 64 00 01 C7 23 | 17 03 02 00 5A 71 BC | 17 03 00 00 00 01 86 FC | 17 03 02 0F 0F B4 73 | 1E 06 00 71 04 D2 59 23 | 1E 06 00 64 00 61 0B 92 | 1E 06 00 65 00 62 1A 53 | 1E 06 00 66 00 63 2B 93 | 1E 06 00 67 00 64 3B 91 | 23 04 00 01 00 01 66 88 | 23 04 02 00 F3 01 72 | 29 04 00 01 00 01 66 22 | 29 04 00 05 00 01 27 E3 | 29 04 00 00 00 06 76 20 | 17 06 00 64 00 81 0A 83 | 1E 06 00 6E 00 04 EB BB | 29 04 02 FF CE 19 52 | 17 83 02 21 35`.split(' | ')

describe('crc16Modbus', () => {
  it('31 trames', () => expect(TRAMES).toHaveLength(31))
  it.each(TRAMES)('%s', (t) => {
    const b = fromHex(t)
    expect(crc16Modbus(b.slice(0, -2))).toEqual(b.slice(-2))
  })
})
