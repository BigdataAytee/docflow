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
npm run test:tail   # the suite, last 30 lines, EXIT CODE INTACT
```

### Guards

**A fixture proves the rule detects a shape; only the mutation proves it
detects the bug.** Any new guard is unproven until the defect it was written
for has been reintroduced and the guard has gone red. Three versions of the
declared-field sweep passed their fixtures and still missed the real bug —
each failure was visible only by reverting the actual fix.

**A production guard must exclude test files.** A fixture writing a field
makes it read as filled while the column prints blank: `compose.test.ts`
assigned `unit: 'cartons'`, and that alone kept the sweep green over a
genuinely empty UNIT column. A test filling a shape proves the shape can be
filled, never that anything fills it.

**Know which shape a guard catches.** `tools/sweeps/declared.ts` catches
*declared and never consumed*. It does NOT catch *declared and never
reachably filled*: a field assigned by a mapper reads as written even when
nothing a user can reach ever fills it, so removing the step where a person
enters a value leaves the field looking filled. That second shape is what
produced `vehicleNumber` and `expectedDate`, and both were found by eye.
Answering it properly needs reachability analysis; a heuristic would produce
false positives, and a guard that cries wolf is one people learn to ignore.

**A text scan cannot tell a fill from an argument object.**
`format(strings.settings.perUnit, { unit: item.unit })` is the line that
PRINTS a unit, and it is the same shape as a line that fills one — so a read
counts as a write, from the very line proving it is a read. `SavedItem.unit`
survived on that alone. Two things now read as writes without being one: a
mapper assignment, and an argument object.

**Assert consumption, not declaration.** `expect(keys).toContain('unit')` was
true for as long as the column printed nothing. Assert the row, the rendered
value, the thing a person would see.

**Never pipe a test or build command through `tail`, `head`, or `grep.`** A
shell pipeline reports the status of its LAST command, and those always
succeed — so a suite with fifteen failures exits 0 and every check downstream
is told it passed. This is not hypothetical: it happened here, and a broken
suite was read as green and reported as green.

Use `npm run test:tail` (which does the trimming in-process, after the child
has exited, and re-raises the child's status), or capture the code before the
pipe: `npx vitest run > out.txt 2>&1; echo $?`. If a pipeline is genuinely
unavoidable, `set -o pipefail` first.

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
