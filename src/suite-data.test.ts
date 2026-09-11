import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { atlasRecords, atlasRecordsAsCsv, importPassportJson, isDanceRemixQuery, matchesResearchQuery, researchRelevance, reviewerRecords, saveAnnotation } from "./suite-data"
import { csvCell, readCorpus, saveToCorpus } from "./corpus"
import { addDerivative, buildManifest } from "./manifest"
import type { InterventionJournal } from "./intervention"

describe("Music Atlas research queries", () => {
  it("treats dance works OR remixes as a category union", () => {
    const result = reviewerRecords.filter((record) => matchesResearchQuery(record, "Belarusian dance works or remixes"))
    expect(result.length).toBe(14)
    expect(result.every((record) => record.language.toLowerCase().includes("belarusian"))).toBe(true)
    expect(result.every((record) => record.dance || ["mix", "dj-set", "derivative"].includes(record.kind) || record.relationship.includes("remix"))).toBe(true)
    expect(result.some((record) => !record.creator.includes("Ulyanov"))).toBe(true)
    expect(result.some((record) => record.creator.includes("Šuma"))).toBe(true)
    expect(result.some((record) => record.creator.includes("Akute"))).toBe(true)
  })

  it("keeps non-dance creator records out of the dance/remix result", () => {
    const ids = reviewerRecords.filter((record) => matchesResearchQuery(record, "Belarusian dance remix")).map((record) => record.id)
    expect(ids).not.toContain("review-2016-single")
    expect(ids).not.toContain("review-2020-protest")
    expect(ids).not.toContain("review-vinyl-reissue")
  })

  it("exposes three independently sourced Znička remix records", () => {
    const result = reviewerRecords.filter((record) => record.id.startsWith("public-ana-zhdanova-znichka"))
    expect(result).toHaveLength(3)
    expect(result.every((record) => record.evidenceUrl?.includes("34mag.net"))).toBe(true)
  })

  it("does not invent a match when the evidence has no requested term", () => {
    expect(reviewerRecords.filter((record) => matchesResearchQuery(record, "symphonic 1972")).length).toBe(0)
  })

  it("finds an evidence-backed protest record", () => {
    const result = reviewerRecords.filter((record) => matchesResearchQuery(record, "2020 protest"))
    expect(result).toHaveLength(1)
    expect(result[0].evidenceUrl).toContain("youtu.be")
  })

  it("understands the same natural-language research request in Russian and Belarusian", () => {
    const queries = [
      "найди все танцевальные работы или ремиксы на белорусскоязычные треки",
      "знайдзі ўсе танцавальныя працы або рэміксы беларускамоўных трэкаў",
    ]
    queries.forEach((query) => {
      const result = reviewerRecords.filter((record) => matchesResearchQuery(record, query))
      expect(isDanceRemixQuery(query)).toBe(true)
      expect(result.length).toBe(14)
      expect(result.some((record) => record.creator.includes("Šuma"))).toBe(true)
      expect(result.some((record) => record.creator.includes("Akute"))).toBe(true)
    })
  })

  it("ranks source-documented remixes ahead of broader dance-set matches", () => {
    const query = "Belarusian dance remix"
    const remix = reviewerRecords.find((record) => record.id === "public-akute-adzinotstva-dj-boston")!
    const djSet = reviewerRecords.find((record) => record.id === "review-belarus-in-exile-set")!
    expect(researchRelevance(remix, query)).toBeGreaterThan(researchRelevance(djSet, query))
  })

  it("keeps the explicit dance flag consistent with dance genre labels", () => {
    expect(reviewerRecords.filter((record) => record.genres.includes("dance") && !record.dance)).toEqual([])
  })

  it("does not treat a Belarusian collection name as a Belarusian-language recording", () => {
    const instrumental = {
      ...reviewerRecords[0],
      id: "local-instrumental-demo",
      language: "Instrumental / no linguistic content",
      collection: "Belarusian Music in Exile — Pilot Corpus",
      kind: "derivative" as const,
      relationship: "documented derivative",
      dance: true,
    }
    expect(matchesResearchQuery(instrumental, "Belarusian dance remix")).toBe(false)
  })

  it("does not return an unrelated Belarusian restoration as a remix", () => {
    const restoration = {
      ...reviewerRecords[0],
      id: "local-belarusian-restoration",
      language: "Belarusian",
      kind: "derivative" as const,
      relationship: "documented restoration derivative",
      genres: ["archival"],
      dance: false,
    }
    expect(matchesResearchQuery(restoration, "Belarusian dance remix")).toBe(false)
  })

  it("refuses an incomplete portable passport before it reaches browser storage", () => {
    expect(() => importPassportJson(JSON.stringify({ schema: "unmute-archive/2.1", archiveId: "incomplete", title: "Unsafe" }))).toThrow("No records were imported")
  })

  it("requires BOTH dance and remix when the user does not ask for OR", () => {
    const result = reviewerRecords.filter((record) => matchesResearchQuery(record, "танцевальные ремиксы на белорусском языке"))
    expect(result).toHaveLength(3)
    expect(result.every((record) => record.dance && record.relationship.includes("remix"))).toBe(true)
  })

  it("treats an ampersand as AND, not OR", () => {
    const result = reviewerRecords.filter((record) => matchesResearchQuery(record, "Belarusian dance & remixes"))
    expect(result).toHaveLength(3)
    expect(result.every((record) => record.dance && record.relationship.includes("remix"))).toBe(true)
  })

  it("does not classify any derivative as a remix", () => {
    const restoration = { ...reviewerRecords[0], kind: "derivative" as const, title: "Restored master", relationship: "documented restoration derivative", genres: [] }
    expect(matchesResearchQuery(restoration, "remix")).toBe(false)
  })

  it("finds accented Latin and Belarusian artist names and year ranges", () => {
    expect(reviewerRecords.filter((record) => matchesResearchQuery(record, "Шума рэміксы"))).toHaveLength(4)
    expect(reviewerRecords.filter((record) => matchesResearchQuery(record, "Znicka remix"))).toHaveLength(3)
    const result = reviewerRecords.filter((record) => matchesResearchQuery(record, "Belarusian remixes 2013–2014"))
    expect(result).toHaveLength(5)
  })

  it("dates the three Iholki EP remixes to the cited 2012 Budzma report", () => {
    const ids = ["public-akute-iholki-deech", "public-akute-iholki-pryzma", "public-akute-adzinotstva-dj-boston"]
    const records = reviewerRecords.filter((record) => ids.includes(record.id))
    expect(records).toHaveLength(3)
    expect(records.every((record) => record.year === 2012 && record.summary.includes("October 25, 2012"))).toBe(true)
  })

  it("keeps an unverified vocal-language lead out of language results", () => {
    const record = reviewerRecords.find((item) => item.id === "public-palina-ya-poymu-belyaev")!
    expect(matchesResearchQuery(record, "Palina remix")).toBe(true)
    expect(matchesResearchQuery(record, "Belarusian remix")).toBe(false)
  })
})

