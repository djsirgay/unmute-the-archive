import { describe, expect, it } from "vitest"
import { buildManifest, isArchiveManifest, sha256, type ArchiveDerivative } from "./manifest"
import { captureDerivativeSubmission, completeDerivativeSubmission, disclosureText, InterventionFormError, interventionReceipt, journalFromFields, syncInterventionForm, type InterventionFormFields } from "./intervention-form"

const fields = (): InterventionFormFields => ({
  label: "Listening copy", purpose: "Private comparison", processingType: "unknown",
  toolName: { status: "unknown", value: "" }, toolVersion: { status: "unknown", value: "" }, model: { status: "unknown", value: "" },
  instruction: { status: "not-disclosed", value: "Hidden former instruction" }, settings: { status: "unknown", value: "" },
  authorityBasis: "unknown", authorityScope: "Not established; no reuse authorized", authorityEvidence: "",
  changes: "Noise changed; effect on voice unassessed", preservedFeatures: "", uncertainty: "",
  reviewStatus: "pending", reviewer: "", reviewNote: "", originalUnchanged: true,
})
const master = () => buildManifest({
  status: "fingerprinted", title: "Master", creator: "Test", collection: "Test collection", language: "Belarusian",
  place: "Unknown", context: "Fixture only", rightsBasis: "Source ownership declared",
  source: { filename: "master.wav", mediaType: "audio/wav", bytes: 10, sha256: "a".repeat(64) },
})
const file = () => new File(["derivative audio bytes"], "copy.wav", { type: "audio/wav" })

describe("intervention form declarations", () => {
  it("stores uncertainty explicitly, leaves review pending, and discards hidden disclosures", () => {
    const journal = journalFromFields(fields(), "a".repeat(64))
    expect(journal.preservedFeatures).toBe("Not assessed.")
    expect(journal.uncertainty).toBe("Not assessed.")
    expect(journal.review).toEqual({ status: "pending" })
    expect(journal.authority.basis).toBe("unknown")
    expect(journal.instruction).toEqual({ status: "not-disclosed" })
    expect(JSON.stringify(journal)).not.toContain("Hidden former instruction")
  })

  it.each(["toolName", "toolVersion", "model", "instruction", "settings"] as const)("requires a value when %s is Provided", (key) => {
    const value = fields()
    value[key] = { status: "provided", value: "  " }
    expect(() => journalFromFields(value, "a".repeat(64))).toThrow(InterventionFormError)
    value[key].value = "Known detail"
    expect(() => journalFromFields(value, "a".repeat(64))).not.toThrow()
  })

  it.each(["unknown", "ai"])("does not permit model N/A when processing is %s", (processingType) => {
    expect(() => journalFromFields({ ...fields(), processingType, model: { status: "not-applicable", value: "" } }, "a".repeat(64))).toThrow("explicitly non-AI")
  })

  it("allows explicit non-AI/model N/A without fabricating a model", () => {
    const journal = journalFromFields({ ...fields(), processingType: "non-ai", model: { status: "not-applicable", value: "Old model" } }, "a".repeat(64))
    expect(journal.tool.model).toEqual({ status: "not-applicable" })
  })

  it.each(["reviewed", "rejected"])("requires a reviewer and substantive note for %s", (reviewStatus) => {
    const value = { ...fields(), reviewStatus }
    expect(() => journalFromFields(value, "a".repeat(64))).toThrow("reviewer name")
    value.reviewer = "Listener 1"
    expect(() => journalFromFields(value, "a".repeat(64))).toThrow("review note")
    value.reviewNote = "Compared both files; speech artifacts remain"
    expect(journalFromFields(value, "a".repeat(64)).review).toEqual({ status: reviewStatus, reviewer: "Listener 1", note: value.reviewNote })
  })

  it("does not infer completed review from a name or free-text note", () => {
    const journal = journalFromFields({ ...fields(), reviewer: "Person", reviewNote: "I listened" }, "a".repeat(64))
    expect(journal.review.status).toBe("pending")
  })

  it.each(["unknown", "no-permission"])("allows documenting authority %s without granting rights", (authorityBasis) => {
    expect(journalFromFields({ ...fields(), authorityBasis }, "a".repeat(64)).authority).toEqual({ basis: authorityBasis, scope: "Not established; no reuse authorized" })
  })

  it("requires scope, changes, and a deliberate preserved-master attestation", () => {
    expect(() => journalFromFields({ ...fields(), authorityScope: " " }, "a".repeat(64))).toThrow("permission scope")
    expect(() => journalFromFields({ ...fields(), changes: " " }, "a".repeat(64))).toThrow("change log")
    expect(() => journalFromFields({ ...fields(), originalUnchanged: false }, "a".repeat(64))).toThrow("original master is preserved")
  })
})

