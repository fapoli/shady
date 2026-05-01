import { useRef, useCallback, useEffect } from 'react'
import type * as Monaco from 'monaco-editor'
import { registerGlslLanguage, defineTokyoNightTheme } from '../lib/glsl-language'
import { PASS_DEFS } from '../../../shared/types'
import { STARTER_MAIN_SHADER, STARTER_BUFFER_SHADER } from '../lib/shaders'

export interface MonacoHandle {
  editorRef: React.MutableRefObject<Monaco.editor.IStandaloneCodeEditor | null>
  modelsRef: React.MutableRefObject<(Monaco.editor.ITextModel | null)[]>
  init(container: HTMLDivElement): void
  switchModel(index: number): void
  focus(): void
  layout(): void
  dispose(): void
}

export function useMonaco(
  onContentChange: (passIndex: number, value: string) => void,
  onRun: () => void,
  onBack: () => void,
): MonacoHandle {
  const editorRef   = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const modelsRef   = useRef<(Monaco.editor.ITextModel | null)[]>(PASS_DEFS.map(() => null))
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
      registerGlslLanguage(monaco)
      defineTokyoNightTheme(monaco)

      modelsRef.current = PASS_DEFS.map((def, i) => {
        const starter = def.isBuffer ? STARTER_BUFFER_SHADER : STARTER_MAIN_SHADER
        const source  = starter
        const model   = monaco.editor.createModel(source, 'glsl')
        model.onDidChangeContent(() => {
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
    })
  }, [onContentChange, onRun, onBack])

  const switchModel = useCallback((index: number) => {
    const editor = editorRef.current
    const model  = modelsRef.current[index]
    if (editor && model) {
      editor.setModel(model)
      editor.layout()
    }
  }, [])

  const focus   = useCallback(() => { editorRef.current?.focus() }, [])
  const layout  = useCallback(() => { editorRef.current?.layout() }, [])

  const dispose = useCallback(() => {
    resizeObserverRef.current?.disconnect()
    resizeObserverRef.current = null
    if (layoutFrameRef.current !== null) {
      window.cancelAnimationFrame(layoutFrameRef.current)
      layoutFrameRef.current = null
    }
    editorRef.current?.dispose()
    modelsRef.current.forEach(m => m?.dispose())
    editorRef.current = null
    initStarted.current = false
  }, [])

  return { editorRef, modelsRef, init, switchModel, focus, layout, dispose }
}
