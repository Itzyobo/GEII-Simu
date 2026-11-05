/**
 * Compilation d'une unité (fichier .c prétraité) : analyse syntaxique à descente récursive,
 * vérification des types et génération du bytecode en une passe par instruction.
 * Les expressions sont d'abord construites en arbre (ast.ts), typées, puis émises.
 */
import { INFO3 } from '../../data/reference'
import { binop, BinOp, convert, Kind, kindBytes, kindSize, norm } from './arith'
import type { Expr, Init } from './ast'
import { Op } from './bytecode'
import { CompileError, type SrcPos } from './diagnostics'
import { bytesLE, type FuncEntry, type GlobalVar, type Label, type ProgramBuilder } from './emitter'
import { PRINTF_OUT, RUNTIME_FILE } from './headers'
import type { Token } from './lexer'
import {
  isArith,
  isConst,
  isInt,
  isScalar,
  isVolatile,
  kindOf,
  layoutStruct,
  promote,
  ptrTo,
  sameType,
  sizeOf,
  T,
  typeName,
  unqual,
  usual,
  withQual,
  type CType,
  type Field,
  type Qual,
  type StructInfo,
} from './types'

const MEM = INFO3.vm.memory
const BYTE = INFO3.c.bitsPerByte
const INT_BITS = INFO3.c.sizes.int * BYTE
const PTR = INFO3.c.sizes.pointer

type Sym =
  | { k: 'gvar'; type: CType; g: GlobalVar }
  | { k: 'lvar'; type: CType; off: number }
  | { k: 'func'; type: CType; f: FuncEntry; builtin?: 'printf' }
  | { k: 'enum'; value: number }
  | { k: 'typedef'; type: CType }

type Tag = { kind: 'struct'; s: StructInfo } | { kind: 'enum' }

interface Scope {
  syms: Map<string, Sym>
  tags: Map<string, Tag>
  parent: Scope | null
}

interface Place {
  mode: 'abs' | 'fp' | 'stack'
  off: number
  type: CType
  bit?: { off: number; width: number; signed: boolean }
  /** Adresse absolue pas encore connue (corrigée à la liaison) */
  fixKey?: string
}

interface SwitchCtx {
  cases: { value: number; label: Label; pos: SrcPos }[]
  def: Label | null
  type: CType
}

interface FnCtx {
  entry: FuncEntry
  name: string
  ret: CType
  frame: number
  maxFrame: number
  isIsr: boolean
  retHiddenOff: number
  breaks: Label[]
  conts: Label[]
  switches: SwitchCtx[]
  warnedFloat: boolean
  bind: boolean
}

interface Specs {
  type: CType
  storage: 'typedef' | 'extern' | 'static' | null
  isr: boolean
  pos: SrcPos
}

interface Declarator {
  name: string | null
  pos: SrcPos
  build: (base: CType) => CType
  params: { name: string | null; pos: SrcPos; type: CType }[] | null
}

const TYPE_KW = new Set(['void', 'char', 'short', 'int', 'long', 'float', 'double', 'signed', 'unsigned', '_Bool', '__bit', 'struct', 'union', 'enum'])
const QUAL_KW = new Set(['const', 'volatile'])
const STORAGE_KW = new Set(['typedef', 'extern', 'static', 'auto', 'register', 'inline', '__inline', '__interrupt', '__attribute__'])
const KEYWORDS = new Set([
  ...TYPE_KW, ...QUAL_KW, ...STORAGE_KW,
  'break', 'case', 'continue', 'default', 'do', 'else', 'for', 'goto', 'if', 'return', 'sizeof', 'switch', 'while', '__at',
])
const ALLOC = new Set(['malloc', 'free', 'calloc', 'realloc'])
const DELAYS: Record<string, number> = { __delay_ms: INFO3.units.msPerS, __delay_us: INFO3.units.usPerS }

const BIN_OPS: Record<string, BinOp> = {
  '+': BinOp.ADD, '-': BinOp.SUB, '*': BinOp.MUL, '/': BinOp.DIV, '%': BinOp.MOD,
  '&': BinOp.AND, '|': BinOp.OR, '^': BinOp.XOR, '<<': BinOp.SHL, '>>': BinOp.SHR,
  '==': BinOp.EQ, '!=': BinOp.NE, '<': BinOp.LT, '<=': BinOp.LE, '>': BinOp.GT, '>=': BinOp.GE,
}
// Priorités des opérateurs binaires (grammaire C)
const PREC: Record<string, number> = {
  '||': 1, '&&': 2, '|': 3, '^': 4, '&': 5, '==': 6, '!=': 6, '<': 7, '>': 7, '<=': 7, '>=': 7, '<<': 8, '>>': 8, '+': 9, '-': 9, '*': 10, '/': 10, '%': 10,
}
const ASSIGN_OPS = new Set(['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>='])
const CMP = new Set(['==', '!=', '<', '<=', '>', '>='])

const C = INFO3.cpu.cost
const costArith = (k: Kind) => (k === Kind.F32 ? C.float : kindSize(k) > INFO3.c.sizes.int ? C.op32 : C.op16)

export class UnitCompiler {
  private toks: Token[]
  private p = 0
  private b: ProgramBuilder
  private file: string
  private fileScope: Scope
  private scope: Scope
  private fn: FnCtx | null = null
  private types = new WeakMap<Expr, CType>()
  private consts = new WeakMap<Expr, number | null>()
  private readonly virtualFiles: Set<string>
  private readonly weak: boolean

  constructor(tokens: Token[], builder: ProgramBuilder, file: string, virtualFiles: Set<string>) {
    this.toks = tokens
    this.b = builder
    this.file = file
    this.virtualFiles = virtualFiles
    this.weak = file === RUNTIME_FILE
    this.fileScope = { syms: new Map(), tags: new Map(), parent: null }
    this.scope = this.fileScope
  }

  /* ═════════════════════════ Jetons ═════════════════════════ */

  private peek(k = 0): Token {
    return this.toks[Math.min(this.p + k, this.toks.length - 1)]
  }
  private next(): Token {
    const t = this.toks[this.p]
    if (this.p < this.toks.length - 1) this.p++
    return t
  }
  private is(text: string, k = 0): boolean {
    const t = this.peek(k)
    return (t.kind === 'punct' || t.kind === 'id') && t.text === text
  }
  private accept(text: string): boolean {
    if (this.is(text)) {
      this.next()
      return true
    }
    return false
  }
  private prevEnd(): SrcPos {
    return this.p > 0 ? this.toks[this.p - 1].end : this.peek().pos
  }
  private expect(text: string, msg?: string): Token {
    if (!this.is(text)) throw new CompileError(this.peek().pos, msg ?? `expected '${text}'`)
    return this.next()
  }
  private expectSemi(after: string) {
    if (!this.accept(';')) throw new CompileError(this.prevEnd(), `expected ';' ${after}`)
  }
  private fail(pos: SrcPos, msg: string): never {
    throw new CompileError(pos, msg)
  }
  private inUserFile(pos: SrcPos) {
    return !this.virtualFiles.has(pos.file) && pos.file !== RUNTIME_FILE
  }

  /* ═════════════════════════ Portée ═════════════════════════ */

  private lookup(name: string): Sym | undefined {
    for (let s: Scope | null = this.scope; s; s = s.parent) {
      const v = s.syms.get(name)
      if (v) return v
    }
    return undefined
  }
  private lookupTag(name: string): Tag | undefined {
    for (let s: Scope | null = this.scope; s; s = s.parent) {
      const v = s.tags.get(name)
      if (v) return v
    }
    return undefined
  }
  private pushScope() {
    this.scope = { syms: new Map(), tags: new Map(), parent: this.scope }
  }
  private popScope() {
    this.scope = this.scope.parent!
  }
  private isTypedefName(t: Token): boolean {
    if (t.kind !== 'id' || KEYWORDS.has(t.text)) return false
    return this.lookup(t.text)?.k === 'typedef'
  }
  private isTypeStart(t: Token): boolean {
    if (t.kind !== 'id') return false
    return TYPE_KW.has(t.text) || QUAL_KW.has(t.text) || this.isTypedefName(t)
  }
  private isDeclStart(t: Token): boolean {
    return this.isTypeStart(t) || (t.kind === 'id' && STORAGE_KW.has(t.text))
  }

  /* ═════════════════════════ Unité ═════════════════════════ */

  compileUnit() {
    while (this.peek().kind !== 'eof') this.external()
  }

  private external() {
    if (this.accept(';')) return
    const start = this.peek()
    const specs = this.parseSpecs()
    if (!specs) {
      if (start.kind === 'id' && !KEYWORDS.has(start.text)) this.fail(start.pos, `unknown type name '${start.text}'`)
      this.fail(start.pos, 'expected external declaration')
    }
    if (this.accept(';')) return
    for (;;) {
      const d = this.parseDeclarator(false)
      const type = d.build(specs.type)
      if (!d.name) this.fail(d.pos, 'expected identifier or \'(\'')
      const at = this.parseAt()
      if (type.k === 'func' && this.is('{')) {
        this.functionDefinition(d, type, specs)
        return
      }
      if (specs.isr) this.fail(d.pos, '__interrupt applies only to function definitions')
      let init: Init | null = null
      if (this.accept('=')) init = this.parseInitializer()
      this.declareFileLevel(d, type, specs, at, init)
      if (this.accept(',')) continue
      this.expectSemi('after top level declarator')
      return
    }
  }

  private parseAt(): number | undefined {
    if (!this.accept('__at')) return undefined
    this.expect('(')
    const e = this.assignment()
    const v = this.constValue(e)
    if (v === undefined) this.fail(e.pos, '__at address must be a constant')
    this.expect(')')
    return v
  }

  /* ═════════════════════════ Spécificateurs de type ═════════════════════════ */

  private parseSpecs(): Specs | null {
    const pos = this.peek().pos
    const q: Qual = {}
    let storage: Specs['storage'] = null
    let isr = false
    let any = false
    let named: CType | null = null
    const cnt: Record<string, number> = {}
    let hasBase = false
    for (;;) {
      const t = this.peek()
      if (t.kind !== 'id') break
      const w = t.text
      if (w === 'typedef' || w === 'extern' || w === 'static') {
        if (storage && storage !== w) this.fail(t.pos, `cannot combine with previous '${storage}' declaration specifier`)
        storage = w
        this.next()
      } else if (w === 'auto' || w === 'register' || w === 'inline' || w === '__inline') {
        this.next()
      } else if (w === 'const') {
        q.c = true
        this.next()
      } else if (w === 'volatile') {
        q.v = true
        this.next()
      } else if (w === '__interrupt') {
        this.next()
        if (this.is('(')) this.skipParens()
        isr = true
      } else if (w === '__attribute__') {
        this.next()
        this.skipParens()
      } else if (w === 'union') {
        this.fail(t.pos, 'unions are not supported by the INFO3 simulator')
      } else if (w === 'struct') {
        named = this.parseStruct()
        hasBase = true
      } else if (w === 'enum') {
        named = this.parseEnum()
        hasBase = true
      } else if (TYPE_KW.has(w)) {
        cnt[w] = (cnt[w] ?? 0) + 1
        hasBase = true
        this.next()
      } else if (!hasBase && this.isTypedefName(t)) {
        named = (this.lookup(w) as { type: CType }).type
        hasBase = true
        this.next()
      } else break
      any = true
    }
    if (!any) return null
    let type: CType
    if (named) {
      if (Object.keys(cnt).length) this.fail(pos, 'cannot combine with previous declaration specifier')
      type = named
    } else type = this.baseType(cnt, pos)
    return { type: withQual(type, q), storage, isr, pos }
  }

  private skipParens() {
    this.expect('(')
    let depth = 1
    while (depth > 0) {
      const t = this.next()
      if (t.kind === 'eof') this.fail(t.pos, "expected ')'")
      if (t.text === '(') depth++
      else if (t.text === ')') depth--
    }
  }

  private baseType(c: Record<string, number>, pos: SrcPos): CType {
    if ((c.long ?? 0) > 1) this.fail(pos, "'long long' is not supported by the INFO3 simulator")
    if (c.void) return T.void
    if (c._Bool) return T.bool
    if (c.__bit) return T.bit
    if (c.float || c.double) return T.float
    if (c.char) return c.signed ? T.schar : c.unsigned ? T.uchar : T.char
    if (c.short) return c.unsigned ? T.ushort : T.short
    if (c.long) return c.unsigned ? T.ulong : T.long
    if (c.unsigned) return T.uint
    if (c.int || c.signed) return T.int
    this.b.diags.warning(pos, "type specifier missing, defaults to 'int'")
    return T.int
  }

