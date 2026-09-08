import { describe, expect, it } from "vitest"
import { buildManifest } from "./manifest"
import { registerCompletedRun, settingsText, type CompletedRun } from "./restoration-run"

const source = { filename: "original.wav", bytes: 120, mediaType: "audio/wav", sha256: "a".repeat(64) }
const manifest = () => buildManifest({ status: "fingerprinted", title: "Master", creator: "Creator", collection: "Research", language: "Belarusian", place: "Unknown", context: "Context", rightsBasis: "Creator-owned", source })
const run: CompletedRun = { sourceHash: source.sha256, label: "Access copy", settings: { highpass: 35, lowpass: 18000, gainDb: 0, normalize: true }, purpose: "Listening", reviewerNote: "Reviewed", source: { ...source, filename: "access.wav", sha256: "b".repeat(64) } }

describe("completed audio-run provenance", () => {
  it("registers the settings and notes captured when the audio was produced", () => {
    const updated = registerCompletedRun(manifest(), run)
    expect(updated.derivatives?.[0].changeLog).toBe(settingsText(run.settings))
    expect(updated.derivatives?.[0].source.sha256).toBe(run.source.sha256)
    expect(updated.source).toEqual(source)
  })
  it("does not attach the completed derivative to a different source", () => {
    expect(() => registerCompletedRun({ ...manifest(), source: { ...source, sha256: "c".repeat(64) } }, run)).toThrow("different source")
  })
  it("describes bypass and output encoding explicitly", () => {
    expect(settingsText({ highpass: 0, lowpass: 0, gainDb: 0, normalize: false })).toBe("High-pass off; low-pass off; gain +0 dB; no normalization; output 16-bit PCM WAV.")
  })
})
