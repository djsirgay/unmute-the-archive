import { readCorpus, saveToCorpus } from "./corpus"
import { isArchiveManifest, type ArchiveManifest } from "./manifest"

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

const creatorRecords: AtlasRecord[] = [
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
    dance: false,
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
    dance: false,
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
    dance: false,
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

export const publicSourceRecords: AtlasRecord[] = [
  {
    id: "public-shuma-nick-cherny-vutka",
    title: "Na mory vutka kupałasia — Nick Cherny remix",
    creator: "Šuma / Nick Cherny",
    year: 2013,
    language: "Belarusian / traditional song",
    place: "Belarus",
    kind: "derivative",
    format: "Digital remix",
    relationship: "remix from Šuma’s zolak remix EP",
    genres: ["ethno-electronic", "remix"],
    themes: ["traditional song", "Belarusian language", "club circulation"],
    dance: false,
    confidence: "high",
    sourceStatus: "public-evidence",
    rightsStatus: "Public source documents the release; this corpus does not assert recording rights.",
    collection: "Public-source Belarusian Remix Index — pilot",
    summary: "One of four electronic reinterpretations documented on Šuma’s 2013 remix EP, connecting traditional Belarusian-language material with club-oriented production.",
    evidenceUrl: "https://budzma.org/news/yer-z-remiksami-ad-prayekta-suma.html",
    evidenceLabel: "Budzma release record",
    isDemo: true,
  },
  {
    id: "public-shuma-dee-flack-pcholka",
    title: "Dy huła pčołka — Dee Flack remix",
    creator: "Šuma / Dee Flack",
    year: 2013,
    language: "Belarusian / traditional song",
    place: "Belarus",
    kind: "derivative",
    format: "Digital remix",
    relationship: "remix from Šuma’s zolak remix EP",
    genres: ["ethno-electronic", "remix"],
    themes: ["traditional song", "Belarusian language", "club circulation"],
    dance: false,
    confidence: "high",
    sourceStatus: "public-evidence",
    rightsStatus: "Public source documents the release; this corpus does not assert recording rights.",
    collection: "Public-source Belarusian Remix Index — pilot",
    summary: "A source-documented remix from Šuma’s 2013 EP of electronic reinterpretations of the group’s traditional-language material.",
    evidenceUrl: "https://budzma.org/news/yer-z-remiksami-ad-prayekta-suma.html",
    evidenceLabel: "Budzma release record",
    isDemo: true,
  },
  {
    id: "public-shuma-alex-goof-pierapiolka",
    title: "Pierapiołka — Alex Goof remix",
    creator: "Šuma / Alex Goof",
    year: 2013,
    language: "Belarusian / traditional song",
    place: "Belarus",
    kind: "derivative",
    format: "Digital remix",
    relationship: "remix from Šuma’s zolak remix EP",
    genres: ["ethno-electronic", "remix"],
    themes: ["traditional song", "Belarusian language", "club circulation"],
    dance: false,
    confidence: "high",
    sourceStatus: "public-evidence",
    rightsStatus: "Public source documents the release; this corpus does not assert recording rights.",
    collection: "Public-source Belarusian Remix Index — pilot",
    summary: "A source-documented electronic reinterpretation from Šuma’s 2013 remix EP.",
    evidenceUrl: "https://budzma.org/news/yer-z-remiksami-ad-prayekta-suma.html",
    evidenceLabel: "Budzma release record",
    isDemo: true,
  },
  {
    id: "public-shuma-dnb-oj-jedu",
    title: "Oj jedu ja darohaju — drum-and-bass remix",
    creator: "Šuma / remixer not named in source",
    year: 2013,
    language: "Belarusian / traditional song",
    place: "Belarus",
    kind: "derivative",
    format: "Digital remix",
    relationship: "drum-and-bass remix from Šuma’s zolak remix EP",
    genres: ["drum and bass", "ethno-electronic", "remix", "dance"],
    themes: ["traditional song", "Belarusian language", "club circulation"],
    dance: true,
    confidence: "medium",
    sourceStatus: "public-evidence",
    rightsStatus: "Public source documents the remix but does not name the remixer; this corpus does not assert recording rights.",
    collection: "Public-source Belarusian Remix Index — pilot",
    summary: "A drum-and-bass reinterpretation documented on Šuma’s 2013 remix EP. The source confirms the track but leaves the remixer unnamed, so the attribution remains explicitly incomplete.",
    evidenceUrl: "https://budzma.org/news/yer-z-remiksami-ad-prayekta-suma.html",
    evidenceLabel: "Budzma release record",
    isDemo: true,
  },
  {
    id: "public-akute-kuli-o-remix",
    title: "Kuli — (((O))) remix",
    creator: "Akute / (((O)))",
    year: 2014,
    language: "Belarusian",
    place: "Belarus",
    kind: "derivative",
    format: "Digital remix",
    relationship: "remix of Akute’s song Kuli",
    genres: ["electronic", "remix"],
    themes: ["Belarusian-language rock", "electronic reinterpretation"],
    dance: false,
    confidence: "high",
    sourceStatus: "public-evidence",
    rightsStatus: "Public source documents the release; this corpus does not assert recording rights.",
    collection: "Public-source Belarusian Remix Index — pilot",
    summary: "A publicly documented electronic remix of the Belarusian-language Akute song Kuli by the artist (((O))).",
    evidenceUrl: "https://budzma.org/news/o-zrabiw-remiks-na-pyesnyu-akute-kuli.html",
    evidenceLabel: "Budzma release record",
    isDemo: true,
  },
  {
    id: "public-akute-iholki-deech",
    title: "Iholki — Deech remix",
    creator: "Akute / Deech",
    year: 2014,
    language: "Belarusian",
    place: "Belarus",
    kind: "derivative",
    format: "Digital remix",
    relationship: "remix from Akute’s Iholki EP",
    genres: ["electronic", "remix"],
    themes: ["Belarusian-language rock", "electronic reinterpretation"],
    dance: false,
    confidence: "high",
    sourceStatus: "public-evidence",
    rightsStatus: "Public source documents the release; this corpus does not assert recording rights.",
    collection: "Public-source Belarusian Remix Index — pilot",
    summary: "One of the source-documented remixes issued with Akute’s Iholki EP.",
    evidenceUrl: "https://budzma.org/news/akute-neshta-serca-zakalola-mr3-prem%25e2%2580%2599era.html",
    evidenceLabel: "Budzma EP record",
    isDemo: true,
  },
  {
    id: "public-akute-iholki-pryzma",
    title: "Iholki — Pryzma remix",
    creator: "Akute / Pryzma",
    year: 2014,
    language: "Belarusian",
    place: "Belarus",
    kind: "derivative",
    format: "Digital remix",
    relationship: "remix from Akute’s Iholki EP",
    genres: ["electronic", "remix"],
    themes: ["Belarusian-language rock", "electronic reinterpretation"],
    dance: false,
    confidence: "high",
    sourceStatus: "public-evidence",
    rightsStatus: "Public source documents the release; this corpus does not assert recording rights.",
    collection: "Public-source Belarusian Remix Index — pilot",
    summary: "One of the source-documented remixes issued with Akute’s Iholki EP.",
    evidenceUrl: "https://budzma.org/news/akute-neshta-serca-zakalola-mr3-prem%25e2%2580%2599era.html",
    evidenceLabel: "Budzma EP record",
    isDemo: true,
  },
  {
    id: "public-akute-adzinotstva-dj-boston",
    title: "Adzinotstva — DJ Boston remix",
    creator: "Akute / DJ Boston",
    year: 2014,
    language: "Belarusian",
    place: "Belarus",
    kind: "derivative",
    format: "Digital remix",
    relationship: "electronic remix of Akute’s Adzinotstva",
    genres: ["electronic", "remix", "dance"],
    themes: ["Belarusian-language rock", "club and radio circulation"],
    dance: true,
    confidence: "high",
    sourceStatus: "public-evidence",
    rightsStatus: "Public source documents the release; this corpus does not assert recording rights.",
    collection: "Public-source Belarusian Remix Index — pilot",
    summary: "A source-documented electronic reinterpretation explicitly described as suitable for discos and radio.",
    evidenceUrl: "https://budzma.org/news/akute-neshta-serca-zakalola-mr3-prem%25e2%2580%2599era.html",
    evidenceLabel: "Budzma EP record",
    isDemo: true,
  },
  {
    id: "public-ana-zhdanova-znichka-diamos-roll",
    title: "Znička — Diamos Roll remix",
    creator: "Ana Zhdanova / Diamos Roll",
    year: 2018,
    language: "Belarusian",
    place: "Belarus",
    kind: "derivative",
    format: "Digital remix",
    relationship: "rhythmic remix of Ana Zhdanova’s Belarusian-language single Znička",
    genres: ["electronic", "remix"],
    themes: ["Belarusian language", "contemporary pop", "club circulation"],
    dance: false,
    confidence: "high",
    sourceStatus: "public-evidence",
    rightsStatus: "Public source documents the remix release; this corpus does not assert recording rights.",
    collection: "Public-source Belarusian Remix Index — pilot",
    summary: "One of three rhythmic remix versions released with Ana Zhdanova’s 2018 Belarusian-language single Znička.",
    evidenceUrl: "https://34mag.net/piarshak/post/single-ana-zhdanova-znichka/p/16",
    evidenceLabel: "34mag release record",
    isDemo: true,
  },
  {
    id: "public-ana-zhdanova-znichka-marmi",
    title: "Znička — Marmi remix",
    creator: "Ana Zhdanova / Marmi",
    year: 2018,
    language: "Belarusian",
    place: "Belarus",
    kind: "derivative",
    format: "Digital remix",
    relationship: "rhythmic remix of Ana Zhdanova’s Belarusian-language single Znička",
    genres: ["electronic", "remix"],
    themes: ["Belarusian language", "contemporary pop", "club circulation"],
    dance: false,
    confidence: "high",
    sourceStatus: "public-evidence",
    rightsStatus: "Public source documents the remix release; this corpus does not assert recording rights.",
    collection: "Public-source Belarusian Remix Index — pilot",
    summary: "One of three rhythmic remix versions released with Ana Zhdanova’s 2018 Belarusian-language single Znička.",
    evidenceUrl: "https://34mag.net/piarshak/post/single-ana-zhdanova-znichka/p/16",
    evidenceLabel: "34mag release record",
    isDemo: true,
  },
  {
    id: "public-ana-zhdanova-znichka-kosmonavt",
    title: "Znička — Kosmonavt remix",
    creator: "Ana Zhdanova / Kosmonavt",
    year: 2018,
    language: "Belarusian",
    place: "Belarus",
    kind: "derivative",
    format: "Digital remix",
    relationship: "rhythmic remix of Ana Zhdanova’s Belarusian-language single Znička",
    genres: ["electronic", "remix"],
    themes: ["Belarusian language", "contemporary pop", "club circulation"],
    dance: false,
    confidence: "high",
    sourceStatus: "public-evidence",
    rightsStatus: "Public source documents the remix release; this corpus does not assert recording rights.",
    collection: "Public-source Belarusian Remix Index — pilot",
    summary: "One of three rhythmic remix versions released with Ana Zhdanova’s 2018 Belarusian-language single Znička.",
    evidenceUrl: "https://34mag.net/piarshak/post/single-ana-zhdanova-znichka/p/16",
    evidenceLabel: "34mag release record",
    isDemo: true,
  },
  {
    id: "public-palina-ya-poymu-belyaev",
    title: "Я пойму — Belyaev Remix",
    creator: "Palina / Belyaev",
    year: 2017,
    language: "Belarusian",
    place: "Belarus / worldwide release",
    kind: "derivative",
    format: "Digital single / remix",
    relationship: "official remix of Palina’s Я пойму",
    genres: ["electronic", "remix"],
    themes: ["Belarusian language", "digital circulation"],
    dance: false,
    confidence: "high",
    sourceStatus: "public-evidence",
    rightsStatus: "MusicBrainz documents the official release; this corpus does not assert recording rights.",
    collection: "Public-source Belarusian Remix Index — pilot",
    summary: "An official Belarusian-language remix single documented by MusicBrainz with a worldwide release date of October 9, 2017.",
    evidenceUrl: "https://musicbrainz.org/release/4bd6d2af-fb13-4009-85e1-6ecc2e49a642",
    evidenceLabel: "MusicBrainz release record",
    isDemo: true,
  },
  {
    id: "public-kriwi-hej-loli-schmoltz",
    title: "Hej – Loli — Schmoltz RMX",
    creator: "Kriwi / Schmoltz",
    year: 2023,
    language: "Belarusian",
    place: "Belarusian diaspora / online release",
    kind: "derivative",
    format: "Compilation track / remix",
    relationship: "remix included on the Belarus Outside electronic compilation",
    genres: ["electronic", "remix", "dance"],
    themes: ["Belarusian diaspora", "electronic scene", "club circulation"],
    dance: true,
    confidence: "high",
    sourceStatus: "public-evidence",
    rightsStatus: "Public source documents the compilation and track; this corpus does not assert recording rights.",
    collection: "Public-source Belarusian Remix Index — pilot",
    summary: "A remix of Kriwi included in the 13-track Belarus Outside compilation, which documented Belarusian electronic music across several dance-oriented styles.",
    evidenceUrl: "https://citydog.io/post/belaruski-reiv/",
    evidenceLabel: "CityDog compilation record",
    isDemo: true,
  },
]

export const reviewerRecords: AtlasRecord[] = [...creatorRecords, ...publicSourceRecords]

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
    if (!isArchiveManifest(value)) continue
    saveToCorpus(value)
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

const normalizeBasicToken = (value: string): string => value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "")