  private parseStruct(): CType {
    const kw = this.next()
    let tag: string | null = null
    if (this.peek().kind === 'id' && !this.is('{')) tag = this.next().text
    if (!this.accept('{')) {
      if (!tag) this.fail(kw.pos, "declaration of anonymous struct must be a definition")
      const known = this.lookupTag(tag)
      if (known?.kind === 'struct') return { k: 'struct', s: known.s }
      if (known?.kind === 'enum') this.fail(kw.pos, `use of '${tag}' with tag type that does not match previous declaration`)
      const s: StructInfo = { tag, fields: [], size: 0, complete: false }
      this.scope.tags.set(tag, { kind: 'struct', s })
      return { k: 'struct', s }
    }
    let s: StructInfo
    const own = tag ? this.scope.tags.get(tag) : undefined
    if (own?.kind === 'struct' && !own.s.complete) s = own.s
    else {
      if (own?.kind === 'struct') this.fail(kw.pos, `redefinition of 'struct ${tag}'`)
      s = { tag, fields: [], size: 0, complete: false }
      if (tag) this.scope.tags.set(tag, { kind: 'struct', s })
    }
    const members: { name: string | null; type: CType; width?: number }[] = []
    while (!this.accept('}')) {
      const specs = this.parseSpecs()
      if (!specs) this.fail(this.peek().pos, 'type name requires a specifier or qualifier')
      if (specs.storage) this.fail(specs.pos, 'type name does not allow storage class to be specified')
      for (;;) {
        if (this.is(':')) {
          const c = this.next()
          members.push({ name: null, type: specs.type, width: this.bitWidth(specs.type, c.pos) })
        } else {
          const d = this.parseDeclarator(false)
          const ft = d.build(specs.type)
          if (!d.name) this.fail(d.pos, 'expected member name or \';\'')
          if (ft.k === 'func') this.fail(d.pos, `field '${d.name}' declared as a function`)
          if (ft.k === 'struct' && !ft.s.complete) this.fail(d.pos, `field has incomplete type '${typeName(ft)}'`)
          if (members.some((m) => m.name === d.name)) this.fail(d.pos, `duplicate member '${d.name}'`)
          let width: number | undefined
          if (this.is(':')) {
            const c = this.next()
            width = this.bitWidth(ft, c.pos)
          }
          members.push({ name: d.name, type: ft, width })
        }
        if (this.accept(',')) continue
        this.expectSemi('at end of declaration list')
        break
      }
    }
    layoutStruct(s, members)
    return { k: 'struct', s }
  }

  private bitWidth(t: CType, pos: SrcPos): number {
    if (t.k !== 'int') this.fail(pos, `bit-field has non-integral type '${typeName(t)}'`)
    const e = this.conditional()
    const v = this.constValue(e)
    if (v === undefined || v < 0) this.fail(e.pos, 'bit-field width is not a constant expression')
    if (v > sizeOf(t) * BYTE) this.fail(e.pos, `width of bit-field (${v} bits) exceeds the width of its type (${sizeOf(t) * BYTE} bits)`)
    return v
  }

  private parseEnum(): CType {
    const kw = this.next()
    let tag: string | null = null
    if (this.peek().kind === 'id' && !this.is('{')) tag = this.next().text
    const type: CType = { k: 'int', size: INFO3.c.sizes.int, signed: true, isEnum: true }
    if (!this.accept('{')) {
      if (!tag) this.fail(kw.pos, 'expected identifier or \'{\'')
      return type
    }
    if (tag) this.scope.tags.set(tag, { kind: 'enum' })
    let value = 0
    while (!this.accept('}')) {
      const id = this.next()
      if (id.kind !== 'id') this.fail(id.pos, 'expected identifier')
      if (this.accept('=')) {
        const e = this.conditional()
        const v = this.constValue(e)
        if (v === undefined) this.fail(e.pos, 'expression is not an integer constant expression')
        value = v
      }
      if (this.scope.syms.has(id.text)) this.fail(id.pos, `redefinition of enumerator '${id.text}'`)
      this.scope.syms.set(id.text, { k: 'enum', value: norm(Kind.S16, value) })
      value++
      if (!this.accept(',')) {
        this.expect('}')
        break
      }
    }
    return type
  }

  /* ═════════════════════════ Déclarateurs ═════════════════════════ */

  private parseDeclarator(abstract: boolean): Declarator {
    const ptrs: Qual[] = []
    while (this.accept('*')) {
      const q: Qual = {}
      while (this.is('const') || this.is('volatile')) {
        if (this.next().text === 'const') q.c = true
        else q.v = true
      }
      ptrs.push(q)
    }
    const pos = this.peek().pos
    let name: string | null = null
    let inner: Declarator | null = null
    const t = this.peek()
    if (t.kind === 'id' && !KEYWORDS.has(t.text)) {
      name = t.text
      this.next()
    } else if (this.is('(') && (this.is('*', 1) || this.is('(', 1) || this.is('[', 1))) {
      this.next()
      inner = this.parseDeclarator(abstract)
      this.expect(')')
      name = inner.name
    }
    type Suffix = { k: 'arr'; len: number | null; pos: SrcPos } | { k: 'fn'; params: Declarator['params']; variadic: boolean }
    const suffixes: Suffix[] = []
    for (;;) {
      if (this.is('[')) {
        const lb = this.next()
        if (this.accept(']')) suffixes.push({ k: 'arr', len: null, pos: lb.pos })
        else {
          const e = this.assignment()
          const v = this.constValue(e)
          if (v === undefined) this.fail(e.pos, 'variable length arrays are not supported (array size must be a constant)')
          if (v <= 0) this.fail(e.pos, "array size must be greater than zero")
          this.expect(']')
          suffixes.push({ k: 'arr', len: v, pos: lb.pos })
        }
      } else if (this.is('(')) {
        const { params, variadic } = this.parseParams()
        suffixes.push({ k: 'fn', params, variadic })
      } else break
    }
    const s0 = suffixes[0]
    const params = inner ? inner.params : s0?.k === 'fn' ? s0.params : null
    void abstract
    return {
      name,
      pos: inner ? inner.pos : pos,
      params,
      build: (base: CType) => {
        let r = base
        for (const q of ptrs) r = { k: 'ptr', to: r, q: q.c || q.v ? q : undefined }
        for (let i = suffixes.length - 1; i >= 0; i--) {
          const s = suffixes[i]
          if (s.k === 'arr') {
            if (r.k === 'func') this.fail(s.pos, "'array of functions' is not allowed")
            r = { k: 'array', of: r, len: s.len }
          } else {
            if (r.k === 'array') this.fail(pos, 'function cannot return array type')
            r = { k: 'func', ret: r, params: s.params ? s.params.map((p) => p.type) : null, variadic: s.variadic }
          }
        }
        return inner ? inner.build(r) : r
      },
    }
  }

  private parseParams(): { params: Declarator['params']; variadic: boolean } {
    this.expect('(')
    if (this.accept(')')) return { params: null, variadic: false }
    if (this.is('void') && this.is(')', 1)) {
      this.next()
      this.next()
      return { params: [], variadic: false }
    }
    const params: NonNullable<Declarator['params']> = []
    let variadic = false
    for (;;) {
      if (this.is('...')) {
        const t = this.next()
        if (this.inUserFile(t.pos)) this.fail(t.pos, 'variadic functions are not supported by the INFO3 simulator')
        variadic = true
        this.expect(')')
        break
      }
      const specs = this.parseSpecs()
      if (!specs) {
        const t = this.peek()
        if (t.kind === 'id') this.fail(t.pos, `unknown type name '${t.text}'`)
        this.fail(t.pos, 'expected parameter declarator')
      }
      const d = this.parseDeclarator(true)
      let type = d.build(specs.type)
      if (type.k === 'array') type = { k: 'ptr', to: type.of, q: type.q }
      else if (type.k === 'func') type = ptrTo(type)
      params.push({ name: d.name, pos: d.name ? d.pos : specs.pos, type })
      if (this.accept(',')) continue
      this.expect(')', "expected ')'")
      break
    }
    return { params, variadic }
  }

  private parseTypeName(): CType {
    const specs = this.parseSpecs()
    if (!specs) this.fail(this.peek().pos, 'expected a type')
    const d = this.parseDeclarator(true)
    if (d.name) this.fail(d.pos, 'unexpected identifier in type name')
    return d.build(specs.type)
  }

  /* ═════════════════════════ Déclarations globales ═════════════════════════ */

  private linkKey(name: string, isStatic: boolean) {
    return isStatic ? `${this.file}#${name}` : name
  }

  private declareFunction(name: string, type: CType, pos: SrcPos, isStatic: boolean): FuncEntry {
    const key = this.linkKey(name, isStatic)
    const existing = this.fileScope.syms.get(name) ?? this.lookup(name)
    if (existing && existing.k === 'func') {
      if (!sameType(existing.type, type)) this.fail(pos, `conflicting types for '${name}'`)
      // Le prototype le plus complet l'emporte
      if (type.k === 'func' && type.params && existing.type.k === 'func' && !existing.type.params) existing.type = type
      return existing.f
    }
    if (existing && this.scope === this.fileScope) this.fail(pos, `redefinition of '${name}' as different kind of symbol`)
    const f = this.b.funcIndex(key, name, type, pos, this.weak)
    if (f.defined && !sameType(f.type, type)) this.fail(pos, `conflicting types for '${name}'`)
    const isPrintf = name === 'printf' && this.virtualFiles.has(pos.file)
    const sym: Sym = { k: 'func', type, f, builtin: isPrintf ? 'printf' : undefined }
    this.fileScope.syms.set(name, sym)
    if (this.scope !== this.fileScope) this.scope.syms.set(name, sym)
    return f
  }

  private declareFileLevel(d: Declarator, type: CType, specs: Specs, at: number | undefined, init: Init | null) {
    const name = d.name!
    if (specs.storage === 'typedef') {
      const prev = this.scope.syms.get(name)
      if (prev && (prev.k !== 'typedef' || !sameType(prev.type, type))) this.fail(d.pos, `typedef redefinition with different types`)
      this.scope.syms.set(name, { k: 'typedef', type })
      return
    }
    if (type.k === 'func') {
      if (init) this.fail(d.pos, `illegal initializer (only variables can be initialized)`)
      this.declareFunction(name, type, d.pos, specs.storage === 'static')
      return
    }
    if (type.k === 'void') this.fail(d.pos, `variable has incomplete type 'void'`)
    this.declareGlobalVar(name, type, d.pos, specs.storage, at, init, this.scope)
  }

  private declareGlobalVar(name: string, type0: CType, pos: SrcPos, storage: Specs['storage'], at: number | undefined, init: Init | null, scope: Scope, keyOverride?: string) {
    let type = type0
    if (type.k === 'array' && type.len === null && init) type = { ...type, len: this.initLength(type, init) }
    const prev = scope.syms.get(name)
    if (prev && prev.k !== 'gvar') this.fail(pos, `redefinition of '${name}' as different kind of symbol`)
    const key = keyOverride ?? this.linkKey(name, storage === 'static')
    let opts: { at?: number; bitOff?: number; weak?: boolean } = { weak: this.weak }
    if (at !== undefined) {
      if (type.k === 'int' && type.bit) opts = { at: Math.floor(at / BYTE), bitOff: at % BYTE }
      else opts = { at }
    }
    const g = this.b.declareGlobal(key, name, type, pos, opts)
    if (prev && prev.k === 'gvar' && !sameType(unqual(prev.type), unqual(type)) && !(prev.type.k === 'array' && type.k === 'array')) {
      this.fail(pos, `redefinition of '${name}' with a different type: '${typeName(type)}' vs '${typeName(prev.type)}'`)
    }
    const isDef = storage !== 'extern' || !!init
    if (isDef && at === undefined) {
      if (g.defined) {
        // L'unité d'exécution (compilée en dernier) ne remplace jamais une définition du projet
        if (this.weak) {
          scope.syms.set(name, { k: 'gvar', type: g.type, g })
          return
        }
        const first = g.defPos!
        const sameFile = first.file === pos.file
        // Définitions provisoires (`int x;` répété dans un même fichier) : autorisées
        const tentative = sameFile && (!init || !g.hasInit)
        if (!tentative) {
          if (sameFile) this.fail(pos, `redefinition of '${name}'`)
          this.fail(pos, `multiple definition of '${name}' (first defined in ${first.file}:${first.line}:${first.col})`)
        }
      }
      g.defined = true
      g.defPos = g.defPos ?? pos
      if (init) {
        g.hasInit = true
        this.writeGlobalInit(g, init)
      }
    }
    if (at !== undefined) g.defined = true
    scope.syms.set(name, { k: 'gvar', type: g.type, g })
  }

