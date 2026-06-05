import { useCallback, useRef, useState } from 'react'
import type * as Monaco from 'monaco-editor'
import type { ProjectSettings } from '../../../shared/types'
import type { SlotType } from '../inputs/registry'
import type { MonacoHandle } from './useMonaco'
import type { WebGLHandle } from './webglTypes'

interface Options {
  monaco: MonacoHandle
  webgl: WebGLHandle
  getSlotTypes(): Record<string, SlotType>
  getProjectSettings(): ProjectSettings
  switchToTab(index: number, options?: { silent?: boolean }): void
}

export function usePreviewController({
  monaco,
  webgl,
  getSlotTypes,
  getProjectSettings,
  switchToTab,
}: Options) {
  const [isPreview, setIsPreview] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [compileError, setCompileError] = useState<string | null>(null)
  const previewEditorStateRef = useRef<Monaco.editor.ICodeEditorViewState | null>(null)

  const startPreview = useCallback(() => {
    const result = webgl.start(monaco.modelsRef.current, getSlotTypes(), getProjectSettings())
    const firstDiagnostic = result.diagnostics[0]
    monaco.setDiagnostics(firstDiagnostic ? [firstDiagnostic] : [])
    if (result.messages.length > 0) {
      setCompileError(firstDiagnostic?.message ?? result.messages[0])
      if (firstDiagnostic) switchToTab(firstDiagnostic.passIndex, { silent: true })
      return
    }

    setCompileError(null)
    previewEditorStateRef.current = monaco.saveViewState()
    setIsPreview(true)
  }, [getProjectSettings, getSlotTypes, monaco, switchToTab, webgl])

  const backToEditor = useCallback(() => {
    webgl.stop()
    if (!isPreview) return
    setShowStats(false)
    setIsPreview(false)
    window.requestAnimationFrame(() => {
      monaco.layout()
      monaco.restoreViewState(previewEditorStateRef.current)
      monaco.focus()
    })
  }, [isPreview, monaco, webgl])

  const toggleStats = useCallback(() => setShowStats(value => !value), [])

  return {
    isPreview,
    showStats,
    compileError,
    setCompileError,
    startPreview,
    backToEditor,
    toggleStats,
  }
}
