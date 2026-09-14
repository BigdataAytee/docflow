# DocFlow — complete product and build specification

Version 3 · 11 September 2026 · Consolidated from the supplied app brief, the current frontend, and the decisions in this conversation.

This document describes the full intended product. It is a build handoff, not a claim that the production app already exists. The supplied markdown is the starting brief; the original frontend remains the visual reference, with the subsequently accepted changes recorded below. The repository, live backend, `CLAUDE.md`, and `PLAN.md` were not inspected for this write-up. Their implementation status and instructions must be checked when implementation starts.

### Decisions reconciled for this edition

| Subject | Requirement carried into the build |
| --- | --- |
| Design | Preserve the original Royal Blue Gloss layout and navigation. Keep the greeting and existing content. Apply the accepted softer header and professional typography. |
| Home statistics | Exactly two: **Outstanding** and **Received this month**. Document counts stay on the document tiles. |
| App typeface | **Plus Jakarta Sans**, as applied in the latest frontend, bundled locally. Inter is a fallback, not a second competing app style. |
| Onboarding | A short welcome, business setup, first-task choice, and a dismissible setup checklist. Resume unfinished setup without blocking document creation. |
| Logo creation | Company name and description produce at least **20 distinct relevant concepts**, four at a time: two with the name and two symbol-only. A downloadable on-device model is required. The current template wizard does not satisfy this requirement. |
| Offline | Mobile document work and installed local AI capabilities run without a connection. Delivery to another person, cloud sync, initial sign-in and model downloads require a connection. |
| Payment integrity | Payments are independent ledger records. A receipt represents an existing payment and must never increase income a second time. |
| Issued records | Freeze the printed document and its reference on issue. A later sync must not silently change a PDF already shared. |

The payment ledger, safe document numbering, field-validation adjustments and implementation gates below are engineering recommendations to resolve contradictions in the supplied brief. They preserve the requested user experience; they are explicitly described so implementers do not silently choose different behaviour.

---

## 1. What DocFlow is

A business-document app for small businesses, Nigeria first. A builder's merchant in Ifo, a trader on Balogun Street, a florist, an event planner. They create **invoices, quotations, receipts and waybills**, keep **customers**, record payments, track outstanding balances and expenses, and send documents as PDFs over WhatsApp.

It is being rebuilt from a Base44 web app into:

1. **A mobile app (iOS + Android via Capacitor)** that works **fully offline** — local SQLite is the primary store — and syncs whenever there is signal.
2. **A web app** (online-only) on the same cloud account.

- Repo: `https://github.com/BigdataAytee/docflow` — the Base44 SPA, kept in `/legacy` as reference only.
- Live legacy app: `https://webdocflow.com`
- Demo company used throughout the prototypes: **Dynamic Renaissance Business Enterprises Ltd**, Lagos Abeokuta Motor Road, Ifo, Ogun State.

### Rule #1 — simplicity is non-negotiable

Nothing in the rebuild may make the app harder to use than the legacy app. This outranks everything else here.

- The machinery is invisible. Offline storage, sync, UUIDs, outbox, conflict resolution, RLS, tokens — the user never sees a word of it. Open app → it works → things appear on the web later.
- Login is email + password or one tap "Continue with Google". No mandatory 2FA or PIN. Target a remembered session of at least 30 days, subject to the authentication provider’s session policy. After initial sign-in, ordinary offline use must not require a network token refresh. An expired cloud credential pauses sync and requests sign-in when needed without deleting local work.
- No new required fields. Every capability added since the legacy app is optional or has a default. A user who ignores all of it still makes an invoice in the same number of taps.
- One tap over forms. Recording a payment, signing a delivery, chasing money — one tap plus at most one small sheet.
- When any rule below conflicts with simplicity, simplify and note the deviation.

---

## 2. Stack and architecture

**Agreed technology direction.** Preserve this stack. Verify native plugins, licences, encryption, sync integration and local model support before pinning exact package versions.

| Layer | Choice |                                                                                                                         |
| ------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Frontend      | React 18 + Vite + TypeScript + Tailwind + shadcn/ui                                                                     |
| Mobile shell  | Capacitor (camera, share sheet, contacts, filesystem, secure storage, biometrics)                                       |
| Local DB      | SQLite on device, encrypted at rest                                                                                     |
| Cloud         | Supabase — Postgres + Auth + Storage + Edge Functions, RLS on every table                                               |
| Sync          | PowerSync preferred; hand-rolled outbox replay as fallback                                                              |
| PDF           | Generated on-device from the React templates. Never server-dependent.                                                   |
| IDs           | Client-generated UUIDs. Stable UUIDs for identity; final offline references use reserved number blocks or device-qualified references. See §10 before implementing issuance. |

### Architecture rules

- **Repository pattern.** All data access goes through `src/data/repositories/*`. Mobile wires them to SQLite + outbox; web wires them straight to Supabase. UI components never import a DB client.
- **Derived financial states.** `unpaid`, `partially_paid`, `paid`, `overdue` and `expired` are computed from dated documents and effective ledger entries. Persist actual lifecycle events separately. A cached rollup is rebuildable and is never the accounting authority.
- **Per-type lifecycle.** Invoice: draft → issued → cancelled/credited as allowed. “Sent” is a sharing event; “paid” is a derived balance state. Quotation: draft → issued → accepted/rejected. Receipt: issued → void. Waybill: draft → packed → dispatched → in_transit → delivered/returned. Validate allowed transitions; never use last-write-wins to overwrite a payment or a delivery signature.
- **Immutability.** Issued invoices and receipts are never edited. Corrections are void-and-reissue or a credit note.
- **Every mobile mutation** commits the local record and pending sync operation in one SQLite transaction. Then update the UI and display a truthful saved state. A failed commit must not show “Saved”. Use one supported upload queue through PowerSync, or the fallback outbox, not two competing replay engines.
- **Capability-aware features.** Local OCR, voice extraction, business questions and logo generation use installed on-device capabilities. Download/setup and remote links require internet. Missing models show a short download or unsupported-device state; manual work stays available. No cloud AI processing or automatic online fallback is permitted. Use the open-source offline stack in §12.
- Files stay under \~300 lines. The legacy `CreateDocument.jsx` at 1,669 lines is the anti-pattern.

### Data model

