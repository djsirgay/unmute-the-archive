import "./suite.css"
import { analyzeAudio, audioBufferToWav, decodeFile, drawWaveform, processAudio, type AudioMetrics, type ProcessSettings } from "./audio-utils"
import { readCorpus, saveToCorpus, updateInCorpus } from "./corpus"
import { makeDemoClip } from "./demo-audio"
import { buildManifest, formatBytes, MAX_BROWSER_AUDIO_BYTES, sha256, type ArchiveManifest } from "./manifest"
import { sameSha256 } from "./intervention"
import { effectiveSettings, registerCompletedRun, restorationLog, saveRegisteredRunNote, settingsText, withMasterAttestation, withPendingReviewNote, type CompletedRun } from "./restoration-run"
import { mountCorpusWarning } from "./storage-warning"
import { downloadText } from "./suite-data"
import { escapeHtml, suiteFooter, suiteHeader } from "./suite-shell"
import { version as applicationVersion } from "../package.json"

import { restoreInitialFragment } from "./initial-fragment"
const app = document.querySelector<HTMLDivElement>("#app")!
app.innerHTML = `${suiteHeader("restoration")}
<main class="suite-main">
  <section class="suite-hero shell restoration-hero">
    <p class="suite-eyebrow">03 · Master-preserving listening workflow</p>
    <h1>Improve access.<br><em>Never erase the master.</em></h1>
    <p>Restoration Lab creates a separate, fingerprinted listening derivative and a machine-readable intervention log. The original remains untouched, and registration is allowed only when its bytes match a source master in Archive Passport.</p>
    <div class="suite-actions"><a class="suite-button primary" href="#lab">Open the lab</a><button class="suite-button" id="load-demo">Run a safe synthetic demo</button></div>
    <div class="suite-boundary"><strong>Research boundary:</strong> this browser pilot offers conservative filtering, level adjustment, normalization, A/B listening, and provenance logging. It does not claim forensic restoration, source separation, or AI reconstruction.</div>
  </section>

  <section class="lab-shell shell" id="lab">
    <aside class="lab-controls suite-panel">
      <div><span class="suite-kicker">Source + passport</span><h2>1. Link the master</h2></div>
      <label class="atlas-field">Source passport<select id="passport"><option value="">Choose a local passport</option></select></label><a class="atlas-note" href="../#create">No passport yet? Create or import one →</a>
      <label class="drop-file" id="drop-file"><input id="audio-file" type="file" accept="audio/*"><strong>Select the exact source audio</strong><span>WAV, MP3, M4A, OGG supported when the browser can decode it · limit ${formatBytes(MAX_BROWSER_AUDIO_BYTES)}</span></label>
      <div class="source-check" id="source-check"><span>Waiting for a file and passport.</span></div>
      <hr>
      <div><span class="suite-kicker">Transparent processing</span><h2>2. Set the intervention</h2></div>
      <div class="preset-row"><button data-preset="gentle">Gentle cleanup</button><button data-preset="speech">Speech / archive</button><button data-preset="flat">Reset</button></div>
      <label class="range-field"><span>Low rumble filter <output id="highpass-value">35 Hz</output></span><input id="highpass" type="range" min="0" max="180" value="35"></label>
      <label class="range-field"><span>High-frequency limit <output id="lowpass-value">18,000 Hz</output></span><input id="lowpass" type="range" min="0" max="20000" step="100" value="18000"></label>
      <label class="range-field"><span>Gain <output id="gain-value">0 dB</output></span><input id="gain" type="range" min="-12" max="12" step="0.5" value="0"></label>
      <label class="atlas-check"><input id="normalize" type="checkbox" checked><span>Peak-normalize derivative to 95%</span></label>
      <p class="atlas-note">Normalization sets the final peak, so gain does not control final loudness while it is enabled. Downloads are 16-bit PCM WAV access copies.</p>
      <label class="atlas-field">Intervention purpose<input id="purpose" value="Access copy for research listening"></label>
      <button class="suite-button primary process-button" id="process" disabled>Process documented derivative</button><output class="process-status" id="process-status" aria-live="polite"></output>
    </aside>

    <div class="lab-output">
      <section class="wave-panel suite-panel"><header><div><span class="suite-kicker">A · Untouched source</span><h2 id="source-title">No source selected</h2></div><span class="suite-chip" id="source-badge">not verified</span></header><canvas id="source-wave" aria-label="Source waveform"></canvas><audio id="source-player" controls></audio><div class="metric-row" id="source-metrics"></div><p class="atlas-note">Metrics describe decoded audio. The browser may resample it; this is not a measurement of the original file’s encoded sample rate. Source file bytes remain untouched.</p></section>
      <section class="wave-panel suite-panel"><header><div><span class="suite-kicker">B · New derivative</span><h2 id="result-title">Process to create an access copy</h2></div><span class="suite-chip" id="result-badge">pending</span></header><canvas id="result-wave" aria-label="Processed waveform"></canvas><audio id="result-player" controls></audio><div class="metric-row" id="result-metrics"></div><p class="atlas-note">Output peak and RMS are measured before 16-bit WAV quantization. These measurements do not establish perceptual quality or authenticity.</p></section>
      <section class="intervention-panel suite-panel" id="report-panel"><div><span class="suite-kicker">Intervention log</span><h2>Every change should be legible.</h2></div><div id="intervention-log" class="intervention-log"><p>No processing has been run. The pilot will record settings, source and derivative fingerprints, metrics, time, and the parent passport.</p></div><label class="atlas-field">Listening note — review remains pending<textarea id="reviewer-note" rows="3" placeholder="After comparing A and B, note artifacts, uncertainty, or what still needs review." disabled></textarea></label><p class="atlas-note">You can update this note after listening without processing the audio again. A note alone is not a completed review, approval, or rights clearance.</p><label class="atlas-check"><input id="preserve-master" type="checkbox" disabled><span>I confirm the source master is preserved and this is a separate access copy.</span></label><p class="atlas-note">Confirm preservation to export the journal or register it. Processing authority is not assessed here; this record documents the workflow and does not grant permission for reuse.</p><div class="suite-actions"><button class="suite-button" id="download-wav" disabled>Download WAV</button><button class="suite-button" id="download-log" disabled>Download JSON log</button><button class="suite-button primary" id="register" disabled>Register in passport</button></div><output id="register-status" aria-live="polite"></output></section>
    </div>
  </section>

  <section class="restoration-guide shell"><div><span class="suite-kicker">How the modules connect</span><h2>One source. Two identities. One auditable relationship.</h2></div><ol><li><b>01</b><p><strong>Passport</strong> fingerprints the master and records its history.</p></li><li><b>02</b><p><strong>Restoration Lab</strong> creates a separate WAV without overwriting it.</p></li><li><b>03</b><p><strong>Passport</strong> registers the derivative’s fingerprint and method.</p></li><li><b>DATA</b><p><strong>Music Atlas</strong> then exposes both records and their relationship.</p></li></ol></section>
</main>${suiteFooter()}`

