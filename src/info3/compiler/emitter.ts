/**
 * Construction du programme : code, table des lignes, fonctions, variables globales et liaison
 * entre unités de compilation (définition multiple, symbole non défini).
 */
import { INFO3 } from '../../data/reference'
import type { Kind } from './arith'
import { Op, type FuncMeta, type GlobalSym, type LocalSym, type ParamSlot, type Program } from './bytecode'
import { CompileError, type Diagnostics, type SrcPos } from './diagnostics'
import { sizeOf, type CType } from './types'

const C = INFO3.cpu.cost
const MEM = INFO3.vm.memory

export type CostCat = keyof typeof C

export interface Label {
  pc: number
  refs: number[]
}

export interface GlobalVar {
  key: string
  name: string
  type: CType
  /** -1 tant que l'adresse n'est pas attribuée (tableau extern de taille inconnue) */
  addr: number
  /** Adresse fixée par __at (SFR) */
  fixed: boolean
  bitOff?: number
  defined: boolean
  /** La définition porte un initialiseur */
  hasInit?: boolean
  defPos?: SrcPos
  declPos: SrcPos
  usePos?: SrcPos
  weak: boolean
  file: string
}

export interface FuncEntry {
  index: number
  meta: FuncMeta
  type: CType
  defined: boolean
  defPos?: SrcPos
  declPos: SrcPos
  usePos?: SrcPos
  weak: boolean
}

interface Fixup {
  /** Position dans le code (opérande) ou dans l'image (octets) */
  at: number
  inImage: boolean
  key: string
  add: number
  /** Référence à une fonction (index) plutôt qu'à une adresse */
  func: boolean
}

export class ProgramBuilder {
  code: number[] = []
  pcFile: number[] = []
  pcLine: number[] = []
  stmtStart: number[] = []
  files: string[] = []
  private curFile = 0
  private curLine = 0
  private pendingStmt = false

  funcs: FuncMeta[] = [{ name: '<null>', key: '<null>', entry: -1, frameSize: 0, params: [], isIsr: false, weak: false, file: '', line: 0, locals: [] }]
  funcByKey = new Map<string, FuncEntry>()
  globals = new Map<string, GlobalVar>()
  private nextAddr: number = MEM.globalsBase
  image: number[] = []
  private fixups: Fixup[] = []
  private strings = new Map<string, number>()
  isr: { key: string; pos: SrcPos } | null = null
  private anon = 0
  readonly diags: Diagnostics

  constructor(diags: Diagnostics) {
    this.diags = diags
  }

  /* ───────────── Code ───────────── */

  get pc() {
    return this.code.length
  }

  cost(cat: CostCat): number {
    return C[cat]
  }

  /** Coût d'un accès mémoire selon la taille, ou d'un accès SFR */
  costMem(size: number, sfr: boolean): number {
    if (sfr) return C.sfr
    if (size <= INFO3.c.sizes.char) return C.simple
    if (size <= INFO3.c.sizes.int) return C.op16
    return C.op32
  }

  setLine(pos: SrcPos, stmt: boolean) {
    let f = this.files.indexOf(pos.file)
    if (f < 0) {
      f = this.files.length
      this.files.push(pos.file)
    }
    this.curFile = f
    this.curLine = pos.line
    if (stmt) this.pendingStmt = true
  }

  /** Dernière instruction émise (détection d'un `return` final) */
  lastOp: number = -1

  emit(op: Op, cost: number, ...operands: number[]): number {
    const at = this.code.length
    this.lastOp = op
    this.code.push(op, cost, ...operands)
    for (let k = 0; k < operands.length + 2; k++) {
      this.pcFile.push(this.curFile)
      this.pcLine.push(this.curLine)
      this.stmtStart.push(k === 0 && this.pendingStmt ? 1 : 0)
    }
    this.pendingStmt = false
    return at
  }

  label(): Label {
    return { pc: -1, refs: [] }
  }

  place(l: Label) {
    l.pc = this.code.length
    for (const r of l.refs) this.code[r] = l.pc
    // Une étiquette placée commence une instruction exécutable : le pas à pas doit pouvoir s'y arrêter
  }

  jump(op: Op, l: Label) {
    const at = this.emit(op, C.jump, l.pc)
    if (l.pc < 0) l.refs.push(at + 2)
  }

  /* ───────────── Fonctions ───────────── */

  funcIndex(key: string, name: string, type: CType, pos: SrcPos, weak: boolean): FuncEntry {
    let f = this.funcByKey.get(key)
    if (!f) {
      const meta: FuncMeta = { name, key, entry: -1, frameSize: 0, params: [], isIsr: false, weak, file: pos.file, line: pos.line, locals: [] }
      f = { index: this.funcs.length, meta, type, defined: false, declPos: pos, weak }
      this.funcs.push(meta)
      this.funcByKey.set(key, f)
    }
    return f
  }

  /* ───────────── Variables globales ───────────── */

