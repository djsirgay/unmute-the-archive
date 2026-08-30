import { audiotool, type AuthenticatedClient } from "@audiotool/nexus"
import { makeDemoClip } from "./demo-audio"
import {
  buildManifest,
  downloadManifest,
  sha256,
  type ArchiveManifest,
} from "./manifest"
import "./style.css"

const clientId = import.meta.env.VITE_AUDIOTOOL_CLIENT_ID?.trim() ?? ""
const redirectUrl = import.meta.env.DEV
  ? "http://127.0.0.1:5173/"
  : new URL("./", window.location.href).toString().split("?")[0]

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <header class="hero">
    <nav class="nav shell">
      <a class="brand" href="#top" aria-label="Unmute the Archive home">
        <span class="brand-mark" aria-hidden="true">U/A</span>
        <span>Unmute the Archive</span>
      </a>
      <a class="text-link" href="#how-it-works">How it works</a>
    </nav>
    <div class="hero-grid shell" id="top">
      <div class="hero-copy">
        <p class="eyebrow">Audiotool Nexus · cultural memory infrastructure</p>
        <h1>Move a fragile recording into a living session—without losing its story.</h1>
        <p class="lede">A provenance-aware bridge from vulnerable cultural audio to collaborative music making.</p>
        <div class="hero-actions">
          <a class="button primary" href="#archive-form">Unmute a recording</a>
          <button class="button ghost" id="load-demo" type="button">Use a safe demo clip</button>
        </div>
      </div>
      <div class="signal-card" aria-label="Archive to session diagram">
        <div class="signal-line"><span>01</span><strong>source</strong><em>kept intact</em></div>
        <div class="signal-wave" aria-hidden="true">
          ${Array.from({ length: 34 }, (_, index) => `<i style="--h:${24 + ((index * 37) % 68)}%"></i>`).join("")}
        </div>
        <div class="signal-line"><span>02</span><strong>context</strong><em>travels with it</em></div>
        <div class="signal-line active"><span>03</span><strong>session</strong><em>Audiotool Nexus</em></div>
      </div>
    </div>
  </header>

  <main>
    <section class="principles shell" id="how-it-works">
      <article><span>01</span><h2>Preserve the source</h2><p>The original file is fingerprinted before it enters the session.</p></article>
      <article><span>02</span><h2>Keep consent visible</h2><p>Origin, language, context, and permission are recorded—not stripped away.</p></article>
      <article><span>03</span><h2>Make remix traceable</h2><p>A portable receipt connects the source item to its Audiotool destination.</p></article>
    </section>

    <section class="workspace shell" id="archive-form">
      <div class="workspace-intro">
        <p class="eyebrow">One careful transfer</p>
        <h2>Build an archive receipt, then place the sound in Audiotool.</h2>
        <p>Nothing uploads until you connect your account and press the final button.</p>
      </div>

      <form class="archive-form" id="intake-form">
        <div class="form-section">
          <div class="section-number">A</div>
          <div class="section-content">
            <h3>Describe the source</h3>
            <div class="field-grid">
              <label>Title<input id="title" name="title" required placeholder="Grandmother's spring song" /></label>
              <label>Contributor or community<input id="contributor" name="contributor" required placeholder="Name or community attribution" /></label>
              <label>Language<input id="language" name="language" required placeholder="Belarusian" /></label>
              <label>Place<input id="place" name="place" required placeholder="Minsk / Los Angeles" /></label>
            </div>
            <label>Why this recording matters<textarea id="context" name="context" required rows="4" placeholder="What should a future listener understand before reusing this sound?"></textarea></label>
          </div>
        </div>

        <div class="form-section">
          <div class="section-number">B</div>
          <div class="section-content">
            <h3>Add the recording</h3>
            <label class="dropzone" for="audio-file">
              <input id="audio-file" type="file" accept="audio/*" />
              <span class="drop-icon">↗</span>
              <strong id="file-label">Choose an audio file</strong>
              <small id="file-meta">WAV, MP3, M4A, FLAC, or another browser-readable format</small>
            </label>
            <audio id="audio-preview" controls hidden></audio>
            <label>Consent / rights basis<textarea id="consent" name="consent" required rows="3" placeholder="I created this recording, or I have permission to place it in this Audiotool project."></textarea></label>
            <label class="check-row"><input id="rights-check" type="checkbox" required /><span>I have the right or explicit permission to upload and reuse this recording.</span></label>
          </div>
        </div>

        <div class="form-section">
          <div class="section-number">C</div>
          <div class="section-content">
            <div class="connect-header">
              <div><h3>Choose the living session</h3><p id="auth-copy">Connect Audiotool to load your projects.</p></div>
              <button class="button secondary" id="auth-button" type="button">Connect Audiotool</button>
            </div>
            <label>Audiotool project<select id="project" disabled required><option value="">Connect to load projects</option></select></label>
            <button class="button primary full" id="archive-button" type="submit" disabled>Archive + insert into session</button>
          </div>
        </div>
      </form>

      <aside class="status-panel" aria-live="polite">
        <p class="eyebrow">Transfer log</p>
        <ol id="status-list">
          <li class="current"><span>1</span><div><strong>Waiting for a source</strong><small>Your file stays in this browser.</small></div></li>
          <li><span>2</span><div><strong>Verify provenance</strong><small>Create a SHA-256 source fingerprint.</small></div></li>
          <li><span>3</span><div><strong>Upload unlisted sample</strong><small>Send only after your confirmation.</small></div></li>
          <li><span>4</span><div><strong>Insert through Nexus</strong><small>Write the sample into the chosen session.</small></div></li>
        </ol>
        <div id="receipt" class="receipt" hidden>
          <span>Archive receipt</span>
          <strong id="receipt-title"></strong>
          <code id="receipt-hash"></code>
          <button class="text-button" id="download-receipt" type="button">Download manifest.json</button>
        </div>
      </aside>
    </section>
  </main>

  <footer class="footer shell">
    <p>Designed and built by Sergéy Ulyanov · Nostalgai Recordz</p>
    <p>Source files remain local until the user explicitly uploads them.</p>
  </footer>
