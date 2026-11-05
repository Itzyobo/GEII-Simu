/**
 * Préprocesseur C travaillant sur les jetons du lexer (comme les phases 3–4 de la norme) :
 * #include "…" et <…>, #define objet et fonction (# et ##, __VA_ARGS__), #undef,
 * #if/#ifdef/#ifndef/#elif/#else/#endif, #pragma (ignoré), #error, #warning.
 * Les jetons issus d'une macro gardent la position de l'appel (fichier:ligne:colonne).
 */
import { CompileError, type Diagnostics, type SrcPos } from './diagnostics'
import { lex, type Token } from './lexer'

interface Macro {
  name: string
  params: string[] | null
  variadic: boolean
  body: Token[]
  pos: SrcPos
}

interface Cond {
  /** La branche courante est active */
  active: boolean
  /** Une branche a déjà été prise */
  taken: boolean
  /** Le bloc englobant est actif */
  parent: boolean
  pos: SrcPos
  sawElse: boolean
}

export interface PreprocessInput {
  /** Fichiers du projet (chemins relatifs à la racine, séparateur '/') */
  files: Record<string, string>
  /** En-têtes fournis par le simulateur (xc.h, stdint.h…) */
  virtual: Record<string, string>
  diags: Diagnostics
  maxIncludeDepth: number
  /** Macros prédéfinies */
  predefined: Record<string, string>
}

const DELAY_INTRINSICS = new Set(['__delay_ms', '__delay_us'])
const XTAL = '_XTAL_FREQ'

const dirname = (p: string) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '')
function normalizePath(p: string): string {
  const parts: string[] = []
  for (const seg of p.split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') parts.pop()
    else parts.push(seg)
  }
  return parts.join('/')
}

export class Preprocessor {
  private macros = new Map<string, Macro>()
  private out: Token[] = []
  private once = new Set<string>()
  private readonly input: PreprocessInput

  constructor(input: PreprocessInput) {
    this.input = input
    for (const [name, value] of Object.entries(input.predefined)) {
      const body = lex('<built-in>', value)
      body.pop()
      this.macros.set(name, { name, params: null, variadic: false, body, pos: { file: '<built-in>', line: 1, col: 1 } })
    }
  }

  run(entry: string): Token[] {
    const src = this.input.files[entry]
    this.processFile(entry, src, 0)
    const last = this.out[this.out.length - 1]
    const eofPos = last ? last.end : { file: entry, line: 1, col: 1 }
    this.out.push({ kind: 'eof', text: '', pos: eofPos, end: eofPos, bol: true, space: false })
    return this.out
  }

  private resolve(name: string, from: string, angle: boolean): { path: string; src: string } | null {
    const { files, virtual } = this.input
    const candidates = angle ? [] : [normalizePath(`${dirname(from)}/${name}`), normalizePath(name)]
    for (const c of candidates) if (c in files) return { path: c, src: files[c] }
    if (name in virtual) return { path: name, src: virtual[name] }
    if (angle && normalizePath(name) in files) return { path: normalizePath(name), src: files[normalizePath(name)] }
    return null
  }

  private processFile(name: string, src: string, depth: number) {
    const tokens = lex(name, src)
    const conds: Cond[] = []
    let pending: Token[] = []
    const active = () => conds.length === 0 || conds[conds.length - 1].active
    const flush = () => {
      if (pending.length) {
        for (const t of this.expand(pending)) this.out.push(t)
        pending = []
      }
    }
    let i = 0
    while (tokens[i].kind !== 'eof') {
      const start = i
      i++
      while (tokens[i].kind !== 'eof' && !tokens[i].bol) i++
      const line = tokens.slice(start, i)
      if (line[0].kind === 'punct' && line[0].text === '#') {
        flush()
        this.directive(line, conds, active, name, depth)
      } else if (active()) {
        const bad = line.find((t) => t.kind === 'bad')
        if (bad) throw new CompileError(bad.pos, bad.msg ?? 'invalid token')
        pending.push(...line)
      }
    }
    flush()
    if (conds.length) throw new CompileError(conds[conds.length - 1].pos, 'unterminated conditional directive')
  }

