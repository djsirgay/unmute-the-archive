# Unmute the Archive

Unmute the Archive is a local-first research tool for building verifiable archival passports for cultural recordings. It connects five things that normally get separated: the audio file, its provenance, its rights context, a repeatable integrity check, and its later creative reuse.

The project grew from Sergéy Ulyanov's work with Belarusian-language music and Nostalgai Recordz, a U.S.-based independent label supporting artists in exile.

## The practical problem

A folder of audio files is not yet an archive. Filenames disappear, formats are transcoded, drives are lost, public links break, and the people who remember why a recording mattered become unreachable. When a recording enters a production workflow, its language, place, consent, and cultural context can disappear immediately.

Unmute the Archive creates a portable record before that handoff happens.

## What works now

1. **Create a human-readable archival passport.** Record title, creator or contributor, language, place, date, collection, cultural context, rights basis, and a public evidence link.
2. **Fingerprint an available source.** The browser calculates a SHA-256 digest from every byte without uploading the audio.
3. **Document a lost source honestly.** A missing master can be saved as a metadata-only recovery lead, but it never receives a fabricated fingerprint.
4. **Verify a file later.** Re-select an audio file and compare it with a local or imported passport. An exact match means every byte is identical.
5. **Build a local research corpus.** Passports are stored in the browser and can be exported as JSON for preservation or CSV for analysis.
6. **Create a research citation.** Every passport includes a human-readable citation and a portable JSON receipt.
7. **Search a source-visible Music Atlas.** The live pilot combines five creator-documented records with 13 independently cited Belarusian remix leads, structured filters, evidence dossiers, local corrections, and JSON/CSV export.
8. **Document reversible access copies.** Restoration Lab creates a separate listening derivative, preserves the fingerprinted master, and records every intervention and human review note.
9. **Transfer to Audiotool optionally.** With an Audiotool developer client ID, a fingerprinted source can be uploaded as an unlisted sample and inserted into a selected session through Nexus. The transfer becomes another event in the same passport.

The included four-second demo clip is generated in the browser and contains no third-party recording or performance. It is safe for testing the full local workflow.

## What a fingerprint means

The fingerprint is not a token, blockchain entry, copyright registration, or proof of authorship. It is a SHA-256 checksum: the same bytes produce the same 64-character digest, while a changed, edited, or transcoded file produces a different digest.

That makes the passport useful for a precise question:

> Is the file I have now exactly the file that was documented earlier?

Authorship, dates, consent, and cultural context still require evidence and human judgment.

## Pilot corpus: Belarusian Music in Exile

The corpus has two transparent seed layers. The first begins with Sergéy Ulyanov's own Belarusian-language works from 2016–2026. The second is a source-cited public remix index with 13 records documented by Budzma, 34mag, MusicBrainz, and CityDog. This is intentionally a bounded research pilot, not a claim that Tuzin.fm or the wider Belarusian archive has already been ingested.

The first layer is methodologically useful because creator identity, rights, release context, public evidence, and cultural significance can be documented directly. The public-source layer tests discovery, classification, and evidence visibility beyond the researcher's own catalog. Where an original source was lost with a hard drive, the record remains a recovery lead until an authentic source file is found and fingerprinted.

## Nexus integration

The Audiotool integration is a real write operation, not a simulated button:

```ts
const upload = await client.samples.upload({
  displayName: currentManifest.title,
  file: selectedFile,
  visibility: "unlisted",
})

const sample = await upload.ready
const nexus = await client.open(projectUrl)
await nexus.start()
await nexus.modify((transaction) => transaction.insertSample(sample))
await nexus.stop()
```

## Run locally

Requirements: Node.js 22+.

```bash
npm install
npm run dev
```

Open <http://127.0.0.1:5173/>. Passport creation, fingerprinting, verification, local corpus storage, citations, and exports work without an external account.

To enable Audiotool transfer:

1. Register an app at <https://developer.audiotool.com/applications>.
2. Use `http://127.0.0.1:5173/` as a development redirect URI and request `project:write`.
3. Copy `.env.example` to `.env` and add the public client ID.

## Verify the build

```bash
npm run build
npm test
```

The tests cover fingerprint stability, changed-file detection, explicit missing-source records, citations, CSV export, source-visible Music Atlas queries, and exclusion of incorrectly tagged dance results.

## Privacy and limitations

- Source audio stays on the user's device until an explicit Audiotool transfer.
- Local browser storage is not a backup; export the corpus and keep trusted copies.
- The app does not authenticate people, historical events, rights claims, or dates.
- Metadata is only as reliable as its evidence and the person entering it.
- A public link can support recovery work but cannot replace a fingerprinted master.
- Audiotool transfer requires a registered developer application and has not been represented as active when no client ID is configured.

## Built by

Sergéy Ulyanov — creative technologist, musician, and founder of Nostalgai Recordz.
