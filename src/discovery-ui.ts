import "./discovery.css"
import { renderAtlasLinks } from "./atlas-actions"
import { catalogSourceUrl, loadDiscoveryCatalog, type DiscoveryCatalog, type DiscoveryRecord } from "./discovery-data"
import { discoveryReasons as englishReasons, emptyIntent, matchesDiscovery, parseDiscoveryIntent, type DiscoveryIntent } from "./discovery-query"
import { downloadText } from "./suite-data"
import { escapeHtml as esc } from "./suite-shell"

type DiscoveryViewState = { catalog?: DiscoveryCatalog; intent: DiscoveryIntent; description: string; parsedDescription: string; shown: number; locale: boolean; wasBusy: boolean }
export function mountDiscovery(state?: DiscoveryViewState): void {
  const root = document.getElementById("external-discovery")
  if (!root) return
  const be = state?.locale ?? (new URLSearchParams(location.search).get("lang") === "be")
  const t = (en: string, translated: string): string => be ? translated : en
  const reasonText = (value: string): string => !be ? value : value
    .replace("Belarus association in source; not a claim about every song’s language", "Крыніца звязвае выканаўцу з Беларуссю; гэта не сцвярджэнне пра мову кожнай песні")
    .replace("Catalogued work associated with Belarus or the Belarusian language", "Твор у каталогу, звязаны з Беларуссю ці беларускай мовай")
    .replace("Artist genre in source:", "Стыль выканаўцы паводле крыніцы:").replace("Work genre in source:", "Стыль твора паводле крыніцы:")
    .replace("Recorded active period:", "Вядомы перыяд дзейнасці:").replace("Publication date in source:", "Дата публікацыі паводле крыніцы:")
    .replace("Work language in source:", "Мова твора паводле крыніцы:").replace("; verify the exact recording", "; праверце канкрэтны запіс")
    .replace("Name or description matches the text criterion", "Назва, імя ці апісанне адпавядае тэкставаму крытэрыю")
    .replace("open", "канец не пазначаны")
  const discoveryReasons = (record: DiscoveryRecord, intent: DiscoveryIntent): string[] => englishReasons(record, intent).map(reasonText)
  const options = (values: [string, string, string][]): string => values.map(([value, en, translated]) => `<option value="${value}">${t(en, translated)}</option>`).join("")
  root.innerHTML = `<div class="section-intro"><span class="suite-kicker">${t("External discovery · Live CC0 metadata", "Знешні пошук · Жывыя метаданыя CC0")}</span><h2>${t("Search the music catalog.", "Шукайце ў музычным каталогу.")}</h2><p>${t("Explore songs, albums and artists in Wikidata. These results are catalog entries, not listening links. The archive offers playback links only for verified recordings.", "Шукайце песні, альбомы і выканаўцаў у Wikidata. Вынікі — запісы каталога, а не спасылкі для праслухоўвання. Архіў дае такія спасылкі толькі для правераных аўдыязапісаў.")}</p></div>
  <form id="discovery-form" class="suite-panel discovery-form">
    <label class="atlas-field" for="discovery-description">${t("Your description · English, Беларуская, Русский", "Ваша апісанне · English, Беларуская, Русский")}<input id="discovery-description" type="search" maxlength="300" placeholder="${t("Belarusian folk · electronic albums from the 1990s · N.R.M.", "Беларускі фолк · электронныя альбомы 90-х · N.R.M.")}"></label>
    <div class="discovery-examples">${[["Belarusian folk", "Беларускі фолк"], ["electronic music 1990s", "Электронная музыка 90-х"], ["N.R.M.", "N.R.M."], ["albums in Belarusian", "Альбомы на беларускай мове"]].map(([query, label]) => `<button type="button" data-discovery-example="${esc(query)}">${be ? label : query}</button>`).join("")}</div>
    <details id="discovery-criteria"><summary>${t("Edit how the description is interpreted", "Удакладніць, як зразуметы запыт")}</summary><p class="atlas-note">${t("A transparent vocabulary maps familiar terms to these editable criteria. Unrecognized words remain a name/description search. No AI-generated facts are added.", "Зразумелы слоўнік пераўтварае вядомыя словы ў гэтыя крытэрыі. Незнаёмыя словы застаюцца пошукам па назве і апісанні. Факты, згенераваныя ІІ, не дадаюцца.")}</p>
      <div class="discovery-grid">
        <label class="atlas-field">${t("Artist, title or context", "Выканаўца, назва ці кантэкст")}<input id="discovery-text" maxlength="200"></label>
        <label class="atlas-field">${t("Style · as recorded by source", "Стыль · паводле крыніцы")}<select id="discovery-genre">${options([["", "Any documented style", "Любы вядомы стыль"], ["folk", "Folk / traditional", "Фолк / традыцыйная"], ["electronic", "Electronic / synth / techno / house", "Электронная / сінт / тэхна / хаус"], ["rock", "Rock", "Рок"], ["pop", "Pop", "Поп"], ["jazz", "Jazz", "Джаз"], ["classical", "Classical", "Класічная"], ["hip hop", "Hip hop", "Хіп-хоп"], ["metal", "Metal", "Метал"], ["ambient", "Ambient", "Эмбіент"], ["reggae", "Reggae", "Рэгі"]])}</select></label>
        <label class="atlas-field">${t("Format", "Фармат")}<select id="discovery-format">${options([["", "Works and artists", "Творы і выканаўцы"], ["song", "Songs / singles", "Песні / сінглы"], ["album", "Albums", "Альбомы"], ["artist", "Artists / groups", "Выканаўцы / гурты"], ["other", "Other catalogued works", "Іншыя творы каталога"]])}</select></label>
        <label class="atlas-field">${t("Work language · not artist nationality", "Мова твора · не паходжанне выканаўцы")}<select id="discovery-language">${options([["", "Any / not recorded", "Любая / невядомая"], ["Belarusian", "Belarusian documented", "Беларуская пазначана"], ["Russian", "Russian documented", "Руская пазначана"], ["English", "English documented", "Англійская пазначана"]])}</select></label>
        <label class="atlas-field">${t("From year", "З года")}<input id="discovery-from" type="number" min="1800" max="2100" placeholder="1990"></label>
        <label class="atlas-field">${t("Through year", "Да года")}<input id="discovery-to" type="number" min="1800" max="2100" placeholder="1999"></label>
        <label class="atlas-field">${t("Mood · noted, not applied as fact", "Настрой · пажаданне, не фактычны фільтр")}<select id="discovery-mood">${options([["", "No preference", "Без пажадання"], ["calm", "Calm", "Спакойны"], ["sad", "Sad / melancholic", "Сумны / меланхалічны"], ["energetic", "Energetic", "Энергічны"], ["joyful", "Joyful", "Радасны"], ["dark", "Dark", "Змрочны"]])}</select></label>
      </div><button type="button" class="suite-button" id="discovery-reparse">${t("Re-apply description", "Зноў разабраць апісанне")}</button>
    </details>
    <p id="discovery-interpretation" class="atlas-note" aria-live="polite"></p>
    <div class="suite-actions"><button id="discovery-submit" class="suite-button primary" type="submit">${t("Search the public catalog", "Шукаць у публічным каталогу")}</button><button class="suite-button" id="discovery-clear" type="button">${t("Clear criteria", "Скінуць крытэрыі")}</button><button class="suite-button" id="discovery-refresh" type="button" hidden>${t("Refresh source", "Абнавіць крыніцу")}</button></div>
    <p class="atlas-note discovery-privacy">${t("Loads public metadata from Wikidata only when you search. Your description is matched in this browser; no audio, passports or personal files are sent. Metadata is CC0; recordings keep their own rights.", "Публічныя метаданыя з Wikidata загружаюцца толькі пасля пошуку. Апісанне параўноўваецца ў браўзеры; аўдыя, пашпарты і асабістыя файлы не адпраўляюцца. Метаданыя — CC0, правы на запісы захоўваюцца.")}</p>
  </form>
  <div id="discovery-status" class="query-explanation" role="status" aria-live="polite">${t("Ready to search beyond the curated corpus.", "Можна шукаць па-за падрыхтаванай бібліятэкай.")}</div>
  <div id="discovery-results"></div>
  <div class="suite-actions"><button class="suite-button" id="discovery-more" hidden>${t("Show more results", "Паказаць яшчэ")}</button><button class="suite-button" id="discovery-export" hidden>${t("Export these source records", "Экспартаваць вынікі з крыніцамі")}</button></div>
  <details class="discovery-method"><summary>${t("Coverage, sources and reproducibility", "Ахоп, крыніцы і паўтаральнасць")}</summary><p>${t("Wikidata is community-maintained and incomplete. The catalog includes works with a Belarusian-language statement and performer, and works/artists connected to Belarus by country/citizenship with a MusicBrainz artist identifier. Diaspora or lesser-documented work may be missing. Styles and dates are only the source’s statements; album language may not describe every track. An artist result is not a recording.", "Wikidata падтрымліваецца супольнасцю і мае прабелы. Каталог змяшчае творы з пазначанай беларускай мовай і выканаўцам, а таксама творы і выканаўцаў, звязаных з Беларуссю праз краіну ці грамадзянства і ідэнтыфікатар MusicBrainz. Дыяспара і маладакументаваныя творы могуць адсутнічаць. Стылі і даты — сцвярджэнні крыніцы; мова альбома не абавязкова датычыцца кожнага трэка. Вынік-выканаўца — не аўдыязапіс.")}</p><p>${t("No mood, quality or similarity is inferred from a genre. A date filter uses publication dates for works and documented active periods for artists. Refresh is manual; the current page caches metadata for 30 minutes. Live source failures do not affect your local passports.", "Настрой, якасць і падабенства не выводзяцца са стылю. Фільтр дат выкарыстоўвае публікацыю твораў і вядомыя перыяды дзейнасці выканаўцаў. Абнаўленне ручное; старонка захоўвае метаданыя на 30 хвілін. Памылкі знешняй крыніцы не ўплываюць на лакальныя пашпарты.")}</p><div id="discovery-source-links"></div><p><a href="https://www.wikidata.org/wiki/Wikidata:Licensing" target="_blank" rel="noopener">Wikidata · CC0 ↗</a></p></details>`
  const el = <T extends HTMLElement>(id: string): T => root.querySelector<T>(`#discovery-${id}`)!
  el<HTMLSelectElement>("format").insertAdjacentHTML("beforeend", `<option value="works">${t("Works only · exclude artist leads", "Толькі творы · без выканаўцаў")}</option>`)
  el<HTMLSelectElement>("genre").insertAdjacentHTML("beforeend", `<option value="punk">${t("Punk", "Панк")}</option><option value="post-punk">${t("Post-punk", "Постпанк")}</option>`)
  const fields = ["text", "genre", "mood", "format", "language", "from", "to"] as const
  const read = (): DiscoveryIntent => Object.fromEntries(fields.map((key) => [key, el<HTMLInputElement>(key).value])) as DiscoveryIntent
  const fill = (intent: DiscoveryIntent): void => fields.forEach((key) => { el<HTMLInputElement>(key).value = intent[key] })
  let catalog = state?.catalog, visible: DiscoveryRecord[] = [], shown = state?.shown ?? 30, busy = false, parsedDescription = state?.parsedDescription ?? ""
  const describe = (): void => {
    const i = read()
    el("interpretation").textContent = [t("Belarus-related catalog; no nationality-to-language inference.", "Каталог, звязаны з Беларуссю; паходжанне не вызначае мову."),
      i.text ? `${t("Text", "Тэкст")}: ${i.text}.` : "", i.genre ? `${t("Style", "Стыль")}: ${i.genre}.` : "", i.format ? `${t("Format", "Фармат")}: ${i.format}.` : "",
      i.language ? `${t("Documented work language", "Пазначаная мова твора")}: ${i.language}.` : "", i.from || i.to ? `${i.from || "…"}–${i.to || "…"}.` : "",
      i.mood ? t(`Mood “${i.mood}” is NOT used to filter or claim a match: source audio/context review is still needed.`, `Настрой «${i.mood}» НЕ фільтруе вынікі і не лічыцца супадзеннем: трэба паслухаць аўдыя ці праверыць кантэкст.`) : ""].filter(Boolean).join(" ")
  }
  const render = (): void => {
    describe()
    if (!catalog) return
    const intent = read()
    if (intent.from && intent.to && Number(intent.from) > Number(intent.to)) { el("status").textContent = t("The start year must not be later than the end year.", "Пачатковы год не можа быць пазнейшым за канчатковы."); el("results").innerHTML = ""; visible = []; el<HTMLButtonElement>("more").hidden = true; el<HTMLButtonElement>("export").hidden = true; return }
    visible = catalog.records.filter((record) => matchesDiscovery(record, intent)).sort((a, b) => Number(a.kind === "artist") - Number(b.kind === "artist") || a.title.localeCompare(b.title))
    const works = visible.filter((record) => record.kind !== "artist").length
    el("status").textContent = t(`${visible.length} matches: ${works} works + ${visible.length - works} artist leads, from ${catalog.records.length} live source records. Retrieved ${new Date(catalog.retrievedAt).toLocaleString()}.${catalog.truncated ? " Source row limit reached; results are partial." : " This is the source’s coverage, not all Belarusian music."}`, `${visible.length} вынікаў: ${works} твораў + ${visible.length - works} выканаўцаў, з ${catalog.records.length} запісаў крыніцы. Атрымана ${new Date(catalog.retrievedAt).toLocaleString()}.${catalog.truncated ? " Дасягнута мяжа крыніцы; вынікі няпоўныя." : " Гэта ахоп крыніцы, а не ўся беларуская музыка."}`)
    el("results").innerHTML = visible.length ? `<div class="discovery-list">${visible.slice(0, shown).map((record) => `<article class="suite-panel discovery-card"><div class="record-tags"><span>${record.kind === "artist" ? t("Related artist · not a recording", "Выканаўца · не аўдыязапіс") : esc(record.types.join(" / ") || record.kind)}</span><span>Wikidata · CC0</span></div><h3>${esc(record.title)}</h3><p>${esc(record.creator)}${record.years.length ? ` · ${record.years.join(", ")}` : ""}</p><p>${esc(record.description)}</p><dl><div><dt>${t("Style in source", "Стыль крыніцы")}</dt><dd>${esc(record.genres.join(", ") || t("Not recorded", "Не пазначаны"))}</dd></div><div><dt>${t("Work language", "Мова твора")}</dt><dd>${record.kind === "artist" ? t("Not applicable; check individual works", "Правярайце асобныя творы") : esc(record.languages.join(", ") || t("Unknown — not inferred from artist", "Невядомая — не вызначаецца па выканаўцы"))}</dd></div></dl><details><summary>${t("Why this appeared", "Чаму гэты вынік")}</summary><ul>${discoveryReasons(record, intent).map((reason) => `<li>${esc(reason)}</li>`).join("")}</ul></details>${renderAtlasLinks({ source: record.source }, be)}${record.musicbrainz || record.kind === "artist" ? `<div class="suite-actions compact">${record.musicbrainz ? `<a class="suite-button" href="${record.musicbrainz}" target="_blank" rel="noopener noreferrer">MusicBrainz ↗</a>` : ""}${record.kind === "artist" ? `<button class="suite-button" data-discovery-artist="${esc(record.title)}">${t("Find catalogued works", "Знайсці творы ў каталогу")}</button>` : ""}</div>` : ""}</article>`).join("")}</div>` : `<div class="suite-panel suite-empty"><h3>${t("No documented match in this source.", "У гэтай крыніцы няма дакументаванага супадзення.")}</h3><p>${t("This does not mean the music does not exist. Remove one criterion, try an artist’s other spelling, or search artist leads when work metadata is missing. Mood is never silently converted into a genre.", "Гэта не азначае, што музыкі не існуе. Прыбярыце адзін крытэрый, паспрабуйце іншае напісанне імя ці шукайце выканаўцаў, калі метаданых твора няма. Настрой не падмяняецца стылем.")}</p><button class="suite-button" type="button" id="discovery-broaden">${t("Keep the text, remove other filters", "Пакінуць тэкст, прыбраць іншыя фільтры")}</button></div>`
    el<HTMLButtonElement>("more").hidden = visible.length <= shown
    el<HTMLButtonElement>("export").hidden = !visible.length
    el<HTMLButtonElement>("refresh").hidden = false
    el("source-links").innerHTML = catalog.queries.map((query, index) => `<p><a href="${catalogSourceUrl(query)}" target="_blank" rel="noopener">${index ? t("Reproduce artist retrieval", "Паўтарыць пошук выканаўцаў") : t("Reproduce work retrieval", "Паўтарыць пошук твораў")} ↗</a></p>`).join("")
  }
  const parse = (): void => { parsedDescription = el<HTMLInputElement>("description").value; fill(parseDiscoveryIntent(parsedDescription)); shown = 30; render(); describe() }
  const run = async (refresh = false): Promise<void> => {
    if (busy) return
    if (el<HTMLInputElement>("description").value !== parsedDescription) parse()
    const intent = read()
    if (intent.from && intent.to && Number(intent.from) > Number(intent.to)) { el("status").textContent = t("The start year must not be later than the end year.", "Пачатковы год не можа быць пазнейшым за канчатковы."); return }
    busy = true; el<HTMLButtonElement>("submit").disabled = true; el<HTMLButtonElement>("refresh").disabled = true
    el("status").textContent = t("Reading the public catalog… Two requests, made one after another. Your local archive is untouched.", "Чытаем публічны каталог… Два паслядоўныя запыты. Лакальны архіў не змяняецца.")
    try { catalog = await loadDiscoveryCatalog(refresh); shown = 30; render() }
    catch (error) { el("status").innerHTML = `<strong>${t("The live source could not be loaded.", "Не ўдалося загрузіць жывую крыніцу.")}</strong> ${esc(error instanceof Error ? error.message : "Network error")} ${t("Your local passports are safe. Use Search again to retry.", "Лакальныя пашпарты ў бяспецы. Націсніце пошук, каб паўтарыць.")}` }
    finally { busy = false; el<HTMLButtonElement>("submit").disabled = false; el<HTMLButtonElement>("refresh").disabled = false }
  }
  el<HTMLFormElement>("form").addEventListener("submit", (event) => { event.preventDefault(); void run() })
  el("reparse").addEventListener("click", parse)
  fields.forEach((field) => el(field).addEventListener("input", () => { shown = 30; render(); describe() }))
  el("clear").addEventListener("click", () => { el<HTMLInputElement>("description").value = ""; parsedDescription = ""; fill(emptyIntent()); shown = 30; render(); describe() })
  el("refresh").addEventListener("click", () => { void run(true) })
  el("more").addEventListener("click", () => { shown += 30; render() })
  el("export").addEventListener("click", () => downloadText(JSON.stringify({ provider: "Wikidata", license: "CC0", scope: "external metadata discovery, not verified archival passports", retrievedAt: catalog?.retrievedAt, exportedAt: new Date().toISOString(), description: parsedDescription, criteria: read(), unsupportedCriteria: read().mood ? ["mood"] : [], sourceQueries: catalog?.queries, records: visible }, null, 2), "application/json", "unmute-external-discovery.json"))
  root.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-discovery-example],[data-discovery-artist],#discovery-broaden")
    if (!target) return
    if (target.dataset.discoveryExample !== undefined) { el<HTMLInputElement>("description").value = target.dataset.discoveryExample; parse(); void run() }
    else if (target.dataset.discoveryArtist !== undefined) { const intent = emptyIntent(); intent.text = target.dataset.discoveryArtist; intent.format = "works"; fill(intent); el<HTMLInputElement>("description").value = intent.text; parsedDescription = intent.text; shown = 30; render(); root.scrollIntoView({ behavior: "smooth" }) }
    else { const intent = emptyIntent(); intent.text = read().text; fill(intent); render() }
  })
  const initial = new URLSearchParams(location.search).get("discover")
  if (state) { el<HTMLInputElement>("description").value = state.description; fill(state.intent); render(); if (state.wasBusy) void run() }
  else if (initial) { el<HTMLInputElement>("description").value = initial; parse() }
  describe()
  // The site's language control uses history.pushState, not a page reload.
  // Rebuild only this component; preserve the live catalog and user's edits.
  const localeObserver = new MutationObserver(() => {
    const next = document.documentElement.lang === "be"
    if (next === be) return
    localeObserver.disconnect()
    const saved: DiscoveryViewState = { catalog, intent: read(), description: el<HTMLInputElement>("description").value, parsedDescription, shown, locale: next, wasBusy: busy }
    root.replaceWith(root.cloneNode(false)) // old listeners remain on the detached root only
    mountDiscovery(saved)
  })
  localeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] })
}
