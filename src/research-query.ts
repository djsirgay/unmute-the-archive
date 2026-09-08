import type { AtlasRecord } from "./suite-data"

const normalize = (value: string): string => value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "")
const aliases: Record<string, string> = { "шума": "suma", "акутэ": "akute", "акуте": "akute", "криви": "kriwi", "крыви": "kriwi", "палина": "palina", "паліна": "palina", "знічка": "znicka", "зничка": "znicka" }
const stop = new Set(["the", "and", "all", "find", "show", "give", "me", "of", "in", "on", "or", "for", "with", "between", "from", "to", "language", "найди", "найти", "покажи", "все", "мне", "и", "или", "на", "по", "с", "для", "языке", "язык", "года", "год", "до", "знайдзі", "знайсці", "пакажы", "усе", "ўсе", "і", "ці", "або", "па", "з", "мове", "мова", "годзе"].map(normalize))
const tokenFor = (value: string): string => {
  const token = normalize(value)
  if (/^(belarus|беларус|белорус)/u.test(token)) return "belarusian"
  if (/^(russian|русск|руск)/u.test(token)) return "russian"
  if (/^(english|англи|англі)/u.test(token)) return "english"
  if (/^(dance|dancing|танц)/u.test(token)) return "dance"
  if (/^(remix|ремикс|рэмiкс|рэмікс)/u.test(token)) return "remix"
  if (/^(mix|микс|мікс)/u.test(token)) return "mix"
  if (/^(songs?|tracks?|works?|music|content|песн|песень|трек|трэк|работ|твор|прац|музык|музыч|контент)/u.test(token)) return "media"
  return aliases[token] ?? token
}
export const queryTokens = (query: string): string[] => query.split(/[^\p{L}\p{N}]+/u).map(tokenFor).filter((token) => token.length > 1 && !stop.has(token) && token !== "media")
export const isRemix = (record: AtlasRecord): boolean => /\bremix\b|\brmx\b|рэм[іиi]кс|ремикс/u.test(normalize([record.title, record.relationship, ...record.genres].join(" ")))
export const languageGroup = (language: string): string => {
  if (/unknown|needs review|not established/i.test(language)) return "Unknown"
  if (/instrumental|no speech|synthetic|no linguistic/i.test(language)) return "Instrumental / no speech"
  if (/belarus|беларус|белорус/i.test(language)) return "Belarusian"
  if (/russian|русск|руск/i.test(language)) return "Russian"
  if (/english|англ/i.test(language)) return "English"
  return language
}
export const isDanceRemixQuery = (query: string): boolean => {
  const tokens = queryTokens(query)
  return tokens.includes("dance") && tokens.includes("remix")
}
const isUnion = (query: string): boolean => /(?:^|\s)(?:or|или|або|ці)(?:\s|$)/iu.test(query)
const yearRange = (query: string): [number, number] | undefined => {
  const match = query.match(/\b((?:19|20)\d{2})\s*(?:[–—-]|to|до)\s*((?:19|20)\d{2})\b/iu)
  return match ? [Number(match[1]), Number(match[2])] : undefined
}
const searchText = (record: AtlasRecord): string => normalize([record.title, record.creator, record.year, record.language, record.place, record.kind, record.format, record.relationship, ...record.genres, ...record.themes, record.summary, record.collection].join(" "))

export const matchesResearchQuery = (record: AtlasRecord, query: string): boolean => {
  const tokens = queryTokens(query)
  const categories = tokens.filter((token) => ["dance", "remix", "mix"].includes(token))
  const languages = tokens.filter((token) => ["belarusian", "russian", "english"].includes(token))
  const range = yearRange(query)
  const required = tokens.filter((token) => !categories.includes(token) && !languages.includes(token) && !(range && range.includes(Number(token))))
  const matchCategory = (category: string): boolean => category === "dance" ? record.dance : category === "remix" ? isRemix(record) : ["mix", "dj-set"].includes(record.kind)
  const categoryMatch = !categories.length || (isUnion(query) ? categories.some(matchCategory) : categories.every(matchCategory))
  return categoryMatch && languages.every((language) => normalize(languageGroup(record.language)) === language) &&
    (!range || (record.year !== undefined && record.year >= range[0] && record.year <= range[1])) &&
    required.every((token) => searchText(record).includes(token))
}

export const queryExplanation = (query: string): string => {
  if (!query.trim()) return "Browse the curated records and passports saved in this browser."
  const tokens = queryTokens(query)
  const parts: string[] = []
  if (tokens.includes("belarusian")) parts.push("Belarusian-language records")
  if (isDanceRemixQuery(query)) parts.push(isUnion(query) ? "dance-oriented works OR documented remixes" : "documented remixes with a dance-oriented label")
  else if (tokens.includes("remix")) parts.push("documented remixes; restoration copies are excluded")
  else if (tokens.includes("dance")) parts.push("records explicitly labeled dance-oriented")
  const range = yearRange(query)
  if (range) parts.push(`years ${range[0]}–${range[1]}`)
  return `${parts.length ? `Interpreted as: ${parts.join(" · ")}. ` : "Matching the recorded text. "}Search covers this corpus, not the whole web.`
}

export const researchRelevance = (record: AtlasRecord, query: string): number => {
  const title = normalize(record.title)
  return queryTokens(query).reduce((score, token) => score + (title.includes(token) ? 4 : searchText(record).includes(token) ? 1 : 0), 0) + (queryTokens(query).includes("remix") && isRemix(record) ? 8 : 0)
}

export const matchReason = (record: AtlasRecord, query: string): string => {
  if (!query.trim()) return record.archiveId ? "Saved in your browser" : "Curated source record"
  const tokens = queryTokens(query)
  const reasons: string[] = []
  if (tokens.includes("belarusian")) reasons.push("Belarusian-language label")
  if (tokens.includes("remix") && isRemix(record)) reasons.push("remix documented in the record")
  if (tokens.includes("dance") && record.dance) reasons.push("dance-oriented label")
  if (tokens.includes("mix") && ["mix", "dj-set"].includes(record.kind)) reasons.push("mix / DJ set")
  return reasons.length ? `Matched: ${reasons.join(" · ")}` : "Matched recorded title, creator, date or context"
}
