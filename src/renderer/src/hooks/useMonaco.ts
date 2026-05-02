import { useRef, useCallback, useEffect } from 'react'
import type * as Monaco from 'monaco-editor'
import { registerGlslLanguage, defineTokyoNightTheme } from '../lib/glsl-language'
import { PASS_DEFS } from '../../../shared/types'
import { STARTER_MAIN_SHADER, STARTER_BUFFER_SHADER } from '../lib/shaders'
import type { CompileDiagnostic } from './useWebGL'

type MonacoApi = typeof import('monaco-editor')

interface DiagnosticEntry {
  model: Monaco.editor.ITextModel
  line: number
  message: string
}

export interface MonacoHandle {
  editorRef: React.MutableRefObject<Monaco.editor.IStandaloneCodeEditor | null>
  modelsRef: React.MutableRefObject<(Monaco.editor.ITextModel | null)[]>
  init(container: HTMLDivElement): void
  switchModel(index: number): void
  saveViewState(): Monaco.editor.ICodeEditorViewState | null
  restoreViewState(state: Monaco.editor.ICodeEditorViewState | null): void
  setDiagnostics(diagnostics: CompileDiagnostic[]): void
  clearDiagnostics(passIndex?: number): void
  focus(): void
  layout(): void
  dispose(): void
}

const DIAGNOSTIC_TOOLTIP_OFFSET = 12

