import { describe, expect, it } from 'vitest'
import { formatFrame, uartFrame, type UartFormat } from './uart'

const O81: UartFormat = { dataBits: 8, parity: 'odd', stopBits: 1 }
const O71: UartFormat = { dataBits: 7, parity: 'odd', stopBits: 1 }
const f = (b: number, fmt: UartFormat) => formatFrame(uartFrame(b, fmt), fmt)

describe('uartFrame', () => {
  it('8O1', () => {
    expect(f(0x55, O81)).toBe('0·10101010·1·1')
    expect(f(0x00, O81)).toBe('0·00000000·1·1')
    expect(f(0x01, O81)).toBe('0·10000000·0·1')
  })
  it('7O1', () => {
    expect(f(0x20, O71)).toBe('0·0000010·0·1')
    expect(f(0x6c, O71)).toBe('0·0011011·1·1')
  })
  it('parité paire, sans parité, 2 stops', () => {
    expect(f(0x01, { dataBits: 8, parity: 'even', stopBits: 1 })).toBe('0·10000000·1·1')
    expect(f(0x01, { dataBits: 8, parity: 'none', stopBits: 2 })).toBe('0·10000000·11')
  })
})