`

const form = document.querySelector<HTMLFormElement>("#intake-form")!
const fileInput = document.querySelector<HTMLInputElement>("#audio-file")!
const fileLabel = document.querySelector<HTMLElement>("#file-label")!
const fileMeta = document.querySelector<HTMLElement>("#file-meta")!
const audioPreview = document.querySelector<HTMLAudioElement>("#audio-preview")!
const loadDemoButton = document.querySelector<HTMLButtonElement>("#load-demo")!
const authButton = document.querySelector<HTMLButtonElement>("#auth-button")!
const authCopy = document.querySelector<HTMLElement>("#auth-copy")!
const projectSelect = document.querySelector<HTMLSelectElement>("#project")!
const archiveButton = document.querySelector<HTMLButtonElement>("#archive-button")!
const statusItems = [...document.querySelectorAll<HTMLLIElement>("#status-list li")]
const receipt = document.querySelector<HTMLElement>("#receipt")!
const receiptTitle = document.querySelector<HTMLElement>("#receipt-title")!
const receiptHash = document.querySelector<HTMLElement>("#receipt-hash")!
const downloadReceiptButton = document.querySelector<HTMLButtonElement>("#download-receipt")!

let selectedFile: File | null = null
let client: AuthenticatedClient | null = null
let currentManifest: ArchiveManifest | null = null

const setStatus = (index: number, title?: string, detail?: string): void => {
  statusItems.forEach((item, itemIndex) => {
    item.classList.toggle("done", itemIndex < index)
    item.classList.toggle("current", itemIndex === index)
  })
  if (title) statusItems[index].querySelector("strong")!.textContent = title
  if (detail) statusItems[index].querySelector("small")!.textContent = detail
}

const setFile = (file: File): void => {
  selectedFile = file
  fileLabel.textContent = file.name
  fileMeta.textContent = `${(file.size / 1_048_576).toFixed(2)} MB · ${file.type || "audio"}`
  audioPreview.src = URL.createObjectURL(file)
  audioPreview.hidden = false
  setStatus(1, "Source ready", "Fingerprint will be created before upload.")
  archiveButton.disabled = !client
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0]
  if (file) setFile(file)
})

loadDemoButton.addEventListener("click", () => {
  const demo = makeDemoClip()
  setFile(demo)
  ;(document.querySelector<HTMLInputElement>("#title")!).value = "Synthetic archive demo"
  ;(document.querySelector<HTMLInputElement>("#contributor")!).value = "Unmute the Archive"
  ;(document.querySelector<HTMLInputElement>("#language")!).value = "Instrumental"
  ;(document.querySelector<HTMLInputElement>("#place")!).value = "Browser-generated"
  ;(document.querySelector<HTMLTextAreaElement>("#context")!).value = "A synthetic, rights-clear clip for testing the complete archive-to-session workflow."
  ;(document.querySelector<HTMLTextAreaElement>("#consent")!).value = "Generated locally by this application; no third-party recording or performance is included."
  document.querySelector<HTMLInputElement>("#rights-check")!.checked = true
  document.querySelector("#archive-form")?.scrollIntoView({ behavior: "smooth" })
})

const initAudiotool = async (): Promise<void> => {
  if (!clientId) {
    authCopy.textContent = "Nexus application registration is pending. Add VITE_AUDIOTOOL_CLIENT_ID to enable OAuth."
    authButton.textContent = "Client ID required"
    authButton.disabled = true
    return
  }

  const result = await audiotool({
    clientId,
    redirectUrl,
    scope: "project:write",
  })

  if (result.status === "unauthenticated") {
    authCopy.textContent = result.error
      ? `Audiotool authorization needs attention: ${result.error.message}`
      : "Connect Audiotool to load your projects."
    authButton.addEventListener("click", () => result.login())
    return
  }

  client = result
  authButton.textContent = "Disconnect"
  authButton.addEventListener("click", () => result.logout())
  authCopy.textContent = `Connected as ${result.userName}. Choose a destination project.`

  const response = await result.projects.listProjects({
    pageSize: 100,
    orderBy: "project.update_time desc",
  })
  if (response instanceof Error) throw response
  projectSelect.innerHTML = '<option value="">Choose a project</option>'
  response.projects.forEach((project) => {
    const projectId = project.name.replace(/^projects\//, "")
    const option = document.createElement("option")
    option.value = `https://beta.audiotool.com/studio?project=${projectId}`
    option.dataset.projectName = project.name
    option.textContent = project.displayName || project.trackName || projectId
    projectSelect.append(option)
  })
  projectSelect.disabled = false
  archiveButton.disabled = !selectedFile
}

