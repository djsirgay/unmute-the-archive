import { addDerivative, isArchiveManifest, MAX_BROWSER_AUDIO_BYTES, type ArchiveDerivative, type ArchiveManifest } from "./manifest"
import { isInterventionJournal, type Disclosure, type InterventionJournal } from "./intervention"

export type DisclosureFields = { status: string; value: string }
export type InterventionFormFields = {
  label: string
  purpose: string
  processingType: string
  toolName: DisclosureFields
  toolVersion: DisclosureFields
  model: DisclosureFields
  instruction: DisclosureFields
  settings: DisclosureFields
  authorityBasis: string
  authorityScope: string
  authorityEvidence: string
  changes: string
  preservedFeatures: string
  uncertainty: string
  reviewStatus: string
  reviewer: string
  reviewNote: string
  originalUnchanged: boolean
}

export class InterventionFormError extends Error {
  constructor(message: string, public readonly fieldId: string) {
    super(message)
    this.name = "InterventionFormError"
  }
}

const requireText = (value: string, fieldId: string, label: string): string => {
  const text = value.trim()
  if (!text) throw new InterventionFormError(`Please complete ${label}.`, fieldId)
  return text
}

const disclosure = (fields: DisclosureFields, fieldId: string, label: string): Disclosure => {
  if (fields.status === "provided") return { status: "provided", value: requireText(fields.value, fieldId, label) }
  if (["unknown", "not-disclosed", "not-applicable"].includes(fields.status)) {
    // Never retain a hidden former value as if it were still being disclosed.
    return { status: fields.status as Exclude<Disclosure["status"], "provided"> }
  }
  throw new InterventionFormError(`Choose a disclosure status for ${label}.`, fieldId === "derivative-method" ? "intervention-instruction-status" : `${fieldId}-status`)
}

export const disclosureText = (value: Disclosure): string => value.status === "provided"
  ? value.value
  : ({ unknown: "Unknown", "not-disclosed": "Not disclosed", "not-applicable": "Not applicable" })[value.status]

export const journalFromFields = (fields: InterventionFormFields, sourceMasterSha256: string): InterventionJournal => {
  if (!["ai", "non-ai", "unknown"].includes(fields.processingType)) throw new InterventionFormError("Choose the processing type, or explicitly choose Unknown.", "intervention-processing")
  const toolName = disclosure(fields.toolName, "intervention-tool", "tool name")
  const model = disclosure(fields.model, "intervention-model", "model name")
  if (model.status === "not-applicable" && fields.processingType !== "non-ai") throw new InterventionFormError("Model is not applicable only when processing is explicitly non-AI. Choose Unknown if you do not know.", "intervention-model-status")
  if (toolName.status === "not-applicable" && fields.processingType === "ai") throw new InterventionFormError("An AI tool cannot be marked not applicable. Choose Unknown or Not disclosed if needed.", "intervention-tool-status")
  const version = disclosure(fields.toolVersion, "intervention-version", "tool version")
  const instruction = disclosure(fields.instruction, "derivative-method", "processing instruction or method")
  const settings = disclosure(fields.settings, "intervention-settings", "processing settings")
  const changes = requireText(fields.changes, "derivative-changes", "change log")
  if (!["creator-owned", "permission", "public-domain", "unknown", "no-permission"].includes(fields.authorityBasis)) throw new InterventionFormError("Choose the permission basis, including Unknown or No permission when appropriate.", "intervention-authority")
  const scope = requireText(fields.authorityScope, "intervention-scope", "permission scope (or what is unknown)")
  if (!["pending", "reviewed", "rejected"].includes(fields.reviewStatus)) throw new InterventionFormError("Choose the review status.", "intervention-review-status")
  const completedReview = fields.reviewStatus !== "pending"
  const reviewer = completedReview ? requireText(fields.reviewer, "intervention-reviewer", "reviewer name or pseudonym") : fields.reviewer.trim()
  const reviewNote = completedReview ? requireText(fields.reviewNote, "derivative-review", "review note") : fields.reviewNote.trim()
  if (!fields.originalUnchanged) throw new InterventionFormError("Confirm that the original master is preserved and this is a separate derivative.", "derivative-master-check")
  const journal: InterventionJournal = {
    schema: "unmute-intervention/1.0",
    sourceMasterSha256,
    processingType: fields.processingType as InterventionJournal["processingType"],
    tool: { name: toolName, version, model },
    instruction,
    settings,
    authority: {
      basis: fields.authorityBasis as InterventionJournal["authority"]["basis"],
      scope,
      ...(fields.authorityEvidence.trim() ? { evidence: fields.authorityEvidence.trim() } : {}),
    },
    changes,
    preservedFeatures: fields.preservedFeatures.trim() || "Not assessed.",
    uncertainty: fields.uncertainty.trim() || "Not assessed.",
    review: {
      status: fields.reviewStatus as InterventionJournal["review"]["status"],
      ...(reviewer ? { reviewer } : {}),
      ...(reviewNote ? { note: reviewNote } : {}),
    },
    originalUnchanged: true,
  }
  if (!isInterventionJournal(journal)) throw new InterventionFormError("The intervention record is incomplete or its source fingerprint is invalid.", "derivative-passport")
  return journal
}

