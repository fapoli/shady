export interface PassDef {
  id: string
  label: string
  isBuffer: boolean
}

export const PASS_DEFS: PassDef[] = [
  { id: 'main',    label: 'main',     isBuffer: false },
  { id: 'bufferA', label: 'buffer a', isBuffer: true  },
  { id: 'bufferB', label: 'buffer b', isBuffer: true  },
  { id: 'bufferC', label: 'buffer c', isBuffer: true  },
  { id: 'bufferD', label: 'buffer d', isBuffer: true  },
]

export const BUFFER_IDS = ['bufferA', 'bufferB', 'bufferC', 'bufferD'] as const
export const PROJECT_TAB = 5

export type MouseTrackingMode = 'drag' | 'hover'
export type ResolutionScale = 'auto' | '0.5' | '1' | '2'

export interface ProjectSettings {
  mouseTracking: MouseTrackingMode
  resolutionScale: ResolutionScale
}

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  mouseTracking: 'drag',
  resolutionScale: 'auto',
}

export interface SaveChannelEntry {
  type: string
  filePath?: string
  fileName?: string
}

export interface SavePayload {
  shaders: Record<string, string>
  channels: Record<string, SaveChannelEntry>
  settings?: ProjectSettings
}

export interface LoadedChannel {
  type: string
  filePath?: string
  fileName?: string
}

export interface LoadedProject {
  shaders: Record<string, string>
  channels: Record<string, LoadedChannel>
  settings?: Partial<ProjectSettings>
  projectPath: string
}

export interface SaveProjectResult {
  canceled?: boolean
  projectPath?: string
}

export interface VideoExportSession {
  exportId: string
  outputPath: string
}

export interface VideoExportResult {
  outputPath: string
}
