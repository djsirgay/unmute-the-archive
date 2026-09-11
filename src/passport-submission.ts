import { buildManifest, isArchiveManifest, MAX_BROWSER_AUDIO_BYTES, type ArchiveManifest } from "./manifest"
import { isSha256 } from "./intervention"

type PassportFields = Pick<ArchiveManifest, "collection" | "title" | "creator" | "language" | "place" | "recordedOn" | "context" | "rightsBasis" | "evidenceUrl">

export type PassportSubmission = {
  mode: "present" | "missing"
  file: File | null
  preservationConsent: boolean
  values: PassportFields
}

/** Capture the exact file, declarations, and consent before asynchronous hashing. */
export const capturePassportSubmission = (mode: "present" | "missing", file: File | null, preservationConsent: boolean, values: PassportFields): PassportSubmission => {
  if (mode === "present") {
    if (!file || !file.size || file.size > MAX_BROWSER_AUDIO_BYTES) throw new Error("Choose a nonempty source file within the browser size limit.")
    if (preservationConsent !== true) throw new Error("Confirm that you control the file or have permission to preserve it.")
  }
  return { mode, file: mode === "present" ? file : null, preservationConsent: mode === "present" && preservationConsent, values: structuredClone(values) }
}

export const completePassportSubmission = (snapshot: PassportSubmission, digest?: string): ArchiveManifest => {
  if (snapshot.mode === "present" && (!snapshot.file || snapshot.preservationConsent !== true || !isSha256(digest))) throw new Error("The captured source, preservation consent, and SHA-256 digest are required.")
  const source = snapshot.mode === "present" && snapshot.file ? {
    filename: snapshot.file.name, mediaType: snapshot.file.type || "application/octet-stream", bytes: snapshot.file.size, sha256: digest!,
  } : undefined
  const manifest = buildManifest({ ...snapshot.values, status: source ? "fingerprinted" : "source-missing", source })
  if (!isArchiveManifest(manifest)) throw new Error("The captured passport details are incomplete. Review the form and create the passport again.")
  return manifest
}
