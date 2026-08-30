import { describe, expect, it } from "vitest"
import { corpusAsCsv } from "./corpus"
import { buildManifest, citationFor, sha256 } from "./manifest"

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

    expect(manifest.schema).toBe("unmute-archive/2.0")
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
  })
})
