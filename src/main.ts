import { audiotool, type AuthenticatedClient } from "@audiotool/nexus"
import { makeDemoClip } from "./demo-audio"
import {
  corpusStats,
  exportCorpusCsv,
  exportCorpusJson,
  readCorpus,
  saveToCorpus,
  updateInCorpus,
} from "./corpus"
import {
  addDerivative,
  buildManifest,
  citationFor,
  downloadManifest,
  formatBytes,
  sha256,
  shortFingerprint,
  type ArchiveManifest,
} from "./manifest"
import { pilotItems } from "./pilot"
import "./style.css"

const clientId = import.meta.env.VITE_AUDIOTOOL_CLIENT_ID?.trim() ?? ""
const redirectUrl = import.meta.env.DEV
  ? "http://127.0.0.1:5173/"
  : new URL("./", window.location.href).toString().split("?")[0]

const escapeHtml = (value: string): string => value.replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
  '"': "&quot;",
})[character]!)

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <header class="site-header" id="top">
    <nav class="nav shell" aria-label="Primary navigation">
      <a class="brand" href="#top" aria-label="Unmute the Archive home">
        <span class="brand-mark" aria-hidden="true">U/A</span>
        <span>Unmute the Archive</span>
      </a>
      <div class="nav-links">
        <a href="#create">Passport</a>
        <a href="#verify">Verify</a>
        <a href="#derivative">Derivative</a>
        <a href="#corpus">Corpus</a>
        <a href="#pilot">Pilot</a>
      </div>
      <a class="system-link" href="/research/system/">Unmute Belarus system ↗</a>
    </nav>
  </header>

  <main>
    <section class="hero shell">
      <div class="hero-copy">
        <p class="eyebrow">Live module · Unmute Belarus research system</p>
        <h1>Prove a recording’s story. Preserve its future.</h1>
        <p class="lede">Create a human-readable archival passport, check that a file is byte-for-byte unchanged, and build a structured research corpus. Sharing to Audiotool is optional.</p>
        <div class="hero-actions">
          <a class="button primary" href="#create">Start a passport</a>
          <a class="button outline" href="#verify">Verify a recording</a>
        </div>
        <p class="privacy-note"><span aria-hidden="true">⌾</span> Audio stays on this device unless you explicitly transfer it.</p>
      </div>

      <div class="hero-steps" aria-label="Three-step workflow">
        <p class="eyebrow">Three clear steps</p>
        <ol>
          <li><span>1</span><div><strong>Passport</strong><p>Add a file and describe its origin, context, and rights.</p></div></li>
          <li><span>2</span><div><strong>Verify</strong><p>Re-select a file later to prove it matches, byte for byte.</p></div></li>
          <li><span>3</span><div><strong>Share <em>optional</em></strong><p>Send an unlisted sample to Audiotool and keep the receipt.</p></div></li>
        </ol>
      </div>

      <article class="passport-preview" aria-label="Example archival passport">
        <div class="passport-top"><span>Example receipt</span><strong>No. UTA-DEMO</strong></div>
        <p class="passport-kicker">Archival Passport</p>
        <div class="preview-recording">
          <div><small>Recording</small><strong>Safe synthetic demo</strong></div>
          <div class="mini-wave" aria-hidden="true">${Array.from({ length: 32 }, (_, index) => `<i style="--h:${22 + ((index * 31) % 72)}%"></i>`).join("")}</div>
        </div>
        <dl>
          <div><dt>Provenance</dt><dd>Browser-generated · rights-clear</dd></div>
          <div><dt>Integrity fingerprint</dt><dd>Calculated from every byte of the file</dd></div>
          <div><dt>Research use</dt><dd>Citation + JSON/CSV corpus record</dd></div>
        </dl>
        <p class="stamp">VERIFIABLE<br />NOT BLOCKCHAIN</p>
      </article>
    </section>

    <section class="value-strip shell" aria-label="What the tool produces">
      <article><span>01</span><div><strong>Readable passport</strong><p>One record for origin, rights, context, file identity, and reuse history.</p></div></article>
      <article><span>02</span><div><strong>Integrity check</strong><p>The same bytes produce the same SHA-256 fingerprint. A changed file does not.</p></div></article>
      <article><span>03</span><div><strong>Research-ready corpus</strong><p>Local records export as JSON for preservation and CSV for analysis.</p></div></article>
    </section>

    <section class="tool-section shell" id="create">
      <div class="section-heading">
        <p class="eyebrow">01 · Create a passport</p>
        <h2>Document what is known. Never invent what is missing.</h2>
        <p>A source file creates a fingerprinted passport. If the master is lost, create a recovery record with public evidence instead—without pretending the audio was verified.</p>
      </div>

      <div class="create-grid">
        <form class="archive-form panel" id="passport-form">
          <fieldset class="mode-picker">
            <legend>What do you have?</legend>
            <label><input type="radio" name="source-mode" value="present" checked /><span><strong>I have the audio file</strong><small>Create an integrity fingerprint.</small></span></label>
            <label><input type="radio" name="source-mode" value="missing" /><span><strong>The source is missing</strong><small>Document a recovery lead.</small></span></label>
          </fieldset>

          <div class="field-grid">
            <label>Title<input id="title" required placeholder="Recording title" /></label>
            <label>Creator / contributor<input id="creator" required placeholder="Person or community" /></label>
            <label>Language<input id="language" required placeholder="Belarusian" /></label>
            <label>Place<input id="place" required placeholder="Minsk / Los Angeles" /></label>
            <label>Date recorded or released<input id="recorded-on" type="date" /></label>
            <label>Collection<input id="collection" required value="Belarusian Music in Exile — Pilot Corpus" /></label>
          </div>

          <label>Why this recording matters<textarea id="context" required rows="4" placeholder="Cultural context, circumstances, people, and what a future researcher should know."></textarea></label>
          <label>Rights / consent basis<textarea id="rights" required rows="3" placeholder="I created this recording and control the source file, or I have explicit permission…"></textarea></label>
          <label>Public evidence or recovery lead <span class="optional">optional</span><input id="evidence-url" type="url" placeholder="https://…" /></label>

          <div id="source-file-fields">
            <label class="dropzone" for="audio-file">
              <input id="audio-file" type="file" accept="audio/*" />
              <span class="drop-icon" aria-hidden="true">↗</span>
              <strong id="file-label">Choose an audio file</strong>
              <small id="file-meta">WAV, MP3, M4A, FLAC, or another audio format</small>
            </label>
            <audio id="audio-preview" controls hidden></audio>
            <label class="check-row"><input id="rights-check" type="checkbox" /><span>I control this file or have explicit permission to preserve it.</span></label>
          </div>

          <div class="form-actions">
            <button class="button primary" id="create-button" type="submit">Create archival passport</button>
            <button class="button quiet" id="load-demo" type="button">Load safe demo</button>
          </div>
          <p class="form-message" id="form-message" role="status"></p>
        </form>

        <aside class="receipt-panel panel" id="live-receipt" aria-live="polite">
          <div class="empty-receipt">
            <p class="eyebrow">Your result</p>
            <h3>A passport appears here.</h3>
            <p>It will be useful without Audiotool: saved locally, independently verifiable, citable, and exportable.</p>
          </div>
        </aside>
      </div>

      <section class="audiotool-panel panel" id="audiotool-transfer">
        <div>
          <p class="eyebrow">Optional creative handoff</p>
          <h3>Place a fingerprinted source in an Audiotool session.</h3>
          <p id="auth-copy">The archival passport works independently. Audiotool transfer is an additional traceable reuse event.</p>
        </div>
        <div class="transfer-controls">
          <button class="button outline" id="auth-button" type="button">Connect Audiotool</button>
          <select id="project" disabled aria-label="Audiotool project"><option value="">Choose a destination project</option></select>
          <button class="button secondary" id="transfer-button" type="button" disabled>Insert unlisted sample</button>
        </div>
      </section>
    </section>

    <section class="tool-section derivative-section" id="derivative">
      <div class="shell derivative-grid">
        <div class="section-heading compact">
          <p class="eyebrow">02 · Document a derivative</p>
          <h2>Preserve the master. Register every intervention.</h2>
          <p>This tool does not restore audio automatically. It links an edited or restored copy to an untouched fingerprinted master and records what changed, why, and who reviewed it.</p>
          <ul class="derivative-rules">
            <li><strong>Master stays untouched.</strong><span>The derivative receives its own fingerprint.</span></li>
            <li><strong>Methods stay visible.</strong><span>Noise removal, EQ, repair, separation, or AI processing must be named.</span></li>
            <li><strong>Listening judgment stays human.</strong><span>A cleaner waveform is not automatically a more authentic record.</span></li>
          </ul>
        </div>
        <form class="derivative-form panel" id="derivative-form">
          <label>Source master passport<select id="derivative-passport" required><option value="">No fingerprinted passports yet</option></select></label>
          <label class="dropzone" for="derivative-file">
            <input id="derivative-file" type="file" accept="audio/*" />
            <span class="drop-icon" aria-hidden="true">↗</span>
            <strong id="derivative-file-label">Choose the derived audio file</strong>
            <small>The original master is never replaced.</small>
          </label>
          <div class="field-grid">
            <label>Derivative label<input id="derivative-label" required placeholder="Restoration test A" /></label>
            <label>Purpose<input id="derivative-purpose" required placeholder="Listening access / research comparison" /></label>
          </div>
          <label>Method and tools<textarea id="derivative-method" required rows="3" placeholder="Software, model, version, and settings if known."></textarea></label>
          <label>Intervention log<textarea id="derivative-changes" required rows="3" placeholder="What was removed, repaired, separated, equalized, or otherwise changed?"></textarea></label>
          <label>Human review note <span class="optional">optional</span><textarea id="derivative-review" rows="2" placeholder="What was preserved, and what artifacts or uncertainty remain?"></textarea></label>
          <label class="check-row"><input id="derivative-master-check" type="checkbox" required /><span>I confirm that this file is a derivative and does not replace the preserved master.</span></label>
          <button class="button primary full" id="derivative-button" type="submit">Register documented derivative</button>
          <p class="form-message" id="derivative-message" role="status"></p>
        </form>
      </div>
    </section>

    <section class="tool-section inverse" id="verify">
      <div class="shell verify-grid">
        <div class="section-heading compact">
          <p class="eyebrow">03 · Verify a recording</p>
          <h2>Is this exactly the file in the passport?</h2>
          <p>A fingerprint is not a token and does not establish authorship. It is a repeatable identity check: every byte must match the earlier receipt.</p>
        </div>
        <div class="verify-card panel-dark">
          <label>Choose a passport from this device<select id="verify-passport"><option value="">No fingerprinted passports yet</option></select></label>
          <div class="or-divider"><span>or</span></div>
          <label class="compact-upload" for="receipt-file"><input id="receipt-file" type="file" accept="application/json,.json" /><span>Import a portable passport JSON</span></label>
          <button class="text-button demo-verify" id="verify-demo" type="button">Use the safe synthetic demo file</button>
          <p class="target-note" id="verify-target">No passport selected.</p>
          <label class="dropzone dark-drop" for="verify-file">
            <input id="verify-file" type="file" accept="audio/*" />
            <span class="drop-icon" aria-hidden="true">⌾</span>
            <strong id="verify-file-label">Choose the audio file to check</strong>
            <small>Nothing uploads. Comparison happens on this device.</small>
          </label>
          <button class="button primary full" id="verify-button" type="button" disabled>Compare every byte</button>
          <div class="verify-result" id="verify-result" hidden></div>
        </div>
      </div>
    </section>

    <section class="tool-section shell" id="corpus">
      <div class="section-heading row-heading">
        <div>
          <p class="eyebrow">04 · Your local corpus</p>
          <h2>Structured evidence, not a folder of mystery files.</h2>
        </div>
        <div class="export-actions">
          <button class="button quiet" id="export-json" type="button">Export JSON</button>
          <button class="button quiet" id="export-csv" type="button">Export CSV</button>
        </div>
      </div>
      <div class="stats-grid" id="corpus-stats"></div>
      <div class="corpus-list panel" id="corpus-list"></div>
    </section>

    <section class="pilot-section" id="pilot">
      <div class="shell pilot-grid">
        <div class="pilot-intro">
          <p class="eyebrow">First-party pilot corpus</p>
          <h2>Belarusian Music in Exile</h2>
          <p>Sergéy Ulyanov’s own Belarusian-language works form the bounded starting collection. Authorship, rights, and cultural context are known. Public evidence is recorded as a recovery lead; only an available source file receives a fingerprint.</p>
          <div class="pilot-badges"><span>Creator-known</span><span>Rights-known</span><span>Source status explicit</span></div>
        </div>
        <div class="pilot-timeline">
          ${pilotItems.map((item) => `
            <article>
              <span>${item.year}</span>
              <div><h3>${item.title}</h3><p>${item.note}</p><a href="${item.evidence}" target="_blank" rel="noreferrer">${item.evidenceLabel} ↗</a></div>
            </article>
          `).join("")}
        </div>
      </div>
    </section>

    <section class="limitations shell" id="limitations">
      <div><p class="eyebrow">Honest limitations</p><h2>What this tool proves—and what it does not.</h2></div>
      <ul>
        <li><strong>It proves file identity.</strong><span>A matching fingerprint shows that two files contain the same bytes.</span></li>
        <li><strong>It documents derivatives.</strong><span>A registered restoration stays linked to the untouched master with a separate fingerprint and intervention log.</span></li>
        <li><strong>It does not prove authorship.</strong><span>Rights, dates, people, and context still require evidence and human judgment.</span></li>
        <li><strong>It does not yet identify the same recording across formats.</strong><span>Perceptual fingerprinting and work/recording/release relationships belong to the planned Music Atlas layer.</span></li>
        <li><strong>Local storage is not a backup.</strong><span>Export the corpus and keep copies in more than one trusted place.</span></li>
        <li><strong>Missing sources stay marked missing.</strong><span>A public link can guide recovery, but it cannot replace a fingerprinted master.</span></li>
      </ul>
    </section>
  </main>

  <footer class="footer shell">
    <p>Designed and built by Sergéy Ulyanov · <a href="/research/system/">Unmute Belarus research system</a></p>
    <p>Live research prototype · local-first · no blockchain claims</p>
  </footer>
