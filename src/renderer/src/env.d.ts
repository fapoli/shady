/// <reference types="vite/client" />

type MouseTrackingMode = 'drag' | 'hover'
type ResolutionScale = 'auto' | '0.5' | '1' | '2'

interface ProjectSettings {
  mouseTracking: MouseTrackingMode
  resolutionScale: ResolutionScale
}

interface SaveChannelEntry {
  type: string
  filePath?: string
  fileName?: string
}

interface SavePayload {
  shaders: Record<string, string>
  channels: Record<string, SaveChannelEntry>
  settings?: ProjectSettings
}

interface LoadedChannel {
  type: string
  filePath?: string
  fileName?: string
}

interface LoadedProject {
  shaders: Record<string, string>
  channels: Record<string, LoadedChannel>
  settings?: ProjectSettings
  projectPath: string
}

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
    saveAs(payload: SavePayload): Promise<{ canceled: boolean; projectPath?: string }>
    saveTo(projectPath: string, payload: SavePayload): Promise<{ projectPath: string }>
    load(): Promise<LoadedProject | null>
    loadRecent(projectPath: string): Promise<LoadedProject>
    onMenuNew(cb: () => void):    () => void
    onMenuOpen(cb: () => void):   () => void
    onMenuOpenRecent(cb: (projectPath: string) => void): () => void
    onMenuSave(cb: () => void):   () => void
    onMenuSaveAs(cb: () => void): () => void
    onMenuExportVideo(cb: () => void): () => void
    onMenuToggleFps(cb: () => void): () => void
    startVideoExport(projectPath: string): Promise<{ exportId: string; outputPath: string }>
    writeVideoExportFrame(exportId: string, frame: Uint8Array): Promise<void>
    finishVideoExport(exportId: string): Promise<{ outputPath: string }>
    cancelVideoExport(exportId: string): Promise<void>
  }
}
