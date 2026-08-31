import { readCorpus, saveToCorpus } from "./corpus"
import type { ArchiveManifest } from "./manifest"

export type Confidence = "high" | "medium" | "recovery"
export type RecordKind = "song" | "album" | "dj-set" | "mix" | "recording" | "derivative"

export type AtlasRecord = {
  id: string
  archiveId?: string
  title: string
  creator: string
  year?: number
  language: string
  place: string
  kind: RecordKind
  format: string
  relationship: string
  genres: string[]
  themes: string[]
  bpm?: number
  dance: boolean
  confidence: Confidence
  sourceStatus: "fingerprinted" | "recovery-lead" | "public-evidence"
  rightsStatus: string
  collection: string
  summary: string
  evidenceUrl?: string
  evidenceLabel?: string
  isDemo: boolean
}

export type AtlasAnnotation = {
  kind?: RecordKind
  genres?: string[]
  themes?: string[]
  bpm?: number
  dance?: boolean
  relationship?: string
  confidence?: Confidence
}

const ANNOTATION_KEY = "unmute-belarus/atlas-annotations/v1"

export const reviewerRecords: AtlasRecord[] = [
  {
    id: "review-2016-single",
    title: "Belarusian-language single and music video",
    creator: "Sergéy Ulyanov",
    year: 2016,
    language: "Belarusian",
    place: "Minsk, Belarus",
    kind: "song",
    format: "Music video / digital single",
    relationship: "original work",
    genres: ["pop", "electronic"],
    themes: ["Belarusian language", "cross-border circulation"],
    bpm: 118,
    dance: true,
    confidence: "high",
    sourceStatus: "public-evidence",
    rightsStatus: "Creator-provided record; source master recovery pending",
    collection: "Belarusian Music in Exile — Pilot Corpus",
    summary: "A creator-owned Belarusian-language work that received documented Russian television exposure in 2016. The public video and press record are available; the original master remains a recovery target.",
    evidenceUrl: "https://youtu.be/6jQ43vYcTwE",
    evidenceLabel: "Public video evidence",
    isDemo: true,
  },
  {
    id: "review-2020-protest",
    title: "Track connected to Belarus’s 2020 democratic protest movement",
    creator: "Sergéy Ulyanov and collaborator",
    year: 2020,
    language: "Belarusian",
    place: "Belarus / diaspora circulation",
    kind: "song",
    format: "Digital track / music video",
    relationship: "co-authored original work",
    genres: ["electronic", "protest music"],
    themes: ["democratic movement", "freedom of expression", "diaspora memory"],
    bpm: 124,
    dance: true,
    confidence: "high",
    sourceStatus: "public-evidence",
    rightsStatus: "Co-authored work; public evidence recorded",
    collection: "Belarusian Music in Exile — Pilot Corpus",
    summary: "A co-authored track circulated as part of the cultural soundtrack surrounding Belarus’s peaceful democratic protests. This record separates the public evidence from any still-unrecovered production master.",
    evidenceUrl: "https://youtu.be/g9d6szYbquo",
    evidenceLabel: "Public music-video evidence",
    isDemo: true,
  },
  {
    id: "review-belarus-in-exile-set",
    title: "Belarus in Exile — research DJ set",
    creator: "Sergéy Ulyanov",
    year: 2026,
    language: "Belarusian / multilingual context",
    place: "Black Rock City, United States",
    kind: "dj-set",
    format: "Live research mix",
    relationship: "curated mix of related works",
    genres: ["dance", "electronic", "DJ mix"],
    themes: ["exile", "cultural continuity", "contextual listening"],
    bpm: 126,
    dance: true,
    confidence: "medium",
    sourceStatus: "public-evidence",
    rightsStatus: "Research description; component-track rights remain item-specific",
    collection: "Belarusian Music in Exile — Pilot Corpus",
    summary: "A practice-led DJ-set format that treats sequencing, spoken excerpts, and contextual framing as research material. Component recordings must remain separately identified rather than being collapsed into one rights claim.",
    evidenceUrl: "https://sergey-ulyanov.pro/research/",
    evidenceLabel: "Research context",
    isDemo: true,
  },
  {
    id: "review-archive-mix",
    title: "Belarusian-language archival broadcast mix",
    creator: "Sergéy Ulyanov",
    language: "Belarusian",
    place: "Belarus / United States",
    kind: "mix",
    format: "DJ mix with archival excerpts",
    relationship: "mix / contextual compilation",
    genres: ["dance", "electronic", "archive mix"],
    themes: ["broadcast history", "Belarusian language", "media memory"],
    bpm: 125,
    dance: true,
    confidence: "medium",
    sourceStatus: "recovery-lead",
    rightsStatus: "Mixed-source research lead; each excerpt requires source review",
    collection: "Belarusian Music in Exile — Pilot Corpus",
    summary: "A Belarusian-language mix assembled through extensive research into broadcast and program excerpts spanning roughly three decades. The present entry is a recovery and cataloging lead, not a blanket rights assertion.",
    evidenceUrl: "https://sergey-ulyanov.pro/research/system/",
    evidenceLabel: "System methodology",
    isDemo: true,
  },
  {
    id: "review-vinyl-reissue",
    title: "Tenth-anniversary Belarusian-language vinyl reissue",
    creator: "Sergéy Ulyanov / Nostalgai Recordz",
    year: 2026,
    language: "Belarusian",
    place: "United States / United Kingdom",
    kind: "album",
    format: "Vinyl reissue",
    relationship: "reissue / new performances of earlier works",
    genres: ["electronic", "pop"],
    themes: ["recirculation", "music in exile", "physical preservation"],
    dance: true,
    confidence: "medium",
    sourceStatus: "public-evidence",
    rightsStatus: "Label and creator context recorded; final edition evidence pending",
    collection: "Nostalgai Recordz — Belarusian Music in Exile Pilot",
    summary: "Earlier Belarusian-language works re-enter circulation through a U.S.-based label and U.K. manufacturing workflow. The record distinguishes the underlying works, new performances, and physical release edition.",
    evidenceUrl: "https://sergey-ulyanov.pro/research/",
    evidenceLabel: "Research context",
    isDemo: true,
  },
]

