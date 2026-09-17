-- The rate this document was issued at (§D, §K, Rule #5).
--
-- The rates lived only on `companies`, so a document had no rate of its own
-- and every render read whatever the company default is TODAY. Change the VAT
-- rate in Settings and an invoice issued last year re-prints with this year's
-- percentage beside a total that was frozen at the old one — a document that
-- disagrees with itself.
--
-- Rule #5 freezes reference, totals and labels at issue. The rate belongs in
-- that list: it is the explanation of the figure, and an explanation that
-- drifts from what it explains is worse than none.
--
-- Nullable, and it stays nullable. Null means "this was issued before the
-- column existed, or is still a draft" — the reader falls back to the company
-- default, which is exactly what it did before.
--
-- PARTS PER MILLION, like every rate in §K: 7.5% is 75000. Integers, never
-- floats, the same rule that governs amounts (Rule #3).
alter table public.documents add column if not exists tax_rate_ppm integer;
alter table public.documents add column if not exists wht_rate_ppm integer;