- **companies** — id, name, logo\_url, brand colour, name style, logo size, currency (default NGN), optional configurable tax defaults (the supplied examples use VAT 7.5 and WHT 5; these are product sample values, not verified tax advice), numbering prefixes, bank account fields (see §7), enabled payment methods.
- **users** — id, company\_id, role (owner|staff), permissions json. Created through Supabase Auth.
- **customers** — id, company\_id, kind (company|person), name, contact\_person, phone, email, address, city, state, labels[], private\_note, created\_at, updated\_at.
- **documents** — id, company\_id, type, per-type status, issued_reference (fixed at issue), internal_sequence (nullable until sync), provisional\_number, customer\_id + a denormalised customer snapshot, line\_items json (id, description, qty, unit\_price, discount, tax\_flag, image\_url, unit for waybills), totals, currency, issue\_date, due\_date, valid\_until, payment IDs / derived payment summary, related\_invoice\_id, converted\_from\_id / converted\_to\_id, recurrence json, waybill fields (driver\_name, vehicle\_number, dispatch\_date, expected\_delivery\_date, signer\_name, signer\_role, signed\_at, signature\_url, delivery\_photo\_url, quantities\_confirmed), signing token hash + expiry (server-only; public-token records kept separate from general document reads), template\_id, design overrides, signature\_url, created\_at, updated\_at, deleted\_at.
- **payments** — id, company_id, customer_id, currency, amount_minor, paid_at, method, reference, source (manual/provider), external_event_id, created_by, reversal_of_id, created_at. Each payment is recorded once; amendments use a reversal and replacement.
- **payment_allocations** — id, payment_id, invoice_id, amount_minor. Enforce currency, allocation limits and company ownership. This supports part payments without duplicating payment records.
- **credit_notes** — id, company_id, invoice_id, reference, amount_minor, reason, issued_at and immutable invoice snapshot reference. Track customer credits separately from cash refunds.
- **assets** — id, company_id, local_path, remote_storage_key, hash, mime_type, byte_size, upload_state, created_at. Documents refer to stable asset IDs rather than a remote URL that may not exist offline.
- **logo_projects / logo_concepts** — project ID, company ID, name/description snapshot, model version, seed, concept ID, local asset IDs, concept type, selected state and generation state. Preserve generated concepts across restarts.
- **items** — the saved catalogue: id, company\_id, name, last\_price, unit, times\_used, updated\_at.
- **expenses** — id, company\_id, description, category, amount, date, photo\_url.
- **outbox** (SQLite only) — id, entity, record\_id, op, payload, created\_at, attempts.
- **audit\_log** (Postgres) — id, company\_id, user\_id, device\_id, action, entity, record\_id, at.
- **counters / numbering_reservations** (Postgres) — company_id, doc_type, next_number, device_id and reserved range, with atomic reservation and uniqueness enforcement.

---

## 3. Design system — Royal Blue Gloss

**Locked.** This is a rebuild plus polish, not a redesign.

**Primary blue** `#4a60ee → #2b3fd6 → #1a2a9e` (gradient) · tint `#eef1ff` · text-navy `#1d2452` · page background `#eef2fb`.

**Per-type colour**, applied to headers, hero cards, step bars, accents and the tile on Home:

| Type | Accent | Tint | Deep |
| ---------------------- | --------- | --------- | --------- |
| Invoice                | `#2b3fd6` | `#e6ebff` | `#1e2fae` |
| Quotation              | `#534AB7` | `#EEEDFE` | `#3C3489` |
| Receipt                | `#0F6E56` | `#E1F5EE` | `#085041` |
| Waybill                | `#BA7517` | `#FAEEDA` | `#854F0B` |

**Status colours** — blue `#185FA5` on `#E6F1FB` (sent, in transit) · green `#0F6E56` on `#E1F5EE` (paid, delivered, settled) · amber `#854F0B` on `#FAEEDA` (overdue, part paid, owing) · coral `#993C1D` on `#FAECE7` (money out, void).

**The gloss pass** — every card carries a light sheen across its top third, a white inner highlight, and a layered shadow: one soft wide shadow plus one tight contact shadow, so cards sit *above* the page rather than floating flat. Inputs are inset so they read as recessed. Buttons are raised with a top highlight. The four type tiles on Home each carry their own coloured shadow. The header, hero bands and the paid bar all have gradient depth. Keep the accepted header noticeably blue but lighter than the original deep navy gradient; blend its lower edge into the page with restrained highlights. Do not add heavy blur. Any sheen is subtle and stops under reduced-motion settings; no continuous pulsing is required.

**Typography** — Plus Jakarta Sans, bundled and loaded locally; Inter/system sans is the fallback. Preserve the latest frontend’s regular body text and medium/semibold hierarchy. Keep the greeting and existing wording. Bundle every font actually required by the sixteen document templates; do not assume a fixed font count before auditing them. No CDN or Google Fonts dependency in the installed app. Use readable body and form sizes, normally 14–16px; 10.5px is only the supplied prototype’s small-label floor, not a target for essential text. Respect device text scaling.

**Shape** — cards `rounded-2xl`, inputs `rounded-lg`, chips and primary buttons fully round. Tap targets ≥ 44px.

### Bottom navigation — "B"

Settled after several rounds, including two that were tried and rejected.

- A **floating glass pill**, centred, sitting above a soft contact shadow.
- **Four unlabelled icon tiles**: Home, Customers, Analytics, Settings.
- The active tile **lifts** (`translateY(-4px)`), its icon scales slightly, and a short dark dash appears beneath it.
- Pressing scales the tile down to 0.9.
- The **create button is not in the nav**. It is a round `+` FAB at the bottom-right of each document list page, in that type's colour.

Rejected on the way here: a two-lobe nav with labels and a raised square centre button; and a version with an orange active state and orange centre button. The app stays blue.

---

## 4. Screens

### Home

The only place all four document types appear together.

- **Header** (blue gradient, rounded bottom): logo holder, business name, a line that reads "Tap to add your logo" until one is set; a connectivity indicator driven by the actual connection and pending work; simulated toggling belongs only in a demo; a log-out button. Beneath: greeting, one line of copy, and two glass stat cards: **Outstanding** (remaining balance on issued, non-cancelled invoices after effective payments and credits) and **Received this month** (effective incoming payments in the company’s current calendar month). Receipts do not count as another payment; quotations and waybills do not contribute money. Show separate currency values when needed; never add NGN and USD together. Greeting follows local time and the signed-in user’s display name.
- **Search** — one field across customers, numbers, amounts and item names. Typing replaces the body with results; no match gives a plain empty state suggesting what to try.
- **Voice and Scan** — preserve the two round controls. Show recording activity only while recording, and explain when a required local model has not been downloaded.
- **Four type tiles** in a 2×2 grid, each with its own colour, icon, count badge and coloured shadow.
- **Needs attention** — the two or three things that actually want doing: an overdue invoice with the amount still outstanding and a "Chase" chip, a waybill in transit with a "Sign" chip. Tapping opens the document.

### Document list pages — one page per type, never combined tabs

- A **hero card** in the type colour: a small "DOCUMENTS" eyebrow, the type name with its icon, the count beneath ("4 invoices"), and an inset translucent "+ New invoice" button. Soft corner circles and a sheen.
- A **type-named search** below it ("Search invoices…"), filtering live.
- **One white list container**, hairline-divided rows: reference and status badge on the left, amount right-aligned, customer on the second line.
- Swipe for one-tap actions: mark paid, record payment, share. “Mark paid” opens a prefilled payment confirmation; it never writes a standalone paid flag.
- Round **+ FAB** bottom right.

