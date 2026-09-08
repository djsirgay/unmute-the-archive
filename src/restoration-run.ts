import { addDerivative, type ArchiveManifest } from "./manifest"
import type { ProcessSettings } from "./audio-utils"

export const settingsText = (value: ProcessSettings): string => `${value.highpass ? `High-pass ${value.highpass} Hz` : "High-pass off"}; ${value.lowpass ? `low-pass ${value.lowpass} Hz` : "low-pass off"}; gain ${value.gainDb >= 0 ? "+" : ""}${value.gainDb} dB; ${value.normalize ? "peak normalization to 95%" : "no normalization"}; output 16-bit PCM WAV.`

export type CompletedRun = {
  sourceHash: string
  settings: ProcessSettings
  purpose: string
  reviewerNote: string
  source: NonNullable<ArchiveManifest["source"]>
  label: string
}

export const registerCompletedRun = (manifest: ArchiveManifest, run: CompletedRun): ArchiveManifest => {
  if (manifest.source?.sha256 !== run.sourceHash) throw new Error("This derivative was made from a different source file. Select the matching passport.")
  return addDerivative(manifest, {
    label: run.label, purpose: run.purpose || "Research access copy", method: "Web Audio API transparent browser signal chain.",
    changeLog: settingsText(run.settings), reviewerNote: run.reviewerNote || undefined, source: run.source,
  })
}
