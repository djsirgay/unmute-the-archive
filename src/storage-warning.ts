import { corpusStorageIssue } from "./corpus"
import "./storage-warning.css"

export const mountCorpusWarning = (): void => {
  const main = document.querySelector("main")
  if (!main) return
  const update = (): void => {
    document.querySelector("#corpus-storage-warning")?.remove()
    const issue = corpusStorageIssue()
    if (!issue) return
    const banner = document.createElement("section")
    banner.id = "corpus-storage-warning"
    banner.className = "storage-warning shell"
    banner.setAttribute("role", "alert")
    const heading = document.createElement("h2")
    heading.textContent = issue.kind === "damaged" ? "Saved data needs attention" : "Local storage is unavailable"
    const message = document.createElement("p")
    message.textContent = issue.message
    banner.append(heading, message)
    if (issue.raw !== undefined) {
      const button = document.createElement("button")
      button.type = "button"
      button.textContent = "Download original data for recovery"
      button.addEventListener("click", () => {
        const url = URL.createObjectURL(new Blob([issue.raw!], { type: "application/json" }))
        const link = document.createElement("a")
        link.href = url
        link.download = "unmute-corpus-recovery-original.json"
        link.click()
        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      })
      banner.append(button)
    }
    main.prepend(banner)
  }
  update()
  window.addEventListener("storage", update)
}
