import "./suite.css"
import {
  atlasRecords,
  atlasRecordsAsCsv,
  downloadText,
  importPassportJson,
  matchesResearchQuery,
  publicSourceRecords,
  researchRelevance,
  reviewerRecords,
  resetAnnotation,
  readAnnotations,
  saveAnnotation,
  type AtlasRecord,
  type Confidence,
  type RecordKind,
} from "./suite-data"
import { languageGroup, queryExplanation, isRemix, matchReason } from "./research-query"
import { exportCorpusJson, readCorpus } from "./corpus"
import { mountCorpusWarning } from "./storage-warning"
import { confidenceLabel, escapeHtml, suiteFooter, suiteHeader } from "./suite-shell"
import { mountDiscovery } from "./discovery-ui"

import { restoreInitialFragment } from "./initial-fragment"
const app = document.querySelector<HTMLDivElement>("#app")!

app.innerHTML = `${suiteHeader("atlas")}
<main class="suite-main">
  <section class="suite-hero shell atlas-hero">
    <p class="suite-eyebrow">02 · Searchable cultural context</p>
    <h1>Find the music.<br><em>Keep the evidence visible.</em></h1>
    <p>Search for Belarus-related music by artist, style, era or description. Explore the live public catalog, then inspect our curated evidence and your local archival passports. These are distinct sources, with visible coverage and uncertainty.</p>
    <div class="suite-actions"><a class="suite-button primary" href="#external-discovery">Search beyond the pilot</a><a class="suite-button" href="#explore">Explore the local corpus</a><button class="suite-button" id="quick-query">Try a local remix example</button></div>
    <div class="suite-boundary"><strong>Two separate collections:</strong> live Wikidata discovery below, and a local corpus of ${reviewerRecords.length} seed records plus your saved passports. The local collection contains five creator-documented works and ${publicSourceRecords.length} source-cited remix leads. Neither collection claims that Tuzin.fm or the wider Belarusian archive has been fully ingested.</div>
  </section>

  <section class="external-discovery shell" id="external-discovery"></section>

  <section class="atlas-workspace shell" id="explore">
    <aside class="atlas-filters suite-panel">
      <div><span class="suite-kicker">Research question</span><h2>Search &amp; filter</h2></div>
      <label class="atlas-field">Search all fields<input id="search" type="search" placeholder="artist, dance, exile, remix… / танцавальныя рэміксы…"></label>
      <button class="atlas-suggest" data-query="Belarusian dance works or remixes">↳ Belarusian dance works or remixes</button>
      <button class="atlas-suggest" data-query="Belarusian dance remixes">↳ Only dance-oriented remixes</button>
      <div class="filter-grid">
        <label class="atlas-field">Language<select id="language"><option value="">All languages</option></select></label>
        <label class="atlas-field">Year<select id="year"><option value="">All years</option></select></label>
        <label class="atlas-field">Record type<select id="kind"><option value="">All types</option></select></label>
        <label class="atlas-field">Evidence<select id="confidence"><option value="">All confidence levels</option><option value="high">High evidence</option><option value="medium">Developing evidence</option><option value="recovery">Recovery lead</option></select></label>
      </div>
      <label class="atlas-check"><input type="checkbox" id="dance"><span>Dance-oriented only</span></label>
      <label class="atlas-check"><input type="checkbox" id="reviewer" checked><span>Include curated seed records</span></label>
      <button class="suite-button" id="reset">Reset filters</button>
      <hr>
      <div><span class="suite-kicker">Your local archive</span><p class="atlas-note">Passports stay in this browser. A backup saves the full passports and their intervention history; the result exports are research reports.</p><button class="suite-button import-button" id="backup-passports">Back up all local passports</button><button class="suite-button import-button" id="import-trigger">Import passport backup</button><input id="passport-import" type="file" accept="application/json,.json" hidden><output class="atlas-import-status" id="import-status" aria-live="polite"></output></div>
    </aside>

    <div class="atlas-results">
      <header class="atlas-results-head"><div><span class="suite-kicker">Query result</span><h2 id="result-title">Pilot corpus</h2></div><div class="suite-actions compact"><button class="suite-button" id="export-json">Export result JSON</button><button class="suite-button" id="export-csv">Export result CSV</button></div></header>
      <p class="query-explanation" id="query-explanation" aria-live="polite"></p>
      <div class="atlas-stats" id="stats"></div>
      <div class="result-list" id="results" aria-live="polite"></div>
    </div>
  </section>

  <section class="atlas-analytics shell" id="analytics">
    <div class="section-intro"><span class="suite-kicker">DATA · Derived from the current result</span><h2>See the shape of the evidence.</h2><p>Every bar updates with the filters above. Counts describe only the visible pilot and local records—not Belarusian music as a whole.</p></div>
    <div class="analytics-grid" id="analytics-grid"></div>
  </section>

  <section class="atlas-sources shell" id="sources">
    <div class="section-intro"><span class="suite-kicker">Seed evidence register</span><h2>Where the 13 public remix leads come from.</h2><p>The pilot separates a source page from the records inferred from it. Each lead opens the cited evidence; a link does not transfer recording rights or turn a secondary report into a master file.</p></div>
    <div class="source-grid" id="source-grid"></div>
    <p class="source-audit-note">Six public source pages reviewed on September 8, 2026. The register is bounded and revisable—not a claim of comprehensive coverage.</p>
  </section>

  <section class="atlas-method shell">
    <div><span class="suite-kicker">A reproducible path</span><h2>Question → records → evidence → correction → export</h2></div>
    <ol><li><b>01</b><span>Ask</span><p>Search natural terms or use structured filters.</p></li><li><b>02</b><span>Inspect</span><p>Open a dossier and read the evidence status.</p></li><li><b>03</b><span>Correct</span><p>Add a local annotation without rewriting the source.</p></li><li><b>04</b><span>Export</span><p>Save the exact result set behind the interpretation.</p></li></ol>
  </section>
</main>
<dialog class="record-dialog" id="record-dialog"><button class="dialog-close" id="dialog-close" aria-label="Close">×</button><div id="record-detail"></div></dialog>
${suiteFooter()}`