  /* ═════════════════════════ Initialiseurs ═════════════════════════ */

  private parseInitializer(): Init {
    const pos = this.peek().pos
    if (this.accept('{')) {
      const items: Init[] = []
      while (!this.accept('}')) {
        if (this.is('.') || this.is('[')) this.fail(this.peek().pos, 'designated initializers are not supported by the INFO3 simulator')
        items.push(this.parseInitializer())
        if (!this.accept(',')) {
          this.expect('}', "expected '}'")
          break
        }
      }
      return { k: 'list', items, pos }
    }
    return { k: 'expr', e: this.assignment(), pos }
  }

  private initLength(type: CType & { k: 'array' }, init: Init): number {
    if (init.k === 'expr' && init.e.k === 'str' && type.of.k === 'int' && type.of.size === INFO3.c.sizes.char) return init.e.bytes.length + 1
    if (init.k === 'list') return this.initArray({ ...type, len: null }, init.items, { i: 0 }, 0, [])
    this.fail(init.pos, 'array initializer must be an initializer list')
  }

  /** Feuilles scalaires d'un initialiseur (avec élision des accolades) */
  private flattenInit(type: CType, init: Init): Leaf[] {
    const out: Leaf[] = []
    if (init.k === 'expr') {
      if (type.k === 'array') {
        if (init.e.k === 'str' && type.of.k === 'int' && type.of.size === INFO3.c.sizes.char) this.initString(type, init.e.bytes, 0, out, init.pos)
        else this.fail(init.pos, 'array initializer must be an initializer list or string literal')
      } else if (type.k === 'struct') out.push({ off: 0, type, e: init.e })
      else out.push({ off: 0, type, e: init.e })
      return out
    }
    if (type.k === 'array') {
      const idx = { i: 0 }
      this.initArray(type, init.items, idx, 0, out)
      if (idx.i < init.items.length) this.b.diags.warning(init.items[idx.i].pos, 'excess elements in array initializer')
    } else if (type.k === 'struct') {
      const idx = { i: 0 }
      this.initStruct(type.s, init.items, idx, 0, out)
      if (idx.i < init.items.length) this.b.diags.warning(init.items[idx.i].pos, 'excess elements in struct initializer')
    } else {
      if (init.items.length === 0) this.fail(init.pos, 'scalar initializer cannot be empty')
      const first = init.items[0]
      if (first.k === 'list') return this.flattenInit(type, first)
      out.push({ off: 0, type, e: first.e })
    }
    return out
  }

  private initString(type: CType & { k: 'array' }, bytes: number[], base: number, out: Leaf[], pos: SrcPos) {
    const n = type.len ?? bytes.length + 1
    if (bytes.length > n) this.b.diags.warning(pos, 'initializer-string for char array is too long')
    for (let k = 0; k < n && k <= bytes.length; k++) out.push({ off: base + k, type: type.of, value: k < bytes.length ? bytes[k] : 0 })
  }

  private initArray(type: CType & { k: 'array' }, items: Init[], idx: { i: number }, base: number, out: Leaf[]): number {
    const es = sizeOf(type.of)
    let k = 0
    for (; (type.len === null || k < type.len) && idx.i < items.length; k++) {
      const it = items[idx.i]
      this.initElement(type.of, items, idx, it, base + k * es, out)
    }
    return k
  }

  private initStruct(s: StructInfo, items: Init[], idx: { i: number }, base: number, out: Leaf[]) {
    for (const f of s.fields) {
      if (f.name === null) continue
      if (idx.i >= items.length) break
      this.initElement(f.type, items, idx, items[idx.i], base + f.offset, out, f)
    }
  }

  private initElement(t: CType, items: Init[], idx: { i: number }, it: Init, off: number, out: Leaf[], field?: Field) {
    if (t.k === 'array') {
      if (it.k === 'list') {
        idx.i++
        const sub = { i: 0 }
        this.initArray(t, it.items, sub, off, out)
      } else if (it.e.k === 'str' && t.of.k === 'int' && t.of.size === INFO3.c.sizes.char) {
        idx.i++
        this.initString(t, it.e.bytes, off, out, it.pos)
      } else this.initArray(t, items, idx, off, out)
    } else if (t.k === 'struct') {
      if (it.k === 'list') {
        idx.i++
        this.initStruct(t.s, it.items, { i: 0 }, off, out)
      } else if (sameType(unqual(this.typeOf(it.e)), unqual(t))) {
        idx.i++
        out.push({ off, type: t, e: it.e })
      } else this.initStruct(t.s, items, idx, off, out)
    } else {
      idx.i++
      const e = it.k === 'list' ? (it.items[0]?.k === 'expr' ? it.items[0].e : this.fail(it.pos, 'scalar initializer cannot be empty')) : it.e
      out.push({ off, type: t, e, field })
    }
  }

  private writeGlobalInit(g: GlobalVar, init: Init) {
    for (const leaf of this.flattenInit(g.type, init)) {
      const addr = g.addr + leaf.off
      if (leaf.value !== undefined) {
        this.b.writeImage(addr, [leaf.value])
        continue
      }
      const e = leaf.e!
      const lt = leaf.type
      if (lt.k === 'struct') this.fail(e.pos, 'initializer element is not a compile-time constant')
      const cv = this.constValue(e)
      if (cv !== undefined) {
        const v = convert(kindOf(this.valueType(e)), kindOf(lt), cv)
        if (leaf.field?.bitWidth !== undefined) this.writeBits(addr, leaf.field, v)
        else this.b.writeImage(addr, kindBytes(kindOf(lt), v))
        continue
      }
      const ac = this.constAddress(e)
      if (!ac || lt.k !== 'ptr') this.fail(e.pos, 'initializer element is not a compile-time constant')
      if (ac.func !== undefined) this.b.writeImage(addr, bytesLE(ac.func, PTR))
      else if (ac.addr !== undefined) this.b.writeImage(addr, bytesLE(ac.addr + ac.add, PTR))
      else this.b.addrFixup(addr, ac.key!, ac.add, true)
    }
  }

  private writeBits(addr: number, f: Field, v: number) {
    const mask = (1 << f.bitWidth!) - 1
    const off = addr - MEM.globalsBase
    const cur = this.b.image[off] ?? 0
    this.b.image[off] = (cur & ~(mask << f.bitOff!)) | ((v & mask) << f.bitOff!)
  }

  /** Adresse constante (initialiseur global) : &x, tableau, fonction, littéral chaîne, ± constante */
  private constAddress(e: Expr): { key?: string; addr?: number; add: number; func?: number } | undefined {
    switch (e.k) {
      case 'str':
        return { addr: this.b.stringLiteral(e.bytes, e.pos, T.char), add: 0 }
      case 'id': {
        const s = this.lookup(e.name)
        if (s?.k === 'func') {
          s.f.usePos ??= e.pos
          return { func: s.f.index, add: 0 }
        }
        if (s?.k === 'gvar' && s.type.k === 'array') return this.gAddr(s.g, 0, e.pos)
        return undefined
      }
      case 'cast':
        return this.constAddress(e.e)
      case 'unary': {
        if (e.op !== '&') return undefined
        return this.constPlace(e.e)
      }
      case 'bin': {
        if (e.op !== '+' && e.op !== '-') return undefined
        const base = this.constAddress(e.l)
        const n = this.constValue(e.r)
        const pt = this.valueType(e.l)
        if (!base || n === undefined || pt.k !== 'ptr') return undefined
        const d = n * sizeOf(pt.to) * (e.op === '-' ? -1 : 1)
        return { ...base, add: base.add + d }
      }
      default:
        return undefined
    }
  }

  private gAddr(g: GlobalVar, add: number, pos: SrcPos) {
    g.usePos ??= pos
    return g.addr >= 0 ? { addr: g.addr, add } : { key: g.key, add }
  }

  private constPlace(e: Expr): { key?: string; addr?: number; add: number; func?: number } | undefined {
    if (e.k === 'id') {
      const s = this.lookup(e.name)
      if (s?.k === 'gvar') return this.gAddr(s.g, 0, e.pos)
      if (s?.k === 'func') return { func: s.f.index, add: 0 }
      return undefined
    }
    if (e.k === 'index') {
      const base = this.constPlace(e.a)
      const i = this.constValue(e.i)
      const at = this.typeOf(e.a)
      if (!base || i === undefined || at.k !== 'array') return undefined
      return { ...base, add: base.add + i * sizeOf(at.of) }
    }
    if (e.k === 'member' && !e.arrow) {
      const base = this.constPlace(e.e)
      const st = this.typeOf(e.e)
      if (!base || st.k !== 'struct') return undefined
      const f = st.s.fields.find((x) => x.name === e.name)
      if (!f || f.bitWidth !== undefined) return undefined
      return { ...base, add: base.add + f.offset }
    }
    if (e.k === 'str') return { addr: this.b.stringLiteral(e.bytes, e.pos, T.char), add: 0 }
    return undefined
  }

  /* ═════════════════════════ Fonctions ═════════════════════════ */

  private functionDefinition(d: Declarator, type: CType & { k: 'func' }, specs: Specs) {
    const name = d.name!
    if (specs.storage === 'typedef') this.fail(d.pos, 'function definition declared \'typedef\'')
    if (type.params === null) type = { ...type, params: [] }
    const entry = this.declareFunction(name, type, d.pos, specs.storage === 'static')
    let bind = true
    if (entry.defined) {
      if (this.weak) bind = false
      else if (entry.weak) {
        entry.weak = false
      } else {
        const first = entry.defPos!
        if (first.file === d.pos.file) this.fail(d.pos, `redefinition of '${name}'`)
        this.fail(d.pos, `multiple definition of '${name}' (first defined in ${first.file}:${first.line}:${first.col})`)
      }
    }
    if (specs.isr) {
      if (this.b.isr && this.b.isr.key !== entry.meta.key) this.fail(d.pos, `only one interrupt function is allowed ('${this.b.funcByKey.get(this.b.isr.key)!.meta.name}' already defined at ${this.b.isr.pos.file}:${this.b.isr.pos.line}:${this.b.isr.pos.col})`)
      if ((type.params ?? []).length > 0) this.fail(d.pos, 'interrupt function cannot have parameters')
      if (type.ret.k !== 'void') this.fail(d.pos, 'interrupt function must return void')
    }
    const meta = entry.meta
    const ctx: FnCtx = { entry, name, ret: type.ret, frame: 0, maxFrame: 0, isIsr: specs.isr, retHiddenOff: -1, breaks: [], conts: [], switches: [], warnedFloat: false, bind }
    const saved = this.fn
    this.fn = ctx
    const entryPc = this.b.pc
    if (bind) {
      entry.defined = true
      entry.defPos = d.pos
      entry.type = type
      meta.entry = entryPc
      meta.params = []
      meta.locals = []
      meta.isIsr = specs.isr
      meta.file = d.pos.file
      meta.line = d.pos.line
      if (specs.isr) this.b.isr = { key: meta.key, pos: d.pos }
    }
    this.pushScope()
    const params: { off: number; kind: Kind; structSize?: number }[] = []
    if (type.ret.k === 'struct') {
      ctx.retHiddenOff = this.allocLocal(PTR)
      params.push({ off: ctx.retHiddenOff, kind: Kind.U16 })
    }
    for (const prm of d.params ?? []) {
      if (!prm.name) this.fail(prm.pos, 'parameter name omitted')
      if (prm.type.k === 'void') this.fail(prm.pos, "argument may not have 'void' type")
      const off = this.allocLocal(sizeOf(prm.type))
      this.scope.syms.set(prm.name, { k: 'lvar', type: prm.type, off })
      if (bind) meta.locals.push({ name: prm.name, off, type: prm.type })
      params.push(prm.type.k === 'struct' ? { off, kind: Kind.U16, structSize: sizeOf(prm.type) } : { off, kind: kindOf(prm.type) })
    }
    if (bind) meta.params = params
    this.b.lastOp = -1
    this.compound(false)
    this.popScope()
    const endsWithReturn = this.b.lastOp === Op.RET || this.b.lastOp === Op.RETFIE
    // Retour implicite en fin de fonction
    this.b.setLine(this.prevEnd(), true)
    if (ctx.isIsr) this.b.emit(Op.RETFIE, C.ret)
    else if (type.ret.k === 'void') this.b.emit(Op.RET, C.ret, 0)
    else {
      if (name !== 'main' && !endsWithReturn) this.b.diags.warning(this.prevEnd(), `non-void function '${name}' does not return a value in all control paths`)
      this.b.emit(Op.PUSH, C.simple, 0)
      this.b.emit(Op.RET, C.ret, 1)
    }
    if (bind) meta.frameSize = ctx.maxFrame
    this.fn = saved
  }

