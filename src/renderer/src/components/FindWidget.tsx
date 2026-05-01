import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react'
import type * as Monaco from 'monaco-editor'
import { MonacoHandle } from '../hooks/useMonaco'

interface Props {
  monaco:         MonacoHandle
  activeTabIndex: number
  visible:        boolean
  onOpenChange?:  (open: boolean) => void
}

const OPEN_FIND_EVENT = 'shady:open-find'
const MAX_MATCHES = 500

export function FindWidget({ monaco, activeTabIndex, visible, onOpenChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const decorationsRef = useRef<Monaco.editor.IEditorDecorationsCollection | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<Monaco.editor.FindMatch[]>([])
  const [matchIndex, setMatchIndex] = useState(0)
  const [revision, setRevision] = useState(0)

  const close = useCallback(() => {
    setOpen(false)
    monaco.focus()
  }, [monaco])

  const openFind = useCallback(() => {
    const editor = monaco.editorRef.current
    const model = editor?.getModel()
    const selection = editor?.getSelection()

    if (model && selection && !selection.isEmpty()) {
      const selectedText = model.getValueInRange(selection)
      if (selectedText && !selectedText.includes('\n')) {
        setQuery(selectedText)
      }
    }

    setOpen(true)
    window.requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
  }, [monaco.editorRef])

  const move = useCallback((direction: 1 | -1) => {
    setMatchIndex(current => {
      if (matches.length === 0) return 0
      return (current + direction + matches.length) % matches.length
    })
  }, [matches.length])

  useEffect(() => {
    const onOpenFind = () => openFind()
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        event.stopPropagation()
        openFind()
      }
    }

    window.addEventListener(OPEN_FIND_EVENT, onOpenFind)
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => {
      window.removeEventListener(OPEN_FIND_EVENT, onOpenFind)
      window.removeEventListener('keydown', onKeyDown, { capture: true })
    }
  }, [openFind])

  useEffect(() => {
    if (!open) return

    const editor = monaco.editorRef.current
    if (!editor) return

    const modelChangeDisposable = editor.onDidChangeModel(() => setRevision(value => value + 1))
    const contentChangeDisposable = editor.onDidChangeModelContent(() => setRevision(value => value + 1))

    return () => {
      modelChangeDisposable.dispose()
      contentChangeDisposable.dispose()
    }
  }, [monaco.editorRef, open])

  useEffect(() => {
    if (!open || !visible) {
      setMatches([])
      return
    }

    const model = monaco.editorRef.current?.getModel()
    if (!model || query.length === 0) {
      setMatches([])
      return
    }

    const nextMatches = model.findMatches(query, false, false, false, null, false, MAX_MATCHES)
    setMatches(nextMatches)
    setMatchIndex(current => Math.min(current, Math.max(nextMatches.length - 1, 0)))
  }, [activeTabIndex, monaco.editorRef, open, query, revision, visible])

  useEffect(() => {
    const editor = monaco.editorRef.current
    if (!editor) return

    if (!decorationsRef.current) {
      decorationsRef.current = editor.createDecorationsCollection()
    }

    if (!open || !visible) {
      decorationsRef.current.clear()
      return
    }

    decorationsRef.current.set(matches.map((match, index) => ({
      range: match.range,
      options: {
        inlineClassName: index === matchIndex ? 'shady-find-match shady-find-match-current' : 'shady-find-match',
      },
    })))
  }, [matchIndex, matches, monaco.editorRef, open, visible])

  useEffect(() => {
    const editor = monaco.editorRef.current
    const match = matches[matchIndex]
    if (!open || !visible || !editor || !match) return

    editor.setSelection(match.range)
    editor.revealRangeInCenterIfOutsideViewport(match.range)
  }, [matchIndex, matches, monaco.editorRef, open, visible])

  useEffect(() => {
    if (!visible) setOpen(false)
  }, [visible])

  useEffect(() => {
    onOpenChange?.(open && visible)
  }, [onOpenChange, open, visible])

  useEffect(() => {
    return () => decorationsRef.current?.clear()
  }, [])

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    move(1)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
    } else if (event.key === 'Enter') {
      event.preventDefault()
      move(event.shiftKey ? -1 : 1)
    }
  }

  if (!open || !visible) return null

  const count = matches.length === MAX_MATCHES ? `${MAX_MATCHES}+` : String(matches.length)
  const current = matches.length > 0 ? String(matchIndex + 1) : '0'

  return (
    <form className="shady-find-widget" onSubmit={onSubmit}>
      <span className="shady-find-prompt">find:</span>
      <input
        ref={inputRef}
        className="shady-find-input"
        value={query}
        onChange={event => setQuery(event.target.value)}
        onKeyDown={onKeyDown}
        spellCheck={false}
        aria-label="find"
      />
      <span className="shady-find-count">{current}/{count}</span>
      <button className="shady-find-btn" type="button" onClick={() => move(-1)} aria-label="previous match">
        prev
      </button>
      <button className="shady-find-btn" type="submit" aria-label="next match">
        next
      </button>
    </form>
  )
}
