import { describe, expect, it } from "vitest"
import { matchesResearchQuery, reviewerRecords } from "./suite-data"

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
})