  private allocLocal(size: number): number {
    const fn = this.fn!
    const off = fn.frame
    fn.frame += Math.max(1, size)
    fn.maxFrame = Math.max(fn.maxFrame, fn.frame)
    return off
  }

  /* ═════════════════════════ Instructions ═════════════════════════ */

  private compound(newScope: boolean) {
    this.expect('{')
    if (newScope) this.pushScope()
    while (!this.is('}')) {
      if (this.peek().kind === 'eof') this.fail(this.peek().pos, "expected '}'")
      this.statement()
    }
    this.next()
    if (newScope) this.popScope()
  }

  private statement() {
    const t = this.peek()
    const fn = this.fn!
    if (t.kind === 'punct' && t.text === '{') {
      this.compound(true)
      return
    }
    if (t.kind === 'punct' && t.text === ';') {
      this.next()
      return
    }
    this.b.setLine(t.pos, true)
    if (t.kind === 'id') {
      switch (t.text) {
        case 'if':
          return this.ifStmt()
        case 'while':
          return this.whileStmt()
        case 'do':
          return this.doStmt()
        case 'for':
          return this.forStmt()
        case 'switch':
          return this.switchStmt()
        case 'case':
          return this.caseStmt()
        case 'default': {
          this.next()
          this.expect(':', "expected ':' after 'default'")
          const sw = fn.switches[fn.switches.length - 1]
          if (!sw) this.fail(t.pos, "'default' statement not in switch statement")
          if (sw.def) this.fail(t.pos, "multiple default labels in one switch")
          sw.def = this.b.label()
          this.b.place(sw.def)
          if (!this.is('}')) this.statement()
          return
        }
        case 'break': {
          this.next()
          const target = fn.breaks[fn.breaks.length - 1]
          if (!target) this.fail(t.pos, "'break' statement not in loop or switch statement")
          this.expectSemi('after break statement')
          this.b.jump(Op.JMP, target)
          return
        }
        case 'continue': {
          this.next()
          const target = fn.conts[fn.conts.length - 1]
          if (!target) this.fail(t.pos, "'continue' statement not in loop statement")
          this.expectSemi('after continue statement')
          this.b.jump(Op.JMP, target)
          return
        }
        case 'return':
          return this.returnStmt()
        case 'goto':
          this.fail(t.pos, "'goto' is not supported by the INFO3 simulator")
      }
      if (this.is(':', 1) && !KEYWORDS.has(t.text) && !this.isTypedefName(t)) this.fail(t.pos, 'labels are not supported by the INFO3 simulator (goto is refused)')
      if (this.isDeclStart(t)) {
        this.localDeclaration()
        return
      }
    }
    const e = this.expr()
    this.expectSemi('after expression')
    this.emitDiscard(e)
  }

  private paren(): Expr {
    this.expect('(', "expected '(' after keyword")
    const e = this.expr()
    this.expect(')', "expected ')'")
    return e
  }

  private ifStmt() {
    this.next()
    const c = this.paren()
    const lElse = this.b.label()
    this.emitCond(c, lElse)
    this.statement()
    if (this.is('else')) {
      this.next()
      const lEnd = this.b.label()
      this.b.jump(Op.JMP, lEnd)
      this.b.place(lElse)
      this.statement()
      this.b.place(lEnd)
    } else this.b.place(lElse)
  }

  private whileStmt() {
    const kw = this.next()
    const c = this.paren()
    const fn = this.fn!
    const top = this.b.label()
    const end = this.b.label()
    this.b.place(top)
    this.b.setLine(kw.pos, true)
    const cv = this.constValue(c)
    if (cv === undefined) this.emitCond(c, end)
    else if (cv === 0) this.b.jump(Op.JMP, end)
    fn.breaks.push(end)
    fn.conts.push(top)
    this.statement()
    fn.breaks.pop()
    fn.conts.pop()
    this.b.setLine(kw.pos, false)
    this.b.jump(Op.JMP, top)
    this.b.place(end)
  }

  private doStmt() {
    this.next()
    const fn = this.fn!
    const top = this.b.label()
    const cont = this.b.label()
    const end = this.b.label()
    this.b.place(top)
    fn.breaks.push(end)
    fn.conts.push(cont)
    this.statement()
    fn.breaks.pop()
    fn.conts.pop()
    const w = this.expect('while', "expected 'while' in do/while loop")
    this.b.place(cont)
    this.b.setLine(w.pos, true)
    const c = this.paren()
    this.expectSemi('after do/while statement')
    const cv = this.constValue(c)
    if (cv === undefined) {
      this.emitValueBool(c)
      this.b.jump(Op.JNZ, top)
    } else if (cv !== 0) this.b.jump(Op.JMP, top)
    this.b.place(end)
  }

  private forStmt() {
    const kw = this.next()
    const fn = this.fn!
    this.expect('(', "expected '(' after 'for'")
    this.pushScope()
    if (!this.accept(';')) {
      if (this.isDeclStart(this.peek())) this.localDeclaration()
      else {
        const init = this.expr()
        this.expectSemi("in 'for' statement specifier")
        this.emitDiscard(init)
      }
    }
    let cond: Expr | null = null
    if (!this.accept(';')) {
      cond = this.expr()
      this.expectSemi("in 'for' statement specifier")
    }
    let incr: Expr | null = null
    if (!this.is(')')) incr = this.expr()
    this.expect(')', "expected ')'")
    const top = this.b.label()
    const cont = this.b.label()
    const end = this.b.label()
    this.b.place(top)
    this.b.setLine(kw.pos, true)
    if (cond) {
      const cv = this.constValue(cond)
      if (cv === undefined) this.emitCond(cond, end)
      else if (cv === 0) this.b.jump(Op.JMP, end)
    }
    fn.breaks.push(end)
    fn.conts.push(cont)
    this.statement()
    fn.breaks.pop()
    fn.conts.pop()
    this.b.place(cont)
    this.b.setLine(kw.pos, true)
    if (incr) this.emitDiscard(incr)
    this.b.jump(Op.JMP, top)
    this.b.place(end)
    this.popScope()
  }

  private switchStmt() {
    this.next()
    const fn = this.fn!
    const e = this.paren()
    const vt = this.valueType(e)
    if (!isInt(vt)) this.fail(e.pos, `statement requires expression of integer type ('${typeName(vt)}' invalid)`)
    const st = promote(vt)
    const tmp = this.allocLocal(sizeOf(st))
    this.emitValue(e)
    this.emitConv(vt, st)
    this.b.emit(Op.STL, C.op16, tmp, kindOf(st), 0)
    const dispatch = this.b.label()
    const end = this.b.label()
    this.b.jump(Op.JMP, dispatch)
    const sw: SwitchCtx = { cases: [], def: null, type: st }
    fn.switches.push(sw)
    fn.breaks.push(end)
    this.statement()
    fn.breaks.pop()
    fn.switches.pop()
    this.b.jump(Op.JMP, end)
    this.b.place(dispatch)
    const k = kindOf(st)
    for (const c of sw.cases) {
      this.b.emit(Op.LDL, C.op16, tmp, k)
      this.b.emit(Op.PUSH, C.simple, c.value)
      this.b.emit(Op.BIN, costArith(k), BinOp.EQ, k)
      this.b.jump(Op.JNZ, c.label)
    }
    this.b.jump(Op.JMP, sw.def ?? end)
    this.b.place(end)
  }

  private caseStmt() {
    const kw = this.next()
    const fn = this.fn!
    const e = this.conditional()
    this.expect(':', "expected ':' after 'case'")
    const sw = fn.switches[fn.switches.length - 1]
    if (!sw) this.fail(kw.pos, "'case' statement not in switch statement")
    const v0 = this.constValue(e)
    if (v0 === undefined) this.fail(e.pos, 'expression is not an integer constant expression')
    const v = convert(kindOf(this.valueType(e)), kindOf(sw.type), v0)
    const dup = sw.cases.find((c) => c.value === v)
    if (dup) this.fail(e.pos, `duplicate case value '${v}'`)
    const l = this.b.label()
    this.b.place(l)
    sw.cases.push({ value: v, label: l, pos: kw.pos })
    if (!this.is('}')) this.statement()
  }

  private returnStmt() {
    const kw = this.next()
    const fn = this.fn!
    if (this.accept(';')) {
      if (fn.ret.k !== 'void') this.b.diags.warning(kw.pos, `non-void function '${fn.name}' should return a value`)
      if (fn.ret.k !== 'void') this.b.emit(Op.PUSH, C.simple, 0)
      this.emitReturn(fn.ret.k !== 'void')
      return
    }
    const e = this.expr()
    this.expectSemi('after return statement')
    if (fn.ret.k === 'void') {
      if (this.typeOf(e).k !== 'void') this.fail(e.pos, `void function '${fn.name}' should not return a value`)
      this.emitDiscard(e)
      this.emitReturn(false)
      return
    }
    if (fn.ret.k === 'struct') {
      this.b.emit(Op.LDL, C.op16, fn.retHiddenOff, Kind.U16)
      const t = this.emitValue(e)
      if (!sameType(unqual(t), unqual(fn.ret))) this.fail(e.pos, `returning '${typeName(t)}' from a function with incompatible result type '${typeName(fn.ret)}'`)
      this.b.emit(Op.MEMCPY, C.simple * sizeOf(fn.ret), sizeOf(fn.ret))
      this.emitReturn(true)
      return
    }
    this.emitValueAs(e, fn.ret, 'returning')
    this.emitReturn(true)
  }

  private emitReturn(hasValue: boolean) {
    if (this.fn!.isIsr) this.b.emit(Op.RETFIE, C.ret)
    else this.b.emit(Op.RET, C.ret, hasValue ? 1 : 0)
  }

  private localDeclaration() {
    const specs = this.parseSpecs()!
    if (this.accept(';')) return
    const fn = this.fn!
    for (;;) {
      const d = this.parseDeclarator(false)
      let type = d.build(specs.type)
      if (!d.name) this.fail(d.pos, 'expected identifier or \'(\'')
      const name = d.name
      const at = this.parseAt()
      if (specs.isr) this.fail(d.pos, '__interrupt applies only to function definitions')
      if (specs.storage === 'typedef') {
        this.scope.syms.set(name, { k: 'typedef', type })
      } else if (type.k === 'func') {
        this.declareFunction(name, type, d.pos, specs.storage === 'static')
      } else if (specs.storage === 'extern' || at !== undefined) {
        this.declareGlobalVar(name, type, d.pos, specs.storage === 'extern' ? 'extern' : null, at, null, this.scope, this.linkKey(name, false))
      } else if (specs.storage === 'static') {
        let init: Init | null = null
        if (this.accept('=')) init = this.parseInitializer()
        const key = `${this.file}#${fn.name}#${name}#${this.b.pc}`
        this.declareGlobalVar(name, type, d.pos, 'static', undefined, init, this.scope, key)
      } else {
        if (type.k === 'void') this.fail(d.pos, "variable has incomplete type 'void'")
        if (this.scope.syms.has(name) && this.scope.syms.get(name)!.k === 'lvar') this.fail(d.pos, `redefinition of '${name}'`)
        let init: Init | null = null
        if (this.accept('=')) init = this.parseInitializer()
        if (type.k === 'array' && type.len === null) {
          if (!init) this.fail(d.pos, `definition of variable with array type needs an explicit size or an initializer`)
          type = { ...type, len: this.initLength(type, init) }
        }
        if (type.k === 'struct' && !type.s.complete) this.fail(d.pos, `variable has incomplete type '${typeName(type)}'`)
        const off = this.allocLocal(sizeOf(type))
        this.scope.syms.set(name, { k: 'lvar', type, off })
        if (fn.bind) fn.entry.meta.locals.push({ name, off, type })
        if (init) this.emitLocalInit(off, type, init)
      }
      if (this.accept(',')) continue
      this.expectSemi('at end of declaration')
      return
    }
  }

