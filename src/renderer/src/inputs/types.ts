import type { ComponentType, RefObject } from 'react'
import type { LoadedChannel, SaveChannelEntry } from '../../../shared/types'
import type { WebGLHandle } from '../hooks/webglTypes'

export type SlotType = string

export interface InputSlotState {
  label?: string | null
  active?: boolean
  error?: string | null
}

export interface InputEditorProps {
  slotId: string
  hidden?: boolean
  editorRef: RefObject<HTMLDivElement | null>
  webgl: WebGLHandle
}

export interface InputRuntimeContext {
  getGl(): WebGL2RenderingContext
  getDroppedFilePath(file: File): string | null
  setSlotState(slotId: string, patch: Partial<InputSlotState>): void
}

export interface InputRuntime {
  activate?(slotId: string): Promise<void>
  loadFile?(slotId: string, file: File): Promise<void>
  prepare?(slotId: string): void
  update?(slotId: string): void
  pause?(slotIds: readonly string[]): void
  resume?(slotIds: readonly string[]): void
  stop?(slotIds: readonly string[]): void
  clear?(slotId: string): void
  applyProjectChannel?(slotId: string, channel?: LoadedChannel): Promise<void>
  serializeProjectChannel?(slotId: string): Partial<SaveChannelEntry>
  getTexture(slotId: string): WebGLTexture | null
}

export interface InputModule {
  type: string
  label: string
  Editor: ComponentType<InputEditorProps>
  createRuntime?(ctx: InputRuntimeContext): InputRuntime
}
