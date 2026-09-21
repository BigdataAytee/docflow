# The visibility and legibility pass

What was measured, what it said, and what changed. Every number here came
out of a browser rather than out of a stylesheet — the whole point of the
pass was that reading tokens answers a question nobody asked.

Reproduce it with:

```bash
npm run sweep:contrast && npm run sweep:pdfsizes && npm run sweep:homecards
```

None of the three are in `npm run verify`: they each need a real browser and
CI downloads none.

---

## Part A — contrast, both themes

**1,702 lines of text**, across 22 routes, at 390px, in light and dark.
**435 failed WCAG 2.2 AA before. None fail now.**

The ratios are measured on composited PIXELS: the page is photographed and
the colours are read out of the image. A muted line in this app is
`text-ink/60` inside a glass surface at 70% over a gradient page under a
backdrop blur, and no token in that stack holds the colour anybody sees.
Nearly every surface here is a gradient *image*, so walking the DOM
compositing `background-color` would read `transparent` all the way up and
then answer with the page colour — which is behind nothing.

### By cause

| What | Where | Theme | Before | After | What changed |
| --- | --- | --- | --- | --- | --- |
| Section headings on builder cards | `/new/*` | dark | 1.27:1 | 4.87:1 | `--invoice-ink` … `--waybill-ink` (new) |
| Row action "Record payment", "Sign" | `/list/*` | dark | 1.24:1 | 4.76:1 | `--brand-ink` (new) |
| "Add", "Upload", "Use a different service" | `/settings/*` | dark | 1.24:1 | 4.76:1 | `--brand-ink` |
| Tax worked example | `/settings/tax` | dark | 1.12:1 | 6.53:1 | `--brand-ink` |
| "Share PDF", "Convert to…", "Record a payment" | `/doc/*` | dark | 1.41:1 | 5.43:1 | `--brand-ink` |
| "Start", "View guide", "Hide checklist" | `/` | dark | 1.32:1 | 5.09:1 | `--brand-ink` |
| Step names not yet reached | `/new/*` | light | 1.72:1 | 5.78:1 | `--step-pending-ink` |
| Step names not yet reached | `/new/*` | dark | 3.33:1 | 5.07:1 | `--step-pending-ink` |
| "Back" to Settings | `/settings/*` | dark | 1.75:1 | 6.97:1 | `--brand-ink` |
| Hero eyebrow "DOCUMENTS" | `/list/waybill` | both | 1.87:1 | 5.51:1 | `typeBand` stop order |
| Hero count "3 waybills" | `/list/waybill` | both | 2.02:1 | 5.23:1 | `typeBand` stop order |
| Hero title "Waybills" | `/list/waybill` | both | 2.50:1 | 5.31:1 | `typeBand` stop order |
| Hero button "+ New waybill" | `/list/waybill` | both | 2.04:1 | 7.09:1 | `--on-accent-shade` (new) |
| "Draft saved automatically" | `/new/waybill` | both | 1.99:1 | 4.59:1 | `typeBand` stop order |
| Builder title "New waybill" | `/new/waybill` | both | 2.54:1 | 5.02:1 | `typeBand` stop order |
| Document header eyebrow "WAY-001" | `/doc/waybill_1` | light | 2.78:1 | 5.42:1 | `PageHeader` opaque stops |
| Document header subtitle | `/doc/waybill_1` | light | 2.93:1 | 5.23:1 | `PageHeader` opaque stops |
| "Here is where your money stands today." | `/` | light | 2.81:1 | 4.85:1 | `--header-ink-muted` |
| Completed checklist item | `/` | light | 2.67:1 | 5.44:1 | `opacity-45` → `opacity-70` |
| Empty-state heading "Nothing yet" | `/` | light | 2.18:1 | 6.93:1 | `opacity-40` → `opacity-85` |
| "Received this month" | `/` | dark | 3.35:1 | 4.56:1 | `--stat-label` |
| Customer names, list subtitles | `/list/*` | both | 3.95:1 | 5.43:1 | `opacity-55` → `opacity-70` |
| Settings hints and descriptions | `/settings/*` | both | 3.53:1 | 5.33:1 | `opacity-55` → `opacity-70` |
| "Home" back link | `/list/waybill` | light | 2.54:1 | 5.52:1 | `--waybill-ink`; dark 1.74 → 6.83 via `--brand-ink` |
| Statement column headings | `/customers/…/statement` | light | 4.02:1 | 4.91:1 | `opacity-60` → `opacity-70` |
| Builder primary button "Next" | `/new/waybill` | both | 3.19:1 | 5.30:1 | `typeFill` (new) |

Full per-row data: `dist-shots/contrast-report.json`, written by the sweep.

### The five new or changed tokens

| Token | Light | Dark | Why |
| --- | --- | --- | --- |
| `--brand-ink` | `#2b3fd6` (unchanged) | `#a6b4ff` | The brand as a letterform, not as a fill |
| `--invoice-ink` / `--quotation-ink` / `--receipt-ink` | each type's deep stop | a pale stop of the same hue | Same, per document type |
| `--waybill-ink` | `#6f4209` | `#e8b169` | Amber is the hue that loses this argument: the accent is 3.5:1 on white |
| `--on-accent-shade` | `#000` | `#000` | A pill inset into an accent band must darken it, not lighten it |
| `--step-pending-ink` | `#4b527a` | white at 62% | Four of the five step names were invisible |
| `--header-ink-muted` | `#2f4068` | white at 76% | |
| `--stat-label` | unchanged | white at 78% | |

`bg-brand` is still §F's locked `#2b3fd6` in both themes, and so is every type
accent. What moved is ink, which has to be read off something.

