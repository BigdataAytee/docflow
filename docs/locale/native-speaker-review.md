# Terminology tables — native-speaker review sheet

§D: *"These tables ship in the app bundle and are validated with native-speaker
review per launch market — machine translation is a draft, never a release."*

The tables live in `src/domain/locale/data/`. Every one is currently
`reviewStatus: 'draft'`. Flip a locale to `'approved'` **only** in the same
commit that fills in its row below with a named reviewer; a structural test
(`src/domain/locale/terminology.test.ts`) fails an approved table with no
reviewer, and the Phase-1 resolver refuses to serve a draft in a release build.

## Sign-off

| Locale | Language | Reviewer | Market | Date | Status |
| --- | --- | --- | --- | --- | --- |
| EN-NG | English (Nigeria) | | Lagos / Ogun | | **draft** |
| EN-GH | English (Ghana) | | Accra | | **draft** |
| EN-GB | English (UK) | | | | **draft** |
| EN-US | English (US) | | | | **draft** |
| FR | French | | FR / CI | | **draft** |
| ES | Spanish | | ES / MX | | **draft** |
| AR | Arabic | | | | **draft** — also blocked on full RTL acceptance (§S) |

## What the reviewer is asked

Not "is this a correct translation" but **"is this what a small business in
this market actually calls it?"** — the word a builder's merchant would use to
a customer, not the dictionary word.

For each of the four internal types:

1. **Label** — the name on tiles, lists, the builder title and the share text.
   Does a trader here recognise it instantly? Is the plural right?
2. **Printed title** — the heading on the PDF. Sometimes differs from the
   on-screen label by convention (EN-US: "Quote" on screen, "ESTIMATE"
   printed). Flag where it should differ here.
3. **Party label** — Bill to / Deliver to / Received from / Prepared for.
4. **Signature caption** — AUTHORISED SIGNATURE / PREPARED BY / ISSUED BY /
   DISPATCHED BY.
5. **Builder step names** — five per type, in order.
6. **Numbering prefix** — the suggestion only; the user's configured prefix
   always wins (§D).
7. **Synonyms** — every other word a customer might say or type for this
   document. These feed the extractors (§N): a word listed here means "make me
   a ___" produces the right internal type. Over-inclusive is better than
   under, but **no word may map to two types** — the test enforces it.

Also confirm:

- **The shared headings** — the payment-box heading, the delivery document's
  "received by" rule, and the quotation's estimated-total line.
- **Register and casing** — printed titles are set in caps in the Latin tables;
  say if that reads wrong here.
- **Length** — §F tests every surface at the longest shipped label. If the
  natural word is long, say so rather than shortening it; the layout grows.

## Known open questions for the reviewer

- **ES / delivery document.** §D offers "Guía de remisión / Nota de entrega".
  The draft picks *Nota de entrega* as the neutral default; MX and PE lean
  *guía de remisión*, which is a fiscal document in some markets. This may need
  to split into ES-MX / ES-ES rather than one ES table. **Reviewer decides.**
- **FR / quotation.** *Devis* is drafted for both label and printed title; check
  whether *proforma* is expected in the West African francophone markets.
- **AR / everything below the type labels.** The four type labels come straight
  from §D. Party labels, signature captions and step names are drafts and should
  be treated as suggestions only.
- **EN-US / delivery document.** Drafted as *Packing slip* per §D, with "Ship
  to" and "SHIPPED BY" following it. Confirm that pairing.

## Cadence

§T: keyword sheets and store listings are updated **in the same cycle** as
terminology-table changes. A locale is not "launched" without its complete
discoverability package — listing, landing pages and keyword sheet together.
