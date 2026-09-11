import { audiotool, type AuthenticatedClient } from "@audiotool/nexus"
import { makeDemoClip } from "./demo-audio"
import {
  corpusStats,
  exportCorpusCsv,
  exportCorpusJson,
  readCorpus,
  removeFromCorpus,
  saveToCorpus,
  updateInCorpus,
} from "./corpus"
import {
  citationFor,
  downloadManifest,
  formatBytes,
  isArchiveManifest,
  MAX_BROWSER_AUDIO_BYTES,
  sha256,
  shortFingerprint,
  type ArchiveManifest,
} from "./manifest"
import { pilotItems } from "./pilot"
import { importPassportJson } from "./suite-data"
import { isPublicEvidenceUrl } from "./manifest"
import { mountCorpusWarning } from "./storage-warning"
import { captureDerivativeSubmission, completeDerivativeSubmission, InterventionFormError, interventionReceipt, readInterventionFields, syncInterventionForm } from "./intervention-form"
import { sameSha256 } from "./intervention"
import { capturePassportSubmission, completePassportSubmission } from "./passport-submission"
import "./style.css"
import { restoreInitialFragment } from "./initial-fragment"

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

const disclosureControl = (id: string, label: string, placeholder: string, multiline = false, statusId = `${id}-status`): string => `
  <div class="intervention-disclosure">
    <label for="${statusId}">${escapeHtml(label)}</label>
    <div class="intervention-disclosure-controls">
      <select id="${statusId}" aria-label="${escapeHtml(label)} disclosure">
        <option value="unknown">Unknown</option><option value="provided">Provide details</option>
        <option value="not-disclosed">Not disclosed</option><option value="not-applicable">Not applicable</option>
      </select>
      ${multiline ? `<textarea id="${id}" rows="3" placeholder="${escapeHtml(placeholder)}" aria-label="${escapeHtml(label)} details" hidden disabled></textarea>` : `<input id="${id}" placeholder="${escapeHtml(placeholder)}" aria-label="${escapeHtml(label)} details" hidden disabled />`}
    </div>
  </div>`

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <header class="site-header" id="top">
    <nav class="nav shell" aria-label="Primary navigation">
      <a class="brand" href="#top">
        <span class="brand-mark" aria-hidden="true">U/A</span>
        <span>Unmute the Archive</span>
      </a>
      <div class="nav-links">
        <a href="#guide">Guide</a>
        <a href="#create">Passport</a>
        <a href="#verify">Verify</a>
        <a href="#derivative">Derivative</a>
        <a href="#corpus">Corpus</a>
        <a href="#pilot">Pilot</a>
      </div>
      <a class="system-link" href="/research/system/">Unmute Belarus system ↗</a>
    </nav>
  </header>

  <nav class="module-rail" aria-label="Unmute Belarus module navigation">
    <div class="shell">
      <a href="/research/">Research home</a>
      <a href="/research/system/">System map</a>
      <a class="current" href="#top"><b>01</b> Archive Passport <small>live</small></a>
      <a href="./atlas/"><b>02</b> Music Atlas <small>live pilot</small></a>
      <a href="./restoration/"><b>03</b> Restoration Lab <small>live pilot</small></a>
      <a href="./atlas/#analytics">Data &amp; analytics</a>
    </div>
  </nav>

  <main>
    <section class="hero shell">
      <div class="hero-copy">
        <p class="eyebrow">Live module · Unmute Belarus research system</p>
        <h1>Document a recording’s story. Preserve its future.</h1>
        <p class="lede">Create a human-readable archival passport, document edited copies without replacing the master, verify exact files, and export a structured research corpus. The core workflow stays on this device.</p>
        <div class="hero-actions">
          <a class="button primary" href="#create">Start a passport</a>
          <button class="button outline" id="quick-demo" type="button">Try a complete safe demo</button>
        </div>
        <p class="privacy-note"><span aria-hidden="true">⌾</span> Audio stays on this device unless you explicitly transfer it.</p>
      </div>

      <div class="hero-steps" aria-label="Four-step workflow">
        <p class="eyebrow">Four clear steps</p>
        <ol>
          <li><span>1</span><div><strong>Passport</strong><p>Add a file and describe its origin, context, and rights.</p></div></li>
          <li><span>2</span><div><strong>Derivative <em>optional</em></strong><p>Record an edit or restoration without replacing the master.</p></div></li>
          <li><span>3</span><div><strong>Verify</strong><p>Re-select a file later to prove it matches, byte for byte.</p></div></li>
          <li><span>4</span><div><strong>Export</strong><p>Download JSON for preservation or CSV for analysis.</p></div></li>
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

    <section class="guide-section shell" id="guide">
      <div class="section-heading row-heading">
        <div><p class="eyebrow">How to use Archive Passport</p><h2>Test it safely in three minutes. Then document a real recording.</h2></div>
        <p>No account is required. The app stores passport metadata and fingerprints in this browser; it does not store the audio itself. Exporting JSON is what creates a portable backup.</p>
      </div>
      <div class="guide-grid">
        <article class="guide-card demo-path">
          <div class="guide-card-head"><span>Recommended first visit</span><b>Safe demo path</b></div>
          <ol>
            <li><span>1</span><p>Go to <a href="#create">Create a passport</a> and choose <strong>Load safe demo</strong>.</p></li>
            <li><span>2</span><p>Select <strong>Create archival passport</strong>. The synthetic clip is fingerprinted locally.</p></li>
            <li><span>3</span><p>Go to <a href="#verify">Verify</a>, choose <strong>Use the safe synthetic demo file</strong>, then compare.</p></li>
            <li><span>4</span><p>Confirm the exact match, then delete the demo record or export it to inspect the format.</p></li>
          </ol>
          <a class="button primary" href="#create">Run the safe demo ↓</a>
        </article>
        <article class="guide-card real-path">
          <div class="guide-card-head"><span>For archival work</span><b>Real recording path</b></div>
          <ol>
            <li><span>1</span><p>Choose a rights-clear audio file—or mark the source missing and document only a recovery lead.</p></li>
            <li><span>2</span><p>Describe provenance, context, and permission. Use <strong>Unknown</strong> instead of guessing.</p></li>
            <li><span>3</span><p>If you create a restoration or edit, register it as a separate <a href="#derivative">documented derivative</a>.</p></li>
            <li><span>4</span><p>Export the passport JSON and corpus. Keep copies in at least two trusted locations.</p></li>
          </ol>
          <p class="guide-warning"><strong>Important:</strong> a fingerprint proves exact file identity—not authorship, ownership, or historical truth.</p>
        </article>
      </div>
    </section>

    <section class="tool-section shell" id="create">
      <div class="section-heading">
        <p class="eyebrow">01 · Create a passport</p>
        <h2>Document what is known. Never invent what is missing.</h2>
        <p>A source file creates a fingerprinted passport. If the master is lost, create a recovery record with public evidence instead—without pretending the audio was verified.</p>
      </div>

      <div class="create-grid">
        <form class="archive-form panel" id="passport-form" novalidate>
          <fieldset class="mode-picker">
            <legend>What do you have?</legend>
            <label><input type="radio" name="source-mode" value="present" checked /><span><strong>I have the audio file</strong><small>Create an integrity fingerprint.</small></span></label>
            <label><input type="radio" name="source-mode" value="missing" /><span><strong>The source is missing</strong><small>Document a recovery lead.</small></span></label>
          </fieldset>

          <div class="field-grid">
            <label class="field-control">Title<input id="title" required placeholder="Recording title" /></label>
            <label class="field-control">Creator / contributor <span class="optional">use “Unknown” if not established</span><input id="creator" required placeholder="Person or community" /></label>
            <div class="field-control">
              <label for="language">Language <span class="optional">choose “Unknown” instead of guessing</span></label>
              <select id="language" required>
                <option value="">Choose a language</option>
                <option>Belarusian</option>
                <option>Russian</option>
                <option>English</option>
                <option>Ukrainian</option>
                <option>Polish</option>
                <option>Multilingual</option>
                <option>Instrumental / no linguistic content</option>
                <option>Unknown / not established</option>
                <option value="other">Other / not listed</option>
              </select>
              <input id="language-other" class="conditional-input" hidden placeholder="Enter the language" aria-label="Other language" />
            </div>
            <label class="field-control">Place <span class="optional">type or choose a common location</span><input id="place" required list="place-options" placeholder="Choose or enter a place" /></label>
            <datalist id="place-options">
              <option value="Minsk, Belarus"></option>
              <option value="Los Angeles, United States"></option>
              <option value="New York, United States"></option>
              <option value="Warsaw, Poland"></option>
              <option value="Vilnius, Lithuania"></option>
              <option value="Berlin, Germany"></option>
              <option value="Unknown / not established"></option>
            </datalist>
            <label>Date recorded or released<input id="recorded-on" type="date" /></label>
            <div class="field-control">
              <label for="collection">Collection</label>
              <select id="collection" required>
                <option>Belarusian Music in Exile — Pilot Corpus</option>
                <option>Nostalgai Recordz archive</option>
                <option>Personal archive</option>
                <option>Community-contributed archive</option>
                <option>Unassigned research record</option>
                <option value="other">Other / not listed</option>
              </select>
              <input id="collection-other" class="conditional-input" hidden placeholder="Enter the collection name" aria-label="Other collection" />
            </div>
          </div>

          <label>Why this recording matters<textarea id="context" required rows="4" placeholder="Cultural context, circumstances, people, and what a future researcher should know."></textarea></label>
          <div class="field-control rights-field">
            <label for="rights-basis">Rights / consent basis</label>
            <select id="rights-basis" required>
              <option value="">Choose the closest verified basis</option>
              <option>I created or performed this recording and control this source file.</option>
              <option>I have explicit permission from the rights holder to preserve this source file.</option>
              <option>This recording is in the public domain.</option>
              <option>This is a recovery lead; rights have not yet been established.</option>
              <option value="other">Other / requires explanation</option>
            </select>
            <textarea id="rights" rows="3" placeholder="Optional details: who gave permission, scope, date, or what still needs review."></textarea>
          </div>
          <label>Public evidence or recovery lead <span class="optional">optional</span><input id="evidence-url" type="url" placeholder="https://…" /></label>

          <div id="source-file-fields">
            <label class="dropzone" for="audio-file">
              <input id="audio-file" type="file" accept="audio/*" />
              <span class="drop-icon" aria-hidden="true">↗</span>
              <strong id="file-label">Choose an audio file</strong>
              <small id="file-meta">WAV, MP3, M4A, FLAC, or another audio format · browser pilot limit ${formatBytes(MAX_BROWSER_AUDIO_BYTES)}</small>
            </label>
            <audio id="audio-preview" controls hidden></audio>
            <label class="check-row"><input id="rights-check" type="checkbox" /><span>I control this file or have explicit permission to preserve it.</span></label>
          </div>

          <div class="form-actions">
            <button class="button primary" id="create-button" type="submit">Create passport → see result</button>
            <button class="button quiet" id="load-demo" type="button">Load safe demo</button>
          </div>
          <p class="next-step-note">No additional step: after creation, the finished passport appears in the result panel on the right (or directly below on mobile).</p>
          <div class="form-message" id="form-message" role="alert" aria-live="assertive"></div>
        </form>

        <aside class="receipt-panel panel" id="live-receipt" aria-live="polite">
          <div class="empty-receipt">
            <p class="eyebrow">Your result</p>
            <h3>A passport appears here.</h3>
            <p>It will be useful without Audiotool: saved locally, independently verifiable, citable, and exportable.</p>
          </div>
        </aside>
      </div>

    </section>

    <section class="tool-section derivative-section" id="derivative">
      <div class="shell derivative-grid">
        <div class="section-heading compact">
          <p class="eyebrow">02 · Optional · Document a derivative</p>
          <h2>Preserve the master. Register every intervention.</h2>
          <p>This tool does not restore audio automatically. It links an edited or restored copy to an untouched fingerprinted master and records what changed, why, and who reviewed it.</p>
          <ul class="derivative-rules">
            <li><strong>Master stays untouched.</strong><span>The derivative receives its own fingerprint.</span></li>
            <li><strong>Methods stay visible.</strong><span>Noise removal, EQ, repair, separation, or AI processing must be named.</span></li>
            <li><strong>Listening judgment stays human.</strong><span>A cleaner waveform is not automatically a more authentic record.</span></li>
          </ul>
        </div>
        <form class="derivative-form panel intervention-form" id="derivative-form" novalidate>
          <fieldset class="intervention-step">
            <legend class="intervention-legend"><span class="intervention-step-number">1</span> Source master &amp; derived file</legend>
            <div class="field-grid">
              <label>Source master passport<select id="derivative-passport" required><option value="">No fingerprinted passports yet</option></select><small class="intervention-hint" id="intervention-source-note">Create or import a fingerprinted passport first. Selecting it declares which source this copy came from.</small></label>
              <label class="dropzone" for="derivative-file">
                <input id="derivative-file" type="file" accept="audio/*" />
                <span class="drop-icon" aria-hidden="true">↗</span>
                <strong id="derivative-file-label">Choose the derived audio file</strong>
                <small>A separate version; the master is never replaced.</small>
              </label>
            </div>
            <label>Derivative label<input id="derivative-label" required placeholder="Performance remix, classroom edit, or listening copy" /></label>
            <label>Purpose / context<input id="derivative-purpose" required placeholder="What is this version for? Research, education, listening access…" /></label>
          </fieldset>
          <fieldset class="intervention-step">
            <legend class="intervention-legend"><span class="intervention-step-number">2</span> Processing type &amp; details</legend>
            <div class="field-grid">
              <label>Processing type<select id="intervention-processing"><option value="unknown">Unknown / not established</option><option value="ai">AI-assisted processing</option><option value="non-ai">Non-AI processing</option></select></label>
              ${disclosureControl("intervention-tool", "Tool name", "Software or service used")}
            </div>
            <details class="intervention-details">
              <summary>Model, version &amp; settings — add known details</summary>
              <p class="intervention-hint">These start as Unknown. Not disclosed means information is withheld. Model is Not applicable only for explicitly non-AI processing.</p>
              <div class="field-grid">
                ${disclosureControl("intervention-model", "Model", "Model name, if established")}
                ${disclosureControl("intervention-version", "Tool version", "Exact version, if established")}
              </div>
              ${disclosureControl("intervention-settings", "Settings", "Parameters, configuration, or a processing preset", true)}
            </details>
            ${disclosureControl("derivative-method", "Processing instruction / method", "What was requested or done? Include the exact prompt when available.", true, "intervention-instruction-status")}
            <label>Change log<textarea id="derivative-changes" required rows="3" placeholder="What changed? Describe removal, repair, separation, generated material, or what has not yet been assessed."></textarea></label>
          </fieldset>
          <fieldset class="intervention-step">
            <legend class="intervention-legend"><span class="intervention-step-number">3</span> Permission scope</legend>
            <div class="field-grid">
              <label>Declared permission basis<select id="intervention-authority"><option value="unknown">Unknown / not established</option><option value="creator-owned">Creator-owned — declared</option><option value="permission">Permission obtained — declared</option><option value="public-domain">Public domain — declared</option><option value="no-permission">No permission</option></select></label>
              <label>Evidence / reference <span class="optional">optional</span><textarea id="intervention-evidence" rows="2" placeholder="License, agreement, date, or a private reference. Do not include sensitive documents."></textarea></label>
            </div>
            <label>Scope and limits<textarea id="intervention-scope" required rows="2" placeholder="What use is covered? If unknown, say what still needs permission or review."></textarea></label>
            <p class="intervention-notice">Unknown or No permission can be documented. Registration does not authorize processing, redistribution, or reuse, and the master's rights do not automatically cover this derivative.</p>
          </fieldset>
          <fieldset class="intervention-step">
            <legend class="intervention-legend"><span class="intervention-step-number">4</span> Review status</legend>
            <div class="field-grid">
              <label>Declared human review<select id="intervention-review-status"><option value="pending">Pending — not reviewed</option><option value="reviewed">Reviewed — not automatically approved</option><option value="rejected">Rejected by reviewer</option></select></label>
              <label>Reviewer / pseudonym<input id="intervention-reviewer" placeholder="Required for Reviewed or Rejected" /></label>
            </div>
            <p class="intervention-hint" id="intervention-review-help">Pending is the default. A name or note alone does not mark review complete.</p>
            <div class="field-grid">
              <label>Preserved features<textarea id="intervention-preserved" rows="2" placeholder="What stayed recognizable or unchanged? Leave blank if not assessed."></textarea></label>
              <label>Uncertainty / limitations<textarea id="intervention-uncertainty" rows="2" placeholder="Artifacts, missing context, or unresolved questions. Leave blank if not assessed."></textarea></label>
            </div>
            <p class="intervention-hint">Blank preserved-features and uncertainty fields are saved explicitly as “Not assessed.” They never mean “no changes” or “no uncertainty.”</p>
            <label>Human review note<textarea id="derivative-review" rows="3" placeholder="What did the reviewer compare and conclude? Required for Reviewed or Rejected."></textarea></label>
            <label class="check-row"><input id="derivative-master-check" type="checkbox" required /><span>I confirm that this is a separate derivative and the original master remains preserved. This statement is not a certificate of authenticity or a rights grant.</span></label>
          </fieldset>
          <button class="button primary full" id="derivative-button" type="submit">Register documented derivative</button>
          <p class="form-message" id="derivative-message" role="status" aria-live="polite"></p>
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
          <button class="button quiet" id="import-corpus-button" type="button">Import JSON backup</button>
          <input id="import-corpus" type="file" accept="application/json,.json" hidden />
        </div>
      </div>
      <div class="stats-grid" id="corpus-stats"></div>
      <p id="import-corpus-status" class="form-message" role="status"></p>
      <div class="corpus-list panel" id="corpus-list"></div>
    </section>

    <section class="optional-transfer tool-section shell" id="audiotool-transfer">
      <div class="audiotool-panel panel">
        <div>
          <p class="eyebrow">Optional creative handoff · outside the core archive workflow</p>
          <h3>Place a fingerprinted source in an Audiotool session.</h3>
          <p id="auth-copy">The archival passport works independently. Audiotool transfer is only an additional traceable reuse event.</p>
        </div>
        <div class="transfer-controls">
          <button class="button outline" id="auth-button" type="button">Connect Audiotool</button>
          <select id="project" disabled aria-label="Audiotool project"><option value="">Choose a destination project</option></select>
          <button class="button secondary" id="transfer-button" type="button" disabled>Insert unlisted sample</button>
        </div>
      </div>
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

  <nav class="module-sequence shell" aria-label="Previous and next research modules">
    <a href="/research/system/"><small>← Back</small><strong>Unmute Belarus system map</strong></a>
    <a href="./atlas/"><small>Next module →</small><strong>02 · Music Atlas</strong></a>
  </nav>

  <footer class="footer shell">
    <p>Designed and built by Sergéy Ulyanov · <a href="/research/system/">Unmute Belarus research system</a></p>
    <p>Live research prototype · local-first · no blockchain claims</p>
  </footer>
