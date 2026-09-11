# CLAUDE.md — DocFlow

## Source of truth

`DocFlow-Build-v6-Complete.md` at the repo root is the single authority.
**Where this conflicts with DocFlow-Build-v6, v6 wins.** Where anything else —
PLAN.md, old code, a comment — conflicts with it, v6 wins there too. Read it
before non-trivial work; cite the section (e.g. §M) in PR descriptions.

## The rules that are never traded away

1. **Simplicity first.** Nothing may be harder than the legacy app. Machinery
   (sync, outbox, UUIDs, RLS, tiers, locale) is invisible to users. No new
   required fields, ever.
2. **Offline is the product.** Every core journey must pass in airplane mode.
   Never add a network dependency to create, view, PDF, share, or record a
   payment.
3. **Money is never inferred.** Amounts are integer minor units. Payments are
   ledger records; receipts are views of payments; balances are computed. No
   floats for money, anywhere.
4. **One word everywhere.** Type names, party labels and printed titles resolve
   ONLY through `src/domain/locale`. A hardcoded "Invoice"/"Waybill" string in
   UI/PDF/share code is a bug — the lint rule enforces this.
5. **Issued documents are immutable.** Reference, totals, labels and language
   freeze at issue. Corrections are void/credit/reissue. Sync must never
   rewrite them.
6. **Documents are never hostage.** A lapsed subscription never blocks viewing,
   sharing or exporting existing records. Export is free forever.

## Architecture invariants

* UI components import repositories from `src/data/repositories` — never a DB
  client, never Supabase, never SQLite directly.
* Every mobile mutation = record write + outbox enqueue in ONE SQLite
  transaction. A failed commit must not show "Saved".
* Server acknowledgement (not connectivity) completes an upload. All ops carry
  idempotency keys.
* Derived states (paid, overdue, expired) are computed at read time, never
  stored as truth.
* Files ~300 lines max as a maintainability target; don't split coherent logic
  to hit a number.
* Every screen ships with skeleton, empty state, toast feedback, dark-mode-safe
  tokens, a11y labels. No spinners, no blank screens.

## Workflow

* Phases run 0 → 7 per §Q. Do not start a phase before the prior gate passes.
  Current status lives in `PLAN.md`.
* Phase 0 first: repo reconciliation (legacy → `/legacy`, secrets scan +
  rotation BEFORE the move), hardware spikes with the pre-agreed kill criteria,
  money property tests into CI.
* Tests before merge: money property tests (fast-check) and lifecycle
  transition tests are blocking. Sync work additionally requires the chaos
  suite scenarios it touches.
* Never port `/legacy` data-layer code, Mail, or the Apps page. `/legacy` is
  read-only reference.
* When the spec and a simple user flow conflict: simplify, and note the
  deviation in the PR.

## Commands

```bash
npm run dev         # web dev server (memory repos)
npm run typecheck   # strict TS, zero errors policy
npm run lint        # includes docflow/no-hardcoded-type-name (Rule 4)
npm test            # money property tests + lifecycle tests (blocking)
npm run build       # must stay green on every commit
npm run verify      # all four, in the order CI runs them
```

## Where things live

| Path | What |
| --- | --- |
| `DocFlow-Build-v6-Complete.md` | The authority (§A–§X) |
| `PLAN.md` | Phase status, gates, and the decisions taken so far |
| `src/domain/money` | Exact money: minor units, totals, distribution |
| `src/domain/documents` | Internal types, statuses, lifecycle and immutability |
| `src/domain/payments` | The ledger: allocations, reversals, balances |
| `src/domain/locale` | Locale profiles and the §D terminology tables |
| `tools/eslint` | The Rule-4 lint rule |
| `docs/spikes` | Phase-0 spike protocols with pre-agreed kill criteria |
| `docs/locale` | Native-speaker review sheet for the terminology drafts |
| `docs/discoverability` | §T keyword sheets and store listings |
| `legacy/` | The Base44 app. **Read-only reference. Never imported.** |

## Things Claude Code must not do

* Invent tax/banking rules — §J field sets are product samples pending market
  validation.
* Add cloud AI calls or silent online fallbacks — §N forbids them; the
  consented carve-out is the only exception and is owner-disableable.
* Write to `subscriptions`/`entitlements` from the client — service-role edge
  functions only.
* Weaken RLS, log secrets, or commit keys. `.env` is gitignored; keys live in
  secure storage.
* Import anything from `legacy/` into `src/`. It is reference, not a library.
* Ship a terminology table that has not been signed off by a native speaker —
  `reviewStatus` gates it.
