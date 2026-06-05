import { useCallback, useEffect, useRef, useState } from 'react'
import type { SavePayload } from '../../../shared/types'
import type { SlotType } from '../inputs/registry'
import { exportVideoFrames } from '../lib/videoExport'

interface Options {
  buildPayload(): SavePayload
  getSlotTypes(): Record<string, SlotType>
  ensureProjectSaved(): Promise<string | null>
  setCompileError(message: string | null): void
}

export function useVideoExport({
  buildPayload,
  getSlotTypes,
  ensureProjectSaved,
  setCompileError,
}: Options) {
  const [exportStatus, setExportStatus] = useState<string | null>(null)
  const exportClearTimerRef = useRef<number | null>(null)
  const exportInProgressRef = useRef(false)

  const exportVideo = useCallback(async () => {
    if (exportInProgressRef.current) return
    exportInProgressRef.current = true
    if (exportClearTimerRef.current !== null) {
      window.clearTimeout(exportClearTimerRef.current)
      exportClearTimerRef.current = null
    }

    let exportId: string | null = null
    try {
      const projectPath = await ensureProjectSaved()
      if (!projectPath) return

      const payload = buildPayload()
      setCompileError(null)
      setExportStatus('exporting video 0%')
      const started = await window.projectApi.startVideoExport(projectPath)
      exportId = started.exportId

      await exportVideoFrames({
        payload,
        slotTypes: getSlotTypes(),
        writeFrame: frame => window.projectApi.writeVideoExportFrame(started.exportId, frame),
        onProgress: (frame, total) => {
          setExportStatus(`exporting video ${Math.round((frame / total) * 100)}%`)
        },
      })

      const finished = await window.projectApi.finishVideoExport(started.exportId)
      exportId = null
      setExportStatus(`exported ${finished.outputPath}`)
      exportClearTimerRef.current = window.setTimeout(() => {
        exportClearTimerRef.current = null
        setExportStatus(null)
      }, 4000)
    } catch (err) {
      if (exportId) await window.projectApi.cancelVideoExport(exportId).catch(() => {})
      setExportStatus(null)
      setCompileError((err as Error).message)
    } finally {
      exportInProgressRef.current = false
    }
  }, [buildPayload, ensureProjectSaved, getSlotTypes, setCompileError])

  useEffect(() => {
    return () => {
      if (exportClearTimerRef.current !== null) window.clearTimeout(exportClearTimerRef.current)
    }
  }, [])

  return { exportStatus, exportVideo }
}
