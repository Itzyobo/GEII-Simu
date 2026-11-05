/** Diagnostics au format XC8 v2 (front-end Clang) : `main.c:12:5: error: …` (texte approché, H15). */

export interface SrcPos {
  file: string
  line: number
  col: number
}

export type Severity = 'error' | 'warning'

export interface Diagnostic {
  severity: Severity
  file: string
  line: number
  col: number
  message: string
}

export const formatDiagnostic = (d: Diagnostic) => `${d.file}:${d.line}:${d.col}: ${d.severity}: ${d.message}`

export class CompileError extends Error {
  readonly pos: SrcPos
  constructor(pos: SrcPos, message: string) {
    super(message)
    this.pos = pos
  }
}

export class Diagnostics {
  readonly list: Diagnostic[] = []
  error(pos: SrcPos, message: string) {
    this.list.push({ severity: 'error', file: pos.file, line: pos.line, col: pos.col, message })
  }
  warning(pos: SrcPos, message: string) {
    this.list.push({ severity: 'warning', file: pos.file, line: pos.line, col: pos.col, message })
  }
  get hasErrors() {
    return this.list.some((d) => d.severity === 'error')
  }
}
