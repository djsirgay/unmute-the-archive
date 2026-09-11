/** Explicit disclosure prevents missing information from becoming invented evidence. */
export type Disclosure =
  | { status: "provided"; value: string }
  | { status: "unknown" | "not-disclosed" | "not-applicable" }

/**
 * A declarative intervention record, not a rights grant or a forensic certificate.
 * Binding to an exact source hash identifies the declared parent file; it does not
 * prove that an external tool processed that file or that the outcome is authentic.
 */
export type InterventionJournal = {
  schema: "unmute-intervention/1.0"
  sourceMasterSha256: string
  processingType: "ai" | "non-ai" | "unknown"
  tool: { name: Disclosure; version: Disclosure; model: Disclosure }
  instruction: Disclosure
  settings: Disclosure
  authority: {
    basis: "creator-owned" | "permission" | "public-domain" | "unknown" | "no-permission"
    scope: string
    /** Optional textual reference, not necessarily a public link or permission document. */
    evidence?: string
  }
  changes: string
  preservedFeatures: string
  /** Qualitative limitations, including an explicit "not assessed" when appropriate. */
  uncertainty: string
  review: {
    /** Reviewed means a review was declared, not approved, authentic, or rights-cleared. */
    status: "pending" | "reviewed" | "rejected"
    reviewer?: string
    note?: string
  }
  /** An explicit declarant attestation, never inferred from a hash or processing method. */
  originalUnchanged: true
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const nonempty = (value: unknown): value is string =>
  typeof value === "string" && Boolean(value.trim())

const optionalText = (value: unknown): boolean => value === undefined || nonempty(value)

const oneOf = (value: unknown, choices: string[]): boolean =>
  typeof value === "string" && choices.includes(value)

export const isSha256 = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{64}$/i.test(value)

/** Case is presentation only; both inputs must still be valid SHA-256 digests. */
export const sameSha256 = (first: unknown, second: unknown): boolean =>
  isSha256(first) && isSha256(second) && first.toLowerCase() === second.toLowerCase()

export const isDisclosure = (value: unknown): value is Disclosure => {
  if (!isRecord(value)) return false
  if (value.status === "provided") return nonempty(value.value)
  return oneOf(value.status, ["unknown", "not-disclosed", "not-applicable"]) && value.value === undefined
}

export const isInterventionJournal = (value: unknown): value is InterventionJournal => {
  if (!isRecord(value) || value.schema !== "unmute-intervention/1.0") return false
  if (!isSha256(value.sourceMasterSha256) || value.originalUnchanged !== true) return false
  if (!oneOf(value.processingType, ["ai", "non-ai", "unknown"])) return false
  if (!isRecord(value.tool) || !isDisclosure(value.tool.name) || !isDisclosure(value.tool.version) || !isDisclosure(value.tool.model)) return false
  // Unknown processing is not evidence that no AI model was involved.
  if (value.tool.model.status === "not-applicable" && value.processingType !== "non-ai") return false
  if (value.processingType === "ai" && value.tool.name.status === "not-applicable") return false
  if (!isDisclosure(value.instruction) || !isDisclosure(value.settings)) return false
  if (!isRecord(value.authority) || !oneOf(value.authority.basis, ["creator-owned", "permission", "public-domain", "unknown", "no-permission"])) return false
  if (!nonempty(value.authority.scope) || !optionalText(value.authority.evidence)) return false
  if (!nonempty(value.changes) || !nonempty(value.preservedFeatures) || !nonempty(value.uncertainty)) return false
  if (!isRecord(value.review) || !oneOf(value.review.status, ["pending", "reviewed", "rejected"])) return false
  if (!optionalText(value.review.reviewer) || !optionalText(value.review.note)) return false
  if (value.review.status !== "pending" && (!nonempty(value.review.reviewer) || !nonempty(value.review.note))) return false
  return true
}
