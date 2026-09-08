import { beforeEach, describe, expect, it, vi } from "vitest"
import { buildManifest, isArchiveManifest } from "./manifest"
import { corpusAsCsv, corpusStorageIssue, readCorpus, saveToCorpus } from "./corpus"
import { importPassportJson, readAnnotations } from "./suite-data"

const fixture = () => buildManifest({ status: "source-missing", title: "Original record", creator: "Creator", collection: "Research", language: "Belarusian", place: "Unknown", context: "Context", rightsBasis: "Rights need review" })
let storage: Map<string, string>
beforeEach(() => {
  storage = new Map()
  vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) })
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
})
