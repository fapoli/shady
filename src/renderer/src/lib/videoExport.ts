import { BUFFER_IDS, PASS_DEFS, type SavePayload } from '../../../shared/types'
import type { SlotType } from '../inputs/registry'
import {
  bindUniforms,
  buildProgram,
  createFboPair,
  createImageTexture,
  destroyFboPair,
  destroyProgram,
  swapFboPair,
  type CompiledPass,
  type FboPair,
} from './webgl'

const EXPORT_WIDTH = 800
const EXPORT_HEIGHT = 800
const EXPORT_FPS = 60
const EXPORT_DURATION_SECONDS = 10
const EXPORT_FRAMES = EXPORT_FPS * EXPORT_DURATION_SECONDS

const MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
}

interface ExportPassState {
  compiled: CompiledPass | null
  fboPair: FboPair | null
}

interface ExportOptions {
  payload: SavePayload
  slotTypes: Record<string, SlotType>
  writeFrame(frame: Uint8Array): Promise<void>
  onProgress(frame: number, total: number): void
}

export async function exportVideoFrames({ payload, slotTypes, writeFrame, onProgress }: ExportOptions): Promise<void> {
  const canvas = document.createElement('canvas')
  canvas.width = EXPORT_WIDTH
  canvas.height = EXPORT_HEIGHT
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: true })
  if (!gl) throw new Error('WebGL2 is not available.')
  gl.getExtension('EXT_color_buffer_float')

  const passStates: ExportPassState[] = PASS_DEFS.map(() => ({ compiled: null, fboPair: null }))
  const imageTextures: Record<string, WebGLTexture | null> = {}
  const pixels = new Uint8Array(EXPORT_WIDTH * EXPORT_HEIGHT * 4)
  const mouseState: [number, number, number, number] = [0, 0, 0, 0]

  try {
    PASS_DEFS.forEach((def, i) => {
      const type = def.isBuffer ? slotTypes[def.id] : 'shader'
      if (def.isBuffer && type !== 'shader') return
      const source = payload.shaders[def.id]?.trim() ?? ''
      if (!source) return
      passStates[i].compiled = buildProgram(gl, source)
    })

    PASS_DEFS.filter(def => def.isBuffer).forEach(def => {
      const passIndex = PASS_DEFS.findIndex(pass => pass.id === def.id)
      if (slotTypes[def.id] === 'shader' && passStates[passIndex].compiled) {
        passStates[passIndex].fboPair = createFboPair(gl, EXPORT_WIDTH, EXPORT_HEIGHT)
      }
    })

    await Promise.all(PASS_DEFS.filter(def => def.isBuffer).map(async def => {
      if (slotTypes[def.id] !== 'image') return
      const filePath = payload.channels[def.id]?.filePath
      if (!filePath) return
      imageTextures[def.id] = await createImageTextureFromPath(gl, filePath)
    }))

    for (let frame = 0; frame < EXPORT_FRAMES; frame++) {
      const elapsed = frame / EXPORT_FPS
      const timeDelta = frame === 0 ? 0 : 1 / EXPORT_FPS

      PASS_DEFS.filter(def => def.isBuffer).forEach(def => {
        const passIndex = PASS_DEFS.findIndex(pass => pass.id === def.id)
        const state = passStates[passIndex]
        if (slotTypes[def.id] !== 'shader' || !state.compiled || !state.fboPair) return

        gl.bindFramebuffer(gl.FRAMEBUFFER, state.fboPair.fbo)
        gl.viewport(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT)
        gl.useProgram(state.compiled.program)
        gl.bindVertexArray(state.compiled.vao)
        bindUniforms(gl, state.compiled.program, elapsed, timeDelta, frame, EXPORT_WIDTH, EXPORT_HEIGHT,
          mouseState, slotTypes, BUFFER_IDS, (slotId, type) => getExportTexture(slotId, type, passStates, imageTextures))
        gl.drawArrays(gl.TRIANGLES, 0, 6)
        gl.bindVertexArray(null)
        swapFboPair(state.fboPair)
      })

      const main = passStates[0]
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT)
      gl.clearColor(0, 0, 0, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)
      if (main.compiled) {
        gl.useProgram(main.compiled.program)
        gl.bindVertexArray(main.compiled.vao)
        bindUniforms(gl, main.compiled.program, elapsed, timeDelta, frame, EXPORT_WIDTH, EXPORT_HEIGHT,
          mouseState, slotTypes, BUFFER_IDS, (slotId, type) => getExportTexture(slotId, type, passStates, imageTextures))
        gl.drawArrays(gl.TRIANGLES, 0, 6)
        gl.bindVertexArray(null)
      }

      gl.readPixels(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
      await writeFrame(new Uint8Array(pixels))
      onProgress(frame + 1, EXPORT_FRAMES)
      await new Promise(resolve => window.setTimeout(resolve, 0))
    }
  } finally {
    passStates.forEach(state => {
      if (state.compiled) destroyProgram(gl, state.compiled)
      if (state.fboPair) destroyFboPair(gl, state.fboPair)
    })
    Object.values(imageTextures).forEach(texture => {
      if (texture) gl.deleteTexture(texture)
    })
  }
}

function getExportTexture(
  slotId: string,
  type: SlotType,
  passStates: ExportPassState[],
  imageTextures: Record<string, WebGLTexture | null>,
): WebGLTexture | null {
  if (type === 'image') return imageTextures[slotId] ?? null
  if (type !== 'shader') return null
  return passStates[PASS_DEFS.findIndex(def => def.id === slotId)]?.fboPair?.texRead ?? null
}

async function createImageTextureFromPath(gl: WebGL2RenderingContext, filePath: string): Promise<WebGLTexture> {
  const raw = await window.api.readFile(filePath)
  const arrayBuffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  const blob = new Blob([arrayBuffer], { type: MIME_MAP[ext] ?? 'image/png' })
  const bitmap = await createImageBitmap(blob)
  const texture = createImageTexture(gl, bitmap)
  bitmap.close()
  return texture
}
