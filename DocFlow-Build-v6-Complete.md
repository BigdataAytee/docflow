# DocFlow — The Complete Build, A to Z (v6)

Version 6 · 11 September 2026 · Supersedes v5. This edition adds two launch-critical layers: **Discoverability (§T)** — localized store optimisation and web SEO so that a search for any document type, in any launch language ("invoice maker", "delivery note app", "waybill", "devis", "cotización"), has the best possible chance of surfacing DocFlow in the app stores and on the web; and **Monetization (§U)** — a free tier plus a DocFlow Pro subscription billed natively through App Store and Google Play (and card billing on the web), with server-verified entitlements that respect the offline-first design and never hold a user's documents hostage. Everything from v5 carries forward: the regional terminology layer, the device capability ladder, the week-one hardware spikes with kill criteria, the logo fallback ladder, the reconciled plan, the trimmed Phase-2 gate, split model downloads, the consented cloud carve-out, and the money and sync test suites.

This is a build handoff, not a claim that the product exists. The interactive prototype is the visual reference; the legacy repo (`github.com/BigdataAytee/docflow`) stays in `/legacy` as reference only.

---

# A — Ground rules

**Rule #1 — simplicity is non-negotiable.** Nothing may make the app harder to use than the legacy app. The machinery — SQLite, outbox, UUIDs, sync, RLS, tokens, model tiers, locale profiles — is invisible. Open app → it works → things appear on the web later. No new required fields; every added capability is optional or defaulted. One tap plus at most one small sheet for recording a payment, signing a delivery, or chasing money. When any rule below conflicts with simplicity, simplify and note the deviation.

**Rule #2 — one source of truth.** Before any code is written, `PLAN.md` and `CLAUDE.md` are rewritten in a single commit to match this document (payments ledger replaces the JSON array; revision-based conflicts replace last-write-wins; local AI tiers replace Edge-Function AI; frozen issued references replace the silent number swap; sixteen templates replace ten; the terminology layer replaces hardcoded type names). Both files gain the line: *"Where this conflicts with DocFlow-Build-v6, v6 wins."* No implementer should ever face two authorities. **Repository strategy (decided):** the existing repo (`BigdataAytee/docflow`) is kept — no new repo. In the same Phase-0 commit, the current Base44 app moves to `/legacy` (reference-only) and the new build lives at the root, preserving history, issues and links. Before that commit, the git history is scanned for committed secrets (Base44 keys especially); any found are rotated immediately, since moving code cannot remove secrets from history.

**Rule #3 — offline is the product.** After first sign-in and any one-time downloads, airplane mode supports every core journey on every supported phone. Internet is needed only for: initial sign-in, cloud sync, public links, model downloads, provider-confirmed payments, and clearly-labelled optional cloud actions the user taps deliberately. Nothing falls back to the cloud silently. Terminology tables ship in the app bundle — changing region works offline.

**Rule #4 — money is never inferred.** Payments are ledger records. Receipts are views of payments. Balances are computed. Nothing about sharing a file, toggling a badge, or syncing a record ever creates, doubles, or erases money.

**Rule #5 — one word everywhere.** A document type has exactly one display label at any moment, resolved from the locale profile, and that label appears identically on the tile, the list page, the builder, the share text and the printed PDF title. The user never sees "Waybill" on screen and "Delivery note" on paper. Issued documents freeze their printed labels the same way they freeze their reference and totals.

**Rule #6 — documents are never hostage.** A lapsed or cancelled subscription never blocks viewing, sharing or exporting anything the user already created, and full data export stays free forever. Paid features gate creation conveniences, never access to the user's own records. Upgrade prompts are quiet: one row in Settings and contextual unlock sheets — no nags, no interstitials, no countdowns.

---

# B — What DocFlow is