describe("derivative evidence and portable Atlas audit records", () => {
  beforeEach(() => {
    const storage = new Map<string, string>()
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  const journal = (
    review: InterventionJournal["review"]["status"] = "pending",
    basis: InterventionJournal["authority"]["basis"] = "unknown",
  ): InterventionJournal => ({
    schema: "unmute-intervention/1.0",
    sourceMasterSha256: "a".repeat(64),
    processingType: "ai",
    tool: {
      name: { status: "provided", value: "Test tool" },
      version: { status: "not-disclosed" },
      model: { status: "unknown" },
    },
    instruction: { status: "provided", value: 'Reduce noise, preserve "voice".\nDo not invent words.' },
    settings: { status: "unknown" },
    authority: { basis, scope: "Private comparison only; public reuse not established", evidence: "Private permission reference, not a public grant" },
    changes: "Noise reduced; result may contain generated detail.",
    preservedFeatures: "Original master retained separately.",
    uncertainty: "Vocal artifacts have not been independently assessed.",
    review: review === "pending" ? { status: review } : { status: review, reviewer: "Pseudonymous reviewer", note: "Declared listening review; no rights determination." },
    originalUnchanged: true,
  })

  const passport = (intervention?: InterventionJournal) => addDerivative(buildManifest({
    status: "fingerprinted",
    title: "Archive test",
    creator: "Test creator",
    collection: "Test collection",
    language: "Belarusian",
    place: "Unknown",
    context: "Synthetic usability fixture.",
    rightsBasis: "Master-only permission marker",
    source: { filename: "master.wav", mediaType: "audio/wav", bytes: 10, sha256: "a".repeat(64) },
  }), {
    label: "Listening copy",
    purpose: "Private comparison",
    method: "Declared test processing",
    changeLog: "Some noise removed.",
    reviewerNote: "Historical note says reviewed; this is not a structured review decision.",
    ...(intervention ? { intervention } : {}),
    source: { filename: "derivative.wav", mediaType: "audio/wav", bytes: 12, sha256: "b".repeat(64) },
  })

  it.each([
    ["pending", "unknown"], ["pending", "permission"], ["reviewed", "unknown"],
    ["reviewed", "no-permission"], ["rejected", "creator-owned"], ["rejected", "permission"],
  ] as const)("does not upgrade %s review / %s authority into high evidence or inherited rights", (review, basis) => {
    saveToCorpus(passport(journal(review, basis)))
    const record = atlasRecords(false).find((item) => item.derivative)!
    expect(record.confidence).toBe("medium")
    expect(record.reviewStatus).toBe(review)
    expect(record.rightsStatus).not.toContain("Master-only permission marker")
    expect(record.rightsStatus).toContain("does not grant reuse rights")
    expect(record.summary).toContain(`Declared human review: ${review}`)
    expect(record.masterRightsBasis).toBe("Master-only permission marker")
    expect(record.intervention?.authority.basis).toBe(basis)
    expect(record.sourceStatus).toBe("fingerprinted")
  })

  it("keeps legacy authority and review unknown even if a historical reviewer note exists", () => {
    saveToCorpus(passport())
    const record = atlasRecords(false).find((item) => item.derivative)!
    expect(record.reviewStatus).toBe("unknown")
    expect(record.intervention).toBeUndefined()
    expect(record.derivative?.intervention).toBeUndefined()
    expect(record.confidence).toBe("medium")
    expect(record.rightsStatus).toContain("Derivative authority unknown")
    expect(record.summary).toContain("Human review status unknown")
    expect(record.derivative?.reviewerNote).toContain("Historical note")
  })

  it("does not treat a declared completed review and authority as independent verification", () => {
    saveToCorpus(passport(journal("reviewed", "permission")))
    const record = atlasRecords(false).find((item) => item.derivative)!
    expect(record.confidence).toBe("medium")
    expect(record.rightsStatus).toContain("Declared derivative authority: permission")
    expect(record.rightsStatus).toContain("Private comparison only")
    expect(record.summary).toContain("does not establish authenticity or permission")
  })

  it("does not let a catalog annotation silently promote a derivative to high evidence", () => {
    const original = passport(journal())
    saveToCorpus(original)
    const id = original.derivatives![0].derivativeId
    saveAnnotation(id, { confidence: "high", genres: ["archival"] })
    const record = atlasRecords(false).find((item) => item.id === id)!
    expect(record.confidence).toBe("medium")
    expect(record.genres).toEqual(["archival"])
    expect(record.reviewStatus).toBe("pending")
    saveAnnotation(id, { confidence: "recovery" })
    expect(atlasRecords(false).find((item) => item.id === id)?.confidence).toBe("recovery")
  })

  it("retains the complete structured journal and both exact-file identities in JSON reports", () => {
    const original = passport(journal("rejected", "unknown"))
    saveToCorpus(original)
    const record = atlasRecords(false).find((item) => item.derivative)!
    const exported = JSON.parse(JSON.stringify(record))
    expect(exported.intervention).toEqual(original.derivatives![0].intervention)
    expect(exported.derivative).toEqual(original.derivatives![0])
    expect(exported.sourceMasterSha256).toBe(original.source?.sha256)
    expect(exported.derivative.source.sha256).toBe("b".repeat(64))
    expect(exported.reviewStatus).toBe("rejected")
  })

  it("preserves audit text, structured disclosure, and legacy fields in CSV results", () => {
    const original = passport(journal("reviewed", "no-permission"))
    saveToCorpus(original)
    const record = atlasRecords(false).find((item) => item.derivative)!
    const csv = atlasRecordsAsCsv([record])
    for (const header of ["rights_status", "review_status", "source_master_sha256", "derivative_sha256", "legacy_reviewer_note", "intervention_json", "derivative_json"]) {
      expect(csv).toContain(csvCell(header))
    }
    expect(csv).toContain(csvCell(JSON.stringify(original.derivatives![0].intervention)))
    expect(csv).toContain(csvCell(JSON.stringify(original.derivatives![0])))
    expect(csv).toContain(csvCell(record.rightsStatus))
    expect(csv).toContain(csvCell("a".repeat(64)))
    expect(csv).toContain(csvCell("b".repeat(64)))
  })

  it("imports complete 2.2 passport backups without losing journal fields", () => {
    const original = passport(journal("pending", "unknown"))
    expect(importPassportJson(JSON.stringify([original]))).toBe(1)
    expect(readCorpus()).toEqual([original])
    expect(atlasRecords(false).find((item) => item.derivative)?.intervention).toEqual(original.derivatives![0].intervention)
  })
})
