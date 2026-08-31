import { citationFor, type ArchiveManifest } from "./manifest"

const STORAGE_KEY = "unmute-the-archive/corpus/v2"

export const readCorpus = (): ArchiveManifest[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is ArchiveManifest =>
      typeof item === "object" && item !== null && "archiveId" in item && "schema" in item,
    )
  } catch {
    return []
  }
}

export const saveToCorpus = (manifest: ArchiveManifest): ArchiveManifest[] => {
  const corpus = readCorpus()
  const next = [manifest, ...corpus.filter((item) => item.archiveId !== manifest.archiveId)]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}

export const updateInCorpus = (manifest: ArchiveManifest): ArchiveManifest[] => {
  manifest.updatedAt = new Date().toISOString()
  return saveToCorpus(manifest)
}

export const removeFromCorpus = (archiveId: string): ArchiveManifest[] => {
  const next = readCorpus().filter((item) => item.archiveId !== archiveId)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
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

const csvCell = (value: string | number): string => `"${String(value).replaceAll('"', '""')}"`

export const corpusAsCsv = (corpus: ArchiveManifest[]): string => {
  const header = [
    "archive_id", "title", "creator", "language", "place", "recorded_on",
    "status", "collection", "context", "rights_basis", "source_filename", "sha256",
    "evidence_url", "derivative_count", "citation",
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
