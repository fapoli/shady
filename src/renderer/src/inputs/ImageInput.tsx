import type { InputEditorProps } from './types'
import { ResourceDropZone } from '../components/ResourceDropZone'

export function ImageInput({ slotId, webgl }: InputEditorProps) {
  const imageName = webgl.imageNames[slotId] ?? null

  return (
    <ResourceDropZone
      label={imageName ?? 'drag image'}
      onDrop={file => webgl.loadInput('image', slotId, file)}
      onRemove={imageName ? () => webgl.clearInput('image', slotId) : undefined}
    />
  )
}
