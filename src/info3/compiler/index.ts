/**
 * Compilateur C INFO3 : préprocesseur → lexer → parser + types → bytecode, puis liaison.
 * `compile(files)` compile chaque fichier .c du projet (unités séparées) et l'unité d'exécution.
 */
import { INFO3 } from '../../data/reference'
import type { Program } from './bytecode'
import { UnitCompiler } from './cc'
import { CompileError, Diagnostics, formatDiagnostic, type Diagnostic } from './diagnostics'
import { ProgramBuilder } from './emitter'
import { RUNTIME_FILE, runtimeSource, virtualHeaders } from './headers'
import { Preprocessor } from './preprocessor'

export interface CompileResult {
  ok: boolean
  program: Program | null
  diagnostics: Diagnostic[]
}

const PREDEFINED: Record<string, string> = {
  __XC8: '1',
  __XC: '1',
  _16F18875: '1',
  __STDC__: '1',
  __STDC_VERSION__: '199901L',
  __XC8_VERSION: String(INFO3.c.xc8Version),
}

let headersCache: Record<string, string> | null = null

/**
 * @param files fichiers du projet (chemin → source), par exemple `main.c`,
 *   `mcc_generated_files/mcc.h`… Les fichiers `.c` sont compilés dans l'ordre donné.
 */
export function compile(files: Record<string, string>): CompileResult {
  const diags = new Diagnostics()
  headersCache ??= virtualHeaders()
  const virtual = headersCache
  const virtualSet = new Set(Object.keys(virtual))
  const builder = new ProgramBuilder(diags)
  const units = Object.keys(files).filter((f) => f.endsWith('.c'))
  const all = { ...files, [RUNTIME_FILE]: runtimeSource() }
  const firstPos = { file: units[0] ?? 'main.c', line: 1, col: 1 }
  if (units.length === 0) {
    diags.error(firstPos, 'no source file (.c) in project')
    return { ok: false, program: null, diagnostics: diags.list }
  }
  // Bits de configuration (#pragma config) réunis sur tout le projet, transmis à la VM (STVREN…)
  const config: Record<string, string> = {}
  for (const unit of [...units, RUNTIME_FILE]) {
    try {
      const pp = new Preprocessor({ files: all, virtual, diags, maxIncludeDepth: INFO3.c.maxIncludeDepth, predefined: PREDEFINED })
      const tokens = pp.run(unit)
      Object.assign(config, pp.config)
      new UnitCompiler(tokens, builder, unit, virtualSet).compileUnit()
    } catch (err) {
      if (err instanceof CompileError) diags.error(err.pos, err.message)
      else diags.error({ file: unit, line: 1, col: 1 }, `internal compiler error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  if (diags.hasErrors) return { ok: false, program: null, diagnostics: diags.list }
  const program = builder.link(firstPos)
  if (program) program.config = config
  return { ok: !!program && !diags.hasErrors, program, diagnostics: diags.list }
}

export { formatDiagnostic }
export type { Diagnostic, Program }
