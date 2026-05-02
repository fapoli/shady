import { useState, useEffect, useCallback, useRef } from 'react'
import type * as Monaco from 'monaco-editor'
import { DEFAULT_PROJECT_SETTINGS, PASS_DEFS, PROJECT_TAB, ProjectSettings, ResolutionScale } from '../../shared/types'
import {
  isRunShortcut, isBackToEditorShortcut, isPausePlaybackShortcut, isFpsCounterShortcut, getSwitchTabIndex
} from '../../shared/shortcuts'
import { useMonaco } from './hooks/useMonaco'
import { useWebGL } from './hooks/useWebGL'
import { EditorView } from './components/EditorView'
import { PreviewView } from './components/PreviewView'
import { STARTER_MAIN_SHADER, STARTER_BUFFER_SHADER } from './lib/shaders'
import { INPUT_DRIVER_TYPES, SlotType } from './inputs/registry'
import { exportVideoFrames } from './lib/videoExport'

const DEFAULT_SLOT_TYPES: Record<string, SlotType> = {
  bufferA: 'shader', bufferB: 'shader', bufferC: 'shader', bufferD: 'shader'
}

const AUTOSAVE_DELAY_MS = 500

function readStoredProjectSettings(): ProjectSettings {
  return DEFAULT_PROJECT_SETTINGS
}

function normalizeProjectSettings(value: Partial<ProjectSettings> | null | undefined): ProjectSettings {
  return {
    mouseTracking: value?.mouseTracking === 'hover' ? 'hover' : DEFAULT_PROJECT_SETTINGS.mouseTracking,
    resolutionScale: isResolutionScale(value?.resolutionScale)
      ? value.resolutionScale
      : DEFAULT_PROJECT_SETTINGS.resolutionScale,
  }
}

function isResolutionScale(value: string | undefined): value is ResolutionScale {
  return value === 'auto' || value === '0.5' || value === '1' || value === '2'
}

function isSlotType(value: string | undefined): value is SlotType {
  return !!value && (INPUT_DRIVER_TYPES as readonly string[]).includes(value)
}

