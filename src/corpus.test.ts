import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { addDerivative, buildManifest, isArchiveManifest } from "./manifest"
import { corpusAsCsv, corpusStorageIssue, csvCell, exportCorpusJson, readCorpus, saveToCorpus } from "./corpus"
import { importPassportJson, readAnnotations } from "./suite-data"

const fixture = () => buildManifest({ status: "source-missing", title: "Original record", creator: "Creator", collection: "Research", language: "Belarusian", place: "Unknown", context: "Context", rightsBasis: "Rights need review" })
let storage: Map<string, string>
beforeEach(() => {
  storage = new Map()
  vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const journalFixture = () => addDerivative(buildManifest({
  status: "fingerprinted", title: "Master", creator: "Test", collection: "Private test",
  language: "Belarusian", place: "Unknown", context: "Synthetic fixture", rightsBasis: "Master ownership declared",
  source: { filename: "master.wav", mediaType: "audio/wav", bytes: 10, sha256: "a".repeat(64) },
}), {
  label: "Altered copy", purpose: "Comparison", method: "AI tool declared", changeLog: "Noise changed",
  reviewerNote: "Historical note retained",
  source: { filename: "copy.wav", mediaType: "audio/wav", bytes: 12, sha256: "b".repeat(64) },
  intervention: {
    schema: "unmute-intervention/1.0", sourceMasterSha256: "a".repeat(64), processingType: "ai",
    tool: { name: { status: "provided", value: "Example" }, version: { status: "unknown" }, model: { status: "not-disclosed" } },
    instruction: { status: "provided", value: '=Keep "voice", reduce noise.\nNo invented words.' },
    settings: { status: "unknown" }, authority: { basis: "unknown", scope: "Unconfirmed", evidence: "Reference only" },
    changes: "Noise changed", preservedFeatures: "Master retained", uncertainty: "Unassessed artifacts",
    review: { status: "rejected", reviewer: "Test reviewer", note: "Voice was altered" }, originalUnchanged: true,
  },
})

describe("portable corpus integrity", () => {
  it("imports and restores full passports without adding duplicates", () => {
    const manifest = fixture()
    expect(importPassportJson(JSON.stringify([manifest]))).toBe(1)
    expect(importPassportJson(JSON.stringify([manifest, manifest]))).toBe(0)
    expect(readCorpus()).toEqual([manifest])
  })
  it("rejects conflicting and invalid imports atomically", () => {
    const original = fixture()
    saveToCorpus(original)
    const second = fixture()
    expect(() => importPassportJson(JSON.stringify([second, { ...original, context: "Older conflicting version" }]))).toThrow("different version")
    expect(readCorpus()).toEqual([original])
    expect(() => importPassportJson(JSON.stringify([second, { title: "partial" }]))).toThrow("No records were imported")
    expect(readCorpus()).toEqual([original])
  })
  it("does not replace corrupt saved data with a smaller collection", () => {
    storage.set("unmute-the-archive/corpus/v2", "broken historical data")
    expect(() => saveToCorpus(fixture())).toThrow()
    expect(storage.get("unmute-the-archive/corpus/v2")).toBe("broken historical data")
    expect(corpusStorageIssue()).toMatchObject({ kind: "damaged", raw: "broken historical data" })
  })
  it("distinguishes unavailable storage from an empty healthy library", () => {
    expect(corpusStorageIssue()).toBeUndefined()
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("Storage blocked") } })
    expect(corpusStorageIssue()).toMatchObject({ kind: "unavailable" })
    expect(corpusStorageIssue()?.raw).toBeUndefined()
  })
  it("rejects executable evidence links before rendering imported records", () => {
    expect(isArchiveManifest({ ...fixture(), evidenceUrl: "javascript:alert(1)" })).toBe(false)
    expect(isArchiveManifest({ ...fixture(), evidenceUrl: "https://example.org/source" })).toBe(true)
  })
  it("ignores malformed annotation values instead of breaking the result list", () => {
    storage.set("unmute-belarus/atlas-annotations/v1", JSON.stringify({ bad: { genres: "not-an-array" }, good: { genres: ["remix"] } }))
    expect(readAnnotations()).toEqual({ good: { genres: ["remix"] } })
  })
  it("exports text as text in spreadsheet programs", () => {
    expect(corpusAsCsv([{ ...fixture(), title: "=HYPERLINK(1)" }])).toContain("'=HYPERLINK(1)")
  })

  it("keeps complete derivative journals and the event trail in safely escaped CSV cells", () => {
    const manifest = journalFixture()
    const csv = corpusAsCsv([manifest])
    expect(csv).toContain(csvCell("intervention_journal_count"))
    expect(csv).toContain(csvCell("derivatives_json"))
    expect(csv).toContain(csvCell("events_json"))
    expect(csv).toContain(csvCell(JSON.stringify(manifest.derivatives)))
    expect(csv).toContain(csvCell(JSON.stringify(manifest.events)))
    expect(csv).toContain('"1"')
    expect(csv).toContain("unmute-intervention/1.0")
  })

  it("exports legacy derivatives without fabricating a structured journal", () => {
    const manifest = journalFixture()
    delete manifest.derivatives![0].intervention
    manifest.schema = "unmute-archive/2.1"
    const csv = corpusAsCsv([manifest])
    expect(csv).toContain(csvCell(JSON.stringify(manifest.derivatives)))
    expect(csv).not.toContain("unmute-intervention/1.0")
    expect(csv).toContain('"0"')
  })

  it("downloads a lossless full JSON backup with derivative and review disclosures intact", async () => {
    const manifest = journalFixture()
    let downloaded: Blob | undefined
    const link = { href: "", download: "", click: vi.fn() }
    vi.stubGlobal("document", { createElement: () => link })
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      downloaded = blob as Blob
      return "blob:test-export"
    })
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined)
    exportCorpusJson([manifest])
    expect(link.click).toHaveBeenCalledOnce()
    expect(link.download).toBe("unmute-the-archive-corpus.json")
    expect(JSON.parse(await downloaded!.text())).toEqual([manifest])
  })
})
