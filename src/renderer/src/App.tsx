import { useState, useEffect, useCallback, useRef } from 'react'
import { PASS_DEFS, INPUTS_TAB } from '../../shared/types'
import { isRunShortcut, isBackToEditorShortcut, getSwitchTabIndex } from '../../shared/shortcuts'
import { useMonaco } from './hooks/useMonaco'
import { useWebGL } from './hooks/useWebGL'
import { EditorView } from './components/EditorView'
import { PreviewView } from './components/PreviewView'
import { STARTER_MAIN_SHADER, STARTER_BUFFER_SHADER } from './lib/shaders'
import { playMode } from './lib/feedback-audio'
import { INPUT_DRIVER_TYPES, SlotType } from './inputs/registry'

const DEFAULT_SLOT_TYPES: Record<string, SlotType> = {
  bufferA: 'shader', bufferB: 'shader', bufferC: 'shader', bufferD: 'shader'
}

function isSlotType(value: string | undefined): value is SlotType {
  return !!value && (INPUT_DRIVER_TYPES as readonly string[]).includes(value)
}

export function App() {
  const [activeTabIndex, setActiveTabIndex] = useState(0)
  const [slotTypes, setSlotTypes]           = useState<Record<string, SlotType>>(DEFAULT_SLOT_TYPES)
  const [isPreview, setIsPreview]           = useState(false)
  const [previewErrors, setPreviewErrors]   = useState<string[]>([])
  const [currentProjectPath, setCurrentProjectPath] = useState<string | null>(null)

  const slotTypesRef = useRef(slotTypes)
  const isPreviewRef = useRef(isPreview)
  const rootRef = useRef<HTMLElement>(null)
  const resizeSizeRef = useRef<HTMLDivElement>(null)
  useEffect(() => { slotTypesRef.current = slotTypes }, [slotTypes])
  useEffect(() => { isPreviewRef.current = isPreview }, [isPreview])

  const webgl  = useWebGL()
  const monaco = useMonaco(useCallback(() => {}, []), startPreview, backToEditor)

  function startPreview() {
    const errors = webgl.start(monaco.modelsRef.current, slotTypesRef.current)
    if (errors.length > 0) { setPreviewErrors(errors); return }
    setPreviewErrors([])
    setIsPreview(true)
  }

  function backToEditor() {
    webgl.stop()
    setIsPreview(false)
  }

  const switchToTab = useCallback((index: number) => {
    if (index !== activeTabIndex) playMode()
    setActiveTabIndex(index)
    if (index !== INPUTS_TAB) {
      const pass = PASS_DEFS[index]
      const type = pass?.isBuffer ? slotTypesRef.current[pass.id] : 'shader'
      if (type === 'shader') {
        monaco.switchModel(index)
        setTimeout(() => monaco.focus(), 0)
      }
    }
  }, [monaco, activeTabIndex])

  const setSlotType = useCallback((slotId: string, type: SlotType) => {
    setSlotTypes(prev => {
      const next = { ...prev, [slotId]: type }
      localStorage.setItem('slotTypes', JSON.stringify(next))
      return next
    })
  }, [])

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

    return { shaders, channels }
  }, [monaco, webgl])

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

  const loadProject = useCallback(async () => {
    const result = await window.projectApi.load()
    if (!result) return

    if (isPreview) backToEditor()

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

    await webgl.applyProjectChannels(result.channels)

    setCurrentProjectPath(result.projectPath)
    setActiveTabIndex(0)
    monaco.switchModel(0)
    setTimeout(() => monaco.focus(), 0)
  }, [monaco, webgl, isPreview])

  const newProject = useCallback(() => {
    if (isPreview) backToEditor()

    PASS_DEFS.forEach((def, i) => {
      const model   = monaco.modelsRef.current[i]
      const starter = def.isBuffer ? STARTER_BUFFER_SHADER : STARTER_MAIN_SHADER
      if (model) model.setValue(starter)
    })

    setSlotTypes(DEFAULT_SLOT_TYPES)

    PASS_DEFS.filter(d => d.isBuffer).forEach(def => {
      INPUT_DRIVER_TYPES.forEach(type => webgl.clearInput(type, def.id))
    })

    setCurrentProjectPath(null)
    setActiveTabIndex(0)
    monaco.switchModel(0)
    setTimeout(() => monaco.focus(), 0)
  }, [monaco, webgl, isPreview])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isRunShortcut(e))          { e.preventDefault(); startPreview(); return }
      if (isBackToEditorShortcut(e)) { e.preventDefault(); backToEditor(); return }
      const i = getSwitchTabIndex(e)
      if (i !== -1)                  { e.preventDefault(); switchToTab(i) }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [switchToTab])

  useEffect(() => {
    const unNew    = window.projectApi.onMenuNew(newProject)
    const unOpen   = window.projectApi.onMenuOpen(loadProject)
    const unSave   = window.projectApi.onMenuSave(saveProject)
    const unSaveAs = window.projectApi.onMenuSaveAs(saveProjectAs)
    return () => { unNew(); unOpen(); unSave(); unSaveAs() }
  }, [newProject, loadProject, saveProject, saveProjectAs])

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
        rootRef.current?.classList.remove('is-resizing')
        monaco.layout()
        return
      }

      if (isPreviewRef.current) return
      rootRef.current?.classList.add('is-resizing')
      if (resizeSizeRef.current) resizeSizeRef.current.textContent = `${state.width} x ${state.height}`
    })
  }, [monaco])

  useEffect(() => {
    const setFullscreenClass = (fullscreen: boolean) => {
      document.documentElement.classList.toggle('is-fullscreen', fullscreen)
    }

    window.appMeta.isFullscreen().then(setFullscreenClass)
    return window.appMeta.onFullscreenChange(setFullscreenClass)
  }, [])

  useEffect(() => {
    if (previewErrors.length === 0) return
    const dismiss = () => setPreviewErrors([])
    document.addEventListener('click', dismiss)
    return () => document.removeEventListener('click', dismiss)
  }, [previewErrors.length])

  return (
    <main ref={rootRef} className="root">
      <EditorView
        monaco={monaco}
        webgl={webgl}
        activeTabIndex={activeTabIndex}
        slotTypes={slotTypes}
        hidden={isPreview}
        onSwitch={switchToTab}
        onSetSlotType={setSlotType}
      />

      <PreviewView
        canvasRef={webgl.canvasRef}
        errors={previewErrors}
        hidden={!isPreview}
      />

      {previewErrors.length > 0 && !isPreview && (
        <pre className="error" onClick={() => setPreviewErrors([])}>{previewErrors.join('\n\n')}</pre>
      )}

      <div className="resize-overlay" aria-hidden="true">
        <div ref={resizeSizeRef} className="resize-size">{window.innerWidth} x {window.innerHeight}</div>
      </div>
    </main>
  )
}
