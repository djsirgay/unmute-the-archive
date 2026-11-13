import { escapeHtml } from "./suite-shell"

const webUrl = (value?: string): string | undefined => {
  if (!value) return
  try {
    const url = new URL(value)
    if ((url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password) return url.href
  } catch { /* A missing or invalid URL is not evidence. */ }
}

export function renderAtlasLinks(links: { source?: string; recording?: string; sourceLabel?: string }, be = false): string {
  const source = webUrl(links.source)
  const recording = webUrl(links.recording)
  const anchor = (url: string, label: string, css = ""): string => `<a class="suite-button${css}" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`
  return `<div class="suite-actions compact atlas-link-actions">${source ? anchor(source, be ? "Адкрыць крыніцу" : "Open source") : ""}${recording ? anchor(recording, be ? "Паслухаць запіс" : "Listen to recording", " primary") : `<span class="atlas-note">${be ? "Няма праверанай спасылкі на запіс" : "No verified listening link"}</span>`}</div>${source && links.sourceLabel ? `<small class="atlas-note">${escapeHtml(links.sourceLabel)}</small>` : ""}`
}