### The builder — five steps, named per type

Invoice, quotation, receipt: **Details → Items → Totals → Design → Review**
Waybill: **Deliver to → Goods → Dispatch → Design → Review**

A coloured header with a close ✕, the title, and "Draft saved automatically". A five-segment step bar. Back and Next at the bottom; Next becomes "Save invoice" on the last step. Drafts autosave after a short debounce and on step changes, with a visible saved state. Flush pending edits on exit/foreground transitions where supported. A dirty-guard handles failed or unfinished saves; restoring after a force-kill must recover the last committed draft.

**Step 1 — Details, condensed to one screen.** Four compact cards with small tinted header strips. Keep Next reachable at the bottom; allow scrolling on small screens and at larger text sizes rather than shrinking fields:

1. **Number & dates** — the reference with a pencil to override it, then both date fields side by side. Tapping a date opens an inline calendar with month arrows, today ringed, the selection filled, and quick chips underneath that differ by type (Today · 7/14/30 days for an invoice due date; Today · Tomorrow for a waybill; Today · Yesterday for a receipt date paid).
2. **Customer** (or "Deliver to", "Client", "Received from") — one row showing avatar, name and address, opening a searchable dropdown with an "+ Add …" row at the bottom that carries whatever was typed. Beneath: Chat and Call chips, and a balance chip that reads "Owes ₦95,000" or "Settled". A small `+` in the card header adds a contact directly.
3. **Currency & payment** — currency picker on the left; on the right either a green confirmation of the payment methods that are set up, or an amber "Set up payment" button. That button carries the user into Settings with a blue return band across the top — "Setting up payment for your document · Back to draft" — and brings them back with the draft intact.
4. **Signature** — a dashed tap-to-sign box, or the signature itself once drawn.

Per type: quotations show no payment method at all; receipts show date paid, the linked invoice, method and reference, and no due date; waybills show a delivery address and no money anywhere.

**Step 2 — Items** (Goods, for a waybill). One input with **autocomplete from the saved catalogue**, quantity, unit price (or unit, for waybills), and a `+`. Each line renders as a card with an optional photo, the description, the quantity × price, the line total, and a delete. A list icon in the header jumps to Settings → Saved items. Anything typed that isn't already saved is added to the catalogue with the price used, and a toast says so.

**Step 3 — Totals** (Dispatch, for a waybill). Subtotal, discount %, optional VAT and, for invoices only, applicable WHT using configured rates — each recalculating live — then a heavy rule and the payable total in the type colour. Waybills get driver and vehicle instead, and no money at all.

**Step 4 — Design.** See §5.

**Step 5 — Review.** The full page at A4 proportions, with an amber band listing anything still missing. Saving a draft is always allowed. Final issuance validates the signature requirement carried from the supplied brief and the type-specific required fields. An invoice requires an enabled payment method; a receipt requires an actual recorded payment and its method. Quotations and waybills do not require payment setup. Missing items link directly to the relevant step; nothing typed is discarded.

### The saved document

- For invoices, a blue **paid-so-far bar**: "₦50,000 paid of ₦145,000 · ₦95,000 left" over a green progress bar.
- **Payments** — every payment listed with date, method and reference, each with its own "Receipt" button. A `+` opens a sheet prefilled to the balance; changing the amount makes it a part payment. The balance flows back to the customer, to Home's "owed to you", and into analytics.
- **Chase this money** — a green WhatsApp row that opens a draft containing the real amount outstanding, the due date and the actual bank details, with Softer and Firmer variants. Nothing is ever sent without the user seeing it.
- **Repeat** — a toggle that produces a draft each month for review. Nothing auto-sends.
- **Actions**, four per type: share PDF, convert to…, sign, void/credit note (invoice); copy accept link, duplicate as Rev 2 (quotation); void and reissue, open the invoice (receipt); copy signing link, add photo (waybill).
- **Convert** offers only what makes sense — quote → invoice or waybill, invoice → waybill, waybill → invoice — and explains that a receipt is evidence of a recorded payment. Starting a receipt from Home records a payment first; it may link an existing invoice or represent a standalone sale, without inventing a duplicate invoice. The original is never altered. Links between converted records are preserved, and a waybill → invoice conversion asks for prices because the delivery record contains no money.

### Customers

List of cards with avatar, name, address and a balance on the right. Tapping opens the contact:

- Header with avatar, name, address, **labels** (Wholesale, Retail, VIP, Pays late) and a `+ label` chip.
- **Chat / Call / Statement** row.
- **Balance** — billed all time, paid, owing now, a progress bar, and a line like "Pays on average 9 days late. Consider asking for part payment up front."
- **History** — every document between you, each opening.
- **Notes** — private, never printed.

**Statement** builds a PDF of invoices against receipts for any period with a closing balance.

### Analytics — one page, no tabs, no filter panels

- **In / Out / Kept** for the month, three cards, with a paired in-versus-out bar chart across six months. Revenue alone was only half the picture.
- **How late the money is** — an ageing breakdown (not due yet, 1–30, 31–60, over 60) with a line calling out the worst bucket.
- **What sells best** — top items by value.
- **Expenses** — a list, and a `+` that opens a three-field sheet or a receipt photo. Adding one immediately moves "Kept".
- **Ask anything about your business** — a text box plus tappable example chips. The answer appears in plain language above a chart drawn in-app.

All figures and charts are computed from the copy on the phone and work offline. Arbitrary natural-language questions require a downloaded local language model; installed examples can use predefined local queries. “Kept” means recorded money in minus recorded expenses, not audited net profit. Display that basis in a short help note.

### Settings — only what lives nowhere else

**Your business**

- **Company & logo** — logo (upload or create on device), business name, address, **name style** (Classic, Serif, Stacked, Ruled, Monogram) with a live preview, **logo size on documents** (Small/Medium/Large), and the four numbering prefixes.
- **Tax** — VAT and WHT rates with a live worked example on a 100,000 invoice.
- **How you get paid** — see §7.
- **Saved items** — the catalogue, built from what gets typed, with prices that update next time.
- **Default signature**.

**You and your data**

- Your account (name, email, change password, log out).
- Language — English, French, Spanish, Arabic. Arabic lays the whole app out right to left.
- Dark mode toggle.
- Larger text toggle, following the phone setting.
- Data & sync — upload state, storage used on this phone, export all my data, and a **sync conflict demo**.
- Admin — staff and permissions, devices with revoke, activity feed.
- Help & support — WhatsApp chat and an expandable FAQ.

### The logo

- The home holder is a white rounded square with a thin inner margin. The logo scales until it touches that margin: a square one nearly fills it, a wide one spans the full width, a tall one runs the full height. **It is never cropped.**
- The design step carries a **logo on/off switch with a visible state** — green with the pip right and the words "Logo on", grey with the pip left and "Logo off". It carries `aria-pressed`, and the hint line beneath changes to match: "Your logo prints at the top of every design" or "Logo hidden — only your business name prints."
- The full logo generator works offline after a one-time model download on supported devices. Uploading a local image works without downloading a model. The current prototype’s preset-symbol engine is a demonstration only and must not ship as fulfillment of the AI requirement. See §17.

