/**
 * Éditeur CodeMirror 6 (lang-cpp), chargé à la demande (chunk séparé).
 * Marge : clic = point d'arrêt (un seul, géré par le parent). Ligne courante du débogueur surlignée.
 * Ctrl+Espace : complétion sur les symboles du projet ; Ctrl+clic : aller à la définition ;
 * Source > Format (Alt+Maj+F) : réindentation. Thème clair MPLAB X par défaut, sombre en option.
 */
import { autocompletion, completionKeymap, type Completion, type CompletionContext } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { cpp } from '@codemirror/lang-cpp'
import { bracketMatching, HighlightStyle, indentOnInput, indentRange, syntaxHighlighting } from '@codemirror/language'
import { EditorState, RangeSet, StateEffect, StateField, type Extension } from '@codemirror/state'
import { Decoration, EditorView, gutter, GutterMarker, highlightActiveLine, keymap, lineNumbers, type DecorationSet } from '@codemirror/view'
import { tags } from '@lezer/highlight'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

export interface CodeEditorProps {
  path: string
  value: string
  readOnly: boolean
  dark: boolean
  breakpointLine: number | null
  currentLine: number | null
  completions: { label: string; type: string; detail: string }[]
  onChange(value: string): void
  onToggleBreakpoint(line: number): void
  onGotoDefinition(name: string): void
}

export interface CodeEditorHandle {
  goTo(line: number, col: number): void
  format(): void
}

/* ───────────── Point d'arrêt et ligne courante ───────────── */

const setMarks = StateEffect.define<{ bp: number | null; cur: number | null }>()

class BpMarker extends GutterMarker {
  toDOM() {
    const el = document.createElement('span')
    el.className = 'cm-bp-dot'
    el.title = 'Point d’arrêt'
    return el
  }
}
const BP = new BpMarker()

interface Marks {
  bp: number | null
  cur: number | null
}
const marksField = StateField.define<Marks>({
  create: () => ({ bp: null, cur: null }),
  update(v, tr) {
    for (const e of tr.effects) if (e.is(setMarks)) return e.value
    return v
  },
})

const lineDeco = EditorView.decorations.compute([marksField], (state): DecorationSet => {
  const m = state.field(marksField)
  const ranges = []
  const lines = state.doc.lines
  if (m.bp && m.bp <= lines) ranges.push(Decoration.line({ class: 'cm-bp-line' }).range(state.doc.line(m.bp).from))
  if (m.cur && m.cur <= lines) ranges.push(Decoration.line({ class: 'cm-cur-line' }).range(state.doc.line(m.cur).from))
  ranges.sort((a, b) => a.from - b.from)
  return Decoration.set(ranges)
})

/* ───────────── Thèmes MPLAB X ───────────── */

const lightHighlight = HighlightStyle.define([
  { tag: [tags.keyword, tags.controlKeyword, tags.typeName, tags.modifier], color: '#0000e6', fontWeight: 'bold' },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: '#969696' },
  { tag: [tags.string, tags.character], color: '#ce7b00' },
  { tag: [tags.number], color: '#000000' },
  { tag: [tags.processingInstruction, tags.macroName], color: '#009b00' },
])
const darkHighlight = HighlightStyle.define([
  { tag: [tags.keyword, tags.controlKeyword, tags.typeName, tags.modifier], color: '#6fa8ff', fontWeight: 'bold' },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: '#7f8c8d' },
  { tag: [tags.string, tags.character], color: '#e6a23c' },
  { tag: [tags.number], color: '#d4d4d4' },
  { tag: [tags.processingInstruction, tags.macroName], color: '#7ccf7c' },
])

function theme(dark: boolean): Extension {
  return [
    EditorView.theme(
      {
        '&': { height: '100%', fontSize: '12.5px', backgroundColor: dark ? '#1e1f22' : '#ffffff', color: dark ? '#d4d4d4' : '#000000' },
        '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.5' },
        '.cm-gutters': { backgroundColor: dark ? '#26282b' : '#eeeeee', color: dark ? '#8a8a8a' : '#7a7a7a', borderRight: `1px solid ${dark ? '#3a3a3a' : '#d0d0d0'}` },
        '.cm-activeLine': { backgroundColor: dark ? '#2a2c30' : '#e8f2fe' },
        '.cm-bp-gutter': { width: '14px', cursor: 'pointer' },
        '.cm-bp-dot': { display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#d32f2f', marginTop: '4px' },
        '.cm-bp-line': { backgroundColor: dark ? 'rgba(211,47,47,.28)' : '#fcd6d6' },
        '.cm-cur-line': { backgroundColor: dark ? 'rgba(76,175,80,.35)' : '#c8f0c8' },
        '&.cm-focused .cm-cursor': { borderLeftColor: dark ? '#fff' : '#000' },
      },
      { dark },
    ),
    syntaxHighlighting(dark ? darkHighlight : lightHighlight),
  ]
}

