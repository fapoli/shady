import type { InputEditorProps } from './types'
import { ResourceDropZone } from '../components/ResourceDropZone'

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp']

function isImageFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase()
  return file.type.startsWith('image/') || (!!ext && IMAGE_EXTENSIONS.includes(ext))
}

export function ImageInput({ slotId, webgl }: InputEditorProps) {
  const imageName = webgl.imageNames[slotId] ?? null

  return (
    <ResourceDropZone
      label={imageName ?? ''}
      emptyLabel="select image"
      accept="image/png,image/jpeg,image/gif,image/webp"
      externalError={webgl.resourceErrors[slotId]}
      validateFile={file => isImageFile(file) ? null : 'unsupported image file'}
      onDrop={file => webgl.loadInput('image', slotId, file)}
      onRemove={imageName ? () => webgl.clearInput('image', slotId) : undefined}
    />
  )
}