const byId = <T extends HTMLElement>(id: string): T => document.querySelector<T>(`#${id}`)!
const search = byId<HTMLInputElement>("search")
const language = byId<HTMLSelectElement>("language")
const year = byId<HTMLSelectElement>("year")
const kind = byId<HTMLSelectElement>("kind")
const confidence = byId<HTMLSelectElement>("confidence")
const dance = byId<HTMLInputElement>("dance")
const reviewer = byId<HTMLInputElement>("reviewer")
const dialog = byId<HTMLDialogElement>("record-dialog")
let visible: AtlasRecord[] = []

const labelForKind = (value: string): string => value.replace("dj-set", "DJ set").replace("derivative", "documented derivative")
const unique = <T,>(values: T[]): T[] => [...new Set(values)]
const fillOptions = (): void => {
  const selected = { language: language.value, year: year.value, kind: kind.value }
  const records = atlasRecords(true)
  language.innerHTML = `<option value="">All languages</option>${unique(records.map((item) => languageGroup(item.language))).sort().map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("")}`
  year.innerHTML = `<option value="">All years</option>${unique(records.map((item) => item.year).filter((item): item is number => Boolean(item))).sort((a, b) => b - a).map((item) => `<option value="${item}">${item}</option>`).join("")}`
  kind.innerHTML = `<option value="">All types</option>${unique(records.map((item) => item.kind)).sort().map((item) => `<option value="${item}">${labelForKind(item)}</option>`).join("")}`
  language.value = selected.language; year.value = selected.year; kind.value = selected.kind
}

