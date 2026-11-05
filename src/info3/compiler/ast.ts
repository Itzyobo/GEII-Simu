/** Arbre des expressions C (les instructions sont compilées directement par le parser). */
import type { SrcPos } from './diagnostics'
import type { CType } from './types'

export type Expr =
  | { k: 'num'; v: number; t: CType; pos: SrcPos }
  | { k: 'str'; bytes: number[]; pos: SrcPos }
  | { k: 'id'; name: string; pos: SrcPos; xtal?: number | null }
  | { k: 'bin'; op: string; l: Expr; r: Expr; pos: SrcPos }
  | { k: 'assign'; op: string; l: Expr; r: Expr; pos: SrcPos }
  | { k: 'unary'; op: string; e: Expr; pos: SrcPos }
  | { k: 'incdec'; inc: boolean; post: boolean; e: Expr; pos: SrcPos }
  | { k: 'cond'; c: Expr; a: Expr; b: Expr; pos: SrcPos }
  | { k: 'call'; f: Expr; args: Expr[]; pos: SrcPos; rparen: SrcPos }
  | { k: 'index'; a: Expr; i: Expr; pos: SrcPos }
  | { k: 'member'; e: Expr; name: string; arrow: boolean; pos: SrcPos }
  | { k: 'cast'; to: CType; e: Expr; pos: SrcPos }
  | { k: 'sizeof'; t?: CType; e?: Expr; pos: SrcPos }
  | { k: 'comma'; l: Expr; r: Expr; pos: SrcPos }

export type Init = { k: 'expr'; e: Expr; pos: SrcPos } | { k: 'list'; items: Init[]; pos: SrcPos }