  private emitLocalInit(off: number, type: CType, init: Init) {
    const leaves = this.flattenInit(type, init)
    if (type.k !== 'array' && type.k !== 'struct') {
      const leaf = leaves[0]
      const pl: Place = { mode: 'fp', off, type }
      this.emitValueAs(leaf.e!, type, 'initializing')
      this.store(pl, false)
      return
    }
    if (type.k === 'struct' && leaves.length === 1 && leaves[0].type.k === 'struct' && leaves[0].e) {
      this.b.emit(Op.LEAL, C.simple, off)
      this.emitValue(leaves[0].e)
      this.b.emit(Op.MEMCPY, C.simple * sizeOf(type), sizeOf(type))
      this.b.emit(Op.POP, C.simple)
      return
    }
    // Image des parties constantes, copiée d'un bloc, puis les éléments calculés
    const size = sizeOf(type)
    const bytes = new Array<number>(size).fill(0)
    const dyn: Leaf[] = []
    for (const leaf of leaves) {
      if (leaf.value !== undefined) {
        bytes[leaf.off] = leaf.value
        continue
      }
      const cv = leaf.type.k === 'struct' ? undefined : this.constValue(leaf.e!)
      if (cv === undefined) {
        dyn.push(leaf)
        continue
      }
      const v = convert(kindOf(this.valueType(leaf.e!)), kindOf(leaf.type), cv)
      if (leaf.field?.bitWidth !== undefined) {
        const mask = (1 << leaf.field.bitWidth) - 1
        bytes[leaf.off] = (bytes[leaf.off] & ~(mask << leaf.field.bitOff!)) | ((v & mask) << leaf.field.bitOff!)
      } else kindBytes(kindOf(leaf.type), v).forEach((x, i) => (bytes[leaf.off + i] = x))
    }
    const img = this.b.anonymous({ k: 'array', of: T.uchar, len: size }, bytes, init.pos)
    this.b.emit(Op.LEAL, C.simple, off)
    this.b.emit(Op.PUSH, C.simple, img)
    this.b.emit(Op.MEMCPY, C.simple * size, size)
    this.b.emit(Op.POP, C.simple)
    for (const leaf of dyn) {
      const e = leaf.e!
      if (leaf.type.k === 'struct') {
        this.b.emit(Op.LEAL, C.simple, off + leaf.off)
        this.emitValue(e)
        this.b.emit(Op.MEMCPY, C.simple * sizeOf(leaf.type), sizeOf(leaf.type))
        this.b.emit(Op.POP, C.simple)
        continue
      }
      const f = leaf.field
      const pl: Place = { mode: 'fp', off: off + leaf.off, type: leaf.type, bit: f?.bitWidth !== undefined ? { off: f.bitOff!, width: f.bitWidth, signed: leaf.type.k === 'int' && leaf.type.signed } : undefined }
      const target = this.prepareStore(pl)
      const t = this.emitValue(e)
      this.checkAssign(leaf.type, t, e, 'initializing')
      this.emitConv(t, leaf.type)
      this.store(target, false)
    }
  }

  /* ═════════════════════════ Expressions : analyse ═════════════════════════ */

  private expr(): Expr {
    let e = this.assignment()
    while (this.is(',')) {
      const t = this.next()
      e = { k: 'comma', l: e, r: this.assignment(), pos: t.pos }
    }
    return e
  }

  private assignment(): Expr {
    const l = this.conditional()
    const t = this.peek()
    if (t.kind === 'punct' && ASSIGN_OPS.has(t.text)) {
      this.next()
      return { k: 'assign', op: t.text, l, r: this.assignment(), pos: t.pos }
    }
    return l
  }

  private conditional(): Expr {
    const c = this.binary(1)
    if (this.is('?')) {
      const q = this.next()
      const a = this.expr()
      this.expect(':', "expected ':'")
      const b = this.conditional()
      return { k: 'cond', c, a, b, pos: q.pos }
    }
    return c
  }

  private binary(minPrec: number): Expr {
    let l = this.unary()
    for (;;) {
      const t = this.peek()
      const p = t.kind === 'punct' ? PREC[t.text] : undefined
      if (p === undefined || p < minPrec) return l
      this.next()
      const r = this.binary(p + 1)
      l = { k: 'bin', op: t.text, l, r, pos: t.pos }
    }
  }

  private unary(): Expr {
    const t = this.peek()
    if (t.kind === 'punct') {
      switch (t.text) {
        case '++':
        case '--':
          this.next()
          return { k: 'incdec', inc: t.text === '++', post: false, e: this.unary(), pos: t.pos }
        case '&':
        case '*':
        case '+':
        case '-':
        case '~':
        case '!':
          this.next()
          return { k: 'unary', op: t.text, e: this.castExpr(), pos: t.pos }
        case '(':
          return this.castExpr()
      }
    }
    if (t.kind === 'id' && t.text === 'sizeof') {
      this.next()
      if (this.is('(') && this.isTypeStart(this.peek(1))) {
        this.next()
        const ty = this.parseTypeName()
        this.expect(')', "expected ')'")
        return { k: 'sizeof', t: ty, pos: t.pos }
      }
      return { k: 'sizeof', e: this.unary(), pos: t.pos }
    }
    return this.postfix()
  }

  private castExpr(): Expr {
    if (this.is('(') && this.isTypeStart(this.peek(1))) {
      const lp = this.next()
      const ty = this.parseTypeName()
      this.expect(')', "expected ')'")
      if (this.is('{')) this.fail(this.peek().pos, 'compound literals are not supported by the INFO3 simulator')
      return { k: 'cast', to: ty, e: this.castExpr(), pos: lp.pos }
    }
    if (this.is('(')) return this.postfix()
    return this.unary()
  }

  private postfix(): Expr {
    let e = this.primary()
    for (;;) {
      const t = this.peek()
      if (t.kind !== 'punct') return e
      if (t.text === '[') {
        this.next()
        const i = this.expr()
        this.expect(']', "expected ']'")
        e = { k: 'index', a: e, i, pos: t.pos }
      } else if (t.text === '(') {
        this.next()
        const args: Expr[] = []
        if (!this.is(')')) {
          for (;;) {
            args.push(this.assignment())
            if (!this.accept(',')) break
          }
        }
        const rp = this.expect(')', "expected ')'")
        e = { k: 'call', f: e, args, pos: e.pos, rparen: rp.pos }
      } else if (t.text === '.' || t.text === '->') {
        this.next()
        const id = this.next()
        if (id.kind !== 'id') this.fail(id.pos, 'expected identifier')
        e = { k: 'member', e, name: id.text, arrow: t.text === '->', pos: id.pos }
      } else if (t.text === '++' || t.text === '--') {
        this.next()
        e = { k: 'incdec', inc: t.text === '++', post: true, e, pos: t.pos }
      } else return e
    }
  }

  private primary(): Expr {
    const t = this.next()
    switch (t.kind) {
      case 'num':
        return { k: 'num', v: t.value!, t: this.literalType(t), pos: t.pos }
      case 'char':
        return { k: 'num', v: t.value!, t: T.int, pos: t.pos }
      case 'str': {
        const bytes = [...t.str!]
        while (this.peek().kind === 'str') bytes.push(...this.next().str!)
        return { k: 'str', bytes, pos: t.pos }
      }
      case 'id':
        if (KEYWORDS.has(t.text) && t.text !== '__at') this.fail(t.pos, `expected expression`)
        return { k: 'id', name: t.text, pos: t.pos, xtal: t.xtal }
      case 'punct':
        if (t.text === '(') {
          const e = this.expr()
          this.expect(')', "expected ')'")
          return e
        }
        break
    }
    if (t.kind === 'eof') this.fail(t.pos, 'expected expression')
    this.fail(t.pos, 'expected expression')
  }

  private literalType(t: Token): CType {
    if (t.isFloat) return T.float
    const v = t.value!
    const decimal = !/^0[xXbB0-7]/.test(t.text) || t.text === '0'
    const fits = (bits: number, signed: boolean) => v <= (signed ? 2 ** (bits - 1) - 1 : 2 ** bits - 1)
    const order: CType[] = []
    if (t.unsigned && t.long) order.push(T.ulong)
    else if (t.unsigned) order.push(T.uint, T.ulong)
    else if (t.long) order.push(T.long, T.ulong)
    else if (decimal) order.push(T.int, T.long, T.ulong)
    else order.push(T.int, T.uint, T.long, T.ulong)
    for (const ty of order) {
      const it = ty as { size: number; signed: boolean }
      if (fits(it.size * BYTE, it.signed)) return ty
    }
    this.b.diags.warning(t.pos, 'integer literal is too large to be represented in any integer type')
    return T.ulong
  }

  /* ═════════════════════════ Types des expressions ═════════════════════════ */

  private decay(t: CType): CType {
    if (t.k === 'array') return ptrTo(t.of)
    if (t.k === 'func') return ptrTo(t)
    return t
  }

  valueType(e: Expr): CType {
    return this.decay(this.typeOf(e))
  }

  typeOf(e: Expr): CType {
    const known = this.types.get(e)
    if (known) return known
    const t = this.computeType(e)
    this.types.set(e, t)
    return t
  }

  private symOf(e: Expr & { k: 'id' }): Sym {
    const s = this.lookup(e.name)
    if (!s || s.k === 'typedef') {
      if (s?.k === 'typedef') this.fail(e.pos, `unexpected type name '${e.name}': expected expression`)
      if (ALLOC.has(e.name)) this.fail(e.pos, `dynamic memory allocation ('${e.name}') is not supported by the INFO3 simulator`)
      this.fail(e.pos, `use of undeclared identifier '${e.name}'`)
    }
    return s
  }