`

// The shared language layer translates option labels. Keep stored values stable.
document.querySelectorAll<HTMLOptionElement>("option:not([value])").forEach((option) => { option.value = option.textContent ?? "" })
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
const languageSelect = document.querySelector<HTMLSelectElement>("#language")!
const languageOther = document.querySelector<HTMLInputElement>("#language-other")!
const collectionSelect = document.querySelector<HTMLSelectElement>("#collection")!
const collectionOther = document.querySelector<HTMLInputElement>("#collection-other")!
const rightsBasisSelect = document.querySelector<HTMLSelectElement>("#rights-basis")!

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
const localIsoDate = (date = new Date()): string => {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

const selectedOrOther = (select: HTMLSelectElement, other: HTMLInputElement): string =>
  select.value === "other" ? other.value.trim() : select.value.trim()

const selectedRightsBasis = (): string => {
  const detail = getTextArea("#rights").value.trim()
  if (rightsBasisSelect.value === "other") return detail
  return `${rightsBasisSelect.value}${detail ? ` ${detail}` : ""}`
}

const fileWithinBrowserLimit = (file: File): boolean => file.size > 0 && file.size <= MAX_BROWSER_AUDIO_BYTES
const fileLimitMessage = (file: File): string => file.size === 0 ? `${file.name} is empty. Choose an audio file that contains data.` : `${file.name} is ${formatBytes(file.size)}. This browser pilot accepts files up to ${formatBytes(MAX_BROWSER_AUDIO_BYTES)} to avoid freezing or losing work; preserve the original and use a smaller access copy here.`

const syncConditionalSelect = (select: HTMLSelectElement, other: HTMLInputElement): void => {
  const needsOther = select.value === "other"
  other.hidden = !needsOther
  other.required = needsOther
  if (!needsOther) other.value = ""
}

const clearValidationState = (): void => {
  form.querySelectorAll<HTMLElement>(".is-invalid").forEach((element) => element.classList.remove("is-invalid"))
  form.querySelectorAll<HTMLElement>("[aria-invalid='true']").forEach((element) => element.removeAttribute("aria-invalid"))
}

const validatePassportForm = (): boolean => {
  clearValidationState()
  const missing: string[] = []
  const invalidControls: HTMLElement[] = []
  const requireValue = (control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, label: string): void => {
    if (!control.value.trim()) {
      missing.push(label)
      invalidControls.push(control)
    }
  }

  requireValue(getInput("#title"), "title")
  requireValue(getInput("#creator"), "creator or contributor")
  requireValue(languageSelect, "language")
  if (languageSelect.value === "other") requireValue(languageOther, "other language")
  requireValue(getInput("#place"), "place")
  requireValue(collectionSelect, "collection")
  if (collectionSelect.value === "other") requireValue(collectionOther, "other collection")
  requireValue(getTextArea("#context"), "why the recording matters")
  requireValue(rightsBasisSelect, "rights or consent basis")
  if (rightsBasisSelect.value === "other") requireValue(getTextArea("#rights"), "rights explanation")

  const evidenceUrl = getInput("#evidence-url")
  if (evidenceUrl.value && !isPublicEvidenceUrl(evidenceUrl.value)) {
    missing.push("a complete evidence URL beginning with http:// or https://")
    invalidControls.push(evidenceUrl)
  }

  if (currentMode() === "present" && !selectedFile) {
    missing.push("audio file")
    invalidControls.push(fileInput)
  }
  if (currentMode() === "present" && !rightsCheck.checked) {
    missing.push("permission confirmation")
    invalidControls.push(rightsCheck)
  }

  invalidControls.forEach((control) => {
    control.setAttribute("aria-invalid", "true")
    ;(control.closest<HTMLElement>("label, .field-control, .dropzone") ?? control).classList.add("is-invalid")
  })

  if (!missing.length) return true

  formMessage.innerHTML = `<strong>The passport was not created yet.</strong><span>Please complete: ${escapeHtml(missing.join(", "))}.</span>`
  const first = invalidControls[0]
  ;(first.closest<HTMLElement>("label, .field-control, .dropzone") ?? first).scrollIntoView({ behavior: "smooth", block: "center" })
  window.setTimeout(() => first.focus({ preventScroll: true }), 350)
  return false
}

const showUnavailableReceipt = (): void => {
  currentManifest = null
  transferButton.disabled = true
  liveReceipt.innerHTML = `<div class="empty-receipt"><p class="eyebrow">Local record unavailable</p><h3>This passport is no longer available in this browser.</h3><p>No record was recreated or exported. Choose a currently saved passport below, or restore your JSON backup.</p><a href="#corpus">Choose a saved passport →</a></div>`
}

const renderReceipt = (manifest: ArchiveManifest, highlightedDerivativeId?: string): void => {
  const sourceLine = manifest.source
    ? `${escapeHtml(manifest.source.filename)} · ${formatBytes(manifest.source.bytes)}`
    : "Original source missing · recovery record only"
  const statusLabel = manifest.status === "fingerprinted" ? "Fingerprint created" : "Recovery lead"
  const derivativeRows = (manifest.derivatives ?? []).map((derivative) => `
    <li>
      <details class="intervention-saved-detail" data-derivative-id="${escapeHtml(derivative.derivativeId)}" ${derivative.derivativeId === highlightedDerivativeId ? "open" : ""}>
        <summary><strong>${escapeHtml(derivative.label)}</strong><span>${escapeHtml(derivative.purpose)} · ${escapeHtml(derivative.source.filename)}</span></summary>
        ${interventionReceipt(derivative)}
      </details>
    </li>
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
      <div class="full-row"><dt>Cultural context</dt><dd>${escapeHtml(manifest.context)}</dd></div>
      <div class="full-row"><dt>Source rights / consent declaration</dt><dd>${escapeHtml(manifest.rightsBasis)}</dd></div>
      <div class="full-row"><dt>Evidence / recovery lead</dt><dd>${manifest.evidenceUrl && isPublicEvidenceUrl(manifest.evidenceUrl) ? `<a href="${escapeHtml(manifest.evidenceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(manifest.evidenceUrl)}</a>` : "Not recorded"}</dd></div>
      <div class="full-row"><dt>Integrity fingerprint</dt><dd class="mono">${escapeHtml(shortFingerprint(manifest))}</dd></div>
    </dl>
    <div class="citation-box"><span>Research citation</span><p>${escapeHtml(citationFor(manifest))}</p></div>
    ${derivativeRows ? `<div class="derivative-receipts"><span>Documented derivatives</span><ul>${derivativeRows}</ul></div>` : ""}
    <div class="receipt-actions">
      <button class="button quiet" id="download-passport" type="button">Download JSON</button>
      <button class="button quiet" id="copy-citation" type="button">Copy citation</button>
    </div>
    <div class="receipt-actions module-next-actions"><a class="button quiet" href="./atlas/">Find it in Music Atlas →</a>${manifest.source ? `<a class="button quiet" href="./restoration/?passport=${encodeURIComponent(manifest.archiveId)}#lab">Create an access copy →</a>` : ""}</div>
    <button class="text-button delete-local" id="delete-passport" type="button">Delete this local record</button>
    <p class="receipt-foot">Saved only in this browser. Export it to create a real backup.</p>
  `
  liveReceipt.tabIndex = -1
  document.querySelector<HTMLButtonElement>("#download-passport")!.addEventListener("click", () => {
    const latest = readCorpus().find((item) => item.archiveId === manifest.archiveId)
    if (!latest) { showUnavailableReceipt(); return }
    currentManifest = latest
    renderReceipt(latest, highlightedDerivativeId)
    downloadManifest(latest)
  })
  document.querySelector<HTMLButtonElement>("#copy-citation")!.addEventListener("click", async (event) => {
    const button = event.currentTarget as HTMLButtonElement
    const latest = readCorpus().find((item) => item.archiveId === manifest.archiveId)
    if (!latest) { showUnavailableReceipt(); return }
    try { await navigator.clipboard.writeText(citationFor(latest)); button.textContent = "Citation copied" }
    catch { button.textContent = "Select and copy the citation above" }
  })
  document.querySelector<HTMLButtonElement>("#delete-passport")!.addEventListener("click", () => {
    const confirmed = window.confirm(`Delete “${manifest.title}” from this browser? Export the JSON first if you need a backup.`)
    if (!confirmed) return
    corpus = removeFromCorpus(manifest.archiveId)
    currentManifest = null
    liveReceipt.innerHTML = `
      <div class="empty-receipt">
        <p class="eyebrow">Local record deleted</p>
        <h3>The passport was removed from this browser.</h3>
        <p>The audio file was never stored here. You can create or import another passport at any time.</p>
      </div>
    `
    renderCorpus()
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
            <span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.creator)} · ${escapeHtml(item.recordedOn || "date unknown")}${item.derivatives?.length ? ` · ${item.derivatives.length} derivative${item.derivatives.length === 1 ? "" : "s"}` : ""}</small></span>
            <span>${escapeHtml(item.language)}</span>
            <span class="status-chip ${item.status}">${item.status === "fingerprinted" ? "Fingerprint recorded" : "Recovery lead"}</span>
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
  const selectedVerify = verifyPassport.value
  const selectedDerivative = derivativePassport.value
  verifyPassport.innerHTML = fingerprinted.length
    ? `<option value="">Choose a local passport</option>${fingerprinted.map((item) => `<option value="${escapeHtml(item.archiveId)}">${escapeHtml(item.title)} — ${escapeHtml(shortFingerprint(item))}</option>`).join("")}`
    : '<option value="">No fingerprinted passports yet</option>'
  derivativePassport.innerHTML = fingerprinted.length
    ? `<option value="">Choose a fingerprinted source master</option>${fingerprinted.map((item) => `<option value="${escapeHtml(item.archiveId)}">${escapeHtml(item.title)} — ${escapeHtml(shortFingerprint(item))}</option>`).join("")}`
    : '<option value="">No fingerprinted passports yet</option>'
  verifyPassport.value = selectedVerify; derivativePassport.value = selectedDerivative
  const selectedMaster = corpus.find((item) => item.archiveId === selectedDerivative)
  document.querySelector<HTMLElement>("#intervention-source-note")!.textContent = selectedMaster?.source
    ? `Declared source: ${selectedMaster.source.filename} · SHA-256 ${shortFingerprint(selectedMaster)}. This link does not prove how an external tool processed the file.`
    : "Create or import a fingerprinted passport first. Selecting it declares which source this copy came from."
  getInput("#export-json").disabled = corpus.length === 0
  getInput("#export-csv").disabled = corpus.length === 0
}

const refreshActiveReceipt = (): void => {
  if (!currentManifest) return
  const latest = corpus.find((item) => item.archiveId === currentManifest!.archiveId)
  if (!latest) { showUnavailableReceipt(); return }
  if (JSON.stringify(latest) === JSON.stringify(currentManifest)) return
  const openIds = new Set([...liveReceipt.querySelectorAll<HTMLDetailsElement>("details[open][data-derivative-id]")].map((detail) => detail.dataset.derivativeId))
  currentManifest = latest
  renderReceipt(latest)
  for (const detail of liveReceipt.querySelectorAll<HTMLDetailsElement>("details[data-derivative-id]")) {
    if (openIds.has(detail.dataset.derivativeId)) detail.open = true
  }
}

const setSelectedFile = (file: File): boolean => {
  if (!fileWithinBrowserLimit(file)) {
    selectedFile = null
    fileLabel.textContent = "Choose an audio file"
    fileMeta.textContent = `Browser pilot limit ${formatBytes(MAX_BROWSER_AUDIO_BYTES)}`
    audioPreview.hidden = true
    formMessage.textContent = fileLimitMessage(file)
    return false
  }
  selectedFile = file
  fileLabel.textContent = file.name
  fileMeta.textContent = `${formatBytes(file.size)} · ${file.type || "audio"}`
  if (audioPreview.src) URL.revokeObjectURL(audioPreview.src)
  audioPreview.src = URL.createObjectURL(file)
  audioPreview.hidden = false
  return true
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
languageSelect.addEventListener("change", () => syncConditionalSelect(languageSelect, languageOther))
collectionSelect.addEventListener("change", () => syncConditionalSelect(collectionSelect, collectionOther))
form.addEventListener("input", (event) => {
  const control = event.target as HTMLElement
  control.removeAttribute("aria-invalid")
  control.closest<HTMLElement>("label, .field-control, .dropzone")?.classList.remove("is-invalid")
})
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
  languageSelect.value = "Instrumental / no linguistic content"
  syncConditionalSelect(languageSelect, languageOther)
  collectionSelect.value = "Unassigned research record"
  syncConditionalSelect(collectionSelect, collectionOther)
  getInput("#evidence-url").value = ""
  getInput("#place").value = "Generated locally in the browser"
  getInput("#recorded-on").value = localIsoDate()
  getTextArea("#context").value = "A four-second rights-clear synthetic clip that demonstrates passport creation, fingerprinting, corpus storage, export, and later verification."
  rightsBasisSelect.value = "I created or performed this recording and control this source file."
  getTextArea("#rights").value = "Generated locally by this application. No third-party recording or performance is included."
  rightsCheck.checked = true
  clearValidationState()
  formMessage.textContent = "Safe demo loaded. Select “Create passport → see result” to generate it now."
  form.scrollIntoView({ behavior: "smooth", block: "start" })
})

document.querySelector<HTMLButtonElement>("#quick-demo")!.addEventListener("click", () => {
  document.querySelector<HTMLButtonElement>("#load-demo")!.click()
  form.requestSubmit()
})

form.addEventListener("submit", async (event) => {
  event.preventDefault()
  if (createButton.disabled) return
  const mode = currentMode()
  if (!validatePassportForm()) return

  let snapshot: ReturnType<typeof capturePassportSubmission>
  try {
    snapshot = capturePassportSubmission(mode, selectedFile, getInput("#rights-check").checked, {
      collection: selectedOrOther(collectionSelect, collectionOther),
      title: getInput("#title").value.trim(), creator: getInput("#creator").value.trim(),
      language: selectedOrOther(languageSelect, languageOther), place: getInput("#place").value.trim(),
      recordedOn: getInput("#recorded-on").value || undefined, context: getTextArea("#context").value.trim(),
      rightsBasis: selectedRightsBasis(), evidenceUrl: getInput("#evidence-url").value.trim() || undefined,
    })
  } catch (error) {
    formMessage.textContent = error instanceof Error ? error.message : "The passport details could not be captured."
    return
  }

  createButton.disabled = true
  createButton.textContent = mode === "present" ? "Fingerprinting every byte…" : "Documenting recovery record…"
  formMessage.textContent = "Building the archival passport locally…"

  try {
    const digest = snapshot.file ? await sha256(snapshot.file) : undefined
    currentManifest = completePassportSubmission(snapshot, digest)
    const source = currentManifest.source
    corpus = saveToCorpus(currentManifest)
    renderReceipt(currentManifest)
    renderCorpus()
    formMessage.textContent = source
      ? "Passport saved. You can now verify this file, export the record, or optionally transfer it to Audiotool."
      : "Recovery record saved. It remains explicitly unverified until a source file is recovered."
    liveReceipt.classList.remove("result-ready")
    window.requestAnimationFrame(() => liveReceipt.classList.add("result-ready"))
    if (window.matchMedia("(max-width: 900px)").matches) {
      liveReceipt.scrollIntoView({ behavior: "smooth", block: "start" })
    }
    transferButton.disabled = !(client && source && projectSelect.value)
  } catch (error) {
    formMessage.textContent = error instanceof Error ? error.message : "The passport could not be created."
  } finally {
    createButton.disabled = false
    createButton.textContent = "Create passport → see result"
  }
})

derivativeFileInput.addEventListener("change", () => {
  derivativeFile = derivativeFileInput.files?.[0] ?? null
  if (derivativeFile && !fileWithinBrowserLimit(derivativeFile)) {
    derivativeMessage.textContent = fileLimitMessage(derivativeFile)
    derivativeFile = null
  }
  derivativeFileLabel.textContent = derivativeFile ? `${derivativeFile.name} · ${formatBytes(derivativeFile.size)}` : "Choose the derived audio file"
})

derivativePassport.addEventListener("change", () => renderCorpus())
derivativeForm.addEventListener("change", () => syncInterventionForm(derivativeForm))
derivativeForm.addEventListener("input", (event) => {
  const control = event.target as HTMLElement
  control.removeAttribute("aria-invalid")
})
syncInterventionForm(derivativeForm)

const showDerivativeError = (error: unknown): void => {
  derivativeMessage.textContent = error instanceof Error ? error.message : "The derivative could not be registered."
  if (error instanceof InterventionFormError) {
    const control = derivativeForm.querySelector<HTMLElement>(`#${error.fieldId}`)
    const disclosureDetails = control?.closest<HTMLDetailsElement>("details")
    if (disclosureDetails) disclosureDetails.open = true
    control?.setAttribute("aria-invalid", "true")
    control?.focus()
    control?.scrollIntoView({ behavior: "smooth", block: "center" })
  }
}

