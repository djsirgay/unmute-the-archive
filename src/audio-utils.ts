export type ProcessSettings = {
  highpass: number
  lowpass: number
  gainDb: number
  normalize: boolean
}

export type AudioMetrics = {
  duration: number
  sampleRate: number
  channels: number
  peak: number
  rms: number
}

export const decodeFile = async (file: Blob): Promise<AudioBuffer> => {
  const context = new AudioContext()
  try {
    return await context.decodeAudioData(await file.arrayBuffer())
  } finally {
    await context.close()
  }
}

const scaledCopy = (source: AudioBuffer, multiplier: number): AudioBuffer => {
  const copy = new AudioBuffer({ length: source.length, numberOfChannels: source.numberOfChannels, sampleRate: source.sampleRate })
  for (let channel = 0; channel < source.numberOfChannels; channel += 1) {
    const sourceData = source.getChannelData(channel)
    const targetData = copy.getChannelData(channel)
    for (let index = 0; index < sourceData.length; index += 1) targetData[index] = Math.max(-1, Math.min(1, sourceData[index] * multiplier))
  }
  return copy
}

export const processAudio = async (source: AudioBuffer, settings: ProcessSettings): Promise<AudioBuffer> => {
  const context = new OfflineAudioContext(source.numberOfChannels, source.length, source.sampleRate)
  const input = context.createBufferSource()
  input.buffer = source
  const highpass = context.createBiquadFilter()
  highpass.type = "highpass"
  highpass.frequency.value = settings.highpass
  highpass.Q.value = 0.707
  const lowpass = context.createBiquadFilter()
  lowpass.type = "lowpass"
  lowpass.frequency.value = Math.min(settings.lowpass, source.sampleRate / 2 - 1)
  lowpass.Q.value = 0.707
  const gain = context.createGain()
  gain.gain.value = 10 ** (settings.gainDb / 20)
  input.connect(highpass).connect(lowpass).connect(gain).connect(context.destination)
  input.start()
  const rendered = await context.startRendering()
  if (!settings.normalize) return rendered
  const metrics = analyzeAudio(rendered)
  return metrics.peak > 0 ? scaledCopy(rendered, 0.95 / metrics.peak) : rendered
}

export const analyzeAudio = (buffer: AudioBuffer): AudioMetrics => {
  let peak = 0
  let squared = 0
  let count = 0
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const samples = buffer.getChannelData(channel)
    for (let index = 0; index < samples.length; index += 1) {
      const absolute = Math.abs(samples[index])
      peak = Math.max(peak, absolute)
      squared += samples[index] ** 2
      count += 1
    }
  }
  return { duration: buffer.duration, sampleRate: buffer.sampleRate, channels: buffer.numberOfChannels, peak, rms: count ? Math.sqrt(squared / count) : 0 }
}

const writeAscii = (view: DataView, offset: number, value: string): void => {
  for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index))
}

export const audioBufferToWav = (buffer: AudioBuffer): Blob => {
  const channels = buffer.numberOfChannels
  const bytesPerSample = 2
  const dataSize = buffer.length * channels * bytesPerSample
  const bytes = new ArrayBuffer(44 + dataSize)
  const view = new DataView(bytes)
  writeAscii(view, 0, "RIFF"); view.setUint32(4, 36 + dataSize, true); writeAscii(view, 8, "WAVE"); writeAscii(view, 12, "fmt ")
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true); view.setUint32(24, buffer.sampleRate, true)
  view.setUint32(28, buffer.sampleRate * channels * bytesPerSample, true); view.setUint16(32, channels * bytesPerSample, true); view.setUint16(34, 16, true)
  writeAscii(view, 36, "data"); view.setUint32(40, dataSize, true)
  let offset = 44
  for (let index = 0; index < buffer.length; index += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[index]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }
  return new Blob([bytes], { type: "audio/wav" })
}

export const drawWaveform = (canvas: HTMLCanvasElement, buffer: AudioBuffer, color = "#d8ff68"): void => {
  const ratio = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  canvas.width = Math.max(320, rect.width * ratio)
  canvas.height = Math.max(110, rect.height * ratio)
  const context = canvas.getContext("2d")!
  context.scale(ratio, ratio)
  const width = canvas.width / ratio
  const height = canvas.height / ratio
  context.clearRect(0, 0, width, height)
  context.strokeStyle = "rgba(216,255,104,.12)"
  context.beginPath(); context.moveTo(0, height / 2); context.lineTo(width, height / 2); context.stroke()
  const samples = buffer.getChannelData(0)
  const step = Math.max(1, Math.floor(samples.length / width))
  context.strokeStyle = color
  context.lineWidth = 1
  context.beginPath()
  for (let x = 0; x < width; x += 1) {
    let minimum = 1
    let maximum = -1
    for (let index = x * step; index < Math.min(samples.length, (x + 1) * step); index += 1) { minimum = Math.min(minimum, samples[index]); maximum = Math.max(maximum, samples[index]) }
    context.moveTo(x, (1 + minimum) * height / 2)
    context.lineTo(x, (1 + maximum) * height / 2)
  }
  context.stroke()
}