  private computeType(e: Expr): CType {
    switch (e.k) {
      case 'num':
        return e.t
      case 'str':
        return { k: 'array', of: T.char, len: e.bytes.length + 1 }
      case 'id': {
        if (e.name in DELAYS || e.name === '__nop') this.fail(e.pos, `'${e.name}' must be called`)
        const s = this.symOf(e)
        if (s.k === 'enum') return T.int
        return (s as { type: CType }).type
      }
      case 'bin': {
        const op = e.op
        if (op === '&&' || op === '||' || CMP.has(op)) {
          const lt = this.valueType(e.l)
          const rt = this.valueType(e.r)
          if (!isScalar(lt) || !isScalar(rt)) this.badOperands(e, lt, rt)
          return T.int
        }
        const lt = this.valueType(e.l)
        const rt = this.valueType(e.r)
        if (op === '+') {
          if (lt.k === 'ptr' && isInt(rt)) return lt
          if (isInt(lt) && rt.k === 'ptr') return rt
        }
        if (op === '-') {
          if (lt.k === 'ptr' && isInt(rt)) return lt
          if (lt.k === 'ptr' && rt.k === 'ptr') return T.int
        }
        if (op === '<<' || op === '>>') {
          if (!isInt(lt) || !isInt(rt)) this.badOperands(e, lt, rt)
          return promote(lt)
        }
        if (op === '%' || op === '&' || op === '|' || op === '^') {
          if (!isInt(lt) || !isInt(rt)) this.badOperands(e, lt, rt)
          return usual(lt, rt)
        }
        if (!isArith(lt) || !isArith(rt)) this.badOperands(e, lt, rt)
        return usual(lt, rt)
      }
      case 'assign':
        return unqual(this.typeOf(e.l))
      case 'unary': {
        if (e.op === '&') {
          const t = this.typeOf(e.e)
          return ptrTo(t)
        }
        if (e.op === '*') {
          const t = this.valueType(e.e)
          if (t.k !== 'ptr') this.fail(e.pos, `indirection requires pointer operand ('${typeName(t)}' invalid)`)
          if (t.to.k === 'void') this.fail(e.pos, "incomplete type 'void' is not assignable")
          return t.to
        }
        const t = this.valueType(e.e)
        if (e.op === '!') {
          if (!isScalar(t)) this.fail(e.pos, `invalid argument type '${typeName(t)}' to unary expression`)
          return T.int
        }
        if (e.op === '~' ? !isInt(t) : !isArith(t)) this.fail(e.pos, `invalid argument type '${typeName(t)}' to unary expression`)
        return promote(t)
      }
      case 'incdec': {
        const t = this.typeOf(e.e)
        if (!isScalar(t)) this.fail(e.pos, `cannot ${e.inc ? 'increment' : 'decrement'} value of type '${typeName(t)}'`)
        return unqual(t)
      }
      case 'cond': {
        this.valueType(e.c)
        const a = this.valueType(e.a)
        const b = this.valueType(e.b)
        if (isArith(a) && isArith(b)) return usual(a, b)
        if (a.k === 'ptr' && b.k === 'ptr') return a.to.k === 'void' ? b : a
        if (a.k === 'ptr' && isInt(b)) return a
        if (isInt(a) && b.k === 'ptr') return b
        if (a.k === 'struct' && b.k === 'struct' && a.s === b.s) return unqual(a)
        if (a.k === 'void' && b.k === 'void') return T.void
        this.fail(e.pos, `incompatible operand types ('${typeName(a)}' and '${typeName(b)}')`)
        break
      }
      case 'call': {
        if (e.f.k === 'id') {
          if (e.f.name in DELAYS || e.f.name === '__nop') return T.void
          if (ALLOC.has(e.f.name) && !this.lookup(e.f.name)) this.fail(e.f.pos, `dynamic memory allocation ('${e.f.name}') is not supported by the INFO3 simulator`)
          if (ALLOC.has(e.f.name)) this.fail(e.f.pos, `dynamic memory allocation ('${e.f.name}') is not supported by the INFO3 simulator`)
          if (!this.lookup(e.f.name)) {
            this.b.diags.warning(e.f.pos, `implicit declaration of function '${e.f.name}' is invalid in C99`)
            const ft: CType = { k: 'func', ret: T.int, params: null, variadic: false }
            const saved = this.scope
            this.scope = this.fileScope
            this.declareFunction(e.f.name, ft, e.f.pos, false)
            this.scope = saved
          }
        }
        const ft = this.calleeType(e)
        return ft.ret
      }
      case 'index': {
        const a = this.valueType(e.a)
        const i = this.valueType(e.i)
        if (a.k === 'ptr' && isInt(i)) return a.to
        if (isInt(a) && i.k === 'ptr') return i.to
        if (a.k !== 'ptr' && i.k !== 'ptr') this.fail(e.pos, 'subscripted value is not an array, pointer, or vector')
        this.fail(e.i.pos, 'array subscript is not an integer')
        break
      }
      case 'member': {
        const f = this.fieldOf(e)
        if (f.bitWidth !== undefined && f.bitWidth < INT_BITS) return T.int
        return withQual(f.type, this.baseStructType(e).q ?? {})
      }
      case 'cast': {
        const from = this.valueType(e.e)
        const to = e.to
        if (to.k === 'void') return T.void
        if (to.k === 'struct' || to.k === 'array') this.fail(e.pos, `used type '${typeName(to)}' where arithmetic or pointer type is required`)
        if (!isScalar(from)) this.fail(e.pos, `operand of type '${typeName(from)}' where arithmetic or pointer type is required`)
        if (to.k === 'float' && from.k === 'ptr') this.fail(e.pos, `pointer cannot be cast to type 'float'`)
        return to
      }
      case 'sizeof': {
        const t = e.t ?? this.typeOf(e.e!)
        if (t.k === 'func') this.fail(e.pos, "invalid application of 'sizeof' to a function type")
        if (t.k === 'void') this.fail(e.pos, "invalid application of 'sizeof' to an incomplete type 'void'")
        return T.uint
      }
      case 'comma':
        this.typeOf(e.l)
        return this.valueType(e.r)
    }
  }

  private badOperands(e: Expr & { k: 'bin' }, lt: CType, rt: CType): never {
    this.fail(e.pos, `invalid operands to binary expression ('${typeName(lt)}' and '${typeName(rt)}')`)
  }

  private baseStructType(e: Expr & { k: 'member' }): CType {
    if (e.arrow) {
      const pt = this.valueType(e.e)
      if (pt.k !== 'ptr' || pt.to.k !== 'struct') this.fail(e.pos, `member reference type '${typeName(pt)}' is not a pointer to a struct`)
      return pt.to
    }
    const st = this.typeOf(e.e)
    if (st.k !== 'struct') {
      if (st.k === 'ptr' && st.to.k === 'struct') this.fail(e.pos, `member reference type '${typeName(st)}' is a pointer; did you mean to use '->'?`)
      this.fail(e.pos, `member reference base type '${typeName(st)}' is not a structure or union`)
    }
    return st
  }

  private fieldOf(e: Expr & { k: 'member' }): Field {
    const st = this.baseStructType(e) as CType & { k: 'struct' }
    if (!st.s.complete) this.fail(e.pos, `incomplete definition of type '${typeName(st)}'`)
    const f = st.s.fields.find((x) => x.name === e.name)
    if (!f) this.fail(e.pos, `no member named '${e.name}' in '${typeName(st)}'`)
    return f
  }

  private calleeType(e: Expr & { k: 'call' }): CType & { k: 'func' } {
    const t = this.typeOf(e.f)
    if (t.k === 'func') return t
    if (t.k === 'ptr' && t.to.k === 'func') return t.to
    this.fail(e.f.pos, `called object type '${typeName(t)}' is not a function or function pointer`)
  }

  /* ═════════════════════════ Constantes ═════════════════════════ */

  constValue(e: Expr): number | undefined {
    const known = this.consts.get(e)
    if (known !== undefined) return known === null ? undefined : known
    const v = this.computeConst(e)
    this.consts.set(e, v === undefined ? null : v)
    return v
  }

  private computeConst(e: Expr): number | undefined {
    switch (e.k) {
      case 'num':
        return e.t.k === 'float' ? Math.fround(e.v) : norm(kindOf(e.t), e.v)
      case 'id': {
        const s = this.lookup(e.name)
        return s?.k === 'enum' ? s.value : undefined
      }
      case 'sizeof': {
        const t = e.t ?? this.typeOf(e.e!)
        this.typeOf(e)
        return sizeOf(t)
      }
      case 'cast': {
        const v = this.constValue(e.e)
        if (v === undefined) return undefined
        const to = this.typeOf(e)
        if (to.k === 'void') return undefined
        return convert(kindOf(this.valueType(e.e)), kindOf(to), v)
      }
      case 'unary': {
        if (e.op === '&' || e.op === '*') return undefined
        const v = this.constValue(e.e)
        if (v === undefined) return undefined
        const t = this.typeOf(e)
        const from = kindOf(this.valueType(e.e))
        const x = convert(from, kindOf(t), v)
        switch (e.op) {
          case '-':
            return t.k === 'float' ? Math.fround(-x) : norm(kindOf(t), -x)
          case '+':
            return x
          case '~':
            return norm(kindOf(t), ~x)
          case '!':
            return v === 0 ? 1 : 0
        }
        return undefined
      }
      case 'bin': {
        const t = this.typeOf(e)
        if (e.op === '&&' || e.op === '||') {
          const l = this.constValue(e.l)
          if (l === undefined) return undefined
          if (e.op === '&&' && l === 0) return 0
          if (e.op === '||' && l !== 0) return 1
          const r = this.constValue(e.r)
          return r === undefined ? undefined : r !== 0 ? 1 : 0
        }
        const lt = this.valueType(e.l)
        const rt = this.valueType(e.r)
        if (!isArith(lt) || !isArith(rt)) return undefined
        const l = this.constValue(e.l)
        const r = this.constValue(e.r)
        if (l === undefined || r === undefined) return undefined
        if (e.op === '<<' || e.op === '>>') {
          const k = kindOf(t)
          return binop(BIN_OPS[e.op], k, convert(kindOf(lt), k, l), r)
        }
        const ct = CMP.has(e.op) ? usual(lt, rt) : t
        const k = kindOf(ct)
        if ((e.op === '/' || e.op === '%') && r === 0 && k !== Kind.F32) return undefined
        return binop(BIN_OPS[e.op], k, convert(kindOf(lt), k, l), convert(kindOf(rt), k, r))
      }
      case 'cond': {
        const c = this.constValue(e.c)
        if (c === undefined) return undefined
        const t = this.typeOf(e)
        if (!isArith(t)) return undefined
        const branch = c !== 0 ? e.a : e.b
        const v = this.constValue(branch)
        return v === undefined ? undefined : convert(kindOf(this.valueType(branch)), kindOf(t), v)
      }
      default:
        return undefined
    }
  }

  /* ═════════════════════════ Expressions : émission ═════════════════════════ */

  private emitConv(from: CType, to: CType) {
    if (to.k === 'void') {
      if (from.k !== 'void') this.b.emit(Op.POP, C.simple)
      return
    }
    if (from.k === 'struct' || to.k === 'struct') return
    const kf = kindOf(from)
    const kt = kindOf(to)
    if (kf === kt) return
    if (needsConv(kf, kt)) this.b.emit(Op.CONV, kf === Kind.F32 || kt === Kind.F32 ? C.float : C.simple, kf, kt)
  }

  private checkAssign(lt: CType, rt: CType, rhs: Expr, what: string) {
    const l = unqual(lt)
    if (isArith(l) && isArith(rt)) return
    if (l.k === 'ptr') {
      if (rt.k === 'ptr') {
        if (rt.to.q?.c && !l.to.q?.c && this.inUserFile(rhs.pos)) this.b.diags.warning(rhs.pos, `${what} '${typeName(l)}' from '${typeName(rt)}' discards qualifiers`)
        return
      }
      if (isInt(rt)) {
        if (this.constValue(rhs) !== 0) this.b.diags.warning(rhs.pos, `incompatible integer to pointer conversion ${what} '${typeName(l)}' from '${typeName(rt)}'`)
        return
      }
    }
    if (isInt(l) && rt.k === 'ptr') {
      this.b.diags.warning(rhs.pos, `incompatible pointer to integer conversion ${what} '${typeName(l)}' from '${typeName(rt)}'`)
      return
    }
    if (l.k === 'struct' && rt.k === 'struct' && l.s === rt.s) return
    this.fail(rhs.pos, `${what} '${typeName(l)}' from incompatible type '${typeName(rt)}'`)
  }

  private warnFloat(k: Kind, pos: SrcPos) {
    const fn = this.fn
    if (fn && fn.isIsr && k === Kind.F32 && !fn.warnedFloat) {
      fn.warnedFloat = true
      this.b.diags.warning(pos, 'floating-point operation in interrupt function (cours p. 36 : à éviter)')
    }
  }

  emitDiscard(e: Expr) {
    switch (e.k) {
      case 'assign':
        this.emitAssign(e, false)
        return
      case 'incdec':
        this.emitIncDec(e, false)
        return
      case 'call':
        this.emitCall(e, false)
        return
      case 'comma':
        this.emitDiscard(e.l)
        this.emitDiscard(e.r)
        return
      case 'cast':
        if (e.to.k === 'void') {
          this.typeOf(e)
          this.emitDiscard(e.e)
          return
        }
        break
    }
    const t = this.emitValue(e)
    if (t.k !== 'void') this.b.emit(Op.POP, C.simple)
  }

  private emitCond(e: Expr, falseLabel: Label) {
    this.emitValueBool(e)
    this.b.jump(Op.JZ, falseLabel)
  }

  private emitValueBool(e: Expr) {
    const t = this.emitValue(e)
    if (!isScalar(t)) this.fail(e.pos, `statement requires expression of scalar type ('${typeName(t)}' invalid)`)
  }

  /** Valeur convertie dans le type cible ; une constante est convertie à la compilation (movlw k) */
  private emitValueAs(e: Expr, to: CType, what: string) {
    const vt = this.valueType(e)
    this.checkAssign(to, vt, e, what)
    const cv = isScalar(vt) && isScalar(to) ? this.constValue(e) : undefined
    if (cv !== undefined) {
      this.b.emit(Op.PUSH, C.simple, convert(kindOf(vt), kindOf(to), cv))
      return
    }
    const t = this.emitValue(e)
    this.emitConv(t, to)
  }

