interface Props {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  errors: string[]
  hidden: boolean
}

export function PreviewView({ canvasRef, errors, hidden }: Props) {
  return (
    <section className={'view view-preview' + (hidden ? ' hidden' : '')} aria-hidden={hidden}>
      <div className="preview-drag-region" />
      <canvas ref={canvasRef} id="canvas" />
      {errors.length > 0 && (
        <pre className="error">{errors.join('\n\n')}</pre>
      )}
    </section>
  )
}