const filtered = (): AtlasRecord[] => {
  const records = atlasRecords(reviewer.checked).filter((record) =>
    matchesResearchQuery(record, search.value) &&
    (!language.value || languageGroup(record.language) === language.value) &&
    (!year.value || record.year === Number(year.value)) &&
    (!kind.value || record.kind === kind.value) &&
    (!confidence.value || record.confidence === confidence.value) &&
    (!dance.checked || record.dance),
  )
  if (!search.value.trim()) return records
  return records.sort((a, b) => researchRelevance(b, search.value) - researchRelevance(a, search.value) || (b.year ?? 0) - (a.year ?? 0) || a.title.localeCompare(b.title))
}

const distribution = (records: AtlasRecord[], getter: (record: AtlasRecord) => string): [string, number][] => {
  const counts = new Map<string, number>()
  records.forEach((record) => counts.set(getter(record), (counts.get(getter(record)) ?? 0) + 1))
  return [...counts].sort((a, b) => b[1] - a[1])
}

const bars = (title: string, rows: [string, number][], total: number): string => `<article class="chart suite-panel"><span class="suite-kicker">${title}</span>${rows.length ? rows.map(([label, count]) => `<div class="bar-row"><div><span>${escapeHtml(label)}</span><b>${count}</b></div><i><span style="width:${Math.max(5, count / total * 100)}%"></span></i></div>`).join("") : `<p class="atlas-note">No visible records.</p>`}</article>`