---

## 5. The sixteen document designs

All sixteen sit in **one continuous horizontal strip** beneath the live preview. There are no "original ten" / "six new" headings — that split was tried and removed. The six newer ones carry only a small green **NEW** tag in the corner. Tapping a card re-renders the full preview instantly and scrolls that card to centre. Names do not clip.

Above the strip: the design-name pill, a row of brand-colour dots, and the logo on/off switch.

**The original ten**

| Design | Character |                                                                                                                   |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Classic**       | Georgia serif, logo and name left, title right, a heavy rule under the header                                     |
| **Modern**        | Logo, name and title on one line, a 3px rule, then a grey bill-to/date band                                       |
| **Minimal**       | Thin hairline rule, title reduced to small letter-spaced caps, maximum white space                                |
| **Bold**          | Split header — name on white, title on a grey block — over a heavy accent rule                                    |
| **Elegant**       | Centred serif, a diamond between two rules, wide letter-spaced title                                              |
| **Sidebar**       | A 31% left column holding logo and name against a tinted panel; content right                                     |
| **Executive**     | Soft circle motif top-right, the title reversed out of a solid accent badge, accent rule beneath                  |
| **Wave**          | Clean header with an accent wave curving across the foot of the page                                              |
| **Compact**       | Everything on one header line, then a three-cell strip — number, client, date — for dense multi-line documents    |
| **Sikky**         | A coloured spine down the left edge, office address boxed top-right, centred underlined title, Georgia throughout |

**The six new**

| Design | Character |                                                                                                           |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| **Aurora**        | Full-bleed gradient band across the top, logo reversed onto white, name and title in white                |
| **Ledger**        | Faint accounting rules ruled down the page, a double rule under the header                                |
| **Botanic**       | Off-white stock, a fine leaf flourish top-right, centred Georgia, letter-spaced title between rules       |
| **Prism**         | An angular diagonal colour cut across the header, content starting below the slant                        |
| **Bloom**         | Blush paper, a floral arch drawn across the top, italic serif name — for salons, florists, event planners |
| **Aria**          | Ivory inside a thin rose-gold frame, wide letter-spaced caps, a gold hairline under the name              |

A **Noir** design (dark charcoal and gold) was built and then removed at your request; Bloom and Aria took its place.

Every design renders the document type actually being built: waybills show goods and quantities with a "Received by" line and no money; quotations say "Estimated total" and carry a client-acceptance line; receipts say "Paid". The captured signature appears in the appropriate per-type signature slot in all sixteen.

The same component serves the builder and Settings → Document design, sharing one piece of state, so a change in either follows everywhere.

---

## 6. How a document is composed on the page

- **A4 portrait**, always. Generated on-device.
- **Header** — logo at the chosen size, then the business name in the chosen name style, then the type title and number.
- **Bill to / Deliver to** on the left, issue date on the right.
- **Line items** as a table: description (with a small thumbnail if a photo was attached), quantity, amount. Waybills swap amount for unit and drop every money column.
- **Totals** in a right-aligned block at 58% width: subtotal, VAT, less WHT for invoices, then the payable line above a heavy rule.
- **The foot of the page** carries the payment box and the signature, side by side.

### The payment box

This describes invoices. A receipt shows what was paid, when and by which method rather than an instruction to pay again. Quotations omit payment instructions by default; waybills contain no payment information.


- Headed **HOW TO PAY**.
- It prints **every saved account field as a labelled row**, account name included, with the labels in a left column so the values align.
- Online methods (Paystack, Flutterwave, PayPal, cash on delivery) are listed under a dashed divider. Label digital options “Other payment methods” and cash separately; cash is not an online payment method.
- The box stays **inline, at most about 60% of the width**, and sits beside the signature. It is never a full-width band.
- Waybills replace it with a "RECEIVED BY" rule for the recipient.

### The signature

- The actual captured signature. A placeholder may appear only in a clearly labelled draft/sample preview; it must never masquerade as a signed issued document.
- A **short rule of about 76px** beneath it — not a line across the page — carrying the per-type caption: AUTHORISED SIGNATURE (invoice), PREPARED BY (quotation), ISSUED BY (receipt), DISPATCHED BY (waybill).
- The signer's name under the rule.

---

## 7. Money — currencies, bank fields and payment methods

### One definition per currency, read by both the settings form and the PDF

This is the fix for the sort-code mistake. The fields a currency's bank account has are declared **once**. The settings form renders from that definition and the printed payment box reads from the same definition, so the two cannot drift, and no field can be invented for a country that does not have it.

| Currency | Fields |                                                                       |
| ---------------- | --------------------------------------------------------------------- |
| **NGN**          | Bank · Account number · Account name — **three fields, no sort code** |
| GBP              | Bank · Sort code · Account number · Account name                      |
| USD              | Bank · Routing number · Account number · Account name                 |
| EUR              | Bank · IBAN · BIC/SWIFT · Account name                                |
| GHS              | Bank · Account number · Branch · Account name                         |
| KES              | Bank · Account number · Branch code · Account name                    |
| ZAR              | Bank · Account number · Branch code · Account name                    |
| XOF / XAF        | Bank · IBAN · SWIFT · Account name                                    |
| EGP              | Bank · Account number · SWIFT · Account name                          |
| CAD              | Bank · Transit number · Account number · Account name                 |
| AUD              | Bank · BSB · Account number · Account name                            |
| INR              | Bank · Account number · IFSC code · Account name                      |
| AED              | Bank · IBAN · SWIFT · Account name                                    |
| SGD / CNY        | Bank · Account number · SWIFT · Account name                          |
| BRL              | Bank · Agência · Conta · Account name                                 |

These are the field sets proposed in the supplied brief, not a verified universal banking standard. Validate each country/payment rail before launch; support optional additional routing fields where required without inventing mandatory fields. Preserve the explicit NGN three-field requirement. Switching currency re-renders the fields and tells the user so. The currency symbol on line items and totals comes from the same source.

### Payment methods

Bank transfer, Paystack, Flutterwave, cash on delivery, PayPal. Each is off until added. The bank transfer row shows the live account details rather than a fixed label. Everything switched on prints in an invoice’s payment instructions; the count shows in Settings and in the builder's confirmation chip. Drafts can always be saved. Enforce payment setup only at the appropriate final invoice/payment step, never on a quotation or waybill. External payment collection needs connectivity. A user can record an offline manual payment; a provider-backed payment is confirmed only by a verified, idempotent provider event.

---

## 8. Input validation

Validate without destroying what the user typed. Show a specific inline message beside an invalid field; retain the input for correction. Do not shake controls or rely on red alone. Validate complete values on blur/save, keeping typing and paste comfortable.

