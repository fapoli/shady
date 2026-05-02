import type { InputDriver } from './types'
import { ShaderInput } from './ShaderInput'
import { AudioInput } from './AudioInput'
import { ImageInput } from './ImageInput'
import { MicrophoneInput } from './MicrophoneInput'
import { createAudioInputRuntime } from './audioRuntime'
import { createImageInputRuntime } from './imageRuntime'
import { createMicrophoneInputRuntime } from './microphoneRuntime'

export const INPUT_DRIVERS = {
  shader: {
    type: 'shader',
    label: 'shader',
    Editor: ShaderInput,
  },
  audio: {
    type: 'audio',
    label: 'audio',
    Editor: AudioInput,
    createRuntime: ctx => createAudioInputRuntime(ctx.getGl, ctx.getDroppedFilePath, ctx.setAudioNames, ctx.setResourceErrors),
  },
  image: {
    type: 'image',
    label: 'image',
    Editor: ImageInput,
    createRuntime: ctx => createImageInputRuntime(ctx.getGl, ctx.getDroppedFilePath, ctx.setImageNames, ctx.setResourceErrors),
  },
  microphone: {
    type: 'microphone',
    label: 'microphone',
    Editor: MicrophoneInput,
    createRuntime: ctx => createMicrophoneInputRuntime(ctx.getGl),
  },
} as const satisfies Record<string, InputDriver>

export type SlotType = keyof typeof INPUT_DRIVERS

export const INPUT_DRIVER_TYPES = Object.keys(INPUT_DRIVERS) as SlotType[]
