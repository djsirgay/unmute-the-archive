import type { DiscoveryRecord } from "./discovery-data"

export const normalizeDiscovery = (value: string): string => value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/ё/g, "е").replace(/[.’'"«»]/g, "")
export type DiscoveryIntent = { text: string; genre: string; mood: string; format: string; language: string; from: string; to: string }
export const emptyIntent = (): DiscoveryIntent => ({ text: "", genre: "", mood: "", format: "", language: "", from: "", to: "" })
const concepts: [string, RegExp][] = [
  ["folk", /\bfolk\b|фолк|фалькл|фолькл|этніч|этнич|этна|этно|народн/iu],
  ["electronic", /electronic|electronica|электрон|электра/iu],
  ["post-punk", /\bpost[ -]?punk\b|пост[ -]?панк/iu], ["punk", /\bpunk\b|панк/iu], ["rock", /\brock\b|рок/iu],
  ["pop", /\bpop\b|поп|эстрад/iu], ["jazz", /\bjazz\b|джаз/iu], ["classical", /\bclassical\b|классич|класіч|акадэміч|академич/iu],
  ["hip hop", /\bhip.?hop\b|\brap\b|хіп.?хоп|хип.?хоп|рэп|реп/iu], ["metal", /\bmetal\b|метал/iu],
  ["ambient", /\bambient\b|эмбиент|эмбіент/iu], ["reggae", /\breggae\b|регги|рэгі/iu],
]
const moods: [string, RegExp][] = [["calm", /calm|relax|спокой|спакой|медита|медыта/iu], ["sad", /\bsad\b|melanchol|груст|сумн|меланхол/iu], ["energetic", /energetic|energy|энерг|энэргі|бадзёр/iu], ["joyful", /joyful|happy|весел|вясёл|радост|радас/iu], ["dark", /\bdark\b|мрач|змроч/iu]]
const noise = /^(find|show|me|all|some|the|a|an|music|musical|tracks?|works?|by|from|in|of|for|and|or|to|between|language|belarusian|belarus|найди|найти|покажи|мне|все|всю|вся|весь|хочу|слушать|послушать|музык\p{L}*|музыч\p{L}*|трек\p{L}*|трэк\p{L}*|белорус\p{L}*|беларус\p{L}*|знайдзі|знайсці|пакажы|усе|ўсе|мне|працы|работы|на|по|па|с|з|і|и|или|або|для|из|ў|в|у|да|до|гад\p{L}*|год\p{L}*|мов\p{L}*|язык\p{L}*|х)$/u
// Whole words only: a name such as «Песняры» is not the noun «песня».
const songWord = /^(songs?|singles?|песня|песни|песню|песней|песне|песен|песням|песнями|песнях|песні|песняй|песень|песнямі|с[іи]нгл(?:ы|а|ов|ау)?)$/u

/** Transparent finite vocabulary, not an LLM. Unrecognized words remain visible text criteria. */
export function parseDiscoveryIntent(description: string): DiscoveryIntent {
  const intent = emptyIntent()
  let remaining = description
  for (const [name, pattern] of concepts) if (pattern.test(remaining)) { intent.genre = name; remaining = remaining.replace(new RegExp("(?:" + pattern.source + ")\\p{L}*", "giu"), " "); break }
  for (const [name, pattern] of moods) if (pattern.test(remaining)) { intent.mood = name; remaining = remaining.replace(new RegExp("(?:" + pattern.source + ")\\p{L}*", "giu"), " "); break }
  const languagePatterns: [string, RegExp][] = [
    ["Belarusian", /in belarusian|belarusian[ -]language|беларускамоў\p{L}*|белорусскоязыч\p{L}*|на белорусском|на беларускай/iu],
    ["Russian", /in russian|russian[ -]language|русскоязыч\p{L}*|рускамоў\p{L}*|на русском|на рускай/iu],
    ["English", /in english|english[ -]language|англоязыч\p{L}*|англамоў\p{L}*|на английском|на англійскай/iu],
  ]
  for (const [language, pattern] of languagePatterns) if (pattern.test(remaining)) {
    intent.language = language; remaining = remaining.replace(pattern, " "); break
  }
  const range = remaining.match(/\b((?:19|20)\d{2})\s*(?:[-–—]|to|до|да)\s*((?:19|20)\d{2})\b/iu)
  const decade = remaining.match(/\b((?:19|20)\d0)(?:s\b|[-\s]?(?:ых|ые|х|е|я)(?=\s|$))|\b(\d0)[-\s]?(?:s|ых|ые|х|е|я)(?=\s|$)/iu)
  if (range) { intent.from = range[1]; intent.to = range[2]; remaining = remaining.replace(range[0], " ") }
  else if (decade) {
    const year = decade[1] ? Number(decade[1]) : Number(decade[2]) >= 30 ? 1900 + Number(decade[2]) : 2000 + Number(decade[2])
    intent.from = String(year); intent.to = String(year + 9); remaining = remaining.replace(decade[0], " ")
  } else {
    const year = remaining.match(/\b((?:19|20)\d{2})\b/u)
    if (year) { intent.from = year[1]; intent.to = year[1]; remaining = remaining.replace(year[0], " ") }
  }
  if (/album|альбом/iu.test(remaining)) { intent.format = "album"; remaining = remaining.replace(/album\p{L}*|альбом\p{L}*/giu, " ") }
  else if (/artist|band|артист|исполнител|выканаў|гурт|групп/iu.test(remaining)) { intent.format = "artist"; remaining = remaining.replace(/artist\p{L}*|band\p{L}*|артист\p{L}*|исполнител\p{L}*|выканаў\p{L}*|гурт\p{L}*|групп\p{L}*/giu, " ") }
  const words = normalizeDiscovery(remaining).split(/[^\p{L}\p{N}]+/u)
  if (!intent.format && words.some((word) => songWord.test(word))) intent.format = "song"
  intent.text = words.filter((word) => word.length > 1 && !noise.test(word) && !songWord.test(word)).join(" ")
  return intent
}

const genreMatches = (value: string, genre: string): boolean => {
  const text = normalizeDiscovery(value)
  if (genre === "electronic") return /electro|synth|techno|house|trance|ambient|electronica|электрон/.test(text)
  if (genre === "folk") return /folk|ethno|traditional|фолк|фалькл|народ/.test(text)
  if (genre === "post-punk") return /post[ -]?punk|пост[ -]?панк/.test(text)
  if (genre === "punk") return /punk|панк/.test(text)
  return text.includes(genre)
}
export function matchesDiscovery(record: DiscoveryRecord, intent: DiscoveryIntent): boolean {
  const text = normalizeDiscovery([record.title, record.creator, ...record.aliases, record.description].join(" "))
  if (!intent.text.split(/\s+/u).filter(Boolean).every((token) => text.includes(normalizeDiscovery(token)))) return false
  if (intent.genre && !record.genres.some((genre) => genreMatches(genre, intent.genre))) return false
  if (intent.format === "works" ? record.kind === "artist" : intent.format && record.kind !== intent.format) return false
  // Artist nationality / spoken language is never used as a recording language.
  if (intent.language && (record.kind === "artist" || !record.languages.some((language) => normalizeDiscovery(language) === normalizeDiscovery(intent.language)))) return false
  const from = Number(intent.from) || 0, to = Number(intent.to) || 9999
  if (intent.from || intent.to) {
    if (record.kind === "artist") {
      if (!record.activeFrom || record.activeFrom > to || (record.activeTo && record.activeTo < from)) return false
    } else if (!record.years.some((year) => year >= from && year <= to)) return false
  }
  // Mood is visibly NOT applied: catalog metadata is not an acoustic judgment.
  return true
}

export function discoveryReasons(record: DiscoveryRecord, intent: DiscoveryIntent): string[] {
  const reasons = [record.kind === "artist" ? "Belarus association in source; not a claim about every song’s language" : "Catalogued work associated with Belarus or the Belarusian language"]
  if (intent.genre) reasons.push(`${record.kind === "artist" ? "Artist" : "Work"} genre in source: ${record.genres.join(", ")}`)
  if (intent.from || intent.to) reasons.push(record.kind === "artist" ? `Recorded active period: ${record.activeFrom}–${record.activeTo ?? "open"}` : `Publication date in source: ${record.years.join(", ")}`)
  if (intent.language) reasons.push(`Work language in source: ${record.languages.join(", ")}; verify the exact recording`)
  if (intent.text) reasons.push("Name or description matches the text criterion")
  return reasons
}