| Field | Behaviour |
| --- | --- |
| Amounts, quantity and rates | Locale-aware decimal input; correct precision and bounds. Use exact decimal arithmetic and currency minor units, not binary floating-point for money. |
| Bank identifiers | Treat as strings to retain leading zeroes. Validate according to the selected bank-field definition; allow spaces/hyphens for readable entry where appropriate. |
| IBAN, SWIFT, IFSC | Normalize case and spacing according to the field; retain the entered value if validation fails. |
| Phone | Accept country prefix and common formatting, validate on save, store display and normalized forms. |
| People, company, account and place names | Unicode text, spaces, accents, apostrophes and hyphens; do not use a letters-only rule. Names and account names can legitimately contain numbers. |
| Email | Validate on blur/save without rewriting the local part. |
| Addresses and vehicle plates | Permit the expected mixture of letters, numbers and punctuation. |

Enforce maximum lengths, required fields and allowed transitions at both local command and server boundaries. A database failure keeps the draft and shows a retry action. Reject a receipt without an effective payment; reject an allocation exceeding its payment or invoice balance unless handled as an explicit customer credit.

---

## 9. The ten improvements

All attached to screens that already exist. No new tabs.

1. **WhatsApp payment reminders** — drafts the message with the real outstanding amount and the real account details, offers Softer and Firmer wording, and never sends anything unseen.
2. **Saved item catalogue** — builds itself from what gets typed. Autocomplete in Items, full list under Settings → Saved items, prices update next time.
3. **Partial payments** — a paid-so-far bar on the invoice, a payments list, each payment able to make its own receipt, and a balance that flows to the customer, to Home and to analytics.
4. **Recurring invoices** — a Repeat toggle that produces a draft each month for review. Nothing auto-sends.
5. **Customer statements** — a PDF of invoices against receipts with a closing balance, from the contact page.
6. **Expenses** — three fields or a receipt photo. Analytics becomes In / Out / **Kept**, with a paired in-versus-out chart.
7. **Sync conflict notice** — plain language: "Sola changed this too. Your changes and Sola’s changes differ. Choose which version to use. Both versions are saved." See both / Use mine / Use theirs. Keeping a version is permission-checked and never bypasses issued-document immutability. Demo under Settings → Data & sync.
8. **Empty states** — first run offers "Create my first invoice" and a sample document to look at.
9. **Accessibility** — readable text sizes and scalable controls, greys darkened, and a large-text preview toggle so layouts are proven to reflow rather than clip.
10. **Performance** — virtualised lists, a local search index, and pre-computed monthly rollups. Spec only; nothing visible.

---

## 10. Offline, sync and conflicts

### Local work is the primary mobile experience

After initial sign-in and required downloads, airplane mode must support customers, catalogue, all four document builders, drafts, signatures/photos, on-device PDFs, local sharing/export, payments, receipts, expenses, statements, charts and installed AI features. Opening WhatsApp or a share sheet offline can hand off a file; actual delivery depends on the receiving app and connectivity. Do not claim that a recipient has received it.

Mobile uses encrypted SQLite and locally stored assets. Web uses the same repository interface against the cloud and is online-only in this scope. Fonts, template assets and required icons ship with the mobile app. Nothing needed to open a saved document depends on a CDN.

### Upload and download behaviour

Persist local changes and their pending upload atomically. Each operation has a unique idempotency key, entity version, actor and device ID. Retry with backoff when connectivity returns or the app is foregrounded. Background execution is best effort on mobile operating systems; never promise instant sync while the app is suspended. A server acknowledgement, not merely network availability, determines that an operation has uploaded.

Resume partial asset uploads and verify content hashes. Keep a durable pull cursor; apply downloaded changes transactionally before advancing it. Retried creates, payments, conversions and recurring jobs must not create duplicates. Parent records and asset references must resolve before dependent operations become externally available. A pending local photo or logo remains visible before upload.

Use PowerSync’s supported upload mechanism if selected. The fallback implements equivalent durable replay and conflict handling; it is a contingency, not a parallel second sync system.

### Conflicts

Use record revisions rather than device timestamps alone. Automatically merge non-overlapping edits to editable drafts when safe. If two users edit the same field, retain both versions and show a plain-language comparison. Never silently overwrite issued financial documents, payment events, delivery evidence or permission changes. Only entitled users may resolve conflicts. Soft deletion is versioned and cannot resurrect a record through a stale update.

### Document numbers and frozen PDFs

The supplied brief’s “silently replace the number at first sync” conflicts with sharing an immutable invoice offline. Use server-reserved number blocks where available, with a stable device-qualified final reference as the offline fallback. The server enforces company/type/reference uniqueness. Human-readable final references are fixed at issue and embedded in the stored PDF snapshot. A separate internal server sequence may be assigned later without changing the issued reference.

Drafts can show provisional references and allow a validated override. Offline overrides cannot be guaranteed globally unique before sync; use the safe device-qualified form for offline issuance. Requiring a gapless central sequence would require online issuance and is incompatible with the current offline requirement; do not impose it silently.

### Status, errors and logout

Show “Saved on this phone”, “Waiting to upload”, “Uploaded”, or “Needs review” where useful. Do not expose database jargon. Preserve failed operations, show an actionable per-record error, and retry without double posting.

Logout returns to the welcome/landing screen, not the dashboard or a broken redirect. When local work is pending, explain it briefly before logout. Retain the encrypted account-specific local store by default, lock access and clear active credentials. Never expose that store to the next signed-in account. Deleting local data is a separate explicit action. Remote device revocation takes effect on the next connection; it cannot instantly erase a device that is offline.

---

## 11. Security — server side, invisible to users

- RLS on every table scoped to `company_id`, proven by a test where a second account cannot read or write the first account's rows.
- Public waybill and quotation links require a per-document random token, checked on read and on sign, invalidated after signing or after 14 days. An expired or wrong token shows a friendly message and never data.
- The server revalidates totals, statuses and dates on sync and rejects invalid transitions.
- Supabase Auth handles login, reset and OAuth. No custom auth logic.
- Rate limiting on auth and public endpoints. Append-only audit log of user, device, action and timestamp.
- Local SQLite encrypted, keys in Capacitor secure storage, no secrets in the JS bundle, uploads in access-controlled buckets.

---

## 12. AI features — offline, open-source and always reviewable

**All AI processing in the mobile app runs on the device. No cloud AI API, Supabase Edge Function, remote transcription service or automatic online fallback is permitted for these features.** Internet is needed only to obtain the app/model packages and later sync user-approved business records. Once the required models are installed, the features must work in airplane mode. An installed model must not require online activation, periodic licence checks or a live login to run locally.

### Open-source implementation baseline

The following projects provide the proposed building blocks. Their documented capabilities were checked against their official repositories on 11 September 2026. This is an implementation selection, not evidence that DocFlow has already integrated or benchmarked them.

