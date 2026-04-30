import { VERTEX_SHADER_SOURCE } from './shaders'
import type { SlotType } from '../inputs/registry'

export interface CompiledPass {
  program: WebGLProgram
  vao: WebGLVertexArrayObject
  quadBuffer: WebGLBuffer
}

export interface FboPair {
  fbo: WebGLFramebuffer
  fboRead: WebGLFramebuffer
  texWrite: WebGLTexture
  texRead: WebGLTexture
}

function createShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || 'Unknown compilation error.'
    gl.deleteShader(shader)
    throw new Error(message)
  }
  return shader
}

export function buildProgram(gl: WebGL2RenderingContext, fragmentSource: string): CompiledPass {
  const vert = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE)
  const injected = fragmentSource.replace(/^(#version[^\n]*)/, '$1\n#define fragCoord gl_FragCoord.xy')
  const frag = createShader(gl, gl.FRAGMENT_SHADER, injected)

  const program = gl.createProgram()!
  gl.attachShader(program, vert)
  gl.attachShader(program, frag)
  gl.linkProgram(program)
  gl.deleteShader(vert)
  gl.deleteShader(frag)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || 'Unknown link error.'
    gl.deleteProgram(program)
    throw new Error(message)
  }

  const vao = gl.createVertexArray()!
  gl.bindVertexArray(vao)
  const quadBuffer = gl.createBuffer()!
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,  1, -1, -1,  1,
    -1,  1,  1, -1,  1,  1
  ]), gl.STATIC_DRAW)
  const posLoc = gl.getAttribLocation(program, 'a_position')
  gl.enableVertexAttribArray(posLoc)
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)
  gl.bindVertexArray(null)

  return { program, vao, quadBuffer }
}

export function destroyProgram(gl: WebGL2RenderingContext, pass: Partial<CompiledPass>): void {
  if (pass.quadBuffer) gl.deleteBuffer(pass.quadBuffer)
  if (pass.vao)        gl.deleteVertexArray(pass.vao)
  if (pass.program)    gl.deleteProgram(pass.program)
}

function createFboTex(gl: WebGL2RenderingContext, width: number, height: number): { fbo: WebGLFramebuffer; tex: WebGLTexture } {
  const tex = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  const fbo = gl.createFramebuffer()!
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.bindTexture(gl.TEXTURE_2D, null)
  return { fbo, tex }
}

export function createFboPair(gl: WebGL2RenderingContext, width: number, height: number): FboPair {
  const a = createFboTex(gl, width, height)
  const b = createFboTex(gl, width, height)
  return { fbo: a.fbo, texWrite: a.tex, fboRead: b.fbo, texRead: b.tex }
}

export function destroyFboPair(gl: WebGL2RenderingContext, pair: FboPair): void {
  gl.deleteTexture(pair.texWrite)
  gl.deleteFramebuffer(pair.fbo)
  gl.deleteTexture(pair.texRead)
  gl.deleteFramebuffer(pair.fboRead)
}

export function swapFboPair(pair: FboPair): void {
  const tmp = pair.fbo; pair.fbo = pair.fboRead; pair.fboRead = tmp
  const tmpTex = pair.texWrite; pair.texWrite = pair.texRead; pair.texRead = tmpTex
}

export function createImageTexture(gl: WebGL2RenderingContext, bitmap: ImageBitmap): WebGLTexture {
  const tex = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
  gl.generateMipmap(gl.TEXTURE_2D)
  gl.bindTexture(gl.TEXTURE_2D, null)
  return tex
}

export function bindUniforms(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  elapsed: number,
  timeDelta: number,
  frame: number,
  width: number,
  height: number,
  mouseState: [number, number, number, number],
  slotTypes: Record<string, SlotType>,
  bufferIds: readonly string[],
  getChannelTex: (slotId: string, type: SlotType) => WebGLTexture | null,
): void {
  const u = (name: string) => gl.getUniformLocation(program, name)

  const resLoc       = u('iResolution')
  const timeLoc      = u('iTime')
  const timeDeltaLoc = u('iTimeDelta')
  const frameLoc     = u('iFrame')
  const mouseLoc     = u('iMouse')
  const dateLoc      = u('iDate')

  if (resLoc)       gl.uniform2f(resLoc, width, height)
  if (timeLoc)      gl.uniform1f(timeLoc, elapsed)
  if (timeDeltaLoc) gl.uniform1f(timeDeltaLoc, timeDelta)
  if (frameLoc)     gl.uniform1i(frameLoc, frame)
  if (mouseLoc)     gl.uniform4fv(mouseLoc, mouseState)
  if (dateLoc) {
    const now  = new Date()
    const secs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds() + now.getMilliseconds() / 1000
    gl.uniform4f(dateLoc, now.getFullYear(), now.getMonth() + 1, now.getDate(), secs)
  }

  for (let i = 0; i < 4; i++) {
    const chanLoc = u(`iChannel${i}`)
    if (!chanLoc) continue
    gl.activeTexture(gl.TEXTURE0 + i)
    const slotId = bufferIds[i]
    const type   = slotTypes[slotId] ?? 'shader'
    const tex = getChannelTex(slotId, type)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.uniform1i(chanLoc, i)
  }
}
