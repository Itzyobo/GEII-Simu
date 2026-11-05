/** Analyse lexicale : découpe un fichier C en jetons de prétraitement, positions fichier:ligne:colonne conservées. */
import { CompileError, type SrcPos } from './diagnostics'

/** 'bad' : jeton invalide, signalé seulement s'il atteint du code actif (pas dans un #if 0) */
export type TokKind = 'id' | 'num' | 'char' | 'str' | 'punct' | 'eof' | 'bad'

export interface Token {
  kind: TokKind
  text: string
  pos: SrcPos
  /** Position juste après le jeton (pour « expected ';' ») */
  end: SrcPos
  /** Premier jeton de sa ligne logique */
  bol: boolean
  /** Précédé d'un espace */
  space: boolean
  /** Valeur des littéraux numériques et caractères */
  value?: number
  isFloat?: boolean
  unsigned?: boolean
  long?: boolean
  /** Octets d'une chaîne (sans le zéro final) */
  str?: number[]
  /** Préprocesseur : macros à ne pas ré-expandre */
  hide?: Set<string>
  /** Message d'erreur d'un jeton 'bad' */
  msg?: string
  /** __delay_ms / __delay_us : valeur de _XTAL_FREQ au point d'appel (null = non défini) */
  xtal?: number | null
}

const PUNCTS = [
  '...', '<<=', '>>=',
  '->', '++', '--', '<<', '>>', '<=', '>=', '==', '!=', '&&', '||', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '##',
  '+', '-', '*', '/', '%', '&', '|', '^', '~', '!', '<', '>', '=', '?', ':', ';', ',', '.', '(', ')', '[', ']', '{', '}', '#',
]

// Bases et codes des séquences d'échappement : syntaxe du langage C
const HEX = 16
const OCT = 8
const BIN = 2
const DEC = 10
const ESCAPES: Record<string, number> = { n: 0x0a, t: 0x09, r: 0x0d, '0': 0x00, a: 0x07, b: 0x08, f: 0x0c, v: 0x0b, '\\': 0x5c, "'": 0x27, '"': 0x22, '?': 0x3f }

const isIdStart = (c: string) => /[A-Za-z_]/.test(c)
const isIdChar = (c: string) => /[A-Za-z0-9_]/.test(c)
const isDigit = (c: string) => c >= '0' && c <= '9'

