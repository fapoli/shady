import type { ComponentType, Dispatch, RefObject, SetStateAction } from 'react'
import type { WebGLHandle } from '../hooks/useWebGL'

export interface InputEditorProps {
  slotId: string
  hidden?: boolean
  editorRef: RefObject<HTMLDivElement | null>
  webgl: WebGLHandle
}

type NamesState = Record<string, string | null>
type ErrorsState = Record<string, string | null>

export interface InputRuntimeContext {
  getGl(): WebGL2RenderingContext
  getDroppedFilePath(file: File): string | null
  setAudioNames: Dispatch<SetStateAction<NamesState>>
  setImageNames: Dispatch<SetStateAction<NamesState>>
  setResourceErrors: Dispatch<SetStateAction<ErrorsState>>
}

export interface InputRuntime {
  load?(slotId: string, file: File): Promise<void>
  prepare?(slotId: string): void
  update?(slotId: string): void
  pause?(slotIds: readonly string[]): void
  resume?(slotIds: readonly string[]): void
  stop?(slotIds: readonly string[]): void
  clear?(slotId: string): void
  restoreLocal?(slotId: string): Promise<void>
  applyProjectChannel?(slotId: string, channel?: LoadedChannel): Promise<void>
  serializeProjectChannel?(slotId: string): Partial<SaveChannelEntry>
  getTexture(slotId: string): WebGLTexture | null
}

export interface InputDriver {
  type: string
  label: string
  Editor: ComponentType<InputEditorProps>
  createRuntime?(ctx: InputRuntimeContext): InputRuntime
}
