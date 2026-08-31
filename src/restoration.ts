import "./suite.css"
import { analyzeAudio, audioBufferToWav, decodeFile, drawWaveform, processAudio, type AudioMetrics, type ProcessSettings } from "./audio-utils"
import { readCorpus, saveToCorpus, updateInCorpus } from "./corpus"
import { makeDemoClip } from "./demo-audio"
import { addDerivative, buildManifest, formatBytes, MAX_BROWSER_AUDIO_BYTES, sha256, type ArchiveManifest } from "./manifest"
import { downloadText } from "./suite-data"
import { escapeHtml, suiteFooter, suiteHeader } from "./suite-shell"

const app = document.querySelector<HTMLDivElement>("#app")!
app.innerHTML = `${suiteHeader("restoration")}
<main class="suite-main">
  <section class="suite-hero shell restoration-hero">
    <p class="suite-eyebrow">03 · Reversible preservation workflow</p>
    <h1>Improve access.<br><em>Never erase the master.</em></h1>
    <p>Restoration Lab creates a separate, fingerprinted listening derivative and a machine-readable intervention log. The original remains untouched, and registration is allowed only when its bytes match a source master in Archive Passport.</p>
    <div class="suite-actions"><a class="suite-button primary" href="#lab">Open the lab</a><button class="suite-button" id="load-demo">Run a safe synthetic demo</button></div>
    <div class="suite-boundary"><strong>Research boundary:</strong> this browser pilot offers conservative filtering, level adjustment, normalization, A/B listening, and provenance logging. It does not claim forensic restoration, source separation, or AI reconstruction.</div>
  </section>

  <section class="lab-shell shell" id="lab">
    <aside class="lab-controls suite-panel">
      <div><span class="suite-kicker">Source + passport</span><h2>1. Link the master</h2></div>
      <label class="atlas-field">Fingerprint-verified passport<select id="passport"><option value="">Choose a local passport</option></select></label>
      <label class="drop-file" id="drop-file"><input id="audio-file" type="file" accept="audio/*"><strong>Select the exact source audio</strong><span>WAV, MP3, M4A, OGG supported when the browser can decode it · limit ${formatBytes(MAX_BROWSER_AUDIO_BYTES)}</span></label>
      <div class="source-check" id="source-check"><span>Waiting for a file and passport.</span></div>
      <hr>
      <div><span class="suite-kicker">Transparent processing</span><h2>2. Set the intervention</h2></div>
      <div class="preset-row"><button data-preset="gentle">Gentle cleanup</button><button data-preset="speech">Speech / archive</button><button data-preset="flat">Reset</button></div>
      <label class="range-field"><span>Low rumble filter <output id="highpass-value">35 Hz</output></span><input id="highpass" type="range" min="10" max="180" value="35"></label>
      <label class="range-field"><span>High-frequency limit <output id="lowpass-value">18,000 Hz</output></span><input id="lowpass" type="range" min="3000" max="20000" step="100" value="18000"></label>
      <label class="range-field"><span>Gain <output id="gain-value">0 dB</output></span><input id="gain" type="range" min="-12" max="12" step="0.5" value="0"></label>
      <label class="atlas-check"><input id="normalize" type="checkbox" checked><span>Peak-normalize derivative to 95%</span></label>
      <label class="atlas-field">Intervention purpose<input id="purpose" value="Access copy for research listening"></label>
      <label class="atlas-field">Reviewer note<textarea id="reviewer-note" rows="3" placeholder="What should a future listener know?"></textarea></label>
      <button class="suite-button primary process-button" id="process" disabled>Process documented derivative</button><output class="process-status" id="process-status" aria-live="polite"></output>
    </aside>

    <div class="lab-output">
      <section class="wave-panel suite-panel"><header><div><span class="suite-kicker">A · Untouched source</span><h2 id="source-title">No source selected</h2></div><span class="suite-chip" id="source-badge">not verified</span></header><canvas id="source-wave" aria-label="Source waveform"></canvas><audio id="source-player" controls></audio><div class="metric-row" id="source-metrics"></div></section>
      <section class="wave-panel suite-panel"><header><div><span class="suite-kicker">B · New derivative</span><h2 id="result-title">Process to create an access copy</h2></div><span class="suite-chip" id="result-badge">pending</span></header><canvas id="result-wave" aria-label="Processed waveform"></canvas><audio id="result-player" controls></audio><div class="metric-row" id="result-metrics"></div></section>
      <section class="intervention-panel suite-panel" id="report-panel"><div><span class="suite-kicker">Intervention log</span><h2>Every change should be legible.</h2></div><div id="intervention-log" class="intervention-log"><p>No processing has been run. The pilot will record settings, source and derivative fingerprints, metrics, time, and the parent passport.</p></div><div class="suite-actions"><button class="suite-button" id="download-wav" disabled>Download WAV</button><button class="suite-button" id="download-log" disabled>Download JSON log</button><button class="suite-button primary" id="register" disabled>Register in passport</button></div><output id="register-status"></output></section>
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
let sourceFile: File | undefined
let sourceBuffer: AudioBuffer | undefined
let sourceHash = ""
let resultBuffer: AudioBuffer | undefined
let resultBlob: Blob | undefined
let resultHash = ""
let sourceUrl = ""
let resultUrl = ""
let intervention: Record<string, unknown> | undefined

const manifests = (): ArchiveManifest[] => readCorpus().filter((item) => item.source)
const selectedManifest = (): ArchiveManifest | undefined => manifests().find((item) => item.archiveId === passportSelect.value)
const metricHtml = (metrics: AudioMetrics): string => [[`${metrics.duration.toFixed(2)}s`, "duration"], [`${(metrics.sampleRate / 1000).toFixed(1)}k`, "sample rate"], [metrics.channels, "channels"], [`${(metrics.peak * 100).toFixed(1)}%`, "peak"], [`${(metrics.rms * 100).toFixed(1)}%`, "RMS"]].map(([value, label]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join("")
const shortHash = (value: string): string => value ? `${value.slice(0, 10)}…${value.slice(-10)}` : "—"
const refreshPassports = (selectId?: string): void => {
  const items = manifests()
  passportSelect.innerHTML = `<option value="">Choose a local passport</option>${items.map((item) => `<option value="${item.archiveId}">${escapeHtml(item.title)} · ${shortHash(item.source?.sha256 ?? "")}</option>`).join("")}`
  if (selectId) passportSelect.value = selectId
}
const settings = (): ProcessSettings => ({ highpass: Number(byId<HTMLInputElement>("highpass").value), lowpass: Number(byId<HTMLInputElement>("lowpass").value), gainDb: Number(byId<HTMLInputElement>("gain").value), normalize: byId<HTMLInputElement>("normalize").checked })
const settingsText = (value: ProcessSettings): string => `High-pass ${value.highpass} Hz; low-pass ${value.lowpass} Hz; gain ${value.gainDb >= 0 ? "+" : ""}${value.gainDb} dB; ${value.normalize ? "peak normalization to 95%" : "no normalization"}.`
const revoke = (value: string): void => { if (value) URL.revokeObjectURL(value) }

const resetResult = (): void => {
  resultBuffer = undefined; resultBlob = undefined; resultHash = ""; intervention = undefined
  revoke(resultUrl); resultUrl = ""
  byId<HTMLAudioElement>("result-player").removeAttribute("src")
  byId("result-title").textContent = "Process to create an access copy"
  byId("result-badge").textContent = "pending"
  byId("result-metrics").innerHTML = ""
  byId("intervention-log").innerHTML = `<p>No processing has been run. The pilot will record settings, source and derivative fingerprints, metrics, time, and the parent passport.</p>`
  registerButton.disabled = true; wavButton.disabled = true; logButton.disabled = true
}

const assessLink = (): void => {
  const manifest = selectedManifest()
  const exact = Boolean(sourceHash && manifest?.source?.sha256 === sourceHash)
  processButton.disabled = !sourceBuffer
  registerButton.disabled = !resultBlob || !exact
  byId("source-badge").textContent = exact ? "exact master match" : sourceHash ? "not linked" : "not verified"
  byId("source-badge").className = `suite-chip ${exact ? "high" : "recovery"}`
  byId("source-check").innerHTML = exact
    ? `<strong>✓ Exact source match</strong><span>SHA-256 agrees with “${escapeHtml(manifest?.title ?? "")}”. Registration will be permitted.</span>`
    : manifest && sourceHash ? `<strong>Fingerprint mismatch</strong><span>You may audition a derivative, but it cannot be registered under this passport. Choose the exact master or the correct passport.</span>`
      : `<span>Select a source file and its fingerprinted passport. Use the safe demo if you want to test the entire workflow.</span>`
}

const loadFile = async (file: File): Promise<void> => {
  resetResult()
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
    sourceBuffer = decoded; sourceHash = digest
    revoke(sourceUrl); sourceUrl = URL.createObjectURL(file)
    byId<HTMLAudioElement>("source-player").src = sourceUrl
    byId("source-metrics").innerHTML = metricHtml(analyzeAudio(decoded))
    drawWaveform(byId<HTMLCanvasElement>("source-wave"), decoded)
    assessLink()
  } catch {
    sourceBuffer = undefined; sourceHash = ""
    byId("source-check").innerHTML = `<strong>Browser could not decode this file.</strong><span>Try WAV, MP3, M4A, or OGG. The file has not left this device.</span>`
    processButton.disabled = true
  }
}

const ensureDemoPassport = async (file: File): Promise<ArchiveManifest> => {
  const digest = await sha256(file)
  const existing = manifests().find((item) => item.source?.sha256 === digest)
  if (existing) return existing
  const manifest = buildManifest({
    status: "fingerprinted", collection: "Unmute Belarus — safe reviewer demo", title: "Synthetic archive demo tone", creator: "Browser-generated demonstration", language: "No speech / synthetic tones", place: "Created locally in this browser", recordedOn: new Date().toISOString().slice(0, 10), context: "A rights-clear four-second tone sequence generated by the application solely to demonstrate source fingerprinting, reversible processing, derivative registration, and Atlas linkage.", rightsBasis: "Synthetic demonstration generated locally; no third-party recording used.", source: { filename: file.name, mediaType: file.type, bytes: file.size, sha256: digest }, derivatives: [],
  })
  saveToCorpus(manifest)
  return manifest
}

const runDemo = async (): Promise<void> => {
  const file = makeDemoClip()
  const passport = await ensureDemoPassport(file)
  refreshPassports(passport.archiveId)
  await loadFile(file)
  byId("lab").scrollIntoView({ behavior: "smooth" })
}

const process = async (): Promise<void> => {
  if (!sourceBuffer || !sourceFile) return
  processButton.disabled = true; processButton.textContent = "Processing locally…"
  byId<HTMLOutputElement>("process-status").textContent = "Creating a separate access copy. The source file remains untouched."
  try {
    const applied = settings()
    resultBuffer = await processAudio(sourceBuffer, applied)
    resultBlob = audioBufferToWav(resultBuffer)
    resultHash = await sha256(resultBlob)
    revoke(resultUrl); resultUrl = URL.createObjectURL(resultBlob)
    byId<HTMLAudioElement>("result-player").src = resultUrl
    drawWaveform(byId<HTMLCanvasElement>("result-wave"), resultBuffer, "#ff9c7e")
    const sourceMetrics = analyzeAudio(sourceBuffer)
    const resultMetrics = analyzeAudio(resultBuffer)
    byId("result-title").textContent = `${sourceFile.name.replace(/\.[^.]+$/, "")} — access derivative`
    byId("result-badge").textContent = "new fingerprint"
    byId("result-badge").className = "suite-chip high"
    byId("result-metrics").innerHTML = metricHtml(resultMetrics)
    intervention = {
      schema: "unmute-restoration/1.0", createdAt: new Date().toISOString(), parentArchiveId: selectedManifest()?.archiveId ?? null,
      purpose: byId<HTMLInputElement>("purpose").value.trim(), reviewerNote: byId<HTMLTextAreaElement>("reviewer-note").value.trim(),
      source: { filename: sourceFile.name, bytes: sourceFile.size, sha256: sourceHash, metrics: sourceMetrics },
      derivative: { filename: `${sourceFile.name.replace(/\.[^.]+$/, "")}-access-derivative.wav`, bytes: resultBlob.size, mediaType: resultBlob.type, sha256: resultHash, metrics: resultMetrics },
      processing: { engine: "Web Audio API / transparent browser signal chain", ...applied, summary: settingsText(applied) },
      boundaries: ["Source bytes were not modified.", "No AI reconstruction or source separation was performed.", "The derivative is an access copy, not a replacement master."],
    }
    byId("intervention-log").innerHTML = `<dl><div><dt>Parent source</dt><dd>${shortHash(sourceHash)}</dd></div><div><dt>Derivative</dt><dd>${shortHash(resultHash)}</dd></div><div><dt>Method</dt><dd>${escapeHtml(settingsText(applied))}</dd></div><div><dt>Size</dt><dd>${formatBytes(resultBlob.size)}</dd></div></dl><p>The source remains untouched. The derivative can be downloaded now and registered only when the selected passport is an exact fingerprint match.</p>`
    wavButton.disabled = false; logButton.disabled = false; assessLink()
    byId<HTMLOutputElement>("process-status").textContent = "Derivative created locally. Review the log before downloading or registering it."
    byId("report-panel").scrollIntoView({ behavior: "smooth", block: "center" })
  } catch {
    resetResult()
    byId<HTMLOutputElement>("process-status").textContent = "Processing could not finish. Nothing was registered or uploaded; try a smaller WAV/MP3 file or reset the processing settings."
  } finally { processButton.disabled = false; processButton.textContent = "Process documented derivative" }
}

audioInput.addEventListener("change", async (event) => { const file = (event.currentTarget as HTMLInputElement).files?.[0]; if (file) await loadFile(file) })
passportSelect.addEventListener("change", assessLink)
byId("load-demo").addEventListener("click", runDemo)
document.querySelectorAll<HTMLButtonElement>("[data-preset]").forEach((button) => button.addEventListener("click", () => {
  const preset = button.dataset.preset
  const values = preset === "speech" ? [80, 12000, 1] : preset === "gentle" ? [35, 18000, 0] : [10, 20000, 0]
  byId<HTMLInputElement>("highpass").value = String(values[0]); byId<HTMLInputElement>("lowpass").value = String(values[1]); byId<HTMLInputElement>("gain").value = String(values[2])
  byId<HTMLInputElement>("normalize").checked = preset !== "flat"; document.querySelectorAll<HTMLInputElement>("input[type=range]").forEach((input) => input.dispatchEvent(new Event("input")))
}))
const ranges: [string, string, (value: number) => string][] = [["highpass", "highpass-value", (value) => `${value} Hz`], ["lowpass", "lowpass-value", (value) => `${value.toLocaleString()} Hz`], ["gain", "gain-value", (value) => `${value > 0 ? "+" : ""}${value} dB`]]
ranges.forEach(([inputId, outputId, format]) => byId<HTMLInputElement>(inputId).addEventListener("input", (event) => { byId<HTMLOutputElement>(outputId).textContent = format(Number((event.currentTarget as HTMLInputElement).value)) }))
processButton.addEventListener("click", process)
wavButton.addEventListener("click", () => { if (!resultBlob || !sourceFile) return; const link = document.createElement("a"); link.href = URL.createObjectURL(resultBlob); link.download = `${sourceFile.name.replace(/\.[^.]+$/, "")}-access-derivative.wav`; link.click(); URL.revokeObjectURL(link.href) })
logButton.addEventListener("click", () => { if (intervention) downloadText(JSON.stringify(intervention, null, 2), "application/json", "unmute-restoration-intervention.json") })
registerButton.addEventListener("click", () => {
  const manifest = selectedManifest()
  if (!manifest || !manifest.source || !resultBlob || !sourceFile || !intervention || manifest.source.sha256 !== sourceHash) return
  try {
    const applied = settings()
    const updated = addDerivative(manifest, { label: `${sourceFile.name.replace(/\.[^.]+$/, "")} — access derivative`, purpose: byId<HTMLInputElement>("purpose").value.trim() || "Research access copy", method: "Web Audio API transparent browser signal chain.", changeLog: settingsText(applied), reviewerNote: byId<HTMLTextAreaElement>("reviewer-note").value.trim() || undefined, source: { filename: `${sourceFile.name.replace(/\.[^.]+$/, "")}-access-derivative.wav`, mediaType: resultBlob.type, bytes: resultBlob.size, sha256: resultHash } })
    updateInCorpus(updated); refreshPassports(updated.archiveId); registerButton.disabled = true
    byId<HTMLOutputElement>("register-status").innerHTML = `Registered as a separate derivative. <a href="../#corpus">Open the parent passport</a> or <a href="../atlas/">see the new relationship in Music Atlas</a>.`
  } catch (error) { byId<HTMLOutputElement>("register-status").textContent = error instanceof Error ? error.message : "Registration failed." }
})

refreshPassports()
assessLink()