const render = (): void => {
  visible = filtered()
  const years = visible.map((item) => item.year).filter((item): item is number => Boolean(item))
  byId("result-title").textContent = search.value ? `Results for “${search.value}”` : "Pilot corpus"
  byId("query-explanation").textContent = queryExplanation(search.value)
  const evidenceLinks = unique(visible.map((item) => item.evidenceUrl).filter((item): item is string => Boolean(item)))
  byId("stats").innerHTML = [
    [visible.length, "visible records"],
    [evidenceLinks.length, "source links"],
    [unique(visible.map((item) => item.language)).length, "language labels"],
    [years.length ? `${Math.min(...years)}–${Math.max(...years)}` : "—", "dated span"],
    [visible.filter((item) => item.sourceStatus === "fingerprinted").length, "fingerprinted"],
  ].map(([value, label]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join("")
  byId("results").innerHTML = visible.length ? visible.map((record, index) => `
    <button class="record-card" data-id="${escapeHtml(record.id)}">
      <span class="record-index">${String(index + 1).padStart(2, "0")}</span>
      <div><div class="record-tags"><span class="suite-chip ${record.confidence}">${confidenceLabel(record.confidence)}</span><span>${escapeHtml(labelForKind(record.kind))}</span>${isRemix(record) ? "<span>remix</span>" : ""}${record.dance ? "<span>dance-oriented</span>" : ""}${readAnnotations()[record.id] ? "<span>local annotation</span>" : ""}</div><h3>${escapeHtml(record.title)}</h3><p>${escapeHtml(record.creator)} · ${record.year ?? "date unknown"} · ${escapeHtml(record.language)}</p></div>
      <div class="record-source"><span>${escapeHtml(record.sourceStatus.replaceAll("-", " "))}</span><b>Open dossier →</b></div><span class="match-reason">${escapeHtml(matchReason(record, search.value))}</span>
    </button>`).join("") : `<div class="suite-empty suite-panel"><h3>No honest match yet.</h3><p>Remove a filter, import a passport, or annotate a record. The pilot will not invent an answer.</p></div>`
  byId("analytics-grid").innerHTML = [
    bars("Languages", distribution(visible, (item) => item.language), Math.max(visible.length, 1)),
    bars("Record types", distribution(visible, (item) => labelForKind(item.kind)), Math.max(visible.length, 1)),
    bars("Evidence confidence", distribution(visible, (item) => confidenceLabel(item.confidence)), Math.max(visible.length, 1)),
  ].join("")
  byId<HTMLButtonElement>("export-json").disabled = visible.length === 0
  byId<HTMLButtonElement>("export-csv").disabled = visible.length === 0
  byId<HTMLButtonElement>("backup-passports").disabled = readCorpus().length === 0
}

const renderSourceRegister = (): void => {
  const grouped = new Map<string, { label: string; url: string; count: number }>()
  publicSourceRecords.forEach((record) => {
    if (!record.evidenceUrl) return
    const existing = grouped.get(record.evidenceUrl)
    if (existing) existing.count += 1
    else grouped.set(record.evidenceUrl, { label: record.evidenceLabel ?? new URL(record.evidenceUrl).hostname, url: record.evidenceUrl, count: 1 })
  })
  byId("source-grid").innerHTML = [...grouped.values()].map((source, index) => `<a class="source-card suite-panel" href="${escapeHtml(source.url)}" target="_blank" rel="noopener"><span>${String(index + 1).padStart(2, "0")}</span><div><strong>${escapeHtml(source.label)}</strong><small>${escapeHtml(new URL(source.url).hostname.replace(/^www\./, ""))}</small></div><b>${source.count} record${source.count === 1 ? "" : "s"} ↗</b></a>`).join("")
}

const openRecord = (record: AtlasRecord): void => {
  byId("record-detail").innerHTML = `
    <span class="suite-kicker">Source-visible dossier</span><h2>${escapeHtml(record.title)}</h2><p class="dialog-lede">${escapeHtml(record.summary)}</p>
    ${record.archiveId ? `<a class="suite-button" href="../?passport=${encodeURIComponent(record.archiveId)}#create">Open parent passport →</a>` : ""}
    <div class="dossier-grid"><dl>
      <div><dt>Creator</dt><dd>${escapeHtml(record.creator)}</dd></div><div><dt>Date / place</dt><dd>${record.year ?? "Unknown"} · ${escapeHtml(record.place)}</dd></div>
      <div><dt>Language</dt><dd>${escapeHtml(record.language)}</dd></div><div><dt>Format</dt><dd>${escapeHtml(record.format)}</dd></div>
      <div><dt>Relationship</dt><dd>${escapeHtml(record.relationship)}</dd></div><div><dt>Collection</dt><dd>${escapeHtml(record.collection)}</dd></div>
    </dl><aside><span class="suite-chip ${record.confidence}">${confidenceLabel(record.confidence)}</span><h3>${escapeHtml(record.sourceStatus.replaceAll("-", " "))}</h3><p>${escapeHtml(record.rightsStatus)}</p>${record.evidenceUrl ? `<a class="suite-button primary" href="${escapeHtml(record.evidenceUrl)}" target="_blank" rel="noopener">${escapeHtml(record.evidenceLabel ?? "Open evidence")} ↗</a>` : ""}</aside></div>
    <div class="dossier-tags">${[...record.genres, ...record.themes].map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
    <form id="annotation-form" class="annotation-form"><span class="suite-kicker">Community-correctable local annotation</span><p>This layer stays in this browser and does not silently rewrite the source record.</p>
      <div class="filter-grid"><label class="atlas-field">Type<select name="kind">${["song", "album", "dj-set", "mix", "recording", "derivative"].map((value) => `<option value="${value}" ${record.kind === value ? "selected" : ""}>${labelForKind(value)}</option>`).join("")}</select></label><label class="atlas-field">Confidence<select name="confidence">${["high", "medium", "recovery"].map((value) => `<option value="${value}" ${record.confidence === value ? "selected" : ""}>${confidenceLabel(value as Confidence)}</option>`).join("")}</select></label><label class="atlas-field">Genres<input name="genres" value="${escapeHtml(record.genres.join(", "))}"></label><label class="atlas-field">Themes<input name="themes" value="${escapeHtml(record.themes.join(", "))}"></label><label class="atlas-field">BPM · only if measured<input name="bpm" type="number" min="1" max="300" value="${record.bpm ?? ""}"></label><label class="atlas-check"><input name="dance" type="checkbox" ${record.dance ? "checked" : ""}><span>Dance-oriented</span></label></div><div class="suite-actions"><button class="suite-button primary" type="submit">Save local annotation</button><button class="suite-button" type="button" id="reset-annotation">Restore source labels</button></div><output id="annotation-status" aria-live="polite"></output></form>`
  dialog.showModal()
  dialog.scrollTop = 0
  byId<HTMLFormElement>("annotation-form").addEventListener("submit", (event) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget as HTMLFormElement)
    const bpm = Number(data.get("bpm"))
    try { saveAnnotation(record.id, {
      kind: data.get("kind") as RecordKind,
      confidence: data.get("confidence") as Confidence,
      genres: String(data.get("genres") ?? "").split(",").map((item) => item.trim()).filter(Boolean),
      themes: String(data.get("themes") ?? "").split(",").map((item) => item.trim()).filter(Boolean),
      bpm: Number.isFinite(bpm) && bpm > 0 ? bpm : undefined,
      dance: data.get("dance") === "on",
    })
    byId<HTMLOutputElement>("annotation-status").textContent = "Saved locally. Filters and analytics updated."
    fillOptions(); render()
    } catch (error) { byId("annotation-status").textContent = error instanceof Error ? error.message : "The browser could not save this annotation." }
  })
  byId("reset-annotation").addEventListener("click", () => {
    try { resetAnnotation(record.id); fillOptions(); render(); dialog.close() } catch { byId("annotation-status").textContent = "The browser could not restore the source labels." }
  })
}

