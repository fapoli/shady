import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_PROJECT_SETTINGS,
  PASS_DEFS,
  type LoadedProject,
  type ProjectSettings,
  type ResolutionScale,
  type SaveChannelEntry,
  type SavePayload,
} from '../../../shared/types'
import { INPUT_MODULE_TYPES, type SlotType } from '../inputs/registry'
import { STARTER_BUFFER_SHADER, STARTER_MAIN_SHADER } from '../lib/shaders'
import type { MonacoHandle } from './useMonaco'
import { useVideoExport } from './useVideoExport'
import type { WebGLHandle } from './webglTypes'

export const DEFAULT_SLOT_TYPES: Record<string, SlotType> = {
  bufferA: 'shader',
  bufferB: 'shader',
  bufferC: 'shader',
  bufferD: 'shader',
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
  return !!value && (INPUT_MODULE_TYPES as readonly string[]).includes(value)
}

interface Options {
  monaco: MonacoHandle
  webgl: WebGLHandle
  isPreview: boolean
  backToEditor(): void
  switchToTab(index: number): void
  setCompileError(message: string | null): void
}

export function useProject({
  monaco,
  webgl,
  isPreview,
  backToEditor,
  switchToTab,
  setCompileError,
}: Options) {
  const [slotTypes, setSlotTypes] = useState<Record<string, SlotType>>(DEFAULT_SLOT_TYPES)
  const [projectSettings, setProjectSettings] = useState<ProjectSettings>(readStoredProjectSettings)
  const [currentProjectPath, setCurrentProjectPath] = useState<string | null>(null)
  const [autosaveRevision, setAutosaveRevision] = useState(0)

  const slotTypesRef = useRef(slotTypes)
  const projectSettingsRef = useRef(projectSettings)
  const autosavePausedRef = useRef(false)
  useEffect(() => { slotTypesRef.current = slotTypes }, [slotTypes])
  useEffect(() => { projectSettingsRef.current = projectSettings }, [projectSettings])

  useEffect(() => {
    webgl.setProjectSettings(projectSettings)
  }, [projectSettings, webgl])

  const markProjectChanged = useCallback(() => {
    if (autosavePausedRef.current) return
    setCompileError(null)
    setAutosaveRevision(value => value + 1)
  }, [setCompileError])

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
      return
    }

    const result = await window.projectApi.saveAs(payload)
    if (!result.canceled && result.projectPath) setCurrentProjectPath(result.projectPath)
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

  const { exportStatus, exportVideo } = useVideoExport({
    buildPayload,
    ensureProjectSaved,
    getSlotTypes: () => slotTypesRef.current,
    setCompileError,
  })

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

      setProjectSettings(normalizeProjectSettings(result.settings))
      await webgl.applyProjectChannels(result.channels)

      setCurrentProjectPath(result.projectPath)
      switchToTab(0)
    } finally {
      window.setTimeout(() => { autosavePausedRef.current = false }, 0)
    }
  }, [backToEditor, isPreview, monaco, switchToTab, webgl])

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
        const model = monaco.modelsRef.current[i]
        const starter = def.isBuffer ? STARTER_BUFFER_SHADER : STARTER_MAIN_SHADER
        if (model) model.setValue(starter)
      })

      setSlotTypes(DEFAULT_SLOT_TYPES)
      localStorage.setItem('slotTypes', JSON.stringify(DEFAULT_SLOT_TYPES))
      setProjectSettings(DEFAULT_PROJECT_SETTINGS)

      PASS_DEFS.filter(d => d.isBuffer).forEach(def => {
        INPUT_MODULE_TYPES.forEach(type => webgl.clearInput(type, def.id))
      })

      setCurrentProjectPath(null)
      switchToTab(0)
    } finally {
      window.setTimeout(() => { autosavePausedRef.current = false }, 0)
    }
  }, [backToEditor, isPreview, monaco, switchToTab, webgl])

  return useMemo(() => ({
    slotTypes,
    slotTypesRef,
    projectSettings,
    projectSettingsRef,
    exportStatus,
    markProjectChanged,
    setSlotType,
    setProjectSettingValues,
    saveProject,
    saveProjectAs,
    loadProject,
    loadRecentProject,
    newProject,
    exportVideo,
  }), [
    exportStatus,
    exportVideo,
    loadProject,
    loadRecentProject,
    markProjectChanged,
    newProject,
    projectSettings,
    saveProject,
    saveProjectAs,
    setProjectSettingValues,
    setSlotType,
    slotTypes,
  ])
}
