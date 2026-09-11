# PLAN.md — DocFlow

**Where this conflicts with DocFlow-Build-v6, v6 wins.**

`DocFlow-Build-v6-Complete.md` is the authority. This file tracks *where the
build actually is* against §Q, and records decisions as they are taken. It
claims nothing the gates have not proven (§X).

---

## Status board

| Phase | Scope | Gate | State |
| --- | --- | --- | --- |
| **0** | Spikes and reconciliation | tier table + logo rung published; PLAN reconciled; terminology drafts in review; money tests green | **in progress** — spikes need devices |
| **1** | Foundation | cross-company denial; money/transition/label property tests; encrypted SQLite; auth ≤ legacy taps | **code complete, gate NOT passed** — 2 of 4 clauses unverifiable here (see below) |
| **2** | Core offline app | the airplane-mode walk-through on a physical device | **in progress** |
| 2 | Core offline app | the airplane-mode walk-through, fresh install, physical device | not started |
| 2.5 | Remaining improvements | each §L behaviour verified offline | not started |
| 3 | Sync | five offline documents arrive once, unique references, through a mid-sync kill | not started |
| 4 | Native polish | installable builds pass all flows on physical Android and iOS | not started |
| 5 | Web + public links | cross-device visibility; token behaviour per §P; one payment per event | not started |
| 6 | Local AI + logo | the §N six-step gate per tier; the §O definition of done | not started |
| 7 | Admin, hardening, migration, launch | the §V checklist green end to end | not started |

---

## Phase 0 — detail

### Done

