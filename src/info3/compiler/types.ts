/** Types C du compilateur INFO3 (modèle XC8 v2, PIC16). */
import { INFO3 } from '../../data/reference'
import { Kind } from './arith'

export interface Qual {
  c?: boolean
  v?: boolean
}

export interface Field {
  name: string | null
  type: CType
  offset: number
  /** Champ de bits : position du bit de poids faible dans l'unité de stockage */
  bitOff?: number
  bitWidth?: number
}

export interface StructInfo {
  tag: string | null
  fields: Field[]
  size: number
  complete: boolean
}

export type CType =
  | { k: 'void'; q?: Qual }
  | { k: 'int'; size: number; signed: boolean; bool?: boolean; bit?: boolean; isEnum?: boolean; q?: Qual }
  | { k: 'float'; q?: Qual }
  | { k: 'ptr'; to: CType; q?: Qual }
  | { k: 'array'; of: CType; len: number | null; q?: Qual }
  | { k: 'struct'; s: StructInfo; q?: Qual }
  | { k: 'func'; ret: CType; params: CType[] | null; variadic: boolean; q?: Qual }

const S = INFO3.c.sizes

export const T = {
  void: { k: 'void' } as CType,
  char: { k: 'int', size: S.char, signed: INFO3.c.charSigned } as CType,
  schar: { k: 'int', size: S.char, signed: true } as CType,
  uchar: { k: 'int', size: S.char, signed: false } as CType,
  short: { k: 'int', size: S.short, signed: true } as CType,
  ushort: { k: 'int', size: S.short, signed: false } as CType,
  int: { k: 'int', size: S.int, signed: true } as CType,
  uint: { k: 'int', size: S.int, signed: false } as CType,
  long: { k: 'int', size: S.long, signed: true } as CType,
  ulong: { k: 'int', size: S.long, signed: false } as CType,
  bool: { k: 'int', size: S.char, signed: false, bool: true } as CType,
  bit: { k: 'int', size: S.char, signed: false, bit: true } as CType,
  float: { k: 'float' } as CType,
}

export const ptrTo = (t: CType): CType => ({ k: 'ptr', to: t })
export const withQual = (t: CType, q: Qual): CType => (q.c || q.v ? { ...t, q: { c: !!(t.q?.c || q.c), v: !!(t.q?.v || q.v) } } : t)
export const unqual = (t: CType): CType => (t.q ? { ...t, q: undefined } : t)

export const isInt = (t: CType) => t.k === 'int'
export const isArith = (t: CType) => t.k === 'int' || t.k === 'float'
export const isScalar = (t: CType) => t.k === 'int' || t.k === 'float' || t.k === 'ptr'
export const isPtrLike = (t: CType) => t.k === 'ptr' || t.k === 'array' || t.k === 'func'
export const isVolatile = (t: CType) => !!t.q?.v
export const isConst = (t: CType) => !!t.q?.c

export function sizeOf(t: CType): number {
  switch (t.k) {
    case 'void':
      return 1
    case 'int':
      return t.size
    case 'float':
      return S.float
    case 'ptr':
      return S.pointer
    case 'array':
      return t.len === null ? 0 : t.len * sizeOf(t.of)
    case 'struct':
      return t.s.size
    case 'func':
      return S.pointer
  }
}

/** Genre mémoire d'un type scalaire */
export function kindOf(t: CType): Kind {
  switch (t.k) {
    case 'int':
      // _Bool : toute valeur non nulle → 1 ; __bit (XC8) : seul le bit de poids faible est gardé (écriture par STBF)
      if (t.bool) return Kind.BOOL
      if (t.bit) return Kind.U8
      if (t.size === S.char) return t.signed ? Kind.S8 : Kind.U8
      if (t.size === S.int) return t.signed ? Kind.S16 : Kind.U16
      return t.signed ? Kind.S32 : Kind.U32
    case 'float':
      return Kind.F32
    case 'ptr':
    case 'array':
    case 'func':
      return Kind.U16
    default:
      return Kind.U8
  }
}

/** Promotion entière (char, bool, champ de bits → int) */
export function promote(t: CType): CType {
  if (t.k !== 'int') return unqual(t)
  if (t.size < S.int || t.bool || t.bit || t.isEnum) return T.int
  return t.signed ? (t.size === S.int ? T.int : T.long) : t.size === S.int ? T.uint : T.ulong
}

