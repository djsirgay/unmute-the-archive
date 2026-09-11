import { describe, expect, it } from "vitest"
import { buildManifest, isArchiveManifest } from "./manifest"
import { effectiveSettings, registerCompletedRun, restorationLog, saveRegisteredRunNote, settingsText, withMasterAttestation, withPendingReviewNote, type CompletedRun } from "./restoration-run"

const source = { filename: "original.wav", bytes: 120, mediaType: "audio/wav", sha256: "a".repeat(64) }
const manifest = () => buildManifest({ status: "fingerprinted", title: "Master", creator: "Creator", collection: "Research", language: "Belarusian", place: "Unknown", context: "Context", rightsBasis: "Creator-owned", source })
const run: CompletedRun = { sourceHash: source.sha256, label: "Access copy", settings: { highpass: 35, lowpass: 18000, gainDb: 0, normalize: true }, purpose: "Listening", reviewerNote: "Reviewed", source: { ...source, filename: "access.wav", sha256: "b".repeat(64) } }
const detailedRun = (): CompletedRun => ({ ...structuredClone(run), reviewerNote: "", processing: {
  createdAt: "2026-09-10T20:00:00.000Z", applicationVersion: "2.0.0", inputFile: { ...source },
  sourceMetrics: { duration: 4, sampleRate: 48000, channels: 1, peak: 0.8, rms: 0.4 },
  resultMetrics: { duration: 4, sampleRate: 48000, channels: 1, peak: 0.95, rms: 0.45 },
} })

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
  it("uses and reports the effective low-pass frequency at the decoded sample rate", () => {
    const requested = { highpass: 35, lowpass: 18000, gainDb: 0, normalize: true }
    const applied = effectiveSettings(requested, 16000)
    expect(applied.lowpass).toBe(7999)
    expect(requested.lowpass).toBe(18000)
    expect(settingsText(applied)).toContain("low-pass 7999 Hz")
    expect(effectiveSettings({ ...requested, lowpass: 0 }, 16000).lowpass).toBe(0)
  })
  it("does not manufacture an unchanged-master attestation after processing", () => {
    const result = detailedRun()
    expect(result.intervention).toBeUndefined()
    expect(withMasterAttestation(result, false).intervention).toBeUndefined()
    expect(() => restorationLog(result, null)).toThrow("Confirm")
    expect(() => registerCompletedRun(manifest(), result)).toThrow("Confirm")
  })
  it("documents the real DSP engine without claiming AI or an engine version", () => {
    const result = withMasterAttestation(detailedRun(), true)
    expect(result.intervention).toMatchObject({ processingType: "non-ai", originalUnchanged: true, tool: { name: { status: "provided", value: "Browser Web Audio API" }, model: { status: "not-applicable" } }, review: { status: "pending" } })
    expect(result.intervention!.tool.version).toEqual({ status: "provided", value: "Unmute the Archive application 2.0.0; browser audio engine version not recorded" })
    expect(result.intervention!.uncertainty).toContain("No AI reconstruction")
  })
  it("uses an explicit unknown version when no application version is available", () => {
    const result = detailedRun()
    delete result.processing!.applicationVersion
    expect(withMasterAttestation(result, true).intervention!.tool.version).toEqual({ status: "unknown" })
  })
  it("does not inherit the master rights as permission to process or reuse the derivative", () => {
    const result = withMasterAttestation(detailedRun(), true)
    const stored = registerCompletedRun(manifest(), result)
    expect(stored.rightsBasis).toBe("Creator-owned")
    expect(stored.derivatives![0].intervention!.authority).toMatchObject({ basis: "unknown" })
    expect(stored.derivatives![0].intervention!.authority.scope).toContain("documentation only")
  })
  it("exports the exact same structured journal and processing snapshot in the log and passport", () => {
    const result = withMasterAttestation(detailedRun(), true)
    const passport = manifest()
    const log = restorationLog(result, passport.archiveId)
    const stored = registerCompletedRun(passport, result)
    expect(stored.schema).toBe("unmute-archive/2.2")
    expect(isArchiveManifest(stored)).toBe(true)
    expect(log.intervention).toEqual(stored.derivatives![0].intervention)
    const savedSettings = log.intervention.settings
    expect(savedSettings.status).toBe("provided")
    if (savedSettings.status !== "provided") throw new Error("Expected disclosed settings")
    const snapshot = JSON.parse(savedSettings.value)
    expect(snapshot.createdAt).toBe(log.createdAt)
    expect(snapshot.sourceMetrics).toEqual(log.source.metrics)
    expect(snapshot.resultMetrics).toEqual(log.derivative.metrics)
    expect(snapshot.highpass).toBe(log.processing.highpass)
    expect(snapshot.inputFile.sha256).toBe(log.source.sha256)
    expect(log.parentArchiveId).toBe(passport.archiveId)
  })
  it("labels decoded processing rates and pre-quantization output measurements accurately", () => {
    const log = restorationLog(withMasterAttestation(detailedRun(), true), null)
    expect(log.processing.decodedProcessingSampleRateHz).toBe(48000)
    expect(log.boundaries.join(" ")).toContain("resampling")
    expect(log.boundaries.join(" ")).toContain("quantization")
    expect(log.intervention.settings.status === "provided" && log.intervention.settings.value).toContain("Not the original file's encoded sample rate")
  })
  it("lets listening notes change after A/B without changing the processed audio, settings, or time", () => {
    const first = withMasterAttestation(detailedRun(), true)
    const firstSnapshot = JSON.stringify(first)
    const noted = withPendingReviewNote(first, " I hear a metallic artifact; another review is needed. ")
    expect(noted.intervention!.review).toEqual({ status: "pending", note: "I hear a metallic artifact; another review is needed." })
    expect(noted.processing).toEqual(first.processing)
    expect(noted.settings).toEqual(first.settings)
    expect(noted.source).toEqual(first.source)
    expect(noted.intervention!.settings).toEqual(first.intervention!.settings)
    expect(JSON.stringify(first)).toBe(firstSnapshot)
    expect(restorationLog(noted, null).createdAt).toBe(first.processing!.createdAt)
  })
  it("keeps notes entered before confirmation pending when the journal is created", () => {
    const noted = withPendingReviewNote(detailedRun(), "Reviewed it; this text is not a formal review decision.")
    expect(noted.intervention).toBeUndefined()
    const result = withMasterAttestation(noted, true)
    expect(result.intervention!.review).toMatchObject({ status: "pending", note: noted.reviewerNote })
    expect(result.intervention!.review.reviewer).toBeUndefined()
  })
  it("withdrawing confirmation removes the journal and prevents further registered exports", () => {
    const confirmed = withMasterAttestation(detailedRun(), true)
    const unconfirmed = withMasterAttestation(confirmed, false)
    expect(unconfirmed.intervention).toBeUndefined()
    expect(unconfirmed.source).toEqual(confirmed.source)
    expect(() => restorationLog(unconfirmed, null)).toThrow("Confirm")
  })
  it("saves an explicit post-registration pending note without replacing audio or processing", () => {
    const result = withMasterAttestation(detailedRun(), true)
    const stored = registerCompletedRun(manifest(), result)
    const before = JSON.stringify(stored)
    const noted = withPendingReviewNote(result, "Need another listener to check high frequencies.")
    const updated = saveRegisteredRunNote(stored, stored.derivatives![0].derivativeId, noted)
    expect(updated.derivatives![0].intervention).toEqual(restorationLog(noted, updated.archiveId).intervention)
    expect(updated.derivatives![0].source).toEqual(stored.derivatives![0].source)
    expect(updated.derivatives![0].changeLog).toBe(stored.derivatives![0].changeLog)
    expect(updated.source).toEqual(stored.source)
    expect(updated.events.at(-1)?.note).toContain("processing and file hashes unchanged")
    expect(JSON.stringify(stored)).toBe(before)
  })
  it("does not overwrite an independent completed human review with a pending note", () => {
    const result = withMasterAttestation(detailedRun(), true)
    const stored = registerCompletedRun(manifest(), result)
    stored.derivatives![0].intervention!.review = { status: "reviewed", reviewer: "Listener B", note: "Independent review." }
    expect(() => saveRegisteredRunNote(stored, stored.derivatives![0].derivativeId, result)).toThrow("human review")
  })
  it("rejects changed source, derivative, or processing records during a note update", () => {
    const result = withMasterAttestation(detailedRun(), true)
    const stored = registerCompletedRun(manifest(), result)
    const id = stored.derivatives![0].derivativeId
    expect(() => saveRegisteredRunNote({ ...stored, source: { ...source, sha256: "c".repeat(64) } }, id, result)).toThrow()
    expect(() => saveRegisteredRunNote(stored, "another-id", result)).toThrow("derivative")
    const changed = structuredClone(result)
    changed.intervention!.changes = "An unrelated intervention."
    expect(() => saveRegisteredRunNote(stored, id, changed)).toThrow("processing record changed")
  })
  it("uses valid case-insensitive hashes for source linkage", () => {
    const letterHash = "abcdef".repeat(10) + "abcd"
    const result = detailedRun()
    result.sourceHash = letterHash.toUpperCase()
    result.processing!.inputFile.sha256 = letterHash
    const recorded = withMasterAttestation(result, true)
    expect(() => registerCompletedRun({ ...manifest(), source: { ...source, sha256: letterHash } }, recorded)).not.toThrow()
  })
  it("keeps previously created unstructured runs legacy rather than inventing a prior journal", () => {
    const stored = registerCompletedRun(manifest(), run)
    expect(stored.schema).toBe("unmute-archive/2.1")
    expect(stored.derivatives![0].intervention).toBeUndefined()
  })
})
