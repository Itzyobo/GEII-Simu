/**
 * Rendu minimal du Markdown de l'énoncé : titres, paragraphes (retours à la ligne conservés), listes,
 * citations, blocs de code (clôturés, même indentés dans un élément de liste, ou indentés de 4 espaces),
 * tableaux, filets, ancres.
 */
import type { ReactNode } from 'react'

/** Indentation d'un bloc de code par rapport au texte courant (Markdown) */
const CODE_INDENT = 4

const inline = (s: string): ReactNode[] =>
  s
    .replace(/<a id="[^"]*"><\/a>/g, '')
    .split(/(`[^`]+`|\*\*[^*]+\*\*|<br>)/g)
    .map((part, i) => (part === '<br>' ? <br key={i} /> : part.startsWith('`') ? <code key={i}>{part.slice(1, -1)}</code> : part.startsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part))

const indentOf = (l: string) => l.length - l.trimStart().length
const cells = (l: string) =>
  l
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim())

export default function Markdown({ text }: { text: string }) {
  const out: ReactNode[] = []
  const lines = text.split('\n')
  let i = 0
  let para: string[] = []
  /** Indentation du texte de l'élément de liste en cours (0 hors liste) */
  let base = 0
  const flush = () => {
    if (para.length) out.push(<p key={out.length} className="whitespace-pre-line">{inline(para.join('\n'))}</p>)
    para = []
  }
  const pre = (code: string[]) =>
    out.push(
      <pre key={out.length} className="overflow-x-auto rounded bg-screen p-2 text-xs text-[#d8e2dc]">
        {code.join('\n')}
      </pre>,
    )
  while (i < lines.length) {
    const l = lines[i]
    const t = l.trim()
    const anchor = /<a id="([^"]+)"><\/a>/.exec(l)
    const item = /^(\s*)(\d+\.|[-*])\s+/.exec(l)
    if (t.startsWith('```')) {
      flush()
      const ind = indentOf(l)
      const code: string[] = []
      i++
      for (; i < lines.length && !lines[i].trim().startsWith('```'); i++) code.push(lines[i].slice(Math.min(ind, indentOf(lines[i]))))
      pre(code)
    } else if (t && indentOf(l) >= base + CODE_INDENT && !para.length) {
      // Bloc indenté : lignes consécutives indentées (lignes vides comprises)
      const code: string[] = []
      while (i < lines.length && (!lines[i].trim() || indentOf(lines[i]) >= base + CODE_INDENT)) code.push(lines[i++].slice(base + CODE_INDENT))
      while (code.length && !code[code.length - 1].trim()) code.pop()
      pre(code)
      continue
    } else if (t.startsWith('|')) {
      flush()
      const rows: string[][] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(cells(lines[i++]))
      const body = rows.filter((r) => !r.every((c) => /^:?-+:?$/.test(c)))
      const [head, ...rest] = body
      const hasHead = head?.some((c) => c)
      out.push(
        <div key={out.length} className="max-w-full overflow-x-auto">
          <table className="text-left text-xs">
            {hasHead && (
              <thead>
                <tr>
                  {head.map((c, k) => (
                    <th key={k} className="border border-line px-2 py-1 font-semibold">
                      {inline(c)}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {rest.map((r, k) => (
                <tr key={k}>
                  {r.map((c, m) => (
                    <td key={m} className="border border-line px-2 py-1">
                      {inline(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    } else if (/^#{1,6} /.test(l)) {
      flush()
      base = 0
      const level = l.indexOf(' ')
      out.push(
        <p key={out.length} className={level <= 2 ? 'text-base font-semibold' : 'font-semibold'}>
          {inline(l.slice(level + 1))}
        </p>,
      )
    } else if (/^---\s*$/.test(l)) {
      flush()
      base = 0
      out.push(<hr key={out.length} className="border-line" />)
    } else if (item) {
      flush()
      base = item[0].length
      const bullet = /\d/.test(item[2]) ? `${item[2]} ` : '• '
      para.push(`${bullet}${l.slice(item[0].length)}`)
    } else if (t.startsWith('>')) {
      flush()
      out.push(
        <p key={out.length} className="border-l-2 border-line pl-2 text-muted">
          {inline(t.replace(/^>\s?/, ''))}
        </p>,
      )
    } else if (!t) flush()
    else if (anchor && !l.replace(anchor[0], '').trim()) {
      flush()
      base = 0
      out.push(<span key={out.length} id={anchor[1]} />)
    } else para.push(t)
    i++
  }
  flush()
  return <div className="space-y-2 text-sm leading-6">{out}</div>
}