derivativeForm.addEventListener("submit", async (event) => {
  event.preventDefault()
  if (derivativeButton.disabled) return
  syncInterventionForm(derivativeForm)
  const master = readCorpus().find((item) => item.archiveId === derivativePassport.value)
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
  // Copy controls, the chosen file, and the selected master before hashing can yield.
  let snapshot: ReturnType<typeof captureDerivativeSubmission>
  try { snapshot = captureDerivativeSubmission(master, derivativeFile, readInterventionFields(derivativeForm)) }
  catch (error) { showDerivativeError(error); return }
  derivativeButton.disabled = true
  derivativeButton.textContent = "Fingerprinting derivative…"
  derivativeMessage.textContent = "Linking the derivative to its preserved master locally…"
  try {
    const digest = await sha256(snapshot.file)
    const latestMaster = readCorpus().find((item) => item.archiveId === snapshot.master.archiveId)
    const updated = completeDerivativeSubmission(snapshot, latestMaster, digest)
    corpus = updateInCorpus(updated)
    currentManifest = updated
    renderReceipt(updated, updated.derivatives?.at(-1)?.derivativeId)
    renderCorpus()
    derivativeMessage.textContent = "Derivative registered. Export the updated passport JSON to preserve the intervention record."
    derivativeButton.textContent = "Derivative registered"
    liveReceipt.classList.add("result-ready")
    liveReceipt.focus({ preventScroll: true })
    liveReceipt.scrollIntoView({ behavior: "smooth", block: "start" })
  } catch (error) {
    showDerivativeError(error)
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
    const parsed = JSON.parse(await file.text()) as unknown
    if (!isArchiveManifest(parsed) || !parsed.source?.sha256) throw new Error("This is not a complete, compatible fingerprinted Archive Passport receipt.")
    verificationTarget = parsed
    verifyPassport.value = ""
    verifyTargetNote.textContent = `Imported “${parsed.title}” · ${shortFingerprint(parsed)}`
    verifyButton.disabled = !verificationFile
    verifyResult.hidden = true
  } catch (error) {
    verificationTarget = null
    verifyButton.disabled = true
    verifyResult.hidden = true
    verifyTargetNote.textContent = error instanceof Error ? error.message : "Receipt could not be read."
  }
})

