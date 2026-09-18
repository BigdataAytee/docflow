-- Billing the remainder of a part-paid invoice (§G, §K, Rule #5).
--
-- A customer pays ₦50,000 against a ₦145,000 invoice. The original is issued
-- and therefore frozen — its reference, totals and labels cannot move — so the
-- ₦95,000 still owed has to be asked for on a new document. Until now the
-- owner built that by hand, retyping the balance from the screen behind them.
--
-- ONE DEBT ASKED FOR TWICE, not two debts. Without a link the pair read as two
-- separate charges for the same goods, to the owner and to the customer alike.
-- Both ends name each other through this column.
--
-- It touches no money. The original keeps its own balance and its own
-- allocations; nothing is settled, moved or double-counted by creating the
-- follow-up. Nullable, because almost no invoice is one (Rule #1).
alter table public.documents
  add column if not exists bills_balance_of_id uuid references public.documents(id);

-- Read the same way every other document link is: the owner's own rows only.
-- No policy change is needed — `documents` is already scoped by company_id and
-- this column adds no new reachability — but the index is worth having,
-- because "what followed this invoice" is asked from the invoice's own screen.
create index if not exists documents_bills_balance_of_id_idx
  on public.documents (bills_balance_of_id)
  where bills_balance_of_id is not null;
