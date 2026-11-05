/**
 * Arithmétique C de XC8 (char 8 bits, int 16 bits, long 32 bits, float 32 bits), partagée
 * par le compilateur (évaluation des constantes) et la VM (exécution).
 * Une valeur sur la pile est toujours normalisée dans son « genre » (Kind).
 */
import { INFO3 } from '../../data/reference'

/** Genre d'une valeur en mémoire ou sur la pile */
export const Kind = { U8: 0, S8: 1, U16: 2, S16: 3, U32: 4, S32: 5, F32: 6, BOOL: 7 } as const
export type Kind = (typeof Kind)[keyof typeof Kind]

const B = INFO3.c.bitsPerByte
export const BITS8 = B
export const BITS16 = INFO3.c.sizes.int * B
export const BITS32 = INFO3.c.sizes.long * B
export const MASK8 = (1 << BITS8) - 1
export const MASK16 = (1 << BITS16) - 1
const SH8 = BITS32 - BITS8
const SH16 = BITS32 - BITS16

/** Taille en octets d'un genre */
export function kindSize(k: Kind): number {
  switch (k) {
    case Kind.U8:
    case Kind.S8:
    case Kind.BOOL:
      return INFO3.c.sizes.char
    case Kind.U16:
    case Kind.S16:
      return INFO3.c.sizes.int
    case Kind.F32:
      return INFO3.c.sizes.float
    default:
      return INFO3.c.sizes.long
  }
}

export const isSignedKind = (k: Kind) => k === Kind.S8 || k === Kind.S16 || k === Kind.S32

/** Ramène un entier JS dans le genre k (troncature et signe, comme une affectation C) */
export function norm(k: Kind, v: number): number {
  switch (k) {
    case Kind.U8:
      return v & MASK8
    case Kind.S8:
      return (v << SH8) >> SH8
    case Kind.U16:
      return v & MASK16
    case Kind.S16:
      return (v << SH16) >> SH16
    case Kind.U32:
      return v >>> 0
    case Kind.S32:
      return v | 0
    case Kind.F32:
      return Math.fround(v)
    case Kind.BOOL:
      return v !== 0 ? 1 : 0
  }
}

/** Conversion C d'une valeur de genre `from` vers le genre `to` */
export function convert(from: Kind, to: Kind, v: number): number {
  if (to === Kind.F32) return Math.fround(v)
  if (to === Kind.BOOL) return v !== 0 ? 1 : 0
  if (from === Kind.F32) {
    if (!Number.isFinite(v)) return 0
    const t = Math.trunc(v)
    // Au-delà de 32 bits, on garde les bits de poids faible (comportement indéfini en C)
    return norm(to, t >= 0 ? t % 2 ** BITS32 : -(-t % 2 ** BITS32))
  }
  return norm(to, v)
}

/** Opérateurs binaires du bytecode */
export const BinOp = { ADD: 0, SUB: 1, MUL: 2, DIV: 3, MOD: 4, AND: 5, OR: 6, XOR: 7, SHL: 8, SHR: 9, EQ: 10, NE: 11, LT: 12, LE: 13, GT: 14, GE: 15 } as const
export type BinOp = (typeof BinOp)[keyof typeof BinOp]

/** Opération binaire dans le genre arithmétique k (U16, S16, U32, S32 ou F32). Comparaisons : 0 ou 1. */
export function binop(op: BinOp, k: Kind, a: number, b: number): number {
  switch (op) {
    case BinOp.ADD:
      return norm(k, a + b)
    case BinOp.SUB:
      return norm(k, a - b)
    case BinOp.MUL:
      if (k === Kind.F32) return Math.fround(a * b)
      return norm(k, Math.imul(a, b))
    case BinOp.DIV:
      if (k === Kind.F32) return Math.fround(a / b)
      // H21 : division par zéro → quotient 0
      if (b === 0) return 0
      return norm(k, Math.trunc(a / b))
    case BinOp.MOD:
      if (k === Kind.F32) return Math.fround(a % b)
      // H21 : reste = dividende
      if (b === 0) return a
      return norm(k, a % b)
    case BinOp.AND:
      return norm(k, a & b)
    case BinOp.OR:
      return norm(k, a | b)
    case BinOp.XOR:
      return norm(k, a ^ b)
    case BinOp.SHL: {
      const w = kindSize(k) * B
      if (b < 0 || b >= w) return 0
      return norm(k, w === BITS32 ? a << b : a * 2 ** b)
    }
    case BinOp.SHR: {
      const w = kindSize(k) * B
      if (b < 0 || b >= w) return isSignedKind(k) && a < 0 ? -1 : 0
      if (k === Kind.U32) return a >>> b
      return norm(k, a >> b)
    }
    case BinOp.EQ:
      return a === b ? 1 : 0
    case BinOp.NE:
      return a !== b ? 1 : 0
    case BinOp.LT:
      return a < b ? 1 : 0
    case BinOp.LE:
      return a <= b ? 1 : 0
    case BinOp.GT:
      return a > b ? 1 : 0
    case BinOp.GE:
      return a >= b ? 1 : 0
  }
}

/** Lecture d'une valeur de genre k (petit-boutiste, comme le PIC) */
export function readKind(mem: Uint8Array, addr: number, k: Kind): number {
  switch (k) {
    case Kind.U8:
    case Kind.BOOL:
      return mem[addr]
    case Kind.S8:
      return norm(Kind.S8, mem[addr])
    case Kind.U16:
      return mem[addr] | (mem[addr + 1] << BITS8)
    case Kind.S16:
      return norm(Kind.S16, mem[addr] | (mem[addr + 1] << BITS8))
    default: {
      let v = 0
      for (let i = kindSize(k) - 1; i >= 0; i--) v = (v << BITS8) | mem[addr + i]
      if (k === Kind.F32) {
        const dv = new DataView(new ArrayBuffer(INFO3.c.sizes.float))
        dv.setUint32(0, v >>> 0, true)
        return dv.getFloat32(0, true)
      }
      return k === Kind.U32 ? v >>> 0 : v | 0
    }
  }
}

/** Octets (petit-boutiste) d'une valeur de genre k */
export function kindBytes(k: Kind, v: number): number[] {
  const n = kindSize(k)
  let bits = v
  if (k === Kind.F32) {
    const dv = new DataView(new ArrayBuffer(INFO3.c.sizes.float))
    dv.setFloat32(0, v, true)
    bits = dv.getUint32(0, true)
  }
  const out: number[] = []
  for (let i = 0; i < n; i++) out.push((bits >>> (i * B)) & MASK8)
  return out
}
