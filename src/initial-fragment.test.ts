import { afterEach, expect, test, vi } from "vitest"
import { restoreInitialFragment } from "./initial-fragment"
afterEach(() => vi.unstubAllGlobals())
function setup(hash: string) {
  const scroll = vi.fn(), getElementById = vi.fn(() => ({ scrollIntoView: scroll }))
  let frame = () => {}; const events = new Map<string, () => void>()
  const location = { hash }
  vi.stubGlobal("window", { location, addEventListener: (name: string, fn: () => void) => events.set(name, fn), requestAnimationFrame: (fn: () => void) => { frame = fn } })
  vi.stubGlobal("document", { getElementById })
  return { scroll, getElementById, location, run: () => frame(), interact: () => events.get("pointerdown")?.() }
}
test("restores a mounted fragment without depending on initial server HTML", () => {
  const state=setup("#derivative"); restoreInitialFragment(); expect(state.scroll).not.toHaveBeenCalled()
  state.run(); expect(state.getElementById).toHaveBeenCalledWith("derivative"); expect(state.scroll).toHaveBeenCalledWith({ behavior: "instant", block: "start" })
})
test("does not displace someone who has begun interacting", () => {
  const state=setup("#guide"); restoreInitialFragment(); state.interact(); state.run(); expect(state.scroll).not.toHaveBeenCalled()
})
test("does not restore a stale hash after navigation", () => {
  const state=setup("#guide"); restoreInitialFragment(); state.location.hash="#create"; state.run(); expect(state.scroll).not.toHaveBeenCalled()
})
test("decodes a fragment ID without constructing a selector", () => {
  const state=setup("#review%20notes"); restoreInitialFragment(); state.run(); expect(state.getElementById).toHaveBeenCalledWith("review notes")
})
test("ignores absent or malformed fragments", () => {
  for(const hash of ["", "#", "#%XX"]) { const state=setup(hash); restoreInitialFragment(); state.run(); expect(state.getElementById).not.toHaveBeenCalled() }
})