- [x] **Secrets scan of the full git history, before the move** (Rule #2).
      Result: clean. See `docs/phase-0/secrets-scan.md`.
- [x] **Repo reconciled in one commit.** The Base44 app moved to `/legacy`
      (reference-only); the new build lives at the root; history, issues and
      links preserved. No new repo (Rule #2, decided).
- [x] **`PLAN.md` and `CLAUDE.md` rewritten** to match v6, both carrying the
      "v6 wins" line. No implementer faces two authorities.
- [x] **Money property-test harness in CI on day one.** `fast-check` over the
      five §Q groups — allocations never exceed a payment or invoice balance;
      receipts never move income; reversal + retry never double-counts;
      currency buckets never mix; discount/tax/WHT ordering matches the worked
      examples. Plus lifecycle transition tests. Blocking on every commit.
- [x] **Domain-layer skeleton** the money tests run against: `src/domain/money`
      (minor units, exact rates, largest-remainder distribution, document
      totals), `src/domain/documents` (internal types, statuses, lifecycle,
      immutability), `src/domain/payments` (the ledger).
- [x] **Rule-4 lint rule written and wired into CI** —
      `docflow/no-hardcoded-type-name` fails the build on a literal type name,
      party label or signature caption in `src/features`, `src/pdf` or
      `src/app`. §Q puts the rule in the Phase-1 gate; writing it now means no
      UI commit can ever introduce the debt it is meant to catch.
- [x] **Terminology tables drafted** for the seven launch locales — EN-NG,
      EN-GH, EN-GB, EN-US, FR, ES, AR — in `src/domain/locale/data`. Every
      table is `reviewStatus: 'draft'`; a structural test holds any table
      claiming `approved` to a named reviewer.
- [x] **Localized store metadata and keyword sheets drafted**, per §T, in
      `docs/discoverability` — into the same native-speaker review.
- [x] **Spike protocols written with the kill criteria fixed in advance**, per
      §Q: `docs/spikes/ai-hardware-spike.md` and
      `docs/spikes/logo-feasibility-spike.md`.

### Outstanding — needs physical hardware

These cannot be closed from a repository. They need the three cheapest
realistic market phones in hand (3GB-class included, not a flagship).

- [ ] **AI hardware spike run and the tier table published from measurements.**
      Protocol and kill criteria are fixed in `docs/spikes/ai-hardware-spike.md`;
      the results table is empty and stays empty until a device fills it.
- [ ] **Logo feasibility spike run**, ladder rung chosen from the result and
      recorded openly (`docs/spikes/logo-feasibility-spike.md`).
- [ ] **Terminology drafts sent to native-speaker review** and signed off
      market by market (`docs/locale/native-speaker-review.md`).

**The Phase 0 gate is not passed.** Three of its four clauses are green; the
tier table and logo rung are measurements nobody has taken yet. Phase 1 does
not start until they are.

---

## Phase 1 — detail

### Done

- [x] **Two-company RLS denial suite, blocking in CI.** The gate's headline
      clause, run against a Postgres service container — no hosted project, so
      no secrets, no network, nothing to go stale. RLS is ENABLE **and** FORCE
      on every table, applied by a loop over `public` so a table added by a
      future migration cannot miss out. Two mutations confirm the guard bites:
      a new table without RLS fails as `forgotten_table (enabled=false,
      forced=false)`, and dropping FORCE while leaving ENABLE fails as
      `documents (enabled=true, forced=false)`.
- [x] **The full §E schema** as Postgres migrations — 18 tables, RLS forced on
      all of them, billing read-only to the client, the audit log append-only.
- [x] **The locale layer** (`src/domain/locale/profile.ts`): profiles,
      terminology resolution, frozen-label snapshots, search terms.
- [x] **The label-resolution property test**, both halves of the gate clause:
      every surface resolves through one lookup, and *no hardcoded type-name
      string survives the lint rule* — asserted by running ESLint in-process
      over `src/features`, `src/pdf` and `src/app`, so the rule is a test and
      not only a CI step. Demonstrated failing on a planted
      `"Create a new Invoice"` in `src/app/App.tsx`, then passing once removed.
- [x] **Repository contracts** (`src/data/repositories`) with in-memory
      implementations, and a contract suite every future implementation must
      also pass: mutations are idempotent, issued documents reject edits, reads
      are company-scoped, search matches the frozen label.
- [x] **§J currency and bank-field definitions**, transcribed from the spec
      table and nothing more. NGN's "three fields, no sort code" is a named
      test, including that no sort code, routing number, IBAN, SWIFT or branch
      field exists on it. Every definition is `validated: false` until
      in-market review (§W), and an unknown currency throws rather than
      guessing a field set (CLAUDE.md).

- [x] **Auth wiring** (`src/data/supabase`): the client, with a guard that
      refuses to build a browser client from a service-role key; and the auth
      service — email/password, Google OAuth, password reset, and the §M
      session rules (a stale session keeps the app usable and pauses sync; no
      auth state ever authorises deleting local work). Unit-tested without a
      network.
- [x] **A runnable hosted gate** — `npm run gate:hosted` applies the migrations
      to the project, re-checks FORCE on the host, creates two REAL users with
      `company_id` claims, and runs the isolation clauses through PostgREST
      with real JWTs rather than a `set_config` shim.

### Open

- [ ] **Run the hosted gate.** Attempted twice, both paths closed.

      *From the agent container:* every Supabase host is denied at the egress
      proxy — `request blocked: no rule or allowlist entry allows host
      "<project>.supabase.co"`, HTTP 403 to CONNECT. `api.github.com` and the
      npm registry are allowed, so this is a host allowlist, not a network
      fault. Raw TCP to 5432/6543 is unavailable too.

      *From GitHub Actions* (run 34611070598, where egress is unrestricted):
      `Missing repository secrets: VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY
      SUPABASE_SERVICE_ROLE_KEY SUPABASE_DB_URL` — all four are unset.

      The one action that unblocks it: add those four as repository secrets
      under Settings → Secrets and variables → Actions, then dispatch
      **Phase 1 gate (hosted)**. Everything else is built and waiting.
- [ ] **Encrypted SQLite opens on device** — DEFERRED TO PHASE 4, where the
      native shell and a physical device exist. It is a §Q Phase 1 gate clause,
      so Phase 1 stays formally unpassed until Phase 4 closes it.

### Phase 1 gate — recorded honestly

| §Q clause | Result |
| --- | --- |
| Two seeded companies cannot read or write each other | ✅ verified, local Postgres — 15 tests, blocking in CI |
| Money and transition property tests pass | ✅ verified — 113 tests, blocking in CI |
| Label resolution passes its own property test; no hardcoded type name survives the lint rule | ✅ verified, both halves |
| Encrypted SQLite opens on device | ⏸ **deferred to Phase 4** — needs the native shell and a physical device |
| Login / register / Google / reset in ≤ legacy tap counts | ⛔ **unverified** — code complete, no reachable instance |
| *(self-imposed)* the same denial suite against the hosted instance | ⛔ **unverified** — same reason |

**The Phase 1 gate is NOT passed.** Three clauses verified, one deferred to
Phase 4, two unverifiable until the project is reachable. Nothing here is
recorded as passing on local evidence when the clause asks about the host.

## Phase 2 — detail

Scope per §Q: customers · the four builders · payments + allocations ·
receipts · on-device PDFs (all sixteen templates) · native share · signatures ·
the per-type lists · Home · Settings essentials · onboarding (§R) ·
improvements 1-3 and 8-10.

### Done

- [x] **The shared component library** (§Q: "the shared component library
      first"): `src/ui` - PageHeader, StatusBadge with the single colour map,
      EmptyState, Skeleton/SkeletonList, LineItemRow, ConnectivityPill.
      Tested on the two invariants that carry real risk: every stored and
      derived status maps to an explicit tone with no silent fallthrough, and
      the connectivity pill never calls pending work uploaded merely because
      the device is online (§M - server acknowledgement completes an upload).
- [x] **§F design tokens as one map each** - type palette keyed by the internal
      type, so a delivery document is amber under every regional name; status
      tones from one map so no surface invents a colour.

### Next

- [x] **Customer balances** (`src/features/customers/balance.ts`) — billed,
      paid, credited, owing and progress, one balance per currency because §G
      forbids adding them; plus "pays on average N days late", which stays
      silent below a two-invoice sample rather than dressing up one data point
      as a pattern. A property test holds paid + owing + credited == billed for
      any ledger, so the three figures on screen cannot disagree.
- [x] **The builder rules** (`src/features/documents/builder.ts`) — five steps
      named per type through the locale layer, per-type issue validation, and
      the §G guarantee that draft saving is never blocked. Problems are
      returned as tokens carrying their step index, so the review screen's
      amber band resolves the words and can link back.
- [x] **UI string catalogue** (`src/domain/locale/data/strings.ts`) — the
      words around the terminology, looked up by LANGUAGE while terminology is
      looked up by REGION, so §S's French-speaking business in Lagos gets FR
      strings with EN-NG document names. A language with no catalogue throws
      rather than serving English under another flag.
- [x] **The customers screen** — skeleton, two distinct empty states (none yet
      vs nothing matched), search across name/phone/email/address, and one
      balance chip per currency. Nine tests, including that a part payment
      shows ₦95,000 owed and that NGN and USD appear as separate chips.
- [x] **The builder shell and review band** — coloured per-type header, the
      five-segment step bar, Back/Next becoming "Save {label}", and the amber
      band resolving problem tokens into the active language with a link back
      to each step. Fifteen tests, including that the same document titles
      itself "Waybill" in EN-NG and "Delivery note" in EN-GB.
- [x] **Step 1 Details, step 2 Items, step 3 Totals** — with the per-type
      differences §G spells out enforced by structure rather than by a flag: a
      receipt has date-paid and no due date, a quotation has valid-until and no
      payment card, a delivery document has a delivery address and no price
      field anywhere. Nineteen tests, most of them holding §V's "delivery
      documents never show prices, tax, totals or payment instructions".
- [x] **The PDF composition model** (`src/pdf/compose.ts`) — §I expressed as
      data rather than markup, so §V's guarantees are testable: a delivery
      document has `totals: null` and `paymentBox: null` **by construction**,
      and no template can render money onto one however it is styled. An issued
      document composes from its frozen labels and language, so a later region
      change never reaches a shared PDF.
- [x] **The sixteen designs** (`src/pdf/templates.ts`) — ten original, six new,
      Bloom and Aria present and Noir absent per §H. A template is style only;
      it never decides what appears on the page. An unknown design throws
      rather than falling back, which would change how an issued PDF looks.
- [x] **Pagination** (`src/pdf/paginate.ts`) — headings repeat on every page,
      rows never split, and the totals-and-signature block lands on exactly one
      page with rows for company. A property test caught the first version
      overflowing the footer page with carried rows.
- [x] **The page renderer** (`src/pdf/DocumentPage.tsx`) at A4 proportions. It
      contains no branch about document type — every per-type decision was made
      in `composeDocument` — so a delivery document renders money-free here
      without this file knowing what a delivery document is. Tested across all
      sixteen designs at once.
- [x] **The logo holder** (`src/pdf/logo.ts`) as arithmetic, not a CSS
      property, so §V's "logos never crop" is proved by a property test over
      any aspect ratio, and holds in the native writer too.
- [x] **Step 4 Design** — the one continuous strip of sixteen with no
      original/new headings, NEW on exactly six, and the logo switch whose
      `aria-pressed` and hint line can never contradict each other.
- [x] **Step 5 Review** — the amber band above a still-readable A4 page, each
      missing item linking back to its step, and the preview being the real
      composition rather than a mock-up (a delivery document previews
      money-free; an issued one previews in its frozen wording).
- [x] **The issue command** (`issue.ts`) — reference, frozen labels and totals
      freeze together as one immutable value, so a half-issued document cannot
      be persisted. Issuing twice is refused by the lifecycle rather than
      minting a second reference.
- [x] **The §M device-qualified reference design task, now closed.** See
      decision 23.
- [ ] Native PDF output and share — needs the Capacitor bridge, **Phase 4**
- [x] **Payments and receipts** — `recordPayment` with the §K rules (over-payment
      becomes customer credit, a payment may stand alone with no invoice), the
      paid-so-far bar's three figures, the payments list with a per-payment
      Receipt button, and the sheet prefilled to the balance. There is
      deliberately no `markPaid(invoiceId)` anywhere: settling an invoice IS
      recording a payment, which is §G's "never writes a bare flag" made
      structural. `receiptDraftFor` derives a receipt from a payment that
      already exists, and there is no path that creates one without.
- [x] **Home and the per-type lists** — exactly two stat cards with one line
      per currency, four tiles in the active terminology, the truthful
      connectivity pill, and "needs attention" capped at three. One page per
      type with the localised hero, type-named search, and no amount column on
      a delivery row. Sixteen tests on the stats alone, one per clause of §G's
      paragraph, because each clause is a way the number could be wrong.
- [x] **Settings → Region & language** — one country choice settling currency,
      bank fields, tax wording, terminology and date format, with those
      consequences shown beside the picker rather than discovered later. The
      §V clause is tested end to end: moving NG → GB renames the delivery
      document on the Home tile, the list hero and the builder header together.
- [x] **Onboarding (§R)** — business setup asking for exactly two things with
      the country pre-filled, "Do this later" as a first-class outcome, resume
      after restart, a checklist derived from state with no separate done flag,
      and sample records that cannot reach a balance or be issued.
- [x] **The remaining Settings essentials** — How you get paid (§J) rendering
      from the same currency definition the PDF prints from, so the form and
      the printed box cannot drift; Tax with a worked example computed by
      `computeTotals` rather than written twice; Company & logo with live name
      preview and prefixes where the regional suggestion is a placeholder and
      never an imposed value; Saved items as a read-only view of what the
      builder remembered.
- [x] **Improvement 1 — WhatsApp payment reminders.** Quotes the outstanding
      balance from the ledger and the actual saved §J bank fields, in Softer
      and Firmer variants. Composing returns text; sending is a separate act,
      so "nothing sends unseen" is structural. Chasing a settled document
      throws. A share records a sharing event and has no `delivered` field to
      set, because the app cannot know (§M).
- [x] **Improvements 2 and 3** landed with the saved catalogue and the payments
      work — autocomplete, prices updating next time, the paid-so-far bar,
      per-payment receipts, balances moving once.
- [x] **Improvement 9 — accessibility.** The longest shipped label is found
      from the tables rather than hardcoded, and asserted to wrap in the list
      hero, the builder header and the new-document button. Step bar, close
      control and current step all carry accessible names.
- [x] **Improvement 10 — the local search index.** Built once rather than
      re-resolved per keystroke, covering references (with or without prefix),
      customers, phone numbers however punctuated, amounts typed either way,
      item names — and both the current and frozen labels, so a company that
      moved to the UK finds its Lagos waybills by either word.
- [ ] **Improvement 8 — the first-run sample document.** The exclusion rules
      and empty states exist; seeding a labelled sample record is the
      remaining piece.
- [ ] Voice and Scan controls on Home — **Phase 6**, deliberately absent
      rather than rendered dead (§N)
- [ ] Improvements 1-3 and 8-10
- [ ] Payments + allocations, receipts
- [ ] On-device PDFs, all sixteen templates
- [x] **Home and the per-type lists** — exactly two stat cards with one line
      per currency, four tiles in the active terminology, the truthful
      connectivity pill, and "needs attention" capped at three. One page per
      type with the localised hero, type-named search, and no amount column on
      a delivery row. Sixteen tests on the stats alone, one per clause of §G's
      paragraph, because each clause is a way the number could be wrong.
- [x] **Settings → Region & language** — one country choice settling currency,
      bank fields, tax wording, terminology and date format, with those
      consequences shown beside the picker rather than discovered later. The
      §V clause is tested end to end: moving NG → GB renames the delivery
      document on the Home tile, the list hero and the builder header together.
- [x] **Onboarding (§R)** — business setup asking for exactly two things with
      the country pre-filled, "Do this later" as a first-class outcome, resume
      after restart, a checklist derived from state with no separate done flag,
      and sample records that cannot reach a balance or be issued.
- [x] **The remaining Settings essentials** — How you get paid (§J) rendering
      from the same currency definition the PDF prints from, so the form and
      the printed box cannot drift; Tax with a worked example computed by
      `computeTotals` rather than written twice; Company & logo with live name
      preview and prefixes where the regional suggestion is a placeholder and
      never an imposed value; Saved items as a read-only view of what the
      builder remembered.
- [x] **Improvement 1 — WhatsApp payment reminders.** Quotes the outstanding
      balance from the ledger and the actual saved §J bank fields, in Softer
      and Firmer variants. Composing returns text; sending is a separate act,
      so "nothing sends unseen" is structural. Chasing a settled document
      throws. A share records a sharing event and has no `delivered` field to
      set, because the app cannot know (§M).
- [x] **Improvements 2 and 3** landed with the saved catalogue and the payments
      work — autocomplete, prices updating next time, the paid-so-far bar,
      per-payment receipts, balances moving once.
- [x] **Improvement 9 — accessibility.** The longest shipped label is found
      from the tables rather than hardcoded, and asserted to wrap in the list
      hero, the builder header and the new-document button. Step bar, close
      control and current step all carry accessible names.
- [x] **Improvement 10 — the local search index.** Built once rather than
      re-resolved per keystroke, covering references (with or without prefix),
      customers, phone numbers however punctuated, amounts typed either way,
      item names — and both the current and frozen labels, so a company that
      moved to the UK finds its Lagos waybills by either word.
- [ ] **Improvement 8 — the first-run sample document.** The exclusion rules
      and empty states exist; seeding a labelled sample record is the
      remaining piece.
- [ ] Voice and Scan controls on Home — **Phase 6**, deliberately absent
      rather than rendered dead (§N)
- [ ] Improvements 1-3 and 8-10

### Needs a human

- [ ] **A physical device** for the §Q Phase 2 gate, which is explicitly
      "airplane mode, fresh install, physical device". Everything up to that
      point is buildable and testable here.

---

## Decisions taken

| # | Decision | Why | Where |
| --- | --- | --- | --- |
| 1 | Amounts are `number` holding integer minor units, not `bigint` | Every amount is a safe integer; it round-trips through SQLite, JSON and sync payloads unchanged. Constructors assert integrality and range; intermediate products are taken in `BigInt`, so precision is never lost where it could be. | `src/domain/money/money.ts` |
| 2 | Rates are integer **parts per million** | 7.5% is exactly 75 000 ppm. Basis points would do, but ppm leaves room for rates that need more precision without reopening the type. A percentage that cannot be represented exactly is rejected rather than rounded. | `percentToPpm` |
| 3 | Rounding is **half away from zero**, applied once, from the exact product | Commercial rounding, not banker's. A line total rounds once at the end — never price-rounds then multiplies. | `mulDivRoundHalfUp` |
| 4 | A document-level discount is attributed back to lines **pro rata, largest remainder** | The tax base has to be exact when only some lines are taxed, and the parts must still sum to the net. Ties go to the earlier line, so two devices compute byte-identical totals. | `distribute`, `computeTotals` |
| 5 | **WHT is taken on the net, exclusive of tax** | Matches §I ("less WHT where configured") and the ordinary treatment. The sample rates in §E are product samples, not tax advice — §W keeps per-market validation open. What is pinned here is the *ordering*, which the property tests hold. | `computeTotals` |
| 6 | Quantities are integers in **milli-units** (3 dp) | "2.5 tonnes" has to be exact, and a float quantity would reintroduce the drift the money rules exist to prevent. A finer quantity is rejected, loudly. | `quantity()` |
| 7 | `computeTotals` **throws** on a waybill rather than returning zeros | §G/§I/§V: a delivery document shows no money anywhere, under any name. A zero is a number that can be printed; an exception cannot. | `computeTotals` |
| 8 | A reversal **and its target both drop out** of the effective ledger | §E makes amendments reversal + replacement. Netting the pair to nothing means a replacement records the corrected amount exactly once, however many times either is replayed. | `effectivePayments` |
| 9 | Overpayment leaves an invoice at **zero, not negative** | It is customer credit, not a negative balance on a document (§K). | `invoiceOutstanding` |
| 10 | Terminology tables carry a `reviewStatus`; nothing unreviewed can ship | §D: "machine translation is a draft, never a release." Making that a field rather than a promise means the Phase-1 resolver can refuse to serve a draft. | `src/domain/locale/types.ts` |
| 11 | The Rule-4 lint rule ships in Phase 0, ahead of its §Q gate | It costs nothing now and prevents the debt it exists to catch. | `tools/eslint` |
| 12 | RLS is ENABLE **and** FORCE, applied by a loop over `public` | ENABLE alone exempts the table owner, so migrations and any owner-privileged path would read across companies while a denial test still passed. The loop means a future table cannot opt out by omission. | `0006_rls.sql` |
| 13 | The RLS suite runs against a bare Postgres, not the hosted project | No secrets in CI, no network, and it cannot fail because a project went to sleep. Only the roles a hosted project already provides are created first, by a CI-only bootstrap. | `supabase/tests` |
| 14 | The public-link token hash lives in its own table, not a column | §P wants it "separate from general document reads". A table with no client policy is stronger than a column any careless `select *` could surface. | `document_signing_tokens` |
| 15 | Two invariants are check constraints, not just UI rules | A waybill's money columns must all be zero and WHT is invoice-only. No client, sync payload or future migration can put a price on a delivery document. | `0002_customers_documents.sql` |
| 16 | A per-type label override renames **every** surface, printed title included | A override that changed the tile but not the PDF would break Rule #5 the moment it was used. | `resolve()` |
| 17 | An unknown locale or currency throws | A silent fallback would ship an English label or an invented field set into a market nobody validated. CLAUDE.md forbids inventing banking rules; this makes it structural. | `tableFor`, `currencyDefinition` |
| 19 | `createBrowserClient` refuses a service-role key | It holds BYPASSRLS. A mis-paste into `VITE_SUPABASE_ANON_KEY` would ship cross-company read and write to every browser, and RLS would never notice — the one failure mode FORCE explicitly does not cover. Cheaper to make impossible than to audit for. | `src/data/supabase/client.ts` |
| 20 | The DB-client import ban is lifted for `src/data/supabase` and `src/data/sqlite` only | Those directories are what `src/data/repositories` exists to hide; everywhere else, `src/app`, `src/features`, `src/pdf` and the whole domain layer included, still cannot import one. Verified by probe. | `eslint.config.js` |
| 21 | A stale session keeps the app usable and only pauses sync | Rule #3 — offline is the product. Signing a user out because a refresh failed would make a network blip look like data loss. No auth state, `signed_out` included, authorises deleting local work (§M). | `src/data/supabase/auth.ts` |
| 22 | The Rule-5 lint rule treats `-` and `_` as part of a word | `file-invoice` (a Tabler icon), `invoice_title` (an i18n key) and `invoice-list` (a test id) are identifiers, not display text. Flagging them trains people to add exemptions, which is how a rule stops being believed. "New Invoice" and "Delivery note" still fail, verified by probe. | `tools/eslint` |
| 23 | The offline reference is `INV-0042-K3` — a two-character device tag, added only when the number did **not** come from a server-reserved block | §M left the format open and asked for "short, prefix-consistent, customer-presentable". A suffix keeps the prefix and number shape a customer already recognises, and appears only on the offline exception rather than on every document, so it reads as part of the number rather than as machinery. Asking the server for a number before issuing would have been the alternative, and that breaks Rule #3. The alphabet excludes I, L, O and U so nothing reads as a digit, and the tag is derived deterministically from the device id because a reference must never change after issue. | `reference.ts` |
| 18 | The lint rule is asserted *inside* the property test, not only in CI | §Q words the gate as "no hardcoded type-name string survives a lint rule written for it". Running ESLint in-process makes that a test that fails on a planted string, with a second case proving the rule still matches so the first cannot pass vacuously. | `resolve.test.ts` |

## Deviations from the spec

**Phase 2 began before the Phase 1 gate passed.** Directed by the owner, and
recorded rather than left silent. It is survivable because Phase 2's scope —
customers, the four builders, payments, receipts, on-device PDFs, share,
signatures, lists, Home, Settings essentials, onboarding — is offline-first by
definition (Rule #3) and runs against the in-memory and SQLite repositories.
None of it reads Supabase Auth. The two unverified Phase 1 clauses are carried
forward and must close before Phase 5 (web + public links), which is the first
phase that genuinely needs the hosted instance.

**Phase 1 began before the Phase 0 gate passed.** §Q and CLAUDE.md both say a
phase does not start until the prior gate does, and Phase 0's tier table and
logo rung are still unmeasured. Those measurements feed §Q Phase 6 — the AI
ladder and the logo engine — and nothing in Phase 1's scope reads either, so
the risk the rule guards against does not arise here. Recorded rather than
left silent, and the Phase 0 items remain open above.

Otherwise none. Where a simple user flow and the spec conflict, §A Rule #1 says
simplify and note it here.

## Open — carried from §W

Unchanged from §W and listed there in full: the Tier-A model pinning, the logo
rung, PowerSync against the chosen encrypted SQLite build, per-market currency
and bank-field validation, the launch set of English variants, FR/ES/AR
scheduling, the Free/Pro split and price points, store policy at submission
time, and the web billing provider per market.

Added by Phase 0:

- **Bank-field definitions (§J) are not yet in code.** They are Phase 1 data,
  and §W holds them open for per-market validation. Nothing has been invented
  ahead of that review.
- ~~The device-qualified reference format (§M "Design task")~~ — **closed**,
  see decision 23. `INV-0042` from a reserved block, `INV-0042-K3` when issued
  offline.

Added by Phase 1:

- **Service-role penetration checks are Phase 7 work, and FORCE does not cover
  them.** FORCE closes the table-owner exemption; it does nothing about
  BYPASSRLS. `service_role` sees and writes every company by design, because
  the edge functions need to — so the whole two-company boundary rests on the
  service key never reaching a client. A leaked key is a total cross-company
  compromise and no policy or test in `supabase/tests` would notice. §Q Phase 7
  owns the scripted checks (wrong user, wrong role, revoked device); they must
  additionally assert that no client bundle, log line, sync payload or
  edge-function response ever carries the key, which is a build-and-deploy
  check rather than a SQL one. Marked `TODO(Phase 7)` in `0006_rls.sql`, and
  asserted as a live behaviour in `rls.test.ts` so the limitation is executable
  rather than a comment someone can skim past.
- **§J field sets remain unvalidated.** Every currency definition carries
  `validated: false`. §W holds them open for per-market review, and the ES
  terminology split (presupuesto vs cotización) likely forces a currency and
  locale split together.
