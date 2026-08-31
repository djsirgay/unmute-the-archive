import { describe, expect, it } from "vitest"
import { corpusAsCsv } from "./corpus"
import { addDerivative, buildManifest, citationFor, isArchiveManifest, sha256 } from "./manifest"

describe("archival passports", () => {
  it("creates a fingerprinted passport with a traceable event", () => {
    const manifest = buildManifest({
      status: "fingerprinted",
      collection: "Belarusian Music in Exile — Pilot Corpus",
      title: "Test recording",
      creator: "Test creator",
      language: "Belarusian",
      place: "Minsk / Los Angeles",
      recordedOn: "2016-10-19",
      context: "A documented test item.",
      rightsBasis: "Creator-owned.",
      source: {
        filename: "test.wav",
        mediaType: "audio/wav",
        bytes: 4,
        sha256: "a".repeat(64),
      },
    })

    expect(manifest.schema).toBe("unmute-archive/2.1")
    expect(manifest.events.map((event) => event.type)).toEqual(["documented", "fingerprinted"])
    expect(citationFor(manifest)).toContain("Fingerprint-verified local source")
  })

  it("keeps missing-source records explicit and unfingerprinted", () => {
    const manifest = buildManifest({
      status: "source-missing",
      collection: "Pilot corpus",
      title: "Lost master",
      creator: "Test creator",
      language: "Belarusian",
      place: "Belarus",
      context: "Public evidence exists, but the master is unavailable.",
      rightsBasis: "Creator-owned work.",
      evidenceUrl: "https://example.com/evidence",
    })

    expect(manifest.source).toBeUndefined()
    expect(manifest.events).toHaveLength(1)
    expect(citationFor(manifest)).toContain("Metadata-only recovery record")
  })

  it("produces stable SHA-256 fingerprints", async () => {
    const first = await sha256(new Blob(["same bytes"]))
    const second = await sha256(new Blob(["same bytes"]))
    const changed = await sha256(new Blob(["changed bytes"]))

    expect(first).toHaveLength(64)
    expect(first).toBe(second)
    expect(first).not.toBe(changed)
  })

  it("exports research-friendly CSV fields", () => {
    const manifest = buildManifest({
      status: "source-missing",
      collection: "Pilot corpus",
      title: "A title, with punctuation",
      creator: "Creator",
      language: "Belarusian",
      place: "Los Angeles",
      context: "Context",
      rightsBasis: "Creator-owned.",
    })

    const csv = corpusAsCsv([manifest])
    expect(csv).toContain('"archive_id"')
    expect(csv).toContain('"A title, with punctuation"')
    expect(csv).toContain('"source-missing"')
    expect(csv).toContain('"context"')
    expect(csv).toContain('"rights_basis"')
    expect(csv).toContain('"derivative_count"')
  })

  it("links a documented derivative without replacing the source master", () => {
    const manifest = buildManifest({
      status: "fingerprinted",
      collection: "Pilot corpus",
      title: "Archive master",
      creator: "Creator",
      language: "Belarusian",
      place: "Minsk",
      context: "Context",
      rightsBasis: "Creator-owned.",
      source: { filename: "master.wav", mediaType: "audio/wav", bytes: 10, sha256: "a".repeat(64) },
    })
    const updated = addDerivative(manifest, {
      label: "Restoration test A",
      purpose: "Listening access",
      method: "Documented noise reduction",
      changeLog: "Reduced steady noise; no generative replacement.",
      source: { filename: "restored.wav", mediaType: "audio/wav", bytes: 12, sha256: "b".repeat(64) },
    })

    expect(updated.source?.sha256).toBe("a".repeat(64))
    expect(updated.derivatives?.[0].source.sha256).toBe("b".repeat(64))
    expect(updated.events.at(-1)?.type).toBe("derived")
  })

  it("rejects a master mislabeled as a derivative and duplicate derivatives", () => {
    const manifest = buildManifest({
      status: "fingerprinted",
      collection: "Pilot corpus",
      title: "Archive master",
      creator: "Creator",
      language: "Belarusian",
      place: "Minsk",
      context: "Context",
      rightsBasis: "Creator-owned.",
      source: { filename: "master.wav", mediaType: "audio/wav", bytes: 10, sha256: "a".repeat(64) },
    })
    const derivative = {
      label: "Restoration test A",
      purpose: "Listening access",
      method: "Documented noise reduction",
      changeLog: "Reduced steady noise.",
      source: { filename: "restored.wav", mediaType: "audio/wav", bytes: 12, sha256: "b".repeat(64) },
    }

    expect(() => addDerivative(manifest, { ...derivative, source: manifest.source! })).toThrow("byte-for-byte identical")
    const updated = addDerivative(manifest, derivative)
    expect(() => addDerivative(updated, derivative)).toThrow("already registered")
  })

  it("rejects incomplete or internally inconsistent portable JSON", () => {
    const valid = buildManifest({
      status: "fingerprinted",
      collection: "Pilot corpus",
      title: "Archive master",
      creator: "Creator",
      language: "Belarusian",
      place: "Minsk",
      context: "Context",
      rightsBasis: "Creator-owned.",
      source: { filename: "master.wav", mediaType: "audio/wav", bytes: 10, sha256: "a".repeat(64) },
    })

    expect(isArchiveManifest(valid)).toBe(true)
    expect(isArchiveManifest({ schema: "unmute-archive/2.1", archiveId: "unsafe" })).toBe(false)
    expect(isArchiveManifest({ ...valid, source: undefined })).toBe(false)
    expect(isArchiveManifest({ ...valid, source: { ...valid.source, sha256: "not-a-digest" } })).toBe(false)
  })
})