export type DerivativeSubmission = {
  master: ArchiveManifest
  file: File
  values: Omit<ArchiveDerivative, "derivativeId" | "createdAt" | "source">
}

/** Capture all mutable controls and the exact File before the first asynchronous operation. */
export const captureDerivativeSubmission = (master: ArchiveManifest, file: File, fields: InterventionFormFields): DerivativeSubmission => {
  if (!isArchiveManifest(master) || !master.source) throw new InterventionFormError("Choose a complete fingerprinted source passport.", "derivative-passport")
  if (!file.size || file.size > MAX_BROWSER_AUDIO_BYTES) throw new InterventionFormError("Choose a nonempty derivative file within the browser size limit.", "derivative-file")
  const label = requireText(fields.label, "derivative-label", "derivative label")
  const purpose = requireText(fields.purpose, "derivative-purpose", "derivative purpose")
  const journal = journalFromFields(fields, master.source.sha256)
  return {
    master: structuredClone(master), file,
    values: {
      label,
      purpose,
      method: `Declared processing: ${journal.processingType}. Tool: ${disclosureText(journal.tool.name)}. Instruction: ${disclosureText(journal.instruction)}.`,
      changeLog: journal.changes,
      ...(journal.review.note ? { reviewerNote: journal.review.note } : {}),
      intervention: journal,
    },
  }
}

/** Do not overwrite a deleted, replaced, or concurrently edited passport after hashing. */
export const completeDerivativeSubmission = (snapshot: DerivativeSubmission, currentMaster: ArchiveManifest | undefined, digest: string): ArchiveManifest => {
  if (!currentMaster || JSON.stringify(currentMaster) !== JSON.stringify(snapshot.master)) {
    throw new InterventionFormError("The source passport changed while fingerprinting. Your form is still here; reopen the current passport and register again.", "derivative-passport")
  }
  return addDerivative(currentMaster, {
    ...snapshot.values,
    source: { filename: snapshot.file.name, mediaType: snapshot.file.type || "application/octet-stream", bytes: snapshot.file.size, sha256: digest },
  })
}

