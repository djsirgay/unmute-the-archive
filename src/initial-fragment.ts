/** The browser cannot find fragment targets before the JS app has mounted. */
export const restoreInitialFragment = (): void => {
  const hash = window.location.hash
  if (!hash || hash === "#") return
  let id: string
  try { id = decodeURIComponent(hash.slice(1)) } catch { return }
  const controller = new AbortController()
  let interacted = false
  for (const name of ["wheel", "pointerdown", "keydown", "touchstart"]) {
    window.addEventListener(name, () => { interacted = true }, { once: true, passive: true, signal: controller.signal })
  }
  window.requestAnimationFrame(() => {
    controller.abort()
    if (interacted || window.location.hash !== hash) return
    document.getElementById(id)?.scrollIntoView({ behavior: "instant", block: "start" })
  })
}