`

const form = document.querySelector<HTMLFormElement>("#passport-form")!
const sourceModes = [...document.querySelectorAll<HTMLInputElement>('input[name="source-mode"]')]
const fileInput = document.querySelector<HTMLInputElement>("#audio-file")!
const fileLabel = document.querySelector<HTMLElement>("#file-label")!
const fileMeta = document.querySelector<HTMLElement>("#file-meta")!
const audioPreview = document.querySelector<HTMLAudioElement>("#audio-preview")!
const rightsCheck = document.querySelector<HTMLInputElement>("#rights-check")!
const sourceFields = document.querySelector<HTMLElement>("#source-file-fields")!
const formMessage = document.querySelector<HTMLElement>("#form-message")!
const createButton = document.querySelector<HTMLButtonElement>("#create-button")!
const liveReceipt = document.querySelector<HTMLElement>("#live-receipt")!
const authButton = document.querySelector<HTMLButtonElement>("#auth-button")!
const authCopy = document.querySelector<HTMLElement>("#auth-copy")!
const projectSelect = document.querySelector<HTMLSelectElement>("#project")!
const transferButton = document.querySelector<HTMLButtonElement>("#transfer-button")!
const verifyPassport = document.querySelector<HTMLSelectElement>("#verify-passport")!
const receiptFile = document.querySelector<HTMLInputElement>("#receipt-file")!
const verifyFile = document.querySelector<HTMLInputElement>("#verify-file")!
const verifyFileLabel = document.querySelector<HTMLElement>("#verify-file-label")!
const verifyTargetNote = document.querySelector<HTMLElement>("#verify-target")!
const verifyButton = document.querySelector<HTMLButtonElement>("#verify-button")!
const verifyResult = document.querySelector<HTMLElement>("#verify-result")!
const derivativeForm = document.querySelector<HTMLFormElement>("#derivative-form")!
const derivativePassport = document.querySelector<HTMLSelectElement>("#derivative-passport")!
const derivativeFileInput = document.querySelector<HTMLInputElement>("#derivative-file")!
const derivativeFileLabel = document.querySelector<HTMLElement>("#derivative-file-label")!
const derivativeButton = document.querySelector<HTMLButtonElement>("#derivative-button")!
const derivativeMessage = document.querySelector<HTMLElement>("#derivative-message")!

let selectedFile: File | null = null
let verificationFile: File | null = null
let verificationTarget: ArchiveManifest | null = null
let derivativeFile: File | null = null
let currentManifest: ArchiveManifest | null = null
let corpus = readCorpus()
let client: AuthenticatedClient | null = null

const currentMode = (): "present" | "missing" =>
  sourceModes.find((input) => input.checked)?.value === "missing" ? "missing" : "present"

const getInput = (selector: string): HTMLInputElement => document.querySelector<HTMLInputElement>(selector)!
const getTextArea = (selector: string): HTMLTextAreaElement => document.querySelector<HTMLTextAreaElement>(selector)!

const renderReceipt = (manifest: ArchiveManifest): void => {
  const sourceLine = manifest.source
    ? `${escapeHtml(manifest.source.filename)} · ${formatBytes(manifest.source.bytes)}`
    : "Original source missing · recovery record only"
  const statusLabel = manifest.status === "fingerprinted" ? "Fingerprint created" : "Recovery lead"
  const derivativeRows = (manifest.derivatives ?? []).map((derivative) => `
    <li><strong>${escapeHtml(derivative.label)}</strong><span>${escapeHtml(derivative.purpose)} · ${escapeHtml(derivative.source.filename)}</span></li>
  `).join("")

  liveReceipt.innerHTML = `
    <div class="receipt-head"><span>Archival Passport</span><strong>${statusLabel}</strong></div>
    <h3>${escapeHtml(manifest.title)}</h3>
    <p class="receipt-id">No. ${escapeHtml(manifest.archiveId)}</p>
    <dl class="receipt-data">
      <div><dt>Creator</dt><dd>${escapeHtml(manifest.creator)}</dd></div>
      <div><dt>Language / place</dt><dd>${escapeHtml(manifest.language)} · ${escapeHtml(manifest.place)}</dd></div>
      <div><dt>Recorded / released</dt><dd>${escapeHtml(manifest.recordedOn || "Not yet established")}</dd></div>
      <div><dt>Source</dt><dd>${sourceLine}</dd></div>
      <div class="full-row"><dt>Integrity fingerprint</dt><dd class="mono">${escapeHtml(shortFingerprint(manifest))}</dd></div>
    </dl>
    <div class="citation-box"><span>Research citation</span><p>${escapeHtml(citationFor(manifest))}</p></div>
    ${derivativeRows ? `<div class="derivative-receipts"><span>Documented derivatives</span><ul>${derivativeRows}</ul></div>` : ""}
    <div class="receipt-actions">
      <button class="button quiet" id="download-passport" type="button">Download JSON</button>
      <button class="button quiet" id="copy-citation" type="button">Copy citation</button>
    </div>
    <p class="receipt-foot">Saved only in this browser. Export it to create a real backup.</p>
  `
  document.querySelector<HTMLButtonElement>("#download-passport")!.addEventListener("click", () => downloadManifest(manifest))
  document.querySelector<HTMLButtonElement>("#copy-citation")!.addEventListener("click", async (event) => {
    await navigator.clipboard.writeText(citationFor(manifest))
    ;(event.currentTarget as HTMLButtonElement).textContent = "Citation copied"
  })
}

const renderCorpus = (): void => {
  const stats = corpusStats(corpus)
  document.querySelector<HTMLElement>("#corpus-stats")!.innerHTML = `
    <article><strong>${stats.recordings}</strong><span>local records</span></article>
    <article><strong>${stats.fingerprinted}</strong><span>fingerprinted sources</span></article>
    <article><strong>${stats.recoveryLeads}</strong><span>recovery leads</span></article>
    <article><strong>${stats.languages}</strong><span>languages</span></article>
    <article><strong>${stats.dateSpan}</strong><span>date span</span></article>
  `

  const list = document.querySelector<HTMLElement>("#corpus-list")!
  list.innerHTML = corpus.length
    ? `<div class="corpus-table" role="table">
        <div class="corpus-row corpus-header" role="row"><span>Recording</span><span>Language</span><span>Source status</span><span>Passport</span></div>
        ${corpus.map((item) => `
          <div class="corpus-row" role="row">
            <span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.creator)} · ${escapeHtml(item.recordedOn || "date unknown")}</small></span>
            <span>${escapeHtml(item.language)}</span>
            <span class="status-chip ${item.status}">${item.status === "fingerprinted" ? "Verified source" : "Recovery lead"}</span>
            <span><button class="text-button view-passport" data-id="${escapeHtml(item.archiveId)}" type="button">View receipt</button></span>
          </div>
        `).join("")}
      </div>`
    : `<div class="empty-corpus"><strong>No local passports yet.</strong><p>Load the safe demo above to create and verify the first real record—without uploading anything.</p><a href="#create">Create the first passport →</a></div>`

  list.querySelectorAll<HTMLButtonElement>(".view-passport").forEach((button) => {
    button.addEventListener("click", () => {
      const manifest = corpus.find((item) => item.archiveId === button.dataset.id)
      if (!manifest) return
      currentManifest = manifest
      renderReceipt(manifest)
      document.querySelector("#create")?.scrollIntoView({ behavior: "smooth" })
    })
  })

  const fingerprinted = corpus.filter((item) => item.source)
  verifyPassport.innerHTML = fingerprinted.length
    ? `<option value="">Choose a local passport</option>${fingerprinted.map((item) => `<option value="${escapeHtml(item.archiveId)}">${escapeHtml(item.title)} — ${escapeHtml(shortFingerprint(item))}</option>`).join("")}`
    : '<option value="">No fingerprinted passports yet</option>'
  derivativePassport.innerHTML = fingerprinted.length
    ? `<option value="">Choose a fingerprinted source master</option>${fingerprinted.map((item) => `<option value="${escapeHtml(item.archiveId)}">${escapeHtml(item.title)} — ${escapeHtml(shortFingerprint(item))}</option>`).join("")}`
    : '<option value="">No fingerprinted passports yet</option>'
}

const setSelectedFile = (file: File): void => {
  selectedFile = file
  fileLabel.textContent = file.name
  fileMeta.textContent = `${formatBytes(file.size)} · ${file.type || "audio"}`
  if (audioPreview.src) URL.revokeObjectURL(audioPreview.src)
  audioPreview.src = URL.createObjectURL(file)
  audioPreview.hidden = false
}

const syncSourceMode = (): void => {
  const hasSource = currentMode() === "present"
  sourceFields.hidden = !hasSource
  rightsCheck.required = hasSource
  formMessage.textContent = hasSource
    ? "A source file will be fingerprinted locally before the passport is saved."
    : "This will be clearly marked as a metadata-only recovery record. No fingerprint will be invented."
}

sourceModes.forEach((input) => input.addEventListener("change", syncSourceMode))
fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0]
  if (file) setSelectedFile(file)
})

document.querySelector<HTMLButtonElement>("#load-demo")!.addEventListener("click", () => {
  sourceModes[0].checked = true
  syncSourceMode()
  setSelectedFile(makeDemoClip())
  getInput("#title").value = "Safe synthetic archive demo"
  getInput("#creator").value = "Unmute the Archive"
  getInput("#language").value = "Instrumental"
  getInput("#place").value = "Generated locally in the browser"
  getInput("#recorded-on").value = new Date().toISOString().slice(0, 10)
  getTextArea("#context").value = "A four-second rights-clear synthetic clip that demonstrates passport creation, fingerprinting, corpus storage, export, and later verification."
  getTextArea("#rights").value = "Generated locally by this application. No third-party recording or performance is included."
  rightsCheck.checked = true
  form.scrollIntoView({ behavior: "smooth", block: "start" })
})

form.addEventListener("submit", async (event) => {
  event.preventDefault()
  const mode = currentMode()
  if (!form.reportValidity()) return
  if (mode === "present" && !selectedFile) {
    formMessage.textContent = "Choose an audio file before creating a fingerprinted passport."
    fileInput.focus()
    return
  }

  createButton.disabled = true
  createButton.textContent = mode === "present" ? "Fingerprinting every byte…" : "Documenting recovery record…"
  formMessage.textContent = "Building the archival passport locally…"

  try {
    const source = selectedFile && mode === "present"
      ? {
          filename: selectedFile.name,
          mediaType: selectedFile.type || "application/octet-stream",
          bytes: selectedFile.size,
          sha256: await sha256(selectedFile),
        }
      : undefined

    currentManifest = buildManifest({
      status: source ? "fingerprinted" : "source-missing",
      collection: getInput("#collection").value.trim(),
      title: getInput("#title").value.trim(),
      creator: getInput("#creator").value.trim(),
      language: getInput("#language").value.trim(),
      place: getInput("#place").value.trim(),
      recordedOn: getInput("#recorded-on").value || undefined,
      context: getTextArea("#context").value.trim(),
      rightsBasis: getTextArea("#rights").value.trim(),
      evidenceUrl: getInput("#evidence-url").value.trim() || undefined,
      source,
    })
    corpus = saveToCorpus(currentManifest)
    renderReceipt(currentManifest)
    renderCorpus()
    formMessage.textContent = source
      ? "Passport saved. You can now verify this file, export the record, or optionally transfer it to Audiotool."
      : "Recovery record saved. It remains explicitly unverified until a source file is recovered."
    transferButton.disabled = !(client && source && projectSelect.value)
  } catch (error) {
    formMessage.textContent = error instanceof Error ? error.message : "The passport could not be created."
  } finally {
    createButton.disabled = false
    createButton.textContent = "Create archival passport"
  }
})

derivativeFileInput.addEventListener("change", () => {
  derivativeFile = derivativeFileInput.files?.[0] ?? null
  derivativeFileLabel.textContent = derivativeFile ? `${derivativeFile.name} · ${formatBytes(derivativeFile.size)}` : "Choose the derived audio file"
})

derivativeForm.addEventListener("submit", async (event) => {
  event.preventDefault()
  if (!derivativeForm.reportValidity()) return
  const master = corpus.find((item) => item.archiveId === derivativePassport.value)
  if (!master?.source) {
    derivativeMessage.textContent = "Choose a fingerprinted source master."
    derivativePassport.focus()
    return
  }
  if (!derivativeFile) {
    derivativeMessage.textContent = "Choose the derived audio file."
    derivativeFileInput.focus()
    return
  }

  derivativeButton.disabled = true
  derivativeButton.textContent = "Fingerprinting derivative…"
  derivativeMessage.textContent = "Linking the derivative to its preserved master locally…"
  try {
    const updated = addDerivative(master, {
      label: getInput("#derivative-label").value.trim(),
      purpose: getInput("#derivative-purpose").value.trim(),
      method: getTextArea("#derivative-method").value.trim(),
      changeLog: getTextArea("#derivative-changes").value.trim(),
      reviewerNote: getTextArea("#derivative-review").value.trim() || undefined,
      source: {
        filename: derivativeFile.name,
        mediaType: derivativeFile.type || "application/octet-stream",
        bytes: derivativeFile.size,
        sha256: await sha256(derivativeFile),
      },
    })
    corpus = updateInCorpus(updated)
    currentManifest = updated
    renderReceipt(updated)
    renderCorpus()
    derivativeMessage.textContent = "Derivative registered. Export the updated passport JSON to preserve the intervention record."
    derivativeButton.textContent = "Derivative registered"
  } catch (error) {
    derivativeMessage.textContent = error instanceof Error ? error.message : "The derivative could not be registered."
    derivativeButton.textContent = "Register documented derivative"
  } finally {
    derivativeButton.disabled = false
  }
})

verifyPassport.addEventListener("change", () => {
  verificationTarget = corpus.find((item) => item.archiveId === verifyPassport.value) ?? null
  verifyTargetNote.textContent = verificationTarget
    ? `Comparing against “${verificationTarget.title}” · ${shortFingerprint(verificationTarget)}`
    : "No passport selected."
  verifyButton.disabled = !(verificationTarget?.source && verificationFile)
  verifyResult.hidden = true
})

receiptFile.addEventListener("change", async () => {
  const file = receiptFile.files?.[0]
  if (!file) return
  try {
    const parsed = JSON.parse(await file.text()) as ArchiveManifest
    if (!["unmute-archive/2.0", "unmute-archive/2.1"].includes(parsed.schema) || !parsed.source?.sha256) throw new Error("This receipt has no compatible fingerprint.")
    verificationTarget = parsed
    verifyPassport.value = ""
    verifyTargetNote.textContent = `Imported “${parsed.title}” · ${shortFingerprint(parsed)}`
    verifyButton.disabled = !verificationFile
    verifyResult.hidden = true
  } catch (error) {
    verifyTargetNote.textContent = error instanceof Error ? error.message : "Receipt could not be read."
  }
})

verifyFile.addEventListener("change", () => {
  verificationFile = verifyFile.files?.[0] ?? null
  verifyFileLabel.textContent = verificationFile ? verificationFile.name : "Choose the audio file to check"
  verifyButton.disabled = !(verificationTarget?.source && verificationFile)
  verifyResult.hidden = true
})

document.querySelector<HTMLButtonElement>("#verify-demo")!.addEventListener("click", () => {
  verificationFile = makeDemoClip()
  verifyFileLabel.textContent = verificationFile.name
  const demoPassport = corpus.find((item) => item.title === "Safe synthetic archive demo" && item.source)
  if (demoPassport) {
    verificationTarget = demoPassport
    verifyPassport.value = demoPassport.archiveId
    verifyTargetNote.textContent = `Comparing against “${demoPassport.title}” · ${shortFingerprint(demoPassport)}`
  } else {
    verifyTargetNote.textContent = "Create the safe demo passport in Step 01 first; then this file can prove the match."
  }
  verifyButton.disabled = !(verificationTarget?.source && verificationFile)
  verifyResult.hidden = true
})

verifyButton.addEventListener("click", async () => {
  if (!verificationTarget?.source || !verificationFile) return
  verifyButton.disabled = true
  verifyButton.textContent = "Comparing every byte…"
  const digest = await sha256(verificationFile)
  const matches = digest === verificationTarget.source.sha256
  verifyResult.hidden = false
  verifyResult.className = `verify-result ${matches ? "match" : "mismatch"}`
  verifyResult.innerHTML = matches
    ? `<strong>Exact match.</strong><p>This file is byte-for-byte identical to the source in the passport.</p><code>${escapeHtml(digest)}</code>`
    : `<strong>Not the same file.</strong><p>The bytes differ. This may be an edit, re-export, transcoding, or another recording.</p><code>Expected ${escapeHtml(verificationTarget.source.sha256)}<br />Found ${escapeHtml(digest)}</code>`

  if (matches && corpus.some((item) => item.archiveId === verificationTarget!.archiveId)) {
    verificationTarget.events.push({ type: "verified", at: new Date().toISOString(), note: `Matched ${verificationFile.name}` })
    corpus = updateInCorpus(verificationTarget)
    renderCorpus()
  }
  verifyButton.disabled = false
  verifyButton.textContent = "Compare every byte"
})

document.querySelector<HTMLButtonElement>("#export-json")!.addEventListener("click", () => exportCorpusJson(corpus))
document.querySelector<HTMLButtonElement>("#export-csv")!.addEventListener("click", () => exportCorpusCsv(corpus))

const initAudiotool = async (): Promise<void> => {
  if (!clientId) {
    authCopy.textContent = "Audiotool developer registration is not connected in this build. Passport, verification, and corpus features are fully functional."
    authButton.textContent = "Integration pending"
    authButton.disabled = true
    return
  }

  const result = await audiotool({ clientId, redirectUrl, scope: "project:write" })
  if (result.status === "unauthenticated") {
    authCopy.textContent = result.error
      ? `Audiotool authorization needs attention: ${result.error.message}`
      : "Connect Audiotool only when you want to create an unlisted sample."
    authButton.addEventListener("click", () => result.login())
    return
  }

  client = result
  authButton.textContent = "Disconnect"
  authButton.addEventListener("click", () => result.logout())
  authCopy.textContent = `Connected as ${result.userName}. Choose a destination for an already fingerprinted source.`
  const response = await result.projects.listProjects({ pageSize: 100, orderBy: "project.update_time desc" })
  if (response instanceof Error) throw response
  projectSelect.innerHTML = '<option value="">Choose a destination project</option>'
  response.projects.forEach((project) => {
    const projectId = project.name.replace(/^projects\//, "")
    const option = document.createElement("option")
    option.value = `https://beta.audiotool.com/studio?project=${projectId}`
    option.dataset.projectName = project.name
    option.textContent = project.displayName || project.trackName || projectId
    projectSelect.append(option)
  })
  projectSelect.disabled = false
}