verifyFile.addEventListener("change", () => {
  verificationFile = verifyFile.files?.[0] ?? null
  if (verificationFile && !fileWithinBrowserLimit(verificationFile)) {
    verifyTargetNote.textContent = fileLimitMessage(verificationFile)
    verificationFile = null
  }
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
    verificationTarget = null
    verifyPassport.value = ""
    verifyTargetNote.textContent = "Create the safe demo passport in Step 01 first; then this file can prove the match."
  }
  verifyButton.disabled = !(verificationTarget?.source && verificationFile)
  verifyResult.hidden = true
})

verifyButton.addEventListener("click", async () => {
  if (!verificationTarget?.source || !verificationFile) return
  const target = structuredClone(verificationTarget)
  const checkedFile = verificationFile
  verifyButton.disabled = true
  verifyButton.textContent = "Comparing every byte…"
  try {
    const digest = await sha256(checkedFile)
    const matches = sameSha256(digest, target.source!.sha256)
    verifyResult.hidden = false
    verifyResult.className = `verify-result ${matches ? "match" : "mismatch"}`
    verifyResult.innerHTML = matches
      ? `<strong>Exact match.</strong><p>This file is byte-for-byte identical to the source in the passport.</p><code>${escapeHtml(digest)}</code>`
      : `<strong>Not the same file.</strong><p>The bytes differ. This may be an edit, re-export, transcoding, or another recording.</p><code>Expected ${escapeHtml(target.source!.sha256)}<br />Found ${escapeHtml(digest)}</code>`

    const localTarget = readCorpus().find((item) => item.archiveId === target.archiveId && sameSha256(item.source?.sha256, target.source!.sha256))
    if (matches && localTarget) {
      localTarget.events.push({ type: "verified", at: new Date().toISOString(), note: `Matched ${checkedFile.name}` })
      corpus = updateInCorpus(localTarget)
      renderCorpus()
    }
  } catch {
    verifyResult.hidden = false
    verifyResult.className = "verify-result mismatch"
    verifyResult.innerHTML = "<strong>Comparison could not finish.</strong><p>The browser did not change or upload the file. Try a smaller local copy or reload the tool.</p>"
  } finally {
    verifyButton.disabled = false
    verifyButton.textContent = "Compare every byte"
  }
})

