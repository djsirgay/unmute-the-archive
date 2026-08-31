import { describe, expect, it } from "vitest"
import { matchesResearchQuery, reviewerRecords } from "./suite-data"

describe("Music Atlas research queries", () => {
  it("treats dance works OR remixes as a category union", () => {
    const result = reviewerRecords.filter((record) => matchesResearchQuery(record, "Belarusian dance remix"))
    expect(result.length).toBeGreaterThan(2)
    expect(result.every((record) => record.language.toLowerCase().includes("belarusian"))).toBe(true)
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
