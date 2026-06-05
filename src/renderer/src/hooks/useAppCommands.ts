import { useEffect, useRef } from 'react'
import {
  getSwitchTabIndex,
  isBackToEditorShortcut,
  isFpsCounterShortcut,
  isPausePlaybackShortcut,
  isRunShortcut,
} from '../../../shared/shortcuts'
import type { WebGLHandle } from './webglTypes'

interface Options {
  isPreview: boolean
  webgl: WebGLHandle
  startPreview(): void
  backToEditor(): void
  switchToTab(index: number): void
  toggleStats(): void
  project: {
    newProject(): void
    loadProject(): Promise<void>
    loadRecentProject(projectPath: string): Promise<void>
    saveProject(): Promise<void>
    saveProjectAs(): Promise<void>
    exportVideo(): Promise<void>
  }
}

export function useAppCommands({
  isPreview,
  webgl,
  startPreview,
  backToEditor,
  switchToTab,
  toggleStats,
  project,
}: Options): void {
  const isPreviewRef = useRef(isPreview)
  const callbacksRef = useRef({
    startPreview,
    backToEditor,
    switchToTab,
    toggleStats,
  })
  useEffect(() => { isPreviewRef.current = isPreview }, [isPreview])
  useEffect(() => {
    callbacksRef.current = { startPreview, backToEditor, switchToTab, toggleStats }
  }, [backToEditor, startPreview, switchToTab, toggleStats])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isFpsCounterShortcut(e)) {
        if (!isPreviewRef.current) return
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        callbacksRef.current.toggleStats()
        return
      }
      if (isRunShortcut(e)) { e.preventDefault(); callbacksRef.current.startPreview(); return }
      if (isBackToEditorShortcut(e)) { e.preventDefault(); callbacksRef.current.backToEditor(); return }
      if (isPreviewRef.current && isPausePlaybackShortcut(e)) {
        e.preventDefault()
        webgl.togglePlaybackPaused()
        return
      }
      if (isPreviewRef.current) return
      const i = getSwitchTabIndex(e)
      if (i !== -1) { e.preventDefault(); callbacksRef.current.switchToTab(i) }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [webgl])

  useEffect(() => {
    const unNew = window.projectApi.onMenuNew(project.newProject)
    const unOpen = window.projectApi.onMenuOpen(project.loadProject)
    const unOpenRecent = window.projectApi.onMenuOpenRecent(project.loadRecentProject)
    const unSave = window.projectApi.onMenuSave(project.saveProject)
    const unSaveAs = window.projectApi.onMenuSaveAs(project.saveProjectAs)
    const unExportVideo = window.projectApi.onMenuExportVideo(project.exportVideo)
    const unToggleFps = window.projectApi.onMenuToggleFps(() => {
      if (isPreviewRef.current) callbacksRef.current.toggleStats()
    })
    return () => {
      unNew()
      unOpen()
      unOpenRecent()
      unSave()
      unSaveAs()
      unExportVideo()
      unToggleFps()
    }
  }, [project, toggleStats])
}
