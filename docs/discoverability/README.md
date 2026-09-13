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

| File | What | Owner |
| --- | --- | --- |
| `generated.md` | **The build artefact §T asks for** — every locale's title, subtitle, Apple keyword field and Play vocabulary, rendered from the §D terminology tables | the generator |
| `keywords/<locale>.md` | The QUESTIONS for the native speaker — "is 'way bill' typed as two words here?" — which no generator can produce | a person |
| `store-listings.md` | The pattern and the rules every listing obeys | a person |

### Why one of them is generated

§T: the keyword sheets are "updated in the same cycle as terminology-table
changes". That is a promise about somebody remembering. `generated.md` makes it
a promise the build keeps: it is rendered from `src/domain/locale` through
`src/marketing`, and `npm test` fails with a diff when the committed copy is
stale. Regenerate with:

```bash
npm run discoverability
```

CLAUDE.md Rule 4 says a type name resolves ONLY through `src/domain/locale`. A
store listing is the outermost surface of the product — the one place a person
reads before installing — so it obeys the same rule as a PDF heading. The
hand-written files above contain no document type names at all, and a test
proves it.

### Nothing here is submittable

Every locale in `generated.md` is marked **BLOCKED**, and each says why. The
common reason is the one CLAUDE.md names: a terminology table stays `draft`
until a native speaker of that market signs it off. Apple's 30-character caps
are reported, never applied — a title that does not fit is trimmed by a
reviewer, and what survives the trim is the local type name, never the generic
half.

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
