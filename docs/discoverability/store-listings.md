# Store listings — per launch locale

Draft. Generated from the §D terminology tables; re-generated whenever a
reviewer changes a label.

## Title pattern

§T fixes the pattern: **"DocFlow: Invoice & Receipt Maker"**, localized so the
two strongest local type names lead.

| Locale | Title | Subtitle | Surfaces |
| --- | --- | --- | --- |
| EN-NG / EN-GH | DocFlow: Invoice & Waybill Maker | Invoices, receipts and waybills offline | **Waybill** |
| EN-GB | DocFlow: Invoice & Quote Maker | Invoices, quotations and delivery notes | **Delivery note** |
| EN-US | DocFlow: Invoice & Estimate Maker | Invoices, estimates and packing slips | **Estimate**, **Packing slip** |
| FR | DocFlow : Facture & Devis | Factures, devis et bons de livraison hors ligne | **Devis** |
| ES | DocFlow: Factura y Cotización | Facturas, cotizaciones y notas de entrega | **Cotización** |
| AR | DocFlow: فواتير وعروض أسعار | فواتير وإيصالات وبوالص شحن بدون إنترنت | **بوليصة شحن** |

Apple caps the title at 30 characters and the subtitle at 30. **Several of the
rows above will not fit and must be trimmed by the reviewer, not by a script** —
what survives the trim is the local type name, never the generic half.

## What every listing must carry

- **Screenshots re-shot per locale**, showing each document type under its local
  name, with that locale's currency and date format. Not a translated caption
  over an EN-NG screenshot.
- **Offline stated plainly.** It is the product (Rule #3) and the strongest
  differentiator in every one of these markets.
- **The free tier stated honestly** (§U): creating and issuing all four types,
  customers, payments, receipts, PDF export and sharing are free forever, and
  existing documents are never locked. Nothing in a listing may imply a
  document can be held hostage (Rule #6).
- **No competitor brand names. No keyword stuffing. No incentivised reviews.**
  The ratings prompt fires via the native review API after a successful share —
  a happy moment — never after an error, and never gated (§T).

## Per-type store pages

One custom store page / listing experiment per document type per locale, where
the store supports it. The "waybill" searcher and the "quotation" searcher get
tailored first impressions of the same app.

## Web mirror

One landing page per document type per language — `/invoice-maker`,
`/delivery-note`, `/fr/devis`, `/es/cotizacion` — `hreflang`-linked, with
`schema.org` SoftwareApplication + Offer markup, a sitemap, and store
smart-banners. The template gallery on each page renders from the same sixteen
designs the app ships, not stock imagery.

**Public signing and acceptance pages are `noindex, nofollow` and excluded from
the sitemap.** Only marketing pages are crawlable.
