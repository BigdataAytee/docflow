# Walkthrough verification

`docs/design-reference/handoff/docs/WALKTHROUGH.md` is the reference's
"minimum manual pass". This is that pass, walked against the build, line by
line — what is there, what is not, and what is deliberately not.

The distinction that matters throughout: **built** means a person can reach it
and it does the thing; **absent by decision** means v6 puts it in a later
phase or forbids the reference's version of it, and the app says so rather
than showing a control that does nothing (§N).

Dated against commit `2e96640` and the Settings pass before it.

---

## Home

| Walkthrough item | State |
| --- | --- |
| Logo / profile link | Built. The header holder is drawn before a logo exists (§F) and Company & logo can now set one. |
| Greeting | Built — local-time, §F. **Without the user's display name**: §E's `users` row carries `display_name` and nothing in this build reads that row. |
| Two stats | Built. Outstanding and Received this month, separate per currency (§G). |
| Global search + empty results | Built, with the empty state. |
| Voice, scan | Built as controls; §N's installed-model work is Phase 6, and an unsupported device is told so rather than relabelled. |
| Four document tiles | Built, per-type colour. |
| Attention items | Built. |
| Connection demo | **Absent by decision.** §F wants "a truthful connectivity indicator driven by real connection + pending work (simulated toggling is demo-only)". A toggle that fakes a connection state is the one thing §F names as demo-only. |
| Logout | Built, on Home's header AND in Settings → Your account, both opening the same confirmation sheet. |

## Main navigation

Built: Home, Customers, Analytics, Settings, with active state, and the same
destinations on the wide-screen sidebar (one navigation, never two). The
navigation sweep walks every destination by keyboard.

## Document lists

Built per type: type-specific search, rows, New, floating create.

## Builders

Details/Deliver to → Items/Goods → Totals/Dispatch → Design → Review, per
type, with Back/Next, the type-named Save on the last step, autosave and
post-force-kill recovery.

* Dates, customer search and add, currency — built.
* **Payment-setup detour — built, and completed this pass.** The amber control
  carries into Settings under §G's blue return band ("Setting up payment for
  your document · Back to draft") and returns to the same draft.
* Signature capture / clear / save — built.
* Item creation, removal, catalogue — built; the catalogue now keeps the unit
  as well as the price.
* **Waybills omit money** — guarded per surface, across all sixteen designs.

## Design

All sixteen templates, colour, logo visibility, logo size, name style — built.
Long names and many line items are covered by the label-length and pagination
tests. Review now names the chosen design above the page ("Classic · A4
portrait"), which it did not.

## Saved documents

Payments, part payments, receipt access, reminders, repeat, conversion,
signature, share and corrections — built, per type. Records are written
through the repositories, which the route tests walk end to end.

## Customers

Search, list, add, open, labels, notes, history, balances, statements, chat
and call — built.

## Analytics

Income / expenses / kept, expense entry, chart states, ageing, top items,
business questions — built.

## Settings

| Item | State |
| --- | --- |
| Company / logo | Built, in the reference's order, with a working Upload. |
| Numbering | Built, two prefixes to a row. |
| Tax | Built, with the worked example. |
| Payment methods, currency-specific fields | Built from §J's definition. NGN's three, no invented sort code. |
| Saved items | Built. |
| Default signature | Built. |
| Account | Built this pass. |
| Password | Built as the provider's reset. **No old/new/confirm form** — the provider owns the credential (§P). |
| Language | Built this pass. Lists only languages with a complete catalogue (§S); today, English. |
| Appearance / text size | Dark mode built; text size follows the phone, per §G. |
| Data / sync | Built, with storage used, and an upload state that no longer claims an account it does not have. |
| Admin | **Absent by decision.** §O is Phase 7 and needs server-enforced permissions. No row promises it. |
| Help | Built this pass, with Getting started. |

## Logo wizard

**Absent by decision, and this is the one worth stating in full.**

The reference's wizard is a template-based symbol matcher, and it says so on
its own screen: "it does not generate original artwork from arbitrary
descriptions". v6 §N is more direct — the prototype's picker is "a
demonstration only", and the shipped thing is a procedural concept engine that
satisfies a twenty-distinct rubric offline, in Phase 6.

So the app does not ship the reference's picker, and it does not ship an empty
room in its place either. Company & logo carries the Create control, disabled,
with the reason beside it, and Upload working next to it. A route whose only
content is "not built yet, here is Upload again" would be worse than the
sentence already there.

The walkthrough's own instruction agrees: "This tests the current reference
only; separately test the model-backed production requirement in specification
§17."

## Data / admin

Export, sync state and conflict comparison — built (the conflict chooser is
labelled an example while open, and choosing in it writes nothing).
Staff permissions, invitations and device revocation are Phase 7 with §O, and
the walkthrough's own line applies: "Demonstration screens do not count as
backend verification."

## Help

FAQ expand / collapse — built. Getting started — built this pass, and it opens
§R's welcome, which had been reachable exactly once.

## Onboarding

Welcome, sample exploration, company / currency setup, first document choice,
guidance, checklist, skip / back, completion — built. **Reopen from Help —
built this pass.**

## Logout

Confirmation → signed-out view → back to welcome — built. The confirmation
promises only what is true: records are on the device and export is free
forever (Rule #6), so signing out takes no document away.

---

## What this pass does not prove

Everything above is a browser and a test suite. The walkthrough's last
paragraph is the part that needs hardware and a deployed backend:
airplane-mode restart and recovery, idempotent reconnect, cross-account
isolation, two-device conflicts, real PDF export, permissions, offline model
installation. Those are §Q's gates, and `PLAN.md` holds their status — the
hosted deploy is written and unrun.