document.addEventListener("click", (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>("[data-id]")
  if (!target) return
  const record = visible.find((item) => item.id === target.dataset.id)
  if (record) openRecord(record)
})
;[search, language, year, kind, confidence, dance, reviewer].forEach((element) => element.addEventListener("input", render))
document.querySelectorAll<HTMLElement>("[data-query]").forEach((button) => button.addEventListener("click", () => { search.value = button.dataset.query ?? ""; dance.checked = false; render(); byId("explore").scrollIntoView({ behavior: "smooth" }) }))
byId("quick-query").addEventListener("click", () => { search.value = "Belarusian dance works or remixes"; language.value = ""; year.value = ""; kind.value = ""; confidence.value = ""; reviewer.checked = true; dance.checked = false; render(); byId("explore").scrollIntoView({ behavior: "smooth" }) })
byId("reset").addEventListener("click", () => { search.value = ""; language.value = ""; year.value = ""; kind.value = ""; confidence.value = ""; dance.checked = false; reviewer.checked = true; render() })
byId("dialog-close").addEventListener("click", () => dialog.close())
dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close() })
byId<HTMLInputElement>("passport-import").addEventListener("change", async (event) => {
  const input = event.currentTarget as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const status = byId<HTMLOutputElement>("import-status")
  try {
    const count = importPassportJson(await file.text())
    fillOptions(); render()
    status.textContent = count ? `${count} validated passport record${count === 1 ? "" : "s"} imported into this browser.` : "These identical passports are already saved here. No duplicates were added."
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "That file is not a valid Archive Passport JSON export."
  }
  input.value = ""
})
byId("import-trigger").addEventListener("click", () => byId<HTMLInputElement>("passport-import").click())
byId("backup-passports").addEventListener("click", () => exportCorpusJson(readCorpus()))
const exportRows = (): Record<string, unknown>[] => visible.map((item) => ({ ...item, query: search.value, localAnnotation: readAnnotations()[item.id], exportScope: "visible Music Atlas result — report, not a passport backup", exportedAt: new Date().toISOString() }))
byId("export-json").addEventListener("click", () => downloadText(JSON.stringify(exportRows(), null, 2), "application/json", "unmute-belarus-atlas-result.json"))
byId("export-csv").addEventListener("click", () => {
  downloadText(atlasRecordsAsCsv(visible), "text/csv;charset=utf-8", "unmute-belarus-atlas-result.csv")
})

fillOptions()
mountCorpusWarning()
mountDiscovery()
search.value = new URLSearchParams(window.location.search).get("q") ?? ""
renderSourceRegister()
render()
restoreInitialFragment()
