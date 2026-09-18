-- The rest of the picture a receipt has to carry (§I, Rule #5).
--
-- A customer holding a receipt for ₦500,000 needs to see what the bill was,
-- what had already been paid, what they just handed over, and what is left.
-- The amount alone answers one of those four, and `balance_after_minor` a
-- second; these are the other two.
--
-- FROZEN for the same reason as the balance. Recomputed at print time, the
-- sheet in a customer's hand and the one in their email would disagree as
-- later payments arrived — about figures neither of them can have changed.
--
-- Both nullable, and the null means something: a standalone cash receipt
-- settles no invoice and has no such picture to show.
alter table public.documents
  add column if not exists invoice_total_minor bigint,
  add column if not exists paid_before_minor bigint;
