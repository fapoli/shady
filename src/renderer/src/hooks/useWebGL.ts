import { useRef, useCallback, useEffect, useState } from 'react'
import type * as Monaco from 'monaco-editor'
import { DEFAULT_PROJECT_SETTINGS, PASS_DEFS, BUFFER_IDS, ProjectSettings } from '../../../shared/types'
import {
  buildProgram, destroyProgram, createFboPair, destroyFboPair, swapFboPair,
  bindUniforms, CompiledPass, FboPair
} from '../lib/webgl'
import { getRuntimeInputTexture } from '../inputs/runtime'
import { INPUT_DRIVERS, INPUT_DRIVER_TYPES, SlotType } from '../inputs/registry'
import type { InputRuntime, InputRuntimeContext } from '../inputs/types'

interface PassState {
  compiled:  CompiledPass | null
  fboPair:   FboPair | null
}

const RESIZE_SETTLE_MS = 90
const RENDER_RESUME_MS = 120

export interface WebGLHandle {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  audioNames: Record<string, string | null>
  imageNames: Record<string, string | null>
  start(
    models: (Monaco.editor.ITextModel | null)[],
    slotTypes: Record<string, SlotType>,
    projectSettings: ProjectSettings,
  ): string[]
  setProjectSettings(settings: ProjectSettings): void
  stop(): void
  cleanup(): void
  loadInput(type: SlotType, slotId: string, file: File): Promise<void>
  clearInput(type: SlotType, slotId: string): void
  serializeInput(type: SlotType, slotId: string): SaveChannelEntry
  restoreSlots(slotTypes: Record<string, SlotType>): Promise<void>
  applyProjectChannels(channels: Record<string, LoadedChannel>): Promise<void>
}

