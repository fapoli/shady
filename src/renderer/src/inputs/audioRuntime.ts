import type { Dispatch, SetStateAction } from 'react'
import { createAudioInstance, AudioInstance } from '../lib/audio'

type NamesState = Record<string, string | null>

export interface AudioInputRuntime {
  load(slotId: string, file: File): Promise<void>
  clear(slotId: string): void
  clearSlot(slotId: string, updateName?: boolean): void
  restoreLocal(slotId: string): Promise<void>
  applyProjectChannel(slotId: string, channel?: LoadedChannel): Promise<void>
  serializeProjectChannel(slotId: string): Partial<SaveChannelEntry>
  prepare(slotId: string): void
  update(slotId: string): void
  stop(slotIds: readonly string[]): void
  getTexture(slotId: string): WebGLTexture | null
}

export function createAudioInputRuntime(
  getGl: () => WebGL2RenderingContext,
  getDroppedFilePath: (file: File) => string | null,
  setNames: Dispatch<SetStateAction<NamesState>>,
): AudioInputRuntime {
  const slotAudio: Record<string, AudioInstance> = {}
  const slotAudioTex: Record<string, WebGLTexture | null> = {}

  function setName(slotId: string, name: string | null): void {
    setNames(prev => ({ ...prev, [slotId]: name }))
  }

  function ensureInstance(slotId: string): AudioInstance {
    if (!slotAudio[slotId]) slotAudio[slotId] = createAudioInstance()
    return slotAudio[slotId]
  }

  function ensureTexture(slotId: string): WebGLTexture {
    if (!slotAudioTex[slotId]) slotAudioTex[slotId] = ensureInstance(slotId).createTexture(getGl())
    return slotAudioTex[slotId]!
  }

  async function load(slotId: string, file: File): Promise<void> {
    const filePath = getDroppedFilePath(file)
    await ensureInstance(slotId).loadFile(file)
    ensureTexture(slotId)
    if (filePath) localStorage.setItem(`audio_path_${slotId}`, filePath)
    else localStorage.removeItem(`audio_path_${slotId}`)
    localStorage.setItem(`audio_name_${slotId}`, file.name)
    setName(slotId, file.name)
  }

  function clearSlot(slotId: string, updateName = true): void {
    slotAudio[slotId]?.unload()
    const tex = slotAudioTex[slotId]
    if (tex) getGl().deleteTexture(tex)
    slotAudioTex[slotId] = null
    localStorage.removeItem(`audio_path_${slotId}`)
    localStorage.removeItem(`audio_name_${slotId}`)
    if (updateName) setName(slotId, null)
  }

  function clear(slotId: string): void {
    clearSlot(slotId)
  }

  async function restoreLocal(slotId: string): Promise<void> {
    const filePath = localStorage.getItem(`audio_path_${slotId}`)
    const fileName = localStorage.getItem(`audio_name_${slotId}`)
    if (!filePath) return
    try {
      await ensureInstance(slotId).restore(filePath)
      slotAudioTex[slotId] = ensureInstance(slotId).createTexture(getGl())
      setName(slotId, fileName)
    } catch {
      localStorage.removeItem(`audio_path_${slotId}`)
      localStorage.removeItem(`audio_name_${slotId}`)
    }
  }

  async function applyProjectChannel(slotId: string, channel?: LoadedChannel): Promise<void> {
    clearSlot(slotId, false)
    if (channel?.type !== 'audio' || !channel.filePath) {
      setName(slotId, null)
      return
    }
    try {
      await ensureInstance(slotId).restore(channel.filePath)
      slotAudioTex[slotId] = ensureInstance(slotId).createTexture(getGl())
      const name = channel.fileName ?? channel.filePath.split('/').pop() ?? ''
      localStorage.setItem(`audio_path_${slotId}`, channel.filePath)
      localStorage.setItem(`audio_name_${slotId}`, name)
      setName(slotId, name)
    } catch {
      setName(slotId, null)
    }
  }

  function serializeProjectChannel(slotId: string): Partial<SaveChannelEntry> {
    return {
      filePath: localStorage.getItem(`audio_path_${slotId}`) ?? undefined,
      fileName: localStorage.getItem(`audio_name_${slotId}`) ?? undefined,
    }
  }

  function prepare(slotId: string): void {
    ensureTexture(slotId)
    ensureInstance(slotId).play()
  }

  function update(slotId: string): void {
    const inst = slotAudio[slotId]
    const tex = slotAudioTex[slotId]
    if (inst && tex) inst.fillTexture(getGl(), tex)
  }

  function stop(slotIds: readonly string[]): void {
    slotIds.forEach(slotId => slotAudio[slotId]?.stop())
  }

  function getTexture(slotId: string): WebGLTexture | null {
    return slotAudioTex[slotId] ?? null
  }

  return {
    load,
    clear,
    clearSlot,
    restoreLocal,
    applyProjectChannel,
    serializeProjectChannel,
    prepare,
    update,
    stop,
    getTexture,
  }
}
