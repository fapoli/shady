import type { InputEditorProps } from './types'

export function MicrophoneInput({ slotId, webgl }: InputEditorProps) {
  return (
    <div className="resource-panel">
      <div className="resource-drop-label">microphone</div>
      <button className="resource-remove" onClick={() => webgl.clearInput('microphone', slotId)}>
        stop microphone
      </button>
    </div>
  )
}
