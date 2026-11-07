/**
 * Oscillateur du PIC16F18875 : Fosc ↔ OSCCON1 (NOSC<6:4>, NDIV<3:0>) et OSCFRQ (HFFRQ<2:0>).
 * Positions des champs lues dans INFO3.sfr (noms de bits), codes = H18.
 */
import { INFO3 } from '../../data/reference'

const CLK = INFO3.clock

/** Champ de bits d'un SFR (position et masque) d'après les noms « PREFIXE0 », « PREFIXE1 »… */
export function sfrField(sfr: string, prefix: string): { shift: number; mask: number } {
  const bits = (INFO3.sfr as Record<string, { bits: readonly (string | null)[] }>)[sfr].bits
  const shift = bits.indexOf(`${prefix}0`)
  const width = bits.filter((b) => b !== null && b.startsWith(prefix) && /\d$/.test(b)).length
  return { shift, mask: (1 << width) - 1 }
}

const NOSC = sfrField('OSCCON1', 'NOSC')
const NDIV = sfrField('OSCCON1', 'NDIV')
const HFFRQ = sfrField('OSCFRQ', 'HFFRQ')
const MAX_NDIV = Math.log2(CLK.maxDivider)

/** Fréquence HFINTOSC décrite par OSCFRQ — Hz */
export function hfintoscFromRegister(oscfrq: number): number {
  const hf = CLK.hfintoscMHz[(oscfrq >> HFFRQ.shift) & HFFRQ.mask] ?? CLK.hfintoscMHz[CLK.hfintoscMHz.length - 1]
  return hf * INFO3.units.usPerS
}

/** Fosc décrit par OSCCON1 et OSCFRQ — Hz */
export function foscFromRegisters(osccon1: number, oscfrq: number): number {
  const nosc = (osccon1 >> NOSC.shift) & NOSC.mask
  const ndiv = Math.min((osccon1 >> NDIV.shift) & NDIV.mask, MAX_NDIV)
  const base = nosc === CLK.nosc.LFINTOSC ? CLK.lfintosc : hfintoscFromRegister(oscfrq)
  return base / 2 ** ndiv
}

/** Valeurs d'OSCCON1 et OSCFRQ pour un oscillateur, une fréquence HFINTOSC (MHz) et un diviseur */
export function oscRegisters(oscillator: 'HFINTOSC' | 'LFINTOSC', hfMHz: number, divider: number): { osccon1: number; oscfrq: number } {
  const nosc = CLK.nosc[oscillator]
  const ndiv = Math.log2(divider)
  const hffrq = Math.max(0, (CLK.hfintoscMHz as readonly number[]).indexOf(hfMHz))
  return { osccon1: (nosc << NOSC.shift) | (ndiv << NDIV.shift), oscfrq: hffrq << HFFRQ.shift }
}
