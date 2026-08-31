import "./suite.css"
import {
  atlasRecords,
  downloadText,
  importPassportJson,
  matchesResearchQuery,
  saveAnnotation,
  type AtlasRecord,
  type Confidence,
  type RecordKind,
} from "./suite-data"
import { confidenceLabel, escapeHtml, suiteFooter, suiteHeader } from "./suite-shell"

const app = document.querySelector<HTMLDivElement>("#app")!

app.innerHTML = `${suiteHeader("atlas")}
<main class="suite-main">
  <section class="suite-hero shell atlas-hero">
    <p class="suite-eyebrow">02 · Searchable cultural context</p>
    <h1>Find the music.<br><em>Keep the evidence visible.</em></h1>
    <p>Music Atlas turns archival passports and carefully labeled research leads into a searchable corpus. Ask a concrete question, inspect why each result matched, correct the metadata, and export the evidence behind your conclusion.</p>
    <div class="suite-actions"><a class="suite-button primary" href="#explore">Explore the pilot corpus</a><button class="suite-button" id="quick-query">Try: dance remixes in Belarusian</button></div>
    <div class="suite-boundary"><strong>What you are seeing:</strong> five transparent reviewer records drawn from the researcher’s documented work, plus any passports stored in this browser. This is a functional pilot—not a claim that the wider Belarusian archive has already been ingested.</div>
  </section>

  <section class="atlas-workspace shell" id="explore">
    <aside class="atlas-filters suite-panel">
      <div><span class="suite-kicker">Research question</span><h2>Search &amp; filter</h2></div>
      <label class="atlas-field">Search all fields<input id="search" type="search" placeholder="artist, dance, exile, remix…"></label>
      <button class="atlas-suggest" data-query="dance Belarusian remix">↳ Dance works and remixes in Belarusian</button>
      <div class="filter-grid">
        <label class="atlas-field">Language<select id="language"><option value="">All languages</option></select></label>
        <label class="atlas-field">Year<select id="year"><option value="">All years</option></select></label>
        <label class="atlas-field">Record type<select id="kind"><option value="">All types</option></select></label>
        <label class="atlas-field">Evidence<select id="confidence"><option value="">All confidence levels</option><option value="high">High evidence</option><option value="medium">Developing evidence</option><option value="recovery">Recovery lead</option></select></label>
      </div>
      <label class="atlas-check"><input type="checkbox" id="dance"><span>Dance-oriented only</span></label>
      <label class="atlas-check"><input type="checkbox" id="reviewer" checked><span>Include reviewer pilot records</span></label>
      <button class="suite-button" id="reset">Reset filters</button>
      <hr>
      <div><span class="suite-kicker">Bring your own records</span><p class="atlas-note">Import Archive Passport JSON. Records remain in this browser until you export or clear them.</p><label class="suite-button import-button">Import passport JSON<input id="passport-import" type="file" accept="application/json,.json" hidden></label></div>
    </aside>

    <div class="atlas-results">
      <header class="atlas-results-head"><div><span class="suite-kicker">Query result</span><h2 id="result-title">Pilot corpus</h2></div><div class="suite-actions compact"><button class="suite-button" id="export-json">JSON</button><button class="suite-button" id="export-csv">CSV</button></div></header>
      <div class="atlas-stats" id="stats"></div>
      <div class="result-list" id="results" aria-live="polite"></div>
    </div>
  </section>

  <section class="atlas-analytics shell" id="analytics">
    <div class="section-intro"><span class="suite-kicker">DATA · Derived from the current result</span><h2>See the shape of the evidence.</h2><p>Every bar updates with the filters above. Counts describe only the visible pilot and local records—not Belarusian music as a whole.</p></div>
    <div class="analytics-grid" id="analytics-grid"></div>
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
  const records = atlasRecords(true)
  language.innerHTML = `<option value="">All languages</option>${unique(records.map((item) => item.language)).sort().map((item) => `<option>${escapeHtml(item)}</option>`).join("")}`
  year.innerHTML = `<option value="">All years</option>${unique(records.map((item) => item.year).filter((item): item is number => Boolean(item))).sort((a, b) => b - a).map((item) => `<option>${item}</option>`).join("")}`
  kind.innerHTML = `<option value="">All types</option>${unique(records.map((item) => item.kind)).sort().map((item) => `<option value="${item}">${labelForKind(item)}</option>`).join("")}`
}

const filtered = (): AtlasRecord[] => atlasRecords(reviewer.checked).filter((record) =>
  matchesResearchQuery(record, search.value) &&
  (!language.value || record.language === language.value) &&
  (!year.value || record.year === Number(year.value)) &&
  (!kind.value || record.kind === kind.value) &&
  (!confidence.value || record.confidence === confidence.value) &&
  (!dance.checked || record.dance),
)

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
  byId("stats").innerHTML = [
    [visible.length, "visible records"],
    [unique(visible.map((item) => item.language)).length, "language labels"],
    [years.length ? `${Math.min(...years)}–${Math.max(...years)}` : "—", "dated span"],
    [visible.filter((item) => item.sourceStatus === "fingerprinted").length, "fingerprinted"],
  ].map(([value, label]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join("")
  byId("results").innerHTML = visible.length ? visible.map((record, index) => `
    <button class="record-card" data-id="${escapeHtml(record.id)}">
      <span class="record-index">${String(index + 1).padStart(2, "0")}</span>
      <div><div class="record-tags"><span class="suite-chip ${record.confidence}">${confidenceLabel(record.confidence)}</span><span>${escapeHtml(labelForKind(record.kind))}</span>${record.dance ? "<span>dance</span>" : ""}</div><h3>${escapeHtml(record.title)}</h3><p>${escapeHtml(record.creator)} · ${record.year ?? "date unknown"} · ${escapeHtml(record.language)}</p></div>
      <div class="record-source"><span>${escapeHtml(record.sourceStatus.replaceAll("-", " "))}</span><b>Open dossier →</b></div>
    </button>`).join("") : `<div class="suite-empty suite-panel"><h3>No honest match yet.</h3><p>Remove a filter, import a passport, or annotate a record. The pilot will not invent an answer.</p></div>`
  byId("analytics-grid").innerHTML = [
    bars("Languages", distribution(visible, (item) => item.language), Math.max(visible.length, 1)),
    bars("Record types", distribution(visible, (item) => labelForKind(item.kind)), Math.max(visible.length, 1)),
    bars("Evidence confidence", distribution(visible, (item) => confidenceLabel(item.confidence)), Math.max(visible.length, 1)),
  ].join("")
}

const openRecord = (record: AtlasRecord): void => {
  byId("record-detail").innerHTML = `
    <span class="suite-kicker">Source-visible dossier</span><h2>${escapeHtml(record.title)}</h2><p class="dialog-lede">${escapeHtml(record.summary)}</p>
    <div class="dossier-grid"><dl>
      <div><dt>Creator</dt><dd>${escapeHtml(record.creator)}</dd></div><div><dt>Date / place</dt><dd>${record.year ?? "Unknown"} · ${escapeHtml(record.place)}</dd></div>
      <div><dt>Language</dt><dd>${escapeHtml(record.language)}</dd></div><div><dt>Format</dt><dd>${escapeHtml(record.format)}</dd></div>
      <div><dt>Relationship</dt><dd>${escapeHtml(record.relationship)}</dd></div><div><dt>Collection</dt><dd>${escapeHtml(record.collection)}</dd></div>
    </dl><aside><span class="suite-chip ${record.confidence}">${confidenceLabel(record.confidence)}</span><h3>${escapeHtml(record.sourceStatus.replaceAll("-", " "))}</h3><p>${escapeHtml(record.rightsStatus)}</p>${record.evidenceUrl ? `<a class="suite-button primary" href="${escapeHtml(record.evidenceUrl)}" target="_blank" rel="noopener">${escapeHtml(record.evidenceLabel ?? "Open evidence")} ↗</a>` : ""}</aside></div>
    <div class="dossier-tags">${[...record.genres, ...record.themes].map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
    <form id="annotation-form" class="annotation-form"><span class="suite-kicker">Community-correctable local annotation</span><p>This layer stays in this browser and does not silently rewrite the source record.</p>
      <div class="filter-grid"><label class="atlas-field">Type<select name="kind">${["song", "album", "dj-set", "mix", "recording", "derivative"].map((value) => `<option value="${value}" ${record.kind === value ? "selected" : ""}>${labelForKind(value)}</option>`).join("")}</select></label><label class="atlas-field">Confidence<select name="confidence">${["high", "medium", "recovery"].map((value) => `<option value="${value}" ${record.confidence === value ? "selected" : ""}>${confidenceLabel(value as Confidence)}</option>`).join("")}</select></label><label class="atlas-field">Genres<input name="genres" value="${escapeHtml(record.genres.join(", "))}"></label><label class="atlas-field">Themes<input name="themes" value="${escapeHtml(record.themes.join(", "))}"></label><label class="atlas-field">BPM<input name="bpm" type="number" min="1" max="300" value="${record.bpm ?? ""}"></label><label class="atlas-check"><input name="dance" type="checkbox" ${record.dance ? "checked" : ""}><span>Dance-oriented</span></label></div><button class="suite-button primary" type="submit">Save local annotation</button><output id="annotation-status"></output></form>`
  dialog.showModal()
  byId<HTMLFormElement>("annotation-form").addEventListener("submit", (event) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget as HTMLFormElement)
    const bpm = Number(data.get("bpm"))
    saveAnnotation(record.id, {
      kind: data.get("kind") as RecordKind,
      confidence: data.get("confidence") as Confidence,
      genres: String(data.get("genres") ?? "").split(",").map((item) => item.trim()).filter(Boolean),
      themes: String(data.get("themes") ?? "").split(",").map((item) => item.trim()).filter(Boolean),
      bpm: Number.isFinite(bpm) && bpm > 0 ? bpm : undefined,
      dance: data.get("dance") === "on",
    })
    byId<HTMLOutputElement>("annotation-status").textContent = "Saved locally. Filters and analytics updated."
    render()
  })
}

document.addEventListener("click", (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>("[data-id]")
  if (!target) return
  const record = visible.find((item) => item.id === target.dataset.id)
  if (record) openRecord(record)
})
;[search, language, year, kind, confidence, dance, reviewer].forEach((element) => element.addEventListener("input", render))
document.querySelectorAll<HTMLElement>("[data-query]").forEach((button) => button.addEventListener("click", () => { search.value = button.dataset.query ?? ""; dance.checked = true; render(); byId("explore").scrollIntoView({ behavior: "smooth" }) }))
byId("quick-query").addEventListener("click", () => { search.value = "Belarusian dance remix"; dance.checked = true; render(); byId("explore").scrollIntoView({ behavior: "smooth" }) })
byId("reset").addEventListener("click", () => { search.value = ""; language.value = ""; year.value = ""; kind.value = ""; confidence.value = ""; dance.checked = false; reviewer.checked = true; render() })
byId("dialog-close").addEventListener("click", () => dialog.close())
dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close() })
byId<HTMLInputElement>("passport-import").addEventListener("change", async (event) => {
  const input = event.currentTarget as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try { const count = importPassportJson(await file.text()); fillOptions(); render(); window.alert(`${count} passport record${count === 1 ? "" : "s"} imported into this browser.`) } catch { window.alert("That file is not a valid Archive Passport JSON export.") }
  input.value = ""
})
const exportRows = (): Record<string, unknown>[] => visible.map((item) => ({ ...item, exportScope: "visible Music Atlas result", exportedAt: new Date().toISOString() }))
byId("export-json").addEventListener("click", () => downloadText(JSON.stringify(exportRows(), null, 2), "application/json", "unmute-belarus-atlas-result.json"))
byId("export-csv").addEventListener("click", () => {
  const cell = (value: unknown): string => `"${String(value ?? "").replaceAll('"', '""')}"`
  const header = ["id", "title", "creator", "year", "language", "kind", "relationship", "genres", "themes", "dance", "confidence", "source_status", "evidence_url"]
  const rows = visible.map((item) => [item.id, item.title, item.creator, item.year, item.language, item.kind, item.relationship, item.genres.join("; "), item.themes.join("; "), item.dance, item.confidence, item.sourceStatus, item.evidenceUrl])
  downloadText([header, ...rows].map((row) => row.map(cell).join(",")).join("\n"), "text/csv;charset=utf-8", "unmute-belarus-atlas-result.csv")
})

fillOptions()
render()