projectSelect.addEventListener("change", () => {
  transferButton.disabled = !(client && currentManifest?.source && selectedFile && projectSelect.value)
})

transferButton.addEventListener("click", async () => {
  if (!client || !currentManifest?.source || !selectedFile || !projectSelect.value) return
  transferButton.disabled = true
  transferButton.textContent = "Uploading unlisted sample…"
  try {
    const digest = await sha256(selectedFile)
    if (digest !== currentManifest.source.sha256) throw new Error("The selected file no longer matches the active passport.")
    const upload = await client.samples.upload({ displayName: currentManifest.title, file: selectedFile, visibility: "unlisted" })
    if (upload instanceof Error) throw upload
    const sample = await upload.ready
    if (sample instanceof Error) throw sample
    const nexus = await client.open(projectSelect.value)
    await nexus.start()
    await nexus.modify((transaction) => transaction.insertSample(sample))
    await nexus.stop()
    currentManifest.audiotool = {
      projectName: projectSelect.selectedOptions[0].dataset.projectName ?? projectSelect.value,
      sampleName: sample.name,
      insertedAt: new Date().toISOString(),
    }
    currentManifest.events.push({ type: "transferred", at: currentManifest.audiotool.insertedAt, note: `Inserted ${sample.name} as an unlisted Audiotool sample.` })
    corpus = updateInCorpus(currentManifest)
    renderReceipt(currentManifest)
    renderCorpus()
    transferButton.textContent = "Inserted + receipt updated"
  } catch (error) {
    transferButton.disabled = false
    transferButton.textContent = "Try transfer again"
    authCopy.textContent = error instanceof Error ? error.message : "Audiotool transfer paused."
  }
})

syncSourceMode()
renderCorpus()
void initAudiotool()