export function lex(file: string, src: string): Token[] {
  const out: Token[] = []
  let i = 0
  let line = 1
  let col = 1
  let bol = true
  let space = false
  const n = src.length
  const pos = (): SrcPos => ({ file, line, col })
  const adv = (k = 1) => {
    for (let j = 0; j < k; j++) {
      if (src[i] === '\n') {
        line++
        col = 1
      } else col++
      i++
    }
  }
  /** Saute les fins de ligne échappées (\ suivi d'un saut de ligne) */
  const splice = () => {
    while (src[i] === '\\' && (src[i + 1] === '\n' || (src[i + 1] === '\r' && src[i + 2] === '\n'))) {
      adv(src[i + 1] === '\r' ? 3 : 2)
      space = true
    }
  }
  const push = (t: Omit<Token, 'bol' | 'space' | 'end'>) => {
    out.push({ ...t, bol, space, end: pos() })
    bol = false
    space = false
  }
  const readEscape = (): number => {
    // src[i] est juste après le '\'
    const c = src[i]
    if (c === 'x') {
      adv()
      let s = ''
      while (/[0-9a-fA-F]/.test(src[i] ?? '')) {
        s += src[i]
        adv()
      }
      return parseInt(s || '0', HEX)
    }
    if (c >= '0' && c <= '7') {
      let s = ''
      while (s.length < 3 && src[i] >= '0' && src[i] <= '7') {
        s += src[i]
        adv()
      }
      return parseInt(s, OCT)
    }
    adv()
    return ESCAPES[c] ?? c.charCodeAt(0)
  }

  while (i < n) {
    splice()
    if (i >= n) break
    const c = src[i]
    if (c === '\n') {
      adv()
      bol = true
      space = false
      continue
    }
    if (c === ' ' || c === '\t' || c === '\r' || c === '\f' || c === '\v') {
      adv()
      space = true
      continue
    }
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') {
        if (src[i] === '\\' && src[i + 1] === '\n') adv()
        adv()
      }
      space = true
      continue
    }
    if (c === '/' && src[i + 1] === '*') {
      const start = pos()
      adv(2)
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) adv()
      if (i >= n) throw new CompileError(start, 'unterminated /* comment')
      adv(2)
      space = true
      continue
    }
    const p = pos()
    if (isIdStart(c)) {
      let s = ''
      while (i < n && (isIdChar(src[i]) || (src[i] === '\\' && src[i + 1] === '\n'))) {
        if (src[i] === '\\') {
          adv(2)
          continue
        }
        s += src[i]
        adv()
      }
      push({ kind: 'id', text: s, pos: p })
      continue
    }
    if (isDigit(c) || (c === '.' && isDigit(src[i + 1] ?? ''))) {
      let s = ''
      while (i < n && (isIdChar(src[i]) || src[i] === '.' || ((src[i] === '+' || src[i] === '-') && /[eEpP]/.test(s[s.length - 1] ?? '') && !/^0[xX]/.test(s)))) {
        s += src[i]
        adv()
      }
      push({ kind: 'num', text: s, pos: p, ...parseNumber(s, p) })
      continue
    }
    if (c === "'") {
      const si = i
      adv()
      let v = 0
      if (src[i] === '\\') {
        adv()
        v = readEscape()
      } else {
        v = src.charCodeAt(i)
        adv()
      }
      if (src[i] !== "'") {
        while (i < n && src[i] !== '\n') adv()
        push({ kind: 'bad', text: "'", pos: p, msg: "missing terminating ' character" })
        continue
      }
      adv()
      push({ kind: 'char', text: src.slice(si, i), pos: p, value: v })
      continue
    }
    if (c === '"') {
      adv()
      const bytes: number[] = []
      let raw = '"'
      while (i < n && src[i] !== '"') {
        if (src[i] === '\n') break
        if (src[i] === '\\') {
          if (src[i + 1] === '\n') {
            adv(2)
            continue
          }
          raw += src[i] + src[i + 1]
          adv()
          bytes.push(readEscape())
        } else {
          raw += src[i]
          bytes.push(src.charCodeAt(i))
          adv()
        }
      }
      if (i >= n || src[i] !== '"') {
        push({ kind: 'bad', text: raw, pos: p, msg: 'missing terminating \'"\' character' })
        continue
      }
      adv()
      push({ kind: 'str', text: raw + '"', pos: p, str: bytes })
      continue
    }
    const pu = PUNCTS.find((q) => src.startsWith(q, i))
    if (!pu) {
      adv()
      push({ kind: 'bad', text: c, pos: p, msg: `invalid character '${c}' in source file` })
      continue
    }
    adv(pu.length)
    push({ kind: 'punct', text: pu, pos: p })
  }
  out.push({ kind: 'eof', text: '', pos: pos(), end: pos(), bol: true, space: false })
  return out
}

export function parseNumber(s: string, p: SrcPos): Pick<Token, 'value' | 'isFloat' | 'unsigned' | 'long'> {
  const low = s.toLowerCase()
  const isHex = low.startsWith('0x')
  const isBin = low.startsWith('0b')
  if (!isHex && !isBin && (/[.e]/.test(low))) {
    const m = /^([0-9]*\.?[0-9]*(?:e[+-]?[0-9]+)?)(f|l)?$/.exec(low)
    if (!m) throw new CompileError(p, `invalid floating constant '${s}'`)
    return { value: Math.fround(parseFloat(m[1])), isFloat: true }
  }
  const m = /^(0x[0-9a-f]+|0b[01]+|[0-9]+)(u|ul|lu|l|ull|llu|ll)?$/.exec(low)
  if (!m) throw new CompileError(p, `invalid digit in integer constant '${s}'`)
  const body = m[1]
  const suf = m[2] ?? ''
  let value: number
  if (isHex) value = parseInt(body.slice(2), HEX)
  else if (isBin) value = parseInt(body.slice(2), BIN)
  else if (body.length > 1 && body.startsWith('0')) {
    if (/[89]/.test(body)) throw new CompileError(p, `invalid digit in octal constant '${s}'`)
    value = parseInt(body, OCT)
  } else value = parseInt(body, DEC)
  return { value, unsigned: suf.includes('u'), long: suf.includes('l') }
}