export function useWebGL(onProjectChange?: () => void): WebGLHandle {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const glRef      = useRef<WebGL2RenderingContext | null>(null)
  const rafRef     = useRef<number | null>(null)
  const passesRef  = useRef<PassState[]>(PASS_DEFS.map(() => ({ compiled: null, fboPair: null })))

  const [audioNames, setAudioNames] = useState<Record<string, string | null>>({})
  const [imageNames, setImageNames] = useState<Record<string, string | null>>({})
  const inputRuntimes = useRef<Partial<Record<SlotType, InputRuntime>>>({})
  const projectSettingsRef = useRef<ProjectSettings>(DEFAULT_PROJECT_SETTINGS)

  // Runtime
  const mouseState  = useRef<[number,number,number,number]>([0,0,0,0])
  const mouseDown   = useRef(false)
  const startTimeMs = useRef(0)
  const prevTimeMs  = useRef(0)
  const frameCount  = useRef(0)
  const lastSize    = useRef({ w: 0, h: 0 })
  const pendingSize = useRef<{ w: number; h: number; changedAt: number } | null>(null)
  const isWindowResizing = useRef(false)
  const resizeTimer = useRef<number | null>(null)

  const applyProjectSettings = useCallback((settings: ProjectSettings) => {
    projectSettingsRef.current = { ...DEFAULT_PROJECT_SETTINGS, ...settings }
  }, [])

  function canvasMousePosition(event: MouseEvent): [number, number] {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const dpr  = window.devicePixelRatio || 1
    return [
      (event.clientX - rect.left) * dpr,
      canvas.height - (event.clientY - rect.top) * dpr,
    ]
  }

  function getDroppedFilePath(file: File): string | null {
    const filePath = window.api.getPathForFile(file) || (file as unknown as { path?: string }).path
    return filePath && filePath !== 'undefined' ? filePath : null
  }

  function getGl(): WebGL2RenderingContext {
    if (!glRef.current) {
      const canvas = canvasRef.current!
      const ctx = canvas.getContext('webgl2', { antialias: false, alpha: false })!
      ctx.getExtension('EXT_color_buffer_float')
      glRef.current = ctx

      canvas.addEventListener('mousedown', (e) => {
        mouseDown.current = true
        const [x, y] = canvasMousePosition(e)
        mouseState.current = [x, y, x, y]
      })
      canvas.addEventListener('mousemove', (e) => {
        const hoverTracking = projectSettingsRef.current.mouseTracking === 'hover'
        if (!mouseDown.current && !hoverTracking) return

        const [x, y] = canvasMousePosition(e)
        mouseState.current[0] = x
        mouseState.current[1] = y
        if (hoverTracking && !mouseDown.current) {
          mouseState.current[2] = x
          mouseState.current[3] = y
        }
      })
      canvas.addEventListener('mouseup', () => {
        mouseDown.current = false
        mouseState.current[2] = -Math.abs(mouseState.current[2])
        mouseState.current[3] = -Math.abs(mouseState.current[3])
      })
    }
    return glRef.current
  }

  function getInputRuntime(type: SlotType): InputRuntime | null {
    if (type === 'shader') return null
    if (!inputRuntimes.current[type]) {
      const createRuntime = INPUT_DRIVERS[type]?.createRuntime
      if (!createRuntime) return null
      const context: InputRuntimeContext = { getGl, getDroppedFilePath, setAudioNames, setImageNames }
      inputRuntimes.current[type] = createRuntime(context)
    }
    return inputRuntimes.current[type] ?? null
  }

  function getShaderTexture(slotId: string): WebGLTexture | null {
    return passesRef.current[PASS_DEFS.findIndex(d => d.id === slotId)]?.fboPair?.texRead ?? null
  }

  useEffect(() => {
    const handleResize = () => {
      isWindowResizing.current = true
      if (resizeTimer.current !== null) window.clearTimeout(resizeTimer.current)
      resizeTimer.current = window.setTimeout(() => {
        isWindowResizing.current = false
        resizeTimer.current = null
      }, RENDER_RESUME_MS)
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      if (resizeTimer.current !== null) {
        window.clearTimeout(resizeTimer.current)
        resizeTimer.current = null
      }
    }
  }, [])

  function applyCanvasSize(w: number, h: number): void {
    const canvas = canvasRef.current!
    const gl     = getGl()
    canvas.width  = w
    canvas.height = h
    lastSize.current = { w, h }
    pendingSize.current = null

    PASS_DEFS.forEach((def, i) => {
      const state = passesRef.current[i]
      if (def.isBuffer && state.fboPair) {
        destroyFboPair(gl, state.fboPair)
        state.fboPair = createFboPair(gl, w, h)
      }
    })
  }

  function resizeCanvas(force = false, nowMs = performance.now()): void {
    const canvas = canvasRef.current!
    const dpr = window.devicePixelRatio || 1
    const w   = Math.max(1, Math.floor(canvas.clientWidth  * dpr))
    const h   = Math.max(1, Math.floor(canvas.clientHeight * dpr))
    if (w === lastSize.current.w && h === lastSize.current.h) {
      pendingSize.current = null
      return
    }

    if (force) {
      applyCanvasSize(w, h)
      return
    }

    const pending = pendingSize.current
    if (!pending || pending.w !== w || pending.h !== h) {
      pendingSize.current = { w, h, changedAt: nowMs }
      return
    }

    if (nowMs - pending.changedAt >= RESIZE_SETTLE_MS) {
      applyCanvasSize(w, h)
    }
  }

  const start = useCallback((
    models: (Monaco.editor.ITextModel | null)[],
    slotTypes: Record<string, SlotType>,
    projectSettings: ProjectSettings,
  ): string[] => {
    applyProjectSettings(projectSettings)
    const gl = getGl()
    const errors: string[] = []

    // Compile all passes
    PASS_DEFS.forEach((def, i) => {
      const state = passesRef.current[i]
      if (def.isBuffer && slotTypes[def.id] !== 'shader') {
        if (state.compiled) { destroyProgram(gl, state.compiled); state.compiled = null }
        return
      }
      const source = models[i]?.getValue().trim() ?? ''
      if (!source) {
        if (state.compiled) { destroyProgram(gl, state.compiled); state.compiled = null }
        return
      }
      try {
        const compiled = buildProgram(gl, source)
        if (state.compiled) destroyProgram(gl, state.compiled)
        state.compiled = compiled
      } catch (err) {
        errors.push(`[${def.label}] ${(err as Error).message}`)
      }
    })

    if (errors.length > 0) return errors

    resizeCanvas(true)
    const { w, h } = lastSize.current

    PASS_DEFS.forEach((def, i) => {
      if (!def.isBuffer) return
      const state = passesRef.current[i]
      const type  = slotTypes[def.id]
      if (type === 'shader' && state.compiled) {
        if (state.fboPair) destroyFboPair(gl, state.fboPair)
        state.fboPair = createFboPair(gl, w, h)
      }
      getInputRuntime(type)?.prepare?.(def.id)
    })

    if (rafRef.current) window.cancelAnimationFrame(rafRef.current)
    frameCount.current  = 0
    prevTimeMs.current  = 0
    startTimeMs.current = performance.now()

    function renderFrame(nowMs: number): void {
      resizeCanvas(false, nowMs)
      if (isWindowResizing.current) {
        rafRef.current = window.requestAnimationFrame(renderFrame)
        return
      }

      const canvas = canvasRef.current!
      const w = canvas.width, h = canvas.height
      const elapsed   = (nowMs - startTimeMs.current) / 1000
      const timeDelta = prevTimeMs.current === 0 ? 0 : (nowMs - prevTimeMs.current) / 1000
      prevTimeMs.current = nowMs

      PASS_DEFS.forEach(def => {
        if (!def.isBuffer) return
        getInputRuntime(slotTypes[def.id])?.update?.(def.id)
      })

      const bufferDefs = PASS_DEFS.filter(d => d.isBuffer)
      bufferDefs.forEach(def => {
        const passIdx = PASS_DEFS.findIndex(d => d.id === def.id)
        const state   = passesRef.current[passIdx]
        if (slotTypes[def.id] !== 'shader' || !state.compiled || !state.fboPair) return
        gl.bindFramebuffer(gl.FRAMEBUFFER, state.fboPair.fbo)
        gl.viewport(0, 0, w, h)
        gl.useProgram(state.compiled.program)
        gl.bindVertexArray(state.compiled.vao)
        bindUniforms(gl, state.compiled.program, elapsed, timeDelta, frameCount.current, w, h,
          mouseState.current, slotTypes, BUFFER_IDS,
          (id, type) => getRuntimeInputTexture(type, id, getShaderTexture, getInputRuntime),
        )
        gl.drawArrays(gl.TRIANGLES, 0, 6)
        gl.bindVertexArray(null)
        swapFboPair(state.fboPair)
      })

      // Main pass
      const imgState = passesRef.current[0]
      if (imgState.compiled) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        gl.viewport(0, 0, w, h)
        gl.useProgram(imgState.compiled.program)
        gl.bindVertexArray(imgState.compiled.vao)
        bindUniforms(gl, imgState.compiled.program, elapsed, timeDelta, frameCount.current, w, h,
          mouseState.current, slotTypes, BUFFER_IDS,
          (id, type) => getRuntimeInputTexture(type, id, getShaderTexture, getInputRuntime),
        )
        gl.drawArrays(gl.TRIANGLES, 0, 6)
        gl.bindVertexArray(null)
      }

      frameCount.current++
      rafRef.current = window.requestAnimationFrame(renderFrame)
    }

    rafRef.current = window.requestAnimationFrame(renderFrame)
    return []
  }, [applyProjectSettings])

  const stop = useCallback(() => {
    if (rafRef.current) { window.cancelAnimationFrame(rafRef.current); rafRef.current = null }
    mouseState.current = [0, 0, 0, 0]
    mouseDown.current  = false
    Object.values(inputRuntimes.current).forEach(runtime => runtime?.stop?.(BUFFER_IDS))
  }, [])

  const cleanup = useCallback(() => {
    stop()
    const gl = glRef.current
    if (!gl) return
    passesRef.current.forEach(state => {
      if (state.compiled) destroyProgram(gl, state.compiled)
      if (state.fboPair)  destroyFboPair(gl, state.fboPair)
    })
  }, [stop])

  const loadInput = useCallback(async (type: SlotType, slotId: string, file: File) => {
    await getInputRuntime(type)?.load?.(slotId, file)
    onProjectChange?.()
  }, [onProjectChange])

  const clearInput = useCallback((type: SlotType, slotId: string) => {
    getInputRuntime(type)?.clear?.(slotId)
    onProjectChange?.()
  }, [onProjectChange])

  const serializeInput = useCallback((type: SlotType, slotId: string): SaveChannelEntry => {
    return {
      type,
      ...getInputRuntime(type)?.serializeProjectChannel?.(slotId),
    }
  }, [])

  const restoreSlots = useCallback(async (slotTypes: Record<string, SlotType>) => {
    for (const def of PASS_DEFS.filter(d => d.isBuffer)) {
      const slotId = def.id
      const type   = slotTypes[slotId]
      await getInputRuntime(type)?.restoreLocal?.(slotId)
    }
  }, [])

  const applyProjectChannels = useCallback(async (channels: Record<string, LoadedChannel>) => {
    for (const def of PASS_DEFS.filter(d => d.isBuffer)) {
      const slotId = def.id
      const ch = channels[slotId]
      for (const type of INPUT_DRIVER_TYPES) {
        await getInputRuntime(type)?.applyProjectChannel?.(slotId, ch)
      }
    }
  }, [])

  return {
    canvasRef,
    audioNames,
    imageNames,
    start,
    stop,
    cleanup,
    loadInput,
    clearInput,
    serializeInput,
    restoreSlots,
    applyProjectChannels,
    setProjectSettings: applyProjectSettings,
  }
}