const QUERY_STOP_WORDS = new Set([
  "the", "and", "all", "find", "show", "give", "me", "of", "in", "on", "or", "for", "with",
  "найди", "найти", "покажи", "все", "мне", "и", "или", "на", "по", "с", "для",
  "знайдзі", "знайсці", "пакажы", "усе", "ўсе", "мне", "і", "ці", "або", "на", "па", "з", "для",
].map(normalizeBasicToken))

const normalizeQueryToken = (raw: string): string => {
  const token = normalizeBasicToken(raw)
  if (/^(belarus|беларус|белорус)/u.test(token)) return "belarus"
  if (/^(dance|dancing|танц|танцав|танцев)/u.test(token)) return "dance"
  if (/^(remix|remixes|mixes|рэмiкс|рэмікс|ремикс)/u.test(token)) return "mix"
  if (/^(songs?|песн|песень)/u.test(token)) return "song"
  if (/^(tracks?|трек|трэк)/u.test(token)) return "track"
  if (/^(works?|работ|твор|прац)/u.test(token)) return "work"
  if (/^(music|музык|музыч)/u.test(token)) return "music"
  return token
}

export const queryTokens = (value: string): string[] => value.split(/[^\p{L}\p{N}]+/u)
  .map(normalizeQueryToken)
  .filter((token) => token.length > 1 && !QUERY_STOP_WORDS.has(token))

