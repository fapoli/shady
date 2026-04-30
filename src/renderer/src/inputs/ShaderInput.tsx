import type { InputEditorProps } from './types'

export function ShaderInput({ hidden, editorRef }: InputEditorProps) {
  const hideMonaco = import.meta.env.VITE_HIDE_MONACO === '1'

  if (hideMonaco) {
    return (
      <div
        id="editor"
        aria-label="shader source placeholder"
        style={{ display: hidden ? 'none' : undefined }}
      >
        <div className="editor-placeholder">monaco hidden</div>
      </div>
    )
  }

  return (
    <div
      ref={editorRef}
      id="editor"
      aria-label="shader source"
      style={{ display: hidden ? 'none' : undefined }}
    />
  )
}