const readAnnotations = (): Record<string, AtlasAnnotation> => {
  try {
    return JSON.parse(localStorage.getItem(ANNOTATION_KEY) ?? "{}") as Record<string, AtlasAnnotation>
  } catch {
    return {}
  }
}

export const saveAnnotation = (id: string, annotation: AtlasAnnotation): void => {
  const annotations = readAnnotations()
  annotations[id] = { ...annotations[id], ...annotation }
  localStorage.setItem(ANNOTATION_KEY, JSON.stringify(annotations))
}

const recordFromManifest = (manifest: ArchiveManifest): AtlasRecord => ({
  id: manifest.archiveId,
  archiveId: manifest.archiveId,
  title: manifest.title,
  creator: manifest.creator,
  year: manifest.recordedOn ? Number(manifest.recordedOn.slice(0, 4)) : undefined,
  language: manifest.language,
  place: manifest.place,
  kind: "recording",
  format: manifest.source?.mediaType || "Metadata-only record",
  relationship: manifest.derivatives?.length ? "source master with documented derivatives" : "source recording",
  genres: [],
  themes: ["archival record"],
  dance: false,
  confidence: manifest.status === "fingerprinted" ? "high" : "recovery",
  sourceStatus: manifest.status === "fingerprinted" ? "fingerprinted" : "recovery-lead",
  rightsStatus: manifest.rightsBasis,
  collection: manifest.collection,
  summary: manifest.context,
  evidenceUrl: manifest.evidenceUrl,
  evidenceLabel: manifest.evidenceUrl ? "Recorded evidence or recovery lead" : undefined,
  isDemo: false,
})

const derivativeRecords = (manifest: ArchiveManifest): AtlasRecord[] => (manifest.derivatives ?? []).map((derivative) => ({
  id: derivative.derivativeId,
  archiveId: manifest.archiveId,
  title: `${manifest.title} — ${derivative.label}`,
  creator: manifest.creator,
  year: Number(derivative.createdAt.slice(0, 4)),
  language: manifest.language,
  place: manifest.place,
  kind: "derivative",
  format: derivative.source.mediaType,
  relationship: `documented derivative of ${manifest.archiveId}`,
  genres: [],
  themes: ["restoration", derivative.purpose],
  dance: false,
  confidence: "high",
  sourceStatus: "fingerprinted",
  rightsStatus: manifest.rightsBasis,
  collection: manifest.collection,
  summary: `${derivative.method} ${derivative.changeLog}`.trim(),
  evidenceUrl: manifest.evidenceUrl,
  evidenceLabel: "Parent-passport evidence",
  isDemo: false,
}))

export const atlasRecords = (includeReviewer = true): AtlasRecord[] => {
  const annotations = readAnnotations()
  const local = readCorpus().flatMap((manifest) => [recordFromManifest(manifest), ...derivativeRecords(manifest)])
  const records = includeReviewer ? [...local, ...reviewerRecords] : local
  return records.map((record) => ({ ...record, ...(annotations[record.id] ?? {}) }))
}

export const importPassportJson = (raw: string): number => {
  const parsed = JSON.parse(raw) as unknown
  const values = Array.isArray(parsed) ? parsed : [parsed]
  let imported = 0
  for (const value of values) {
    if (!value || typeof value !== "object") continue
    if (!("archiveId" in value) || !("schema" in value) || !("title" in value)) continue
    saveToCorpus(value as ArchiveManifest)
    imported += 1
  }
  return imported
}

export const downloadText = (content: string, type: string, filename: string): void => {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export const recordSearchText = (record: AtlasRecord): string => [
  record.title, record.creator, record.year, record.language, record.place, record.kind,
  record.format, record.relationship, ...record.genres, ...record.themes, record.summary,
  record.collection, record.rightsStatus, record.dance ? "dance dancing club" : "",
].join(" ").toLowerCase()

const queryTokens = (value: string): string[] => value.toLowerCase().split(/[^\p{L}\p{N}]+/u)
  .filter((token) => token.length > 1 && !["the", "and", "all", "find", "of", "in", "на", "и"].includes(token))
  .map((token) => ({ belarusian: "belarusian", беларус: "belarus", remix: "mix", remixes: "mix", танцев: "dance" }[token] ?? token))

export const matchesResearchQuery = (record: AtlasRecord, query: string): boolean => {
  const haystack = recordSearchText(record)
  const tokens = queryTokens(query)
  const asksDanceOrRemix = tokens.includes("dance") && tokens.includes("mix")
  const required = asksDanceOrRemix ? tokens.filter((token) => token !== "dance" && token !== "mix") : tokens
  const categoryMatch = !asksDanceOrRemix || record.dance || ["mix", "dj-set", "derivative"].includes(record.kind) || record.relationship.includes("remix")
  return categoryMatch && required.every((token) => haystack.includes(token) || (token === "mix" && ["mix", "dj-set", "derivative"].includes(record.kind)))
}
