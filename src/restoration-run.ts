import { addDerivative, isArchiveManifest, type ArchiveManifest } from "./manifest"
import { isInterventionJournal, sameSha256, type InterventionJournal } from "./intervention"
import type { AudioMetrics, ProcessSettings } from "./audio-utils"

export const settingsText = (value: ProcessSettings): string => `${value.highpass ? `High-pass ${value.highpass} Hz` : "High-pass off"}; ${value.lowpass ? `low-pass ${value.lowpass} Hz` : "low-pass off"}; gain ${value.gainDb >= 0 ? "+" : ""}${value.gainDb} dB; ${value.normalize ? "peak normalization to 95%" : "no normalization"}; output 16-bit PCM WAV.`

export type CompletedRun = {
  sourceHash: string
  settings: ProcessSettings
  purpose: string
  reviewerNote: string
  source: NonNullable<ArchiveManifest["source"]>
  label: string
  /** Captured at production, never read back from subsequently edited controls. */
  processing?: {
    createdAt: string
    applicationVersion?: string
    inputFile: NonNullable<ArchiveManifest["source"]>
    sourceMetrics: AudioMetrics
    resultMetrics: AudioMetrics
  }
  /** Created only after the user explicitly confirms the preserved master. */
  intervention?: InterventionJournal
}

/** Web Audio clamps this parameter; record and apply the same effective value. */
export const effectiveSettings = (requested: ProcessSettings, decodedSampleRate: number): ProcessSettings => ({
  ...requested,
  lowpass: requested.lowpass > 0 ? Math.min(requested.lowpass, decodedSampleRate / 2 - 1) : 0,
})

/** This only records a note. It must never silently mark a listening review complete. */
export const withPendingReviewNote = (run: CompletedRun, note: string): CompletedRun => {
  const copy = structuredClone(run)
  copy.reviewerNote = note.trim()
  if (copy.intervention) copy.intervention.review = { status: "pending", ...(copy.reviewerNote ? { note: copy.reviewerNote } : {}) }
  return copy
}

export const withMasterAttestation = (run: CompletedRun, confirmed: boolean): CompletedRun => {
  const copy = structuredClone(run)
  delete copy.intervention
  if (!confirmed) return copy
  const details = copy.processing
  if (!details || !sameSha256(details.inputFile.sha256, copy.sourceHash)) throw new Error("The completed run needs its original processing snapshot before it can be documented.")
  copy.intervention = {
    schema: "unmute-intervention/1.0", sourceMasterSha256: copy.sourceHash, processingType: "non-ai",
    tool: {
      name: { status: "provided", value: "Browser Web Audio API" },
      version: details.applicationVersion ? { status: "provided", value: `Unmute the Archive application ${details.applicationVersion}; browser audio engine version not recorded` } : { status: "unknown" },
      model: { status: "not-applicable" },
    },
    instruction: { status: "provided", value: `Create a separate local listening access copy for: ${copy.purpose}. Apply the captured DSP settings; do not replace or upload the source file.` },
    settings: { status: "provided", value: JSON.stringify({
      ...copy.settings, outputEncoding: "16-bit PCM WAV", filterQ: 0.707,
      decodedProcessingSampleRateHz: details.sourceMetrics.sampleRate,
      sourceMetricsBasis: "Decoded audio; browser decoding may resample. Not the original file's encoded sample rate.",
      resultMetricsBasis: "Rendered audio before 16-bit PCM quantization.",
      createdAt: details.createdAt, inputFile: details.inputFile,
      sourceMetrics: details.sourceMetrics, resultMetrics: details.resultMetrics,
    }) },
    authority: { basis: "unknown", scope: "Not assessed; documentation only. No permission for redistribution, external processing, or reuse is established by this record." },
    changes: settingsText(copy.settings),
    preservedFeatures: "Preservation of audible features has not been assessed by a human reviewer. The source master is retained separately, as confirmed by the user.",
    uncertainty: "Human listening review is pending. Decoding may resample; filtering, normalization, and 16-bit quantization can alter the sound. No AI reconstruction, source separation, or authenticity assessment was performed.",
    review: { status: "pending", ...(copy.reviewerNote ? { note: copy.reviewerNote } : {}) },
    originalUnchanged: true,
  }
  return copy
}