const byId = <T extends HTMLElement>(id: string): T => document.querySelector<T>(`#${id}`)!
const passportSelect = byId<HTMLSelectElement>("passport")
const audioInput = byId<HTMLInputElement>("audio-file")
const processButton = byId<HTMLButtonElement>("process")
const registerButton = byId<HTMLButtonElement>("register")
const wavButton = byId<HTMLButtonElement>("download-wav")
const logButton = byId<HTMLButtonElement>("download-log")
const reviewerNoteInput = byId<HTMLTextAreaElement>("reviewer-note")
const preserveMasterInput = byId<HTMLInputElement>("preserve-master")
let sourceFile: File | undefined
let sourceBuffer: AudioBuffer | undefined
let sourceHash = ""
let resultBuffer: AudioBuffer | undefined
let resultBlob: Blob | undefined
let sourceUrl = ""
let resultUrl = ""
let intervention: ReturnType<typeof restorationLog> | undefined
let completedRun: CompletedRun | undefined
let registered: { archiveId: string; derivativeId: string } | undefined
let noteDirty = false
let sourceVersion = 0
let processing = false

const manifests = (): ArchiveManifest[] => readCorpus().filter((item) => item.source)
const selectedManifest = (): ArchiveManifest | undefined => manifests().find((item) => item.archiveId === passportSelect.value)
const metricHtml = (metrics: AudioMetrics): string => [[`${metrics.duration.toFixed(2)}s`, "duration"], [`${(metrics.sampleRate / 1000).toFixed(1)}k`, "processing rate"], [metrics.channels, "channels"], [`${(metrics.peak * 100).toFixed(1)}%`, "peak"], [`${(metrics.rms * 100).toFixed(1)}%`, "RMS"]].map(([value, label]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join("")
const shortHash = (value: string): string => value ? `${value.slice(0, 10)}…${value.slice(-10)}` : "—"
const refreshPassports = (selectId?: string): void => {
  const items = manifests()
  passportSelect.innerHTML = `<option value="">Choose a local passport</option>${items.map((item) => `<option value="${escapeHtml(item.archiveId)}">${escapeHtml(item.title)} · ${shortHash(item.source?.sha256 ?? "")}</option>`).join("")}`
  if (selectId) passportSelect.value = selectId
}
const settings = (): ProcessSettings => ({ highpass: Number(byId<HTMLInputElement>("highpass").value), lowpass: Number(byId<HTMLInputElement>("lowpass").value), gainDb: Number(byId<HTMLInputElement>("gain").value), normalize: byId<HTMLInputElement>("normalize").checked })
const revoke = (value: string): void => { if (value) URL.revokeObjectURL(value) }

const resetResult = (): void => {
  resultBuffer = undefined; resultBlob = undefined; intervention = undefined; completedRun = undefined
  registered = undefined; noteDirty = false
  reviewerNoteInput.value = ""; reviewerNoteInput.disabled = true
  preserveMasterInput.checked = false; preserveMasterInput.disabled = true
  revoke(resultUrl); resultUrl = ""
  byId<HTMLAudioElement>("result-player").removeAttribute("src")
  byId<HTMLAudioElement>("result-player").load()
  const canvas = byId<HTMLCanvasElement>("result-wave")
  canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height)
  byId("register-status").textContent = ""
  byId("result-title").textContent = "Process to create an access copy"
  byId("result-badge").textContent = "pending"
  byId("result-metrics").innerHTML = ""
  byId("intervention-log").innerHTML = `<p>No processing has been run. The pilot will record settings, source and derivative fingerprints, metrics, time, and the parent passport.</p>`
  registerButton.disabled = true; wavButton.disabled = true; logButton.disabled = true
  registerButton.textContent = "Register in passport"
}

const assessLink = (): void => {
  const manifest = selectedManifest()
  const exact = sameSha256(sourceHash, manifest?.source?.sha256)
  processButton.disabled = !sourceBuffer || processing
  const savedHere = registered?.archiveId === manifest?.archiveId
  registerButton.disabled = !resultBlob || !exact || !completedRun?.intervention || (savedHere && !noteDirty)
  registerButton.textContent = savedHere ? "Save note to passport" : "Register in passport"
  logButton.disabled = !intervention
  byId("source-badge").textContent = exact ? "exact master match" : sourceHash ? "not linked" : "not verified"
  byId("source-badge").className = `suite-chip ${exact ? "high" : "recovery"}`
  byId("source-check").innerHTML = exact
    ? `<strong>✓ Exact source match</strong><span>SHA-256 agrees with “${escapeHtml(manifest?.title ?? "")}”. Registration will be permitted.</span>`
    : manifest && sourceHash ? `<strong>Fingerprint mismatch</strong><span>You may audition a derivative, but it cannot be registered under this passport. Choose the exact master or the correct passport.</span>`
      : `<span>Select a source file and its fingerprinted passport. Use the safe demo if you want to test the entire workflow.</span>`
}

const refreshJournal = (): void => {
  if (!completedRun) return
  const manifest = selectedManifest()
  const parentId = sameSha256(manifest?.source?.sha256, completedRun.sourceHash) ? manifest!.archiveId : null
  intervention = completedRun.intervention ? restorationLog(completedRun, parentId) : undefined
  byId("intervention-log").innerHTML = `<dl><div><dt>Parent source SHA-256</dt><dd>${shortHash(completedRun.sourceHash)}</dd></div><div><dt>Derivative SHA-256</dt><dd>${shortHash(completedRun.source.sha256)}</dd></div><div><dt>Processing</dt><dd>Non-AI · Browser Web Audio API</dd></div><div><dt>Applied method</dt><dd>${escapeHtml(settingsText(completedRun.settings))}</dd></div><div><dt>Listening review</dt><dd>Pending — audible preservation and uncertainty have not been assessed.</dd></div><div><dt>Authority</dt><dd>Unknown — documentation only; no reuse permission is established.</dd></div></dl><p>${intervention ? "Master preservation confirmed. The same structured journal is included in the JSON log and the passport when saved." : "The source file has not been overwritten by this tool. Confirm that you have preserved it before exporting or registering the journal."}</p>`
  assessLink()
}

const loadFile = async (file: File): Promise<void> => {
  const version = ++sourceVersion
  resetResult()
  sourceFile = undefined; sourceBuffer = undefined; sourceHash = ""
  processButton.disabled = true
  revoke(sourceUrl); sourceUrl = ""
  byId<HTMLAudioElement>("source-player").removeAttribute("src")
  byId<HTMLAudioElement>("source-player").load()
  byId("source-metrics").innerHTML = ""
  byId("source-badge").textContent = "not verified"
  const canvas = byId<HTMLCanvasElement>("source-wave")
  canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height)
  if (file.size > MAX_BROWSER_AUDIO_BYTES) {
    sourceFile = undefined; sourceBuffer = undefined; sourceHash = ""
    byId("source-title").textContent = "File not loaded"
    byId("source-check").innerHTML = `<strong>File exceeds the browser-pilot limit.</strong><span>${escapeHtml(file.name)} is ${formatBytes(file.size)}. Use a local access copy under ${formatBytes(MAX_BROWSER_AUDIO_BYTES)}; the original remains untouched.</span>`
    processButton.disabled = true
    return
  }
  sourceFile = file
  byId("source-title").textContent = file.name
  byId("source-check").innerHTML = `<span>Decoding and fingerprinting locally…</span>`
  try {
    const [decoded, digest] = await Promise.all([decodeFile(file), sha256(file)])
    if (version !== sourceVersion) return
    sourceBuffer = decoded; sourceHash = digest
    revoke(sourceUrl); sourceUrl = URL.createObjectURL(file)
    byId<HTMLAudioElement>("source-player").src = sourceUrl
    byId("source-metrics").innerHTML = metricHtml(analyzeAudio(decoded))
    drawWaveform(byId<HTMLCanvasElement>("source-wave"), decoded)
    assessLink()
  } catch {
    if (version !== sourceVersion) return
    sourceBuffer = undefined; sourceHash = ""
    byId("source-check").innerHTML = `<strong>Browser could not decode this file.</strong><span>Try WAV, MP3, M4A, or OGG. The file has not left this device.</span>`
    processButton.disabled = true
  }
}