| Feature | Selected building block | DocFlow integration to build |
| --- | --- | --- |
| Voice transcription | **whisper.cpp**, MIT-licensed native Whisper inference with Android/iOS support and an offline iPhone example. [1] | Native microphone capture and a Capacitor bridge to local transcription. Start by evaluating multilingual tiny/base models; select by real accent and device tests. |
| Image-to-text scanning | **Tesseract**, Apache-2.0 OCR with a native API and documented Android/iPhone compilation support. [2] | Local image preprocessing, OCR language data and a maintained native bridge. OCR returns text; DocFlow still has to reconstruct fields and line items. |
| Text/transcript/OCR extraction | **llama.cpp** with a local GGUF instruction model. Its grammar support can constrain output to supported JSON-schema structures. [3] | A small, validated document-extraction schema and a native worker that runs inference off the UI thread. |
| Language-model starting candidate | **Qwen3-1.7B**, whose official card lists Apache-2.0 licensing, non-thinking mode and local runtime usage. [4] | Evaluate a reproducible quantized build with non-thinking mode; pin the exact model, tokenizer, quantization, checksum and licence. Model size alone does not prove phone suitability. |
| Business questions | Reuse the same local language model and llama.cpp runtime. | Produce an allowlisted query plan, validate it, and calculate results against local SQLite using application code. No Edge Function or remote model. |

Project licences and model-weight licences are tracked separately in the dependency manifest. Include required notices. Build native Swift/Kotlin/C++ adapters for the existing Capacitor app; do not assume a React Native wrapper is a Capacitor plugin. Pin working revisions after native integration tests.

### Voice

Keep the original bottom sheet: **“Recording… 0:03”**, a transcript area, and **“Stop & extract”**. Audio remains on the phone. Process speech chunks locally for a provisional transcript; after Stop, finish transcription and extraction. If a tested device cannot update a transcript in real time, show “Transcribing on this phone” rather than fabricated live words, and document the unmet live-transcript target for that device.

Let the user choose invoice, quotation, receipt or waybill, each with a short explanation. The local language model turns the transcript into editable fields and line items for that type. Silence, background noise and uncertain amounts must not produce invented business data. Preserve recovered text if extraction fails, and offer manual correction. Handle denied microphone permission and interrupted calls without losing an existing draft.

### Scan

Open the native camera or choose an existing image. Crop, correct orientation and deskew locally, then run Tesseract using the installed language data. Feed the recognized text and available layout positions to the local extraction pipeline. Do not describe OCR alone as understanding an invoice or reconstructing a table.

Show the source image beside the editable result when needed. Highlight uncertain characters, amounts and line boundaries; do not infer missing prices. Camera denial falls back to local gallery or manual input. Low-quality images offer retake/crop rather than silently accepting poor output. Handwriting and complex tables must be tested separately from clean printed documents and never claimed supported without evidence.

The web app retains a gallery/file-picker entry point. Native mobile binaries do not run directly in a browser: browser-local inference is a separate tested adapter. If unavailable on a browser/device, keep manual entry and show the limitation; never send that input to cloud AI as a fallback. This does not change the separately agreed online-only cloud data mode of the web app.

### Type or paste

Keep the single free-text input. The local model extracts only supported values: proposed document type, customer details, currency, dates, goods/items, quantities, unit prices, notes and delivery details as applicable. Missing fields remain null or blank. Preserve the original input for correction.

Constrain output to the supported schema, then validate types, lengths, currency and date rules. Grammar-constrained output guarantees neither accurate extraction nor truthful content. Treat pasted text and OCR text as data, not instructions to execute tools, change permissions or access files. Totals are recalculated by deterministic money code; the model is never the authority for payment amounts or tax arithmetic.

### Mandatory review

Show extracted fields and line items before a business record is finalized. Highlight missing values, parsing conflicts and OCR uncertainty. Do not display a model’s self-reported confidence as a calibrated probability. Let the user change every extracted value.

The recovered content may be autosaved as a local draft, clearly labelled unconfirmed. It must not issue a document, create a payment, update a customer or mark a delivery complete until the appropriate user confirmation. Keep the amber summary of what was filled in and what still needs attention. Failure offers **“Continue manually”** with any useful text already recovered.

### Analytics ask box

The complete path is local: **question → local model → validated query plan → SQLite → calculated result → in-app chart and answer**. Remove the Edge Function described in the old brief. Questions, schema descriptions, business values and answers are not sent to a remote model.

The plan has allowlisted values for intent, metric, period, grouping, filters and chart type. The application applies company scope, staff permissions, date ranges, currency separation and result limits; it compiles a parameterized read-only query itself. Never execute raw SQL or code returned by the model. Summarize calculated results using local templates or the local model, checking that stated numbers agree with query results.

Keep the example chips; they execute predefined local queries immediately. Free-form questions must use the installed local model and be tested separately—example chips alone do not fulfil this feature. Unsupported questions ask for clarification or state the available metrics. Answers use the current phone copy of the data; where pending sync matters, say “Based on records on this phone.”

### Installation, privacy and failure states

Offer one simple **Offline tools** setup with the actual download size and storage requirement. It can install speech, OCR language data and the text model independently. Show download progress, cancellation/resume, checksum validation and recovery after interruption. The logo image-generation model in §17 is a separate dependency; these text/OCR projects do not fulfil image generation.

Once installed, inference uses no network service and no automatic input telemetry. Raw audio, pasted prompts and intermediate extraction text stay local by default and are not silently added to the sync queue. Final business records follow normal app sync; a photo deliberately retained as a document attachment may sync with that document. Temporary files have explicit retention/deletion behaviour.

If a model is missing, show “Download offline tools when connected.” If a device cannot run a model, state that accurately and keep manual workflows available. Do not relabel an unsupported device as “needs internet.” Do not load speech, text and image models simultaneously when memory is constrained; queue work and unload safely. Final phone support, latency, accuracy and memory budgets require measurement.

### Acceptance gate

Install the release app and required models on physical Android and iOS target devices, then block all app network access. Verify the following end to end:

1. Dictate a new business document, review transcription and extracted fields, and save a valid local draft.
2. Photograph and import printed documents, recover text/items, correct uncertainty and save without network calls.
3. Paste previously unseen text, obtain editable structured fields, and verify missing values are not invented.
4. Ask previously unseen business questions, validate the plan and compare displayed answers/charts with known SQLite fixtures. Confirm staff permissions and separate currencies.
5. Reopen after force-kill, cancel an inference job, deny permissions, and simulate low storage without losing committed work.
6. Inspect network activity to confirm zero outbound AI traffic, including questions, schema descriptions, images and audio. Repeat after an installed model has been offline for several days.

Use representative Nigerian accents, business names, currencies, dates and noisy environments in evaluation. Add each supported language to the test matrix. Set measurable quality and performance thresholds from the feasibility results before release; do not claim parity on every phone merely because the libraries compile.

**Official references**

[1] whisper.cpp: https://github.com/ggml-org/whisper.cpp

