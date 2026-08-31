import { describe, expect, it } from "vitest"
import { importPassportJson, isDanceRemixQuery, matchesResearchQuery, researchRelevance, reviewerRecords } from "./suite-data"

describe("Music Atlas research queries", () => {
  it("treats dance works OR remixes as a category union", () => {
    const result = reviewerRecords.filter((record) => matchesResearchQuery(record, "Belarusian dance remix"))
    expect(result.length).toBeGreaterThanOrEqual(15)
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
      expect(result.length).toBeGreaterThanOrEqual(15)
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
    expect(importPassportJson(JSON.stringify({ schema: "unmute-archive/2.1", archiveId: "incomplete", title: "Unsafe" }))).toBe(0)
  })
})
