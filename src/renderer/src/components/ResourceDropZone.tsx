interface Props {
  label: string
  onDrop: (file: File) => void
  onRemove?: () => void
}

export function ResourceDropZone({ label, onDrop, onRemove }: Props) {
  return (
    <div
      className="resource-panel"
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onDrop(f) }}
    >
      <span className="resource-drop-label">{label}</span>
      {onRemove && (
        <a
          className="resource-remove"
          href="#"
          onClick={e => { e.preventDefault(); onRemove() }}
        >
          remove
        </a>
      )}
    </div>
  )
}
