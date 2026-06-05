import type { InputEditorProps } from './types'

export function MicrophoneInput({ slotId, webgl }: InputEditorProps) {
  const state = webgl.inputStates[slotId]

  return (
    <div className="resource-panel">
      <div className="resource-drop-label">{state?.active ? 'microphone active' : 'microphone'}</div>
      {state?.error && <span className="resource-error">{state.error}</span>}
      {!state?.active && (
        <button className="resource-remove" tabIndex={-1} onClick={() => void webgl.activateInput('microphone', slotId)}>
          start microphone
        </button>
      )}
      {state?.active && (
        <button className="resource-remove" tabIndex={-1} onClick={() => webgl.clearInput('microphone', slotId)}>
          stop microphone
        </button>
      )}
    </div>
  )
}
