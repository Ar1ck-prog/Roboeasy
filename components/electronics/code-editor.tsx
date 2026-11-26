'use client'

import { useEffect, useRef, useState } from 'react'

import type { EditorView } from '@codemirror/view'

interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  /** Line to mark as wrong (1-based), or null. */
  errorLine: number | null
  /** Accessible name of the editor. */
  label: string
  loading: string
}

/**
 * CodeMirror 6 with C++ highlighting, loaded only on the lab page.
 * The error line is a line decoration that follows the text.
 */
export function CodeEditor({ value, onChange, errorLine, label, loading }: CodeEditorProps) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const setError = useRef<((line: number | null) => void) | null>(null)
  const onChangeRef = useRef(onChange)
  const [ready, setReady] = useState(false)
  onChangeRef.current = onChange

  useEffect(() => {
    let cancelled = false
    let created: EditorView | null = null
    void (async () => {
      const [{ basicSetup }, { EditorView: View, Decoration, keymap }, { EditorState, StateEffect, StateField }, { cpp }, { indentWithTab }, { HighlightStyle, syntaxHighlighting }, { tags }] =
        await Promise.all([
          import('codemirror'),
          import('@codemirror/view'),
          import('@codemirror/state'),
          import('@codemirror/lang-cpp'),
          import('@codemirror/commands'),
          import('@codemirror/language'),
          import('@lezer/highlight'),
        ])
      if (cancelled || !host.current) return
      const markError = StateEffect.define<number | null>()
      const errorMark = Decoration.line({ class: 'cm-error-line' })
      const errorField = StateField.define({
        create: () => Decoration.none,
        update(deco, tr) {
          let next = deco.map(tr.changes)
          for (const e of tr.effects) {
            if (!e.is(markError)) continue
            const line = e.value
            next = line && line <= tr.state.doc.lines ? Decoration.set([errorMark.range(tr.state.doc.line(line).from)]) : Decoration.none
          }
          // Typing clears the mark: the error belongs to the old text.
          if (tr.docChanged) next = Decoration.none
          return next
        },
        provide: (f) => View.decorations.from(f),
      })
      // Code is always on a dark panel on this site, with the colours of its code blocks (.tok-* in globals.css).
      const theme = View.theme(
        {
          '&': { fontSize: '14px', backgroundColor: 'var(--code-bg)', color: '#e6e9ef', height: '100%' },
          '.cm-content': { caretColor: '#ffd56a' },
          '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.55' },
          '.cm-gutters': { backgroundColor: 'var(--code-bg)', color: '#5b6472', borderRight: '1px solid #2a3040' },
          '.cm-activeLine': { backgroundColor: 'rgba(255, 213, 106, 0.07)' },
          '.cm-activeLineGutter': { backgroundColor: 'transparent', color: '#e6e9ef' },
          '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: 'rgba(143, 179, 255, 0.3) !important' },
          '.cm-matchingBracket': { backgroundColor: 'rgba(255, 213, 106, 0.25)', outline: 'none' },
          '.cm-error-line': { backgroundColor: 'rgba(240, 80, 80, 0.28)' },
          '&.cm-focused': { outline: '2px solid var(--color-ring)', outlineOffset: '-2px' },
          '.cm-cursor': { borderLeftColor: '#ffd56a' },
          '.cm-tooltip': { backgroundColor: '#1b1f2a', color: '#e6e9ef', border: '1px solid #2a3040' },
          '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: '#2a3040', color: '#fff' },
        },
        { dark: true },
      )
      const colors = syntaxHighlighting(
        HighlightStyle.define([
          { tag: [tags.keyword, tags.controlKeyword, tags.modifier, tags.typeName, tags.standard(tags.typeName)], color: '#ff8fcf' },
          { tag: [tags.function(tags.variableName), tags.function(tags.propertyName), tags.macroName], color: '#7dd3fc' },
          { tag: [tags.string, tags.character], color: '#b8e986' },
          { tag: [tags.number, tags.bool], color: '#ffd479' },
          { tag: [tags.comment, tags.lineComment, tags.blockComment], color: '#7f8a9a', fontStyle: 'italic' },
          { tag: [tags.constant(tags.variableName), tags.processingInstruction, tags.definitionKeyword], color: '#c4b5fd' },
          { tag: [tags.operator, tags.punctuation, tags.bracket], color: '#c7ccd6' },
          { tag: [tags.variableName, tags.propertyName], color: '#e6e9ef' },
        ]),
      )
      created = new View({
        parent: host.current,
        state: EditorState.create({
          doc: value,
          extensions: [
            basicSetup,
            cpp(),
            keymap.of([indentWithTab]),
            theme,
            colors,
            errorField,
            View.contentAttributes.of({ 'aria-label': label }),
            View.updateListener.of((u) => {
              if (u.docChanged) onChangeRef.current(u.state.doc.toString())
            }),
          ],
        }),
      })
      view.current = created
      setError.current = (line) => {
        const v = view.current
        if (!v) return
        const effects = [markError.of(line)]
        if (line && line <= v.state.doc.lines) {
          const pos = v.state.doc.line(line).from
          v.dispatch({ effects: [...effects, View.scrollIntoView(pos, { y: 'center' })] })
        } else v.dispatch({ effects })
      }
      setReady(true)
    })()
    return () => {
      cancelled = true
      created?.destroy()
      view.current = null
    }
    // The editor is created once; later values arrive through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Replace the text when it changes from outside (a mission loaded, a solution shown).
  useEffect(() => {
    const v = view.current
    if (!v || v.state.doc.toString() === value) return
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } })
  }, [value, ready])

  useEffect(() => {
    if (ready) setError.current?.(errorLine)
  }, [errorLine, ready])

  return (
    <div className="relative h-full min-h-[320px] overflow-hidden rounded-(--radius-md) border-(length:--stroke-thin) border-(--code-border)" data-testid="code-editor">
      <div ref={host} className="h-full [&_.cm-editor]:h-full" />
      {!ready && (
        <>
          <p className="absolute inset-x-0 top-3 m-0 text-center text-sm text-muted-foreground">{loading}</p>
          {/* Until CodeMirror loads, a plain field keeps the code editable. */}
          <textarea
            className="absolute inset-0 resize-none bg-(--code-bg) p-3 pt-10 font-mono text-sm text-[#e6e9ef] outline-none"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label={label}
            spellCheck={false}
          />
        </>
      )}
    </div>
  )
}