  private directive(line: Token[], conds: Cond[], active: () => boolean, file: string, depth: number) {
    if (line.length === 1) return
    const d = line[1]
    const kw = d.text
    const rest = line.slice(2)
    // Directives conditionnelles : traitées même dans un bloc inactif
    switch (kw) {
      case 'ifdef':
      case 'ifndef': {
        const parent = active()
        const nameTok = rest[0]
        if (parent && (!nameTok || nameTok.kind !== 'id')) throw new CompileError(d.pos, 'macro name missing')
        const def = !!nameTok && this.macros.has(nameTok.text)
        const v = parent && (kw === 'ifdef' ? def : !def)
        conds.push({ active: v, taken: v, parent, pos: line[0].pos, sawElse: false })
        return
      }
      case 'if': {
        const parent = active()
        const v = parent && this.evalCondition(rest, d.pos) !== 0
        conds.push({ active: v, taken: v, parent, pos: line[0].pos, sawElse: false })
        return
      }
      case 'elif': {
        const c = conds[conds.length - 1]
        if (!c) throw new CompileError(line[0].pos, '#elif without #if')
        if (c.sawElse) throw new CompileError(line[0].pos, '#elif after #else')
        if (!c.parent || c.taken) c.active = false
        else {
          c.active = this.evalCondition(rest, d.pos) !== 0
          c.taken = c.active
        }
        return
      }
      case 'else': {
        const c = conds[conds.length - 1]
        if (!c) throw new CompileError(line[0].pos, '#else without #if')
        if (c.sawElse) throw new CompileError(line[0].pos, '#else after #else')
        c.sawElse = true
        c.active = c.parent && !c.taken
        c.taken = true
        return
      }
      case 'endif':
        if (!conds.length) throw new CompileError(line[0].pos, '#endif without #if')
        conds.pop()
        return
    }
    if (!active()) return
    const bad = kw === 'error' || kw === 'warning' ? undefined : rest.find((t) => t.kind === 'bad')
    if (bad) throw new CompileError(bad.pos, bad.msg ?? 'invalid token')
    switch (kw) {
      case 'include': {
        let target: string
        let angle = false
        const t0 = rest[0]
        if (t0?.kind === 'str') target = t0.text.slice(1, -1)
        else if (t0?.text === '<') {
          angle = true
          const close = rest.findIndex((t) => t.text === '>')
          if (close < 0) throw new CompileError(t0.pos, "expected '>'")
          target = rest
            .slice(1, close)
            .map((t) => t.text)
            .join('')
        } else throw new CompileError(d.pos, 'expected "FILENAME" or <FILENAME>')
        const found = this.resolve(target, file, angle)
        if (!found) throw new CompileError(t0.pos, `'${target}' file not found`)
        if (this.once.has(found.path)) return
        if (depth + 1 > this.input.maxIncludeDepth) throw new CompileError(d.pos, '#include nested too deeply')
        this.processFile(found.path, found.src, depth + 1)
        return
      }
      case 'define':
        this.define(rest, d.pos)
        return
      case 'undef':
        if (rest[0]?.kind !== 'id') throw new CompileError(d.pos, 'macro name missing')
        this.macros.delete(rest[0].text)
        return
      case 'pragma':
        if (rest[0]?.text === 'once') this.once.add(file)
        else if (rest[0]?.text === 'config') this.pragmaConfig(rest.slice(1), d.pos)
        return
      case 'error':
        this.input.diags.error(d.pos, rest.map((t) => t.text).join(' ') || '#error')
        return
      case 'warning':
        this.input.diags.warning(d.pos, rest.map((t) => t.text).join(' ') || '#warning')
        return
      case 'line':
        return
      default:
        throw new CompileError(d.pos, 'invalid preprocessing directive')
    }
  }

  /** Bits de configuration lus dans les `#pragma config NOM = VALEUR[, NOM = VALEUR…]` */
  readonly config: Record<string, string> = {}

