-- A balance invoice is a STATEMENT, not a second bill (§K, Rule #3, Rule #5).
--
-- It carries the original's items so the customer can see what they bought,
-- states the original's frozen total, deducts every payment with the day it
-- arrived, and asks for the remainder:
--
--     Cement 50kg x 20 ........ N100,000
--     Labour 6 hrs .............. N45,000
--     Invoice total ........ N145,000
--     Less: paid on 21 Sep ...... -N50,000
--     Balance due .......... N95,000
--
-- `billed_total_minor` is the ORIGINAL's total, frozen at its issue. The
-- balance is that minus the deductions and is never recomputed from the
-- carried lines: that total settled when the original was issued, and the
-- customer is already holding a document that says so.
--
-- `deductions` is jsonb rather than a table for the same reason
-- `payment_links` is: it is a frozen snapshot printed on one document, not a
-- ledger. The ledger already has the payments; these are the copy that stops
-- changing once the statement is issued (Rule #5), so that reopening a sent
-- document never adds a line to it.
--
-- Both are NULL on every ordinary invoice and on every row that exists today.

alter table documents add column if not exists billed_total_minor integer;
alter table documents add column if not exists deductions jsonb;

comment on column documents.billed_total_minor is
  'Balance invoices: the original invoice total, frozen at the original''s issue (v6 K, Rule 5).';
comment on column documents.deductions is
  'Balance invoices: [{paidAt, amountMinor}] already received, frozen at issue (v6 K, Rule 3).';
