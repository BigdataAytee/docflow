# DocFlow

A business-document app for small businesses anywhere. Four core documents —
invoices, quotations, receipts and delivery documents (shown under the regional
name: waybill, delivery note, packing slip, bon de livraison…) — with
customers, payments, outstanding balances and expenses, shared as PDFs over
WhatsApp or the native share sheet.

**Offline is the product.** After first sign-in, every core journey works in
airplane mode.

## The authority

`DocFlow-Build-v6-Complete.md` is the single source of truth for this build.
Where anything else conflicts with it, v6 wins. `CLAUDE.md` holds the working
rules; `PLAN.md` holds the current phase status and the decisions taken.

## Where the build actually is

**Phase 0.** The repo is reconciled, the money and lifecycle test harness runs
on every commit, the terminology tables are drafted, and the spike protocols
are written with their kill criteria fixed. The hardware spikes have **not**
been run — they need physical devices — so the device tier table and the logo
ladder rung are still undecided, and the Phase 0 gate is not passed.

This README claims nothing beyond that. Per §X, the product is finished when
the gates pass, not when the screens resemble the prototype.

## Commands

```bash
npm install
npm run dev         # web dev server
npm run typecheck   # strict TS, zero errors
npm run lint        # includes the "one word everywhere" rule
npm test            # money property tests + lifecycle tests (blocking)
npm run build
npm run verify      # all four, in the order CI runs them
```

## Layout

```
DocFlow-Build-v6-Complete.md   the authority
CLAUDE.md · PLAN.md            working rules · phase status and decisions
src/domain/money               exact money — integer minor units, totals
src/domain/documents           internal types, statuses, lifecycle
src/domain/payments            the ledger — allocations, reversals, balances
src/domain/locale              locale profiles and the §D terminology tables
tools/eslint                   the "one word everywhere" lint rule
docs/                          spike protocols, review sheets, §T keyword sheets
legacy/                        the Base44 app — read-only reference
```

## `/legacy`

The previous Base44 app, moved here whole with its history intact. It is
**reference only**: never imported, never built, never linted. Its data layer,
Mail and Apps page are explicitly not ported.
