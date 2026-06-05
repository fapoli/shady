import type { InputModule, SlotType } from './types'
import { ShaderInput } from './ShaderInput'
import { AudioInput } from './AudioInput'
import { ImageInput } from './ImageInput'
import { MicrophoneInput } from './MicrophoneInput'
import { createAudioInputRuntime } from './audioRuntime'
import { createImageInputRuntime } from './imageRuntime'
import { createMicrophoneInputRuntime } from './microphoneRuntime'

const inputModules = new Map<SlotType, InputModule>()
export const INPUT_MODULES: Record<string, InputModule> = {}
export const INPUT_MODULE_TYPES: SlotType[] = []

export function registerInputModule(module: InputModule): void {
  if (inputModules.has(module.type)) {
    throw new Error(`Input module already registered: ${module.type}`)
  }
  inputModules.set(module.type, module)
  INPUT_MODULES[module.type] = module
  INPUT_MODULE_TYPES.push(module.type)
}

export function getInputModule(type: SlotType): InputModule | undefined {
  return inputModules.get(type)
}

export function getInputModules(): InputModule[] {
  return [...inputModules.values()]
}

registerInputModule({
  type: 'shader',
  label: 'shader',
  Editor: ShaderInput,
})

registerInputModule({
  type: 'image',
  label: 'image',
  Editor: ImageInput,
  createRuntime: ctx => createImageInputRuntime(ctx),
})

registerInputModule({
  type: 'audio',
  label: 'audio',
  Editor: AudioInput,
  createRuntime: ctx => createAudioInputRuntime(ctx),
})

registerInputModule({
  type: 'microphone',
  label: 'microphone',
  Editor: MicrophoneInput,
  createRuntime: ctx => createMicrophoneInputRuntime(ctx),
})

export { type SlotType }
