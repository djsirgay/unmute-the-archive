import { describe, expect, it } from "vitest"
import { capturePassportSubmission, completePassportSubmission } from "./passport-submission"
import { sha256 } from "./manifest"

const fields = () => ({ title: "Captured title", creator: "Test creator", collection: "Test collection", language: "Belarusian", place: "Unknown", context: "Captured source context", rightsBasis: "Captured preservation declaration" })

describe("source passport submission snapshots", () => {
  it("keeps the submitted file and all declarations together while hashing yields", async () => {
    let file = new File(["original source bytes"], "original.wav", { type: "audio/wav" })
    let consent = true
    const values = fields()
    const snapshot = capturePassportSubmission("present", file, consent, values)
    const digest = sha256(snapshot.file!)
    values.title = "Changed after validation"
    values.context = "Different source context"
    values.rightsBasis = "A later, different declaration"
    file = new File(["replacement source bytes"], "replacement.wav", { type: "audio/wav" })
    consent = false
    const saved = completePassportSubmission(snapshot, await digest)
    expect(saved.title).toBe("Captured title")
    expect(saved.context).toBe("Captured source context")
    expect(saved.rightsBasis).toBe("Captured preservation declaration")
    expect(saved.source!.filename).toBe("original.wav")
    expect(saved.source!.sha256).not.toBe(await sha256(file))
    expect(snapshot.preservationConsent).toBe(true)
    expect(consent).toBe(false)
  })

  it("does not create a source passport without explicit initial preservation consent", () => {
    const file = new File(["bytes"], "source.wav")
    expect(() => capturePassportSubmission("present", file, false, fields())).toThrow("permission to preserve")
    expect(() => capturePassportSubmission("present", file, "true" as unknown as boolean, fields())).toThrow("permission to preserve")
  })

  it("rejects absent and empty source files", () => {
    expect(() => capturePassportSubmission("present", null, true, fields())).toThrow("nonempty source")
    expect(() => capturePassportSubmission("present", new File([], "empty.wav"), true, fields())).toThrow("nonempty source")
  })

  it("keeps recovery records source-missing even if a stale file and checkbox remain in the form", () => {
    const snapshot = capturePassportSubmission("missing", new File(["bytes"], "old.wav"), true, fields())
    expect(snapshot.file).toBeNull()
    expect(snapshot.preservationConsent).toBe(false)
    const saved = completePassportSubmission(snapshot)
    expect(saved.status).toBe("source-missing")
    expect(saved.source).toBeUndefined()
    expect(saved.events.map((event) => event.type)).toEqual(["documented"])
  })

  it("requires the real completed source digest rather than a fabricated placeholder", () => {
    const snapshot = capturePassportSubmission("present", new File(["bytes"], "source.wav"), true, fields())
    expect(() => completePassportSubmission(snapshot)).toThrow("SHA-256")
    expect(() => completePassportSubmission(snapshot, "not-a-digest")).toThrow("SHA-256")
  })

  it("validates captured metadata and evidence links before persistence", () => {
    const incomplete = capturePassportSubmission("missing", null, false, { ...fields(), title: "" })
    expect(() => completePassportSubmission(incomplete)).toThrow("incomplete")
    const unsafe = capturePassportSubmission("missing", null, false, { ...fields(), evidenceUrl: "javascript:alert(1)" })
    expect(() => completePassportSubmission(unsafe)).toThrow("incomplete")
  })
})