/** Conversions arithmétiques usuelles */
export function usual(a: CType, b: CType): CType {
  if (a.k === 'float' || b.k === 'float') return T.float
  const A = promote(a) as { k: 'int'; size: number; signed: boolean }
  const B = promote(b) as { k: 'int'; size: number; signed: boolean }
  if (A.signed === B.signed) return A.size >= B.size ? unqual(A as CType) : unqual(B as CType)
  const U = A.signed ? B : A
  const Sg = A.signed ? A : B
  if (U.size >= Sg.size) return unqual(U as CType)
  return unqual(Sg as CType)
}

export function sameType(a: CType, b: CType): boolean {
  if (a.k !== b.k) return false
  switch (a.k) {
    case 'int': {
      const o = b as typeof a
      return a.size === o.size && a.signed === o.signed && !!a.bool === !!o.bool
    }
    case 'ptr':
      return sameType(a.to, (b as typeof a).to)
    case 'array':
      return sameType(a.of, (b as typeof a).of)
    case 'struct':
      return a.s === (b as typeof a).s
    case 'func': {
      const o = b as typeof a
      if (!sameType(a.ret, o.ret)) return false
      if (a.params === null || o.params === null) return true
      return a.params.length === o.params.length && a.params.every((p, i) => sameType(p, o.params![i]))
    }
    default:
      return true
  }
}

export function typeName(t: CType): string {
  const q = `${t.q?.c ? 'const ' : ''}${t.q?.v ? 'volatile ' : ''}`
  switch (t.k) {
    case 'void':
      return `${q}void`
    case 'int':
      if (t.bool) return `${q}_Bool`
      if (t.bit) return `${q}__bit`
      if (t.isEnum) return `${q}enum`
      return `${q}${t.signed ? '' : 'unsigned '}${t.size === S.char ? 'char' : t.size === S.int ? 'int' : 'long'}`
    case 'float':
      return `${q}float`
    case 'ptr':
      return `${typeName(t.to)} *${q}`.trimEnd()
    case 'array':
      return `${typeName(t.of)} [${t.len ?? ''}]`
    case 'struct':
      return `${q}struct ${t.s.tag ?? '(anonymous)'}`
    case 'func':
      return `${typeName(t.ret)} (${t.params === null ? '' : t.params.map(typeName).join(', ')}${t.variadic ? ', ...' : ''})`
  }
}

/** Disposition d'une struct (alignement sur l'octet, comme XC8 PIC16 ; champs de bits LSB en premier) */
export function layoutStruct(s: StructInfo, members: { name: string | null; type: CType; width?: number }[]): void {
  const B = INFO3.c.bitsPerByte
  let offset = 0
  let bitPos = 0 // bits occupés dans l'unité courante
  let unitStart = -1
  let unitBits = 0
  const fields: Field[] = []
  for (const m of members) {
    if (m.width !== undefined) {
      const unitSize = sizeOf(m.type)
      const ub = unitSize * B
      if (m.width === 0) {
        // `:0` ferme l'unité courante
        if (unitStart >= 0) offset = unitStart + Math.ceil(bitPos / B)
        unitStart = -1
        continue
      }
      if (unitStart < 0 || bitPos + m.width > unitBits) {
        if (unitStart >= 0) offset = unitStart + Math.ceil(bitPos / B)
        unitStart = offset
        unitBits = Math.max(ub, Math.ceil(m.width / B) * B)
        bitPos = 0
      }
      const byteOff = Math.floor(bitPos / B)
      fields.push({ name: m.name, type: m.type, offset: unitStart + byteOff, bitOff: bitPos - byteOff * B, bitWidth: m.width })
      bitPos += m.width
      offset = Math.max(offset, unitStart + Math.ceil(bitPos / B))
    } else {
      if (unitStart >= 0) {
        offset = unitStart + Math.ceil(bitPos / B)
        unitStart = -1
      }
      fields.push({ name: m.name, type: m.type, offset })
      offset += sizeOf(m.type)
    }
  }
  s.fields = fields
  s.size = Math.max(offset, unitStart >= 0 ? unitStart + Math.ceil(bitPos / B) : 0)
  s.complete = true
}
