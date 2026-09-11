import { beforeEach, describe, expect, it, vi } from "vitest"
import { isDisclosure, isInterventionJournal, sameSha256, type InterventionJournal } from "./intervention"
import { addDerivative, buildManifest, isArchiveManifest, type ArchiveDerivative, type ArchiveManifest } from "./manifest"
import { readCorpus } from "./corpus"
import { importPassportJson } from "./suite-data"

const masterHash = "ab".repeat(32)
const derivativeHash = "cd".repeat(32)
const master = (): ArchiveManifest => buildManifest({
  status: "fingerprinted", collection: "Synthetic test corpus", title: "Test master",
  creator: "Test creator", language: "Instrumental", place: "Local test",
  context: "A test fixture, not evidence of a participant or an evaluation result.",
  rightsBasis: "Documented for a test; not a grant of permission.",
  source: { filename: "master.wav", bytes: 100, mediaType: "audio/wav", sha256: masterHash },
})

const journal = (): InterventionJournal => ({
  schema: "unmute-intervention/1.0", sourceMasterSha256: masterHash,
  processingType: "non-ai",
  tool: { name: { status: "provided", value: "Web Audio API" }, version: { status: "unknown" }, model: { status: "not-applicable" } },
  instruction: { status: "not-applicable" },
  settings: { status: "provided", value: "High-pass 35 Hz; output 16-bit PCM WAV." },
  authority: { basis: "unknown", scope: "Documentation only; no reuse permission is established." },
  changes: "Filtered a separate listening copy.",
  preservedFeatures: "The source file remains separately retained; preservation of audible features needs review.",
  uncertainty: "Not yet assessed by a listener.",
  review: { status: "pending" }, originalUnchanged: true,
})

const derivative = (intervention?: InterventionJournal): Omit<ArchiveDerivative, "derivativeId" | "createdAt"> => ({
  label: "Test access copy", purpose: "Test listening", method: "Transparent browser DSP",
  changeLog: "High-pass 35 Hz; output 16-bit PCM WAV.",
  source: { filename: "derivative.wav", bytes: 102, mediaType: "audio/wav", sha256: derivativeHash },
  ...(intervention ? { intervention } : {}),
})

