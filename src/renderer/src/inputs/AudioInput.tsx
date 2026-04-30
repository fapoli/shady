import type { InputEditorProps } from './types'
import { ResourceDropZone } from '../components/ResourceDropZone'

export function AudioInput({ slotId, webgl }: InputEditorProps) {
  const audioName = webgl.audioNames[slotId] ?? null

  return (
    <ResourceDropZone
      label={audioName ?? 'drag audio file'}
      onDrop={file => webgl.loadInput('audio', slotId, file)}
      onRemove={audioName ? () => webgl.clearInput('audio', slotId) : undefined}
    />
  )
}