  private pragmaConfig(tokens: Token[], pos: SrcPos) {
    let i = 0
    while (i < tokens.length) {
      const name = tokens[i]
      const eq = tokens[i + 1]
      const value = tokens[i + 2]
      if (!name || name.kind !== 'id' || eq?.text !== '=' || !value || (value.kind !== 'id' && value.kind !== 'num')) {
        throw new CompileError(name?.pos ?? pos, "malformed '#pragma config': expected 'SETTING = VALUE'")
      }
      this.config[name.text] = value.text
      i += 3
      if (tokens[i]?.text === ',') i++
    }
  }

  private define(rest: Token[], pos: SrcPos) {
    const nameTok = rest[0]
    if (!nameTok || nameTok.kind !== 'id') throw new CompileError(pos, 'macro name must be an identifier')
    let params: string[] | null = null
    let variadic = false
    let bodyStart = 1
    if (rest[1]?.text === '(' && !rest[1].space) {
      params = []
      let j = 2
      if (rest[j]?.text === ')') j++
      else
        for (;;) {
          const t = rest[j]
          if (!t) throw new CompileError(nameTok.pos, "missing ')' in macro parameter list")
          if (t.text === '...') {
            variadic = true
            params.push('__VA_ARGS__')
            j++
          } else if (t.kind === 'id') {
            params.push(t.text)
            j++
          } else throw new CompileError(t.pos, 'invalid token in macro parameter list')
          if (rest[j]?.text === ',') {
            j++
            continue
          }
          if (rest[j]?.text === ')') {
            j++
            break
          }
          throw new CompileError(rest[j]?.pos ?? nameTok.pos, "expected ',' or ')' in macro parameter list")
        }
      bodyStart = j
    }
    const body = rest.slice(bodyStart)
    const prev = this.macros.get(nameTok.text)
    if (prev && prev.body.map((t) => t.text).join(' ') !== body.map((t) => t.text).join(' ')) {
      this.input.diags.warning(nameTok.pos, `'${nameTok.text}' macro redefined`)
    }
    this.macros.set(nameTok.text, { name: nameTok.text, params, variadic, body, pos: nameTok.pos })
  }

  /** Valeur de _XTAL_FREQ au point courant (null = non définie) */
  private xtal(): number | null {
    const m = this.macros.get(XTAL)
    if (!m || m.params) return null
    try {
      return evalExpr(this.expand(m.body.map((t) => ({ ...t, bol: false }))), m.pos, false)
    } catch {
      return null
    }
  }

  private evalCondition(tokens: Token[], pos: SrcPos): number {
    // Remplace defined X / defined(X) avant l'expansion
    const pre: Token[] = []
    for (let j = 0; j < tokens.length; j++) {
      const t = tokens[j]
      if (t.kind === 'id' && t.text === 'defined') {
        let nameTok = tokens[j + 1]
        let skip = 1
        if (nameTok?.text === '(') {
          nameTok = tokens[j + 2]
          if (tokens[j + 3]?.text !== ')') throw new CompileError(t.pos, "missing ')' after 'defined'")
          skip = 3
        }
        if (!nameTok || nameTok.kind !== 'id') throw new CompileError(t.pos, 'macro name missing')
        pre.push({ ...t, kind: 'num', text: this.macros.has(nameTok.text) ? '1' : '0', value: this.macros.has(nameTok.text) ? 1 : 0 })
        j += skip
      } else pre.push(t)
    }
    const expanded = this.expand(pre)
    if (!expanded.length) throw new CompileError(pos, '#if with no expression')
    return evalExpr(expanded, pos, true)
  }

  private substituteBuiltins(t: Token): Token | null {
    if (t.text === '__LINE__') return { ...t, kind: 'num', text: String(t.pos.line), value: t.pos.line }
    if (t.text === '__FILE__') {
      const s = t.pos.file
      return { ...t, kind: 'str', text: JSON.stringify(s), str: [...s].map((ch) => ch.charCodeAt(0)) }
    }
    return null
  }

