import { citationFor, isArchiveManifest, type ArchiveManifest } from "./manifest"

const STORAGE_KEY = "unmute-the-archive/corpus/v2"

export type CorpusStorageIssue = { kind: "unavailable" | "damaged"; message: string; raw?: string }

export const corpusStorageIssue = (): CorpusStorageIssue | undefined => {
  let raw: string | null
  try { raw = localStorage.getItem(STORAGE_KEY) } catch {
    return { kind: "unavailable", message: "Browser storage is unavailable. Your saved library cannot be read or updated here. Allow site storage or return to the browser where you created it; do not clear site data." }
  }
  if (raw === null) return undefined
  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.every(isArchiveManifest)) return undefined
  } catch { /* Keep the original bytes available for recovery. */ }
  return { kind: "damaged", raw, message: "Your saved library needs recovery. Some stored data could not be read, so an empty list below does not mean your records are gone. Download the original data before troubleshooting. Nothing has been deleted or replaced." }
}

const storedCorpus = (): ArchiveManifest[] => {
  const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")
  if (!Array.isArray(parsed) || !parsed.every(isArchiveManifest)) {
    throw new Error("The saved corpus needs recovery. Export the existing browser data before replacing it.")
  }
  return parsed
}

export const writeCorpus = (corpus: ArchiveManifest[]): ArchiveManifest[] => {
  // Do not silently replace an unreadable collection with a new, smaller one.
  storedCorpus()
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(corpus)) } catch {
    throw new Error("This browser could not save the records. Check storage availability and keep your original JSON backup.")
  }
  return corpus
}

export const readCorpus = (): ArchiveManifest[] => {
  try {
    return storedCorpus()
  } catch {
    return []
  }
}

export const saveToCorpus = (manifest: ArchiveManifest): ArchiveManifest[] => {
  if (!isArchiveManifest(manifest)) throw new Error("This passport is incomplete and was not saved.")
  const corpus = storedCorpus()
  const next = [manifest, ...corpus.filter((item) => item.archiveId !== manifest.archiveId)]
  return writeCorpus(next)
}

export const updateInCorpus = (manifest: ArchiveManifest): ArchiveManifest[] => {
  manifest.updatedAt = new Date().toISOString()
  return saveToCorpus(manifest)
}

export const removeFromCorpus = (archiveId: string): ArchiveManifest[] => {
  const next = storedCorpus().filter((item) => item.archiveId !== archiveId)
  return writeCorpus(next)
}

export const corpusStats = (corpus: ArchiveManifest[]) => {
  const languages = new Set(corpus.map((item) => item.language.trim()).filter(Boolean))
  const years = corpus
    .map((item) => Number(item.recordedOn?.slice(0, 4)))
    .filter((year) => Number.isFinite(year) && year > 0)
  const totalBytes = corpus.reduce((total, item) => total + (item.source?.bytes ?? 0), 0)

  return {
    recordings: corpus.length,
    languages: languages.size,
    dateSpan: years.length ? `${Math.min(...years)}–${Math.max(...years)}` : "—",
    totalBytes,
    fingerprinted: corpus.filter((item) => item.status === "fingerprinted").length,
    recoveryLeads: corpus.filter((item) => item.status === "source-missing").length,
  }
}

export const csvCell = (value: unknown): string => {
  const text = String(value ?? "")
  return `"${(/^[=+@\-\t\r]/.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`
}

export const corpusAsCsv = (corpus: ArchiveManifest[]): string => {
  const header = [
    "archive_id", "title", "creator", "language", "place", "recorded_on",
    "status", "collection", "context", "rights_basis", "source_filename", "sha256",
    "evidence_url", "derivative_count", "citation", "intervention_journal_count",
    "derivatives_json", "events_json",
  ]
  const rows = corpus.map((item) => [
    item.archiveId,
    item.title,
    item.creator,
    item.language,
    item.place,
    item.recordedOn ?? "",
    item.status,
    item.collection,
    item.context,
    item.rightsBasis,
    item.source?.filename ?? "",
    item.source?.sha256 ?? "",
    item.evidenceUrl ?? "",
    item.derivatives?.length ?? 0,
    citationFor(item),
    item.derivatives?.filter((derivative) => derivative.intervention !== undefined).length ?? 0,
    JSON.stringify(item.derivatives ?? []),
    JSON.stringify(item.events),
  ])
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n")
}

const download = (content: string, type: string, filename: string): void => {
  const link = document.createElement("a")
  link.href = URL.createObjectURL(new Blob([content], { type }))
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

export const exportCorpusJson = (corpus: ArchiveManifest[]): void => {
  download(JSON.stringify(corpus, null, 2), "application/json", "unmute-the-archive-corpus.json")
}

export const exportCorpusCsv = (corpus: ArchiveManifest[]): void => {
  download(corpusAsCsv(corpus), "text/csv;charset=utf-8", "unmute-the-archive-corpus.csv")
}
