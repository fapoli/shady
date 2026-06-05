import { useState, useEffect, useCallback, useRef } from 'react'
import { PASS_DEFS, PROJECT_TAB } from '../../shared/types'
import { useMonaco } from './hooks/useMonaco'
import { useWebGL } from './hooks/useWebGL'
import { useProject } from './hooks/useProject'
import { useAppCommands } from './hooks/useAppCommands'
import { usePreviewController } from './hooks/usePreviewController'
import { EditorView } from './components/EditorView'
import { PreviewView } from './components/PreviewView'

export function App() {
  const [activeTabIndex, setActiveTabIndex] = useState(0)

  const markProjectChangedRef = useRef<() => void>(() => {})
  const rootRef = useRef<HTMLElement>(null)
  const resizeSizeRef = useRef<HTMLDivElement>(null)
  const resizeEndFrameRef = useRef<number | null>(null)
  const startPreviewRef = useRef<() => void>(() => {})
  const backToEditorRef = useRef<() => void>(() => {})

  const markProjectChanged = useCallback(() => {
    markProjectChangedRef.current()
  }, [])

  const webgl  = useWebGL(markProjectChanged)
  const monaco = useMonaco(
    markProjectChanged,
    () => startPreviewRef.current(),
    () => backToEditorRef.current(),
  )

  const switchToTab = useCallback((index: number, _options?: { silent?: boolean }) => {
    setActiveTabIndex(index)
    if (index !== PROJECT_TAB) {
      const pass = PASS_DEFS[index]
      const type = pass?.isBuffer ? project.slotTypesRef.current[pass.id] : 'shader'
      if (type === 'shader') {
        monaco.switchModel(index)
        setTimeout(() => monaco.focus(), 0)
      }
    }
  }, [monaco])

  const preview = usePreviewController({
    monaco,
    webgl,
    getSlotTypes: () => project.slotTypesRef.current,
    getProjectSettings: () => project.projectSettingsRef.current,
    switchToTab,
  })
  useEffect(() => {
    startPreviewRef.current = preview.startPreview
    backToEditorRef.current = preview.backToEditor
  }, [preview.backToEditor, preview.startPreview])

  const project = useProject({
    monaco,
    webgl,
    isPreview: preview.isPreview,
    backToEditor: preview.backToEditor,
    switchToTab,
    setCompileError: preview.setCompileError,
  })
  useEffect(() => { markProjectChangedRef.current = project.markProjectChanged }, [project.markProjectChanged])

  useAppCommands({
    isPreview: preview.isPreview,
    webgl,
    startPreview: preview.startPreview,
    backToEditor: preview.backToEditor,
    switchToTab,
    toggleStats: preview.toggleStats,
    project,
  })

  useEffect(() => {
    const prevent = (e: DragEvent) => e.preventDefault()
    document.addEventListener('dragover', prevent)
    document.addEventListener('drop', prevent)
    return () => {
      document.removeEventListener('dragover', prevent)
      document.removeEventListener('drop', prevent)
    }
  }, [])

  useEffect(() => {
    return () => webgl.cleanup()
  }, [])

  useEffect(() => {
    return window.appMeta.onResizeStateChange(state => {
      if (!state.active) {
        monaco.layout()
        if (resizeEndFrameRef.current !== null) window.cancelAnimationFrame(resizeEndFrameRef.current)
        resizeEndFrameRef.current = window.requestAnimationFrame(() => {
          resizeEndFrameRef.current = null
          rootRef.current?.classList.remove('is-resizing')
        })
        return
      }

      if (resizeEndFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeEndFrameRef.current)
        resizeEndFrameRef.current = null
      }
      rootRef.current?.classList.add('is-resizing')
      if (resizeSizeRef.current) resizeSizeRef.current.textContent = `${state.width} x ${state.height}`
    })
  }, [monaco])

  useEffect(() => {
    return () => {
      if (resizeEndFrameRef.current !== null) window.cancelAnimationFrame(resizeEndFrameRef.current)
    }
  }, [])

  useEffect(() => {
    const setFullscreenClass = (fullscreen: boolean) => {
      document.documentElement.classList.toggle('is-fullscreen', fullscreen)
    }

    window.appMeta.isFullscreen().then(setFullscreenClass)
    return window.appMeta.onFullscreenChange(setFullscreenClass)
  }, [])

  return (
    <main ref={rootRef} className="root">
      <EditorView
        monaco={monaco}
        webgl={webgl}
        activeTabIndex={activeTabIndex}
        slotTypes={project.slotTypes}
        projectSettings={project.projectSettings}
        hidden={preview.isPreview}
        onSwitch={switchToTab}
        onSetSlotType={project.setSlotType}
        onSetProjectSettings={project.setProjectSettingValues}
      />

      {preview.compileError && !preview.isPreview && (
        <div className="compile-error-panel" onClick={() => preview.setCompileError(null)}>
          {preview.compileError}
        </div>
      )}

      {project.exportStatus && (
        <div className="export-status-panel">
          {project.exportStatus}
        </div>
      )}

      <PreviewView
        canvasRef={webgl.canvasRef}
        stats={webgl.stats}
        showStats={preview.showStats}
        hidden={!preview.isPreview}
      />

      <div className="resize-overlay" aria-hidden="true">
        <div ref={resizeSizeRef} className="resize-size">{window.innerWidth} x {window.innerHeight}</div>
      </div>
    </main>
  )
}
