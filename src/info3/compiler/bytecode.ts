/**
 * Bytecode à pile du simulateur INFO3.
 * Chaque instruction occupe [op, coût en Tcy, ...opérandes] dans `Program.code`.
 * Le coût est fixé par le compilateur à partir de la catégorie d'opération (INFO3.cpu.cost, H2).
 */
import type { Kind } from './arith'
import type { CType } from './types'

export const Op = {
  PUSH: 0, // v
  POP: 1,
  DUP: 2,
  SWAP: 3,
  LDA: 4, // addr kind
  LDL: 5, // off kind
  LD: 6, // kind            [addr] → [v]
  STA: 7, // addr kind keep [v] → [v?]
  STL: 8, // off kind keep
  ST: 9, // kind keep       [addr v] → [v?]
  LEAL: 10, // off
  LDBF: 11, // bitOff width signed   [addr] → [v]
  STBF: 12, // bitOff width keep     [addr v] → [v?]
  BIN: 13, // binop kind
  NEG: 14, // kind
  BNOT: 15, // kind
  LNOT: 16,
  CONV: 17, // from to
  JMP: 18, // target
  JZ: 19, // target
  JNZ: 20, // target
  CALL: 21, // fi nargs
  CALLI: 22, // nargs        [fi args…]
  RET: 23, // hasValue
  RETFIE: 24,
  INCDEC: 25, // kind delta post keep               [addr] → [v?]
  INCDECBF: 26, // bitOff width signed delta post keep
  DELAY: 27, // tcy
  NOP: 28,
  PRINTF: 29, // nargs  [fmt args…] → [len]
  MEMCPY: 30, // size   [dst src] → [dst]
  COMB: 31, // shift kind  [lo hi] → [(hi << shift) | lo]
  HALT: 32,
} as const
export type Op = (typeof Op)[keyof typeof Op]

/** Nombre d'opérandes de chaque instruction (après l'opcode et le coût) */
export const OPERANDS: Record<number, number> = {
  [Op.PUSH]: 1,
  [Op.POP]: 0,
  [Op.DUP]: 0,
  [Op.SWAP]: 0,
  [Op.LDA]: 2,
  [Op.LDL]: 2,
  [Op.LD]: 1,
  [Op.STA]: 3,
  [Op.STL]: 3,
  [Op.ST]: 2,
  [Op.LEAL]: 1,
  [Op.LDBF]: 3,
  [Op.STBF]: 3,
  [Op.BIN]: 2,
  [Op.NEG]: 1,
  [Op.BNOT]: 1,
  [Op.LNOT]: 0,
  [Op.CONV]: 2,
  [Op.JMP]: 1,
  [Op.JZ]: 1,
  [Op.JNZ]: 1,
  [Op.CALL]: 2,
  [Op.CALLI]: 1,
  [Op.RET]: 1,
  [Op.RETFIE]: 0,
  [Op.INCDEC]: 4,
  [Op.INCDECBF]: 6,
  [Op.DELAY]: 1,
  [Op.NOP]: 0,
  [Op.PRINTF]: 1,
  [Op.MEMCPY]: 1,
  [Op.COMB]: 2,
  [Op.HALT]: 0,
}

export interface ParamSlot {
  off: number
  kind: Kind
  /** Paramètre struct passé par valeur : taille copiée depuis l'adresse reçue */
  structSize?: number
}

export interface LocalSym {
  name: string
  off: number
  type: CType
}

export interface FuncMeta {
  name: string
  key: string
  /** Index de la première instruction ; -1 tant que la fonction n'est pas définie */
  entry: number
  frameSize: number
  params: ParamSlot[]
  isIsr: boolean
  weak: boolean
  file: string
  line: number
  locals: LocalSym[]
}

export interface GlobalSym {
  name: string
  key: string
  addr: number
  type: CType
  file: string
  /** Bit (variables __bit) */
  bitOff?: number
}

export interface Program {
  code: Float64Array
  funcs: FuncMeta[]
  mainIndex: number
  /** -1 si aucune ISR */
  isrIndex: number
  /** Image initiale des variables globales, chargée à globalsBase à chaque reset */
  image: Uint8Array
  globalsBase: number
  globals: GlobalSym[]
  /** Pour chaque pc : fichier (index dans files) et ligne de l'instruction C ; stmtStart = début d'instruction */
  pcFile: Uint16Array
  pcLine: Int32Array
  stmtStart: Uint8Array
  files: string[]
  printfBuf: number
  /** Bits de configuration lus dans les #pragma config (STVREN, LVP…) */
  config: Record<string, string>
}