describe("snapshot-safe registration", () => {
  it("captures all controls and the exact file before asynchronous hashing", async () => {
    const source = master()
    const originalSource = structuredClone(source)
    const inputs = fields()
    let selectedFile = file()
    const snapshot = captureDerivativeSubmission(source, selectedFile, inputs)
    const hashPromise = sha256(snapshot.file)
    inputs.label = "Changed mid-hash"
    inputs.authorityBasis = "permission"
    inputs.reviewStatus = "reviewed"
    source.title = "Different selected master"
    selectedFile = new File(["different content"], "other.wav", { type: "audio/wav" })
    const saved = completeDerivativeSubmission(snapshot, originalSource, await hashPromise)
    expect(isArchiveManifest(saved)).toBe(true)
    expect(saved.title).toBe("Master")
    expect(saved.derivatives![0].label).toBe("Listening copy")
    expect(saved.derivatives![0].source.filename).toBe("copy.wav")
    expect(saved.derivatives![0].source.sha256).not.toBe(await sha256(selectedFile))
    expect(saved.derivatives![0].intervention?.authority.basis).toBe("unknown")
    expect(saved.derivatives![0].intervention?.review.status).toBe("pending")
    expect(saved.source).toEqual(originalSource.source)
  })

  it("rejects stale or deleted masters rather than overwriting concurrent edits", () => {
    const source = master()
    const snapshot = captureDerivativeSubmission(source, file(), fields())
    expect(() => completeDerivativeSubmission(snapshot, undefined, "b".repeat(64))).toThrow("passport changed")
    expect(() => completeDerivativeSubmission(snapshot, { ...source, context: "New evidence" }, "b".repeat(64))).toThrow("passport changed")
    expect(source.derivatives).toBeUndefined()
  })

  it("rejects empty files, missing labels, and master bytes presented as a derivative", () => {
    expect(() => captureDerivativeSubmission(master(), new File([], "empty.wav"), fields())).toThrow("nonempty")
    expect(() => captureDerivativeSubmission(master(), file(), { ...fields(), label: " " })).toThrow("derivative label")
    const source = master()
    const snapshot = captureDerivativeSubmission(source, file(), fields())
    expect(() => completeDerivativeSubmission(snapshot, source, "a".repeat(64))).toThrow("byte-for-byte identical")
  })
})

describe("transparent, safely rendered receipts", () => {
  const derivative = (): ArchiveDerivative => ({
    derivativeId: "test", createdAt: "2026-09-10T00:00:00Z", label: "Copy", purpose: "Test", method: "Legacy method", changeLog: "Legacy changes",
    source: { filename: "copy.wav", mediaType: "audio/wav", bytes: 10, sha256: "b".repeat(64) },
  })

  it("renders all journal fields and escapes supplied markup rather than executing it", () => {
    const value = fields()
    value.toolName = { status: "provided", value: '<script>alert("tool")</script>' }
    value.toolVersion = { status: "provided", value: "VERSION_SENTINEL" }
    value.model = { status: "provided", value: "MODEL_SENTINEL" }
    value.instruction = { status: "provided", value: "INSTRUCTION_SENTINEL" }
    value.settings = { status: "provided", value: "SETTINGS_SENTINEL" }
    value.authorityEvidence = '<img src=x onerror="alert(1)">'
    value.preservedFeatures = "PRESERVED_SENTINEL"
    value.uncertainty = "UNCERTAINTY_SENTINEL"
    value.reviewStatus = "rejected"
    value.reviewer = "REVIEWER_SENTINEL"
    value.reviewNote = "NOTE_SENTINEL"
    const html = interventionReceipt({ ...derivative(), intervention: journalFromFields(value, "a".repeat(64)) })
    for (const sentinel of ["VERSION", "MODEL", "INSTRUCTION", "SETTINGS", "PRESERVED", "UNCERTAINTY", "REVIEWER", "NOTE"]) expect(html).toContain(`${sentinel}_SENTINEL`)
    expect(html).toContain("&lt;script&gt;")
    expect(html).toContain("&lt;img")
    expect(html).not.toContain("<script>")
    expect(html).not.toContain("<img")
    expect(html).toContain("rejected")
    expect(html).toContain("a".repeat(64))
    expect(html).toContain("b".repeat(64))
    expect(html).toContain("not independently verified")
  })

  it("labels a legacy reviewer note as unstructured, not completed review", () => {
    const html = interventionReceipt({ ...derivative(), reviewerNote: "Reviewed in old note" })
    expect(html).toContain("Structured review not recorded")
    expect(html).toContain("not a review decision")
    expect(html).toContain("Reviewed in old note")
    expect(html).not.toContain("Declared human review status")
  })

  it("keeps distinct disclosure labels readable", () => {
    expect(disclosureText({ status: "unknown" })).toBe("Unknown")
    expect(disclosureText({ status: "not-disclosed" })).toBe("Not disclosed")
    expect(disclosureText({ status: "not-applicable" })).toBe("Not applicable")
  })
})

describe("conditional control state", () => {
  it("disables hidden values and removes stale model N/A when processing becomes unknown", () => {
    const controls = new Map<string, Record<string, unknown>>()
    const add = (id: string, value: string) => {
      const option = { disabled: false }
      const control = { value, required: false, hidden: false, disabled: false, querySelector: () => option }
      controls.set(`#${id}`, control)
      return control
    }
    add("intervention-processing", "unknown")
    for (const id of ["intervention-tool", "intervention-version", "intervention-model", "derivative-method", "intervention-settings"]) {
      add(id, "Previous text")
      add(id === "derivative-method" ? "intervention-instruction-status" : `${id}-status`, id === "intervention-model" ? "not-applicable" : "unknown")
    }
    add("intervention-review-status", "pending")
    add("intervention-reviewer", "")
    add("derivative-review", "")
    controls.set("#intervention-review-help", { textContent: "" })
    const form = { querySelector: (selector: string) => controls.get(selector) ?? null } as unknown as HTMLFormElement
    syncInterventionForm(form)
    expect(controls.get("#intervention-model-status")?.value).toBe("unknown")
    expect(controls.get("#intervention-model")?.disabled).toBe(true)
    expect(controls.get("#intervention-model")?.required).toBe(false)
    controls.get("#intervention-tool-status")!.value = "provided"
    controls.get("#intervention-review-status")!.value = "reviewed"
    syncInterventionForm(form)
    expect(controls.get("#intervention-tool")?.hidden).toBe(false)
    expect(controls.get("#intervention-tool")?.required).toBe(true)
    expect(controls.get("#intervention-reviewer")?.required).toBe(true)
    expect(controls.get("#derivative-review")?.required).toBe(true)
  })
})