[2] Tesseract manual and native integration: https://tesseract-ocr.github.io/tessdoc/ and https://tesseract-ocr.github.io/tessdoc/Installation.html

[3] llama.cpp and structured-output grammar documentation: https://github.com/ggml-org/llama.cpp and https://github.com/ggml-org/llama.cpp/blob/master/grammars/README.md

[4] Qwen3-1.7B official model card: https://huggingface.co/Qwen/Qwen3-1.7B

---

## 13. Admin

Owner role only. Staff with server-enforced permissions (create but not delete, hide revenue). An activity feed from the audit log. A device list with last-sync and a revoke that causes that device's next sync to be rejected and locks cloud access. Offline cached access follows the device security policy until the device reconnects. Company settings — VAT default, prefixes, branding — sync to every device.

---

## 14. What we are not porting from legacy

- The entire Mail feature. Sending is on-device PDF → native share sheet, and a completed share handoff records a sharing event without claiming recipient delivery.
- The Apps launcher page.
- Custom auth page logic — keep the styling only.
- The legacy data layer, in any form.

---

## 15. Build order and completion gates

The phase sequence below carries forward the supplied plan. Compare it with the actual `PLAN.md` before implementation; this write-up does not claim that file was edited.

1. **Foundation:** project structure, domain types, repository contracts, authentication, migrations, company isolation and exact money rules. Gate: two companies cannot access each other; money and transition rules pass meaningful tests.
2. **Core offline app:** implement the accepted frontend with real SQLite persistence, all document types, customers, payments, expenses, local assets, signatures and PDF export. Gate: complete each core journey in airplane mode, force-kill, reopen and recover the committed data.
3. **Sync:** durable uploads/pulls, idempotency, asset transfer, numbering, conflict resolution and account isolation. Gate: interruption/replay and two-device concurrent-edit scenarios preserve records and never double-count money.
4. **Native polish:** camera, filesystem, contacts, share sheet, accessibility and device lifecycle handling. Gate: physical Android and iOS devices pass the flows, permission refusal and large-text checks.
5. **Web and remote links:** online web parity, expiring quote/waybill links and provider integrations. Gate: token expiry/reuse, unauthorized access and confirmed payment events behave correctly.
6. **Local AI:** logo, voice using whisper.cpp, OCR using Tesseract, and extraction/business questions using llama.cpp with a tested local model. Gate: install models, disconnect, complete the supported flows and validate outputs. The logo gate is at least twenty distinct relevant ideas; a template picker cannot pass it.
7. **Admin and launch:** staff permissions, revocation, audit, recovery, legacy migration, native packaging and release checks. Gate: migration reconciliation, backup/restore and permission tests pass, with documented supported devices.

Run the on-device logo feasibility experiment during Phase 1 rather than discovering device limitations at Phase 6. If it fails on target phones, the full requirement is not complete. Present measured options and the unmet requirement; do not silently replace it with presets or online generation.

## 16. Decisions still requiring evidence

- The chosen image-generation model, licence, native inference runtime and supported phone range. Measure memory, disk, latency, heat and energy use before making download-size or speed promises.
- Validate PowerSync with the selected encrypted SQLite/native configuration; pin a single queue design after that integration exercise.
- Validate the currency/bank field schema and configurable tax behaviour for supported launch markets. Supplied example rates are not a compliance determination.
- Plan for multi-device safety from the outset because mobile and web share an account. Whether additional simultaneous mobile devices are included at launch remains a rollout decision.
- English is the initial implementation baseline; French, Spanish and Arabic remain in scope. Arabic requires complete RTL acceptance, including forms, sheets and PDFs; record release scheduling rather than shipping a nonworking language toggle.
- Obtain the real `CLAUDE.md`, `PLAN.md`, repository and deployment configuration during implementation. This document does not introduce an extra approval step before already-authorized work.

## 17. Logo creation — complete requirement

### The user journey

Settings → Company & logo → Create a logo. Ask for **company name** and **a short description of what the company does**. Do not make users choose technical model settings or learn prompt engineering. Optional style preferences can be offered later, but are not required to obtain useful results.

On a supported phone without the model, explain the one-time download using the actual package size. Show progress, pause/resume and available storage. The app remains usable while the download runs. Do not claim a model is installed until its integrity check passes and it loads successfully.

After setup, **Generate ideas** starts local generation. Present **four ideas at a time: two with the company name and two symbol-only**. Each project must be able to produce **at least twenty distinct ideas**, giving at least five sets. Retain earlier results so the user can return to them; “More ideas” produces unseen concepts, never wraps around to set one or disguises a recolour as new artwork. Saving and selecting do not require network access.

### What counts as a distinct idea

Twenty ideas means twenty different core visual concepts or substantially different compositions. Changing only the palette, font, background, rotation or adding/removing a name from the same mark does not count as another idea. Named and symbol-only suggestions in the twenty-idea quota must therefore not merely duplicate one another. A chosen concept may subsequently offer both formats without counting those formats as two new ideas.

The business description is the primary source of meaning. Use the name for brand context and lettering; do not infer an industry from an arbitrary brand name when the description says otherwise. Distinguish engineering specialties, product businesses and service businesses. Cosmetic manufacturing should not become a mechanical-engineering logo simply because “manufacturing” appears. A short clarification is appropriate only when the description genuinely leaves two incompatible interpretations; do not silently guess and present it as certain.

Examples of relevance: civil engineering may explore structures, infrastructure or surveying; mechanical engineering may explore motion, mechanisms or precision; cosmetic products may explore formulation, containers, beauty application or a suitable abstract interpretation. Do not force every company in a sector to use a stock literal icon.

### Generation and quality

Use a locally installed generative model with a local prompt planner or supported conditioning pipeline. Produce varied concept directions, track seeds/identities, and reject near-duplicates through image-similarity checks. Vary the underlying idea before merely varying its rendering. Preserve progress across interruption, allow cancellation and retain completed results. A partial batch must be labelled partial; do not promise twenty when fewer have finished.

Generate symbol artwork separately from company lettering. Compose the exact company name using bundled fonts so spelling, kerning, long names and Unicode can be controlled. Check small-size legibility, clean edges, balanced visual weight, clear space and usable light/dark backgrounds. A complex picture is not automatically a usable logo. Never claim a raster model produces a true vector file unless a real vector output/conversion pipeline is present.

Preview the selected logo in the existing home holder and on an A4 document. Keep “Use this logo” the primary selection action. Store the chosen original and suitable transparent export assets locally, and enqueue them for later sync. Changing branding affects future drafts/defaults; existing issued PDFs retain their original branding. Offer local PNG export; offer SVG only for actual vector output. Do not claim trademark clearance or guaranteed uniqueness.

### Definition of done

Test broad descriptions across engineering, cosmetics, food, retail, transport, trades, education, agriculture, technology, professional services and unusual/mixed businesses. Include long names, punctuation, non-English names and a name that appears to imply a different industry. Human review must assess relevance and visual quality; duplicate detection alone is insufficient.

