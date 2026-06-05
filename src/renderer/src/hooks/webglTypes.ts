import type * as Monaco from 'monaco-editor'
import type { LoadedChannel, ProjectSettings, SaveChannelEntry } from '../../../shared/types'
import type { SlotType } from '../inputs/registry'
import type { InputSlotState } from '../inputs/types'
import type { CompiledPass, FboPair } from '../lib/webgl'

export interface PassState {
  compiled: CompiledPass | null
  fboPair: FboPair | null
}

export interface CompileDiagnostic {
  passIndex: number
  line: number
  message: string
}

export interface CompileResult {
  messages: string[]
  diagnostics: CompileDiagnostic[]
}

export interface RenderStats {
  fps: number
  frameMs: number
  width: number
  height: number
  dpr: number
  scale: number
}

export interface WebGLHandle {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  stats: RenderStats
  inputStates: Record<string, InputSlotState>
  start(
    models: (Monaco.editor.ITextModel | null)[],
    slotTypes: Record<string, SlotType>,
    projectSettings: ProjectSettings,
  ): CompileResult
  setProjectSettings(settings: ProjectSettings): void
  togglePlaybackPaused(): boolean
  stop(): void
  cleanup(): void
  activateInput(type: SlotType, slotId: string): Promise<void>
  loadInput(type: SlotType, slotId: string, file: File): Promise<void>
  clearInput(type: SlotType, slotId: string): void
  serializeInput(type: SlotType, slotId: string): SaveChannelEntry
  applyProjectChannels(channels: Record<string, LoadedChannel>): Promise<void>
}