const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!)
const receiptRow = (label: string, value: string): string => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`

/** Render every declarative field without treating supplied text or evidence as HTML. */
export const interventionReceipt = (derivative: ArchiveDerivative): string => {
  const journal = derivative.intervention
  if (!journal) return `<div class="intervention-receipt intervention-legacy"><p><strong>Structured review not recorded.</strong> This legacy derivative has no structured intervention journal. Its processing disclosures, permission scope, and review decision are not established by a fingerprint.</p><dl>${receiptRow("Method (legacy)", derivative.method)}${receiptRow("Change log (legacy)", derivative.changeLog)}${receiptRow("Legacy free-text note — not a review decision", derivative.reviewerNote || "Not recorded")}${receiptRow("Derivative SHA-256", derivative.source.sha256)}</dl></div>`
  const rows: [string, string][] = [
    ["Journal schema", journal.schema], ["Declared source master SHA-256", journal.sourceMasterSha256],
    ["Derivative SHA-256", derivative.source.sha256], ["Processing type", journal.processingType],
    ["Tool", disclosureText(journal.tool.name)], ["Tool version", disclosureText(journal.tool.version)],
    ["Model", disclosureText(journal.tool.model)], ["Instruction / method", disclosureText(journal.instruction)],
    ["Settings", disclosureText(journal.settings)], ["Declared authority basis", journal.authority.basis],
    ["Permission scope", journal.authority.scope], ["Permission evidence / reference", journal.authority.evidence || "Not recorded"],
    ["Changes", journal.changes], ["Preserved features", journal.preservedFeatures], ["Uncertainty / limitations", journal.uncertainty],
    ["Declared human review status", journal.review.status], ["Reviewer / pseudonym", journal.review.reviewer || "Not recorded"],
    ["Review note", journal.review.note || "Not recorded"], ["Original master preserved", "Confirmed by the declarant; not independently verified"],
  ]
  return `<div class="intervention-receipt"><p class="intervention-notice">This journal records declarations, not an authenticity certificate or a permission grant. A review is not automatically an approval.</p><dl>${rows.map(([label, value]) => receiptRow(label, value)).join("")}</dl></div>`
}

/** Read a synchronous form snapshot; hidden text is stripped by journalFromFields. */
export const readInterventionFields = (form: HTMLFormElement): InterventionFormFields => {
  const value = (id: string): string => form.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`#${id}`)!.value
  const fields = (id: string, statusId = `${id}-status`): DisclosureFields => ({ status: value(statusId), value: value(id) })
  return {
    label: value("derivative-label"), purpose: value("derivative-purpose"), processingType: value("intervention-processing"),
    toolName: fields("intervention-tool"), toolVersion: fields("intervention-version"), model: fields("intervention-model"),
    instruction: fields("derivative-method", "intervention-instruction-status"), settings: fields("intervention-settings"),
    authorityBasis: value("intervention-authority"), authorityScope: value("intervention-scope"), authorityEvidence: value("intervention-evidence"),
    changes: value("derivative-changes"), preservedFeatures: value("intervention-preserved"), uncertainty: value("intervention-uncertainty"),
    reviewStatus: value("intervention-review-status"), reviewer: value("intervention-reviewer"), reviewNote: value("derivative-review"),
    originalUnchanged: form.querySelector<HTMLInputElement>("#derivative-master-check")!.checked,
  }
}

/** Hidden inputs never block validity; changing AI type cannot leave an invalid N/A claim. */
export const syncInterventionForm = (form: HTMLFormElement): void => {
  const processing = form.querySelector<HTMLSelectElement>("#intervention-processing")!.value
  for (const id of ["intervention-tool", "intervention-version", "intervention-model", "derivative-method", "intervention-settings"]) {
    const statusId = id === "derivative-method" ? "intervention-instruction-status" : `${id}-status`
    const select = form.querySelector<HTMLSelectElement>(`#${statusId}`)!
    const text = form.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${id}`)!
    const notApplicable = select.querySelector<HTMLOptionElement>('option[value="not-applicable"]')
    const unavailable = (id === "intervention-model" && processing !== "non-ai") || (id === "intervention-tool" && processing === "ai")
    if (notApplicable) notApplicable.disabled = unavailable
    if (unavailable && select.value === "not-applicable") select.value = "unknown"
    text.hidden = select.value !== "provided"
    text.disabled = text.hidden
    text.required = !text.hidden
  }
  const completedReview = form.querySelector<HTMLSelectElement>("#intervention-review-status")!.value !== "pending"
  form.querySelector<HTMLInputElement>("#intervention-reviewer")!.required = completedReview
  form.querySelector<HTMLTextAreaElement>("#derivative-review")!.required = completedReview
  const notice = form.querySelector<HTMLElement>("#intervention-review-help")
  if (notice) notice.textContent = completedReview ? "Enter the reviewer (a pseudonym is fine) and a substantive note. Reviewed does not mean approved or rights-cleared." : "Pending is the default. A name or note alone does not mark review complete."
}
