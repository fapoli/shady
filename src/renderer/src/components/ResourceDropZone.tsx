import { useRef, useState } from 'react'

interface Props {
  label: string
  accept: string
  emptyLabel: string
  externalError?: string | null
  validateFile?: (file: File) => string | null
  onDrop: (file: File) => Promise<void> | void
  onRemove?: () => void
}

export function ResourceDropZone({
  label, accept, emptyLabel, externalError, validateFile, onDrop, onRemove
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const error = localError ?? externalError ?? null

  const loadFile = async (file: File) => {
    const validationError = validateFile?.(file) ?? null
    if (validationError) {
      setLocalError(validationError)
      return
    }

    try {
      await onDrop(file)
      setLocalError(null)
    } catch {
      setLocalError('could not load file')
    }
  }

  return (
    <div
      className="resource-panel"
      onDragOver={e => e.preventDefault()}
      onDrop={e => {
        e.preventDefault()
        const file = e.dataTransfer.files[0]
        if (file) void loadFile(file)
      }}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        className="resource-file-input"
        type="file"
        accept={accept}
        onChange={e => {
          const file = e.currentTarget.files?.[0]
          e.currentTarget.value = ''
          if (file) void loadFile(file)
        }}
      />
      <span className="resource-drop-label">{label || emptyLabel}</span>
      {error && <span className="resource-error">{error}</span>}
      {onRemove && (
        <a
          className="resource-remove"
          href="#"
          tabIndex={-1}
          onClick={e => { e.preventDefault(); e.stopPropagation(); setLocalError(null); onRemove() }}
        >
          remove
        </a>
      )}
    </div>
  )
}
