import type { InputRuntimeContext } from './types'

const ANALYSER_SIZE = 512

export interface MicrophoneInputRuntime {
  activate(slotId: string): Promise<void>
  prepare(slotId: string): void
  update(slotId: string): void
  stop(slotIds: readonly string[]): void
  clear(slotId: string): void
  getTexture(slotId: string): WebGLTexture | null
}

interface MicrophoneSlot {
  context: AudioContext
  analyser: AnalyserNode
  stream: MediaStream
  source: MediaStreamAudioSourceNode
  texture: WebGLTexture
  freqData: Uint8Array<ArrayBuffer>
  waveData: Uint8Array<ArrayBuffer>
}

export function createMicrophoneInputRuntime(
  { getGl, setSlotState }: InputRuntimeContext,
): MicrophoneInputRuntime {
  const slots: Record<string, MicrophoneSlot | null> = {}
  const pending: Record<string, Promise<void> | null> = {}
  const cancelled: Record<string, boolean> = {}

  function createTexture(gl: WebGL2RenderingContext): WebGLTexture {
    const tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, tex)

    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R8,
      ANALYSER_SIZE,
      2,
      0,
      gl.RED,
      gl.UNSIGNED_BYTE,
      new Uint8Array(ANALYSER_SIZE * 2),
    )

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    gl.bindTexture(gl.TEXTURE_2D, null)
    return tex
  }

  async function start(slotId: string): Promise<void> {
    if (slots[slotId]) return

    const granted = await window.appMeta.requestMediaAccess('microphone')
    if (!granted) throw new Error('Microphone access denied.')

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    })

    if (cancelled[slotId]) {
      stream.getTracks().forEach(track => track.stop())
      return
    }

    const context = new AudioContext()
    const analyser = context.createAnalyser()
    analyser.fftSize = ANALYSER_SIZE * 2
    analyser.smoothingTimeConstant = 0.8

    const source = context.createMediaStreamSource(stream)
    source.connect(analyser)

    slots[slotId] = {
      context,
      analyser,
      stream,
      source,
      texture: createTexture(getGl()),
      freqData: new Uint8Array(ANALYSER_SIZE),
      waveData: new Uint8Array(ANALYSER_SIZE),
    }
    setSlotState(slotId, { active: true, error: null })
  }

  async function activate(slotId: string): Promise<void> {
    cancelled[slotId] = false
    try {
      await start(slotId)
    } catch (err) {
      setSlotState(slotId, { active: false, error: (err as Error).message })
      throw err
    }
  }

  function prepare(slotId: string): void {
    if (slots[slotId] || pending[slotId]) return

    cancelled[slotId] = false
    pending[slotId] = start(slotId)
      .catch(err => {
        console.error('Failed to start microphone input:', err)
        setSlotState(slotId, { active: false, error: (err as Error).message })
      })
      .finally(() => {
        pending[slotId] = null
      })
  }

  function update(slotId: string): void {
    const slot = slots[slotId]
    if (!slot) return

    slot.analyser.getByteFrequencyData(slot.freqData)
    slot.analyser.getByteTimeDomainData(slot.waveData)

    const gl = getGl()
    gl.bindTexture(gl.TEXTURE_2D, slot.texture)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, ANALYSER_SIZE, 1, gl.RED, gl.UNSIGNED_BYTE, slot.freqData)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 1, ANALYSER_SIZE, 1, gl.RED, gl.UNSIGNED_BYTE, slot.waveData)
    gl.bindTexture(gl.TEXTURE_2D, null)
  }

  function clear(slotId: string): void {
    cancelled[slotId] = true
    const slot = slots[slotId]
    if (!slot) return

    slot.source.disconnect()
    slot.stream.getTracks().forEach(track => track.stop())
    slot.context.close()

    getGl().deleteTexture(slot.texture)
    slots[slotId] = null
    setSlotState(slotId, { active: false })
  }

  function stop(slotIds: readonly string[]): void {
    slotIds.forEach(clear)
  }

  function getTexture(slotId: string): WebGLTexture | null {
    return slots[slotId]?.texture ?? null
  }

  return { activate, prepare, update, stop, clear, getTexture }
}