export const isDanceRemixQuery = (query: string): boolean => {
  const tokens = queryTokens(query)
  return tokens.includes("dance") && tokens.includes("mix")
}

export const matchesResearchQuery = (record: AtlasRecord, query: string): boolean => {
  const haystack = recordSearchText(record)
  const tokens = queryTokens(query)
  const asksDanceOrRemix = tokens.includes("dance") && tokens.includes("mix")
  const asksBelarusianLanguage = tokens.includes("belarus")
  const genericMediaTerms = new Set(["song", "track", "work", "music", "content", "контент", "музык", "музыка"])
  const required = asksDanceOrRemix
    ? tokens.filter((token) => token !== "dance" && token !== "mix" && token !== "belarus" && !genericMediaTerms.has(token))
    : tokens.filter((token) => token !== "belarus")
  const categoryMatch = !asksDanceOrRemix || record.dance || ["mix", "dj-set"].includes(record.kind) || record.relationship.toLowerCase().includes("remix") || record.genres.includes("remix")
  const languageMatch = !asksBelarusianLanguage || record.language.toLowerCase().includes("belarus")
  return categoryMatch && languageMatch && required.every((token) =>
    haystack.includes(token) ||
    (token === "mix" && ["mix", "dj-set", "derivative"].includes(record.kind)) ||
    (token === "song" && record.kind === "song") ||
    (token === "track" && ["song", "recording", "derivative"].includes(record.kind)) ||
    (token === "work" && ["song", "album", "recording", "derivative"].includes(record.kind)),
  )
}

export const researchRelevance = (record: AtlasRecord, query: string): number => {
  if (!query.trim()) return 0
  const haystack = recordSearchText(record)
  const title = record.title.toLowerCase()
  const tokens = queryTokens(query)
  let score = tokens.reduce((total, token) => total + (title.includes(token) ? 4 : haystack.includes(token) ? 1 : 0), 0)
  if (isDanceRemixQuery(query)) {
    if (record.relationship.toLowerCase().includes("remix")) score += 8
    if (record.kind === "derivative" && (record.relationship.toLowerCase().includes("remix") || record.genres.includes("remix"))) score += 5
    if (record.dance) score += 3
    if (record.confidence === "high") score += 2
  }
  return score
}
