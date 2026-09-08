/** Keyless CC0 metadata retrieval. Never fetches recordings, lyrics or private files. */
export type DiscoveryRecord = {
  id: string; title: string; aliases: string[]; description: string; creator: string; creatorId?: string;
  kind: "artist" | "album" | "song" | "other"; types: string[]; genres: string[];
  languages: string[]; years: number[]; activeFrom?: number; activeTo?: number;
  source: string; musicbrainz?: string;
}
export type DiscoveryCatalog = { records: DiscoveryRecord[]; retrievedAt: string; rowCount: number; truncated: boolean; queries: string[] }
type Binding = Record<string, { value: string } | undefined>
const LABELS = `SERVICE wikibase:label { bd:serviceParam wikibase:language "en,be,ru" }`
export const WORKS_QUERY = `SELECT ?item ?itemLabel ?itemDescription ?nameBe ?nameRu ?artist ?artistLabel ?artistBe ?artistRu ?genreLabel ?languageLabel ?date ?kindLabel WHERE {
 { SELECT DISTINCT ?item ?artist WHERE {
   { ?item wdt:P407 wd:Q909; wdt:P175 ?artist. }
   UNION { ?artist wdt:P434 ?mbid; (wdt:P27|wdt:P495) wd:Q184. ?item wdt:P175 ?artist. }
 } LIMIT 1000 }
 OPTIONAL { ?item wdt:P136 ?genre. } OPTIONAL { ?item wdt:P407 ?language. }
 OPTIONAL { ?item wdt:P577 ?date. } OPTIONAL { ?item wdt:P31 ?kind. }
 ${LABELS}
} LIMIT 3000`
export const ARTISTS_QUERY = `SELECT ?item ?itemLabel ?itemDescription ?nameBe ?nameRu ?genreLabel ?mbid ?started ?ended WHERE {
 { SELECT DISTINCT ?item ?mbid WHERE { ?item wdt:P434 ?mbid; (wdt:P27|wdt:P495) wd:Q184. } LIMIT 600 }
 OPTIONAL { ?item rdfs:label ?nameBe FILTER(LANG(?nameBe)="be") }
 OPTIONAL { ?item rdfs:label ?nameRu FILTER(LANG(?nameRu)="ru") }
 OPTIONAL { ?item wdt:P136 ?genre. }
 OPTIONAL { ?item (wdt:P2031|wdt:P571) ?started. } OPTIONAL { ?item (wdt:P2032|wdt:P576) ?ended. }
 ${LABELS}
} LIMIT 2000`
export const catalogSourceUrl = (query: string): string => `https://query.wikidata.org/#${encodeURIComponent(query)}`
const qid = (raw = ""): string | undefined => raw.match(/^https?:\/\/www\.wikidata\.org\/entity\/(Q\d+)$/)?.[1]
const asYear = (raw = ""): number | undefined => /^\d{4}-/.test(raw) ? Number(raw.slice(0, 4)) : undefined
const add = (list: string[], value?: string): void => { if (value && !/^Q\d+$/.test(value) && !list.includes(value)) list.push(value) }

export function parseDiscoveryRows(rows: Binding[], artists = false): DiscoveryRecord[] {
  const records = new Map<string, DiscoveryRecord>()
  const creators = new Map<string, Set<string>>()
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue
    const row = Object.fromEntries(Object.entries(raw).filter(([, value]) => value && typeof value.value === "string")) as Binding
    const id = qid(row.item?.value)
    if (!id) continue
    let record = records.get(id)
    if (!record) {
      record = { id, title: row.itemLabel?.value ?? id, aliases: [], description: row.itemDescription?.value ?? "",
        creator: artists ? row.itemLabel?.value ?? id : row.artistLabel?.value ?? "Creator not recorded", creatorId: qid(row.artist?.value),
        kind: artists ? "artist" : "other", types: [], genres: [], languages: [], years: [], source: `https://www.wikidata.org/wiki/${id}` }
      records.set(id, record)
    }
    if (!artists && row.artistLabel?.value) {
      const names = creators.get(id) ?? new Set<string>()
      names.add(row.artistLabel.value); creators.set(id, names); record.creator = [...names].join(" · ")
    }
    for (const field of ["nameBe", "nameRu", "artistLabel", "artistBe", "artistRu"]) add(record.aliases, row[field]?.value)
    add(record.genres, row.genreLabel?.value); add(record.types, row.kindLabel?.value)
    if (!artists) add(record.languages, row.languageLabel?.value)
    const year = asYear(row.date?.value)
    if (year && !record.years.includes(year)) record.years.push(year)
    const started = asYear(row.started?.value), ended = asYear(row.ended?.value)
    if (started && (!record.activeFrom || started < record.activeFrom)) record.activeFrom = started
    if (ended && (!record.activeTo || ended > record.activeTo)) record.activeTo = ended
    if (artists && /^[0-9a-f-]{36}$/i.test(row.mbid?.value ?? "")) record.musicbrainz = `https://musicbrainz.org/artist/${row.mbid!.value}`
    if (!artists) {
      const type = record.types.join(" ").toLowerCase()
      record.kind = /album|альбом/.test(type) ? "album" : /song|single|песня|сінгл/.test(type) ? "song" : "other"
    }
  }
  return [...records.values()]
}

let cached: DiscoveryCatalog | undefined
let pending: Promise<DiscoveryCatalog> | undefined
let lastRequest = 0
async function readQuery(query: string, request: typeof fetch): Promise<Binding[]> {
  // Serial, user-triggered retrieval. No polling or automatic retry loop.
  const wait = 1100 - (Date.now() - lastRequest)
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
  lastRequest = Date.now()
  const url = new URL("https://query.wikidata.org/sparql")
  url.search = new URLSearchParams({ query, format: "json" }).toString()
  const response = await request(url, { credentials: "omit", signal: AbortSignal.timeout(35000),
    headers: { Accept: "application/sparql-results+json", "Api-User-Agent": "UnmuteBelarusResearch/0.3 (https://sergey-ulyanov.pro/research/)" } })
  if (!response.ok) throw new Error(response.status === 429 || response.status === 503 ? "The source is busy or rate-limited. Wait a moment, then retry." : `The source returned an error (${response.status}). Please retry later.`)
  const data: unknown = await response.json()
  const bindings = (data as { results?: { bindings?: unknown } })?.results?.bindings
  if (!Array.isArray(bindings)) throw new Error("The source returned an unreadable response. No local records were changed.")
  return bindings as Binding[]
}
export async function loadDiscoveryCatalog(force = false, request: typeof fetch = fetch): Promise<DiscoveryCatalog> {
  if (pending) return pending
  if (!force && cached && Date.now() - Date.parse(cached.retrievedAt) < 30 * 60 * 1000) return cached
  pending = (async () => {
    const works = await readQuery(WORKS_QUERY, request)
    const artists = await readQuery(ARTISTS_QUERY, request)
    const artistRecords = parseDiscoveryRows(artists, true)
    const artistById = new Map(artistRecords.map((record) => [record.id, record]))
    const workRecords = parseDiscoveryRows(works)
    workRecords.forEach((record) => artistById.get(record.creatorId ?? "")?.aliases.forEach((alias) => add(record.aliases, alias)))
    const catalog = { records: [...workRecords, ...artistRecords], retrievedAt: new Date().toISOString(),
      rowCount: works.length + artists.length, truncated: works.length >= 3000 || artists.length >= 2000 || workRecords.length >= 1000 || artistRecords.length >= 600, queries: [WORKS_QUERY, ARTISTS_QUERY] }
    cached = catalog
    return catalog
  })()
  try { return await pending } finally { pending = undefined }
}
