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
7. **Search a source-visible Music Atlas.** Two explicitly separate scopes: live external Wikidata music/artist discovery (CC0 metadata), and five creator-documented records plus 13 cited remix leads / local passports. External discovery supports editable artist/title/context, source genre, era, format and documented work-language criteria; mood is recorded as an unapplied preference. The local corpus retains evidence dossiers, annotations, its six-page source register and JSON/CSV reports. Neither scope claims complete coverage of Belarusian music or global semantic/audio search.
8. **Document reversible access copies.** Restoration Lab creates a separate listening derivative, preserves the fingerprinted master, and records every intervention and human review note.
9. **Transfer to Audiotool optionally.** With an Audiotool developer client ID, a fingerprinted source can be uploaded as an unlisted sample and inserted into a selected session through Nexus. The transfer becomes another event in the same passport.

The included four-second demo clip is generated in the browser and contains no third-party recording or performance. It is safe for testing the full local workflow.

## What a fingerprint means

The fingerprint is not a token, blockchain entry, copyright registration, or proof of authorship. It is a SHA-256 checksum: the same bytes produce the same 64-character digest, while a changed, edited, or transcoded file produces a different digest.

That makes the passport useful for a precise question:

> Is the file I have now exactly the file that was documented earlier?

Authorship, dates, consent, and cultural context still require evidence and human judgment.

## Pilot corpus: Belarusian Music in Exile

The corpus has two transparent seed layers. The first begins with Sergéy Ulyanov's own Belarusian-language works from 2016–2026. The second is a source-cited public remix index with 13 records documented across six pages from Budzma, 34mag, MusicBrainz, and CityDog. One MusicBrainz lead has an unverified vocal language and is excluded from Belarusian-language results. A release metadata language label is not proof of the language sung. Unsupported seeded BPM values have been removed. This is a bounded pilot, not a claim that Tuzin.fm or the wider Belarusian archive has already been ingested.

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

The tests cover fingerprint stability, changed-file detection, explicit missing-source records, runtime validation of imported passports, citations, CSV export, multilingual Music Atlas queries, language-intent accuracy, ranking, and consistency between dance labels and filters.

## External metadata discovery (September 2026)

- Entry: `atlas/#external-discovery`. Prefill (without automatic requests): `atlas/?discover=Belarusian%20rock%201990s&lang=be#external-discovery`.
- A user search retrieves two bounded, serial Wikidata SPARQL results: works (Belarusian language + performer, or a performer connected to Belarus by citizenship/country and MusicBrainz ID), and artists under the same explicit country criterion. The current page caches for 30 minutes. Refresh and retry are manual. Source statements, timestamp, source query and CC0 license travel with the result JSON.
- Live Chrome QA on September 8 returned **620 distinct source records**, including 52 folk matches (26 works + 26 artist leads), 16 N.R.M. matches (15 works + 1 artist), and 3 electronic/1990s artist leads but no matching work-level records. These counts are observations, not hard-coded fixtures or completeness claims.
- Artist nationality is never a work-language assertion. An album language does not prove the language of each recording. Artist genre is never inherited by a work. Artist genre and documented activity dates are separate facts; they do not establish that the artist performed that genre in the requested decade.
- Description parsing is a documented finite EN/BE/RU vocabulary, not a hidden LLM. Unknown words remain editable text criteria. Mood is visibly not applied: genre metadata cannot establish mood, audio similarity, authenticity or listening suitability. Missing statements can cause missing results; the empty state suggests broadening without inventing matches.
- No audio, lyrics, cover art, private passport or search description is uploaded. Only public structured metadata is fetched. There is no arbitrary crawl, paid API, model credential or backend. Third-party source availability is outside the static app's control; source errors cannot change the local passport corpus.
- Raw Wikidata statements may be wrong or insufficiently sourced. Inspect each QID and its references before promoting metadata to an archival claim. Discovered records are not automatically imported as verified passports.

Primary implementation references:

- [Wikidata data access](https://www.wikidata.org/wiki/Wikidata:Data_access) and [CC0 licensing](https://www.wikidata.org/wiki/Wikidata:Licensing).
- [Wikimedia API etiquette](https://www.mediawiki.org/wiki/API:Etiquette) and [cross-origin requests](https://www.mediawiki.org/wiki/API:Cross-site_requests): serial requests, page-level cache and the browser-safe `Api-User-Agent` header identify this project.
- [MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API), [rate/application identification rules](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting), [data licenses](https://musicbrainz.org/doc/About/Data_License). MusicBrainz URLs from CC0 Wikidata are source links only. Direct MusicBrainz browser querying is not enabled: reliable required User-Agent control needs a sanctioned backend, and supplementary tags carry a different NC-SA license. No MusicBrainz supplementary metadata is copied into external discovery.

Future provider adapters can return the same `DiscoveryRecord` shape with explicit source/license/coverage. A larger licensed metadata index and review workflow are required for arbitrary descriptions, underdocumented diaspora artists, reliable mood/audio features, and comprehensive source discovery. This version supplies a real extensible retrieval layer, not an all-internet-search claim.

## Quick reviewer path

1. On Archive Passport, select **Try a complete safe demo**. A synthetic source and a real local passport are created with one click.
2. Use **Verify → Use the safe synthetic demo file → Compare every byte** to see the exact match.
3. Follow **Create an access copy** from the receipt, then run the synthetic demo in Restoration Lab. It creates a derivative ready for listening, download and registration.
4. **Register in passport** preserves the settings captured when that audio was generated. Later slider edits never rewrite its history. Download the WAV and JSON log separately.
5. Open Music Atlas to see the parent and derivative. Export result reports for analysis; use **Back up all local passports** for the full restorable corpus.

Example Atlas URLs use `?q=...#explore`:

- `Belarusian dance works or remixes`: 14 current seed matches; explicit OR includes dance sets and remixes.
- `Belarusian dance remixes`: 3 seed matches with both a remix identity and a dance-oriented label.
- `Шума рэміксы`: 4 Šuma remix leads. Accent-insensitive `Znicka remix` also works.
- `Belarusian remixes 2013–2014`: source-dated range, limited to the current corpus.

Passports and their derivatives can be imported back into either Passport or Atlas. Invalid imports and same-ID version conflicts leave the saved collection intact. Re-importing identical records does not create duplicates. Local annotations are included in Atlas result reports; the passport backup preserves passport metadata and derivative history, not Atlas annotations or audio files.

## Privacy and limitations

- Source audio stays on the user's device until an explicit Audiotool transfer.
- Local browser storage is not a backup; export the corpus and keep trusted copies.
- The app does not authenticate people, historical events, rights claims, or dates.
- Metadata is only as reliable as its evidence and the person entering it.
- A public link can support recovery work but cannot replace a fingerprinted master.
- Portable JSON is validated before it enters the local corpus; incomplete or internally inconsistent records are rejected.
- The browser pilot limits each audio file to 200 MB to avoid freezing the page or losing unsaved work. This is an interface boundary, not an archival recommendation.
- Audiotool transfer requires a registered developer application and has not been represented as active when no client ID is configured.

## Built by

Sergéy Ulyanov — creative technologist, musician, and founder of Nostalgai Recordz.
