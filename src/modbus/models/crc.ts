import { REF } from '../data/reference'

/** CRC-16 Modbus (polynôme réfléchi A001H, départ FFFFH). Renvoie [poids faible, poids fort], dans l'ordre d'émission. */
export function crc16Modbus(bytes: readonly number[]): [number, number] {
  let crc = REF.crcInit.value
  for (const b of bytes) {
    crc ^= b & 0xff
    for (let k = 0; k < 8; k++) crc = crc & 1 ? (crc >>> 1) ^ REF.crcPolynome.value : crc >>> 1
  }
  return [crc & 0xff, crc >>> 8]
}

/** Octets en hexa majuscule séparés par des espaces : « 17 06 00 64 ». */
export const toHex = (bytes: readonly number[]) => bytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')

/** « 17 06 00 64 » → [0x17, 0x06, 0x00, 0x64] */
export const fromHex = (s: string) => s.trim().split(/\s+/).map((h) => parseInt(h, 16))