On each supported target device: download once, enable airplane mode, enter a new name/description, produce twenty distinct concepts, browse five four-result sets, select a result, generate a document containing it, restart the app and recover it. Verify that “More ideas” never silently repeats previous concepts. Record generation time, memory and thermal behaviour. These tests are future build gates, not results achieved by the current preview.

## 18. Onboarding and account lifecycle

**Welcome:** explain invoices, quotations, receipts and waybills in plain language. Provide sign-in, account creation and a clearly labelled sample preview. Initial authentication requires a connection; do not pretend a local demo is a real account.

**Business setup:** company name and the minimum needed to create a document. Offer logo, address, payment details and signature with a clear “Do this later” where they are not immediately needed. Save each completed step and resume it after restart. Use the same company fields and validation as Settings.

**First task:** create an invoice, quotation, receipt or waybill, or view a sample. Sample records are visually labelled and excluded from balances, document counts and analytics. Do not place the prototype’s seeded money into a real account.

**Home checklist:** short, dismissible items such as add business details, add a logo, set up payment and create a first document. Completing the underlying action updates the checklist automatically. Put help at the step where it is needed rather than opening a long tutorial every time.

**Returning users:** open Home and preserve the normal greeting. Do not repeat onboarding after every login. Logout routes to the welcome screen and protects local work as described in §10. Password reset and Google sign-in use the real auth provider and proper native/web return URLs.

## 19. Financial and document rules

### Authoritative money

Store monetary amounts in exact currency minor units; use decimal quantities and a documented rounding policy. An invoice’s remaining amount is its issued payable amount less effective payment allocations and applied credits. Overdue is a positive remaining amount with a past due date. Do not infer payment from a shared receipt file or a toggled UI badge.

Received this month uses effective payments dated within the company’s calendar month, accounting for recorded reversals/refunds according to the ledger. A receipt is a view of a payment. Voiding an incorrectly formatted receipt alone does not erase a real payment; reversing a payment is a separate explicit action. Allocate overpayments to customer credit rather than silently forcing an invoice negative. Statements show opening balance, charges, payments, credits and closing balance.

Use separate currency buckets throughout Home, customer balances and analytics. No implied exchange rate or cross-currency allocation. Document tax/rate settings and customer/business details are snapshotted at issue so later setting changes do not rewrite history. Calculate the agreed discount/tax/WHT order deterministically and verify worked examples before launch.

### Issue, share and correct

Save draft → validate → issue a frozen document → generate/store its PDF → share/export. Sharing opens a native handoff; record “shared” after a successful handoff where the platform reports it, not confirmed delivery/read. A provider callback is required for delivery claims.

An issued invoice or receipt is immutable. Correct through an allowed cancellation/credit/reissue flow with linked references and a reason. Draft deletion and issued cancellation are different operations. Quotation acceptance and waybill delivery evidence carry event identity, signer and timestamp, and cannot be overwritten by a stale sync.

Recurring invoices create reviewable drafts, never auto-send. While offline or suspended, create missed drafts on next app execution with an idempotent recurrence key so reconnecting does not generate duplicates.

## 20. Build organisation and shared frontend

Keep the accepted frontend as the visual reference; its HTML demonstration is not the production data layer. Rebuild its screens as typed React components and reuse them across mobile and web, with platform services behind interfaces.

| Area | Responsibility |
| --- | --- |
| `src/app` | Routes, authentication boundary, company context and composition of services. |
| `src/features/onboarding` | Welcome, business setup, task choice and checklist. |
| `src/features/home` | Greeting, two computed stats, search, document tiles and attention items. |
| `src/features/documents` | Per-type lists, five-step builders, review, detail and allowed conversions. |
| `src/features/customers` | Contacts, balances, history, notes and statements. |
| `src/features/payments` | Ledger commands, allocations, receipts and reversals. |
| `src/features/analytics` | Currency-aware local rollups, expenses and approved query execution. |
| `src/features/branding` | Company branding, logo projects, concept browser and application preview. |
| `src/features/settings` | Payment setup, defaults, account, accessibility, data and help. |
| `src/domain` | Money, lifecycle rules, permissions, validation and immutable snapshots. |
| `src/data/repositories` | UI-facing interfaces and mobile/web implementations. |
| `src/platform` | Camera, sharing, files, secure storage and lifecycle adapters. |
| `src/sync` | Selected upload engine, pull application, conflicts and retries. |
| `src/ai` | Model installation, local inference adapters, generation jobs and capability checks. |
| `src/pdf` | Shared document layout definitions, pagination, fonts and native PDF output. |
| `supabase` | Migrations, policies, validated commands, public links and integration functions. |

Keep components focused; the supplied ~300-line guideline is a maintainability target, not a reason to split coherent logic arbitrarily. UI components never call SQLite or Supabase directly. Do not ship a frontend button whose implementation is merely a success toast.

## 21. End-to-end acceptance checklist

- A new user signs in, completes or skips optional setup, and creates the first real document without demo balances appearing.
- Each of the four builders works offline, autosaves, resumes and produces the correct document type in all sixteen templates.
- Waybills never show prices, tax, totals or payment instructions. Receipt money comes from actual payments.
- A long multi-page invoice repeats table headings, breaks rows safely and keeps totals/signatures within the page. Logo dimensions never crop artwork.
- Payment setup returns to the same intact draft. NGN displays the intended bank/account number/account name fields.
- Recording a part payment updates invoice, customer, Home and analytics once. Issuing or resharing its receipt does not increment income again.
- Issued PDFs keep their reference, totals, signature and branding through later edits and sync.
- Airplane-mode restart preserves documents, photos, signatures, payments and generated logos. Reconnect uploads once and updates the web account.
- Two devices editing a draft retain both conflicting versions; duplicate retries do not duplicate payments or document numbers.
- Logout reaches welcome, protects pending data and prevents a different account seeing it.
- On supported devices, the installed logo model meets the twenty-concept offline gate in §17. Unsupported or missing-model states are honest.
- Large text, screen readers, keyboard navigation, reduced motion and RTL release coverage work without clipped actions. Unlabelled nav icons have accessible names and a clear active state.
- Public links enforce company isolation, expiry and allowed actions; delivered/signed links cannot be reused to change evidence.
- Permission changes, export, deletion, model download interruption and full-storage failures preserve user work or give a recoverable error.

## 22. What exists now and what this document does not claim

The available frontend is an interactive design prototype. It demonstrates the original visual language, core screen layouts, the softened header, two-stat Home, professional font treatment, onboarding and several simulated actions. The logo iterations use built-in symbols and are not the requested model-backed generator.

This write-up does not establish a deployed React/Capacitor build, encrypted SQLite persistence, a connected Supabase backend, production sync, native PDF fidelity, verified payment integrations, a working on-device model, or passing physical-device tests. Those are the implementation and acceptance commitments above. The complete product is finished only when the build passes them, not when its screens resemble the prototype.