A business-document app for small businesses anywhere — built first for its home market (a builder's merchant in Ifo, a trader on Balogun Street, a florist, an event planner), and designed from day one for universal use: the currency, bank fields, tax labels, language and document terminology all adapt to where the business operates. They create the four core documents — **invoices, quotations, receipts and delivery documents** (displayed under the regional name: waybill, delivery note, packing slip, bon de livraison…) — keep **customers**, record payments, track outstanding balances and expenses, and send documents as PDFs over WhatsApp or the native share sheet.

Two clients on one account:

1. **Mobile (iOS + Android via Capacitor)** — fully offline-first; encrypted SQLite is the primary store; syncs when there is signal.
2. **Web** — same UI, online-only, repositories wired straight to Supabase.

Demo company across all prototypes: **Dynamic Renaissance Business Enterprises Ltd**, Lagos Abeokuta Motor Road, Ifo, Ogun State — locale profile EN-NG.

---

# C — Stack

| Layer | Choice |
| --- | --- |
| Frontend | React 18 + Vite + TypeScript + Tailwind + shadcn/ui |
| Mobile shell | Capacitor (camera, share, contacts, filesystem, secure storage, biometrics) |
| Local DB | SQLite on device, encrypted at rest, keys in secure storage |
| Cloud | Supabase — Postgres + Auth + Storage + Edge Functions, RLS on every table |
| Sync | PowerSync preferred; hand-rolled durable outbox as the single fallback (never both) |
| PDF | Generated on-device from the shared template definitions. Never server-dependent. |
| Local AI | whisper.cpp (voice) · Tesseract (OCR) · llama.cpp + pinned GGUF model — per the capability ladder in §N |
| Localisation | Bundled locale profiles: terminology tables + currency/bank definitions + language strings, resolved through one lookup layer (`src/domain/locale`) |
| IDs | Client-generated UUIDs for identity; issued references per §M |

**Architecture rules.** All data access goes through `src/data/repositories/*`; UI never imports a DB client. All display names for document types, statuses, roles and printed titles go through `src/domain/locale` — **no hardcoded type name anywhere in UI, PDF or share-text code.** Derived financial states (`unpaid`, `partially_paid`, `paid`, `overdue`, `expired`) are computed from dated documents and effective ledger entries — a cached rollup is rebuildable and never the accounting authority. Issued invoices and receipts are immutable; corrections are void-and-reissue or a credit note. Every mobile mutation commits the record and its pending sync operation in one SQLite transaction; a failed commit never shows "Saved". Files stay under ~300 lines as a maintainability target.

**Module layout** (shared mobile/web):

| Area | Responsibility |
| --- | --- |
| `src/app` | Routes, auth boundary, company context, service composition |
| `src/features/onboarding` | Welcome, business setup (incl. region), first-task choice, checklist |
| `src/features/home` | Greeting, two computed stats, search, tiles, attention items |
| `src/features/documents` | Per-type lists, five-step builders, review, detail, conversions |
| `src/features/customers` | Contacts, balances, history, notes, statements |
| `src/features/payments` | Ledger commands, allocations, receipts, reversals |
| `src/features/analytics` | Currency-aware local rollups, expenses, approved query execution |
| `src/features/branding` | Company branding, logo projects, concept browser, preview |
| `src/features/settings` | Region & language, payment setup, defaults, account, accessibility, data, help |
| `src/domain` | Money, lifecycle rules, permissions, validation, immutable snapshots |
| `src/domain/locale` | Locale profiles, terminology tables, label resolution, frozen-label snapshots |
| `src/data/repositories` | UI-facing interfaces; SQLite and Supabase implementations |
| `src/platform` | Camera, sharing, files, secure storage, lifecycle adapters |
| `src/sync` | Upload engine, pull application, conflicts, retries |
| `src/ai` | Model install, capability detection, local inference adapters, jobs |
| `src/pdf` | Shared layout definitions, pagination, fonts, native output |
| `supabase` | Migrations, RLS policies, validated commands, public links, provider webhooks |

---

# D — Regional adaptation: the locale profile

One profile, chosen once, drives everything regional. The internal model never changes — a delivery document is always `type: "waybill"` in the database everywhere on Earth; only presentation adapts.

## What a locale profile contains
- **Region** (e.g. NG, GH, GB, US, FR, CI, MX, IN, AE…) → default **currency**, the **bank-field definition** (§J), the **tax vocabulary** (VAT / GST / Sales tax / TVA — label only; rates stay user-configured), date format, and the **terminology table**.
- **Language** (English, French, Spanish, Arabic at launch scope) → all UI strings. English carries regional variants (EN-NG, EN-GB, EN-US…) that are label tables, not separate translations.

## How it is chosen — silently
On first setup the profile is inferred from the phone's region and currency; the user confirms the business country as part of the existing business-setup step (one picker, pre-filled — not a new required field, it replaces the bare currency default). Settings → **Region & language** allows override at any time: region, language, and — for the rare edge case — individual document labels ("Call this document: Waybill / Delivery note / Custom…"). A trader in Lagos sees "Waybill" without touching anything; a plumber in Manchester sees "Delivery note" the same way. That is Rule #1 applied to words.

## The terminology table
Same pattern as the currency table in §J: declared once, read by every surface.

| Internal type | EN-NG / EN-GH | EN-GB / EN-IE / EN-ZA / EN-IN | EN-US / EN-CA | FR | ES | AR |
| --- | --- | --- | --- | --- | --- | --- |
| invoice | Invoice | Invoice | Invoice | Facture | Factura | فاتورة |
| quotation | Quotation | Quotation | Quote *(printed title: Estimate optional per region)* | Devis | Cotización | عرض سعر |
| receipt | Receipt | Receipt | Receipt | Reçu | Recibo | إيصال |
| waybill | Waybill | Delivery note | Packing slip | Bon de livraison | Guía de remisión / Nota de entrega | بوليصة شحن |

Also localised through the same table: per-type builder step names, party labels (Customer / Client / Deliver to / Received from), signature captions (AUTHORISED SIGNATURE / PREPARED BY / ISSUED BY / DISPATCHED BY), status names, the "HOW TO PAY" heading, share text, and numbering prefix suggestions (INV/QUO/REC/WAY remain the defaults; regions may suggest alternatives; the user's configured prefixes always win). These tables ship in the app bundle and are validated with native-speaker review per launch market — machine translation is a draft, never a release.

## The rules that keep it safe
1. **One lookup, everywhere at once** (Rule #5). The tile, list hero, builder title, review screen, PDF heading, WhatsApp text and analytics labels all read the same resolution. No surface may carry its own string.
2. **Issued documents freeze their labels.** The printed title, party label and signature caption are snapshotted into the document at issue, exactly like the reference and totals (§M). Changing region later affects future documents only; a shared PDF never silently changes language.
3. **Search matches both.** Searching "waybill" or "delivery note" finds the same documents; the index includes the internal type, the current label, and the frozen label of issued documents.
4. **Sync is label-blind.** Devices in different locales on one account see their own labels over identical data; the web app follows the same company profile with a per-user language preference.
5. **AI speaks the local vocabulary.** Voice/scan/paste extraction accepts regional terms as synonyms for the internal types ("make a delivery note for…" creates a waybill-typed document); the ask box answers using the active labels. The deterministic Tier-B extractor's grammar includes the terminology synonyms for the active locale.
6. **Offline, always.** Terminology tables and language strings are bundled; region switching never needs a connection.

---

# E — Data model

Identical schema in Postgres (migrations) and SQLite (mirror), correct from day one.

- **companies** — id, name, logo asset, brand colour, name style, logo size, **locale_region**, **locale_language**, **label_overrides json** (per-type custom names, optional), currency (default from region), configurable tax defaults (label from locale; sample values VAT 7.5 / WHT 5 — product samples, not tax advice), numbering prefixes, bank fields per §J, enabled payment methods.
- **users** — id, company_id, role (owner|staff), permissions json, **language preference** (defaults to company language). Supabase Auth.
- **customers** — id, company_id, kind (company|person), name, contact_person, phone, email, address, city, state, labels[], private_note, timestamps.
- **documents** — id, company_id, type (invoice|quotation|receipt|waybill — internal, never localised), per-type status, **issued_reference (frozen at issue)**, internal_sequence (nullable until sync), provisional_number, **frozen_labels json (printed title, party label, signature caption, language — set at issue)**, customer_id + denormalised snapshot, line_items json (id, description, qty, unit_price, discount, tax_flag, image asset id, unit for waybills), totals, currency, issue/due/valid-until dates, derived payment summary, related_invoice_id, converted_from_id / converted_to_id, recurrence json, waybill fields (driver_name, vehicle_number, dispatch_date, expected_delivery_date, signer_name, signer_role, signed_at, signature asset, delivery photo asset, quantities_confirmed), signing token hash + expiry (server-only), template_id, design overrides, signature asset, timestamps, deleted_at.
- **payments** — id, company_id, customer_id, currency, **amount_minor**, paid_at, method, reference, source (manual|provider), external_event_id, created_by, reversal_of_id, created_at. Recorded once; amendments are reversal + replacement.
- **payment_allocations** — id, payment_id, invoice_id, amount_minor. Currency, limit and ownership enforced.
- **credit_notes** — id, company_id, invoice_id, reference, amount_minor, reason, issued_at, immutable invoice snapshot reference.
- **assets** — id, company_id, local_path, remote_storage_key, hash, mime, bytes, upload_state, created_at. Documents reference stable asset IDs, never bare remote URLs.
- **logo_projects / logo_concepts** — project + concept records: name/description snapshot, engine + model or grammar version, seed, asset IDs, concept type, selected state, generation state. Concepts survive restarts.
- **items** — the saved catalogue: id, company_id, name, last_price, unit, times_used, updated_at.
- **expenses** — id, company_id, description, category, amount_minor, date, photo asset.
- **subscriptions** (Postgres) — id, company_id, platform (apple|google|web), product_id, original_transaction_id / purchase_token / provider_subscription_id, status (trial|active|grace|on_hold|cancelled|expired), current_period_end, auto_renew, price snapshot, created_at, updated_at. Written only by verified store/provider notifications — never by the client.
- **entitlements** (Postgres + SQLite cache) — company_id, plan, features json, valid_until, grace_until, signed payload for offline verification. The device caches the signed entitlement so Pro features keep working through airplane mode and reasonable offline stretches (§U).
- **outbox** (SQLite only) — id, entity, record_id, op, payload, idempotency_key, created_at, attempts.
- **audit_log** (Postgres) — id, company_id, user_id, device_id, action, entity, record_id, at. Append-only.
- **counters / numbering_reservations** (Postgres) — company_id, doc_type, next_number, device_id, reserved range; atomic reservation, uniqueness enforced.

RLS scopes every table by company_id in the very first migration, proven by a two-account test where cross-company read and write are denied.

---

# F — Design system: Royal Blue Gloss + the corporate glass layer

**Locked.** Rebuild plus polish, not a redesign. The accepted prototype — including the corporate glass surface pass — is the visual reference.

**Primary blue** `#4a60ee → #2b3fd6 → #1a2a9e` · tint `#eef1ff` · text-navy `#1d2452` · page `#eef2fb`.

**Per-type colour** on headers, hero cards, step bars, accents and Home tiles — colours belong to the internal type and never change with the label (a Delivery note is amber everywhere a Waybill is):

| Type | Accent | Tint | Deep |
| --- | --- | --- | --- |
| Invoice | `#2b3fd6` | `#e6ebff` | `#1e2fae` |
| Quotation | `#534AB7` | `#EEEDFE` | `#3C3489` |
| Receipt | `#0F6E56` | `#E1F5EE` | `#085041` |
| Waybill / Delivery note | `#BA7517` | `#FAEEDA` | `#854F0B` |

**Status colours** — blue `#185FA5`/`#E6F1FB` (sent, in transit) · green `#0F6E56`/`#E1F5EE` (paid, delivered, settled) · amber `#854F0B`/`#FAEEDA` (overdue, part paid, owing) · coral `#993C1D`/`#FAECE7` (money out, void).

**Surfaces.** The accepted glass treatment: cards, pills, chips and the floating nav are frosted — translucent white with backdrop blur and saturation lift, hairline white inner borders, one soft wide shadow plus one tight contact shadow. Soft ambient colour orbs (one per document type) sit behind content, decorative only, never intercepting taps. Inputs read as recessed; buttons raised with a top highlight. The header stays noticeably blue but lighter than the original deep navy, blending its lower edge into the page. **Performance fallback:** on low-tier devices, where `backdrop-filter` is unsupported, or under reduced-transparency, glass degrades automatically to translucent white without blur — same layout, cheaper paint. Sheens are subtle and stop under reduced-motion. No continuous pulsing.

**Typography.** Plus Jakarta Sans, bundled and loaded locally; Inter/system as fallback. Body and form text 14–16px; 10.5px is the small-label floor only. Respect device text scaling. Bundle every font the sixteen templates actually use (audit them). Arabic ships with a bundled Arabic-capable face and full RTL mirroring per §S. No CDN dependency in the installed app — the prototype's webfont links are prototype-only. **Label-length resilience:** every surface carrying a type name (tiles, hero cards, builder headers, FAB text, chips) is tested with the longest label in the shipped tables ("Bon de livraison", "Guía de remisión") — labels wrap or the container grows; text never truncates or shrinks below the floor.

**Shape.** Cards `rounded-2xl`, inputs `rounded-lg`, chips and primary buttons fully round. Tap targets ≥ 44px.

**Iconography.** Tabler icon set, bundled. Type icons are fixed to the internal type and never change with the label: invoice `file-invoice`, quotation `file-check`, receipt `receipt`, waybill/delivery note `truck-delivery`.

**Bottom navigation ("B", settled).** A floating glass pill, centred, above a soft contact shadow. Four unlabelled icon tiles — Home, Customers, Analytics, Settings — each with an accessible name in the active language. Active tile lifts (`translateY(-4px)`), icon scales slightly, a short dark dash beneath; press scales to 0.9. **The create button is not in the nav**: a round `+` FAB sits bottom-right of each document list page in that type's colour. (Rejected on the way: two-lobe labelled nav with a raised centre; any orange state. The app stays blue.)

---

# G — Screens

All type names, party labels, step names and share text below are written in EN-NG for readability; every one resolves through the terminology layer (§D).

## Home
The only place all four types appear together.

- **Header** (blue gradient, rounded bottom): logo holder ("Tap to add your logo" until set), business name, a truthful connectivity indicator driven by real connection + pending work (simulated toggling is demo-only), log-out. Beneath: local-time greeting with the signed-in user's display name, one line of copy, and **exactly two glass stat cards**: **Outstanding** (remaining balance on issued, non-cancelled invoices after effective payments and credits) and **Received this month** (effective incoming payments in the company's current calendar month). Receipts never count as more money; quotations and delivery documents contribute none. Separate currency values are shown separately — NGN and USD are never added together.
- **Search** — one field across customers, numbers, amounts and item names, matching both current and frozen labels (§D). Typing replaces the body with results; no match gives a plain empty state with suggestions.
- **Voice and Scan** — the two round controls, preserved. Recording activity shows only while recording; a missing local model explains itself per §N.
- **Four type tiles**, 2×2, each with its colour, icon, localised name, count badge and coloured shadow.
- **Needs attention** — the two or three things that want doing: an overdue invoice with the outstanding amount and a "Chase" chip; a delivery in transit with a "Sign" chip. Tapping opens the document.

## Document lists — one page per type, never combined tabs
Hero card in the type colour (eyebrow "DOCUMENTS", localised type name + icon, count line — "4 invoices" / "3 delivery notes", inset translucent "+ New {label}" button, soft corner circles, sheen). Type-named live search below ("Search delivery notes…"). One white list container with hairline rows: reference + status badge left, amount right (delivery documents show no amount), customer on the second line. Swipe for mark paid / record payment / share — "mark paid" opens a prefilled payment confirmation and never writes a bare flag. Round `+` FAB bottom right.

## The builder — five steps, named per type
Invoice/quotation/receipt: **Details → Items → Totals → Design → Review**. Delivery document: **Deliver to → Goods → Dispatch → Design → Review** (step names localised). Coloured header with ✕, localised title, "Draft saved automatically"; five-segment step bar; Back/Next at bottom, Next becoming "Save {label}" on the last step. Drafts autosave on debounce and step change with a visible saved state; pending edits flush on exit/foreground; a dirty-guard plus post-force-kill recovery restores the last committed draft.

**Step 1 — Details**, one screen, four compact cards with tinted header strips (scroll on small screens; never shrink fields):
1. **Number & dates** — reference with a pencil override; two date fields side by side; tapping opens an inline calendar (month arrows, today ringed, selection filled) with per-type quick chips (Today · 7/14/30 days for invoice due; Today · Tomorrow for a delivery; Today · Yesterday for receipt date-paid). Date format follows the locale profile.
2. **Customer** (or the localised Deliver to / Client / Received from) — avatar+name+address row opening a searchable dropdown with "+ Add…" carrying whatever was typed; Chat and Call chips; a balance chip ("Owes ₦95,000" / "Settled"); a small `+` in the card header adds a contact directly.
3. **Currency & payment** — currency picker left (defaulted from region, freely changeable); right, either a green confirmation of set-up payment methods or an amber "Set up payment" that carries into Settings under a blue return band — "Setting up payment for your document · Back to draft" — and returns with the draft intact.
4. **Signature** — dashed tap-to-sign box, or the drawn signature.

Per type: quotations show no payment method; receipts show date paid, linked invoice, method + reference, no due date; delivery documents show a delivery address and no money anywhere.

**Step 2 — Items** (Goods, for a delivery). One input with autocomplete from the saved catalogue, quantity, unit price (unit, for deliveries), `+`. Each line renders as a card with optional photo, description, qty × price, line total, delete. A list icon jumps to Settings → Saved items. New typed items join the catalogue with the price used, and a toast says so.

**Step 3 — Totals** (Dispatch, for a delivery). Subtotal, discount %, optional tax at the locale's label (VAT/GST/Sales tax/TVA) and — invoices only — WHT where configured, live recalculation, heavy rule, payable total in the type colour. Deliveries get driver and vehicle, no money.

**Step 4 — Design.** §H.

**Step 5 — Review.** Full page at A4 proportions with an amber band listing anything missing; each item links to its step; nothing typed is discarded. Draft saving is always allowed. Final issue validates the signature requirement and per-type required fields, and **snapshots the frozen labels** (§D) alongside the reference; an invoice requires an enabled payment method; a receipt requires an actual recorded payment; quotations and deliveries require no payment setup.

## The saved document
- Invoices: a blue **paid-so-far bar** ("₦50,000 paid of ₦145,000 · ₦95,000 left") over green progress.
- **Payments** listed with date, method, reference, each with its own "Receipt" button. `+` opens a sheet prefilled to the balance; a changed amount is a part payment. Balances flow to the customer, Home, and analytics — once.
- **Chase this money** — a green WhatsApp row drafting the real outstanding amount, due date and actual bank details in the active language, with Softer and Firmer variants. Nothing sends unseen.
- **Repeat** — a toggle producing a reviewable draft each month. Nothing auto-sends.
- **Actions**, four per type: share PDF / convert / sign / void-or-credit-note (invoice); copy accept link / duplicate as Rev 2 (quotation); void and reissue / open invoice (receipt); copy signing link / add photo (delivery).
- **Convert** offers only what makes sense — quote → invoice or delivery; invoice → delivery; delivery → invoice (asks for prices, since deliveries carry no money). A receipt is evidence of a payment: starting one from Home records a payment first, optionally linked to an invoice or standing alone, never inventing a duplicate invoice. Originals are never altered; links persist.

## Customers
Cards with avatar, name, address, balance right. The contact page: header with labels (Wholesale, Retail, VIP, Pays late) and `+ label`; Chat / Call / Statement row; **Balance** (billed all time, paid, owing now, progress, and a line like "Pays on average 9 days late. Consider part payment up front."); **History** of every document; **Notes**, private, never printed. **Statement** builds a PDF of invoices against payments for any period with opening balance, charges, payments, credits, closing balance — in the active language.

## Analytics — one page, no tabs, no filter panels
- **In / Out / Kept** for the month, three cards, with a paired in-vs-out bar chart across six months.
- **How late the money is** — ageing buckets (not due, 1–30, 31–60, 60+) with a line naming the worst bucket.
- **What sells best** — top items by value.
- **Expenses** — a list and a `+` opening a three-field sheet or receipt photo; adding one immediately moves "Kept".
- **Ask anything about your business** — text box + example chips; answers in plain language above an in-app chart. All computed from the phone's copy, offline. Chips run predefined local queries on any phone; free-form questions follow the capability ladder (§N) and understand the locale's document vocabulary. "Kept" = recorded money in minus recorded expenses, with a short help note saying so.

## Settings
**Your business:** **Region & language** (business country → terminology, currency default, bank fields, tax label, date format; app language; per-type label override for edge cases — all effective immediately, offline, everywhere at once) · Company & logo (upload or create on device; name style — Classic, Serif, Stacked, Ruled, Monogram — with live preview; logo size S/M/L; four numbering prefixes) · Tax (locale-labelled rates with a live worked example) · How you get paid (§J) · Saved items · Default signature.

**You and your data:** Account · **Plan & billing** (current plan, what Pro adds, manage/cancel via the store's native subscription screen, Restore purchases, and a plain line stating that existing documents and export are never locked) · Dark mode · Larger text (follows the phone) · Data & sync (upload state, storage used, export all my data, sync-conflict demo) · **Offline tools** (§N installs) · Admin (§O) · Help & support (WhatsApp + FAQ).

## The logo holder
White rounded square with a thin inner margin; the logo scales to touch the margin — square nearly fills, wide spans width, tall runs height — **never cropped**. The design step's logo switch has a visible state (green pip-right "Logo on" / grey pip-left "Logo off"), carries `aria-pressed`, and its hint line matches ("Your logo prints at the top of every design" / "Logo hidden — only your business name prints").

---

# H — The sixteen document designs

One continuous horizontal strip beneath the live preview — no "original/new" headings; the six newer designs carry only a small green **NEW** tag. Tapping re-renders the full preview instantly and centres the card. Names never clip. Above the strip: the design-name pill, brand-colour dots, the logo switch.

**The original ten:** Classic (Georgia serif, heavy header rule) · Modern (one-line header, 3px rule, grey band) · Minimal (hairline, letter-spaced caps, white space) · Bold (split header over heavy accent rule) · Elegant (centred serif, diamond between rules) · Sidebar (31% tinted left column) · Executive (circle motif, title reversed out of an accent badge) · Wave (accent wave across the foot) · Compact (one header line + three-cell strip for dense documents) · Sikky (coloured spine, boxed office address, centred underlined title, Georgia).

**The six new:** Aurora (full-bleed gradient band, reversed logo) · Ledger (faint accounting rules, double header rule) · Botanic (off-white, leaf flourish, centred Georgia) · Prism (diagonal colour cut) · Bloom (blush paper, floral arch, italic serif — salons, florists, planners) · Aria (ivory in a thin rose-gold frame, gold hairline). A Noir design was built and removed; Bloom and Aria replaced it.

Every design renders the actual type in the active terminology: deliveries show goods/quantities with the localised "Received by" line and no money; quotations say the localised "Estimated total" with a client-acceptance line; receipts say "Paid". Titles render from the terminology table and are tested at the longest shipped label per design. The captured signature appears in the per-type slot in all sixteen. One component serves the builder and Settings → Document design with shared state.

---

# I — How a document composes on the page

A4 portrait, generated on-device, in the document's frozen language and labels once issued. Header: logo at chosen size → business name in the chosen name style → the localised type title and number. Bill to / Deliver to (localised) left, issue date right in the locale's date format. Line items as a table (thumbnail if a photo was attached, description, quantity, amount — deliveries swap amount for unit and drop every money column). Totals right-aligned at 58% width: subtotal, the locale-labelled tax, less WHT where configured (invoices), payable above a heavy rule. The foot carries the payment box and signature side by side. Long documents repeat table headings, break rows safely, and keep totals/signatures on-page. RTL locales mirror the layout per §S.

**The payment box** (invoices): headed with the localised **HOW TO PAY**; prints every saved account field as a labelled row (labels in a left column so values align); online methods under a dashed divider labelled "Other payment methods", cash listed separately; inline at ≤ ~60% width beside the signature, never a full-width band. Receipts show what was paid, when, and how — never an instruction to pay again. Quotations omit payment instructions by default. Deliveries replace the box with the localised "RECEIVED BY" rule.

**The signature:** the actual captured signature (placeholders only in clearly-labelled samples), a short ~76px rule beneath, the localised per-type caption — AUTHORISED SIGNATURE / PREPARED BY / ISSUED BY / DISPATCHED BY — and the signer's name.

---

# J — Money: currencies, bank fields, payment methods

**One definition per currency, read by both the settings form and the PDF** — the settings form renders from it and the printed payment box reads from it, so they cannot drift and no field can be invented for a country that lacks it. The locale profile supplies the default; the user may hold accounts in any currency:

| Currency | Fields |
| --- | --- |
| **NGN** | Bank · Account number · Account name — **three fields, no sort code** |
| GBP | Bank · Sort code · Account number · Account name |
| USD | Bank · Routing number · Account number · Account name |
| EUR | Bank · IBAN · BIC/SWIFT · Account name |
| GHS | Bank · Account number · Branch · Account name |
| KES / ZAR | Bank · Account number · Branch code · Account name |
| XOF / XAF / AED | Bank · IBAN · SWIFT · Account name |
| EGP / SGD / CNY | Bank · Account number · SWIFT · Account name |
| CAD | Bank · Transit number · Account number · Account name |
| AUD | Bank · BSB · Account number · Account name |
| INR | Bank · Account number · IFSC code · Account name |
| BRL | Bank · Agência · Conta · Account name |

These are the proposed field sets, not verified banking standards — validate each launch market; allow optional extra routing fields without inventing mandatory ones. The NGN three-field requirement is explicit. Switching currency re-renders the fields and says so. Line-item and totals symbols come from the same source.

**Payment methods:** Bank transfer, Paystack, Flutterwave, cash on delivery, PayPal — each off until added; the visible provider list may be filtered by region (Paystack/Flutterwave where they operate) without removing the user's ability to enable any supported provider. The bank-transfer row shows the live account details. Everything switched on prints in invoice payment instructions; the count shows in Settings and the builder chip. Payment setup is enforced only at final invoice/receipt issuance, never on quotations or deliveries, and never blocks draft saving. Manual payments can be recorded offline; provider-backed payments are confirmed only by a verified, idempotent provider event.

---

# K — Input validation

Validate without destroying what was typed: a specific inline message beside the field, input retained. No shake animations; never rely on red alone. Validate complete values on blur/save.

| Field | Behaviour |
| --- | --- |
| Amounts, quantity, rates | Locale-aware decimal input (comma or point per locale); exact decimal arithmetic in currency minor units — never binary floats for money |
| Bank identifiers | Strings (leading zeroes kept); validated against the selected currency definition; spaces/hyphens allowed for readability |
| IBAN / SWIFT / IFSC | Case and spacing normalized; entered value retained on failure |
| Phone | Country prefix and common formatting accepted, defaulted from region; validated on save; display and normalized forms stored |
| Names (people, companies, accounts, places) | Unicode text with spaces, accents, apostrophes, hyphens **and digits** — no letters-only rule anywhere, in any script |
| Email | Validated on blur/save without rewriting the local part |
| Addresses, vehicle plates | The expected mixture of letters, numbers, punctuation, any script |

Lengths, required fields and allowed transitions enforced at both local command and server boundaries. A database failure keeps the draft and shows retry. Reject a receipt without an effective payment; reject allocations exceeding a payment or invoice balance unless handled as explicit customer credit.

---

# L — The ten improvements

All attached to existing screens; no new tabs. Items 1–3 and 8–10 ship inside Phase 2; items 4–7 plus expenses/statements ship in **Phase 2.5**, immediately after the airplane-mode gate passes (§Q).

1. **WhatsApp payment reminders** — real outstanding amount, real bank details, Softer/Firmer variants in the active language, nothing sent unseen.
2. **Saved item catalogue** — builds itself from what gets typed; autocomplete in Items; full list in Settings; prices update next time.
3. **Partial payments** — paid-so-far bar, payments list, per-payment receipts, balances flowing to customer, Home, analytics — once.
4. **Recurring invoices** — Repeat toggle producing reviewable monthly drafts; idempotent recurrence keys; missed periods created on next launch without duplicates. *(2.5)*
5. **Customer statements** — period PDF of invoices against payments with a closing balance. *(2.5)*
6. **Expenses** — three fields or a receipt photo; analytics becomes In / Out / Kept. *(2.5)*
7. **Sync conflict notice** — plain language in the active language ("Sola changed this too… See both / Use mine / Use theirs; both versions are saved"), permission-checked, never bypassing issued-document immutability; demo under Settings → Data & sync. *(2.5, alongside Phase 3)*
8. **Empty states** — first run offers "Create my first invoice" and a labelled sample document.
9. **Accessibility** — readable sizes, scalable controls, darkened greys, a large-text preview toggle proving layouts reflow rather than clip — tested with the longest shipped labels.
10. **Performance** — virtualised lists, a local search index (current + frozen labels), pre-computed monthly rollups. Invisible.

---

# M — Offline, sync, numbering, conflicts

**Local work is the primary mobile experience.** After first sign-in and installs, airplane mode supports customers, catalogue, all four builders, drafts, signatures/photos, on-device PDFs, local share/export, payments, receipts, region/language switching, and (from 2.5) expenses, statements, charts, plus installed AI per §N. A share handoff records a sharing event; it never claims recipient delivery. Fonts, template assets, icons, terminology tables and language strings ship in the app bundle — nothing needed to open a saved document touches a CDN.

**Upload/download.** Local change + pending upload persist atomically; every operation carries an idempotency key, entity version, actor and device ID. Retry with backoff on connectivity/foreground; background execution is best-effort — never promise instant sync while suspended. Server acknowledgement, not network availability, marks an operation uploaded. Asset uploads resume and verify hashes. A durable pull cursor advances only after transactional application. Retried creates, payments, conversions and recurrence jobs never duplicate. Parents and assets resolve before dependents become externally visible; pending local photos remain visible before upload. PowerSync's supported mechanism if selected; otherwise the one fallback outbox — never two replay engines.

**Conflicts.** Record revisions, not device timestamps. Non-overlapping edits to editable drafts merge automatically; same-field edits retain both versions behind the plain-language chooser (§L7). Issued financial documents, payment events, delivery evidence and permission changes are never silently overwritten. Only entitled users resolve. Soft deletion is versioned; a stale update cannot resurrect a record. Locale settings sync like other company settings; a region change mid-flight never alters any document's frozen labels.

**Numbers and frozen PDFs.** Issued references and **frozen labels** are fixed at issue and embedded in the stored PDF snapshot; a later sync or region change never alters a shared document. Use server-reserved number blocks where available; the offline fallback is a stable device-qualified final reference. The server enforces company/type/reference uniqueness; a separate internal sequence may be assigned later without touching the issued reference. Drafts show provisional references with validated override. A gapless central sequence would force online issuance and is rejected. **Design task:** the device-qualified format must be customer-presentable — short, prefix-consistent, explained in one line in Settings.

**Status, errors, logout.** "Saved on this phone" / "Waiting to upload" / "Uploaded" / "Needs review" where useful, in the active language; no database jargon. Failed operations persist with an actionable per-record error and safe retry. Logout returns to the welcome screen, warns briefly when work is pending, retains the encrypted account-scoped local store (locked, credentials cleared), never exposes it to another account; deleting local data is a separate explicit action. Remote revocation takes effect on next connection.

---

# N — Local AI: the capability ladder

**Principle unchanged:** AI processing in the mobile app runs on the device. No silent cloud fallback, no online activation, no licence phone-home. Internet obtains packages and syncs approved records — nothing else. The tiered ladder gives every phone a truthful, working version of each feature, with the Phase-0 hardware spike measuring feasibility before anything is promised.

## The ladder

| Tier | Device class (indicative) | Voice | Scan | Extraction | Ask box |
| --- | --- | --- | --- | --- | --- |
| **A** | ≥6GB RAM, recent SoC, passes spike thresholds | whisper.cpp (multilingual small/base per spike) | Tesseract | llama.cpp + pinned GGUF model, grammar-constrained | Local model → validated plan → SQLite |
| **B** | 3–4GB RAM (the realistic market phone) | whisper.cpp tiny | Tesseract | **Deterministic extractor** — a rules/grammar parser for the narrow dictation/OCR domain ("3 bags of cement at ₦5,000 each…"), with the active locale's terminology and number formats in its grammar. No model download needed. | Example chips (predefined local queries) + guided question templates; free-form answers state "not available on this phone" |
| **C** | Below B, or install failed/declined | Manual entry, stated honestly | Gallery/manual | Manual | Chips only |

Tier detection runs locally (RAM, SoC allowlist, a micro-benchmark on first use) and is re-checkable in Settings → Offline tools. An unsupported device is described as unsupported — never relabelled "needs internet."

## The consented cloud carve-out
Where a capability is absent locally (Tier B/C, or model not yet downloaded), the sheet may offer one clearly-labelled optional action — **"Process online instead"** — requiring an explicit tap every time, with a one-line statement of what is sent. Off by default, never automatic, never a background fallback, available only when connected, and owner-disableable company-wide in Admin.

## Split downloads
"Offline tools" installs components independently with real sizes, progress, pause/resume, checksum validation and interruption recovery: speech (~tens of MB) and OCR language data (~15MB/language — the locale's language data suggested first) install cheaply, by default on first use over Wi-Fi or on demand; the extraction model (1GB+) is a separate, clearly-sized, opt-in download that never gates the smaller ones. The app stays fully usable during downloads. A model is "installed" only after integrity check and a successful load. Models are not loaded simultaneously under memory pressure; work queues and unloads safely.

## The open-source baseline
whisper.cpp (MIT) for speech; Tesseract (Apache-2.0) for OCR; llama.cpp with a pinned GGUF instruction model, grammar-constrained to the extraction schema; starting LLM candidate Qwen3-1.7B (Apache-2.0), selected finally by the spike, pinned by exact model, tokenizer, quantization, checksum and licence. Native Swift/Kotlin/C++ Capacitor bridges — a React Native wrapper is not a Capacitor plugin. Licences and weights tracked in the dependency manifest with required notices.

## Feature behaviour (all tiers)
**Voice:** the original bottom sheet — "Recording… 0:03", transcript area, "Stop & extract". Audio stays on the phone. Provisional transcript streams where the device can; otherwise "Transcribing on this phone" — never fabricated live words. The user picks the document type (localised names; regional synonyms recognised — "delivery note for Okoro" creates a waybill-typed document); extraction produces editable fields. Silence, noise and uncertain amounts never invent business data; recovered text is preserved on failure; denied microphone or an interrupting call never loses a draft.

**Scan:** native camera or gallery; local crop/deskew/orientation; Tesseract with installed language data; recognized text + layout positions feed the tier's extractor. Source image beside the editable result when needed; uncertain characters, amounts and line boundaries highlighted; missing prices never inferred; poor images offer retake/crop. Handwriting and complex tables are tested separately and never claimed without evidence. The web app keeps a gallery/file entry point; browser-local inference is a separate tested adapter; where unavailable, manual entry remains and the limitation is stated.

**Type or paste:** one free-text input; the tier's extractor pulls only supported values (type — via terminology synonyms, customer, currency, dates, items, quantities, prices, notes, delivery details); missing fields stay blank; the original text is preserved. Output is schema-constrained then validated (types, lengths, currency, dates). Pasted and OCR text is data, never instructions. Totals are recalculated by deterministic money code — no model is ever the authority for amounts or tax arithmetic.

**Mandatory review:** extracted fields and line items shown before anything is finalized; missing values, conflicts and OCR uncertainty highlighted; every value editable; model confidence never displayed as calibrated probability. Recovered content may autosave as a clearly-labelled unconfirmed local draft, but nothing issues a document, creates a payment, updates a customer or completes a delivery without confirmation. Failure always offers "Continue manually" with whatever was recovered.

**Ask box:** question → local model (Tier A) → validated, allowlisted plan (intent, metric, period, grouping, filters, chart type) → the app compiles a parameterized read-only query with company scope, permissions, date ranges, currency separation and limits → SQLite → in-app chart + plain-language answer whose numbers are checked against the query result, phrased in the active vocabulary. Never execute model-returned SQL or code. Chips run predefined local queries on every tier. Where pending sync matters: "Based on records on this phone."

## Privacy and failure states
Installed inference uses no network and no telemetry. Raw audio, pasted prompts and intermediate text stay local and never silently join the sync queue; final business records sync normally; a photo deliberately kept as an attachment syncs with its document. Temporary files have explicit retention/deletion. Missing model → "Download offline tools when connected." Unsupported device → said plainly, manual flows intact.

## Acceptance gate (per release, per tier, on physical devices, all radios off)
1. Dictate a document, review, save a valid local draft. 2. Photograph printed documents, recover text/items, correct uncertainty, save — zero network calls. 3. Paste unseen text → editable structured fields; missing values not invented. 4. Ask unseen questions (Tier A) → validated plan → answers/charts match known SQLite fixtures; permissions and currency separation hold. 5. Force-kill/reopen, cancel a job, deny permissions, simulate low storage — committed work survives. 6. Inspect traffic: zero outbound AI bytes, including after days offline. Evaluate with representative accents, business names, currencies, dates and noisy rooms for each launch market; add each supported language and its terminology synonyms to the matrix. Tier B's deterministic extractor is gated on the same review-screen fixtures as Tier A.

---

# O — The logo: requirement + fallback ladder

## The journey
Settings → Company & logo → Create a logo. Ask **company name** and **a short description of what the company does** — no model settings, no prompt engineering. Optional style preferences may come later. On a supported phone without the model: explain the one-time download with the real size, progress, pause/resume, storage check; the app stays usable meanwhile. **Generate ideas** → four at a time: two with the name, two symbol-only. Each project can produce **at least twenty distinct ideas** (five sets minimum); earlier results are retained; "More ideas" never wraps around or disguises a recolour as new artwork. Saving and selecting are offline. Descriptions may be written in any supported language.

## What counts as distinct — the rubric (written now, argued never)
Twenty ideas means twenty different core visual concepts or substantially different compositions. Palette, font, background, rotation, or adding/removing the name from the same mark do **not** count. Named and symbol-only entries in the quota must not duplicate one another; a chosen concept may later offer both formats without counting twice. The **description** is the primary source of meaning; the name supplies brand context and lettering — never an inferred industry that contradicts the description. A short clarifying question is allowed only when the description is genuinely ambiguous between incompatible readings. **Fixed test set:** ten business descriptions spanning engineering, cosmetics, food, retail, transport, trades, education, agriculture, technology and a deliberately misleading name — human-reviewed against this rubric before launch, including non-English names with accents and non-Latin scripts. Duplicate detection alone is insufficient.

## The fallback ladder (pre-agreed; failure is a step down, not a stall)
1. **On-device generative model** — a small distilled image model behind a local prompt planner; seeds tracked; near-duplicates rejected by image-similarity checks; the underlying idea varied before its rendering. Requires passing the Phase-0 spike on target phones.
2. **Procedural concept engine** — an algorithmic compositor generating marks from geometry grammars (monograms, abstract forms, description-derived symbol vocabularies, structural composition rules), with the exact company name set locally in bundled fonts (Unicode-capable, including Arabic where the locale requires it). Runs offline on every tier and genuinely satisfies the twenty-distinct rubric — unlike the prototype's preset picker, which is a demonstration only.
3. **Cloud generation, opt-in** — clearly labelled "needs internet", consented per use (§N carve-out), owner-disableable.
4. **Formal requirement revision** — presented with the spike's measurements, never a silent substitution.

## Quality and output (any rung)
Symbol artwork is generated separately from lettering; the name is composed in bundled fonts so spelling, kerning, long names and Unicode are controlled. Check small-size legibility, clean edges, balanced weight, clear space, light/dark usability. Preview in the home holder and on an A4 document; "Use this logo" is the primary action. Store the original plus transparent exports locally; enqueue for sync. New branding affects future drafts; issued PDFs keep their original branding. PNG export always; SVG only for true vector output. No trademark or uniqueness claims. Partial batches are labelled partial.

## Definition of done (per supported device)
Download once → airplane mode → new name/description → twenty distinct concepts across five sets → select → generate a document containing it → force-kill → recover it. "More ideas" verified never to repeat. Generation time, memory and thermal behaviour recorded. These are build gates, not achievements of the current preview.

---

# P — Security

RLS on every table scoped to company_id, proven by the two-account denial test. Public delivery/quotation links use per-document random tokens (hash stored server-side, separate from general document reads), checked on read and on sign, invalidated after signing or 14 days; wrong/expired tokens show a friendly message in the document's frozen language, never data; delivered/signed links cannot be reused to alter evidence. The server revalidates totals, statuses and dates on sync and rejects invalid transitions. Supabase Auth handles login, reset, OAuth — no custom auth logic (keep only the legacy styling). Rate limiting on auth and public endpoints. Append-only audit log (user, device, action, timestamp). SQLite encrypted, keys in Capacitor secure storage, no secrets in the JS bundle, uploads in access-controlled buckets. Staff permissions enforced server-side; scripted penetration checks run as wrong user, wrong role and revoked device.

---

# Q — Build order, A to Z

## Phase 0 — Week one: spikes and reconciliation
- **Reconcile the repo** in one commit (Rule #2): legacy app to `/legacy`, new build at root, `PLAN.md`/`CLAUDE.md` rewritten to match this document, secrets scan + key rotation done first.
- **AI hardware spike:** sideload whisper.cpp (tiny/base/small) and a quantized Qwen3-1.7B build onto the three cheapest realistic market phones (3GB-class devices included — not a flagship). Measure transcription word accuracy on an accented dictation set, extraction latency, peak memory, thermals, battery. **Kill criteria fixed in advance:** extraction > 15s or transcription accuracy < 80% on a device class ⇒ that class is Tier B and ships the deterministic extractor; below Tier B thresholds ⇒ Tier C. Publish the tier table from measurements.
- **Logo feasibility spike:** run the candidate on-device image model on the same phones against the ten-description test set and the distinctness rubric. Pass ⇒ ladder rung 1; fail ⇒ rung 2 promoted to the build target, recorded openly.
- **Terminology tables drafted** for the launch locales (EN-NG, EN-GH, EN-GB, EN-US, FR, ES, AR) and sent for native-speaker review, so validated labels exist before Phase 2 needs them.
- **Localized store metadata drafted** (titles, subtitles, keyword sheets per launch locale) alongside the terminology tables, into the same native-speaker review.
- **Money property-test harness** in CI on day one: allocations never exceed payment or invoice balances; receipts never move income; reversal + retry never double-counts; currency buckets never mix; discount/tax/WHT ordering matches worked examples. These run on every commit for the life of the project.

**Gate:** tier table and logo rung published with measurements; PLAN.md reconciled; terminology drafts in review; money tests green on the domain-layer skeleton.

## Phase 1 — Foundation
Project structure, domain types, repository contracts, **the locale layer** (`src/domain/locale`: profiles, terminology resolution, frozen-label snapshots — built here because builders, PDFs and search all depend on it), Supabase Auth (email/password + Google, legacy-styled screens, ≥30-day sessions tolerant of long offline gaps, offline use never requiring token refresh, expired credentials pausing sync without deleting local work), migrations for the full §E schema in Postgres and SQLite, RLS from the first migration, exact-money rules in `src/domain`, and the **entitlement model** (schema + a feature-gate helper that reads the cached signed entitlement; everything resolves to Free until billing ships).

**Gate:** two seeded companies cannot read or write each other; money and transition property tests pass; label resolution passes its own property test (every UI/PDF/share surface resolves through one lookup; no hardcoded type-name string survives a lint rule written for it); encrypted SQLite opens on device; login/register/Google/reset work in ≤ legacy tap counts.

## Phase 2 — Core offline app *(trimmed to the knife-edge)*
Scope: **customers · the four builders · payments + allocations · receipts · on-device PDFs (all sixteen templates) · native share · signatures · the per-type lists · Home · Settings essentials (region & language, company, tax, payment methods, saved items, signature) · onboarding (§R) · improvements 1–3 and 8–10.** The shared component library first (PageHeader, StatusBadge with the single colour map, EmptyState, skeletons, LineItemRow, SyncIndicator, ConnectivityPill); ported legacy visual components converted to TS.

**Gate (airplane mode, fresh install, physical device):** create a customer → build an invoice → preview in all sixteen designs → issue → PDF → share → record a part payment → auto-create its linked receipt → create and sign a delivery document → **switch region and confirm every label changes everywhere at once while the issued PDFs keep their frozen labels** → force-kill mid-draft → reopen and recover — zero errors, skeletons and empty states everywhere, never a spinner or blank screen. Delivery documents show no money anywhere. A payment recorded once moves invoice, customer, Home — once.

## Phase 2.5 — The remaining improvements
Expenses, statements, recurring invoices, customer labels, credit notes, the conflict-notice UI shell, In/Out/Kept analytics with ageing and top items.

**Gate:** each feature's §L behaviour verified offline; "Kept" moves the moment an expense is added; a reissued receipt never increments income.

## Phase 3 — Sync
PowerSync integration decision finalized against the encrypted SQLite build (or the single fallback outbox); durable idempotent uploads, transactional pulls, asset transfer with hash verification, numbering reservations and device-qualified references, revision-based conflicts with the plain-language chooser, account isolation. **Sync chaos suite** (scripted, in CI where possible): force-kill mid-drain, duplicate replay, two-device concurrent edits, clock skew, offline issue → online reconcile, region change racing a sync.

**Gate:** five documents created offline arrive once with unique final references despite a mid-sync kill and retry; two-device same-field edits retain both versions; no chaos scenario double-counts money, resurrects a deletion, or alters a frozen label; cross-account isolation still holds.

## Phase 4 — Native polish
Camera, filesystem, contacts import (deduped), CSV customer import with column-mapping preview, share sheet, secure storage, optional biometric/PIN lock (default off), splash/icon, Android back behaviour, safe areas, device lifecycle. Performance: cold start < 2s to an interactive dashboard from SQLite; fixed-aspect preview placeholder; virtualised lists.

**Gate:** installable builds pass all flows on physical Android and iOS, including permission refusal, large-text reflow with the longest shipped labels, and the cold-start target offline.

## Phase 5 — Web + public links
Web deployment (same UI, repositories on Supabase, online-only, per-user language preference). Tokenized public pages: delivery remote signing (view + sign → atomic delivered + timestamp, token invalidated) and quotation acceptance (Accept/Reject, optional signature, timestamped), rate-limited, rendered in the document's frozen language. Copy-link actions disabled with a "needs internet" note until synced. Provider payment webhooks (Paystack/Flutterwave/PayPal) verified and idempotent.

Web billing for DocFlow Pro (Stripe/Paystack per market) with webhook-driven entitlements synced to devices; the marketing site with localized landing pages, deep links and the privacy noindex boundary.

**Gate:** phone-created documents appear on web after sync and vice versa; token expiry/reuse/guessing behaves per §P; a confirmed provider event records exactly one payment; a public link shows the frozen labels regardless of the company's current region; a web Pro purchase unlocks Pro on the phone after sync and a replayed webhook changes nothing; document links are absent from the sitemap and carry noindex.

## Phase 6 — Local AI + logo
Ship the ladder: Tier A model pipeline, Tier B deterministic extractor (with per-locale terminology grammars), Tier C states; split downloads; the consented cloud carve-out with the Admin kill-switch; voice, scan, type/paste, mandatory review, ask box; the logo engine at its spike-determined rung.

**Gate:** the §N six-step acceptance gate per tier on physical devices with radios off, including terminology-synonym extraction per launch locale; the §O definition-of-done on supported devices; the twenty-concept rubric passed by human review on the fixed test set; zero outbound AI bytes confirmed by traffic inspection.

## Phase 7 — Admin, hardening, migration, launch
Admin screens (staff permissions server-enforced, activity feed, device revoke); **store billing** (StoreKit 2 + Play Billing, server notifications, restore, offline grace, sandbox-tested per §U); **the launch discoverability package** (localized listings, keyword sheets, screenshots per locale, ratings prompt, store-policy verification); rate-limit verification; scripted permission/RLS penetration checks; backup schedule; full user data export; legacy Base44 migration, run as a **parallel-run cutover, not a big bang**: both apps live during beta; accounts migrate in batches with per-account reconciliation (17-value status enum mapped to per-type statuses; counts and totals reconciled to the naira; migrated documents assigned EN-NG frozen labels matching what they were issued with); webdocflow.com points at the new app only after totals match; the legacy backend stays readable — never writable — for a grace window; final sweeps — accessibility, dark mode, RTL readiness assessment, responsive, terminology (every launch locale walked through every screen and PDF), onboarding, command palette/sidebar.

**Gate:** a staff account cannot exceed its permissions via direct API; a revoked device cannot sync; migration reconciles to the naira; store purchases, restore, grace and refund paths pass on sandbox and physical devices; every launch locale's listing and landing pages are live; every sweep passes; the §V checklist is green end to end.

---

# R — Onboarding and account lifecycle

**Welcome:** plain-language explanation of the four document types in the device's inferred language and terminology; sign-in, account creation, and a clearly-labelled sample preview. Initial auth needs a connection; a local demo is never passed off as an account. **Business setup:** company name, **business country** (pre-filled from the phone; sets terminology, currency default, bank fields, tax label, date format in one confirmation — replacing the bare currency default, adding no new required field), plus the minimum to create a document; logo, address, payment details and signature each offer "Do this later"; every completed step saves and resumes after restart; the same fields and validation as Settings. **First task:** create any of the four (under their local names), or view a sample — sample records are visually labelled and excluded from balances, counts and analytics; the prototype's seeded money never enters a real account. **Home checklist:** short, dismissible (business details, logo, payment, first document); completing the underlying action ticks it automatically; help lives at the step that needs it. **Returning users:** straight to Home with the normal greeting; onboarding never repeats after login; logout routes to welcome and protects local work per §M; reset and Google use the real provider with proper native/web return URLs.

---

# S — Languages and RTL

English ships first with regional terminology variants (EN-NG, EN-GH, EN-GB, EN-US at minimum). French, Spanish and Arabic remain in committed scope, each with its own terminology table, validated by native-speaker review. **Arabic ships only with complete RTL acceptance** — forms, sheets, the builder, swipe directions, charts and the printed PDFs all mirrored and verified; the Arabic-capable typeface bundled; no non-working language toggle ever ships. Language and region are independent choices (a French-speaking business in Lagos gets FR strings with NGN banking and its chosen terminology). Number, date and currency formatting follow the locale through the same layer that formats money in §K.

---

# T — Discoverability: ASO and web SEO *(new)*

The goal: when someone searches any of the four document types, in any launch language — "invoice maker", "receipt app", "quotation", "delivery note", "waybill app", "devis", "cotización", "bon de livraison" — DocFlow has the strongest achievable presence in the app stores and on the open web. **Honesty first:** no app can guarantee a ranking; stores control results. What is buildable is complete, localized coverage plus the signals stores reward — and nothing forbidden (no keyword stuffing, no incentivised or fake reviews, no competitor brand names in metadata). Everything below reuses the §D terminology tables, so discoverability inherits every locale automatically.

## Store optimisation (ASO)
- **Localized listing per launch locale**, generated from the terminology tables: title, subtitle, keyword field, description, screenshots and preview video re-shot with that locale's labels and currency. Title pattern: **"DocFlow: Invoice & Receipt Maker"**, localized — e.g. "DocFlow: Facture & Devis" (FR), "DocFlow: Factura y Cotización" (ES), with the UK listing surfacing "Delivery note", the NG/GH listing "Waybill", the US listing "Estimate & Packing slip".
- **Keyword coverage as a build artefact:** a per-locale keyword sheet derived from the terminology synonyms (all four types + maker/creator/generator/template/app variants + "offline", "small business", "PDF") maintained in the repo beside the terminology tables, mapped to Apple's keyword field and woven naturally into the Play long description. Reviewed quarterly against store search-console data.
- **Store assets that rank and convert:** screenshots showing each document type by its local name; in-app events / promotional content for feature launches; ratings prompt via the native review API at a happy moment (after a successful share), never after an error, never gated.
- **The four types are four doorways.** Apple in-app purchase promotion, Play listing experiments and custom store pages (where available) each target one type per locale — the "waybill" searcher and the "quotation" searcher land on tailored first impressions of the same app.

## Web SEO
- **A marketing site with a localized landing page per document type per language** (e.g. `/invoice-maker`, `/delivery-note`, `/fr/devis`, `/es/cotizacion`): fast, static, `hreflang`-linked, with `schema.org` SoftwareApplication + Offer markup, a sitemap, and store smart-banners. Each page demonstrates the real product (template gallery renders from the same sixteen designs) rather than stock copy.
- **Deep links:** iOS Universal Links + Android App Links so landing pages, "open in app" buttons and shared links route into the installed app; store links carry per-page campaign parameters so acquisition per document-type page is measurable.
- **Privacy boundary:** public signing/acceptance pages (§P) are `noindex, nofollow` and excluded from the sitemap — customer documents must never enter a search index. Only marketing pages are crawlable.

## Measurement and cadence
Store console search terms, page-level web analytics and per-locale conversion reviewed quarterly; the keyword sheets and listings updated in the same cycle as terminology-table changes. New launch locales ship listing + landing pages + keyword sheet together — a locale is not "launched" without its discoverability package.

---

# U — Monetization: plans and billing *(new)*

## The plans
- **Free** — the honest core, forever: creating and issuing documents of all four types, customers, payments and receipts, PDF export and sharing, one default template set, one device + web. Generous enough that a market trader never hits a wall mid-sale (Rule #1).
- **DocFlow Pro** (monthly / annual, annual discounted; regional pricing per store templates so NGN, GHS, INR prices are sane, not naive conversions) — all sixteen templates and design overrides, the AI tools (voice, scan, extraction, ask box; logo generation per §O), staff accounts and admin, recurring invoices, statements, expenses/Kept analytics, customer labels, and priority support. A 7–14 day free trial via native store offers.
- The exact free/Pro line is a **product decision recorded in §W** before Phase 5 — the architecture below is indifferent to where the line lands. Whatever the split, Rule #6 holds: existing documents, viewing, sharing and full export are never gated.

## Billing rails (platform rules respected)
- **iOS:** StoreKit 2 subscriptions through App Store billing. **Android:** Google Play Billing. Digital subscriptions on mobile go through the platform stores — their commission, tax handling, refunds, family/grace policies apply. Store steering/external-purchase policies change frequently and vary by region: **verify the current rules at submission time in each store market** rather than assuming today's.
- **Web:** card/provider billing (Stripe or Paystack per market) for the same Pro plan, purchasable on the web app; one company, one plan, whichever rail paid for it.
- Purchases, renewals, cancellations and refunds are managed in the platform's native subscription UI; "Manage plan" in Settings deep-links there. **Restore purchases** is always present.

## Entitlements: server-verified, offline-respecting
- The client never decides what was bought. App Store Server Notifications v2, Play Real-Time Developer Notifications and web-provider webhooks land on Supabase Edge Functions, are **signature-verified and idempotently applied** (replayed events change nothing) into `subscriptions`, which derives one `entitlements` row per company.
- Devices sync the entitlement as a **signed, expiring payload cached in SQLite**. Pro features check the cache locally — so Pro works in airplane mode — with a built-in **offline grace window** (entitlement validity + grace, tuned so an ordinary offline stretch never downgrades anyone mid-document). Past grace with no successful refresh, the app degrades politely to Free: a calm one-line notice, no data loss, no locked documents (Rule #6), everything restored on the next successful check.
- Downgrade/cancel keeps Pro until the paid period ends; billing issues follow the store's grace/on-hold states, mirrored in `subscriptions.status`. Staff seats attach to the company entitlement, enforced server-side like all permissions (§P).

## Honest UX
One quiet "DocFlow Pro" row in Settings; contextual unlock sheets exactly where a gated feature is tapped ("Statements are part of Pro"), each with the price, the trial, and a no-hard-feelings dismiss. No modal ambushes, no fake urgency, no feature that silently produces a paywall after work is done — a gated feature announces itself **before** the user invests effort. Receipts/invoices for the subscription itself come from the store or provider, not from DocFlow.

## Testing and gates
Sandbox/TestFlight and Play internal-testing purchase flows; webhook replay and out-of-order delivery tests (a duplicated notification never extends or double-bills); offline-grace expiry simulated on device; restore-purchases verified on a wiped reinstall; refund and chargeback paths verified to downgrade without touching documents. Billing lands in two steps: **entitlement schema and gating in Phase 1–2 (everything defaults to Free features until billing exists), web billing + entitlement sync in Phase 5, store billing in Phase 7 pre-launch** — because store review requires near-final builds.

---

# V — End-to-end acceptance checklist

- A new user signs in, confirms a pre-filled business country, completes or skips optional setup, and creates the first real document with no demo balances — seeing their region's document names throughout without ever choosing them.
- Each builder works offline, autosaves, resumes, and renders correctly in all sixteen templates, in every launch locale, at the longest shipped labels.
- Delivery documents never show prices, tax, totals or payment instructions — under any name. Receipt money always traces to a recorded payment.
- A long multi-page invoice repeats headings, breaks rows safely, keeps totals and signatures on-page. Logos never crop.
- Payment setup returns to the intact draft. NGN prints exactly bank / account number / account name.
- A part payment updates invoice, customer, Home and analytics once; issuing or resharing its receipt never increments income.
- Issued PDFs keep their reference, totals, signature, branding **and labels/language** through later edits, region changes and sync.
- Switching region changes every label everywhere at once — tiles, lists, builders, share text, future PDFs — offline, and search still finds documents by old and new names alike.
- Airplane-mode restart preserves documents, photos, signatures, payments and generated logos; reconnecting uploads once and updates the web account.
- Two devices editing a draft retain both versions; duplicate retries never duplicate payments or numbers; devices in different languages see identical data under their own labels.
- Logout reaches welcome, protects pending data, and never exposes it to another account.
- Every device tier delivers its promised AI behaviour honestly; extraction understands the locale's document vocabulary; Tier B passes the same review-screen fixtures; unsupported states are truthful; traffic inspection shows zero outbound AI bytes.
- The logo engine — at whichever ladder rung shipped — passes the twenty-distinct rubric on the fixed test set under human review, offline, on target devices, including non-Latin names.
- Large text, screen readers, keyboard navigation and reduced motion work without clipped actions; unlabelled nav icons carry accessible names in the active language; the glass layer degrades cleanly where blur is unavailable; RTL locales (when shipped) mirror completely, PDFs included.
- Public links enforce isolation, expiry and allowed actions, render the frozen language, and signed links cannot alter evidence.
- Permission changes, export, deletion, interrupted downloads and full-storage failures preserve work or fail recoverably.
- Subscribing on any rail unlocks Pro on all the company's devices; cancelling keeps Pro to period end; a lapsed plan never blocks viewing, sharing or exporting existing documents, and Restore purchases works on a wiped reinstall.
- Replayed or out-of-order billing webhooks change nothing; offline grace behaves as specified — Pro survives ordinary offline stretches and degrades politely past grace.
- Every launch locale ships with its localized store listing, keyword sheet and landing pages; public document links are noindexed; ratings prompts appear only at happy moments.

---

# W — Decisions still requiring evidence

- Final Tier-A model selection (exact quantization, checksum, licence) — pinned by the Phase-0 spike, not assumed.
- The image model for logo rung 1, or the formal adoption of rung 2 — decided by the Phase-0 spike.
- PowerSync validated against the chosen encrypted SQLite configuration before pinning the queue design.
- Currency/bank field definitions, tax behaviour **and terminology tables** validated per launch market by native-speaker and in-market review; the sample rates and draft labels are not compliance or linguistic determinations.
- Multi-device rollout scope at launch (mobile + web is committed; additional simultaneous mobiles is a rollout decision).
- French, Spanish and Arabic release scheduling — Arabic ships only with full RTL acceptance including PDFs.
- The launch set of English terminology variants beyond EN-NG/EN-GH/EN-GB/EN-US, and which regional synonyms the extractors must recognise per market.
- The exact Free/Pro feature split and price points per market (including whether AI tools are Pro-only or metered), decided before Phase 5 and recorded here.
- Current App Store and Play policies on subscriptions, external purchase links and commissions verified per store market at submission time — they change too often to pin now.
- Web billing provider per market (Stripe vs Paystack coverage, payout currencies, tax handling).

---

# X — What exists now, and what this document does not claim

The interactive prototype demonstrates the visual language, screen layouts, softened header, two-stat Home, glass surface pass, typography and simulated flows — in EN-NG terminology. Its logo picker is a demonstration, not the generator; its language screen is a preview, not the terminology layer; no billing or store presence exists yet. This document does not claim a deployed React/Capacitor build, encrypted persistence, a connected backend, working sync, native PDF fidelity, verified payment integrations, a working on-device model, validated terminology tables, or passed device tests. Those are the commitments and gates above. The product is finished when the gates pass — not when the screens resemble the prototype.