document.querySelector<HTMLButtonElement>("#export-json")!.addEventListener("click", () => exportCorpusJson(corpus))
document.querySelector<HTMLButtonElement>("#export-csv")!.addEventListener("click", () => exportCorpusCsv(corpus))
getInput("#import-corpus-button").addEventListener("click", () => getInput("#import-corpus").click())
getInput("#import-corpus").addEventListener("change", async (event) => {
  const input = event.currentTarget as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const status = document.querySelector<HTMLElement>("#import-corpus-status")!
  try {
    const count = importPassportJson(await file.text())
    corpus = readCorpus(); renderCorpus()
    status.textContent = count ? `${count} passport(s) imported. Choose a receipt below to inspect it.` : "These passports are already saved. No duplicates were added."
  } catch (error) { status.textContent = error instanceof Error ? error.message : "The backup could not be imported." }
  input.value = ""
})

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
    if (!sameSha256(digest, currentManifest.source.sha256)) throw new Error("The selected file no longer matches the active passport.")
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
mountCorpusWarning()
renderCorpus()
window.addEventListener("storage", () => { corpus = readCorpus(); renderCorpus(); refreshActiveReceipt() })
const requestedPassport = new URLSearchParams(window.location.search).get("passport")
const requestedManifest = corpus.find((item) => item.archiveId === requestedPassport)
if (requestedManifest) { currentManifest = requestedManifest; renderReceipt(requestedManifest) }
void initAudiotool()
restoreInitialFragment()
