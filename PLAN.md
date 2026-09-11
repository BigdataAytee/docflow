# PLAN.md — DocFlow

**Where this conflicts with DocFlow-Build-v6, v6 wins.**

`DocFlow-Build-v6-Complete.md` is the authority. This file tracks *where the
build actually is* against §Q, and records decisions as they are taken. It
claims nothing the gates have not proven (§X).

---

## Status board

| Phase | Scope | Gate | State |
| --- | --- | --- | --- |
| **0** | Spikes and reconciliation | tier table + logo rung published; PLAN reconciled; terminology drafts in review; money tests green | **in progress** — see below |
| 1 | Foundation | cross-company denial; money/transition/label property tests; encrypted SQLite; auth ≤ legacy taps | not started |
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

## Deviations from the spec

None so far. Where a simple user flow and the spec conflict, §A Rule #1 says
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
- **The device-qualified reference format (§M "Design task")** — short,
  prefix-consistent, customer-presentable, explained in one line in Settings —
  is still to be designed. It blocks Phase 3, not Phase 1.
