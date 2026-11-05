/**
 * Mode C léger pour CodeMirror (StreamLanguage de @codemirror/language) : mots-clés, types, commentaires,
 * chaînes, nombres, directives du préprocesseur, indentation par accolades (Source > Format).
 * Remplace @codemirror/lang-cpp (grammaire C++ complète, ≈ 31 Ko gzip) pour tenir le budget de 120 Ko gzip.
 */
import { StreamLanguage, type StreamParser } from '@codemirror/language'

const KEYWORDS = new Set('auto break case const continue default do else enum extern for goto if inline register return sizeof static struct switch typedef union volatile while __interrupt __at'.split(' '))
const TYPES = new Set('void char short int long float double signed unsigned _Bool bool __bit uint8_t uint16_t uint32_t int8_t int16_t int32_t size_t'.split(' '))
const ATOMS = new Set(['true', 'false', 'NULL'])

interface CState {
  /** Dans un commentaire bloc */
  comment: boolean
  /** Profondeur d'accolades au début de la ligne suivante */
  depth: number
  /** Ligne de préprocesseur en cours (jusqu'à la fin de ligne) */
  pp: boolean
}

const parser: StreamParser<CState> = {
  name: 'c',
  startState: () => ({ comment: false, depth: 0, pp: false }),
  copyState: (s) => ({ ...s }),
  token(stream, state) {
    if (stream.sol()) state.pp = false
    if (state.comment) {
      if (stream.skipTo('*/')) {
        stream.next()
        stream.next()
        state.comment = false
      } else stream.skipToEnd()
      return 'comment'
    }
    if (stream.eatSpace()) return null
    if (stream.match('//')) {
      stream.skipToEnd()
      return 'comment'
    }
    if (stream.match('/*')) {
      state.comment = true
      return 'comment'
    }
    if (stream.sol() || state.pp) {
      if (stream.peek() === '#') {
        state.pp = true
        stream.next()
        stream.eatWhile(/\w/)
        return 'processingInstruction'
      }
    }
    const ch = stream.peek()!
    if (ch === '"' || ch === "'") {
      stream.next()
      let esc = false
      for (;;) {
        const c = stream.next()
        if (c === undefined) break
        if (c === ch && !esc) break
        esc = !esc && c === '\\'
      }
      return state.pp && ch === '"' ? 'processingInstruction' : 'string'
    }
    if (state.pp && ch === '<' && stream.match(/^<[\w./]+>/)) return 'processingInstruction'
    if (stream.match(/^(0[xX][0-9a-fA-F]+|0[bB][01]+|\d+\.?\d*([eE][+-]?\d+)?)[uUlLfF]*/)) return 'number'
    if (stream.match(/^[A-Za-z_]\w*/)) {
      const w = stream.current()
      if (KEYWORDS.has(w)) return 'keyword'
      if (TYPES.has(w)) return 'typeName'
      if (ATOMS.has(w)) return 'atom'
      return state.pp ? 'macroName' : 'variableName'
    }
    stream.next()
    if (ch === '{') state.depth++
    else if (ch === '}') state.depth = Math.max(0, state.depth - 1)
    return null
  },
  indent(state, textAfter, cx) {
    if (state.comment) return null
    const closing = /^\s*}/.test(textAfter) ? 1 : 0
    return Math.max(0, state.depth - closing) * cx.unit
  },
  languageData: { commentTokens: { line: '//', block: { open: '/*', close: '*/' } } },
}

export const cLanguage = StreamLanguage.define(parser)

/** Unité d'indentation de MPLAB X : 4 espaces */
export const INDENT = '    '
