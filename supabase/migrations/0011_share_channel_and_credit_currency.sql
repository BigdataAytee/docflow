-- Two columns the repository contracts need and the schema never had (§E).
--
-- Both were found the same way as the three in 0008: by mapping every field of
-- a contract onto a column and finding nowhere to put one.

-- 1. A share event records WHICH ROUTE the handoff took (§M).
--
-- `ShareEvent.channel` is 'sheet' | 'clipboard' | 'none', and the distinction
-- is not decoration: a clipboard fallback means the OS share sheet was not
-- available, so "shared" happened in a materially different way. Without the
-- column the field is silently dropped on write and comes back invented on
-- read — the one thing §M's share record is careful NOT to do, which is claim
-- more about a handoff than actually happened.
--
-- Nullable, and deliberately not constrained to the three values: `audit_log`
-- records every action a company takes, and most of them have no channel at
-- all. A CHECK here would be a rule about shares imposed on the whole log.
alter table public.audit_log add column channel text;

-- 2. A credit note's amount had no currency (Rule #3).
--
-- `credit_notes.amount_minor` existed with no `currency` beside it, while
-- `payments`, `expenses` and `documents` all carry one. Minor units alone are
-- not money: 50000 is ₦500.00 or $500.00 depending on a fact the row did not
-- record, and a business invoicing in two currencies would credit in whichever
-- one the reader assumed.
--
-- Reading it off the invoice instead is exactly what Rule #3 forbids — money
-- is never inferred — and it would also be wrong the moment a credit note
-- outlives the document it credits.
--
-- Backfilled from the invoice rather than defaulted to a guess, then made NOT
-- NULL, so the column cannot be skipped by a later writer.
alter table public.credit_notes add column currency char(3);

update public.credit_notes c
   set currency = d.currency
  from public.documents d
 where d.id = c.invoice_id and c.currency is null;

alter table public.credit_notes alter column currency set not null;
