/**
 * ADCC du PIC16F18875 en mode de base (cours p. 92 à 100, H52) et entrées analogiques du banc.
 * - code = floor(Vin / (VREF / 1024)), bruit de ± 1 LSB (aléa à graine fixée), saturé à 0 et 1023 ;
 * - TAD = 2 × (ADCCS + 1) / Fosc (FOSC/ADCLK) ou TAD de FRC (H51) ; conversion = 11,5 TAD + ADACQ × TAD ;
 * - résultat aligné à droite (ADFM = 1) ou à gauche (décalé de 6 bits) dans ADRESH:ADRESL.
 * Joystick : valeur brute au repos (H4), X croît vers la droite, Y vers le bas (H48), butées 0 et 1023.
 */
import { INFO3 } from '../../data/reference'
import { parsePin, PORT_NAMES } from './gpio'

const A = INFO3.adcc
const LEVELS = 2 ** A.bits
const MAX = LEVELS - 1
const BYTE_BITS = INFO3.c.bitsPerByte

const clampCode = (c: number) => Math.min(MAX, Math.max(0, c))

/** Code brut d'une tension (sans bruit) */
export const codeOf = (vin: number, vref: number = A.vref) => clampCode(Math.floor(vin / (vref / LEVELS)))

/** Code avec bruit : `r` uniforme dans [0, 1[ → décalage de -1, 0 ou +1 LSB */
export const noisyCode = (vin: number, r: number, vref: number = A.vref) => clampCode(Math.floor(vin / (vref / LEVELS)) + Math.floor(r * (2 * A.noiseLsb + 1)) - A.noiseLsb)

/** Tension qui donne exactement le code `c` (milieu du pas) */
export const voltsOf = (c: number, vref: number = A.vref) => ((clampCode(c) + 1 / 2) * vref) / LEVELS

/** TAD — s : FOSC/ADCLK (ADCCS) ou FRC */
export const tadOf = (fosc: number, frc: boolean, adccs: number) => (frc ? A.frcTadS : (2 * (adccs + 1)) / fosc)

/** Durée d'une conversion — s */
export const conversionS = (tad: number, acq: number) => (A.conversionTad + acq) * tad

/** Registres du résultat selon ADFM (1 = à droite) */
export function resultRegisters(code: number, rightAligned: boolean): { ADRESH: number; ADRESL: number } {
  const v = rightAligned ? code : code << (2 * BYTE_BITS - A.bits)
  return { ADRESH: (v >> BYTE_BITS) & ((1 << BYTE_BITS) - 1), ADRESL: v & ((1 << BYTE_BITS) - 1) }
}

/** Code de voie ADPCH d'une broche (port × 8 + bit, H50) */
export const channelOf = (pin: string) => {
  const { port, bit } = parsePin(pin)
  return PORT_NAMES.indexOf(port) * A.portStride + bit
}

/**
 * Joystick : position (x vers la droite, y vers le haut, chacun de -1 à 1) → valeurs brutes (H4, H48).
 * De chaque côté du repos, la course va linéairement jusqu'à la butée (0 ou 1023).
 */
export function joystickRaw(x: number, y: number): { x: number; y: number } {
  const r = INFO3.analog.joyRest
  const axis = (rest: number, p: number) => Math.round(p >= 0 ? rest + p * (MAX - rest) : rest + p * rest)
  const cx = Math.max(-1, Math.min(1, x))
  const cy = Math.max(-1, Math.min(1, y))
  return { x: axis(r.x, cx), y: axis(r.y, INFO3.analog.joyYDown ? -cy : cy) }
}
