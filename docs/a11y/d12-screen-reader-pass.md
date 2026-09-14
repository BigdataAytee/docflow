# D12 — the screen-reader pass

§V: *"Large text, **screen readers**, keyboard navigation and reduced motion
work without clipped actions."*

**Status: not run.** The results tables below are empty and stay empty until a
person who uses a screen reader fills them in. Nothing in this repository can
complete this, and no passing test should be read as having done so.

---

## Who runs it

**Somebody who uses a screen reader daily.** Not a sighted developer switching
VoiceOver on for an hour — that is a useful exercise and it is a different
test. It finds "the button has no label"; it does not find "this is the third
time this screen has said my company name and I have stopped listening".

Pay them. This is skilled work and the finding rate is the reason the pass
exists.

## The kill criteria — fixed in advance, argued never

Pre-agreed so that a bad result is a piece of work rather than a negotiation.

| Finding | Threshold | Consequence |
| --- | --- | --- |
| A core journey cannot be completed at all | any one | **Launch blocker.** §V's checklist is not green and Phase 7's gate stays shut |
| A core journey takes more than **twice** the taps/swipes of the sighted path | any one | Blocker: Rule #1 says nothing may be harder than the legacy app, and it does not carve out screen-reader users |
| Money or a document reference is announced wrongly or ambiguously | any one | **Blocker.** Rule #3: money is never inferred, and a misheard total is an inferred one |
| An action is reachable but its effect is not announced | any one | Blocker |
| A screen is merely tiring — repetition, verbosity, a rotor full of identical entries | 3 or more | Fix before launch; not a blocker on its own |
| A wording preference | any | Recorded, decided by the product owner |

## Devices

Both platforms, and the web, because §U ships all three.

| # | Platform | Reader | OS version | Device | Run by |
| --- | --- | --- | --- | --- | --- |
| 1 | iOS | VoiceOver | _to fill_ | _to fill_ | _to fill_ |
| 2 | Android | TalkBack | _to fill_ | _to fill_ | _to fill_ |
| 3 | Web | NVDA or VoiceOver on macOS | _to fill_ | _to fill_ | _to fill_ |

## The journeys to walk

§Q's core journeys, in the order somebody actually meets them. Each is walked
**end to end, with the screen curtain on** — a pass where the tester can glance
at the screen is not a pass.

| # | Journey | Result | Notes |
| --- | --- | --- | --- |
| 1 | First run: reach a usable app from a cold install | _to fill_ | |
| 2 | Create an invoice, add two lines, issue it | _to fill_ | |
| 3 | Share the issued invoice | _to fill_ | |
| 4 | Record a part payment against it | _to fill_ | |
| 5 | Make a receipt from that payment | _to fill_ | |
| 6 | Find that invoice again by number, and by customer | _to fill_ | |
| 7 | Sign a delivery document | _to fill_ | |
| 8 | Change region, and confirm the words changed | _to fill_ | |
| 9 | Export everything | _to fill_ | |
| 10 | Delete the account, then cancel the deletion | _to fill_ | |

## What has already been checked by machine — do not spend time here

These are audited on every run of `npm run sweep:screenreader`, across 21
routes at two widths and with the command palette open. If one of them is
wrong on a device, that is a finding about the DEVICE and worth writing down.

- Every control has a name, and no name is a bare glyph.
- One `main` landmark per page; no control outside a landmark or a dialog.
- Headings start at level 1 and skip no level.
- No `aria-label` on an element that cannot carry one.
- No landmark named after something inside it.
- Focus moves to the new page on a navigation, and into a panel when it opens.
- **Reading order matches visual order** — `tools/sweeps/readingorder.ts`
  compares what is heard against what is seen, sibling by sibling.

`docs/a11y/transcripts/` holds, per route, the nodes a reader walks and the
name each carries. **Read the transcript for a screen before you listen to
it.** Where the device disagrees with the file, the difference is the finding.

## What a machine cannot judge — please attend to these

The reason this pass exists. None of the following can be settled by a test,
and all of them make an app unusable while every automated check passes.

1. **Does the order make sense?** A machine can confirm the total is announced
   after the line items. Only a listener can say whether hearing it in that
   order is how a person understands an invoice.
2. **Is it exhausting?** Count the words before the first useful one on each
   screen. Repetition is the most common reason people abandon an app that
   technically works.
3. **Known redundancy to judge:** on Home, `Needs attention` is announced as
   a region and again as its heading. The same shape appears on the stat
   cards. It is deliberate — the regions make landmark navigation useful —
   and whether the cost is worth it is a listening question, not a code one.
4. **Money.** Is `₦323,500.00` said as naira, three hundred and twenty-three
   thousand five hundred? Or as digits? Does a delivery document ever mention
   an amount (it must not — §B)?
5. **References.** Is `INV-0042-K3` announced letter by letter, or as a word?
   Can a person read one back to a customer over the phone?
6. **Terminology.** In a Ghana or UK profile, is the document called what §D
   says it is called, everywhere, including where the reader falls back to a
   tooltip or a title attribute?
7. **The gestures.** VoiceOver's rotor and TalkBack's local menu: can a person
   navigate this app by heading, by landmark, by form control? Is the order
   in each of those lists useful, or alphabetical noise?
8. **Braille.** Does anything rely on a colour, an icon or a position that a
   braille display cannot convey?
9. **Interruptions.** Does the connectivity pill, the demo banner, or a save
   toast talk over something the person was reading?
10. **The native shell** (once Phase 4 exists). A WebView maps this same tree
    through a second translation layer on each platform. Everything above is
    worth re-checking there, because the answer can differ.

## Findings

| # | Journey | Platform | Severity | What happened | What it should do |
| --- | --- | --- | --- | --- | --- |
| _to fill_ | | | | | |

## Sign-off

This pass is complete when every journey above has a result, every blocker is
fixed and re-walked, and the person who ran it signs here.

- Run by: _to fill_
- Date: _to fill_
- Build: _to fill_
- Outcome: _to fill_
