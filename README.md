# Unmute the Archive

Unmute the Archive is a provenance-aware bridge from vulnerable cultural recordings to collaborative Audiotool sessions. It asks for the context and permission that usually disappear during upload, fingerprints the original source, uploads it as an unlisted Audiotool sample, and inserts it into a chosen project through the Nexus SDK.

## Why it exists

Musical archives are often treated as piles of files. Once a recording enters a production workflow, the names, languages, places, consent, and human relationships around it are easily lost. This app keeps that story attached to the first creative handoff.

The prototype grew from Sergéy Ulyanov's work with Belarusian-language music and Nostalgai Recordz, a U.S.-based independent label supporting artists in exile.

## What the app does

1. Collects essential provenance: title, contributor/community, language, place, context, and consent basis.
2. Keeps the source file local until the user explicitly starts the transfer.
3. Calculates a SHA-256 fingerprint for the original file.
4. Authenticates the user with Audiotool OAuth (`project:write`).
5. Uploads the source as an **unlisted** sample.
6. Opens the selected Audiotool project through Nexus and inserts the sample on its timeline.
7. Produces a portable JSON receipt linking the original fingerprint to the Audiotool destination.

The included synthetic demo clip is generated in the browser and contains no third-party material. It lets judges test the complete flow without providing their own recording.

## Nexus integration

The meaningful DAW interaction is implemented in `src/main.ts`:

```ts
const upload = await client.samples.upload({
  displayName: title,
  file: selectedFile,
  visibility: "unlisted",
})

const sample = await upload.ready
const nexus = await client.open(projectUrl)
await nexus.start()
await nexus.modify((transaction) => transaction.insertSample(sample))
await nexus.stop()
```

This is a real write operation against the selected Audiotool session, not a simulated integration.

## Run locally

Requirements: Node.js 22+ and an Audiotool developer application.

1. Register an app at <https://developer.audiotool.com/applications>.
2. Use the redirect URI `http://127.0.0.1:5173/` and scope `project:write`.
3. Copy `.env.example` to `.env` and add the public client ID.
4. Install and run:

```bash
npm install
npm run dev
```

Open <http://127.0.0.1:5173/>.

## Deploy

The repository includes a GitHub Pages workflow. Add `VITE_AUDIOTOOL_CLIENT_ID` as a GitHub Actions repository variable and register the final Pages URL (including the trailing slash) as an Audiotool redirect URI.

## Privacy and rights

- Source audio stays in the browser until the user explicitly presses the transfer button.
- Uploaded samples are unlisted.
- The app does not store audio or manifests on its own server.
- Users must confirm that they hold the rights or permission needed to upload and reuse a recording.

## Built by

Sergéy Ulyanov — creative technologist, musician, and founder of Nostalgai Recordz.
