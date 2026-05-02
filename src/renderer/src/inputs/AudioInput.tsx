import type { InputEditorProps } from './types'
import { ResourceDropZone } from '../components/ResourceDropZone'

const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus', 'webm']

function isAudioFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase()
  return file.type.startsWith('audio/') || (!!ext && AUDIO_EXTENSIONS.includes(ext))
}

export function AudioInput({ slotId, webgl }: InputEditorProps) {
  const audioName = webgl.audioNames[slotId] ?? null

  return (
    <ResourceDropZone
      label={audioName ?? ''}
      emptyLabel="select audio file"
      accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.opus,.webm"
      externalError={webgl.resourceErrors[slotId]}
      validateFile={file => isAudioFile(file) ? null : 'unsupported audio file'}
      onDrop={file => webgl.loadInput('audio', slotId, file)}
      onRemove={audioName ? () => webgl.clearInput('audio', slotId) : undefined}
    />
  )
}
