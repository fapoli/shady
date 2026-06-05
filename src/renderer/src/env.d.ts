/// <reference types="vite/client" />

import type {
  LoadedProject,
  SavePayload,
  SaveProjectResult,
  VideoExportResult,
  VideoExportSession,
} from '../../shared/types'

declare global {
  interface Window {
    api: {
      readFile(filePath: string): Promise<Uint8Array>
      getPathForFile(file: File): string
    }
    appMeta: {
      platform: string
      isFullscreen(): Promise<boolean>
      rendererReady(): void
      requestMediaAccess(mediaType: 'microphone' | 'camera'): Promise<boolean>
      onFullscreenChange(cb: (fullscreen: boolean) => void): () => void
      onResizeStateChange(cb: (state: { active: boolean; width: number; height: number }) => void): () => void
    }
    MonacoEnvironment: {
      getWorker(_moduleId: string, _label: string): Worker
    }
    projectApi: {
      saveAs(payload: SavePayload): Promise<SaveProjectResult>
      saveTo(projectPath: string, payload: SavePayload): Promise<SaveProjectResult>
      load(): Promise<LoadedProject | null>
      loadRecent(projectPath: string): Promise<LoadedProject>
      onMenuNew(cb: () => void):    () => void
      onMenuOpen(cb: () => void):   () => void
      onMenuOpenRecent(cb: (projectPath: string) => void): () => void
      onMenuSave(cb: () => void):   () => void
      onMenuSaveAs(cb: () => void): () => void
      onMenuExportVideo(cb: () => void): () => void
      onMenuToggleFps(cb: () => void): () => void
      startVideoExport(projectPath: string): Promise<VideoExportSession>
      writeVideoExportFrame(exportId: string, frame: Uint8Array): Promise<void>
      finishVideoExport(exportId: string): Promise<VideoExportResult>
      cancelVideoExport(exportId: string): Promise<void>
    }
  }
}

export {}
