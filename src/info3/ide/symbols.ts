/**
 * Symboles du projet pour l'IDE : complétion (Ctrl+Espace) et « aller à la définition » (Ctrl+clic).
 * Analyse textuelle légère des fichiers (macros, fonctions, variables globales), sans compiler.
 */

export interface SymbolDef {
  name: string
  kind: 'macro' | 'function' | 'variable'
  file: string
  line: number
  col: number
  /** Texte de la définition (infobulle de complétion) */
  detail: string
}

const TYPE_WORDS = '(?:void|char|short|int|long|float|double|unsigned|signed|_Bool|bool|uint8_t|uint16_t|uint32_t|int8_t|int16_t|int32_t|[A-Za-z_]\\w*_t)'
const KEYWORDS = new Set(['if', 'while', 'for', 'switch', 'return', 'sizeof', 'do', 'else', 'case'])

/** Toutes les définitions trouvées dans les fichiers (ordre : fichiers dans l'ordre donné, puis lignes) */
export function collectSymbols(files: Record<string, string>): SymbolDef[] {
  const out: SymbolDef[] = []
  for (const [file, src] of Object.entries(files)) {
    const lines = src.split('\n')
    lines.forEach((text, i) => {
      const def = /^\s*#\s*define\s+([A-Za-z_]\w*)/.exec(text)
      if (def) {
        out.push({ name: def[1], kind: 'macro', file, line: i + 1, col: text.indexOf(def[1]) + 1, detail: text.trim() })
        return
      }
      // Définition ou prototype de fonction : « type nom(… »
      const fn = new RegExp(`^\\s*(?:static\\s+|extern\\s+|inline\\s+)*${TYPE_WORDS}[\\s*]+(?:__interrupt\\s*\\([^)]*\\)\\s*)?([A-Za-z_]\\w*)\\s*\\(`).exec(text)
      if (fn && !KEYWORDS.has(fn[1])) {
        const isDef = !/\)\s*;\s*$/.test(text)
        out.push({ name: fn[1], kind: 'function', file, line: i + 1, col: text.indexOf(fn[1]) + 1, detail: `${text.trim().replace(/\s*\{\s*$/, '')}${isDef ? '' : ''}` })
        return
      }
      // Variable globale (colonne 0) : « type nom [= …]; »
      const v = new RegExp(`^(?:static\\s+|extern\\s+|volatile\\s+|const\\s+)*${TYPE_WORDS}[\\s*]+([A-Za-z_]\\w*)\\s*(?:\\[[^\\]]*\\])?\\s*(?:=|;)`).exec(text)
      if (v && !KEYWORDS.has(v[1])) out.push({ name: v[1], kind: 'variable', file, line: i + 1, col: text.indexOf(v[1]) + 1, detail: text.trim() })
    })
  }
  return out
}

/**
 * Définition d'un nom : une définition de fonction (avec corps) l'emporte sur un prototype,
 * puis les macros et les variables ; null si inconnu.
 */
export function findDefinition(files: Record<string, string>, name: string): SymbolDef | null {
  const all = collectSymbols(files).filter((s) => s.name === name)
  if (!all.length) return null
  const body = all.find((s) => s.kind === 'function' && !/\)\s*;\s*$/.test(files[s.file].split('\n')[s.line - 1]))
  return body ?? all.find((s) => s.kind !== 'function') ?? all[0]
}

/** Noms proposés à la complétion (uniques, triés) */
export function completionNames(files: Record<string, string>): { label: string; type: SymbolDef['kind']; detail: string }[] {
  const seen = new Map<string, SymbolDef>()
  for (const s of collectSymbols(files)) if (!seen.has(s.name)) seen.set(s.name, s)
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name)).map((s) => ({ label: s.name, type: s.kind, detail: s.detail }))
}
