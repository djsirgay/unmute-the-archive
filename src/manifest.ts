import { isInterventionJournal, isSha256, sameSha256, type InterventionJournal } from "./intervention"

export type ArchiveEvent = {
  type: "documented" | "fingerprinted" | "verified" | "transferred" | "derived"
  at: string
  note: string
}

export type ArchiveDerivative = {
  derivativeId: string
  createdAt: string
  label: string
  purpose: string
  method: string
  changeLog: string
  reviewerNote?: string
  /** Absent for legacy records: no structured AI, rights, or review claim is inferred. */
  intervention?: InterventionJournal
  source: {
    filename: string
    mediaType: string
    bytes: number
    sha256: string
  }
}

export type ArchiveManifest = {
  schema: "unmute-archive/2.0" | "unmute-archive/2.1" | "unmute-archive/2.2"
  archiveId: string
  createdAt: string
  updatedAt: string
  status: "fingerprinted" | "source-missing"
  collection: string
  title: string
  creator: string
  language: string
  place: string
  recordedOn?: string
  context: string
  rightsBasis: string
  evidenceUrl?: string
  derivatives?: ArchiveDerivative[]
  source?: {
    filename: string
    mediaType: string
    bytes: number
    sha256: string
  }
  events: ArchiveEvent[]
  audiotool?: {
    projectName: string
    sampleName: string
    insertedAt: string
  }
}

export const MAX_BROWSER_AUDIO_BYTES = 200 * 1_024 * 1_024

export const isPublicEvidenceUrl = (value: string): boolean => {
  try { return ["https:", "http:"].includes(new URL(value).protocol) } catch { return false }
}

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const hasString = (value: Record<string, unknown>, key: string): boolean =>
  typeof value[key] === "string" && Boolean(String(value[key]).trim())

const isArchiveSource = (value: unknown): value is NonNullable<ArchiveManifest["source"]> => {
  if (!isPlainRecord(value)) return false
  return hasString(value, "filename") && hasString(value, "mediaType") &&
    typeof value.bytes === "number" && Number.isSafeInteger(value.bytes) && value.bytes > 0 &&
    isSha256(value.sha256)
}

const isArchiveEvent = (value: unknown): value is ArchiveEvent => {
  if (!isPlainRecord(value)) return false
  return typeof value.type === "string" && ["documented", "fingerprinted", "verified", "transferred", "derived"].includes(value.type) &&
    hasString(value, "at") && hasString(value, "note")
}

const isArchiveDerivative = (value: unknown): value is ArchiveDerivative => {
  if (!isPlainRecord(value)) return false
  return hasString(value, "derivativeId") && hasString(value, "createdAt") &&
    hasString(value, "label") && hasString(value, "purpose") && hasString(value, "method") &&
    hasString(value, "changeLog") && isArchiveSource(value.source) &&
    (value.reviewerNote === undefined || typeof value.reviewerNote === "string") &&
    (value.intervention === undefined || isInterventionJournal(value.intervention))
}

/**
 * Runtime validation for portable JSON and localStorage. TypeScript types disappear
 * in the browser, so imported records must be checked before UI code trusts them.
 */
export const isArchiveManifest = (value: unknown): value is ArchiveManifest => {
  if (!isPlainRecord(value)) return false
  if (typeof value.schema !== "string" || !["unmute-archive/2.0", "unmute-archive/2.1", "unmute-archive/2.2"].includes(value.schema)) return false
  if (typeof value.status !== "string" || !["fingerprinted", "source-missing"].includes(value.status)) return false
  const required = ["archiveId", "createdAt", "updatedAt", "collection", "title", "creator", "language", "place", "context", "rightsBasis"]
  if (!required.every((key) => hasString(value, key))) return false
  if (value.recordedOn !== undefined && typeof value.recordedOn !== "string") return false
  if (value.evidenceUrl !== undefined && (typeof value.evidenceUrl !== "string" || !isPublicEvidenceUrl(value.evidenceUrl))) return false
  if (!Array.isArray(value.events) || !value.events.every(isArchiveEvent)) return false
  if (value.derivatives !== undefined && (!Array.isArray(value.derivatives) || !value.derivatives.every(isArchiveDerivative))) return false
  const derivatives = value.derivatives as ArchiveDerivative[] | undefined
  if (value.status === "source-missing") return value.source === undefined && !derivatives?.length
  if (!isArchiveSource(value.source)) return false
  const masterHash = value.source.sha256
  const ids = new Set<string>()
  const hashes = new Set<string>()
  for (const derivative of derivatives ?? []) {
    const hash = derivative.source.sha256.toLowerCase()
    if (sameSha256(masterHash, hash) || ids.has(derivative.derivativeId) || hashes.has(hash)) return false
    ids.add(derivative.derivativeId)
    hashes.add(hash)
    if (derivative.intervention && (value.schema !== "unmute-archive/2.2" || !sameSha256(derivative.intervention.sourceMasterSha256, masterHash))) return false
  }
  return true
}