describe("explicit intervention disclosures", () => {
  it("retains unknown, undisclosed, and not-applicable as distinct states", () => {
    for (const status of ["unknown", "not-disclosed", "not-applicable"]) {
      expect(isDisclosure({ status })).toBe(true)
      expect(isDisclosure({ status, value: "An inconsistent claim" })).toBe(false)
    }
    expect(isDisclosure({ status: "provided", value: "Tool version 1.0" })).toBe(true)
    expect(isDisclosure({ status: "provided", value: "  " })).toBe(false)
  })

  it.each([undefined, null, [], true, "unknown", { status: ["unknown"] }, { status: { toString: "unknown" } }])(
    "rejects malformed disclosure %j without coercing or throwing", (value) => {
      expect(isDisclosure(value)).toBe(false)
    },
  )

  it("documents non-AI processing without pretending it is AI", () => {
    expect(isInterventionJournal(journal())).toBe(true)
    expect(journal().tool.model).toEqual({ status: "not-applicable" })
  })

  it("accepts an AI intervention whose model version or instruction was not disclosed", () => {
    const value = journal()
    value.processingType = "ai"
    value.tool = { name: { status: "provided", value: "External processing tool" }, version: { status: "not-disclosed" }, model: { status: "unknown" } }
    value.instruction = { status: "not-disclosed" }
    expect(isInterventionJournal(value)).toBe(true)
    expect(value.review.status).toBe("pending")
  })

  it.each(["ai", "unknown"] as const)("does not infer model not-applicable for %s processing", (processingType) => {
    expect(isInterventionJournal({ ...journal(), processingType })).toBe(false)
  })

  it("does not declare an AI tool inapplicable", () => {
    const value = journal()
    value.processingType = "ai"
    value.tool.model = { status: "unknown" }
    value.tool.name = { status: "not-applicable" }
    expect(isInterventionJournal(value)).toBe(false)
  })

  it.each(["unknown", "no-permission"] as const)("retains authority %s as documentation, not authorization", (basis) => {
    const value = { ...journal(), authority: { basis, scope: "Documentation only. No external use is authorized." } }
    expect(isInterventionJournal(value)).toBe(true)
    const saved = addDerivative(master(), derivative(value)).derivatives![0].intervention!
    expect(saved.authority).toEqual(value.authority)
    expect(saved.review.status).toBe("pending")
  })

  it("requires an explicit authority scope even for a stated permission", () => {
    expect(isInterventionJournal({ ...journal(), authority: { basis: "permission", scope: "" } })).toBe(false)
    expect(isInterventionJournal({ ...journal(), authority: { basis: "permission", scope: "Local listening comparison only", evidence: "Creator's written permission, held privately" } })).toBe(true)
  })

  it.each(["reviewed", "rejected"] as const)("requires a reviewer or pseudonym and a note for %s", (status) => {
    expect(isInterventionJournal({ ...journal(), review: { status } })).toBe(false)
    expect(isInterventionJournal({ ...journal(), review: { status, reviewer: "Listener A" } })).toBe(false)
    expect(isInterventionJournal({ ...journal(), review: { status, reviewer: " ", note: "Reviewed the comparison." } })).toBe(false)
    expect(isInterventionJournal({ ...journal(), review: { status, reviewer: "Listener A", note: "Audible artifacts remain; do not replace the master." } })).toBe(true)
  })

  it("does not equate review with approval or rights clearance", () => {
    const value = journal()
    value.review = { status: "reviewed", reviewer: "Test pseudonym", note: "Compared both files; authenticity has not been established." }
    value.authority = { basis: "no-permission", scope: "Documenting only; no authorization asserted." }
    const saved = addDerivative(master(), derivative(value)).derivatives![0].intervention!
    expect(saved.review.status).toBe("reviewed")
    expect(saved.authority.basis).toBe("no-permission")
    expect("approved" in saved.review).toBe(false)
  })

  it("keeps uncertainty qualitative and requires a nonempty note", () => {
    expect(isInterventionJournal({ ...journal(), uncertainty: 0.98 })).toBe(false)
    expect(isInterventionJournal({ ...journal(), uncertainty: "" })).toBe(false)
    expect(isInterventionJournal({ ...journal(), uncertainty: "No independent review has been conducted." })).toBe(true)
  })

  it.each([false, undefined, "true", 1])("requires an explicit unchanged-master attestation, not %j", (originalUnchanged) => {
    expect(isInterventionJournal({ ...journal(), originalUnchanged })).toBe(false)
  })

  it.each([
    { processingType: ["non-ai"] }, { processingType: { toString: "non-ai" } },
    { changes: " " }, { preservedFeatures: "" }, { tool: null }, { sourceMasterSha256: "not-a-hash" },
    { authority: { basis: ["permission"], scope: "local" } }, { review: { status: ["pending"] } },
  ])("rejects malformed journal fields %j", (patch) => {
    expect(isInterventionJournal({ ...journal(), ...patch })).toBe(false)
  })
})

