const ANALYSER_SIZE = 512

export interface AudioInstance {
  loadFile(file: File): Promise<void>
  play(): void
  stop(): void
  restore(filePath: string): Promise<void>
  unload(): void
  fillTexture(gl: WebGL2RenderingContext, tex: WebGLTexture): void
  createTexture(gl: WebGL2RenderingContext): WebGLTexture
}

export function createAudioInstance(): AudioInstance {
  let audioContext: AudioContext | null = null
  let analyser: AnalyserNode | null = null
  let audioSource: AudioBufferSourceNode | null = null
  let audioBuffer: AudioBuffer | null = null
  const freqData = new Uint8Array(ANALYSER_SIZE)
  const waveData = new Uint8Array(ANALYSER_SIZE)

  function ensureContext(): void {
    if (audioContext) return
    audioContext = new AudioContext()
    analyser = audioContext.createAnalyser()
    analyser.fftSize = ANALYSER_SIZE * 2
    analyser.smoothingTimeConstant = 0.8
    analyser.connect(audioContext.destination)
  }

  async function loadFile(file: File): Promise<void> {
    ensureContext()
    if (audioSource) { audioSource.disconnect(); audioSource = null }
    const arrayBuffer = await file.arrayBuffer()
    audioBuffer = await audioContext!.decodeAudioData(arrayBuffer)
  }

  function play(): void {
    if (!audioBuffer) return
    if (audioSource) { audioSource.disconnect(); audioSource = null }
    audioSource = audioContext!.createBufferSource()
    audioSource.buffer = audioBuffer
    audioSource.loop   = true
    audioSource.connect(analyser!)
    audioSource.start()
  }

  function stop(): void {
    if (audioSource) { audioSource.disconnect(); audioSource = null }
  }

  async function restore(filePath: string): Promise<void> {
    ensureContext()
    const raw = await window.api.readFile(filePath)
    const arrayBuffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength)
    audioBuffer = await audioContext!.decodeAudioData(arrayBuffer as ArrayBuffer)
  }

  function unload(): void {
    stop()
    audioBuffer = null
  }

  function fillTexture(gl: WebGL2RenderingContext, tex: WebGLTexture): void {
    if (analyser) {
      analyser.getByteFrequencyData(freqData)
      analyser.getByteTimeDomainData(waveData)
    }
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, ANALYSER_SIZE, 1, gl.RED, gl.UNSIGNED_BYTE, freqData)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 1, ANALYSER_SIZE, 1, gl.RED, gl.UNSIGNED_BYTE, waveData)
    gl.bindTexture(gl.TEXTURE_2D, null)
  }

  function createTexture(gl: WebGL2RenderingContext): WebGLTexture {
    const tex   = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, tex)
    const empty = new Uint8Array(ANALYSER_SIZE * 2)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, ANALYSER_SIZE, 2, 0, gl.RED, gl.UNSIGNED_BYTE, empty)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.bindTexture(gl.TEXTURE_2D, null)
    return tex
  }

  return { loadFile, play, stop, restore, unload, fillTexture, createTexture }
}