  /** Expansion complète d'une suite de jetons */
  expand(input: Token[]): Token[] {
    const stack = input.slice().reverse()
    const out: Token[] = []
    while (stack.length) {
      let t = stack.pop()!
      if (t.kind !== 'id') {
        out.push(t)
        continue
      }
      const builtin = this.substituteBuiltins(t)
      if (builtin) {
        out.push(builtin)
        continue
      }
      const m = this.macros.get(t.text)
      if (!m || t.hide?.has(t.text)) {
        if (DELAY_INTRINSICS.has(t.text)) t = { ...t, xtal: this.xtal() }
        out.push(t)
        continue
      }
      const hs = new Set(t.hide ?? [])
      hs.add(m.name)
      if (m.params === null) {
        const body = this.paste(m.body.map((b, k) => this.relocate(b, t, hs, k === 0)))
        for (let k = body.length - 1; k >= 0; k--) stack.push(body[k])
        continue
      }
      const next = stack[stack.length - 1]
      if (!next || next.text !== '(' || next.kind !== 'punct') {
        out.push(t)
        continue
      }
      stack.pop()
      const args: Token[][] = [[]]
      let depth = 0
      for (;;) {
        const a = stack.pop()
        if (!a) throw new CompileError(t.pos, 'unterminated function-like macro invocation')
        if (a.kind === 'punct' && a.text === '(') depth++
        else if (a.kind === 'punct' && a.text === ')') {
          if (depth === 0) break
          depth--
        } else if (a.kind === 'punct' && a.text === ',' && depth === 0 && !(m.variadic && args.length >= m.params.length)) {
          args.push([])
          continue
        }
        args[args.length - 1].push(a)
      }
      const nArgs = m.params.length === 0 && args.length === 1 && args[0].length === 0 ? 0 : args.length
      if (m.variadic && nArgs === m.params.length - 1) args.push([])
      else if (nArgs !== m.params.length) {
        throw new CompileError(t.pos, `${nArgs > m.params.length ? 'too many' : 'too few'} arguments provided to function-like macro invocation '${m.name}'`)
      }
      const result: Token[] = []
      const body = m.body
      for (let k = 0; k < body.length; k++) {
        const b = body[k]
        const pIdx = b.kind === 'id' ? m.params.indexOf(b.text) : -1
        if (b.kind === 'punct' && b.text === '#' && body[k + 1]?.kind === 'id' && m.params.includes(body[k + 1].text)) {
          const arg = args[m.params.indexOf(body[k + 1].text)]
          const text = arg.map((a, ai) => (ai > 0 && a.space ? ' ' : '') + a.text).join('')
          result.push({ ...t, kind: 'str', text: JSON.stringify(text), str: [...text].map((ch) => ch.charCodeAt(0)), hide: hs, bol: false })
          k++
          continue
        }
        if (pIdx >= 0) {
          const adjPaste = body[k - 1]?.text === '##' || body[k + 1]?.text === '##'
          const arg = adjPaste ? args[pIdx] : this.expand(args[pIdx])
          arg.forEach((a, ai) => result.push({ ...a, pos: t.pos, end: t.end, bol: false, space: ai === 0 ? b.space : a.space, hide: union(a.hide, hs) }))
          if (arg.length === 0 && adjPaste) result.push({ ...t, kind: 'punct', text: '', hide: hs, bol: false })
          continue
        }
        result.push(this.relocate(b, t, hs, k === 0))
      }
      const pasted = this.paste(result).filter((r) => !(r.kind === 'punct' && r.text === ''))
      for (let k = pasted.length - 1; k >= 0; k--) stack.push(pasted[k])
    }
    return out
  }

  private relocate(b: Token, call: Token, hs: Set<string>, first: boolean): Token {
    return { ...b, pos: call.pos, end: call.end, bol: false, space: first ? call.space : b.space, hide: union(b.hide, hs) }
  }