/** One journal snapshot is shared by the portable log and the registered passport. */
export const restorationLog = (run: CompletedRun, parentArchiveId: string | null) => {
  if (!run.processing || !run.intervention || !isInterventionJournal(run.intervention)) throw new Error("Confirm that the source master is preserved before exporting its intervention journal.")
  if (!sameSha256(run.sourceHash, run.intervention.sourceMasterSha256)) throw new Error("The intervention journal names a different source master.")
  return structuredClone({
    schema: "unmute-restoration/1.1", createdAt: run.processing.createdAt, parentArchiveId,
    purpose: run.purpose, reviewerNote: run.reviewerNote,
    source: { ...run.processing.inputFile, metrics: run.processing.sourceMetrics },
    derivative: { ...run.source, metrics: run.processing.resultMetrics },
    processing: { engine: "Browser Web Audio API", applicationVersion: run.processing.applicationVersion ?? "unknown", ...run.settings, summary: settingsText(run.settings), decodedProcessingSampleRateHz: run.processing.sourceMetrics.sampleRate },
    intervention: run.intervention,
    boundaries: ["Source bytes were not modified by this tool; continued preservation was confirmed by the user.", "No AI reconstruction or source separation was performed.", "The derivative is an access copy, not a replacement master.", "Decoded input metrics may reflect browser resampling; output metrics precede 16-bit quantization.", "This journal documents declarations; it does not grant rights or certify authenticity."],
  })
}

export const registerCompletedRun = (manifest: ArchiveManifest, run: CompletedRun): ArchiveManifest => {
  if (!sameSha256(manifest.source?.sha256, run.sourceHash)) throw new Error("This derivative was made from a different source file. Select the matching passport.")
  if (run.processing && !run.intervention) throw new Error("Confirm that the source master is preserved before registering the intervention journal.")
  return addDerivative(manifest, {
    label: run.label, purpose: run.purpose || "Research access copy", method: "Web Audio API transparent browser signal chain.",
    changeLog: settingsText(run.settings), reviewerNote: run.reviewerNote || undefined, source: run.source,
    ...(run.intervention ? { intervention: run.intervention } : {}),
  })
}

/** Explicitly save a later pending note without reprocessing or replacing a different record. */
export const saveRegisteredRunNote = (manifest: ArchiveManifest, derivativeId: string, run: CompletedRun): ArchiveManifest => {
  if (!isArchiveManifest(manifest) || !sameSha256(manifest.source?.sha256, run.sourceHash)) throw new Error("The saved passport no longer matches this source master.")
  const item = manifest.derivatives?.find((value) => value.derivativeId === derivativeId)
  if (!item?.intervention || !run.intervention || !sameSha256(item.source.sha256, run.source.sha256)) throw new Error("The saved derivative no longer matches this completed run.")
  if (item.intervention.review.status !== "pending" || run.intervention.review.status !== "pending") throw new Error("An existing human review cannot be replaced by a pending note.")
  const withoutReview = (value: InterventionJournal) => { const { review: _review, ...processing } = value; return processing }
  if (JSON.stringify(withoutReview(item.intervention)) !== JSON.stringify(withoutReview(run.intervention))) throw new Error("The saved processing record changed. Reopen the passport before editing its note.")
  const updated = structuredClone(manifest)
  const target = updated.derivatives!.find((value) => value.derivativeId === derivativeId)!
  target.reviewerNote = run.reviewerNote || undefined
  target.intervention!.review = structuredClone(run.intervention.review)
  updated.updatedAt = new Date().toISOString()
  updated.events.push({ type: "documented", at: updated.updatedAt, note: `Updated pending listening note for derivative ${target.derivativeId}; processing and file hashes unchanged.` })
  if (!isArchiveManifest(updated)) throw new Error("The updated note is incomplete or invalid.")
  return updated
}