  declareGlobal(key: string, name: string, type: CType, pos: SrcPos, opts: { at?: number; bitOff?: number; weak?: boolean }): GlobalVar {
    let g = this.globals.get(key)
    if (!g) {
      g = { key, name, type, addr: -1, fixed: opts.at !== undefined, bitOff: opts.bitOff, defined: false, declPos: pos, weak: !!opts.weak, file: pos.file }
      if (opts.at !== undefined) g.addr = opts.at
      this.globals.set(key, g)
    } else if (g.type.k === 'array' && g.type.len === null && type.k === 'array' && type.len !== null) {
      g.type = type
    }
    if (g.addr < 0 && sizeOf(g.type) > 0) this.allocate(g, pos)
    return g
  }

  private allocate(g: GlobalVar, pos: SrcPos) {
    const size = Math.max(1, sizeOf(g.type))
    g.addr = this.nextAddr
    this.nextAddr += size
    if (this.nextAddr > MEM.stackBase) throw new CompileError(pos, `not enough RAM for variable '${g.name}'`)
    while (this.image.length < this.nextAddr - MEM.globalsBase) this.image.push(0)
  }

  /** Écrit des octets d'initialisation dans l'image */
  writeImage(addr: number, bytes: number[]) {
    const off = addr - MEM.globalsBase
    for (let k = 0; k < bytes.length; k++) this.image[off + k] = bytes[k]
  }

  /** Variable anonyme (littéral chaîne, image d'initialisation d'un tableau local) */
  anonymous(type: CType, bytes: number[], pos: SrcPos): number {
    const key = `<anon${this.anon++}>`
    const g = this.declareGlobal(key, key, type, pos, {})
    g.defined = true
    this.writeImage(g.addr, bytes)
    return g.addr
  }

  stringLiteral(bytes: number[], pos: SrcPos, charType: CType): number {
    const k = bytes.join(',')
    const known = this.strings.get(k)
    if (known !== undefined) return known
    const addr = this.anonymous({ k: 'array', of: charType, len: bytes.length + 1 }, [...bytes, 0], pos)
    this.strings.set(k, addr)
    return addr
  }

  /** Référence à l'adresse d'une variable globale pas encore placée : corrigée à la liaison */
  addrFixup(at: number, key: string, add: number, inImage: boolean) {
    this.fixups.push({ at, inImage, key, add, func: false })
  }

  funcFixup(at: number, key: string) {
    this.fixups.push({ at, inImage: true, key, add: 0, func: true })
  }

  /* ───────────── Liaison ───────────── */

  link(mainPos: SrcPos): Program | null {
    for (const g of this.globals.values()) {
      if (g.addr < 0) {
        if (g.usePos && !g.defined) this.diags.error(g.usePos, `undefined symbol '${g.name}'`)
        else if (g.defined) this.diags.error(g.defPos ?? g.declPos, `definition of variable with array type needs an explicit size`)
      } else if (!g.defined && !g.fixed && g.usePos) {
        this.diags.error(g.usePos, `undefined symbol '${g.name}'`)
      }
    }
    for (const f of this.funcByKey.values()) {
      if (!f.defined && f.usePos) this.diags.error(f.usePos, `undefined symbol '${f.meta.name}'`)
    }
    const main = this.funcByKey.get('main')
    if (!main || !main.defined) this.diags.error(mainPos, `undefined symbol 'main'`)
    if (this.diags.hasErrors || !main) return null
    for (const fx of this.fixups) {
      if (fx.func) {
        const f = this.funcByKey.get(fx.key)
        const v = f ? f.index : 0
        this.writeImage(fx.at, bytesLE(v, INFO3.c.sizes.pointer))
        continue
      }
      const g = this.globals.get(fx.key)
      const v = (g?.addr ?? 0) + fx.add
      if (fx.inImage) this.writeImage(fx.at, bytesLE(v, INFO3.c.sizes.pointer))
      else this.code[fx.at] = v
    }
    const globals: GlobalSym[] = []
    for (const g of this.globals.values()) {
      if (g.key.startsWith('<')) continue
      globals.push({ name: g.name, key: g.key, addr: g.addr, type: g.type, file: g.file, bitOff: g.bitOff })
    }
    const printf = this.globals.get('__printf_buf')
    return {
      code: Float64Array.from(this.code),
      funcs: this.funcs,
      mainIndex: main.index,
      isrIndex: this.isr ? this.funcByKey.get(this.isr.key)!.index : -1,
      image: Uint8Array.from(this.image),
      globalsBase: MEM.globalsBase,
      globals,
      pcFile: Uint16Array.from(this.pcFile),
      pcLine: Int32Array.from(this.pcLine),
      stmtStart: Uint8Array.from(this.stmtStart),
      files: this.files,
      printfBuf: printf ? printf.addr : -1,
      config: {},
    }
  }
}

export function bytesLE(v: number, size: number): number[] {
  const B = INFO3.c.bitsPerByte
  const mask = (1 << B) - 1
  const out: number[] = []
  for (let i = 0; i < size; i++) out.push((v >>> (i * B)) & mask)
  return out
}

export type { Kind, LocalSym, ParamSlot }
