import { describe, expect, it } from "vitest"
import { parseDiscoveryRows, ARTISTS_QUERY, WORKS_QUERY, type DiscoveryRecord } from "./discovery-data"
import { emptyIntent, matchesDiscovery, parseDiscoveryIntent, discoveryReasons } from "./discovery-query"
const record: DiscoveryRecord = { id: "Q123", title: "An album", aliases: ["N.R.M.", "Н.Р.М."], description: "album", creator: "N.R.M.", kind: "album", genres: ["folk rock"], types: ["album"], languages: ["Belarusian"], years: [1996], source: "https://www.wikidata.org/wiki/Q123" }
describe("Broad metadata discovery", () => {
  it.each(["Belarusian folk", "беларускі фолк", "белорусская народная музыка"])("interprets a broad style, not a preset artist: %s", (text) => {
    const parsed = parseDiscoveryIntent(text)
    expect(parsed.genre).toBe("folk"); expect(parsed.text).toBe(""); expect(parsed.language).toBe("")
    expect(matchesDiscovery(record, parsed)).toBe(true)
  })
  it.each(["electronic music 1990s", "электронная музыка 90-х", "электронная музыка 90х", "электронная музыка 1990-х", "электронная музыка 1990-е", "электронная музыка 1990-я"])("extracts era without pretending a production year: %s", (text) => {
    const parsed = parseDiscoveryIntent(text)
    expect(parsed.genre).toBe("electronic"); expect(parsed.from).toBe("1990"); expect(parsed.to).toBe("1999"); expect(parsed.text).toBe("")
  })
  it("keeps exact years distinct from decades", () => {
    expect(parseDiscoveryIntent("rock 1990")).toMatchObject({ from: "1990", to: "1990" })
    expect(parseDiscoveryIntent("rock 1991–1998")).toMatchObject({ from: "1991", to: "1998", text: "" })
  })
  it.each([
    ["albums in English", "English"], ["albums in Russian", "Russian"],
    ["альбомы на английском языке", "English"], ["альбомы на рускай мове", "Russian"],
  ])("removes a recognized language phrase from free text: %s", (text, language) => {
    const parsed = parseDiscoveryIntent(text)
    expect(parsed).toMatchObject({ text: "", language, format: "album" })
    expect(matchesDiscovery({ ...record, languages: [language] }, parsed)).toBe(true)
  })
  it.each(["post-punk", "пост-панк", "постпанк"])("preserves the specific post-punk genre: %s", (text) => {
    const parsed = parseDiscoveryIntent(text)
    expect(parsed).toMatchObject({ text: "", genre: "post-punk" })
    expect(matchesDiscovery({ ...record, genres: ["post punk"] }, parsed)).toBe(true)
    expect(matchesDiscovery({ ...record, genres: ["rock"] }, parsed)).toBe(false)
  })
  it.each(["punk", "панк"])("matches punk as punk rather than silently substituting rock: %s", (text) => {
    const parsed = parseDiscoveryIntent(text)
    expect(parsed).toMatchObject({ text: "", genre: "punk" })
    expect(matchesDiscovery({ ...record, genres: ["punk rock"] }, parsed)).toBe(true)
    expect(matchesDiscovery({ ...record, genres: ["rock"] }, parsed)).toBe(false)
  })
  it("uses source aliases and punctuation without artist-specific code", () => {
    expect(parseDiscoveryIntent("N.R.M.").text).toBe("nrm")
    expect(parseDiscoveryIntent("Н.Р.М.").text).toBe("нрм")
    expect(matchesDiscovery(record, parseDiscoveryIntent("N.R.M."))).toBe(true)
    expect(matchesDiscovery(record, parseDiscoveryIntent("Н.Р.М."))).toBe(true)
  })
  it.each(["albums in Belarusian", "альбомы на белорусском языке", "альбомы на беларускай мове"])("distinguishes language from country: %s", (text) => {
    const intent = parseDiscoveryIntent(text)
    expect(intent).toMatchObject({ format: "album", language: "Belarusian", text: "" })
    expect(matchesDiscovery({ ...record, languages: [] }, intent)).toBe(false)
    expect(matchesDiscovery({ ...record, kind: "artist", languages: ["Belarusian"] }, { ...intent, format: "" })).toBe(false)
  })
  it("does not invent mood matches", () => {
    const intent = parseDiscoveryIntent("calm folk music")
    expect(intent.mood).toBe("calm"); expect(intent.genre).toBe("folk"); expect(intent.text).toBe("")
    expect(discoveryReasons(record, intent).join(" ")).not.toContain("calm")
    expect(matchesDiscovery(record, intent)).toBe(true) // explicitly unsupported, not secretly substituted
  })
  it("excludes unknown dates from an era filter", () => {
    expect(matchesDiscovery({ ...record, years: [] }, { ...emptyIntent(), from: "1990", to: "1999" })).toBe(false)
  })
  it("can distinguish works from artist leads", () => {
    expect(matchesDiscovery(record, { ...emptyIntent(), format: "works" })).toBe(true)
    expect(matchesDiscovery({ ...record, kind: "artist" }, { ...emptyIntent(), format: "works" })).toBe(false)
  })
  it("never assigns an artist genre to a work without a work statement", () => {
    expect(matchesDiscovery({ ...record, genres: [] }, { ...emptyIntent(), genre: "folk" })).toBe(false)
  })
  it("coalesces source rows, preserving multiple dates/languages and canonical provenance", () => {
    const rows = ["Belarusian", "Russian"].map((language) => ({ item: { value: "http://www.wikidata.org/entity/Q123" }, itemLabel: { value: "Album" }, kindLabel: { value: "album" }, languageLabel: { value: language }, date: { value: "1996-01-01T00:00:00Z" } }))
    const parsed = parseDiscoveryRows(rows)
    expect(parsed).toHaveLength(1); expect(parsed[0].languages).toEqual(["Belarusian", "Russian"]); expect(parsed[0].years).toEqual([1996]); expect(parsed[0].source).toBe("https://www.wikidata.org/wiki/Q123")
  })
  it("does not accept an arbitrary external source URL", () => {
    expect(parseDiscoveryRows([{ item: { value: "javascript:alert(1)" } }])).toEqual([])
  })
  it("never treats an artist spoken language as a recording language", () => {
    expect(parseDiscoveryRows([{ item: { value: "http://www.wikidata.org/entity/Q123" }, languageLabel: { value: "Belarusian" } }], true)[0].languages).toEqual([])
  })
  it("bounds source reads and does not leave artist variables unbound in artist query", () => {
    expect(WORKS_QUERY).toContain("LIMIT 3000"); expect(ARTISTS_QUERY).toContain("LIMIT 2000")
    expect(ARTISTS_QUERY).not.toContain("?artist ")
  })
})