/* ───────────── Composant ───────────── */

const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(function CodeEditor(props, ref) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  // Les rappels changent à chaque rendu : on les lit via une référence (l'éditeur n'est pas recréé)
  const cb = useRef(props)
  useEffect(() => {
    cb.current = props
  })

  useEffect(() => {
    const completionSource = (ctx: CompletionContext) => {
      const word = ctx.matchBefore(/[A-Za-z_]\w*/)
      if (!word || (word.from === word.to && !ctx.explicit)) return null
      const options: Completion[] = cb.current.completions.map((c) => ({ label: c.label, type: c.type === 'macro' ? 'constant' : c.type, detail: c.detail.length > 60 ? `${c.detail.slice(0, 57)}…` : c.detail }))
      return { from: word.from, options, validFor: /^\w*$/ }
    }
    const state = EditorState.create({
      doc: props.value,
      extensions: [
        marksField,
        lineDeco,
        gutter({
          class: 'cm-bp-gutter',
          markers: (v) => {
            const bp = v.state.field(marksField).bp
            return bp && bp <= v.state.doc.lines ? RangeSet.of([BP.range(v.state.doc.line(bp).from)]) : RangeSet.empty
          },
          domEventHandlers: {
            mousedown(v, block) {
              cb.current.onToggleBreakpoint(v.state.doc.lineAt(block.from).number)
              return true
            },
          },
        }),
        lineNumbers({
          domEventHandlers: {
            mousedown(v, block) {
              cb.current.onToggleBreakpoint(v.state.doc.lineAt(block.from).number)
              return true
            },
          },
        }),
        history(),
        highlightActiveLine(),
        bracketMatching(),
        indentOnInput(),
        cpp(),
        autocompletion({ override: [completionSource], activateOnTyping: false }),
        keymap.of([
          { key: 'Alt-Shift-f', run: (v) => formatView(v) },
          ...completionKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          indentWithTab,
        ]),
        EditorView.domEventHandlers({
          mousedown(e, v) {
            if (!(e.ctrlKey || e.metaKey)) return false
            const pos = v.posAtCoords({ x: e.clientX, y: e.clientY })
            if (pos === null) return false
            const w = v.state.wordAt(pos)
            if (!w) return false
            e.preventDefault()
            cb.current.onGotoDefinition(v.state.sliceDoc(w.from, w.to))
            return true
          },
        }),
        EditorState.readOnly.of(props.readOnly),
        EditorView.editable.of(!props.readOnly),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) cb.current.onChange(u.state.doc.toString())
        }),
        theme(props.dark),
      ],
    })
    const v = new EditorView({ state, parent: host.current! })
    view.current = v
    v.dispatch({ effects: setMarks.of({ bp: props.breakpointLine, cur: props.currentLine }) })
    return () => {
      v.destroy()
      view.current = null
    }
    // Recréé seulement au changement de fichier, de lecture seule ou de thème
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.path, props.readOnly, props.dark])

  // Contenu modifié de l'extérieur (Generate, rechargement)
  useEffect(() => {
    const v = view.current
    if (v && v.state.doc.toString() !== props.value) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: props.value } })
  }, [props.value])

  useEffect(() => {
    view.current?.dispatch({ effects: setMarks.of({ bp: props.breakpointLine, cur: props.currentLine }) })
    if (props.currentLine && view.current && props.currentLine <= view.current.state.doc.lines) {
      const pos = view.current.state.doc.line(props.currentLine).from
      view.current.dispatch({ effects: EditorView.scrollIntoView(pos, { y: 'center' }) })
    }
  }, [props.breakpointLine, props.currentLine])

  useImperativeHandle(ref, () => ({
    goTo(line, col) {
      const v = view.current
      if (!v) return
      const l = v.state.doc.line(Math.min(Math.max(1, line), v.state.doc.lines))
      const pos = Math.min(l.from + Math.max(0, col - 1), l.to)
      v.dispatch({ selection: { anchor: pos }, effects: EditorView.scrollIntoView(pos, { y: 'center' }) })
      v.focus()
    },
    format() {
      if (view.current) formatView(view.current)
    },
  }))

  return <div ref={host} className="h-full min-h-0 overflow-hidden" data-testid="code-editor" />
})

/** Source > Format : réindente tout le fichier selon la grammaire C */
function formatView(v: EditorView): boolean {
  if (v.state.readOnly) return false
  const changes = indentRange(v.state, 0, v.state.doc.length)
  if (!changes.empty) v.dispatch({ changes })
  return true
}

export default CodeEditor
