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

export interface ProjectSettings {
  mouseTracking: MouseTrackingMode
}

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  mouseTracking: 'drag',
}