export function useMonaco(
  onContentChange: (passIndex: number, value: string) => void,
  onRun: () => void,
  onBack: () => void,
): MonacoHandle {
  const editorRef   = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const modelsRef   = useRef<(Monaco.editor.ITextModel | null)[]>(PASS_DEFS.map(() => null))
  const monacoRef   = useRef<MonacoApi | null>(null)
  const diagnosticsRef = useRef<DiagnosticEntry[]>([])
  const diagnosticDecorationsRef = useRef<Monaco.editor.IEditorDecorationsCollection | null>(null)
  const diagnosticTooltipRef = useRef<HTMLDivElement | null>(null)
  const initStarted = useRef(false)
  const onRunRef    = useRef(onRun)
  const onBackRef   = useRef(onBack)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const layoutFrameRef    = useRef<number | null>(null)
  useEffect(() => { onRunRef.current  = onRun  }, [onRun])
  useEffect(() => { onBackRef.current = onBack }, [onBack])

  const init = useCallback((container: HTMLDivElement) => {
    if (initStarted.current) return
    initStarted.current = true

    import('monaco-editor').then(monaco => {
      monacoRef.current = monaco
      registerGlslLanguage(monaco)
      defineTokyoNightTheme(monaco)

      modelsRef.current = PASS_DEFS.map((def, i) => {
        const starter = def.isBuffer ? STARTER_BUFFER_SHADER : STARTER_MAIN_SHADER
        const source  = starter
        const model   = monaco.editor.createModel(source, 'glsl')
        model.onDidChangeContent(() => {
          diagnosticsRef.current = diagnosticsRef.current.filter(diagnostic => diagnostic.model !== model)
          updateDiagnosticDecorations()
          diagnosticTooltipRef.current?.classList.remove('visible')
          localStorage.setItem(`shader_${def.id}`, model.getValue())
          onContentChange(i, model.getValue())
        })
        return model
      })

      const editor = monaco.editor.create(container, {
        model:                modelsRef.current[0],
        theme:                'tokyo-night',
        automaticLayout:      false,
        minimap:              { enabled: false },
        stickyScroll:         { enabled: false },
        lineNumbers:          'on',
        fontFamily:           'Hack Nerd Font',
        fontLigatures:        false,
        fontSize:             14,
        lineHeight:           21,
        wordWrap:             'on',
        scrollBeyondLastLine: false,
        renderLineHighlight:  'none',
        roundedSelection:     false,
        overviewRulerLanes:   0,
        overviewRulerBorder:  false,
        lineDecorationsWidth: 16,
        lineNumbersMinChars:  2,
        glyphMargin:          false,
        folding:              false,
        tabSize:              2,
        scrollbar: {
          vertical:         'hidden',
          horizontal:       'hidden',
          handleMouseWheel: true,
          useShadows:       false,
        }
      })

      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => onRunRef.current())
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
        window.dispatchEvent(new CustomEvent('shady:open-find'))
      })
      editor.addCommand(monaco.KeyCode.Escape, () => onBackRef.current())

      const tooltip = document.createElement('div')
      tooltip.className = 'shady-diagnostic-tooltip'
      document.body.appendChild(tooltip)
      diagnosticTooltipRef.current = tooltip
      diagnosticDecorationsRef.current = editor.createDecorationsCollection()

      editor.onMouseMove(event => {
        const position = event.target.position
        const model = editor.getModel()
        if (!position || !model) {
          tooltip.classList.remove('visible')
          return
        }

        const diagnostics = diagnosticsRef.current.filter(diagnostic => (
          diagnostic.model === model && diagnostic.line === position.lineNumber
        ))
        if (diagnostics.length === 0) {
          tooltip.classList.remove('visible')
          return
        }

        const browserEvent = event.event.browserEvent
        tooltip.textContent = diagnostics.map(diagnostic => diagnostic.message).join('\n')
        tooltip.classList.add('visible')
        const left = Math.min(
          browserEvent.clientX + DIAGNOSTIC_TOOLTIP_OFFSET,
          window.innerWidth - tooltip.offsetWidth - DIAGNOSTIC_TOOLTIP_OFFSET,
        )
        const top = Math.min(
          browserEvent.clientY + DIAGNOSTIC_TOOLTIP_OFFSET,
          window.innerHeight - tooltip.offsetHeight - DIAGNOSTIC_TOOLTIP_OFFSET,
        )
        tooltip.style.left = `${Math.max(DIAGNOSTIC_TOOLTIP_OFFSET, left)}px`
        tooltip.style.top = `${Math.max(DIAGNOSTIC_TOOLTIP_OFFSET, top)}px`
      })
      editor.onMouseLeave(() => tooltip.classList.remove('visible'))

      const scheduleLayout = () => {
        if (layoutFrameRef.current !== null) return
        layoutFrameRef.current = window.requestAnimationFrame(() => {
          layoutFrameRef.current = null
          editor.layout()
        })
      }

      resizeObserverRef.current = new ResizeObserver(scheduleLayout)
      resizeObserverRef.current.observe(container)

      editorRef.current = editor
      window.appMeta.rendererReady()
    })
  }, [onContentChange, onRun, onBack])

  function updateDiagnosticDecorations(): void {
    const monaco = monacoRef.current
    const activeModel = editorRef.current?.getModel()
    if (!monaco || !activeModel) {
      diagnosticDecorationsRef.current?.set([])
      return
    }

    diagnosticDecorationsRef.current?.set(
      diagnosticsRef.current
        .filter(diagnostic => diagnostic.model === activeModel)
        .map(diagnostic => ({
          range: new monaco.Range(
            diagnostic.line,
            1,
            diagnostic.line,
            diagnostic.model.getLineMaxColumn(diagnostic.line),
          ),
          options: {
            isWholeLine: true,
            className: 'shady-diagnostic-line',
            linesDecorationsClassName: 'shady-diagnostic-gutter',
          },
        }))
    )
  }

  const switchModel = useCallback((index: number) => {
    const editor = editorRef.current
    const model  = modelsRef.current[index]
    if (editor && model) {
      editor.setModel(model)
      updateDiagnosticDecorations()
      editor.layout()
    }
  }, [])

  const saveViewState = useCallback(() => {
    return editorRef.current?.saveViewState() ?? null
  }, [])

  const restoreViewState = useCallback((state: Monaco.editor.ICodeEditorViewState | null) => {
    const editor = editorRef.current
    if (!editor || !state) return
    editor.restoreViewState(state)
  }, [])

  const clearDiagnostics = useCallback((passIndex?: number) => {
    const models = passIndex === undefined
      ? modelsRef.current
      : [modelsRef.current[passIndex]]

    diagnosticsRef.current = diagnosticsRef.current.filter(diagnostic => !models.includes(diagnostic.model))
    updateDiagnosticDecorations()
    diagnosticTooltipRef.current?.classList.remove('visible')
  }, [])

  const setDiagnostics = useCallback((diagnostics: CompileDiagnostic[]) => {
    clearDiagnostics()
    diagnosticsRef.current = diagnostics.map(diagnostic => {
      const model = modelsRef.current[diagnostic.passIndex]
      if (!model) return null
      return {
        model,
        line: Math.max(1, Math.min(diagnostic.line, model.getLineCount())),
        message: diagnostic.message,
      }
    }).filter((entry): entry is DiagnosticEntry => entry !== null)

    updateDiagnosticDecorations()
  }, [clearDiagnostics])

  const focus   = useCallback(() => { editorRef.current?.focus() }, [])
  const layout  = useCallback(() => { editorRef.current?.layout() }, [])

  const dispose = useCallback(() => {
    clearDiagnostics()
    resizeObserverRef.current?.disconnect()
    resizeObserverRef.current = null
    diagnosticDecorationsRef.current?.clear()
    diagnosticDecorationsRef.current = null
    diagnosticTooltipRef.current?.remove()
    diagnosticTooltipRef.current = null
    diagnosticsRef.current = []
    if (layoutFrameRef.current !== null) {
      window.cancelAnimationFrame(layoutFrameRef.current)
      layoutFrameRef.current = null
    }
    editorRef.current?.dispose()
    modelsRef.current.forEach(m => m?.dispose())
    editorRef.current = null
    monacoRef.current = null
    initStarted.current = false
  }, [clearDiagnostics])

  return {
    editorRef,
    modelsRef,
    init,
    switchModel,
    saveViewState,
    restoreViewState,
    setDiagnostics,
    clearDiagnostics,
    focus,
    layout,
    dispose,
  }
}
