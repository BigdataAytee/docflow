# §T — Discoverability: keyword sheets and store listings

**Status: Phase-0 drafts.** Into the same native-speaker review as the
terminology tables (§Q), and updated in the same cycle as they change.

**Honesty first (§T).** No app can guarantee a ranking; stores control results.
What is buildable is complete, localized coverage plus the signals stores
reward — and nothing forbidden: **no keyword stuffing, no incentivised or fake
reviews, no competitor brand names in metadata.** Any draft below that drifts
towards those is wrong and gets cut, not softened.

Everything here derives from the §D terminology tables, so discoverability
inherits every locale automatically. When a reviewer changes a label, the
keyword sheet for that locale changes with it in the same commit.

## Files

| File | What |
| --- | --- |
| `keywords/<locale>.md` | Per-locale keyword sheet — the build artefact §T asks for |
| `store-listings.md` | Title, subtitle and description patterns per locale |

## The four types are four doorways

§T: Apple in-app purchase promotion, Play listing experiments and custom store
pages each target **one type per locale** — the "waybill" searcher and the
"quotation" searcher land on tailored first impressions of the same app. The
web mirror is one landing page per document type per language
(`/invoice-maker`, `/delivery-note`, `/fr/devis`, `/es/cotizacion`).

## Privacy boundary — not negotiable

Public signing and acceptance pages (§P) are `noindex, nofollow` and excluded
from the sitemap. **Customer documents must never enter a search index.** Only
marketing pages are crawlable. This is a Phase-5 gate item, listed here so the
SEO work and the boundary ship as one thing.

## Measurement

Store console search terms, page-level web analytics and per-locale conversion
reviewed quarterly. Keyword sheets updated in the same cycle as the terminology
tables.