form.addEventListener("submit", async (event) => {
  event.preventDefault()
  if (!client || !selectedFile || !form.reportValidity()) return

  archiveButton.disabled = true
  archiveButton.textContent = "Fingerprinting source…"

  try {
    const digest = await sha256(selectedFile)
    setStatus(2, "Provenance verified", `SHA-256 ${digest.slice(0, 12)}…`)

    const selectedProject = projectSelect.selectedOptions[0]
    const projectName = selectedProject.dataset.projectName ?? selectedProject.value
    const title = document.querySelector<HTMLInputElement>("#title")!.value.trim()
    currentManifest = buildManifest({
      title,
      contributor: document.querySelector<HTMLInputElement>("#contributor")!.value.trim(),
      language: document.querySelector<HTMLInputElement>("#language")!.value.trim(),
      place: document.querySelector<HTMLInputElement>("#place")!.value.trim(),
      context: document.querySelector<HTMLTextAreaElement>("#context")!.value.trim(),
      consentBasis: document.querySelector<HTMLTextAreaElement>("#consent")!.value.trim(),
      source: {
        filename: selectedFile.name,
        mediaType: selectedFile.type || "application/octet-stream",
        bytes: selectedFile.size,
        sha256: digest,
      },
    })

    archiveButton.textContent = "Uploading unlisted sample…"
    const upload = await client.samples.upload({
      displayName: title,
      file: selectedFile,
      visibility: "unlisted",
    })
    if (upload instanceof Error) throw upload
    const sample = await upload.ready
    if (sample instanceof Error) throw sample

    setStatus(3, "Sample ready", "Opening a real-time Nexus session.")
    archiveButton.textContent = "Inserting through Nexus…"
    const nexus = await client.open(projectSelect.value)
    await nexus.start()
    await nexus.modify((transaction) => transaction.insertSample(sample))
    await nexus.stop()

    currentManifest.audiotool = {
      projectName,
      sampleName: sample.name,
      insertedAt: new Date().toISOString(),
    }
    statusItems[3].classList.add("done")
    statusItems[3].classList.remove("current")
    receiptTitle.textContent = title
    receiptHash.textContent = digest
    receipt.hidden = false
    archiveButton.textContent = "Archived in Audiotool"
  } catch (error) {
    console.error(error)
    archiveButton.disabled = false
    archiveButton.textContent = "Try the transfer again"
    const message = error instanceof Error ? error.message : "Unknown transfer error"
    setStatus(2, "Transfer paused", message)
  }
})

downloadReceiptButton.addEventListener("click", () => {
  if (currentManifest) downloadManifest(currentManifest)
})

void initAudiotool()