const ensureDemoPassport = async (file: File): Promise<ArchiveManifest> => {
  const digest = await sha256(file)
  const existing = manifests().find((item) => sameSha256(item.source?.sha256, digest))
  if (existing) return existing
  const manifest = buildManifest({
    status: "fingerprinted", collection: "Unmute Belarus — safe reviewer demo", title: "Synthetic archive demo tone", creator: "Browser-generated demonstration", language: "No speech / synthetic tones", place: "Created locally in this browser", recordedOn: new Date().toISOString().slice(0, 10), context: "A rights-clear four-second tone sequence generated by the application solely to demonstrate source fingerprinting, master-preserving processing, derivative registration, and Atlas linkage.", rightsBasis: "Synthetic demonstration generated locally; no third-party recording used.", source: { filename: file.name, mediaType: file.type, bytes: file.size, sha256: digest }, derivatives: [],
  })
  saveToCorpus(manifest)
  return manifest
}

const runDemo = async (): Promise<void> => {
  try {
  const file = makeDemoClip()
  const passport = await ensureDemoPassport(file)
  refreshPassports(passport.archiveId)
  await loadFile(file)
  if (sourceBuffer) await process()
  byId("lab").scrollIntoView({ behavior: "smooth" })
  } catch (error) { byId("process-status").textContent = error instanceof Error ? error.message : "The browser could not prepare the demo." }
}

