export const escapeHtml = (value: string | number | undefined): string => String(value ?? "").replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
  '"': "&quot;",
})[character]!)

export const suiteHeader = (active: "passport" | "atlas" | "restoration"): string => `
  <header class="suite-header" id="top">
    <nav class="suite-primary shell" aria-label="Unmute Belarus primary navigation">
      <a class="suite-brand" href="/research/system/"><span>U/A</span><strong>Unmute Belarus</strong></a>
      <div><a href="/research/">Research</a><a href="/research/system/">System map</a><a href="/research/tools/unmute-the-archive/#guide">Guide</a></div>
    </nav>
    <nav class="suite-modules" aria-label="Research modules">
      <div class="shell">
        <a class="${active === "passport" ? "current" : ""}" href="/research/tools/unmute-the-archive/"><b>01</b><span>Archive Passport<small>Live</small></span></a>
        <a class="${active === "atlas" ? "current" : ""}" href="/research/tools/unmute-the-archive/atlas/"><b>02</b><span>Music Atlas<small>Live pilot</small></span></a>
        <a class="${active === "restoration" ? "current" : ""}" href="/research/tools/unmute-the-archive/restoration/"><b>03</b><span>Restoration Lab<small>Live pilot</small></span></a>
        <a href="/research/tools/unmute-the-archive/atlas/#analytics"><b>DATA</b><span>Corpus &amp; analytics<small>Local + reviewer set</small></span></a>
      </div>
    </nav>
  </header>
`

export const suiteFooter = (): string => `
  <footer class="suite-footer shell">
    <a class="suite-brand" href="/research/system/"><span>U/A</span><strong>Unmute Belarus</strong></a>
    <p>Practice-led research prototype · local-first · source-visible · community-correctable</p>
    <a href="/research/">Sergéy Ulyanov research ↗</a>
  </footer>
`

export const confidenceLabel = (value: "high" | "medium" | "recovery"): string => ({
  high: "High evidence",
  medium: "Developing evidence",
  recovery: "Recovery lead",
})[value]

