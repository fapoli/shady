import type { SlotType } from './registry'
import type { InputRuntime } from './types'

export function getRuntimeInputTexture(
  type: SlotType,
  slotId: string,
  getShaderTexture: (slotId: string) => WebGLTexture | null,
  getRuntime: (type: SlotType) => InputRuntime | null,
): WebGLTexture | null {
  if (type === 'shader') return getShaderTexture(slotId)
  return getRuntime(type)?.getTexture(slotId) ?? null
}
