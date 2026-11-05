/** Rendu minimal du Markdown de l'énoncé : titres, paragraphes, listes, citations, blocs de code, ancres. */
import type { ReactNode } from 'react'

const inline = (s: string): ReactNode[] =>
  s
    .replace(/<a id="[^"]*"><\/a>/g, '')
    .split(/(`[^`]+`|\*\*[^*]+\*\*)/g)
    .map((part, i) => (part.startsWith('`') ? <code key={i}>{part.slice(1, -1)}</code> : part.startsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part))

export default function Markdown({ text }: { text: string }) {
  const out: ReactNode[] = []
  const lines = text.split('\n')
  let i = 0
  let para: string[] = []
  const flush = () => {
    if (para.length) out.push(<p key={out.length}>{inline(para.join(' '))}</p>)
    para = []
  }
  while (i < lines.length) {
    const l = lines[i]
    const anchor = /<a id="([^"]+)"><\/a>/.exec(l)
    if (l.startsWith('```')) {
      flush()
      const code: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++])
      out.push(
        <pre key={out.length} className="overflow-x-auto rounded bg-screen p-2 text-xs text-[#d8e2dc]">
          {code.join('\n')}
        </pre>,
      )
    } else if (/^#{1,6} /.test(l)) {
      flush()
      const level = l.indexOf(' ')
      out.push(
        <p key={out.length} className={level <= 2 ? 'text-base font-semibold' : 'font-semibold'}>
          {inline(l.slice(level + 1))}
        </p>,
      )
    } else if (/^\s*[-*] /.test(l)) {
      flush()
      out.push(
        <p key={out.length} className="pl-4">
          • {inline(l.replace(/^\s*[-*] /, ''))}
        </p>,
      )
    } else if (l.startsWith('>')) {
      flush()
      out.push(
        <p key={out.length} className="border-l-2 border-line pl-2 text-muted">
          {inline(l.replace(/^>\s?/, ''))}
        </p>,
      )
    } else if (!l.trim()) flush()
    else if (anchor && !l.replace(anchor[0], '').trim()) {
      flush()
      out.push(<span key={out.length} id={anchor[1]} />)
    } else para.push(l)
    i++
  }
  flush()
  return <div className="space-y-2 text-sm leading-6">{out}</div>
}
