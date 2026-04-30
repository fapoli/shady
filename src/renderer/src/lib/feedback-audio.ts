let ctx: AudioContext | null = null
let volumeMultiplier = 0.7

const MODE_DURATION = 0.010
const MODE_FREQ_1 = 2200
const MODE_VOLUME_1 = 1.6
const MODE_FREQ_2 = 1400
const MODE_VOLUME_2 = 1.2
const MODE_Q = 1.5
const MODE_CHORD_DELAY = 0.035

export function setVolumeMultiplier(v: number): void {
  volumeMultiplier = Math.min(1, Math.max(0, v))
}

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  return ctx
}

function play(ac: AudioContext, startTime: number, duration: number, volume: number, freq: number, q: number): void {
  const sampleCount = Math.ceil(ac.sampleRate * duration)
  const buffer = ac.createBuffer(1, sampleCount, ac.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < sampleCount; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / sampleCount, 3)
  }
  const source = ac.createBufferSource()
  source.buffer = buffer
  const filter = ac.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = freq
  filter.Q.value = q
  const gain = ac.createGain()
  gain.gain.value = volume * volumeMultiplier
  source.connect(filter)
  filter.connect(gain)
  gain.connect(ac.destination)
  source.start(startTime)
}

export function playMode(): void {
  if (!volumeMultiplier) return
  const ac = getCtx()
  play(ac, ac.currentTime, MODE_DURATION, MODE_VOLUME_1, MODE_FREQ_1, MODE_Q)
  play(ac, ac.currentTime + MODE_CHORD_DELAY, MODE_DURATION, MODE_VOLUME_2, MODE_FREQ_2, MODE_Q)
}