const process = async (): Promise<void> => {
  if (!sourceBuffer || !sourceFile || processing) return
  const version = sourceVersion
  const inputFile = sourceFile
  const inputBuffer = sourceBuffer
  const inputHash = sourceHash
  const applied = effectiveSettings(settings(), inputBuffer.sampleRate)
  const purpose = byId<HTMLInputElement>("purpose").value.trim() || "Research access copy"
  const createdAt = new Date().toISOString()
  processing = true
  resetResult()
  processButton.disabled = true; processButton.textContent = "Processing locally…"
  byId<HTMLOutputElement>("process-status").textContent = "Creating a separate access copy. The source file remains untouched."
  try {
    const processed = await processAudio(inputBuffer, applied)
    const blob = audioBufferToWav(processed)
    const digest = await sha256(blob)
    if (version !== sourceVersion) return
    resultBuffer = processed; resultBlob = blob
    revoke(resultUrl); resultUrl = URL.createObjectURL(resultBlob)
    byId<HTMLAudioElement>("result-player").src = resultUrl
    drawWaveform(byId<HTMLCanvasElement>("result-wave"), resultBuffer, "#ff9c7e")
    const sourceMetrics = analyzeAudio(inputBuffer)
    const resultMetrics = analyzeAudio(resultBuffer)
    completedRun = structuredClone({ sourceHash: inputHash, settings: applied, purpose, reviewerNote: "", label: `${inputFile.name.replace(/\.[^.]+$/, "")} — access derivative`, source: { filename: `${inputFile.name.replace(/\.[^.]+$/, "")}-access-derivative.wav`, mediaType: blob.type, bytes: blob.size, sha256: digest }, processing: { createdAt, applicationVersion, inputFile: { filename: inputFile.name, mediaType: inputFile.type || "application/octet-stream", bytes: inputFile.size, sha256: inputHash }, sourceMetrics, resultMetrics } })
    byId("result-title").textContent = completedRun.label
    byId("result-badge").textContent = "new fingerprint"
    byId("result-badge").className = "suite-chip high"
    byId("result-metrics").innerHTML = metricHtml(resultMetrics)
    reviewerNoteInput.disabled = false; preserveMasterInput.disabled = false
    wavButton.disabled = false; refreshJournal()
    byId<HTMLOutputElement>("process-status").textContent = "Derivative created locally. Review the log before downloading or registering it."
    byId("report-panel").scrollIntoView({ behavior: "smooth", block: "center" })
  } catch (error) {
    if (version !== sourceVersion) return
    resetResult()
    byId<HTMLOutputElement>("process-status").textContent = error instanceof Error ? error.message : "Processing could not finish. Try a smaller WAV/MP3 file or reset the processing settings."
  } finally { processing = false; processButton.disabled = !sourceBuffer; processButton.textContent = "Process documented derivative" }
}