describe("source-bound, portable intervention journals", () => {
  beforeEach(() => {
    const storage = new Map<string, string>()
    vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) })
  })

  it("retains a full journal through JSON export, import, and local corpus storage", () => {
    const updated = addDerivative(master(), derivative(journal()))
    expect(updated.schema).toBe("unmute-archive/2.2")
    expect(isArchiveManifest(updated)).toBe(true)
    expect(importPassportJson(JSON.stringify(updated))).toBe(1)
    expect(readCorpus()).toEqual([updated])
    expect(importPassportJson(JSON.stringify(updated))).toBe(0)
  })

  it.each(["unmute-archive/2.0", "unmute-archive/2.1"] as const)("does not fabricate a journal or upgrade legacy %s", (schema) => {
    const legacy = { ...master(), schema }
    const updated = addDerivative(legacy, derivative())
    expect(updated.schema).toBe(schema)
    expect(updated.derivatives![0].intervention).toBeUndefined()
    expect(importPassportJson(JSON.stringify(updated))).toBe(1)
    expect(readCorpus()[0]).toEqual(updated)
  })

  it("upgrades only when adding a real journal, preserving earlier unreviewed records", () => {
    const legacy = addDerivative({ ...master(), schema: "unmute-archive/2.0" }, derivative())
    const next = derivative(journal())
    next.source.sha256 = "e".repeat(64)
    const updated = addDerivative(legacy, next)
    expect(updated.schema).toBe("unmute-archive/2.2")
    expect(updated.derivatives![0]).toEqual(legacy.derivatives![0])
    expect(updated.derivatives![0].intervention).toBeUndefined()
  })

  it("makes a nested snapshot without mutating the master or the supplied journal", () => {
    const original = master()
    const before = JSON.stringify(original)
    const supplied = derivative(journal())
    const saved = addDerivative(original, supplied)
    const snapshot = JSON.stringify(saved)
    supplied.intervention!.tool.name = { status: "provided", value: "Changed after registration" }
    supplied.intervention!.review.status = "rejected"
    supplied.intervention!.authority.scope = "Changed after registration"
    supplied.source.sha256 = "f".repeat(64)
    expect(JSON.stringify(saved)).toBe(snapshot)
    expect(JSON.stringify(original)).toBe(before)
    expect(saved.source).toEqual(original.source)
  })

  it("binds the journal to the declared master, never an unrelated file", () => {
    const bad = { ...journal(), sourceMasterSha256: "e".repeat(64) }
    expect(() => addDerivative(master(), derivative(bad))).toThrow("different source master")
    const imported = addDerivative(master(), derivative(journal()))
    imported.derivatives![0].intervention!.sourceMasterSha256 = "e".repeat(64)
    expect(isArchiveManifest(imported)).toBe(false)
    expect(() => importPassportJson(JSON.stringify(imported))).toThrow("No records were imported")
    expect(readCorpus()).toEqual([])
  })

  it("compares valid hashes case-insensitively without rewriting the declared spelling", () => {
    const value = { ...journal(), sourceMasterSha256: masterHash.toUpperCase() }
    expect(sameSha256(masterHash, value.sourceMasterSha256)).toBe(true)
    expect(sameSha256("invalid", "INVALID")).toBe(false)
    const updated = addDerivative(master(), derivative(value))
    expect(isArchiveManifest(updated)).toBe(true)
    expect(updated.derivatives![0].intervention!.sourceMasterSha256).toBe(value.sourceMasterSha256)
  })

  it("rejects a master mislabeled as a derivative, including uppercase digest spelling", () => {
    const values = derivative(journal())
    values.source.sha256 = masterHash.toUpperCase()
    expect(() => addDerivative(master(), values)).toThrow("byte-for-byte identical")
    const imported = addDerivative(master(), derivative(journal()))
    imported.derivatives![0].source.sha256 = masterHash.toUpperCase()
    expect(isArchiveManifest(imported)).toBe(false)
  })

  it("rejects duplicate derivative hashes and duplicate IDs in portable JSON", () => {
    const updated = addDerivative(master(), derivative(journal()))
    const first = updated.derivatives![0]
    expect(() => addDerivative(updated, { ...derivative(), source: { ...first.source, sha256: derivativeHash.toUpperCase() } })).toThrow("already registered")
    const sameHash = { ...structuredClone(first), derivativeId: "another-id", source: { ...first.source, sha256: derivativeHash.toUpperCase() } }
    expect(isArchiveManifest({ ...updated, derivatives: [first, sameHash] })).toBe(false)
    const sameId = { ...structuredClone(first), source: { ...first.source, sha256: "e".repeat(64) } }
    expect(isArchiveManifest({ ...updated, derivatives: [first, sameId] })).toBe(false)
  })

  it("rejects source-missing records containing derivatives", () => {
    const updated = addDerivative(master(), derivative(journal()))
    expect(isArchiveManifest({ ...updated, status: "source-missing", source: undefined })).toBe(false)
    expect(isArchiveManifest({ ...master(), status: "source-missing", source: undefined, derivatives: [] })).toBe(true)
  })

  it("does not hide new journal claims inside an old schema", () => {
    const updated = addDerivative(master(), derivative(journal()))
    expect(isArchiveManifest({ ...updated, schema: "unmute-archive/2.1" })).toBe(false)
  })

  it("rejects invalid or misleading review claims before registration or import", () => {
    const invalid = { ...journal(), review: { status: "reviewed" as const } }
    expect(() => addDerivative(master(), derivative(invalid))).toThrow("intervention journal")
    const imported = addDerivative(master(), derivative(journal()))
    imported.derivatives![0].intervention = invalid
    expect(isArchiveManifest(imported)).toBe(false)
  })

  it("rejects enum coercions in imported manifest states instead of throwing", () => {
    expect(isArchiveManifest({ ...master(), schema: ["unmute-archive/2.1"] })).toBe(false)
    expect(isArchiveManifest({ ...master(), status: { toString: "fingerprinted" } })).toBe(false)
    expect(isArchiveManifest({ ...master(), events: [{ type: ["verified"], at: "test", note: "test" }] })).toBe(false)
  })
})
