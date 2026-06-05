import type { LoadedChannel, SaveChannelEntry } from '../../../shared/types'
import { createAudioInstance, AudioInstance } from '../lib/audio'
import { createFileChannelStore } from './fileChannelStore'
import type { InputRuntimeContext } from './types'

export interface AudioInputRuntime {
  loadFile(slotId: string, file: File): Promise<void>
  clear(slotId: string): void
  clearSlot(slotId: string, updateName?: boolean): void
  applyProjectChannel(slotId: string, channel?: LoadedChannel): Promise<void>
  serializeProjectChannel(slotId: string): Partial<SaveChannelEntry>
  prepare(slotId: string): void
  update(slotId: string): void
  pause(slotIds: readonly string[]): void
  resume(slotIds: readonly string[]): void
  stop(slotIds: readonly string[]): void
  getTexture(slotId: string): WebGLTexture | null
}

export function createAudioInputRuntime(
  { getGl, getDroppedFilePath, setSlotState }: InputRuntimeContext,
): AudioInputRuntime {
  const slotAudio: Record<string, AudioInstance> = {}
  const slotAudioTex: Record<string, WebGLTexture | null> = {}
  const files = createFileChannelStore('audio', setSlotState)

  function ensureInstance(slotId: string): AudioInstance {
    if (!slotAudio[slotId]) slotAudio[slotId] = createAudioInstance()
    return slotAudio[slotId]
  }

  function ensureTexture(slotId: string): WebGLTexture {
    if (!slotAudioTex[slotId]) slotAudioTex[slotId] = ensureInstance(slotId).createTexture(getGl())
    return slotAudioTex[slotId]!
  }

  async function loadFile(slotId: string, file: File): Promise<void> {
    const filePath = getDroppedFilePath(file)
    await ensureInstance(slotId).loadFile(file)
    ensureTexture(slotId)
    files.remember(slotId, filePath, file.name)
  }

  function clearSlot(slotId: string, updateName = true): void {
    slotAudio[slotId]?.unload()
    const tex = slotAudioTex[slotId]
    if (tex) getGl().deleteTexture(tex)
    slotAudioTex[slotId] = null
    files.clear(slotId, updateName)
  }

  function clear(slotId: string): void {
    clearSlot(slotId)
  }

  async function applyProjectChannel(slotId: string, channel?: LoadedChannel): Promise<void> {
    clearSlot(slotId, false)
    if (channel?.type !== 'audio' || !channel.filePath) {
      files.setName(slotId, null)
      return
    }
    try {
      await ensureInstance(slotId).restore(channel.filePath)
      slotAudioTex[slotId] = ensureInstance(slotId).createTexture(getGl())
      files.remember(slotId, channel.filePath, files.channelName(channel))
    } catch {
      files.setName(slotId, null)
      files.setError(slotId, `missing audio: ${files.channelName(channel) || 'file'}`)
    }
  }

  function serializeProjectChannel(slotId: string): Partial<SaveChannelEntry> {
    return files.serialize(slotId)
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

  function pause(slotIds: readonly string[]): void {
    slotIds.forEach(slotId => slotAudio[slotId]?.pause())
  }

  function resume(slotIds: readonly string[]): void {
    slotIds.forEach(slotId => slotAudio[slotId]?.resume())
  }

  function stop(slotIds: readonly string[]): void {
    slotIds.forEach(slotId => slotAudio[slotId]?.stop())
  }

  function getTexture(slotId: string): WebGLTexture | null {
    return slotAudioTex[slotId] ?? null
  }

  return {
    loadFile,
    clear,
    clearSlot,
    applyProjectChannel,
    serializeProjectChannel,
    prepare,
    update,
    pause,
    resume,
    stop,
    getTexture,
  }
}
