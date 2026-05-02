import type { Dispatch, SetStateAction } from 'react'
import { createImageTexture } from '../lib/webgl'

type NamesState = Record<string, string | null>
type ErrorsState = Record<string, string | null>

const MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
}

export interface ImageInputRuntime {
  load(slotId: string, file: File): Promise<void>
  clear(slotId: string): void
  clearSlot(slotId: string, updateName?: boolean): void
  restoreLocal(slotId: string): Promise<void>
  applyProjectChannel(slotId: string, channel?: LoadedChannel): Promise<void>
  serializeProjectChannel(slotId: string): Partial<SaveChannelEntry>
  getTexture(slotId: string): WebGLTexture | null
}

export function createImageInputRuntime(
  getGl: () => WebGL2RenderingContext,
  getDroppedFilePath: (file: File) => string | null,
  setNames: Dispatch<SetStateAction<NamesState>>,
  setErrors: Dispatch<SetStateAction<ErrorsState>>,
): ImageInputRuntime {
  const slotImageTex: Record<string, WebGLTexture | null> = {}

  function setName(slotId: string, name: string | null): void {
    setNames(prev => ({ ...prev, [slotId]: name }))
  }

  function setError(slotId: string, error: string | null): void {
    setErrors(prev => ({ ...prev, [slotId]: error }))
  }

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

  async function load(slotId: string, file: File): Promise<void> {
    const filePath = getDroppedFilePath(file)
    const bitmap = await createImageBitmap(file)
    setTexture(slotId, createImageTexture(getGl(), bitmap))
    bitmap.close()
    if (filePath) localStorage.setItem(`image_path_${slotId}`, filePath)
    else localStorage.removeItem(`image_path_${slotId}`)
    localStorage.setItem(`image_name_${slotId}`, file.name)
    setName(slotId, file.name)
    setError(slotId, null)
  }

  function clearSlot(slotId: string, updateName = true): void {
    const tex = slotImageTex[slotId]
    if (tex) getGl().deleteTexture(tex)
    slotImageTex[slotId] = null
    localStorage.removeItem(`image_path_${slotId}`)
    localStorage.removeItem(`image_name_${slotId}`)
    if (updateName) {
      setName(slotId, null)
      setError(slotId, null)
    }
  }

  function clear(slotId: string): void {
    clearSlot(slotId)
  }

  async function restoreLocal(slotId: string): Promise<void> {
    const filePath = localStorage.getItem(`image_path_${slotId}`)
    const fileName = localStorage.getItem(`image_name_${slotId}`)
    if (!filePath) return
    try {
      setTexture(slotId, await createTextureFromPath(filePath))
      setName(slotId, fileName)
      setError(slotId, null)
    } catch {
      localStorage.removeItem(`image_path_${slotId}`)
      localStorage.removeItem(`image_name_${slotId}`)
      setError(slotId, `missing image: ${fileName ?? filePath.split('/').pop() ?? 'file'}`)
    }
  }

  async function applyProjectChannel(slotId: string, channel?: LoadedChannel): Promise<void> {
    clearSlot(slotId, false)
    if (channel?.type !== 'image' || !channel.filePath) {
      setName(slotId, null)
      return
    }
    try {
      setTexture(slotId, await createTextureFromPath(channel.filePath))
      const name = channel.fileName ?? channel.filePath.split('/').pop() ?? ''
      localStorage.setItem(`image_path_${slotId}`, channel.filePath)
      localStorage.setItem(`image_name_${slotId}`, name)
      setName(slotId, name)
      setError(slotId, null)
    } catch {
      setName(slotId, null)
      setError(slotId, `missing image: ${channel.fileName ?? channel.filePath.split('/').pop() ?? 'file'}`)
    }
  }

  function serializeProjectChannel(slotId: string): Partial<SaveChannelEntry> {
    return {
      filePath: localStorage.getItem(`image_path_${slotId}`) ?? undefined,
      fileName: localStorage.getItem(`image_name_${slotId}`) ?? undefined,
    }
  }

  function getTexture(slotId: string): WebGLTexture | null {
    return slotImageTex[slotId] ?? null
  }

  return { load, clear, clearSlot, restoreLocal, applyProjectChannel, serializeProjectChannel, getTexture }
}