  /** Empile la valeur de e ; renvoie son type (tableaux et fonctions décomposés en pointeurs) */  emitValue(e: Expr): CType {
    const type = this.valueType(e)
    if (isScalar(type) || type.k === 'void') {
      const cv = this.constValue(e)
      if (cv !== undefined) {
        this.b.emit(Op.PUSH, C.simple, cv)
        return type
      }
    }
    switch (e.k) {
      case 'num':
        this.b.emit(Op.PUSH, C.simple, e.v)
        return type
      case 'str':
        this.b.emit(Op.PUSH, C.simple, this.b.stringLiteral(e.bytes, e.pos, T.char))
        return type
      case 'id': {
        const s = this.symOf(e)
        if (s.k === 'func') {
          s.f.usePos ??= e.pos
          this.b.emit(Op.PUSH, C.simple, s.f.index)
          return type
        }
        return this.load(this.emitPlace(e))
      }
      case 'index':
      case 'member':
        return this.load(this.emitPlace(e))
      case 'unary':
        return this.emitUnary(e, type)
      case 'assign':
        return this.emitAssign(e, true)
      case 'incdec':
        return this.emitIncDec(e, true)
      case 'bin':
        return this.emitBinary(e, type)
      case 'cond': {
        const lElse = this.b.label()
        const lEnd = this.b.label()
        this.emitCond(e.c, lElse)
        const ta = this.emitValue(e.a)
        this.emitConv(ta, type)
        this.b.jump(Op.JMP, lEnd)
        this.b.place(lElse)
        const tb = this.emitValue(e.b)
        this.emitConv(tb, type)
        this.b.place(lEnd)
        return type
      }
      case 'call':
        return this.emitCall(e, true)
      case 'cast': {
        const from = this.emitValue(e.e)
        this.emitConv(from, e.to)
        return type
      }
      case 'sizeof':
        this.b.emit(Op.PUSH, C.simple, this.constValue(e)!)
        return type
      case 'comma':
        this.emitDiscard(e.l)
        return this.emitValue(e.r)
    }
  }

  private emitUnary(e: Expr & { k: 'unary' }, type: CType): CType {
    switch (e.op) {
      case '&': {
        const inner = this.typeOf(e.e)
        if (inner.k === 'func') {
          this.emitValue(e.e)
          return type
        }
        if (!this.isLvalue(e.e)) this.fail(e.pos, 'cannot take the address of an rvalue')
        const pl = this.emitPlace(e.e)
        if (pl.bit) this.fail(e.pos, 'address of bit-field requested')
        this.materialize(pl)
        return type
      }
      case '*': {
        const pt = this.valueType(e.e)
        if (pt.k === 'ptr' && pt.to.k === 'func') {
          this.emitValue(e.e)
          return pt
        }
        return this.load(this.emitPlace(e))
      }
      case '!':
        this.emitValue(e.e)
        this.b.emit(Op.LNOT, C.simple)
        return type
      default: {
        const t = this.emitValue(e.e)
        this.emitConv(t, type)
        const k = kindOf(type)
        this.warnFloat(k, e.pos)
        if (e.op === '-') this.b.emit(Op.NEG, costArith(k), k)
        else if (e.op === '~') this.b.emit(Op.BNOT, costArith(k), k)
        return type
      }
    }
  }

  private emitScale(size: number) {
    if (size !== 1) {
      this.b.emit(Op.PUSH, C.simple, size)
      this.b.emit(Op.BIN, C.op16, BinOp.MUL, Kind.S16)
    }
  }

  private emitBinary(e: Expr & { k: 'bin' }, type: CType): CType {
    const op = e.op
    if (op === '&&' || op === '||') {
      const lShort = this.b.label()
      const lEnd = this.b.label()
      this.emitValueBool(e.l)
      this.b.jump(op === '&&' ? Op.JZ : Op.JNZ, lShort)
      this.emitValueBool(e.r)
      this.b.jump(op === '&&' ? Op.JZ : Op.JNZ, lShort)
      this.b.emit(Op.PUSH, C.simple, op === '&&' ? 1 : 0)
      this.b.jump(Op.JMP, lEnd)
      this.b.place(lShort)
      this.b.emit(Op.PUSH, C.simple, op === '&&' ? 0 : 1)
      this.b.place(lEnd)
      return type
    }
    const lt = this.valueType(e.l)
    const rt = this.valueType(e.r)
    if ((op === '+' || op === '-') && (lt.k === 'ptr' || rt.k === 'ptr')) {
      if (lt.k === 'ptr' && rt.k === 'ptr') {
        this.emitValue(e.l)
        this.emitValue(e.r)
        this.b.emit(Op.BIN, C.op16, BinOp.SUB, Kind.S16)
        const sz = sizeOf(lt.to)
        if (sz !== 1) {
          this.b.emit(Op.PUSH, C.simple, sz)
          this.b.emit(Op.BIN, C.op16, BinOp.DIV, Kind.S16)
        }
        return T.int
      }
      const ptrFirst = lt.k === 'ptr'
      const pt = (ptrFirst ? lt : rt) as CType & { k: 'ptr' }
      if (ptrFirst) {
        this.emitValue(e.l)
        const it = this.emitValue(e.r)
        this.emitConv(it, promote(it))
      } else {
        const it = this.emitValue(e.l)
        this.emitConv(it, promote(it))
        this.emitScale(sizeOf(pt.to))
        this.emitValue(e.r)
        this.b.emit(Op.BIN, C.op16, BinOp.ADD, Kind.U16)
        return pt
      }
      this.emitScale(sizeOf(pt.to))
      this.b.emit(Op.BIN, C.op16, op === '+' ? BinOp.ADD : BinOp.SUB, Kind.U16)
      return pt
    }
    if (CMP.has(op) && (lt.k === 'ptr' || rt.k === 'ptr')) {
      this.emitValue(e.l)
      this.emitValue(e.r)
      this.b.emit(Op.BIN, C.op16, BIN_OPS[op], Kind.U16)
      return T.int
    }
    if (op === '<<' || op === '>>') {
      const k = kindOf(type)
      const a = this.emitValue(e.l)
      this.emitConv(a, type)
      const c = this.emitValue(e.r)
      this.emitConv(c, promote(c))
      this.b.emit(Op.BIN, costArith(k), BIN_OPS[op], k)
      return type
    }
    const ct = CMP.has(op) ? usual(lt, rt) : type
    const k = kindOf(ct)
    this.warnFloat(k, e.pos)
    const a = this.emitValue(e.l)
    this.emitConv(a, ct)
    const c = this.emitValue(e.r)
    this.emitConv(c, ct)
    this.b.emit(Op.BIN, costArith(k), BIN_OPS[op], k)
    return type
  }

  /* ───── Places (lvalues) ───── */

  private isLvalue(e: Expr): boolean {
    switch (e.k) {
      case 'id': {
        const s = this.lookup(e.name)
        return s?.k === 'gvar' || s?.k === 'lvar'
      }
      case 'unary':
        return e.op === '*'
      case 'index':
      case 'str':
        return true
      case 'member':
        return e.arrow || this.isLvalue(e.e)
      default:
        return false
    }
  }

  private emitPlace(e: Expr): Place {
    switch (e.k) {
      case 'id': {
        const s = this.symOf(e)
        if (s.k === 'lvar') return { mode: 'fp', off: s.off, type: s.type }
        if (s.k === 'gvar') {
          const g = s.g
          g.usePos ??= e.pos
          const bit = g.bitOff !== undefined ? { off: g.bitOff, width: 1, signed: false } : undefined
          if (g.addr >= 0) return { mode: 'abs', off: g.addr, type: s.type, bit }
          return { mode: 'abs', off: 0, type: s.type, bit, fixKey: g.key }
        }
        this.fail(e.pos, 'expression is not assignable')
        break
      }
      case 'str':
        return { mode: 'abs', off: this.b.stringLiteral(e.bytes, e.pos, T.char), type: this.typeOf(e) }
      case 'unary': {
        if (e.op !== '*') break
        const pt = this.emitValue(e.e)
        if (pt.k !== 'ptr') this.fail(e.pos, `indirection requires pointer operand ('${typeName(pt)}' invalid)`)
        return { mode: 'stack', off: 0, type: this.typeOf(e) }
      }
      case 'index': {
        let a = e.a
        let i = e.i
        if (isInt(this.valueType(a))) [a, i] = [i, a]
        const at = this.typeOf(a)
        const elem = this.typeOf(e)
        const es = sizeOf(elem)
        const idx = this.constValue(i)
        if (at.k === 'array' && this.isLvalue(a)) {
          const base = this.emitPlace(a)
          if (idx !== undefined && base.mode !== 'stack' && !base.fixKey) return { mode: base.mode, off: base.off + idx * es, type: elem }
          this.materialize(base)
        } else this.emitValue(a)
        const it = this.emitValue(i)
        this.emitConv(it, promote(it))
        this.emitScale(es)
        this.b.emit(Op.BIN, C.op16, BinOp.ADD, Kind.U16)
        return { mode: 'stack', off: 0, type: elem }
      }
      case 'member': {
        const f = this.fieldOf(e)
        const ft = withQual(f.type, this.baseStructType(e).q ?? {})
        const bit = f.bitWidth !== undefined ? { off: f.bitOff!, width: f.bitWidth, signed: f.type.k === 'int' && f.type.signed } : undefined
        if (e.arrow) {
          this.emitValue(e.e)
          this.addOffset(f.offset)
          return { mode: 'stack', off: 0, type: ft, bit }
        }
        if (this.isLvalue(e.e)) {
          const base = this.emitPlace(e.e)
          if (base.mode !== 'stack' && !base.fixKey) return { mode: base.mode, off: base.off + f.offset, type: ft, bit }
          this.materialize(base)
        } else this.emitValue(e.e)
        this.addOffset(f.offset)
        return { mode: 'stack', off: 0, type: ft, bit }
      }
      case 'call':
      case 'assign':
      case 'cond':
      case 'comma': {
        const t = this.typeOf(e)
        if (t.k === 'struct') {
          this.emitValue(e)
          return { mode: 'stack', off: 0, type: t }
        }
        break
      }
    }
    this.fail(e.pos, 'expression is not assignable')
  }

  private addOffset(off: number) {
    if (off) {
      this.b.emit(Op.PUSH, C.simple, off)
      this.b.emit(Op.BIN, C.op16, BinOp.ADD, Kind.U16)
    }
  }

  private materialize(pl: Place) {
    if (pl.mode === 'abs') {
      const at = this.b.emit(Op.PUSH, C.simple, pl.off)
      if (pl.fixKey) this.b.addrFixup(at + 2, pl.fixKey, pl.off, false)
    } else if (pl.mode === 'fp') this.b.emit(Op.LEAL, C.simple, pl.off)
    pl.mode = 'stack'
    pl.fixKey = undefined
  }

  private isSfr(pl: Place) {
    return pl.mode === 'abs' && !pl.fixKey && pl.off < MEM.sfrLimit
  }

  private emitAbs(op: Op, cost: number, pl: Place, ...rest: number[]) {
    const at = this.b.emit(op, cost, pl.off, ...rest)
    if (pl.fixKey) this.b.addrFixup(at + 2, pl.fixKey, pl.off, false)
  }

  /** Charge la valeur d'une place ; tableaux → adresse, struct → adresse */
  private load(pl: Place): CType {
    const t = pl.type
    if (t.k === 'array') {
      this.materialize(pl)
      return ptrTo(t.of)
    }
    if (t.k === 'struct') {
      this.materialize(pl)
      return t
    }
    if (pl.bit) {
      const sfr = this.isSfr(pl)
      this.materialize(pl)
      this.b.emit(Op.LDBF, sfr ? C.sfr : C.simple, pl.bit.off, pl.bit.width, pl.bit.signed ? 1 : 0)
      return pl.bit.width < INT_BITS ? T.int : unqual(t)
    }
    const k = kindOf(t)
    const size = kindSize(k)
    const sfr = this.isSfr(pl)
    if (isVolatile(t) && size > 1 && k !== Kind.F32) {
      // Volatile multi-octets : un accès par octet, une interruption peut tomber entre deux (cours p. 37)
      if (pl.mode === 'abs' || pl.mode === 'fp') {
        for (let i = 0; i < size; i++) {
          const sub: Place = { ...pl, off: pl.off + i }
          if (pl.mode === 'abs') this.emitAbs(Op.LDA, this.b.costMem(1, this.isSfr(sub)), sub, Kind.U8)
          else this.b.emit(Op.LDL, C.simple, sub.off, Kind.U8)
          if (i % INFO3.c.sizes.int === 1) this.b.emit(Op.COMB, C.simple, BYTE, size === INFO3.c.sizes.int ? k : Kind.U16)
        }
        if (size === INFO3.c.sizes.long) this.b.emit(Op.COMB, C.simple, INT_BITS, k)
        return unqual(t)
      }
      if (size === INFO3.c.sizes.int) {
        this.b.emit(Op.DUP, C.simple)
        this.b.emit(Op.LD, C.simple, Kind.U8)
        this.b.emit(Op.SWAP, C.simple)
        this.b.emit(Op.PUSH, C.simple, 1)
        this.b.emit(Op.BIN, C.op16, BinOp.ADD, Kind.U16)
        this.b.emit(Op.LD, C.simple, Kind.U8)
        this.b.emit(Op.COMB, C.simple, BYTE, k)
        return unqual(t)
      }
    }
    const cost = this.b.costMem(size, sfr)
    if (pl.mode === 'abs') this.emitAbs(Op.LDA, cost, pl, k)
    else if (pl.mode === 'fp') this.b.emit(Op.LDL, cost, pl.off, k)
    else this.b.emit(Op.LD, cost, k)
    return unqual(t)
  }

