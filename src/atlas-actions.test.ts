import { describe, expect, it } from "vitest"
import * as actions from "./atlas-actions"

describe("Music Atlas links", () => {
  const source = "https://www.wikidata.org/wiki/Q123"
  const recording = "https://example.org/label/specific-recording"

  it("renders distinct links for the source and an explicitly documented recording", () => {
    const result = actions.renderAtlasLinks({ source, recording })
    expect(result).toContain(`href="${source}"`)
    expect(result).toContain("Open source")
    expect(result).toContain(`href="${recording}"`)
    expect(result).toContain("Listen to recording")
  })

  it("does not label a reference link as a recording", () => {
    const result = actions.renderAtlasLinks({ source })
    expect(result).toContain("Open source")
    expect(result).toContain("No verified listening link")
    expect(result).not.toContain("Listen to recording")
  })

  it("does not accept unsafe URLs for either action", () => {
    const result = actions.renderAtlasLinks({ source: "javascript:alert(1)", recording: "data:text/html,x" })
    expect(result).not.toContain("href=")
  })
})
