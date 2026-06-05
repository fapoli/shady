import type { LoadedChannel, SaveChannelEntry } from '../../../shared/types'
import type { InputRuntimeContext } from './types'

export function createFileChannelStore(kind: string, setSlotState: InputRuntimeContext['setSlotState']) {
  const pathKey = (slotId: string) => `${kind}_path_${slotId}`
  const nameKey = (slotId: string) => `${kind}_name_${slotId}`

  function setName(slotId: string, name: string | null): void {
    setSlotState(slotId, { label: name })
  }

  function setError(slotId: string, error: string | null): void {
    setSlotState(slotId, { error })
  }

  function remember(slotId: string, filePath: string | null | undefined, fileName: string): void {
    if (filePath) localStorage.setItem(pathKey(slotId), filePath)
    else localStorage.removeItem(pathKey(slotId))
    localStorage.setItem(nameKey(slotId), fileName)
    setName(slotId, fileName)
    setError(slotId, null)
  }

  function clear(slotId: string, updateName = true): void {
    localStorage.removeItem(pathKey(slotId))
    localStorage.removeItem(nameKey(slotId))
    if (updateName) {
      setName(slotId, null)
      setError(slotId, null)
    }
  }

  function channelName(channel: LoadedChannel): string {
    return channel.fileName ?? channel.filePath?.split('/').pop() ?? ''
  }

  function serialize(slotId: string): Partial<SaveChannelEntry> {
    return {
      filePath: localStorage.getItem(pathKey(slotId)) ?? undefined,
      fileName: localStorage.getItem(nameKey(slotId)) ?? undefined,
    }
  }

  return { setName, setError, remember, clear, channelName, serialize }
}
