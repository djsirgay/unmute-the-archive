const writeAscii = (view: DataView, offset: number, value: string): void => {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index))
  }
}

export const makeDemoClip = (): File => {
  const sampleRate = 44_100
  const durationSeconds = 4
  const sampleCount = sampleRate * durationSeconds
  const dataSize = sampleCount * 2
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  writeAscii(view, 0, "RIFF")
  view.setUint32(4, 36 + dataSize, true)
  writeAscii(view, 8, "WAVE")
  writeAscii(view, 12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeAscii(view, 36, "data")
  view.setUint32(40, dataSize, true)

  const notes = [220, 277.18, 329.63, 440]
  for (let index = 0; index < sampleCount; index += 1) {
    const second = index / sampleRate
    const note = notes[Math.min(notes.length - 1, Math.floor(second))]
    const phase = second % 1
    const fade = Math.min(1, phase * 12, (1 - phase) * 10)
    const sample = Math.sin(2 * Math.PI * note * second) * 0.22 * fade
    view.setInt16(44 + index * 2, sample * 0x7fff, true)
  }

  return new File([buffer], "synthetic-archive-demo.wav", {
    type: "audio/wav",
  })
}