  /** Prépare une place pour une écriture dont la valeur sera calculée ensuite */
  private prepareStore(pl: Place): Place {
    if (pl.bit && pl.mode !== 'stack') this.materialize(pl)
    return pl
  }

  /** Écrit la valeur en sommet de pile dans la place (adresse en dessous si mode 'stack') */
  private store(pl: Place, keep: boolean) {
    const t = pl.type
    const keepF = keep ? 1 : 0
    if (pl.bit) {
      this.b.emit(Op.STBF, C.simple, pl.bit.off, pl.bit.width, keepF)
      return
    }
    const k = kindOf(t)
    const size = kindSize(k)
    const sfr = this.isSfr(pl)
    if (isVolatile(t) && size > 1 && k !== Kind.F32 && pl.mode !== 'stack') {
      if (keep) this.b.emit(Op.DUP, C.simple)
      for (let i = 0; i < size; i++) {
        const sub: Place = { ...pl, off: pl.off + i }
        if (i < size - 1) this.b.emit(Op.DUP, C.simple)
        if (pl.mode === 'abs') this.emitAbs(Op.STA, this.b.costMem(1, this.isSfr(sub)), sub, Kind.U8, 0)
        else this.b.emit(Op.STL, C.simple, sub.off, Kind.U8, 0)
        if (i < size - 1) {
          this.b.emit(Op.PUSH, C.simple, BYTE)
          this.b.emit(Op.BIN, C.op16, BinOp.SHR, Kind.U32)
        }
      }
      return
    }
    const cost = this.b.costMem(size, sfr)
    if (pl.mode === 'abs') this.emitAbs(Op.STA, cost, pl, k, keepF)
    else if (pl.mode === 'fp') this.b.emit(Op.STL, cost, pl.off, k, keepF)
    else this.b.emit(Op.ST, cost, k, keepF)
  }

  /** opPos : position de l'opérateur (=, +=, ++), comme Clang */
  private checkModifiable(e: Expr, opPos: SrcPos) {
    this.typeOf(e)
    if (!this.isLvalue(e)) this.fail(opPos, 'expression is not assignable')
    const t = this.typeOf(e)
    if (t.k === 'array') this.fail(e.pos, `array type '${typeName(t)}' is not assignable`)
    if (t.k === 'func') this.fail(opPos, 'expression is not assignable')
    if (isConst(t)) {
      const name = e.k === 'id' ? `variable '${e.name}'` : 'expression'
      this.fail(e.pos, `cannot assign to ${name} with const-qualified type '${typeName(t)}'`)
    }
  }

  private emitAssign(e: Expr & { k: 'assign' }, keep: boolean): CType {
    this.checkModifiable(e.l, e.pos)
    const lt = this.typeOf(e.l)
    if (e.op === '=') {
      if (lt.k === 'struct') {
        const pl = this.emitPlace(e.l)
        this.materialize(pl)
        const rt = this.emitValue(e.r)
        if (rt.k !== 'struct' || rt.s !== lt.s) this.fail(e.r.pos, `assigning to '${typeName(lt)}' from incompatible type '${typeName(rt)}'`)
        this.b.emit(Op.MEMCPY, C.simple * sizeOf(lt), sizeOf(lt))
        if (!keep) this.b.emit(Op.POP, C.simple)
        return unqual(lt)
      }
      const pl = this.prepareStore(this.emitPlace(e.l))
      this.emitValueAs(e.r, lt, 'assigning to')
      this.store(pl, keep)
      return unqual(lt)
    }
    const op = e.op.slice(0, -1)
    const pl = this.emitPlace(e.l)
    let target: Place
    if (pl.bit || pl.mode === 'stack') {
      this.materialize(pl)
      this.b.emit(Op.DUP, C.simple)
      target = { ...pl, mode: 'stack' }
      const loaded: Place = { ...pl, mode: 'stack' }
      this.load(loaded)
    } else {
      target = pl
      this.load({ ...pl })
    }
    const vt = pl.bit && pl.bit.width < INT_BITS ? T.int : unqual(lt)
    const rt = this.valueType(e.r)
    if (vt.k === 'ptr') {
      if ((op !== '+' && op !== '-') || !isInt(rt)) this.fail(e.pos, `invalid operands to binary expression ('${typeName(vt)}' and '${typeName(rt)}')`)
      const it = this.emitValue(e.r)
      this.emitConv(it, promote(it))
      this.emitScale(sizeOf(vt.to))
      this.b.emit(Op.BIN, C.op16, op === '+' ? BinOp.ADD : BinOp.SUB, Kind.U16)
    } else {
      const intOnly = op === '%' || op === '&' || op === '|' || op === '^' || op === '<<' || op === '>>'
      if (intOnly ? !isInt(vt) || !isInt(rt) : !isArith(vt) || !isArith(rt)) this.fail(e.pos, `invalid operands to binary expression ('${typeName(vt)}' and '${typeName(rt)}')`)
      const ct = op === '<<' || op === '>>' ? promote(vt) : usual(vt, rt)
      const k = kindOf(ct)
      this.warnFloat(k, e.pos)
      this.emitConv(vt, ct)
      const c = this.emitValue(e.r)
      this.emitConv(c, op === '<<' || op === '>>' ? promote(c) : ct)
      this.b.emit(Op.BIN, costArith(k), BIN_OPS[op], k)
      this.emitConv(ct, lt)
    }
    this.store(target, keep)
    return unqual(lt)
  }

  private emitIncDec(e: Expr & { k: 'incdec' }, keep: boolean): CType {
    this.checkModifiable(e.e, e.pos)
    const t = this.typeOf(e.e)
    const delta = (t.k === 'ptr' ? sizeOf(t.to) : 1) * (e.inc ? 1 : -1)
    const pl = this.emitPlace(e.e)
    const sfr = this.isSfr(pl)
    this.materialize(pl)
    if (pl.bit) {
      this.b.emit(Op.INCDECBF, sfr ? C.sfr : C.simple, pl.bit.off, pl.bit.width, pl.bit.signed ? 1 : 0, delta, e.post ? 1 : 0, keep ? 1 : 0)
      return T.int
    }
    const k = kindOf(t)
    this.warnFloat(k, e.pos)
    this.b.emit(Op.INCDEC, sfr ? C.sfr : k === Kind.F32 ? C.float : this.b.costMem(kindSize(k), false), k, delta, e.post ? 1 : 0, keep ? 1 : 0)
    return unqual(t)
  }

  /* ───── Appels ───── */

  private emitCall(e: Expr & { k: 'call' }, keep: boolean): CType {
    if (e.f.k === 'id') {
      const name = e.f.name
      if (name in DELAYS) return this.emitDelay(e, name)
      if (name === '__nop') {
        if (e.args.length) this.fail(e.args[0].pos, 'too many arguments to function call, expected 0, have ' + e.args.length)
        this.b.emit(Op.NOP, C.simple)
        return T.void
      }
    }
    const ft = this.calleeType(e)
    const sym = e.f.k === 'id' ? this.lookup(e.f.name) : undefined
    const direct = sym?.k === 'func' ? sym : null
    if (direct?.builtin === 'printf') return this.emitPrintf(e, keep)
    const params = ft.params
    if (params && !ft.variadic && e.args.length !== params.length) {
      if (e.args.length > params.length) this.fail(e.args[params.length].pos, `too many arguments to function call, expected ${params.length}, have ${e.args.length}`)
      this.fail(e.rparen, `too few arguments to function call, expected ${params.length}, have ${e.args.length}`)
    }
    if (params && ft.variadic && e.args.length < params.length) this.fail(e.rparen, `too few arguments to function call, expected at least ${params.length}, have ${e.args.length}`)
    let nargs = e.args.length
    if (!direct) this.emitValue(e.f)
    if (ft.ret.k === 'struct') {
      const tmp = this.allocLocal(sizeOf(ft.ret))
      this.b.emit(Op.LEAL, C.simple, tmp)
      nargs++
    }
    e.args.forEach((a, i) => {
      const pt = params?.[i]
      if (pt) this.emitValueAs(a, pt, 'passing to parameter of type')
      else {
        const at = this.emitValue(a)
        if (isInt(at)) this.emitConv(at, promote(at))
      }
    })
    if (direct) {
      direct.f.usePos ??= e.f.pos
      this.b.emit(Op.CALL, C.call, direct.f.index, nargs)
    } else this.b.emit(Op.CALLI, C.call, nargs)
    if (!keep && ft.ret.k !== 'void') this.b.emit(Op.POP, C.simple)
    return ft.ret
  }

  private emitDelay(e: Expr & { k: 'call' }, name: string): CType {
    const f = e.f as Expr & { k: 'id' }
    if (f.xtal === null || f.xtal === undefined) this.fail(f.pos, `_XTAL_FREQ is not defined: '${name}' requires '#define _XTAL_FREQ <Fosc in Hz>' before use`)
    if (e.args.length !== 1) this.fail(e.rparen, `'${name}' expects 1 argument, have ${e.args.length}`)
    const arg = e.args[0]
    const v = this.constValue(arg)
    if (v === undefined || !isInt(this.valueType(arg))) this.fail(arg.pos, 'inline delay argument must be constant')
    if (v < 0) this.fail(arg.pos, 'inline delay argument must be positive')
    // XC8 : _delay((unsigned long)((x) * (_XTAL_FREQ / 4000.0))) pour __delay_ms
    const tcy = Math.floor((v * f.xtal) / (INFO3.clock.foscPerTcy * DELAYS[name]))
    this.b.emit(Op.DELAY, 0, tcy)
    return T.void
  }

  private emitPrintf(e: Expr & { k: 'call' }, keep: boolean): CType {
    if (e.args.length < 1) this.fail(e.rparen, 'too few arguments to function call, expected at least 1, have 0')
    if (this.fn?.isIsr) this.b.diags.warning(e.f.pos, 'printf in interrupt function (cours p. 36 : à éviter)')
    e.args.forEach((a, i) => {
      const t = this.emitValue(a)
      if (i === 0 && t.k !== 'ptr') this.fail(a.pos, `incompatible integer to pointer conversion passing '${typeName(t)}' to parameter of type 'const char *'`)
      if (isInt(t)) this.emitConv(t, promote(t))
    })
    this.b.emit(Op.PRINTF, C.call, e.args.length)
    const out = this.b.funcIndex(PRINTF_OUT, PRINTF_OUT, { k: 'func', ret: T.int, params: [T.uchar], variadic: false }, e.f.pos, true)
    out.usePos ??= e.f.pos
    this.b.emit(Op.CALL, C.call, out.index, 1)
    if (!keep) this.b.emit(Op.POP, C.simple)
    return T.int
  }
}

interface Leaf {
  off: number
  type: CType
  e?: Expr
  value?: number
  field?: Field
}

/** Une conversion change-t-elle la valeur (troncature, signe, flottant, booléen) ? */
function needsConv(from: Kind, to: Kind): boolean {
  if (from === Kind.F32 || to === Kind.F32 || to === Kind.BOOL) return true
  if (from === Kind.BOOL) return false
  const fs = kindSize(from)
  const ts = kindSize(to)
  const fSigned = from === Kind.S8 || from === Kind.S16 || from === Kind.S32
  const tSigned = to === Kind.S8 || to === Kind.S16 || to === Kind.S32
  if (ts > fs) return fSigned && !tSigned
  if (ts === fs) return fSigned !== tSigned
  return true
}
