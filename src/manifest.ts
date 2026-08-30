export type ArchiveEvent = {
  type: "documented" | "fingerprinted" | "verified" | "transferred"
  at: string
  note: string
}

export type ArchiveManifest = {
  schema: "unmute-archive/2.0"
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
    schema: "unmute-archive/2.0",
    archiveId: crypto.randomUUID(),
    createdAt: timestamp,
    updatedAt: timestamp,
    events,
    ...values,
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
    : "Fingerprint-verified local source"

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
