/** Mise en forme de printf (%d %i %u %x %X %c %s %ld %lu %f %%, drapeaux, largeur, précision). */
import { INFO3 } from '../../data/reference'
import { Kind, norm } from '../compiler/arith'

const HEX = 16
const PERCENT = 0x25

export function formatPrintf(fmt: number[], args: number[], readString: (addr: number) => number[]): number[] {
  const out: number[] = []
  let ai = 0
  const nextArg = () => (ai < args.length ? args[ai++] : 0)
  const pushStr = (s: string) => {
    for (const ch of s) out.push(ch.charCodeAt(0) & ((1 << INFO3.c.bitsPerByte) - 1))
  }
  let i = 0
  while (i < fmt.length) {
    const c = fmt[i++]
    if (c !== PERCENT) {
      out.push(c)
      continue
    }
    // %[drapeaux][largeur][.précision][longueur]conversion
    let spec = ''
    while (i < fmt.length && '-+ 0#'.includes(String.fromCharCode(fmt[i]))) spec += String.fromCharCode(fmt[i++])
    const flags = spec
    let width = ''
    if (String.fromCharCode(fmt[i]) === '*') {
      width = String(nextArg())
      i++
    } else while (i < fmt.length && /[0-9]/.test(String.fromCharCode(fmt[i]))) width += String.fromCharCode(fmt[i++])
    let prec: number | null = null
    if (String.fromCharCode(fmt[i]) === '.') {
      i++
      let p = ''
      while (i < fmt.length && /[0-9]/.test(String.fromCharCode(fmt[i]))) p += String.fromCharCode(fmt[i++])
      prec = p === '' ? 0 : Number(p)
    }
    let long = false
    while (i < fmt.length && 'lhz'.includes(String.fromCharCode(fmt[i]))) {
      if (String.fromCharCode(fmt[i]) === 'l') long = true
      i++
    }
    const conv = String.fromCharCode(fmt[i++] ?? 0)
    let body: string
    switch (conv) {
      case 'd':
      case 'i': {
        const v = norm(long ? Kind.S32 : Kind.S16, Math.trunc(nextArg()))
        body = String(Math.abs(v))
        if (prec !== null) body = body.padStart(prec, '0')
        body = (v < 0 ? '-' : flags.includes('+') ? '+' : flags.includes(' ') ? ' ' : '') + body
        break
      }
      case 'u':
        body = String(norm(long ? Kind.U32 : Kind.U16, Math.trunc(nextArg())))
        if (prec !== null) body = body.padStart(prec, '0')
        break
      case 'x':
      case 'X': {
        body = norm(long ? Kind.U32 : Kind.U16, Math.trunc(nextArg())).toString(HEX)
        if (prec !== null) body = body.padStart(prec, '0')
        if (conv === 'X') body = body.toUpperCase()
        if (flags.includes('#') && body !== '0') body = (conv === 'X' ? '0X' : '0x') + body
        break
      }
      case 'c':
        body = String.fromCharCode(norm(Kind.U8, nextArg()))
        break
      case 's': {
        let s = readString(nextArg()).map((b) => String.fromCharCode(b)).join('')
        if (prec !== null) s = s.slice(0, prec)
        body = s
        break
      }
      case 'f':
      case 'F': {
        const v = nextArg()
        body = v.toFixed(prec ?? INFO3.c.printfFloatPrecision)
        if (v >= 0 && flags.includes('+')) body = '+' + body
        break
      }
      case '%':
        body = '%'
        break
      default:
        body = '%' + flags + width + conv
    }
    const w = width === '' ? 0 : Number(width)
    if (body.length < w) {
      if (flags.includes('-')) body = body.padEnd(w, ' ')
      else if (flags.includes('0') && conv !== 's' && conv !== 'c') {
        const sign = /^[+\- ]/.test(body) ? body[0] : ''
        body = sign + body.slice(sign.length).padStart(w - sign.length, '0')
      } else body = body.padStart(w, ' ')
    }
    pushStr(body)
  }
  return out
}