export function App() {
  const [activeTabIndex, setActiveTabIndex] = useState(0)
  const [slotTypes, setSlotTypes]           = useState<Record<string, SlotType>>(DEFAULT_SLOT_TYPES)
  const [projectSettings, setProjectSettings] = useState<ProjectSettings>(readStoredProjectSettings)
  const [isPreview, setIsPreview]           = useState(false)
  const [showStats, setShowStats]           = useState(false)
  const [compileError, setCompileError]     = useState<string | null>(null)
  const [exportStatus, setExportStatus]     = useState<string | null>(null)
  const [currentProjectPath, setCurrentProjectPath] = useState<string | null>(null)
  const [autosaveRevision, setAutosaveRevision] = useState(0)

  const slotTypesRef = useRef(slotTypes)
  const projectSettingsRef = useRef(projectSettings)
  const isPreviewRef = useRef(isPreview)
  const autosavePausedRef = useRef(false)
  const previewEditorStateRef = useRef<Monaco.editor.ICodeEditorViewState | null>(null)
  const rootRef = useRef<HTMLElement>(null)
  const resizeSizeRef = useRef<HTMLDivElement>(null)
  const resizeEndFrameRef = useRef<number | null>(null)
  const exportClearTimerRef = useRef<number | null>(null)
  const exportInProgressRef = useRef(false)
  useEffect(() => { slotTypesRef.current = slotTypes }, [slotTypes])
  useEffect(() => { projectSettingsRef.current = projectSettings }, [projectSettings])
  useEffect(() => { isPreviewRef.current = isPreview }, [isPreview])

  const markProjectChanged = useCallback(() => {
    if (autosavePausedRef.current) return
    setCompileError(null)
    setAutosaveRevision(value => value + 1)
  }, [])

  const webgl  = useWebGL(markProjectChanged)
  const monaco = useMonaco(markProjectChanged, startPreview, backToEditor)

  useEffect(() => {
    webgl.setProjectSettings(projectSettings)
  }, [projectSettings, webgl])

  function startPreview() {
    const result = webgl.start(monaco.modelsRef.current, slotTypesRef.current, projectSettingsRef.current)
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
  }

  function backToEditor() {
    const wasPreview = isPreviewRef.current
    webgl.stop()
    if (!wasPreview) return
    setShowStats(false)
    setIsPreview(false)
    window.requestAnimationFrame(() => {
      monaco.layout()
      monaco.restoreViewState(previewEditorStateRef.current)
      monaco.focus()
    })
  }

  const switchToTab = useCallback((index: number, _options?: { silent?: boolean }) => {
    setActiveTabIndex(index)
    if (index !== PROJECT_TAB) {
      const pass = PASS_DEFS[index]
      const type = pass?.isBuffer ? slotTypesRef.current[pass.id] : 'shader'
      if (type === 'shader') {
        monaco.switchModel(index)
        setTimeout(() => monaco.focus(), 0)
      }
    }
  }, [monaco, activeTabIndex])

  const setSlotType = useCallback((slotId: string, type: SlotType) => {
    if (slotTypesRef.current[slotId] === type) return
    const next = { ...slotTypesRef.current, [slotId]: type }
    setSlotTypes(next)
    localStorage.setItem('slotTypes', JSON.stringify(next))
    markProjectChanged()
  }, [markProjectChanged])

  const setProjectSettingValues = useCallback((settings: ProjectSettings) => {
    if (
      projectSettingsRef.current.mouseTracking === settings.mouseTracking &&
      projectSettingsRef.current.resolutionScale === settings.resolutionScale
    ) return
    setProjectSettings(settings)
    markProjectChanged()
  }, [markProjectChanged])

  const buildPayload = useCallback((): SavePayload => {
    const shaders: Record<string, string> = {}
    PASS_DEFS.forEach((def, i) => {
      shaders[def.id] = monaco.modelsRef.current[i]?.getValue() ?? ''
    })

    const channels: Record<string, SaveChannelEntry> = {}
    PASS_DEFS.filter(d => d.isBuffer).forEach(def => {
      const type = slotTypesRef.current[def.id]
      channels[def.id] = webgl.serializeInput(type, def.id)
    })

    return { shaders, channels, settings: projectSettingsRef.current }
  }, [monaco, webgl])

  useEffect(() => {
    if (autosaveRevision === 0 || !currentProjectPath || autosavePausedRef.current) return

    const timer = window.setTimeout(() => {
      if (autosavePausedRef.current) return
      window.projectApi.saveTo(currentProjectPath, buildPayload()).catch(err => {
        console.error('Autosave failed', err)
      })
    }, AUTOSAVE_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [autosaveRevision, buildPayload, currentProjectPath])

  const saveProject = useCallback(async () => {
    const payload = buildPayload()
    if (currentProjectPath) {
      await window.projectApi.saveTo(currentProjectPath, payload)
    } else {
      const result = await window.projectApi.saveAs(payload)
      if (!result.canceled && result.projectPath) setCurrentProjectPath(result.projectPath)
    }
  }, [buildPayload, currentProjectPath])

  const saveProjectAs = useCallback(async () => {
    const result = await window.projectApi.saveAs(buildPayload())
    if (!result.canceled && result.projectPath) setCurrentProjectPath(result.projectPath)
  }, [buildPayload])

  const ensureProjectSaved = useCallback(async (): Promise<string | null> => {
    const payload = buildPayload()
    if (currentProjectPath) {
      await window.projectApi.saveTo(currentProjectPath, payload)
      return currentProjectPath
    }

    const result = await window.projectApi.saveAs(payload)
    if (result.canceled || !result.projectPath) return null
    setCurrentProjectPath(result.projectPath)
    return result.projectPath
  }, [buildPayload, currentProjectPath])

  const exportVideo = useCallback(async () => {
    if (exportInProgressRef.current) return
    exportInProgressRef.current = true
    if (exportClearTimerRef.current !== null) {
      window.clearTimeout(exportClearTimerRef.current)
      exportClearTimerRef.current = null
    }

    let exportId: string | null = null
    try {
      const projectPath = await ensureProjectSaved()
      if (!projectPath) return

      const payload = buildPayload()
      setCompileError(null)
      setExportStatus('exporting video 0%')
      const started = await window.projectApi.startVideoExport(projectPath)
      exportId = started.exportId

      await exportVideoFrames({
        payload,
        slotTypes: slotTypesRef.current,
        writeFrame: frame => window.projectApi.writeVideoExportFrame(started.exportId, frame),
        onProgress: (frame, total) => {
          setExportStatus(`exporting video ${Math.round((frame / total) * 100)}%`)
        },
      })

      const finished = await window.projectApi.finishVideoExport(started.exportId)
      exportId = null
      setExportStatus(`exported ${finished.outputPath}`)
      exportClearTimerRef.current = window.setTimeout(() => {
        exportClearTimerRef.current = null
        setExportStatus(null)
      }, 4000)
    } catch (err) {
      if (exportId) await window.projectApi.cancelVideoExport(exportId).catch(() => {})
      setExportStatus(null)
      setCompileError((err as Error).message)
    } finally {
      exportInProgressRef.current = false
    }
  }, [buildPayload, ensureProjectSaved])

  const applyLoadedProject = useCallback(async (result: LoadedProject) => {
    autosavePausedRef.current = true
    if (isPreview) backToEditor()

    try {
      PASS_DEFS.forEach((def, i) => {
        const source = result.shaders[def.id]
        if (source !== undefined) {
          const model = monaco.modelsRef.current[i]
          if (model) model.setValue(source)
        }
      })

      const newSlotTypes: Record<string, SlotType> = {}
      PASS_DEFS.filter(d => d.isBuffer).forEach(def => {
        const type = result.channels[def.id]?.type
        newSlotTypes[def.id] = isSlotType(type) ? type : 'shader'
      })
      setSlotTypes(newSlotTypes)
      localStorage.setItem('slotTypes', JSON.stringify(newSlotTypes))

      const loadedSettings = normalizeProjectSettings(result.settings)
      setProjectSettings(loadedSettings)

      await webgl.applyProjectChannels(result.channels)

      setCurrentProjectPath(result.projectPath)
      setActiveTabIndex(0)
      monaco.switchModel(0)
      setTimeout(() => monaco.focus(), 0)
    } finally {
      window.setTimeout(() => { autosavePausedRef.current = false }, 0)
    }
  }, [monaco, webgl, isPreview])

  const loadProject = useCallback(async () => {
    const result = await window.projectApi.load()
    if (result) await applyLoadedProject(result)
  }, [applyLoadedProject])

  const loadRecentProject = useCallback(async (projectPath: string) => {
    try {
      await applyLoadedProject(await window.projectApi.loadRecent(projectPath))
    } catch (err) {
      console.error('Failed to open recent project', err)
    }
  }, [applyLoadedProject])

  const newProject = useCallback(() => {
    autosavePausedRef.current = true
    if (isPreview) backToEditor()

    try {
      PASS_DEFS.forEach((def, i) => {
        const model   = monaco.modelsRef.current[i]
        const starter = def.isBuffer ? STARTER_BUFFER_SHADER : STARTER_MAIN_SHADER
        if (model) model.setValue(starter)
      })

      setSlotTypes(DEFAULT_SLOT_TYPES)
      localStorage.setItem('slotTypes', JSON.stringify(DEFAULT_SLOT_TYPES))
      setProjectSettings(DEFAULT_PROJECT_SETTINGS)

      PASS_DEFS.filter(d => d.isBuffer).forEach(def => {
        INPUT_DRIVER_TYPES.forEach(type => webgl.clearInput(type, def.id))
      })

      setCurrentProjectPath(null)
      setActiveTabIndex(0)
      monaco.switchModel(0)
      setTimeout(() => monaco.focus(), 0)
    } finally {
      window.setTimeout(() => { autosavePausedRef.current = false }, 0)
    }
  }, [monaco, webgl, isPreview])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isFpsCounterShortcut(e)) {
        if (!isPreviewRef.current) return
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        setShowStats(value => !value)
        return
      }
      if (isRunShortcut(e))          { e.preventDefault(); startPreview(); return }
      if (isBackToEditorShortcut(e)) { e.preventDefault(); backToEditor(); return }
      if (isPreviewRef.current && isPausePlaybackShortcut(e)) {
        e.preventDefault()
        webgl.togglePlaybackPaused()
        return
      }
      if (isPreviewRef.current) return
      const i = getSwitchTabIndex(e)
      if (i !== -1)                  { e.preventDefault(); switchToTab(i) }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [switchToTab, webgl])

  useEffect(() => {
    const unNew    = window.projectApi.onMenuNew(newProject)
    const unOpen   = window.projectApi.onMenuOpen(loadProject)
    const unOpenRecent = window.projectApi.onMenuOpenRecent(loadRecentProject)
    const unSave   = window.projectApi.onMenuSave(saveProject)
    const unSaveAs = window.projectApi.onMenuSaveAs(saveProjectAs)
    const unExportVideo = window.projectApi.onMenuExportVideo(exportVideo)
    const unToggleFps = window.projectApi.onMenuToggleFps(() => {
      if (isPreviewRef.current) setShowStats(value => !value)
    })
    return () => { unNew(); unOpen(); unOpenRecent(); unSave(); unSaveAs(); unExportVideo(); unToggleFps() }
  }, [newProject, loadProject, loadRecentProject, saveProject, saveProjectAs, exportVideo])

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
      if (exportClearTimerRef.current !== null) window.clearTimeout(exportClearTimerRef.current)
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
        slotTypes={slotTypes}
        projectSettings={projectSettings}
        hidden={isPreview}
        onSwitch={switchToTab}
        onSetSlotType={setSlotType}
        onSetProjectSettings={setProjectSettingValues}
      />

      {compileError && !isPreview && (
        <div className="compile-error-panel" onClick={() => setCompileError(null)}>
          {compileError}
        </div>
      )}

      {exportStatus && (
        <div className="export-status-panel">
          {exportStatus}
        </div>
      )}

      <PreviewView
        canvasRef={webgl.canvasRef}
        stats={webgl.stats}
        showStats={showStats}
        hidden={!isPreview}
      />

      <div className="resize-overlay" aria-hidden="true">
        <div ref={resizeSizeRef} className="resize-size">{window.innerWidth} x {window.innerHeight}</div>
      </div>
    </main>
  )
}
