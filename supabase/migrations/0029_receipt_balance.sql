-- What a receipt's payment left owing on the invoice it settled (§I, Rule #5).
--
-- A customer holding a receipt for ₦500,000 against a ₦1,000,000 invoice needs
-- to know they still owe ₦500,000. The app knew and did not print it, so the
-- paper answered half the question it exists to answer.
--
-- FROZEN AT ISSUE, which is the whole reason this is a column rather than a
-- computation. Worked out at print time it would say something different every
-- time the PDF was opened, as later payments arrived — so the sheet in a
-- customer's hand and the one in their email would disagree about a figure
-- neither of them can have changed. Rule #5 freezes the reference, the totals
-- and the labels for exactly this reason; the balance is the same kind of fact.
--
-- Nullable, and the null MEANS something: a standalone receipt settles no debt
-- and reports the state of none. Zero is different again — a debt this payment
-- cleared, which prints "Paid in full" rather than a zero that reads as an
-- oversight.
alter table public.documents
  add column if not exists balance_after_minor bigint;