### Not changed, on purpose

* The A4 document preview stays light in both themes. It is paper.
* Provider logos are never recoloured or inverted — the tile stays light and
  the mark stays true, which is what every set of brand guidelines requires.
* Per-type hues are kept everywhere. A Delivery note is still amber wherever
  a Waybill is (§F).
* Colour is never the only signal: the step bar names every step, status
  badges carry words, and the row actions are labelled.

### `prefers-contrast: more`

Was not honoured at all. Now: muted tokens go to full strength, glass stops
being glass (a translucent surface has whatever is behind it in its
contrast), hairlines darken, and faded text comes back. The rule is unlayered
so it outranks the utilities it exists to switch off.

The sweep measures it rather than trusting it: everything must still clear
AA, nothing comfortable may become marginal, and **more than 40 things must
get at least 25% stronger**. With the media query deleted, that count is zero.

---

## Part B — printed type

The page's coordinate space is A4 at 96dpi — 794px across for 210mm — so
**1px = 0.75pt exactly**. Nobody had done the conversion, and `text-[9.5px]`
reads like an ordinary small caption right up until it is 7.1 point on paper.

Measured across **all sixteen designs × four document types, each drawn to
its last page**: every text size on the printed page failed §I's floors.

| What | Before | After |
| --- | --- | --- |
| Eyebrow labels, contact strip, page number | 8.5–9px · **6.4–6.8pt** | 11.5px · **8.6pt** |
| Column headings, addresses, dates | 9.5–10.5px · **7.1–7.9pt** | 12.5px · **9.4pt** |
| Line items, party band, totals, payment box, note | 10–12px · **7.5–9.0pt** | 13.5px · **10.1pt** |
| The reference | 12px · **9.0pt** | 15px · **11.3pt** |
| **The payable, and a receipt's figure** | 14px · **10.5pt** | 19px · **14.3pt** |

Floors: 8pt for anything at all, 8.5pt for labels and headings, 10pt for
body, 14pt bold for the total.

### Smallest type on the page, per design

Measured, not derived. Every design draws through the same two files, which
is why they move together — and is also why one wrong size would have been
wrong in all sixteen.

| Design | Before | After |
| --- | --- | --- |
| Classic, Modern, Minimal, Bold, Elegant | 8.5px · 6.38pt | 11.5px · **8.63pt** |
| Sidebar, Executive, Wave, Sikky | 8.5px · 6.38pt | 11.5px · **8.63pt** |
| Compact | 9px · 6.75pt | 11.5px · **8.63pt** |
| Aurora, Ledger, Botanic, Prism, Bloom, Aria | 8.5px · 6.38pt | 11.5px · **8.63pt** |

### Two knock-on effects, both found by measuring

* **A row is taller, so fewer fit.** `ROWS_PER_PAGE` was 18, written out in
  three places, with the device journey disagreeing about the footer cost.
  Declared once in `paginate.ts` now, and set from measurement: 17 fits, 18
  runs Aria's framed header off the paper by 3px, so it is **16**. The A4 box
  is `overflow-hidden`, so an overrun is silent — the last row, or the
  signature, is simply not there.
* **A label is wider.** The payment box aligns values against a fixed label
  column sized for 10px text. At the new size "Account number" and "Balance
  remaining" both broke over two lines, on the block telling a customer where
  to send money. **96px → 124px**, measured against the widest label there is.

---

## Part C — the Home document cards

| | Before | After |
| --- | --- | --- |
| Card | 161 × 86px | 160 × **104px** |
| Icon plate | 37px | **46px** |
| Label | 12px | **14px** |
| Count chip | 9.5px | **12px** |

At 360px the cards were 86px tall — under a 44pt target in one dimension
and only just over it in the other. They now clear it in both, still sit two
across, and grow rather than clip when a label wraps to three lines at 200%
text. That last part is sized around "Bons de livraison", not around English.

Screenshots of the grid at 360px, beside this file:
`home-cards-before-light.png` / `home-cards-after-light.png`, and the same
pair in dark.

---

## Part D — what holds it

| Sweep | What it measures | Proved by reverting |
| --- | --- | --- |
| `sweep:contrast` | Composited pixels, both themes, 22 routes | Pending step ink → pale grey (16 red); band stops → light-first (20 red, white on amber); `--brand-ink` dark → the locked fill (55 red); `prefers-contrast` block deleted (0 improvements against 40) |
| `sweep:pdfsizes` | Rendered pt in all 16 designs × 4 types | Table → 12px; headings → 9.5px; total → 14px; total un-bolded; one header address → 9.5px (104 red, so it really does reach all sixteen headers); rows → 18 (overflow); label column → 96px (32 red) |
| `sweep:homecards` | Tap size, clipping, grid at 100% and 200% text | — |

Eleven mutations, eleven red guards, each on the guard written for it.

Three ways the contrast sweep was wrong before it was right, each found by
reading what it reported rather than believing it:

* `sr-only` labels are laid out full size and clipped to a pixel, so a range
  still reports a 57×21 box over which nothing is painted. It measured the
  empty background behind the bottom nav and failed "Settings" on every route.
* Measuring an element's HEIGHT instead of its text: a flex item stretches to
  its row, so a one-word label read as wrapped whenever the value beside it
  wrapped.
* Counting any increase as an improvement. Two runs of a page differ by
  hundredths; with the whole media query deleted, 35 things still "improved"
  against a threshold of 40.

And two ways the size sweep was: it drew page one only (so it never saw a
total, and its overflow check passed by never seeing a footer), and it read
the receipt's "Paid now" caption as a total — the caption is small on
purpose; the number is what must be 14pt.
