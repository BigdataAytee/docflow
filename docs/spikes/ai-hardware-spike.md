# Phase 0 spike — AI on real hardware

§Q: *"sideload whisper.cpp (tiny/base/small) and a quantized Qwen3-1.7B build
onto the three cheapest realistic market phones (3GB-class devices included —
not a flagship)."*

**Status: not run.** The results tables below are empty and stay empty until a
physical device fills them. §X: the tier table is a measurement, not a claim.

---

## The kill criteria — fixed in advance, argued never

These are pre-agreed so that a disappointing measurement is a *step down the
ladder*, not a negotiation. Written before the first device is switched on.

| Measurement | Threshold | Consequence |
| --- | --- | --- |
| Extraction latency (dictation → structured fields, p50 over the fixture set) | **> 15 s** | That device class is **Tier B** and ships the deterministic extractor |
| Transcription word accuracy on the accented dictation set | **< 80 %** | That device class is **Tier B** |
| Either, below the Tier-B thresholds below | — | That device class is **Tier C** |

Tier B is only viable where the deterministic extractor itself passes; Tier B
is gated on the same review-screen fixtures as Tier A (§N acceptance gate).
A class that cannot run whisper.cpp tiny within its thermal and memory budget
is **Tier C**: manual entry, stated honestly, never relabelled "needs internet".

Additional hard stops, any one of which drops a class a rung:

- Peak RSS within 100 MB of the OS low-memory kill threshold during extraction.
- Sustained thermal throttling inside a single 3-document session.
- Battery drain > 4 % for a ten-document session.
- A model that fails its integrity check or its first load — "installed" means
  checksum verified *and* loaded successfully (§N).

## Devices

Three cheapest realistic market phones, 3GB-class included. Not a flagship.

| # | Device | RAM | SoC | OS | Storage free |
| --- | --- | --- | --- | --- | --- |
| 1 | _to fill_ | | | | |
| 2 | _to fill_ | | | | |
| 3 | _to fill_ | | | | |

## Fixture sets

- **Dictation:** representative accents per launch market, real business names,
  local currencies and date phrasings, and a noisy-room take of each. Include
  the regional terminology synonyms — "make a delivery note for Okoro" must
  produce a waybill-typed document (§D.5).
- **Extraction:** the same set plus pasted text and OCR output, measured against
  the mandatory-review fixtures — missing values must stay blank, never invented.
- **Ask box:** unseen questions against known SQLite fixtures; the answer's
  numbers are checked against the query result, and currency separation holds.

## Results

| Device | Model | Quant | Transcribe WER | Extract p50 | Extract p95 | Peak RSS | Thermals | Battery | **Tier** |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | | | |

## Published tier table

_Filled from the measurements above, then copied into §N's ladder. Until then,
no device class has a tier and nothing is promised._

## What gets pinned when this passes

§W requires the Tier-A selection pinned by **exact model, tokenizer,
quantization, checksum and licence** — starting candidate Qwen3-1.7B
(Apache-2.0), selected finally by this spike. Record all five here and in the
dependency manifest with its required notices.
