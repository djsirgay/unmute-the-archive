export type ArchiveManifest = {
  schema: "unmute-archive/1.0"
  archiveId: string
  createdAt: string
  title: string
  contributor: string
  language: string
  place: string
  context: string
  consentBasis: string
  source: {
    filename: string
    mediaType: string
    bytes: number
    sha256: string
  }
  audiotool?: {
    projectName: string
    sampleName: string
    insertedAt: string
  }
}

export const buildManifest = (
  values: Omit<ArchiveManifest, "schema" | "archiveId" | "createdAt">,
): ArchiveManifest => ({
  schema: "unmute-archive/1.0",
  archiveId: crypto.randomUUID(),
  createdAt: new Date().toISOString(),
  ...values,
})

export const sha256 = async (file: Blob): Promise<string> => {
  const bytes = await file.arrayBuffer()
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")
}

export const downloadManifest = (manifest: ArchiveManifest): void => {
  const blob = new Blob([JSON.stringify(manifest, null, 2)], {
    type: "application/json",
  })
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = `${manifest.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "archive-item"}.json`
  link.click()
  URL.revokeObjectURL(link.href)
}