  private paste(tokens: Token[]): Token[] {
    if (!tokens.some((t) => t.kind === 'punct' && t.text === '##')) return tokens
    const out: Token[] = []
    for (let k = 0; k < tokens.length; k++) {
      const t = tokens[k]
      if (t.kind === 'punct' && t.text === '##') {
        const left = out.pop()
        const right = tokens[k + 1]
        k++
        if (!left) {
          if (right) out.push(right)
          continue
        }
        if (!right) {
          out.push(left)
          continue
        }
        const text = left.text + right.text
        if (text === '') {
          out.push({ ...left, text: '' })
          continue
        }
        const relexed = lex(left.pos.file, text)
        relexed.pop()
        if (relexed.length !== 1) throw new CompileError(left.pos, `pasting formed '${text}', an invalid preprocessing token`)
        out.push({ ...relexed[0], pos: left.pos, end: left.end, bol: false, space: left.space, hide: left.hide })
      } else out.push(t)
    }
    return out
  }
}

function union(a: Set<string> | undefined, b: Set<string>): Set<string> {
  if (!a || a.size === 0) return b
  const s = new Set(a)
  for (const x of b) s.add(x)
  return s
}

/**
 * Évalue une expression constante du préprocesseur (#if, _XTAL_FREQ).
 * `integer` : division entière et identifiants restants = 0 (règle de #if).
 */
export function evalExpr(tokens: Token[], pos: SrcPos, integer: boolean): number {
  let i = 0
  const peek = () => tokens[i]
  const fail = (t?: Token): never => {
    throw new CompileError(t?.pos ?? pos, t ? `invalid token at start of a preprocessor expression` : 'expected value in expression')
  }
  const primary = (): number => {
    const t = tokens[i++]
    if (!t) return fail()
    if (t.kind === 'num' || t.kind === 'char') return t.value ?? 0
    if (t.kind === 'id') {
      if (integer) return 0
      throw new CompileError(t.pos, `use of undeclared identifier '${t.text}'`)
    }
    if (t.text === '(') {
      const v = ternary()
      if (peek()?.text !== ')') throw new CompileError(peek()?.pos ?? t.pos, "expected ')'")
      i++
      return v
    }
    if (t.text === '!') return primary() === 0 ? 1 : 0
    if (t.text === '~') return ~primary()
    if (t.text === '-') return -primary()
    if (t.text === '+') return primary()
    return fail(t)
  }
  const PREC: Record<string, number> = { '*': 10, '/': 10, '%': 10, '+': 9, '-': 9, '<<': 8, '>>': 8, '<': 7, '>': 7, '<=': 7, '>=': 7, '==': 6, '!=': 6, '&': 5, '^': 4, '|': 3, '&&': 2, '||': 1 }
  const binary = (minPrec: number): number => {
    let l = primary()
    for (;;) {
      const op = peek()
      const p = op && op.kind === 'punct' ? PREC[op.text] : undefined
      if (p === undefined || p < minPrec) return l
      i++
      const r = binary(p + 1)
      switch (op.text) {
        case '*': l = l * r; break
        case '/': if (r === 0) throw new CompileError(op.pos, 'division by zero in preprocessor expression'); l = integer ? Math.trunc(l / r) : l / r; break
        case '%': if (r === 0) throw new CompileError(op.pos, 'division by zero in preprocessor expression'); l = l % r; break
        case '+': l = l + r; break
        case '-': l = l - r; break
        case '<<': l = l << r; break
        case '>>': l = l >> r; break
        case '<': l = +(l < r); break
        case '>': l = +(l > r); break
        case '<=': l = +(l <= r); break
        case '>=': l = +(l >= r); break
        case '==': l = +(l === r); break
        case '!=': l = +(l !== r); break
        case '&': l = l & r; break
        case '^': l = l ^ r; break
        case '|': l = l | r; break
        case '&&': l = +(l !== 0 && r !== 0); break
        case '||': l = +(l !== 0 || r !== 0); break
      }
    }
  }
  const ternary = (): number => {
    const c = binary(1)
    if (peek()?.text === '?') {
      i++
      const a = ternary()
      if (peek()?.text !== ':') throw new CompileError(peek()?.pos ?? pos, "expected ':'")
      i++
      const b = ternary()
      return c !== 0 ? a : b
    }
    return c
  }
  const v = ternary()
  if (i < tokens.length) throw new CompileError(tokens[i].pos, 'token is not a valid binary operator in a preprocessor subexpression')
  return v
}
