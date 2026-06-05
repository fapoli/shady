import type { LoadedChannel, SaveChannelEntry } from '../../../shared/types'
import { createImageTexture } from '../lib/webgl'
import { createFileChannelStore } from './fileChannelStore'
import type { InputRuntimeContext } from './types'

const MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
}

export interface ImageInputRuntime {
  loadFile(slotId: string, file: File): Promise<void>
  clear(slotId: string): void
  clearSlot(slotId: string, updateName?: boolean): void
  applyProjectChannel(slotId: string, channel?: LoadedChannel): Promise<void>
  serializeProjectChannel(slotId: string): Partial<SaveChannelEntry>
  getTexture(slotId: string): WebGLTexture | null
}

export function createImageInputRuntime(
  { getGl, getDroppedFilePath, setSlotState }: InputRuntimeContext,
): ImageInputRuntime {
  const slotImageTex: Record<string, WebGLTexture | null> = {}
  const files = createFileChannelStore('image', setSlotState)

  async function createTextureFromPath(filePath: string): Promise<WebGLTexture> {
    const raw = await window.api.readFile(filePath)
    const arrayBuffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer
    const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
    const blob = new Blob([arrayBuffer], { type: MIME_MAP[ext] ?? 'image/png' })
    const bitmap = await createImageBitmap(blob)
    const texture = createImageTexture(getGl(), bitmap)
    bitmap.close()
    return texture
  }

  function setTexture(slotId: string, texture: WebGLTexture): void {
    const prev = slotImageTex[slotId]
    if (prev) getGl().deleteTexture(prev)
    slotImageTex[slotId] = texture
  }

  async function loadFile(slotId: string, file: File): Promise<void> {
    const filePath = getDroppedFilePath(file)
    const bitmap = await createImageBitmap(file)
    setTexture(slotId, createImageTexture(getGl(), bitmap))
    bitmap.close()
    files.remember(slotId, filePath, file.name)
  }

  function clearSlot(slotId: string, updateName = true): void {
    const tex = slotImageTex[slotId]
    if (tex) getGl().deleteTexture(tex)
    slotImageTex[slotId] = null
    files.clear(slotId, updateName)
  }

  function clear(slotId: string): void {
    clearSlot(slotId)
  }

  async function applyProjectChannel(slotId: string, channel?: LoadedChannel): Promise<void> {
    clearSlot(slotId, false)
    if (channel?.type !== 'image' || !channel.filePath) {
      files.setName(slotId, null)
      return
    }
    try {
      setTexture(slotId, await createTextureFromPath(channel.filePath))
      files.remember(slotId, channel.filePath, files.channelName(channel))
    } catch {
      files.setName(slotId, null)
      files.setError(slotId, `missing image: ${files.channelName(channel) || 'file'}`)
    }
  }

  function serializeProjectChannel(slotId: string): Partial<SaveChannelEntry> {
    return files.serialize(slotId)
  }

  function getTexture(slotId: string): WebGLTexture | null {
    return slotImageTex[slotId] ?? null
  }

  return { loadFile, clear, clearSlot, applyProjectChannel, serializeProjectChannel, getTexture }
}