audioInput.addEventListener("change", async (event) => { const file = (event.currentTarget as HTMLInputElement).files?.[0]; if (file) await loadFile(file) })
passportSelect.addEventListener("change", () => {
  assessLink()
  refreshJournal()
})
preserveMasterInput.addEventListener("change", () => {
  if (!completedRun) return
  completedRun = withMasterAttestation(completedRun, preserveMasterInput.checked)
  refreshJournal()
})
reviewerNoteInput.addEventListener("input", () => {
  if (!completedRun) return
  completedRun = withPendingReviewNote(completedRun, reviewerNoteInput.value)
  noteDirty = Boolean(registered)
  refreshJournal()
  byId("register-status").textContent = registered ? "Pending note changed. Save it to the passport to update the saved copy; audio and processing settings are unchanged." : "Listening note updated in the current journal. Review remains pending; audio was not reprocessed."
})
byId("load-demo").addEventListener("click", runDemo)
document.querySelectorAll<HTMLButtonElement>("[data-preset]").forEach((button) => button.addEventListener("click", () => {
  const preset = button.dataset.preset
  const values = preset === "speech" ? [80, 12000, 1] : preset === "gentle" ? [35, 18000, 0] : [0, 0, 0]
  byId<HTMLInputElement>("highpass").value = String(values[0]); byId<HTMLInputElement>("lowpass").value = String(values[1]); byId<HTMLInputElement>("gain").value = String(values[2])
  byId<HTMLInputElement>("normalize").checked = preset !== "flat"; document.querySelectorAll<HTMLInputElement>("input[type=range]").forEach((input) => input.dispatchEvent(new Event("input")))
}))
const ranges: [string, string, (value: number) => string][] = [["highpass", "highpass-value", (value) => value ? `${value} Hz` : "Off"], ["lowpass", "lowpass-value", (value) => value ? `${value.toLocaleString()} Hz` : "Off"], ["gain", "gain-value", (value) => `${value > 0 ? "+" : ""}${value} dB`]]
ranges.forEach(([inputId, outputId, format]) => byId<HTMLInputElement>(inputId).addEventListener("input", (event) => { byId<HTMLOutputElement>(outputId).textContent = format(Number((event.currentTarget as HTMLInputElement).value)) }))
document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(".lab-controls input:not([type=file]), .lab-controls textarea").forEach((control) => control.addEventListener("input", () => {
  if (completedRun) byId("process-status").textContent = "Settings changed. Process again to apply them; the existing audio and log still describe the previous run."
}))
const sourcePlayer = byId<HTMLAudioElement>("source-player")
const resultPlayer = byId<HTMLAudioElement>("result-player")
sourcePlayer.addEventListener("play", () => resultPlayer.pause())
resultPlayer.addEventListener("play", () => sourcePlayer.pause())
processButton.addEventListener("click", process)
wavButton.addEventListener("click", () => { if (!resultBlob || !sourceFile) return; const link = document.createElement("a"); link.href = URL.createObjectURL(resultBlob); link.download = `${sourceFile.name.replace(/\.[^.]+$/, "")}-access-derivative.wav`; link.click(); URL.revokeObjectURL(link.href) })
logButton.addEventListener("click", () => { if (intervention) downloadText(JSON.stringify(intervention, null, 2), "application/json", "unmute-restoration-intervention.json") })
registerButton.addEventListener("click", () => {
  const manifest = selectedManifest()
  if (!manifest || !resultBlob || !completedRun || !intervention) return
  try {
    const updating = registered?.archiveId === manifest.archiveId
    const updated = updating ? saveRegisteredRunNote(manifest, registered!.derivativeId, completedRun) : registerCompletedRun(manifest, completedRun)
    updateInCorpus(updated)
    const saved = updated.derivatives!.find((item) => sameSha256(item.source.sha256, completedRun!.source.sha256))!
    registered = { archiveId: updated.archiveId, derivativeId: saved.derivativeId }; noteDirty = false
    refreshPassports(updated.archiveId); refreshJournal()
    byId<HTMLOutputElement>("register-status").innerHTML = `${updating ? "Pending note saved; audio and processing settings unchanged." : "Registered as a separate derivative with a pending review."} <a href="../#corpus">Open the parent passport</a> or <a href="../atlas/">see the relationship in Music Atlas</a>.`
  } catch (error) { byId<HTMLOutputElement>("register-status").textContent = error instanceof Error ? error.message : "Registration failed." }
})

refreshPassports(new URLSearchParams(window.location.search).get("passport") ?? undefined)
mountCorpusWarning()
assessLink()
restoreInitialFragment()
