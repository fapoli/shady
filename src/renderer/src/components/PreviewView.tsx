import type { RenderStats } from '../hooks/useWebGL'

interface Props {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  stats: RenderStats
  showStats: boolean
  hidden: boolean
}

export function PreviewView({ canvasRef, stats, showStats, hidden }: Props) {
  const scaleLabel = Math.abs(stats.scale - 1) > 0.01 ? ` (x${stats.scale.toFixed(stats.scale % 1 === 0 ? 0 : 1)})` : ''

  return (
    <section className={'view view-preview' + (hidden ? ' hidden' : '')} aria-hidden={hidden}>
      <div className="preview-drag-region" />
      <canvas ref={canvasRef} id="canvas" />
      {showStats && (
        <div className="stats-overlay" aria-hidden="true">
          <span>{stats.frameMs.toFixed(1)} ms</span>
          <span>{stats.width} x {stats.height}{scaleLabel}</span>
          <span>{stats.fps} fps</span>
        </div>
      )}
    </section>
  )
}