type ManifestValues = Omit<
  ArchiveManifest,
  "schema" | "archiveId" | "createdAt" | "updatedAt" | "events"
>

export const buildManifest = (values: ManifestValues): ArchiveManifest => {
  const timestamp = new Date().toISOString()
  const events: ArchiveEvent[] = [
    {
      type: "documented",
      at: timestamp,
      note: values.status === "source-missing"
        ? "Metadata and a recovery lead were documented; no source file was available to fingerprint."
        : "Provenance metadata was documented in a local archival passport.",
    },
  ]

  if (values.source) {
    events.push({
      type: "fingerprinted",
      at: timestamp,
      note: `SHA-256 ${values.source.sha256}`,
    })
  }

  return {
    schema: values.derivatives?.some((item) => item.intervention) ? "unmute-archive/2.2" : "unmute-archive/2.1",
    archiveId: crypto.randomUUID(),
    createdAt: timestamp,
    updatedAt: timestamp,
    events,
    ...values,
  }
}

export const addDerivative = (
  manifest: ArchiveManifest,
  values: Omit<ArchiveDerivative, "derivativeId" | "createdAt">,
): ArchiveManifest => {
  if (!manifest.source) throw new Error("A derivative must be linked to a fingerprinted source master.")
  if (!isArchiveManifest(manifest)) throw new Error("The source passport is incomplete or internally inconsistent.")
  if (!isArchiveSource(values.source)) throw new Error("The derivative needs valid file metadata and a SHA-256 digest.")
  if (sameSha256(values.source.sha256, manifest.source.sha256)) {
    throw new Error("This file is byte-for-byte identical to the master. Verify it instead of registering a derivative.")
  }
  if (manifest.derivatives?.some((item) => sameSha256(item.source.sha256, values.source.sha256))) {
    throw new Error("This exact derivative is already registered in the passport.")
  }
  if (values.intervention && !isInterventionJournal(values.intervention)) {
    throw new Error("The intervention journal is incomplete or internally inconsistent.")
  }
  if (values.intervention && !sameSha256(values.intervention.sourceMasterSha256, manifest.source.sha256)) {
    throw new Error("The intervention journal names a different source master.")
  }
  const timestamp = new Date().toISOString()
  const derivative: ArchiveDerivative = {
    derivativeId: crypto.randomUUID(),
    createdAt: timestamp,
    ...structuredClone(values),
  }
  if (!isArchiveDerivative(derivative)) throw new Error("The derivative needs a label, purpose, method, and change log.")

  return {
    ...manifest,
    schema: derivative.intervention ? "unmute-archive/2.2" : manifest.schema,
    updatedAt: timestamp,
    derivatives: [...(manifest.derivatives ?? []), derivative],
    events: [
      ...manifest.events,
      {
        type: "derived",
        at: timestamp,
        note: `Registered derivative ${derivative.label}; SHA-256 ${derivative.source.sha256}`,
      },
    ],
  }
}

export const sha256 = async (file: Blob): Promise<string> => {
  const bytes = await file.arrayBuffer()
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")
}

export const citationFor = (manifest: ArchiveManifest): string => {
  const year = manifest.recordedOn?.slice(0, 4) || "n.d."
  const sourceNote = manifest.status === "source-missing"
    ? "Metadata-only recovery record"
    : "Source fingerprint recorded"

  return `${manifest.creator}. (${year}). ${manifest.title} [${manifest.language} audio]. ${manifest.place}: ${manifest.collection}. ${sourceNote}. Archival Passport ${manifest.archiveId}.`
}

export const shortFingerprint = (manifest: ArchiveManifest): string => {
  const digest = manifest.source?.sha256
  return digest ? `${digest.slice(0, 12)}…${digest.slice(-12)}` : "No source file fingerprint"
}

const safeFilename = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "archive-item"

const downloadBlob = (blob: Blob, filename: string): void => {
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

export const downloadManifest = (manifest: ArchiveManifest): void => {
  downloadBlob(
    new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" }),
    `${safeFilename(manifest.title)}-archival-passport.json`,
  )
}

export const formatBytes = (bytes: number): string => {
  if (bytes < 1_024) return `${bytes} B`
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`
  return `${(bytes / 1_048_576).toFixed(2)} MB`
}
